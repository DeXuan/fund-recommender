/**
 * 数据抓取模块 — 从外部 API 获取基金、指数、板块、资金流向数据
 */

const axios = require('axios');
const iconv = require('iconv-lite');
const { getPool } = require('./db.cjs');
const fundService = require('./fund-service.cjs');

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
    console.warn(`[净值] 批量获取净值失败: ${error.message}`);
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

      const prevClose = parseFloat(fields[2]);
      const current = parseFloat(fields[3]);

      if (!current || !prevClose) continue;

      const change = current - prevClose;
      const changePercent = (change / prevClose) * 100;

      await fundService.updateMarketIndex(config.code, {
        name: config.name,
        price: current.toFixed(2),
        change: change.toFixed(2),
        changePercent: changePercent.toFixed(2),
      });
      updatedCount++;
    }

    console.log(`[指数] 更新了 ${updatedCount}/${symbols.length} 个指数`);
    return updatedCount;
  } catch (error) {
    console.warn('[指数] 获取指数数据失败:', error.message);
    return 0;
  }
}

// 从腾讯行情API获取指数PE/PB估值数据
async function fetchIndexValuation() {
  const symbols = [
    { code: '000300', symbol: 'sh000300', name: '沪深300' },
    { code: '000905', symbol: 'sh000905', name: '中证500' },
    { code: '399006', symbol: 'sz399006', name: '创业板指' },
    { code: '000688', symbol: 'sh000688', name: '科创50' },
    { code: '000001', symbol: 'sh000001', name: '上证指数' },
  ];

  const pbPeRatio = {
    '000300': 0.09,
    '000905': 0.03,
    '399006': 0.03,
    '000688': 0.007,
    '000001': 0.07,
  };

  try {
    const listStr = symbols.map(s => s.symbol).join(',');
    const response = await axios.get(`https://qt.gtimg.cn/q=${listStr}`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.data) return 0;

    const lines = response.data.split(';').filter(l => l.includes('~'));
    let updatedCount = 0;

    for (const line of lines) {
      const parts = line.split('~');
      if (parts.length < 40) continue;

      const code = parts[2];
      const config = symbols.find(s => s.code === code);
      if (!config) continue;

      const pe = parseFloat(parts[39]);
      if (!pe || pe <= 0) continue;

      const pb = pe * (pbPeRatio[code] || 0.05);
      const pePercentile = estimatePercentile(code, pe, 'pe');
      const pbPercentile = estimatePercentile(code, pb, 'pb');
      const { valuation, suggestion } = getValuationByPercentile(pePercentile);

      await fundService.updateMarketIndex(code, {
        name: config.name,
        pe: pe.toFixed(2),
        pb: pb.toFixed(2),
        pePercentile,
        pbPercentile,
        valuation,
        suggestion,
      });
      updatedCount++;
    }

    if (updatedCount > 0) {
      console.log(`[估值] 更新了 ${updatedCount}/${symbols.length} 个指数PE/PB估值`);
    }
    return updatedCount;
  } catch (error) {
    console.warn('[估值] 获取估值数据失败:', error.message);
    return 0;
  }
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
    console.log(`[板块] 更新了 ${sectors.length} 个行业板块`);
    return sectors;
  } catch (error) {
    console.warn('[板块] 获取板块数据失败:', error.message);
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
    } catch (e) { /* 忽略 */ }

    let nav = null, navDate = null;
    let return1m = null, return3m = null, return6m = null, return1y = null;
    try {
      const lsjzRes = await axios.get(
        `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=260`,
        { timeout: 8000, headers: { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
      );
      const list = lsjzRes.data?.Data?.LSJZList;
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
    } catch (e) { /* 忽略 */ }

    return { nav, navDate, return1m, return3m, return6m, return1y, buySuggestion, dailyLimit };
  } catch (error) {
    return null;
  }
}

