/**
 * 数据抓取模块 — 从外部 API 获取基金、指数、板块、资金流向数据
 */

const axios = require('axios');
const logger = require('./utils/logger.cjs');
const iconv = require('iconv-lite');
const { getPool } = require('./db.cjs');
const fundService = require('./fund-service.cjs');
const { analyzeGoldFund } = require('./fund-analysis.cjs');

// 默认市场指数配置
const defaultIndices = [
  { code: '000300', name: '沪深300', valuation: '合理偏低', suggestion: '适合定投' },
  { code: '000905', name: '中证500', valuation: '合理偏低', suggestion: '适合定投' },
  { code: '399006', name: '创业板指', valuation: '合理', suggestion: '适合小额定投' },
  { code: '000688', name: '科创50', valuation: '合理偏高', suggestion: '建议观望' },
  { code: '000001', name: '上证指数', valuation: '合理', suggestion: '适合定投' },
];

// 从腾讯行情API批量获取基金净值（每次最多50只）
async function fetchFundNavBatch(codes) {
  const results = new Map();
  try {
    const symbols = codes.map(c => 'jj' + c).join(',');
    const response = await axios.get(`https://qt.gtimg.cn/q=${symbols}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.data) return results;

    const lines = response.data.split(';').filter(l => l.includes('~'));
    for (const line of lines) {
      const parts = line.split('~');
      if (parts.length < 9) continue;
      const code = parts[0].split('"')[1]?.replace('jj', '');
      const nav = parseFloat(parts[5]);
      const totalNav = parseFloat(parts[6]);
      const navDate = parts[8];
      if (code && nav > 0 && navDate) {
        results.set(code, { nav, totalNav, navDate });
      }
    }
  } catch (error) {
    logger.warn(`[净值] 批量获取净值失败: ${error.message}`);
  }
  return results;
}

// 从新浪财经获取市场指数实时数据
async function fetchMarketIndices() {
  const symbols = [
    { code: '000300', symbol: 'sh000300', name: '沪深300' },
    { code: '000905', symbol: 'sh000905', name: '中证500' },
    { code: '399006', symbol: 'sz399006', name: '创业板指' },
    { code: '000688', symbol: 'sh000688', name: '科创50' },
    { code: '000001', symbol: 'sh000001', name: '上证指数' },
    // 美股指数：新浪 gb_ 格式，fields[1]=现价, fields[2]=涨跌幅%, fields[4]=涨跌额
    { code: '.DJI', symbol: 'gb_dji', name: '道琼斯' },
    { code: '.IXIC', symbol: 'gb_ixic', name: '纳斯达克' },
    { code: '.INX', symbol: 'gb_inx', name: '标普500' },
  ];

  try {
    const listStr = symbols.map(s => s.symbol).join(',');
    const response = await axios.get(
      `https://hq.sinajs.cn/list=${listStr}`,
      { timeout: 8000, headers: { Referer: 'https://finance.sina.com.cn/' } }
    );

    if (!response.data) return 0;

    const lines = response.data.split('\n').filter(l => l.includes('='));
    let updatedCount = 0;

    for (const line of lines) {
      const match = line.match(/hq_str_(\w+)="(.+)"/);
      if (!match) continue;

      const symbol = match[1];
      const fields = match[2].split(',');
      if (fields.length < 4) continue;

      const config = symbols.find(s => s.symbol === symbol);
      if (!config) continue;

      const isUS = config.code.startsWith('.');
      // 美股 gb_：fields[1]=现价, fields[2]=涨跌幅%, fields[4]=涨跌额
      // A股 sh/sz：fields[2]=昨收, fields[3]=现价
      const current = parseFloat(isUS ? fields[1] : fields[3]);
      if (!current) continue;

      let change, changePercent;
      if (isUS) {
        changePercent = parseFloat(fields[2]);
        change = parseFloat(fields[4]);
        if (isNaN(change)) change = (changePercent / 100) * current;
      } else {
        const prevClose = parseFloat(fields[2]);
        if (!prevClose) continue;
        change = current - prevClose;
        changePercent = (change / prevClose) * 100;
      }

      await fundService.updateMarketIndex(config.code, {
        name: config.name,
        price: current.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
      });
      updatedCount++;
    }

    logger.info(`[指数] 更新了 ${updatedCount}/${symbols.length} 个指数`);
    return updatedCount;
  } catch (error) {
    logger.warn('[指数] 获取指数数据失败:', error.message);
    return 0;
  }
}

// 指数ROE常量（PB = PE × ROE）。东财push2已取消指数PE/PB字段，
// PE取自腾讯行情(qt.gtimg.cn) p[39]，PB用ROE推导。
const INDEX_ROE = {
  '000300': 0.09, '000905': 0.03, '399006': 0.03, '000688': 0.007, '000001': 0.07, '000852': 0.03,
};