// 从东方财富获取QDII基金收益率+申购状态
async function fetchQDIIData(allFunds) {
  const qdiiFunds = allFunds.filter(f => f.type === 'QDII');
  if (qdiiFunds.length === 0) return 0;

  console.log(`[QDII] 开始更新 ${qdiiFunds.length} 只QDII基金数据...`);
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
            console.warn(`[QDII] 写入 fund_nav 失败 ${fund.code}:`, e.message);
          }
        }

        try {
          const pool = getPool();
          await pool.query(
            'UPDATE funds SET buy_suggestion = $1, daily_limit = $2, updated_at = NOW() WHERE code = $3',
            [data.buySuggestion, data.dailyLimit, fund.code]
          );
        } catch (e) { /* 忽略 */ }

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

  console.log(`[QDII] 更新完成 ${updatedCount}/${qdiiFunds.length} 只基金`);
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

  console.log(`[HS300] 开始更新 ${hs300Funds.length} 只沪深300基金详情...`);
  let updatedCount = 0;

  const allFundsWithNav = await fundService.getAllFundsWithNav();
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
  console.log(`[HS300] 基准收益率(非增强型平均): ${benchmarkReturn1y.toFixed(2)}%`);

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
          console.warn(`[HS300] 写入详情失败 ${batch[j].code}:`, e.message);
        }
      }
    }

    if (i + 5 < hs300Funds.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`[HS300] 更新完成: ${updatedCount}/${hs300Funds.length} 只基金`);
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
      console.log(`[资金] 更新北向资金: ${northbound.total}亿, 主力资金: ${mainFlow.length}个行业`);
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`[资金] 第${attempt + 1}次获取失败，重试中...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.warn('[资金] 获取资金流向数据失败:', error.message);
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
    console.log('数据更新正在进行中，跳过本次更新');
    return;
  }

  dataUpdateStatus.isUpdating = true;
  dataUpdateStatus.error = null;
  console.log(`[${new Date().toLocaleString()}] 开始更新基金数据...`);

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
            console.warn(`保存基金 ${code} 净值失败:`, e.message);
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
      console.log('[收益率] 开始更新基金收益率...');
      await updateAllFundReturns();
      dataUpdateStatus.lastReturnUpdateDate = today;
    }

    dataUpdateStatus.lastUpdateTime = new Date().toISOString();
    dataUpdateStatus.updateCount++;
    dataUpdateStatus.nextUpdateTime = getNextUpdateTime().toISOString();
    console.log(`[${new Date().toLocaleString()}] 基金数据更新完成，更新了 ${updatedCount} 只基金`);

  } catch (error) {
    console.error('数据更新失败:', error.message);
    dataUpdateStatus.error = error.message;
  } finally {
    dataUpdateStatus.isUpdating = false;
  }
}

// 批量更新所有基金的收益率
async function updateAllFundReturns(allFunds) {
  let updatedCount = 0;
  let failedCount = 0;
  for (let i = 0; i < allFunds.length; i += 10) {
    const batch = allFunds.slice(i, i + 10);
    const results = await Promise.all(batch.map(f => fetchFundReturns(f.code)));
    const weekResults = await Promise.all(batch.map(f => fetchReturn1w(f.code)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result && result.return1y != null) {
        if (weekResults[j] != null) result.return1w = weekResults[j];
        try {
          await fundService.updateFundReturns(batch[j].code, result);
          updatedCount++;
        } catch (e) {
          console.warn(`保存基金 ${batch[j].code} 收益率失败:`, e.message);
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }

    if (i + 10 < allFunds.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`[收益率] 更新完成: 成功 ${updatedCount}, 失败 ${failedCount}, 共 ${allFunds.length} 只`);
  return updatedCount;
}

// 更新所有用户的持仓盈亏数据
async function updatePortfolioPnl(allFunds) {
  const pool = getPool();
  try {
    const recordsResult = await pool.query('SELECT id, fund_code, shares, cost_price, buy_fee FROM fund_records');
    if (recordsResult.rows.length === 0) {
      console.log('[持仓] 没有持仓记录，跳过更新');
      return 0;
    }

    const navResult = await pool.query(
      `SELECT DISTINCT ON (fund_code) fund_code, nav FROM fund_nav ORDER BY fund_code, nav_date DESC`
    );
    const navMap = new Map();
    navResult.rows.forEach(row => navMap.set(row.fund_code, parseFloat(row.nav)));

    allFunds.forEach(f => {
      if (f.nav && !navMap.has(f.code)) navMap.set(f.code, f.nav);
    });

    const missingCodes = recordsResult.rows
      .map(r => r.fund_code)
      .filter(code => !navMap.has(code));
    if (missingCodes.length > 0) {
      console.log(`[持仓] 从API获取 ${missingCodes.length} 只基金净值...`);
      const batchNav = await fetchFundNavBatch(missingCodes);
      batchNav.forEach((val, code) => {
        if (val.nav > 0) navMap.set(code, val.nav);
      });
    }

    let updated = 0;
    for (const record of recordsResult.rows) {
      const currentNav = navMap.get(record.fund_code);
      if (!currentNav) continue;

      const shares = parseFloat(record.shares);
      const costPrice = parseFloat(record.cost_price);
      const buyFee = parseFloat(record.buy_fee || 0);
      const totalCost = shares * costPrice + buyFee;
      const marketValue = parseFloat((shares * currentNav).toFixed(2));
      const pnl = parseFloat((marketValue - totalCost).toFixed(2));
      const pnlPercent = totalCost > 0 ? parseFloat(((pnl / totalCost) * 100).toFixed(2)) : 0;

      await pool.query(
        `UPDATE fund_records SET current_nav = $1, market_value = $2, pnl = $3, pnl_percent = $4, nav_updated_at = NOW() WHERE id = $5`,
        [currentNav, marketValue, pnl, pnlPercent, record.id]
      );
      updated++;
    }

    console.log(`[持仓] 更新完成: ${updated} 条记录`);
    return updated;
  } catch (error) {
    console.warn('[持仓] 更新失败:', error.message);
    return 0;
  }
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
};