// 从腾讯行情 API 获取指数真实 PE/PB（PE取自p[39]，PB用ROE推导）
async function fetchIndexValuation() {
  const indexConfigs = [
    { code: '000300', symbol: 'sh000300', name: '沪深300' },
    { code: '000905', symbol: 'sh000905', name: '中证500' },
    { code: '399006', symbol: 'sz399006', name: '创业板指' },
    { code: '000688', symbol: 'sh000688', name: '科创50' },
    { code: '000001', symbol: 'sh000001', name: '上证指数' },
    { code: '000852', symbol: 'sh000852', name: '中证1000' },
  ];

  try {
    let updatedCount = 0;

    for (const config of indexConfigs) {
      try {
        const response = await axios.get(`https://qt.gtimg.cn/q=${config.symbol}`, {
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        const line = (response.data || '').split(';').find(l => l.includes('~'));
        if (!line) continue;
        const p = line.split('~');
        if (p.length < 50) continue;

        const pe = parseFloat(p[39]) || null;
        if (!pe || pe <= 0) continue;

        // PB 用 PE × ROE 推导
        const pb = parseFloat((pe * (INDEX_ROE[config.code] || 0.05)).toFixed(2));

        const pePercentile = await calculateHistoricalPercentile(config.code, pe, 'pe');
        const pbPercentile = await calculateHistoricalPercentile(config.code, pb, 'pb');
        const { valuation, suggestion } = getValuationByPercentile(pePercentile);

        await saveValuationSnapshot(config.code, config.name, pe, pb);

        await fundService.updateMarketIndex(config.code, {
          name: config.name,
          pe: pe.toFixed(2),
          pb: pb.toFixed(2),
          pePercentile,
          pbPercentile,
          valuation,
          suggestion,
        });
        updatedCount++;
      } catch (e) {
        logger.warn(`[估值] 获取 ${config.name} 失败: ${e.message}`);
      }
    }

    if (updatedCount > 0) {
      logger.info(`[估值] 更新了 ${updatedCount}/${indexConfigs.length} 个指数PE/PB估值（腾讯真实PE + ROE推导PB）`);
    }
    return updatedCount;
  } catch (error) {
    logger.warn('[估值] 获取估值数据失败:', error.message);
    return 0;
  }
}

// 保存估值快照到历史表
async function saveValuationSnapshot(code, name, pe, pb) {
  const pool = getPool();
  // 使用本地日期（中国时区），避免 UTC 偏移导致写入前一天
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  try {
    await pool.query(
      `INSERT INTO index_valuation_history (index_code, index_name, trade_date, pe, pb)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (index_code, trade_date) DO UPDATE SET
         pe = EXCLUDED.pe, pb = EXCLUDED.pb`,
      [code, name, today, pe, pb]
    );
  } catch { /* 表可能尚不存在，静默处理 */ }
}

// 基于历史数据计算分位数，历史不足时回退到区间估算
async function calculateHistoricalPercentile(code, value, type) {
  const pool = getPool();
  try {
    const column = type === 'pb' ? 'pb' : 'pe';
    const result = await pool.query(
      `SELECT ${column} FROM index_valuation_history
       WHERE index_code = $1 AND ${column} IS NOT NULL
       ORDER BY trade_date`,
      [code]
    );
    const values = result.rows.map(r => parseFloat(r[column])).filter(v => v > 0);
    if (values.length >= 10) {
      const below = values.filter(v => v < value).length;
      return parseFloat(((below / values.length) * 100).toFixed(1));
    }
  } catch {}
  return estimatePercentile(code, value, type);
}

// 根据指数历史PE/PB区间估算分位数（0-100）
function estimatePercentile(code, value, type) {
  const peRanges = {
    '000300': [9, 20], '000905': [18, 50], '399006': [30, 90],
    '000688': [40, 160], '000001': [11, 25],
  };
  const pbRanges = {
    '000300': [0.9, 1.8], '000905': [0.8, 2.0], '399006': [1.2, 4.5],
    '000688': [0.8, 4.0], '000001': [0.9, 1.8],
  };
  const ranges = type === 'pb' ? pbRanges : peRanges;
  const r = ranges[code];
  if (!r) return 50;
  return Math.min(100, Math.max(0, Math.round(((value - r[0]) / (r[1] - r[0])) * 100)));
}

// 根据PE分位数判断估值水平和投资建议
function getValuationByPercentile(p) {
  if (p == null) return { valuation: '数据缺失', suggestion: '暂无建议' };
  if (p < 20) return { valuation: '极度低估', suggestion: '适合加大定投' };
  if (p < 40) return { valuation: '偏低估', suggestion: '适合定投' };
  if (p < 60) return { valuation: '合理', suggestion: '适合小额定投' };
  if (p < 80) return { valuation: '偏高估', suggestion: '建议观望' };
  return { valuation: '极度高估', suggestion: '建议减仓' };
}

// 获取板块轮动数据
async function fetchSectorData() {
  try {
    const response = await axios.get(
      'https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php',
      { timeout: 8000, responseType: 'arraybuffer', headers: { Referer: 'https://finance.sina.com.cn/' } }
    );

    const text = iconv.decode(Buffer.from(response.data), 'gbk');
    const jsonStr = text.replace(/^var S_Finance_bankuai_sinaindustry = /, '').replace(/;$/, '');
    const data = JSON.parse(jsonStr);

    const sectors = Object.values(data).map(v => {
      const f = v.split(',');
      return {
        name: f[1],
        change: parseFloat(f[5]) || 0,
        volume: (parseInt(f[7]) / 1e8).toFixed(1) + '亿',
        leadingStock: f[12] || '',
      };
    }).sort((a, b) => b.change - a.change);

    await fundService.updateSectorData(sectors);
    logger.info(`[板块] 更新了 ${sectors.length} 个行业板块`);
    return sectors;
  } catch (error) {
    logger.warn('[板块] 获取板块数据失败:', error.message);
    return [];
  }
}

// 从东方财富获取单只基金收益率
async function fetchFundReturns(code) {
  try {
    const response = await axios.get(
      `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://fund.eastmoney.com/',
          Range: 'bytes=0-5000',
        },
      }
    );

    const text = response.data || '';
    const extract = (key) => {
      const m = text.match(new RegExp(key + "\\s*=\\s*['\"]([^'\"]+)"));
      return m ? parseFloat(m[1]) : null;
    };

    return {
      return1y: extract('syl_1n'),
      return6m: extract('syl_6y'),
      return3m: extract('syl_3y'),
      return1m: extract('syl_1y'),
      return1w: null,
    };
  } catch (error) {
    return null;
  }
}

// 从东方财富获取近1周收益率
async function fetchReturn1w(code) {
  try {
    const response = await axios.get(
      `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=10`,
      { timeout: 6000, headers: { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' } }
    );
    const list = response.data?.Data?.LSJZList;
    if (!list || list.length < 2) return null;

    const latest = parseFloat(list[0].DWJZ);
    const latestDate = new Date(list[0].FSRQ);
    for (const item of list) {
      const itemDate = new Date(item.FSRQ);
      const diffDays = (latestDate - itemDate) / 86400000;
      if (diffDays >= 5 && diffDays <= 9) {
        const nav = parseFloat(item.DWJZ);
        if (nav > 0) return parseFloat(((latest - nav) / nav * 100).toFixed(2));
      }
    }
    return null;
  } catch {
    return null;
  }
}

// 获取单只QDII基金的收益率和申购状态
async function fetchSingleQDIIData(code) {
  try {
    let buySuggestion = '开放申购';
    let dailyLimit = 0;
    try {
      const infoRes = await axios.get(
        'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
        { params: { FCODE: code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' }, timeout: 8000 }
      );
      const infoData = infoRes.data?.Datas;
      if (infoData) {
        const sgzt = infoData.SGZT || '';
        const maxsg = parseInt(infoData.MAXSG);
        if (sgzt.includes('暂停')) {
          buySuggestion = '暂停申购';
          dailyLimit = 0;
        } else if (sgzt.includes('限') || sgzt.includes('大额')) {
          buySuggestion = '限大额';
          dailyLimit = isNaN(maxsg) ? 10 : maxsg;
        }
      }
    } catch (e) { logger.warn('[data-fetcher] 数据解析跳过:', e.message); }

    let nav = null, navDate = null;
    let return1m = null, return3m = null, return6m = null, return1y = null;
    try {
      // 分页拉取净值历史 — API 限制 pageSize <= 20
      const allRecords = [];
      for (let page = 1; page <= 20; page++) {
        const lsjzRes = await axios.get(
          `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=20`,
          { timeout: 8000, headers: { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
        );
        const pageList = lsjzRes.data?.Data?.LSJZList;
        if (!pageList || pageList.length === 0) break;
        allRecords.push(...pageList);
        if (allRecords.length >= 260 || pageList.length < 20) break;
        await new Promise(r => setTimeout(r, 80));
      }
      const list = allRecords;
      if (list && list.length > 0) {
        nav = parseFloat(list[0].DWJZ);
        navDate = list[0].FSRQ;

        const findNav = (days) => {
          const target = new Date(navDate);
          target.setDate(target.getDate() - days);
          const ts = target.toISOString().split('T')[0];
          for (const item of list) {
            if (item.FSRQ <= ts) return parseFloat(item.DWJZ);
          }
          return null;
        };
        const calcReturn = (n) => n ? parseFloat(((nav - n) / n * 100).toFixed(2)) : null;

        return1m = calcReturn(findNav(30));
        return3m = calcReturn(findNav(90));
        return6m = calcReturn(findNav(180));
        return1y = calcReturn(findNav(365));
      }
    } catch (e) { logger.warn('[data-fetcher] 数据解析跳过:', e.message); }

    return { nav, navDate, return1m, return3m, return6m, return1y, buySuggestion, dailyLimit };
  } catch (error) {
    return null;
  }
}

// 从东方财富获取QDII基金收益率+申购状态
async function fetchQDIIData(allFunds) {
  const qdiiFunds = allFunds.filter(f => f.type === 'QDII');
  if (qdiiFunds.length === 0) return 0;

  logger.info(`[QDII] 开始更新 ${qdiiFunds.length} 只QDII基金数据...`);
  let updatedCount = 0;

  for (let i = 0; i < qdiiFunds.length; i += 3) {
    const batch = qdiiFunds.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(fund => fetchSingleQDIIData(fund.code))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        const fund = batch[j];
        const data = result.value;

        if (data.nav) {
          try {
            await fundService.updateFundNav(fund.code, {
              nav: data.nav, totalNav: data.nav, navDate: data.navDate,
              return1m: data.return1m, return3m: data.return3m,
              return6m: data.return6m, return1y: data.return1y,
            });
          } catch (e) {
            logger.warn(`[QDII] 写入 fund_nav 失败 ${fund.code}:`, e.message);
          }
        }

        try {
          const pool = getPool();
          await pool.query(
            'UPDATE funds SET buy_suggestion = $1, daily_limit = $2, updated_at = NOW() WHERE code = $3',
            [data.buySuggestion, data.dailyLimit, fund.code]
          );
        } catch (e) { logger.warn('[data-fetcher] 数据解析跳过:', e.message); }

        if (data.nav) {
          fund.nav = data.nav;
          fund.navDate = data.navDate;
          if (data.return1m != null) fund.return1m = data.return1m;
          if (data.return3m != null) fund.return3m = data.return3m;
          if (data.return6m != null) fund.return6m = data.return6m;
          if (data.return1y != null) fund.return1y = data.return1y;
        }
        fund.buySuggestion = data.buySuggestion;
        fund.dailyLimit = data.dailyLimit;

        updatedCount++;
      }
    }

    if (i + 3 < qdiiFunds.length) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  logger.info(`[QDII] 更新完成 ${updatedCount}/${qdiiFunds.length} 只基金`);
  return updatedCount;
}

// 获取单只沪深300基金的申购费和超额收益
async function fetchSingleHS300FundDetail(fund, benchmarkReturn1y, navData) {
  let purchaseFee = 0;
  let purchaseFeeOriginal = 0;
  let alpha = 0;

  try {
    const infoRes = await axios.get(
      'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
      { params: { FCODE: fund.code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' }, timeout: 8000 }
    );
    const infoData = infoRes.data?.Datas;
    if (infoData) {
      const ssgl = parseFloat(infoData.SSGL);
      if (!isNaN(ssgl)) {
        purchaseFee = ssgl;
        purchaseFeeOriginal = ssgl;
      }
    }
  } catch (e) {
    purchaseFee = fund.managementFee <= 0.2 ? 0.12 : 0.15;
    purchaseFeeOriginal = fund.managementFee <= 0.2 ? 1.20 : 1.50;
  }

  const return1y = navData ? navData.return1y : fund.return1y;
  const isEnhanced = fund.type === '指数增强';
  if (isEnhanced && return1y && benchmarkReturn1y) {
    alpha = parseFloat((return1y - benchmarkReturn1y).toFixed(2));
  }

  if (fund.type === 'ETF联接') {
    purchaseFee = fund.managementFee <= 0.2 ? 0.12 : 0.15;
    purchaseFeeOriginal = fund.managementFee <= 0.2 ? 1.20 : 1.50;
  } else if (fund.type === 'ETF') {
    purchaseFee = 0;
    purchaseFeeOriginal = 0;
  }

  return {
    code: fund.code, name: fund.name, type: fund.type, isEnhanced,
    purchaseFee, purchaseFeeOriginal, alpha,
    managementFee: fund.managementFee, custodyFee: fund.custodyFee,
    totalFee: fund.totalFee, scale: fund.scale, rating: fund.rating,
  };
}

// 沪深300基金详情抓取
async function fetchHS300FundDetails(allFunds) {
  const hs300Funds = allFunds.filter(f => f.industry === '沪深300');
  if (hs300Funds.length === 0) return 0;

  logger.info(`[HS300] 开始更新 ${hs300Funds.length} 只沪深300基金详情...`);
  let updatedCount = 0;

  // getAllFundsWithNav 返回 { data: [...] } 包装对象（带分页信息），必须先解包。
  // 2026-11-16 之前这里直接对返回值调 .filter()，导致每日任务 9:30 必炸，
  // HS300 详情从 6 月起从未更新过。
  const allFundsWithNavResult = await fundService.getAllFundsWithNav();
  const allFundsWithNav = allFundsWithNavResult.data || allFundsWithNavResult || [];
  const hs300NavMap = {};
  allFundsWithNav.filter(f => f.industry === '沪深300').forEach(f => {
    hs300NavMap[f.code] = f;
  });

  const nonEnhancedFunds = hs300Funds.filter(f => f.type !== '指数增强');
  let benchmarkReturn1y = 0;
  if (nonEnhancedFunds.length > 0) {
    const returns = nonEnhancedFunds.map(f => {
      const navData = hs300NavMap[f.code];
      return navData ? navData.return1y : null;
    }).filter(r => r != null && r !== 0);
    if (returns.length > 0) {
      benchmarkReturn1y = returns.reduce((a, b) => a + b, 0) / returns.length;
    }
  }
  logger.info(`[HS300] 基准收益率(非增强型平均): ${benchmarkReturn1y.toFixed(2)}%`);

  for (let i = 0; i < hs300Funds.length; i += 5) {
    const batch = hs300Funds.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(fund => fetchSingleHS300FundDetail(fund, benchmarkReturn1y, hs300NavMap[fund.code]))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        try {
          await fundService.updateHS300FundDetail(batch[j].code, result.value);
          updatedCount++;
        } catch (e) {
          logger.warn(`[HS300] 写入详情失败 ${batch[j].code}:`, e.message);
        }
      }
    }

    if (i + 5 < hs300Funds.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  logger.info(`[HS300] 更新完成: ${updatedCount}/${hs300Funds.length} 只基金`);
  return updatedCount;
}

// 获取北向资金和主力资金数据（带重试）
let cachedCapitalFlow = { northbound: null, mainFlow: null, lastUpdate: null };

async function fetchCapitalFlow() {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const northRes = await axios.get(
        'https://datacenter-web.eastmoney.com/api/data/v1/get',
        {
          params: {
            reportName: 'RPT_MUTUAL_DEAL_HISTORY',
            columns: 'ALL', pageSize: 30,
            sortColumns: 'TRADE_DATE', sortTypes: -1,
          },
          headers: { Referer: 'https://data.eastmoney.com/' },
          timeout: 10000,
        }
      );

      let northbound = { total: 0, sh: 0, sz: 0, trend: [] };
      const northData = northRes.data?.result?.data;
      if (northData && northData.length > 0) {
        const byDate = {};
        northData.forEach(item => {
          const date = item.TRADE_DATE?.slice(0, 10);
          if (!byDate[date]) byDate[date] = {};
          if (item.MUTUAL_TYPE === '002') byDate[date].sh = item.NET_DEAL_AMT;
          if (item.MUTUAL_TYPE === '006') byDate[date].sz = item.NET_DEAL_AMT;
          if (item.MUTUAL_TYPE === '004') byDate[date].total = item.NET_DEAL_AMT;
        });

        const dates = Object.keys(byDate).sort();
        const latestDate = dates[dates.length - 1];
        if (latestDate && byDate[latestDate]) {
          const latest = byDate[latestDate];
          northbound.sh = latest.sh != null ? (latest.sh / 10000).toFixed(2) : '0';
          northbound.sz = latest.sz != null ? (latest.sz / 10000).toFixed(2) : '0';
          northbound.total = latest.total != null ? (latest.total / 10000).toFixed(2) :
            (parseFloat(northbound.sh) + parseFloat(northbound.sz)).toFixed(2);
        }

        const recentDates = dates.slice(-5);
        northbound.trend = recentDates.map(date => ({
          time: date.slice(5),
          sh: byDate[date].sh != null ? parseFloat((byDate[date].sh / 10000).toFixed(2)) : 0,
          sz: byDate[date].sz != null ? parseFloat((byDate[date].sz / 10000).toFixed(2)) : 0,
          total: byDate[date].total != null ? parseFloat((byDate[date].total / 10000).toFixed(2)) : 0,
        }));
      }

      let mainFlow = [];
      try {
        const mainRes = await axios.get(
          'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&fltt=2&invt=2&fid=f62&fs=m:90+t:2&fields=f12,f14,f62,f184',
          { timeout: 5000, headers: { Referer: 'https://data.eastmoney.com/' } }
        );
        if (mainRes.data?.data?.diff) {
          mainFlow = mainRes.data.data.diff.slice(0, 10).map(item => ({
            name: item.f14,
            mainNetInflow: (item.f62 / 100000000).toFixed(2),
            mainNetRatio: item.f184,
          }));
        }
      } catch {
        const sectors = await fundService.getSectorData().catch(() => []);
        mainFlow = sectors.slice(0, 10).map(s => ({
          name: s.name,
          mainNetInflow: (s.change * 2.5).toFixed(2),
          mainNetRatio: s.change.toFixed(2),
        }));
      }

      cachedCapitalFlow = { northbound, mainFlow, lastUpdate: new Date().toISOString() };
      logger.info(`[资金] 更新北向资金: ${northbound.total}亿, 主力资金: ${mainFlow.length}个行业`);
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        logger.warn(`[资金] 第${attempt + 1}次获取失败，重试中...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        logger.warn('[资金] 获取资金流向数据失败:', error.message);
      }
    }
  }
}

function getCachedCapitalFlow() {
  return cachedCapitalFlow;
}

// 批量更新所有基金数据
async function updateAllFundData(allFunds, dataUpdateStatus, isTradingDay, getNextUpdateTime, updateAllFundReturns) {
  if (dataUpdateStatus.isUpdating) {
    logger.info('数据更新正在进行中，跳过本次更新');
    return;
  }

  dataUpdateStatus.isUpdating = true;
  dataUpdateStatus.error = null;
  logger.info(`[${new Date().toLocaleString()}] 开始更新基金数据...`);

  try {
    let updatedCount = 0;

    const codes = allFunds.map(f => f.code);
    for (let i = 0; i < codes.length; i += 50) {
      const batch = codes.slice(i, i + 50);
      const navMap = await fetchFundNavBatch(batch);

      for (const code of batch) {
        const navData = navMap.get(code);
        if (navData) {
          try {
            await fundService.updateFundNav(code, navData);
            updatedCount++;
          } catch (e) {
            logger.warn(`保存基金 ${code} 净值失败:`, e.message);
          }
        }
      }

      if (i + 50 < codes.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    await Promise.all([
      fetchMarketIndices(),
      fetchSectorData(),
      fetchIndexValuation(),
    ]);

    const today = new Date().toISOString().split('T')[0];
    if (dataUpdateStatus.lastReturnUpdateDate !== today && isTradingDay()) {
      logger.info('[收益率] 开始更新基金收益率...');
      await updateAllFundReturns();
      dataUpdateStatus.lastReturnUpdateDate = today;
    }

    dataUpdateStatus.lastUpdateTime = new Date().toISOString();
    dataUpdateStatus.updateCount++;
    dataUpdateStatus.nextUpdateTime = getNextUpdateTime().toISOString();
    logger.info(`[${new Date().toLocaleString()}] 基金数据更新完成，更新了 ${updatedCount} 只基金`);

  } catch (error) {
    logger.error('数据更新失败:', error.message);
    dataUpdateStatus.error = error.message;
  } finally {
    dataUpdateStatus.isUpdating = false;
  }
}

// 批量更新所有基金的收益率（带重试）
async function updateAllFundReturns(allFunds) {
  if (!allFunds || allFunds.length === 0) {
    logger.info('[收益率] 无基金数据，跳过');
    return 0;
  }

  let updatedCount = 0;
  let failedCount = 0;
  const total = allFunds.length;

  logger.info(`[收益率] 开始更新 ${total} 只基金收益率...`);

  for (let i = 0; i < total; i += 10) {
    const batch = allFunds.slice(i, i + 10);
    // 并发获取收益率和近1周收益率
    const [results, weekResults] = await Promise.all([
      Promise.all(batch.map(f => fetchFundReturns(f.code))),
      Promise.all(batch.map(f => fetchReturn1w(f.code))),
    ]);

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result && result.return1y != null) {
        if (weekResults[j] != null) result.return1w = weekResults[j];
        try {
          await fundService.updateFundReturns(batch[j].code, result);
          updatedCount++;
        } catch (e) {
          logger.warn(`[收益率] 保存 ${batch[j].code} 失败:`, e.message);
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    // 进度日志（每50只输出一次）
    if ((i + 10) % 50 === 0 || i + 10 >= total) {
      logger.info(`[收益率] 进度: ${Math.min(i + 10, total)}/${total} (成功${updatedCount}, 失败${failedCount})`);
    }

    if (i + 10 < total) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  logger.info(`[收益率] 更新完成: 成功 ${updatedCount}, 失败 ${failedCount}, 共 ${total} 只`);
  return updatedCount;
}

// 每日数据更新任务（交易日收盘后执行，约17:30北京时间 / 09:30 UTC）
async function runDailyDataUpdate(allFunds) {
  logger.info('========== [每日任务] 开始执行 ==========');
  const startTime = Date.now();

  try {
    // 1. 从支付宝/东方财富API全量更新基金数据（净值 + 近1月/3月/6月/1年收益率 + 规模）
    //    这是最核心的更新，覆盖所有curated基金
    await fetchAllCuratedFundsData(allFunds);

    // 2. 更新QDII基金申购状态+限额 → 冗余校验，fetchAllCuratedFundsData 已包含
    await fetchQDIIData(allFunds);

    // 3. 更新沪深300基金详情（超额收益、申购费对比）
    await fetchHS300FundDetails(allFunds);

    // 4. 更新持仓盈亏（含数值校验）
    const pnlResult = await updatePortfolioPnl(allFunds);
    if (pnlResult.warnings.length > 0) {
      logger.warn(`[每日任务] 持仓校验发现 ${pnlResult.warnings.length} 条警告`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`========== [每日任务] 执行完成，耗时 ${elapsed}s ==========`);
  } catch (error) {
    logger.error('[每日任务] 执行失败:', error.message);
  }
}

// 校验持仓数值是否正确
function validatePortfolioValues(record, currentNav, shares, costPrice, buyFee) {
  const errors = [];
  const totalCost = shares * costPrice + buyFee;
  const marketValue = shares * currentNav;
  const pnl = marketValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  // 基础数值校验
  if (currentNav <= 0) errors.push(`净值异常: ${currentNav}`);
  if (shares <= 0) errors.push(`份额异常: ${shares}`);
  if (costPrice <= 0) errors.push(`成本价异常: ${costPrice}`);
  if (marketValue < 0) errors.push(`市值为负: ${marketValue}`);

  // 逻辑校验: 市值 = 份额 × 净值
  const expectedMV = parseFloat((shares * currentNav).toFixed(2));
  if (Math.abs(marketValue - expectedMV) > 0.01) {
    errors.push(`市值计算不一致: 期望${expectedMV}, 实际${marketValue}`);
  }

  // 逻辑校验: 盈亏 = 市值 - 总成本
  const expectedPnl = parseFloat((expectedMV - totalCost).toFixed(2));
  const actualPnl = parseFloat(pnl.toFixed(2));
  if (Math.abs(actualPnl - expectedPnl) > 0.01) {
    errors.push(`盈亏计算不一致: 期望${expectedPnl}, 实际${actualPnl}`);
  }

  // 逻辑校验: 收益率 = 盈亏 / 总成本 × 100
  if (totalCost > 0) {
    const expectedPct = parseFloat(((expectedPnl / totalCost) * 100).toFixed(2));
    const actualPct = parseFloat(pnlPercent.toFixed(2));
    if (Math.abs(actualPct - expectedPct) > 0.01) {
      errors.push(`收益率计算不一致: 期望${expectedPct}%, 实际${actualPct}%`);
    }
  }

  // 收益率合理性校验: 单日涨跌幅一般不超过20%（含杠杆基金放宽到30%）
  if (Math.abs(pnlPercent) > 300) {
    errors.push(`收益率异常偏高: ${pnlPercent}%，请检查份额或成本价是否正确`);
  }

  return {
    valid: errors.length === 0,
    errors,
    values: {
      totalCost: parseFloat(totalCost.toFixed(2)),
      marketValue: parseFloat(expectedMV.toFixed(2)),
      pnl: parseFloat(expectedPnl.toFixed(2)),
      pnlPercent: parseFloat(((totalCost > 0 ? expectedPnl / totalCost : 0) * 100).toFixed(2)),
    },
  };
}

// 更新所有用户的持仓盈亏数据
async function updatePortfolioPnl(allFunds) {
  const pool = getPool();
  try {
    const recordsResult = await pool.query('SELECT id, fund_code, fund_name, shares, cost_price, buy_fee FROM fund_records');
    if (recordsResult.rows.length === 0) {
      logger.info('[持仓] 没有持仓记录，跳过更新');
      return { updated: 0, validated: 0, warnings: [] };
    }

    // 持仓中涉及的所有基金代码（去重）
    const heldCodes = [...new Set(recordsResult.rows.map(r => r.fund_code))];
    logger.info(`[持仓] 需要更新 ${heldCodes.length} 只基金的 ${recordsResult.rows.length} 条持仓记录`);

    // 第1优先级: 从 fund_nav 表获取最新净值
    const navResult = await pool.query(
      `SELECT DISTINCT ON (fund_code) fund_code, nav, nav_date FROM fund_nav
       WHERE fund_code = ANY($1) ORDER BY fund_code, nav_date DESC`,
      [heldCodes]
    );
    const navMap = new Map();
    const navDateMap = new Map();
    navResult.rows.forEach(row => {
      navMap.set(row.fund_code, parseFloat(row.nav));
      navDateMap.set(row.fund_code, row.nav_date);
    });
    logger.info(`[持仓] fund_nav 表命中 ${navMap.size}/${heldCodes.length} 只基金`);

    // 第2优先级: 从种子数据补充
    allFunds.forEach(f => {
      if (f.nav && !navMap.has(f.code)) navMap.set(f.code, f.nav);
    });

    // 第3优先级: 从API实时获取缺失的净值，并写回 fund_nav 表持久化
    const missingCodes = heldCodes.filter(code => !navMap.has(code));
    if (missingCodes.length > 0) {
      logger.info(`[持仓] 从API获取 ${missingCodes.length} 只基金净值: ${missingCodes.join(',')}`);
      try {
        const batchNav = await fetchFundNavBatch(missingCodes);
        const navInsertCodes = [];
        const navInsertNavs = [];
        const navInsertTotalNavs = [];
        const navInsertDates = [];
        for (const [code, val] of batchNav) {
          if (val.nav > 0) {
            navMap.set(code, val.nav);
            navInsertCodes.push(code);
            navInsertNavs.push(val.nav);
            navInsertTotalNavs.push(val.totalNav || val.nav);
            navInsertDates.push(val.navDate || new Date().toISOString().split('T')[0]);
          }
        }
        if (navInsertCodes.length > 0) {
          try {
            await pool.query(
              `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date)
               SELECT * FROM unnest($1::text[], $2::numeric[], $3::numeric[], $4::date[])
               ON CONFLICT (fund_code, nav_date) DO UPDATE SET nav = EXCLUDED.nav`,
              [navInsertCodes, navInsertNavs, navInsertTotalNavs, navInsertDates]
            );
          } catch (e) {
            // 忽略写入失败，净值仍在内存中可用
          }
        }
        logger.info(`[持仓] API获取成功 ${batchNav.size} 只，最终覆盖 ${navMap.size}/${heldCodes.length} 只基金`);
      } catch (e) {
        logger.warn(`[持仓] API批量获取失败: ${e.message}`);
      }
    }

    // 批量更新持仓记录
    let updated = 0;
    let validated = 0;
    const warnings = [];
    const updateIds = [];
    const updateNavs = [];
    const updateMVs = [];
    const updatePnls = [];
    const updatePpcts = [];

    for (const record of recordsResult.rows) {
      const currentNav = navMap.get(record.fund_code);
      if (!currentNav || currentNav <= 0) {
        warnings.push(`${record.fund_code}(${record.fund_name}): 无法获取净值`);
        continue;
      }

      const shares = parseFloat(record.shares);
      const costPrice = parseFloat(record.cost_price);
      const buyFee = parseFloat(record.buy_fee || 0);

      // 校验数值
      const validation = validatePortfolioValues(record, currentNav, shares, costPrice, buyFee);
      validated++;

      if (!validation.valid) {
        warnings.push(`${record.fund_code}(${record.fund_name}): ${validation.errors.join('; ')}`);
      }

      // 使用校验后的值收集批量更新
      const { marketValue, pnl, pnlPercent } = validation.values;
      updateIds.push(record.id);
      updateNavs.push(currentNav);
      updateMVs.push(marketValue);
      updatePnls.push(pnl);
      updatePpcts.push(pnlPercent);
    }

    // 单条 SQL 批量 UPDATE
    if (updateIds.length > 0) {
      const result = await pool.query(
        `UPDATE fund_records SET
           current_nav = v.nav,
           market_value = v.mv,
           pnl = v.pnl,
           pnl_percent = v.pp,
           nav_updated_at = NOW()
         FROM unnest($1::int[], $2::numeric[], $3::numeric[], $4::numeric[], $5::numeric[]) AS v(id, nav, mv, pnl, pp)
         WHERE fund_records.id = v.id`,
        [updateIds, updateNavs, updateMVs, updatePnls, updatePpcts]
      );
      updated = result.rowCount;
    }

    if (warnings.length > 0) {
      logger.warn(`[持仓] 校验警告 (${warnings.length}):`);
      warnings.forEach(w => logger.warn(`  - ${w}`));
    }

    logger.info(`[持仓] 更新完成: ${updated}/${recordsResult.rows.length} 条记录, 校验 ${validated} 条, ${warnings.length} 条警告`);
    return { updated, validated, warnings };
  } catch (error) {
    logger.warn('[持仓] 更新失败:', error.message);
    return { updated: 0, validated: 0, warnings: [error.message] };
  }
}

// 从支付宝/东方财富API获取易方达基金的基金经理、最新净值和收益率，并写入数据库
async function fetchYiFangDaFundData() {
  const pool = getPool();
  try {
    // 1. 获取数据库中所有易方达基金
    const fundResult = await pool.query(
      "SELECT code, name, manager FROM funds WHERE name LIKE '%易方达%'"
    );
    const funds = fundResult.rows;
    if (funds.length === 0) {
      logger.info('[易方达] 数据库中无易方达基金');
      return { fetched: 0, updated: 0 };
    }
    logger.info(`[易方达] 开始更新 ${funds.length} 只易方达基金数据...`);

    let navUpdated = 0;
    let detailUpdated = 0;
    const errors = [];

    // 2. 逐只获取数据（API有限频，控制并发）
    for (let i = 0; i < funds.length; i += 3) {
      const batch = funds.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(fund => fetchSingleFundFromAlipay(fund.code))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const fund = batch[j];
        if (result.status !== 'fulfilled' || !result.value) {
          errors.push(`${fund.code}(${fund.name}): API请求失败`);
          continue;
        }

        const data = result.value;

        // 写入基金经理、规模到 funds 表
        if (data.manager || data.scale) {
          try {
            await fundService.updateFundDetail(fund.code, {
              manager: data.manager,
              scale: data.scale,
              buySuggestion: data.buySuggestion,
              dailyLimit: data.dailyLimit,
            });
            detailUpdated++;
          } catch (e) {
            errors.push(`${fund.code}: 写入详情失败 ${e.message}`);
          }
        }

        // 写入净值到 fund_nav 表
        if (data.nav > 0 && data.navDate) {
          try {
            await fundService.updateFundNav(fund.code, {
              nav: data.nav,
              totalNav: data.totalNav || data.nav,
              navDate: data.navDate,
              return1w: data.return1w,
              return1m: data.return1m,
              return3m: data.return3m,
              return6m: data.return6m,
              return1y: data.return1y,
            });
            navUpdated++;
          } catch (e) {
            errors.push(`${fund.code}: 写入净值失败 ${e.message}`);
          }
        }
      }

      // 批次间延迟，避免API限频
      if (i + 3 < funds.length) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    if (errors.length > 0) {
      logger.warn(`[易方达] 错误 (${errors.length}):`);
      errors.forEach(e => logger.warn(`  - ${e}`));
    }

    logger.info(`[易方达] 更新完成: 净值 ${navUpdated}/${funds.length}, 详情 ${detailUpdated}/${funds.length}`);
    return { fetched: funds.length, navUpdated, detailUpdated, errors };
  } catch (error) {
    logger.error('[易方达] 更新失败:', error.message);
    return { fetched: 0, navUpdated: 0, detailUpdated: 0, errors: [error.message] };
  }
}

// 从支付宝/东方财富API获取单只基金的完整数据
async function fetchSingleFundFromAlipay(code) {
  let name = null;
  let type = null;
  let manager = null;
  let scale = null, buySuggestion = '开放申购', dailyLimit = 0;
  let nav = null, totalNav = null, navDate = null;
  let return1w = null, return1m = null, return3m = null, return6m = null, return1y = null;

  // A. 从支付宝基金基本信息API获取基金经理、规模、申购状态
  try {
    const infoRes = await axios.get(
      'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
      { params: { FCODE: code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' }, timeout: 8000 }
    );
    const info = infoRes.data?.Datas;
    if (info) {
      name = info.SHORTNAME || null;
      type = info.FTYPE || null;
      manager = info.JJJL || null;  // 基金经理（如 "余海燕,庞亚平"）
      // ENDNAV 是基金规模（元），转换为亿
      scale = info.ENDNAV ? parseFloat((parseFloat(info.ENDNAV) / 1e8).toFixed(2)) : null;

      const sgzt = info.SGZT || '';
      const maxsg = parseInt(info.MAXSG);
      if (sgzt.includes('暂停')) {
        buySuggestion = '暂停申购';
      } else if (sgzt.includes('限') || sgzt.includes('大额')) {
        buySuggestion = '限大额';
        dailyLimit = isNaN(maxsg) ? 10 : maxsg;
      }
    }
  } catch (e) {
    // 静默失败，继续尝试其他API
  }

  // B. 从东方财富历史净值API获取最新净值和收益率
  try {
    const lsjzRes = await axios.get(
      'https://api.fund.eastmoney.com/f10/lsjz',
      { params: { fundCode: code, pageIndex: 1, pageSize: 20 }, timeout: 8000, headers: { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const list = lsjzRes.data?.Data?.LSJZList;
    if (list && list.length > 0) {
      nav = parseFloat(list[0].DWJZ);
      totalNav = parseFloat(list[0].LJJZ) || nav;
      navDate = list[0].FSRQ;

      const findNav = (days) => {
        const target = new Date(navDate);
        target.setDate(target.getDate() - days);
        const ts = target.toISOString().split('T')[0];
        for (const item of list) {
          if (item.FSRQ <= ts) return parseFloat(item.DWJZ);
        }
        return null;
      };
      const calcReturn = (n) => n ? parseFloat(((nav - n) / n * 100).toFixed(2)) : null;

      return1w = calcReturn(findNav(7));
      return1m = calcReturn(findNav(30));
      return3m = calcReturn(findNav(90));
      return6m = calcReturn(findNav(180));
      return1y = calcReturn(findNav(365));
    }
  } catch (e) {
    // 静默失败
  }

  // C. 从东方财富基金概况API补充基金经理（如果A步骤未获取到）
  if (!manager) {
    try {
      const detailRes = await axios.get(
        `https://fund.eastmoney.com/pingzhongdata/${code}.js`,
        { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://fund.eastmoney.com/', Range: 'bytes=0-8000' } }
      );
      const text = detailRes.data || '';
      const mgrMatch = text.match(/Data_currentFundManager\s*=\s*\[([^\]]+)\]/);
      if (mgrMatch) {
        const names = [];
        const nameRegex = /"name"\s*:\s*"([^"]+)"/g;
        let m;
        while ((m = nameRegex.exec(mgrMatch[1])) !== null) names.push(m[1]);
        if (names.length > 0) manager = names.join(',');
      }
    } catch (e) { logger.warn('[data-fetcher] 数据解析跳过:', e.message); }
  }

  if (!nav) return null;

  return {
    name, type, manager, scale, buySuggestion, dailyLimit,
    nav, totalNav, navDate,
    return1w, return1m, return3m, return6m, return1y,
  };
}

// 支付宝金选基金代码列表 - 来自蚂蚁财富精选基金池
// 注意：蚂蚁财富金选名单会定期调整，此列表需定期维护
const GOLD_FUND_CODES = [
  // ===== 宽基指数 =====
  // 沪深300
  '110020', '310318', '519671', '002910', '007531', '010253',
  '005658', '001051', '006021', '010352',
  // 中证500
  '161017', '000478', '007028', '005919', '001556',
  // 创业板指
  '159915', '001593', '005668', '010657', '002656', '001592',
  // 科创50
  '588000', '588080', '011613', '588050', '011609',
  // 上证50
  '110003', '001549', '007136', '502048',
  // 中证1000
  '560010', '006165', '014987', '560110',
  // 中证A500
  '022430', '022455', '022386', '022448',

  // ===== 行业/主题 =====
  // 医药
  '001180', '012634', '000059', '161726', '006002', '000831',
  // 半导体/芯片
  '008887', '012414', '007300', '012557', '008281', '001630',
  // 人工智能/AI
  '011612', '014673', '013048',
  // 通信/5G
  '008086', '007490',
  // 新能源
  '012831', '007380', '002190', '005940', '001156',
  // 消费
  '000248', '001044', '005620', '260108',
  // 证券/券商
  '512880', '006098', '161027', '007944',
  // 军工
  '005693', '004854', '006113', '164402', '000535',
  // 金融/银行
  '001550', '001594', '000251',
  // 煤炭
  '008279', '161724', '161032',
  // 电力/公用事业
  '017032', '016907', '012834', '005063',
  // 家电
  '005968', '008169',
  // 白酒
  '003095', '161725', '160632',
  // 有色金属/黄金
  '159880', '007874', '012520', '000307',
  // 光伏
  '011102', '011103',
  // 汽车
  '002168', '168102',
  // 机器人
  '562500',
  // ===== QDII =====
  // 纳斯达克100
  '040046', '270042', '160213', '015299', '016530', '013403',
  // 标普500
  '007721', '050025', '006075', '019547', '006924',
  // 恒生科技/港股
  '012348', '013402', '012349', '006786',
  // 港股通
  '002653', '000071', '001691', '001878',
  // 全球科技/消费
  '270023', '118001', '005644',

  // ===== 策略 =====
  // 中证红利
  '090010', '100032', '005561', '519089',
  // 红利低波
  '007466', '008115', '005776',

  // ===== 固收/债券 =====
  '000171', '000172', '002611', '003327', '000205',
  '110027', '050027', '519137', '003376',

  // ===== 酒店旅游（含航空产业链） =====
  '159766', '562510', '159257', '159392', '159208', '159227', '024766', '024767',

  // ===== 混合/明星基金经理 =====
  '000001', '519674', '163406', '005827', '161005', '001875',
  '163402', '481001', '510500', '001632',
  // 知名金选主动/消费/宽基
  '110011', '005911', '000083', '110022', '000961', '050002',
  '001000', '162605', '163412', '340006', '000746', '001102',
  '090004', '110008', '004243',
];

// 金选基金分类函数
function classifyGoldCategory(name, indexName, fundType) {
  const n = (name || '').toLowerCase();
  const idx = (indexName || '').toLowerCase();

  if (n.includes('纳斯达克') || n.includes('nasdaq')) return 'QDII-美股';
  if (n.includes('标普') || n.includes('s&p')) return 'QDII-美股';
  if (n.includes('恒生')) return 'QDII-港股';
  if (n.includes('沪深300')) return '宽基-沪深300';
  if (n.includes('中证500')) return '宽基-中证500';
  if (n.includes('创业板')) return '宽基-创业板';
  if (n.includes('科创50')) return '宽基-科创50';
  if (n.includes('上证50')) return '宽基-上证50';
  if (n.includes('中证1000')) return '宽基-中证1000';
  if (n.includes('中证A500') || n.includes('a500')) return '宽基-A500';
  if (n.includes('医药') || n.includes('医疗') || n.includes('健康')) return '行业-医药';
  if (n.includes('半导体') || n.includes('芯片')) return '行业-半导体';
  if (n.includes('人工智能') || n.includes('ai')) return '行业-AI';
  if (n.includes('新能源')) return '行业-新能源';
  if (n.includes('消费')) return '行业-消费';
  if (n.includes('证券') || n.includes('券商')) return '行业-证券';
  if (n.includes('军工') || n.includes('国防')) return '行业-军工';
  if (n.includes('金融') || n.includes('银行')) return '行业-金融';
  if (n.includes('煤炭')) return '行业-煤炭';
  if (n.includes('电力')) return '行业-电力';
  if (n.includes('家电')) return '行业-家电';
  if (n.includes('白酒')) return '行业-白酒';
  if (n.includes('红利')) return '策略-红利';
  if (n.includes('低波')) return '策略-低波';
  if (n.includes('光伏')) return '行业-光伏';
  if (n.includes('机器人')) return '行业-机器人';
  if (n.includes('汽车') || n.includes('新能源车')) return '行业-汽车';
  if (n.includes('通信') || n.includes('5g') || n.includes('5G')) return '行业-通信';
  if (n.includes('旅游') || n.includes('酒店') || n.includes('航空产业')) return '行业-酒店旅游';
  if (n.includes('债券') || n.includes('固收') || n.includes('纯债') || n.includes('信用债')) return '固收-债券';
  if (n.includes('港股通') || n.includes('港股')) return 'QDII-港股';
  if (n.includes('全球')) return 'QDII-全球';
  if (n.includes('油气') || n.includes('原油')) return 'QDII-商品';
  if (n.includes('黄金')) return '行业-黄金';
  if (fundType === 'ETF联接' || fundType === 'ETF') return '指数-其他';
  if (fundType?.includes('混合')) return '混合-主动';
  return '混合-主动';
}

// 根据金选分类推断行业
function inferIndustry(name, goldCategory) {
  if (goldCategory.startsWith('QDII')) {
    if (name.includes('纳斯达克')) return '纳斯达克100';
    if (name.includes('标普')) return '标普500';
    if (name.includes('恒生')) return '恒生指数';
  }
  if (goldCategory.includes('沪深300')) return '沪深300';
  if (goldCategory.includes('中证500')) return '中证500';
  if (goldCategory.includes('中证1000')) return '中证1000';
  if (goldCategory.includes('上证50')) return '上证50';
  if (goldCategory.includes('A500')) return '中证A500';
  if (goldCategory.includes('创业板')) return '创业板';
  if (goldCategory.includes('科创')) return '科创50';
  if (goldCategory.includes('医药')) return '医药';
  if (goldCategory.includes('半导体')) return '半导体/芯片';
  if (goldCategory.includes('AI')) return '人工智能';
  if (goldCategory.includes('新能源')) return '新能源';
  if (goldCategory.includes('消费')) return '消费';
  if (goldCategory.includes('证券')) return '证券';
  if (goldCategory.includes('军工')) return '军工';
  if (goldCategory.includes('金融')) return '金融';
  if (goldCategory.includes('煤炭')) return '煤炭';
  if (goldCategory.includes('电力')) return '电力';
  if (goldCategory.includes('家电')) return '家电';
  if (goldCategory.includes('白酒')) return '消费';
  if (goldCategory.includes('红利')) return '红利';
  if (goldCategory.includes('低波')) return '红利';
  if (goldCategory.includes('光伏')) return '新能源';
  if (goldCategory.includes('机器人')) return '人工智能';
  if (goldCategory.includes('汽车')) return '汽车';
  if (goldCategory.includes('通信')) return '通信';
  if (goldCategory.includes('酒店旅游')) return '酒店旅游';
  if (goldCategory.includes('债券')) return '债券';
  if (goldCategory.includes('全球')) return 'QDII';
  if (goldCategory.includes('港股')) return '港股';
  if (goldCategory.includes('黄金')) return '黄金';
  if (goldCategory.includes('主动')) return '混合';
  return '其他';
}

// 估算基金评级
function estimateRating(totalFee, return1y, scale) {
  let score = 3;
  if (totalFee <= 0.6) score += 0.5;
  else if (totalFee > 1.0) score -= 0.5;
  if (return1y != null && return1y > 20) score += 1;
  else if (return1y != null && return1y > 10) score += 0.5;
  else if (return1y != null && return1y < -10) score -= 0.5;
  if (scale > 10) score += 0.5;
  else if (scale < 1) score -= 0.5;
  return Math.max(1, Math.min(5, Math.round(score)));
}

// 抓取金选基金完整数据并写入数据库
async function fetchGoldFundData() {
  const pool = getPool();
  logger.info(`[金选基金] 开始抓取 ${GOLD_FUND_CODES.length} 只金选基金...`);

  // 重置所有金选标记
  try {
    await pool.query("UPDATE funds SET is_gold_selected = false WHERE is_gold_selected = true");
  } catch (e) {
    logger.warn('[金选基金] 重置金选标记失败:', e.message);
  }

  let successCount = 0;
  let newCount = 0;
  let navCount = 0;
  const errors = [];
  const results = [];

  for (let i = 0; i < GOLD_FUND_CODES.length; i += 3) {
    const batch = GOLD_FUND_CODES.slice(i, i + 3);
    const batchResults = await Promise.allSettled(
      batch.map(code => fetchSingleFundFromAlipay(code))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const code = batch[j];
      const result = batchResults[j];

      if (result.status !== 'fulfilled' || !result.value) {
        errors.push(`${code}: API请求失败`);
        continue;
      }

      const data = result.value;
      const goldCategory = classifyGoldCategory(data.name || '', data.indexName || '', data.type || '');
      const industry = inferIndustry(data.name || '', goldCategory);

      // 专业分析：估值判断、趋势分析、投资逻辑、买入建议、综合评级
      const analysis = analyzeGoldFund(
        { code, name: data.name, type: data.type, industry, indexName: data.indexName || '', totalFee: data.totalFee || 0, scale: data.scale || 0, buySuggestion: data.buySuggestion || '', dailyLimit: data.dailyLimit || 0 },
        { return1w: data.return1w, return1m: data.return1m, return3m: data.return3m, return6m: data.return6m, return1y: data.return1y },
      );

      try {
        // 写入基金基本信息（含专业分析字段）
        await pool.query(`
          INSERT INTO funds (
            code, name, type, industry, index_name,
            management_fee, custody_fee, service_fee, total_fee,
            scale, rating, buy_suggestion, valuation, trend, logic,
            daily_limit, manager,
            is_gold_selected, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true, NOW())
          ON CONFLICT (code) DO UPDATE SET
            name = COALESCE(NULLIF($2, ''), funds.name),
            type = COALESCE(NULLIF($3, ''), funds.type),
            industry = CASE
              WHEN funds.industry IS NULL OR funds.industry = '' OR funds.industry = '其他'
              THEN COALESCE(NULLIF($4, ''), funds.industry)
              ELSE funds.industry
            END,
            index_name = COALESCE(NULLIF($5, ''), funds.index_name),
            management_fee = COALESCE($6, funds.management_fee),
            custody_fee = COALESCE($7, funds.custody_fee),
            service_fee = COALESCE($8, funds.service_fee),
            total_fee = COALESCE($9, funds.total_fee),
            scale = COALESCE($10, funds.scale),
            rating = COALESCE($11, funds.rating),
            buy_suggestion = COALESCE(NULLIF($12, ''), funds.buy_suggestion),
            valuation = COALESCE(NULLIF($13, ''), funds.valuation),
            trend = COALESCE(NULLIF($14, ''), funds.trend),
            logic = COALESCE(NULLIF($15, ''), funds.logic),
            daily_limit = COALESCE($16, funds.daily_limit),
            manager = COALESCE(NULLIF($17, ''), funds.manager),
            is_gold_selected = true,
            updated_at = NOW()
        `, [
          code, data.name || '', data.type || '', industry, data.indexName || '',
          data.managementFee || 0, data.custodyFee || 0, data.serviceFee || 0,
          data.totalFee || 0, data.scale || 0, analysis.rating,
          analysis.buySuggestion, analysis.valuation, analysis.trend, analysis.logic,
          data.dailyLimit || 0, data.manager || '',
        ]);

        // 写入净值数据
        if (data.nav > 0 && data.navDate) {
          await pool.query(`
            INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (fund_code, nav_date) DO UPDATE SET
              nav = EXCLUDED.nav,
              total_nav = EXCLUDED.total_nav,
              return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
              return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
              return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
              return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
              return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y),
              created_at = NOW()
          `, [
            code, data.nav, data.totalNav || data.nav, data.navDate,
            data.return1w, data.return1m, data.return3m, data.return6m, data.return1y,
          ]);
          navCount++;
        }

        successCount++;
        results.push({ code, name: data.name, goldCategory, industry, ...analysis });
      } catch (e) {
        errors.push(`${code}: 写入失败 ${e.message}`);
      }
    }

    // 批次间延迟
    if (i + 3 < GOLD_FUND_CODES.length) {
      await new Promise(r => setTimeout(r, 500));
    }

    // 进度日志
    if ((i + 3) % 30 === 0 || i + 3 >= GOLD_FUND_CODES.length) {
      logger.info(`[金选基金] 进度: ${Math.min(i + 3, GOLD_FUND_CODES.length)}/${GOLD_FUND_CODES.length} (成功${successCount})`);
    }
  }

  if (errors.length > 0) {
    logger.warn(`[金选基金] 错误 (${errors.length}):`);
    errors.slice(0, 10).forEach(e => logger.warn(`  - ${e}`));
  }

  logger.info(`[金选基金] 抓取完成: 成功 ${successCount}/${GOLD_FUND_CODES.length}, 净值 ${navCount}, 错误 ${errors.length}`);
  return { total: GOLD_FUND_CODES.length, success: successCount, navUpdated: navCount, errors, results };
}

// 尝试从支付宝/东方财富API发现更多金选基金
// 访问多个可能的金选基金列表接口，汇总去重后返回新增的基金代码
async function discoverGoldFundsFromAlipay() {
  const discovered = new Set();
  const endpoints = [
    // 东方财富热门基金排行（可能包含金选标签）
    {
      name: '热门基金排行',
      url: 'https://fundmobapi.eastmoney.com/FundMApi/FundMNRank.ashx',
      params: { deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0', pageIndex: 1, pageSize: 500 },
      parse: (data) => {
        const list = data?.Datas || [];
        return list.map(f => f.FCODE).filter(Boolean);
      },
    },
    // 支付宝首页推荐基金
    {
      name: '支付宝推荐',
      url: 'https://fundmobapi.eastmoney.com/FundMApi/FundMNHotFund.ashx',
      params: { deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' },
      parse: (data) => {
        const list = data?.Datas || [];
        return list.map(f => f.FCODE || f.code).filter(Boolean);
      },
    },
  ];

  for (const endpoint of endpoints) {
    try {
      const { data } = await axios.get(endpoint.url, { params: endpoint.params, timeout: 10000 });
      const codes = endpoint.parse(data);
      codes.forEach(c => discovered.add(c));
      logger.info(`[金选发现] ${endpoint.name}: 获取到 ${codes.length} 只基金`);
    } catch (e) {
      logger.warn(`[金选发现] ${endpoint.name} 请求失败: ${e.message}`);
    }
  }

  // 过滤：只保留不在 GOLD_FUND_CODES 中的新基金
  const known = new Set(GOLD_FUND_CODES);
  const newCodes = [...discovered].filter(c => !known.has(c));

  if (newCodes.length > 0) {
    logger.info(`[金选发现] 发现 ${newCodes.length} 只新基金代码: ${newCodes.slice(0, 20).join(',')}${newCodes.length > 20 ? '...' : ''}`);
    // 对每个新代码尝试获取基本信息验证
    const validCodes = [];
    for (let i = 0; i < Math.min(newCodes.length, 50); i += 3) {
      const batch = newCodes.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map(c => fetchSingleFundFromAlipay(c)));
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'fulfilled' && results[j].value) {
          validCodes.push(batch[j]);
        }
      }
      if (i + 3 < Math.min(newCodes.length, 50)) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    logger.info(`[金选发现] 验证通过 ${validCodes.length} 只`);
    return validCodes;
  }

  logger.info('[金选发现] 未发现新的金选基金代码');
  return [];
}

// ---- 全量基金数据更新（从支付宝/东方财富API获取所有基金的净值+收益率+规模） ----
// allFunds 可选：传入则更新指定基金列表，不传则更新数据库中全部基金
async function fetchAllCuratedFundsData(allFunds) {
  const pool = getPool();

  let codes;
  if (allFunds && allFunds.length > 0) {
    codes = [...new Set(allFunds.map(f => f.code))];
  } else {
    const { rows } = await pool.query('SELECT code FROM funds ORDER BY code');
    codes = rows.map(r => r.code);
  }
  logger.info(`[全量更新] 开始更新 ${codes.length} 只基金数据（净值/收益率/规模）...`);

  let successCount = 0;
  let navCount = 0;
  let skipCount = 0;
  const errors = [];

  const BATCH_SIZE = 5;
  const BATCH_DELAY = 400;

  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(code => fetchSingleFundFromAlipay(code))
    );

    for (let j = 0; j < results.length; j++) {
      const code = batch[j];
      const result = results[j];

      if (result.status !== 'fulfilled' || !result.value) {
        skipCount++;
        continue;
      }

      const data = result.value;

      // 估算评级
      const rating = estimateRating(data.totalFee || 0, data.return1y, data.scale || 0);

      try {
        // 写入 funds 表
        await pool.query(`
          INSERT INTO funds (code, name, type, management_fee, custody_fee, service_fee, total_fee,
            scale, rating, buy_suggestion, daily_limit, manager, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())
          ON CONFLICT (code) DO UPDATE SET
            name = COALESCE(NULLIF(EXCLUDED.name, ''), funds.name),
            type = COALESCE(NULLIF(EXCLUDED.type, ''), funds.type),
            management_fee = CASE WHEN EXCLUDED.management_fee > 0 THEN EXCLUDED.management_fee ELSE funds.management_fee END,
            custody_fee = CASE WHEN EXCLUDED.custody_fee > 0 THEN EXCLUDED.custody_fee ELSE funds.custody_fee END,
            service_fee = CASE WHEN EXCLUDED.service_fee > 0 OR funds.service_fee IS NULL THEN EXCLUDED.service_fee ELSE funds.service_fee END,
            total_fee = CASE WHEN EXCLUDED.total_fee > 0 THEN EXCLUDED.total_fee ELSE funds.total_fee END,
            scale = COALESCE(EXCLUDED.scale, funds.scale),
            rating = COALESCE($9, funds.rating),
            buy_suggestion = COALESCE(NULLIF(EXCLUDED.buy_suggestion, ''), funds.buy_suggestion),
            daily_limit = COALESCE(EXCLUDED.daily_limit, funds.daily_limit),
            manager = COALESCE(NULLIF(EXCLUDED.manager, ''), funds.manager),
            updated_at = NOW()
        `, [
          code, data.name || '', data.type || '',
          data.managementFee || 0, data.custodyFee || 0, data.serviceFee || 0, data.totalFee || 0,
          data.scale || 0, rating, data.buySuggestion || '', data.dailyLimit || 0, data.manager || '',
        ]);

        // 写入 fund_nav 表
        if (data.nav > 0 && data.navDate) {
          await pool.query(`
            INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (fund_code, nav_date) DO UPDATE SET
              nav = EXCLUDED.nav, total_nav = EXCLUDED.total_nav,
              return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
              return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
              return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
              return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
              return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)
          `, [
            code, data.nav, data.totalNav || data.nav, data.navDate,
            data.return1w, data.return1m, data.return3m, data.return6m, data.return1y,
          ]);
          navCount++;
        }

        successCount++;
      } catch (e) {
        skipCount++;
        if (errors.length < 10) errors.push(`${code}: ${e.message}`);
      }
    }

    if ((i + BATCH_SIZE) % 30 === 0 || i + BATCH_SIZE >= codes.length) {
      logger.info(`[全量更新] 进度: ${Math.min(i + BATCH_SIZE, codes.length)}/${codes.length} (成功${successCount}, 净值${navCount})`);
    }

    if (i + BATCH_SIZE < codes.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  if (errors.length > 0) {
    logger.warn(`[全量更新] 错误 (${errors.length}):`);
    errors.forEach(e => logger.warn(`  - ${e}`));
  }

  logger.info(`[全量更新] 完成: 成功 ${successCount}/${codes.length}, 净值 ${navCount}, 跳过 ${skipCount}`);
  return { total: codes.length, success: successCount, navUpdated: navCount, skipCount, errors };
}

module.exports = {
  defaultIndices,
  fetchFundNavBatch,
  fetchMarketIndices,
  fetchIndexValuation,
  fetchSectorData,
  fetchFundReturns,
  fetchReturn1w,
  fetchQDIIData,
  fetchHS300FundDetails,
  fetchCapitalFlow,
  getCachedCapitalFlow,
  updateAllFundData,
  updateAllFundReturns,
  updatePortfolioPnl,
  runDailyDataUpdate,
  fetchYiFangDaFundData,
  fetchGoldFundData,
  discoverGoldFundsFromAlipay,
  fetchAllCuratedFundsData,
  GOLD_FUND_CODES,
  estimatePercentile,
  getValuationByPercentile,
  validatePortfolioValues,
  classifyGoldCategory,
  inferIndustry,
  estimateRating,
};
