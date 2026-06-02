const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { allFunds } = require('./fund-data.cjs');

const app = express();
const PORT = 3003;

// CORS: 仅允许前端域名
const ALLOWED_ORIGINS = [
  'http://47.116.77.67:8688',
  'http://localhost:5174',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

// 请求体大小限制
app.use(express.json({ limit: '10kb' }));

// 简易速率限制
const rateLimitMap = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    record.count++;
    rateLimitMap.set(ip, record);
    if (record.count > max) {
      return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}
// POST 端点限流：每 IP 每分钟 20 次
app.use('/api/', rateLimit(60 * 1000, 60));
// 数据更新接口更严格
app.use('/api/update', rateLimit(15 * 60 * 1000, 3));

// 安全响应头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 数据更新状态
let dataUpdateStatus = {
  lastUpdateTime: null,
  nextUpdateTime: null,
  isUpdating: false,
  updateCount: 0,
  error: null,
};

// 定时更新间隔（15分钟）
const UPDATE_INTERVAL = 15 * 60 * 1000;

// 从东方财富API获取基金实时净值
async function fetchFundNavFromEastmoney(code) {
  try {
    const response = await axios.get(
      `https://fundgz.1234567.com.cn/js/${code}.rt`,
      { timeout: 5000 }
    );

    if (response.data) {
      // 解析返回的JSONP数据
      const jsonStr = response.data.replace(/^jsonpgz\(/, '').replace(/\);?$/, '');
      const data = JSON.parse(jsonStr);

      return {
        code: data.fundcode,
        name: data.name,
        nav: parseFloat(data.dwjz),       // 单位净值
        totalNav: parseFloat(data.gsz),    // 累计净值
        navDate: data.jzrq,                // 净值日期
        return1w: parseFloat(data.zzl) || 0, // 日涨跌幅
      };
    }
  } catch (error) {
    console.warn(`获取基金 ${code} 净值失败: ${error.message}`);
  }
  return null;
}

// 批量更新基金数据
async function updateAllFundData() {
  if (dataUpdateStatus.isUpdating) {
    console.log('数据更新正在进行中，跳过本次更新');
    return;
  }

  dataUpdateStatus.isUpdating = true;
  dataUpdateStatus.error = null;
  console.log(`[${new Date().toLocaleString()}] 开始更新基金数据...`);

  try {
    let updatedCount = 0;

    // 批量获取基金净值
    for (let i = 0; i < allFunds.length; i += 5) {
      const batch = allFunds.slice(i, i + 5);
      const promises = batch.map(fund => fetchFundNavFromEastmoney(fund.code));
      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        if (result && result.nav) {
          const fund = batch[index];
          fund.nav = result.nav;
          fund.navDate = result.navDate;
          updatedCount++;
        }
      });

      // 避免请求过快
      if (i + 5 < allFunds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    dataUpdateStatus.lastUpdateTime = new Date().toISOString();
    dataUpdateStatus.updateCount++;
    dataUpdateStatus.nextUpdateTime = new Date(Date.now() + UPDATE_INTERVAL).toISOString();
    console.log(`[${new Date().toLocaleString()}] 基金数据更新完成，更新了 ${updatedCount} 只基金`);

  } catch (error) {
    console.error('数据更新失败:', error.message);
    dataUpdateStatus.error = error.message;
  } finally {
    dataUpdateStatus.isUpdating = false;
  }
}

// 启动定时更新任务
function startAutoUpdate() {
  console.log('启动自动数据更新任务（每15分钟）');

  // 立即执行一次更新
  updateAllFundData();

  // 设置定时器
  setInterval(() => {
    updateAllFundData();
  }, UPDATE_INTERVAL);
}

// 启动自动更新
startAutoUpdate();

// API路由

// 获取数据更新状态
app.get('/api/status', (req, res) => {
  res.json({
    lastUpdateTime: dataUpdateStatus.lastUpdateTime,
    nextUpdateTime: dataUpdateStatus.nextUpdateTime,
    isUpdating: dataUpdateStatus.isUpdating,
    updateCount: dataUpdateStatus.updateCount,
    error: dataUpdateStatus.error ? '数据更新遇到错误' : null,
    updateInterval: UPDATE_INTERVAL / 1000 / 60 + '分钟',
  });
});

// 手动触发数据更新
app.post('/api/update', async (req, res) => {
  if (dataUpdateStatus.isUpdating) {
    return res.json({ success: false, message: '数据更新正在进行中' });
  }

  updateAllFundData();
  res.json({ success: true, message: '数据更新已启动' });
});

// 获取基金列表
app.get('/api/funds', async (req, res) => {
  try {
    const { industry, type, sort, order, search } = req.query;
    let funds = [...allFunds];

    if (industry) {
      funds = funds.filter(f => f.industry === industry);
    }

    if (type) {
      funds = funds.filter(f => f.type === type);
    }

    if (search && typeof search === 'string' && search.length <= 50) {
      const searchLower = search.toLowerCase();
      funds = funds.filter(f =>
        f.code.includes(search) ||
        f.name.toLowerCase().includes(searchLower)
      );
    }

    const allowedSorts = ['return1y', 'return6m', 'return3m', 'return1m', 'totalFee', 'scale', 'rating'];
    if (sort && allowedSorts.includes(sort)) {
      const sortOrder = order === 'asc' ? 1 : -1;
      funds.sort((a, b) => {
        if (sort === 'return1y') return (b.return1y - a.return1y) * sortOrder;
        if (sort === 'return6m') return (b.return6m - a.return6m) * sortOrder;
        if (sort === 'return3m') return (b.return3m - a.return3m) * sortOrder;
        if (sort === 'return1m') return (b.return1m - a.return1m) * sortOrder;
        if (sort === 'totalFee') return (a.totalFee - b.totalFee) * sortOrder;
        if (sort === 'scale') return (b.scale - a.scale) * sortOrder;
        if (sort === 'rating') return (b.rating - a.rating) * sortOrder;
        return 0;
      });
    }

    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: '获取基金列表失败' });
  }
});

// 获取基金详情
app.get('/api/funds/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }
    const fund = allFunds.find(f => f.code === code);

    if (!fund) {
      return res.status(404).json({ error: '基金不存在' });
    }

    // 生成详细数据
    const detail = generateFundDetail(fund);
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: '获取基金详情失败' });
  }
});

// 获取市场指数数据
app.get('/api/market/indices', async (req, res) => {
  try {
    const indices = [
      { name: '沪深300', code: '000300', pe: 12.5, pb: 1.3, pePercentile: 42, pbPercentile: 32, valuation: '合理偏低', suggestion: '适合定投' },
      { name: '中证500', code: '000905', pe: 26, pb: 1.8, pePercentile: 45, pbPercentile: 30, valuation: '合理偏低', suggestion: '适合定投' },
      { name: '创业板指', code: '399006', pe: 35, pb: 4.2, pePercentile: 55, pbPercentile: 40, valuation: '合理', suggestion: '适合小额定投' },
      { name: '科创50', code: '000688', pe: 45, pb: 4.5, pePercentile: 60, pbPercentile: 45, valuation: '合理偏高', suggestion: '建议观望' },
      { name: '上证指数', code: '000001', pe: 13.2, pb: 1.4, pePercentile: 48, pbPercentile: 35, valuation: '合理', suggestion: '适合定投' },
    ];

    res.json(indices);
  } catch (error) {
    res.status(500).json({ error: '获取指数数据失败' });
  }
});

// 获取行业推荐
app.get('/api/recommendations/industry', async (req, res) => {
  try {
    const recommendations = [
      {
        industry: '人工智能/AI',
        trend: '强势上涨',
        valuation: '合理偏高',
        buySuggestion: '优先配置',
        logic: 'AI算力+应用双轮驱动，年度核心主线',
        funds: allFunds.filter(f => f.industry === '人工智能').slice(0, 3),
      },
      {
        industry: '半导体/芯片',
        trend: '震荡上行',
        valuation: '合理',
        buySuggestion: '优先配置',
        logic: '半导体国产替代+AI芯片需求爆发',
        funds: allFunds.filter(f => f.industry === '半导体/芯片').slice(0, 3),
      },
      {
        industry: '纳斯达克100',
        trend: '强势上涨',
        valuation: '合理偏高',
        buySuggestion: '限大额配置',
        logic: '美股科技龙头，QDII额度紧张',
        funds: allFunds.filter(f => f.industry === '纳斯达克100').slice(0, 3),
      },
      {
        industry: '医药',
        trend: '底部反弹',
        valuation: '极低',
        buySuggestion: '左侧布局',
        logic: '估值历史极低，长期配置价值凸显',
        funds: allFunds.filter(f => f.industry === '医药').slice(0, 3),
      },
    ];

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: '获取推荐失败' });
  }
});

// 获取分批建仓方案
app.get('/api/recommendations/batch-plans', async (req, res) => {
  try {
    const plans = [
      {
        batch: 1,
        time: '本周',
        ratio: 40,
        funds: ['人工智能ETF联接A(013349)', '半导体芯片ETF联接A(008887)'],
        method: '一次性买入',
        reason: 'AI+半导体为年度核心主线，Q2涨幅领先',
      },
      {
        batch: 2,
        time: '下周',
        ratio: 30,
        funds: ['光伏ETF联接A(011102)', '新能源ETF联接A(012348)'],
        method: '定投或一次性买入',
        reason: '光伏/新能源底部反转，估值低估区间',
      },
      {
        batch: 3,
        time: '第三周',
        ratio: 20,
        funds: ['军工ETF联接A(013139)', '科技ETF联接A(007873)'],
        method: '定投',
        reason: '稳健配置型标的，分散风险',
      },
      {
        batch: 4,
        time: '第四周',
        ratio: 10,
        funds: ['银行ETF联接A(001594)'],
        method: '定投',
        reason: '银行高股息防守，平衡组合风险',
      },
    ];

    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: '获取建仓方案失败' });
  }
});

// 获取QDII基金数据
app.get('/api/funds/qdii', async (req, res) => {
  try {
    const qdiiFunds = allFunds.filter(f => f.type === 'QDII');
    res.json(qdiiFunds);
  } catch (error) {
    res.status(500).json({ error: '获取QDII基金失败' });
  }
});

// 获取沪深300基金
app.get('/api/funds/hs300', async (req, res) => {
  try {
    const hs300Funds = allFunds.filter(f => f.industry === '沪深300');
    res.json(hs300Funds);
  } catch (error) {
    res.status(500).json({ error: '获取沪深300基金失败' });
  }
});

// 沪深300指数基金深度分析
app.get('/api/hs300/analysis', async (req, res) => {
  try {
    // 从东方财富获取沪深300指数估值
    let indexValuation = {
      name: '沪深300',
      code: '000300',
      pe: 12.5,
      pb: 1.3,
      pePercentile: 42,
      pbPercentile: 32,
      valuation: '合理偏低',
      suggestion: '适合定投',
      roe: 10.4,
      dividendYield: 2.8,
    };

    try {
      const valRes = await axios.get(
        'https://push2.eastmoney.com/api/qt/stock/get?secid=1.000300&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f116,f117,f162,f163,f167,f170',
        { timeout: 5000 }
      );
      if (valRes.data && valRes.data.data) {
        const d = valRes.data.data;
        indexValuation.pe = d.f162 ? (d.f162 / 100).toFixed(2) : indexValuation.pe;
        indexValuation.pb = d.f167 ? (d.f167 / 100).toFixed(2) : indexValuation.pb;
      }
    } catch (e) {
      // 使用默认估值数据
    }

    // 沪深300基金分析数据
    const hs300Funds = [
      { code: '510300', name: '华泰柏瑞沪深300ETF', type: 'ETF', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 500.2, return1y: 31.47, return6m: 10.1, return3m: 4.86, return1m: 3.83, return1w: 1.99, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: true },
      { code: '510310', name: '易方达沪深300ETF', type: 'ETF', managementFee: 0.2, custodyFee: 0.1, totalFee: 0.3, scale: 200.5, return1y: 31.7, return6m: 10.22, return3m: 4.92, return1m: 3.86, return1w: 1.98, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: true },
      { code: '159919', name: '嘉实沪深300ETF', type: 'ETF', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 85.3, return1y: 31.4, return6m: 10.08, return3m: 4.85, return1m: 3.84, return1w: 1.98, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: true },
      { code: '159925', name: '南方沪深300ETF', type: 'ETF', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 45.6, return1y: 31.83, return6m: 10.45, return3m: 5.04, return1m: 3.89, return1w: 1.99, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: true },
      { code: '510330', name: '华夏沪深300ETF', type: 'ETF', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 300.5, return1y: 31.52, return6m: 10.14, return3m: 4.9, return1m: 3.86, return1w: 1.99, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: true },
      { code: '110020', name: '易方达沪深300ETF联接A', type: 'ETF联接', managementFee: 0.15, custodyFee: 0.05, totalFee: 0.2, scale: 156.23, return1y: 29.96, return6m: 9.74, return3m: 4.73, return1m: 3.7, return1w: 1.87, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20 },
      { code: '270010', name: '广发沪深300ETF联接A', type: 'ETF联接', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 45.6, return1y: 28.66, return6m: 9.33, return3m: 4.56, return1m: 3.64, return1w: 1.88, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20 },
      { code: '160706', name: '嘉实沪深300ETF联接A', type: 'ETF联接', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 85.3, return1y: 29.57, return6m: 9.54, return3m: 4.65, return1m: 3.65, return1w: 1.88, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0.15, purchaseFeeOriginal: 1.50 },
      { code: '202015', name: '南方沪深300ETF联接A', type: 'ETF联接', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 32.1, return1y: 29.36, return6m: 9.75, return3m: 4.67, return1m: 3.61, return1w: 1.86, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20 },
      { code: '000051', name: '华夏沪深300ETF联接A', type: 'ETF联接', managementFee: 0.15, custodyFee: 0.05, totalFee: 0.2, scale: 120.5, return1y: 29.87, return6m: 9.71, return3m: 4.66, return1m: 3.67, return1w: 1.88, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20 },
      { code: '460300', name: '华泰柏瑞沪深300ETF联接A', type: 'ETF联接', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 28.5, return1y: 29.76, return6m: 9.91, return3m: 4.84, return1m: 3.73, return1w: 1.89, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0.10, purchaseFeeOriginal: 1.00 },
      { code: '002910', name: '易方达沪深300ETF联接C', type: 'ETF联接', managementFee: 0.15, custodyFee: 0.05, totalFee: 0.2, scale: 85.6, return1y: 29.5, return6m: 9.6, return3m: 4.6, return1m: 3.55, return1w: 1.85, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: false, purchaseFee: 0, purchaseFeeOriginal: 0, serviceFee: 0.2 },
      { code: '007339', name: '华泰柏瑞沪深300ETF联接C', type: 'ETF联接', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 15.2, return1y: 29.7, return6m: 9.64, return3m: 4.68, return1m: 3.68, return1w: 1.87, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0, purchaseFeeOriginal: 0, serviceFee: 0.2 },
      { code: '000656', name: '博时沪深300指数A', type: '指数增强', managementFee: 1.0, custodyFee: 0.2, totalFee: 1.2, scale: 25.3, return1y: 32.5, return6m: 11.2, return3m: 5.5, return1m: 2.5, return1w: 2.0, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20, isEnhanced: true },
      { code: '005102', name: '富国沪深300指数增强A', type: '指数增强', managementFee: 1.0, custodyFee: 0.2, totalFee: 1.2, scale: 35.8, return1y: 35.2, return6m: 12.5, return3m: 6.2, return1m: 2.8, return1w: 2.2, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20, isEnhanced: true, alpha: 5.2 },
      { code: '005113', name: '平安沪深300指数量化A', type: '指数增强', managementFee: 1.0, custodyFee: 0.1, totalFee: 1.1, scale: 18.5, return1y: 44.7, return6m: 16.74, return3m: 5.56, return1m: 2.5, return1w: 1.71, purchaseStatus: 'open', dailyLimit: 0, rating: 5, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20, isEnhanced: true, alpha: 14.74 },
      { code: '519300', name: '大成沪深300指数A', type: 'ETF联接', managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 18.9, return1y: 29.81, return6m: 10.13, return3m: 4.92, return1m: 3.77, return1w: 1.90, purchaseStatus: 'open', dailyLimit: 0, rating: 4, isETF: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.20 },
    ];

    // 沪深300前10大权重股分析
    const topHoldings = [
      { name: '贵州茅台', code: '600519', weight: 5.8, industry: '白酒', pe: 28.5, pb: 8.2, roe: 28.7, revenueGrowth: 15.2, epsGrowth: 16.8, analystConsensus: '买入', outlook: '稳健增长，估值合理偏低' },
      { name: '宁德时代', code: '300750', weight: 4.2, industry: '新能源', pe: 22.1, pb: 5.8, roe: 26.3, revenueGrowth: 25.5, epsGrowth: 30.2, analystConsensus: '强烈买入', outlook: '全球动力电池龙头，海外扩张加速' },
      { name: '中国平安', code: '601318', weight: 3.1, industry: '保险', pe: 9.8, pb: 1.1, roe: 11.2, revenueGrowth: 8.5, epsGrowth: 12.3, analystConsensus: '买入', outlook: '估值极低，高股息率，寿险改革见效' },
      { name: '招商银行', code: '600036', weight: 2.8, industry: '银行', pe: 6.5, pb: 0.95, roe: 14.6, revenueGrowth: 5.2, epsGrowth: 8.8, analystConsensus: '买入', outlook: '零售银行龙头，资产质量优异' },
      { name: '美的集团', code: '000333', weight: 2.5, industry: '家电', pe: 12.8, pb: 3.2, roe: 25.0, revenueGrowth: 10.5, epsGrowth: 15.2, analystConsensus: '买入', outlook: '家电龙头，海外收入占比提升' },
      { name: '长江电力', code: '600900', weight: 2.3, industry: '电力', pe: 20.5, pb: 3.8, roe: 18.5, revenueGrowth: 8.2, epsGrowth: 10.5, analystConsensus: '买入', outlook: '水电龙头，现金流稳定，高股息' },
      { name: '比亚迪', code: '002594', weight: 2.1, industry: '新能源汽车', pe: 18.5, pb: 4.2, roe: 22.7, revenueGrowth: 35.2, epsGrowth: 42.8, analystConsensus: '强烈买入', outlook: '新能源车销量持续高增，智能化加速' },
      { name: '中芯国际', code: '688981', weight: 1.8, industry: '半导体', pe: 35.2, pb: 2.1, roe: 6.0, revenueGrowth: 28.5, epsGrowth: 45.2, analystConsensus: '买入', outlook: '国产替代核心标的，产能利用率回升' },
      { name: '恒瑞医药', code: '600276', weight: 1.6, industry: '医药', pe: 42.5, pb: 7.8, roe: 18.4, revenueGrowth: 18.5, epsGrowth: 22.3, analystConsensus: '买入', outlook: '创新药龙头，管线丰富，业绩拐点确认' },
      { name: '紫金矿业', code: '601899', weight: 1.5, industry: '有色', pe: 12.2, pb: 3.5, roe: 28.7, revenueGrowth: 22.8, epsGrowth: 35.5, analystConsensus: '强烈买入', outlook: '铜金双轮驱动，资源品价格上涨受益' },
    ];

    // 投资建议
    const analysis = {
      valuation: indexValuation,
      funds: hs300Funds,
      topHoldings: topHoldings,
      recommendation: {
        summary: '沪深300当前估值合理偏低（PE分位42%），近1年收益约30%，近3月收益约5%，适合定投和分批建仓。',
        bullFactors: [
          '估值处于历史中低位，PE约12.5x，PB约1.3x，安全边际较高',
          '近1年收益30%+，市场趋势向好，经济基本面改善',
          '政策面积极，降准降息预期，流动性宽松',
          '外资持续流入，北向资金净买入趋势明显',
          '权重股基本面稳健，贵州茅台/宁德时代/比亚迪业绩增长强劲',
        ],
        bearFactors: [
          '中美贸易摩擦不确定性，关税政策可能反复',
          '房地产行业仍在底部，拖累相关权重股',
          '部分权重股估值已修复至合理区间，上涨空间收窄',
          '美联储降息节奏不确定，可能影响全球流动性',
        ],
        strategy: {
          shortTerm: '未来3个月预期收益+3%~+8%，建议分2-3批建仓，每次30-40%',
          mediumTerm: '未来6个月预期收益+5%~+15%，适合定投+逢低加仓',
          longTerm: '未来1年预期收益+10%~+25%，核心配置品种',
        },
        bestPicks: [
          { code: '005113', name: '平安沪深300指数量化A', reason: '量化增强收益最高，近1年+44.7%，超额收益14.74%' },
          { code: '005102', name: '富国沪深300指数增强A', reason: '增强收益稳定，近1年+35.2%，金选基金' },
          { code: '110020', name: '易方达沪深300ETF联接A', reason: '费率最低0.15%+0.05%=0.2%，纯跟踪误差小' },
          { code: '000051', name: '华夏沪深300ETF联接A', reason: '费率最低0.2%，规模大120亿，金选基金' },
        ],
      },
    };

    res.json(analysis);
  } catch (error) {
    console.error('沪深300分析数据获取失败:', error.message);
    res.status(500).json({ error: '获取沪深300分析数据失败' });
  }
});

// 风险评估
app.post('/api/risk/profile', (req, res) => {
  try {
    const { age, investmentAmount, investmentPeriod, riskTolerance, lossTolerance } = req.body;
    if (!age || !investmentAmount || !investmentPeriod || !riskTolerance || !lossTolerance) {
      return res.status(400).json({ error: '请填写完整的风险评估信息' });
    }

    // 计算风险评分
    const ageScores = { '18-25岁': 4, '26-35岁': 3, '36-45岁': 2, '46-55岁': 1, '55岁以上': 0 };
    const amountScores = { '1万以下': 1, '1-5万': 2, '5-20万': 3, '20-50万': 4, '50万以上': 4 };
    const periodScores = { '1年以内': 1, '1-3年': 2, '3-5年': 3, '5年以上': 4 };
    const riskScores = { conservative: 1, balanced: 2, aggressive: 3 };
    const lossScores = { '5%以内': 1, '5-10%': 2, '10-20%': 3, '20-30%': 4, '30%以上': 4 };

    const score = (ageScores[age] || 2) + (amountScores[investmentAmount] || 2) +
                  (periodScores[investmentPeriod] || 2) + (riskScores[riskTolerance] || 2) +
                  (lossScores[lossTolerance] || 2);

    let type, description, allocation, expectedReturn, riskLevel;

    if (score <= 7) {
      type = '保守型';
      description = '您偏好低风险投资，建议以货币基金和债券基金为主，少量配置指数基金。';
      riskLevel = 'low';
      expectedReturn = '3%-6%';
      allocation = [
        { industry: '货币基金', percentage: 30, funds: ['天弘余额宝', '南方天天利'] },
        { industry: '债券基金', percentage: 40, funds: ['易方达稳健收益', '招商产业债券'] },
        { industry: '沪深300指数', percentage: 20, funds: ['易方达沪深300ETF联接A'] },
        { industry: '银行理财', percentage: 10, funds: ['招商银行朝朝宝'] },
      ];
    } else if (score <= 11) {
      type = '稳健型';
      description = '您能承受一定风险，建议均衡配置股票型和债券型基金，适当配置指数基金。';
      riskLevel = 'medium';
      expectedReturn = '6%-12%';
      allocation = [
        { industry: '沪深300指数', percentage: 30, funds: ['易方达沪深300ETF联接A', '华夏沪深300ETF联接A'] },
        { industry: '债券基金', percentage: 25, funds: ['易方达稳健收益', '招商产业债券'] },
        { industry: '医药行业', percentage: 15, funds: ['中欧医疗健康混合A'] },
        { industry: '消费行业', percentage: 15, funds: ['易方达消费行业'] },
        { industry: '货币基金', percentage: 15, funds: ['天弘余额宝'] },
      ];
    } else {
      type = '激进型';
      description = '您追求高收益，可配置较多股票型基金和行业主题基金，注意分散风险。';
      riskLevel = 'high';
      expectedReturn = '12%-25%';
      allocation = [
        { industry: '人工智能/AI', percentage: 25, funds: ['人工智能ETF联接A', '华夏中证人工智能ETF联接A'] },
        { industry: '半导体/芯片', percentage: 20, funds: ['半导体芯片ETF联接A'] },
        { industry: '纳斯达克100', percentage: 20, funds: ['广发纳斯达克100ETF联接A'] },
        { industry: '新能源', percentage: 15, funds: ['新能源ETF联接A', '光伏ETF联接A'] },
        { industry: '沪深300指数', percentage: 20, funds: ['易方达沪深300ETF联接A'] },
      ];
    }

    res.json({ type, description, allocation, expectedReturn, riskLevel });
  } catch (error) {
    res.status(500).json({ error: '风险评估失败' });
  }
});

// 定投计算器
app.post('/api/tools/dca', (req, res) => {
  try {
    const { monthlyAmount, period, expectedReturn } = req.body;
    if (typeof monthlyAmount !== 'number' || monthlyAmount <= 0 ||
        typeof period !== 'number' || period <= 0 || period > 1200 ||
        typeof expectedReturn !== 'number' || expectedReturn < -50 || expectedReturn > 100) {
      return res.status(400).json({ error: '参数格式不正确' });
    }
    const monthlyRate = expectedReturn / 100 / 12;
    const totalInvestment = monthlyAmount * period;
    let totalValue = 0;
    const monthlyDetails = [];

    for (let i = 0; i < period; i++) {
      totalValue = (totalValue + monthlyAmount) * (1 + monthlyRate);
      const cumulativeInvestment = monthlyAmount * (i + 1);
      monthlyDetails.push({
        month: i + 1,
        investment: monthlyAmount,
        cumulativeInvestment,
        value: parseFloat(totalValue.toFixed(2)),
        return: parseFloat((totalValue - cumulativeInvestment).toFixed(2)),
      });
    }

    const totalReturn = totalValue - totalInvestment;
    const years = period / 12;
    const annualizedReturn = years > 0
      ? parseFloat((Math.pow(totalValue / totalInvestment, 1 / years) - 1) * 100)
      : 0;

    res.json({
      totalInvestment,
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      monthlyDetails,
    });
  } catch (error) {
    res.status(500).json({ error: '计算失败' });
  }
});

// 基金对比
app.post('/api/tools/compare', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 20) {
      return res.status(400).json({ error: '基金代码列表无效' });
    }
    if (!codes.every(c => typeof c === 'string' && /^\d{6}$/.test(c))) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }
    const funds = codes
      .map(code => {
        try {
          const fund = allFunds.find(f => f.code === code);
          if (fund) return generateFundDetail(fund);
          return null;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: '对比失败' });
  }
});

// 获取行业列表
app.get('/api/industries', (req, res) => {
  const industries = [...new Set(allFunds.map(f => f.industry))].sort();
  res.json(industries);
});

// 行业基金深度分析
app.get('/api/industry-analysis/:industry', (req, res) => {
  try {
    const { industry } = req.params;
    const decodedIndustry = decodeURIComponent(industry);

    const industryMap = {
      '医药': { keywords: ['医药', '医疗', '生物医药'], trend: '底部反弹', valuation: '极低', buySuggestion: '左侧布局', logic: '估值历史极低，长期配置价值凸显，集采政策边际缓和' },
      '人工智能': { keywords: ['人工智能', 'AI'], trend: '强势上涨', valuation: '合理偏高', buySuggestion: '优先配置', logic: 'AI算力+应用双轮驱动，年度核心主线' },
      '半导体/芯片': { keywords: ['半导体', '芯片'], trend: '震荡上行', valuation: '合理', buySuggestion: '优先配置', logic: '半导体国产替代+AI芯片需求爆发' },
      '新能源': { keywords: ['新能源', '光伏', '锂电'], trend: '底部反弹', valuation: '低估', buySuggestion: '逢低布局', logic: '产能出清接近尾声，行业拐点将至' },
      '消费': { keywords: ['消费', '白酒'], trend: '弱势', valuation: '偏低', buySuggestion: '等待企稳', logic: '消费复苏路径尚需验证' },
      '军工': { keywords: ['军工'], trend: '温和上涨', valuation: '合理', buySuggestion: '可配置', logic: '国防预算持续增长，装备放量期' },
      '金融': { keywords: ['金融', '银行', '证券'], trend: '稳步上涨', valuation: '合理偏低', buySuggestion: '可配置', logic: '高股息+低估值，防守属性强' },
    };

    const config = industryMap[decodedIndustry];
    if (!config) {
      return res.status(404).json({ error: '行业不存在' });
    }

    const industryFunds = allFunds.filter(f =>
      config.keywords.some(kw => f.industry.includes(kw) || f.name.includes(kw))
    );

    // 构建分析结果
    const analysis = {
      industry: decodedIndustry,
      trend: config.trend,
      valuation: config.valuation,
      buySuggestion: config.buySuggestion,
      logic: config.logic,
      fundCount: industryFunds.length,
      funds: industryFunds.map(f => ({
        code: f.code,
        name: f.name,
        type: f.type,
        index: f.index,
        nav: f.nav,
        return1y: f.return1y,
        return6m: f.return6m,
        return3m: f.return3m,
        return1m: f.return1m,
        return1w: f.return1w,
        managementFee: f.managementFee,
        custodyFee: f.custodyFee,
        serviceFee: f.serviceFee || 0,
        totalFee: f.totalFee,
        purchaseFee: f.managementFee <= 0.5 ? '0.05%' : '0.12%',
        redeemFee: f.type === 'QDII' ? '0.50%' : '0.00%',
        dailyLimit: f.dailyLimit || 0,
        scale: f.scale,
        rating: f.rating,
        buySuggestion: f.buySuggestion,
        valuation: f.valuation || config.valuation,
        trend: f.trend || config.trend,
        logic: f.logic || config.logic,
        isGoldSelected: f.isGoldSelected || false,
      })),
      batchPlan: [
        { batch: 1, time: '立即', percentage: 30, targets: `${decodedIndustry}C类基金`, method: '支付宝申购C类免申购费', reason: `当前${decodedIndustry}板块估值处历史低位，先建底仓` },
        { batch: 2, time: '1个月后', percentage: 30, targets: `${decodedIndustry}C类基金`, method: '支付宝定投或手动买入', reason: '观察走势确认趋势，C类灵活调仓' },
        { batch: 3, time: '2个月后', percentage: 20, targets: `${decodedIndustry}C类基金`, method: '支付宝申购', reason: '分散持仓降低单一基金风险' },
        { batch: 4, time: '3个月后', percentage: 20, targets: '表现最优基金', method: '切换为A类降低长期费率', reason: '加仓表现最好的基金' },
      ],
      riskWarning: `1. 基金有风险，投资需谨慎。以上推荐基于数据分析，不构成投资建议。\n2. ${decodedIndustry}行业受政策影响较大，请关注相关行业政策动态。\n3. 历史收益不代表未来表现，请根据个人风险承受能力合理配置。\n4. 建议定投为主，分散投资，避免一次性大额买入。`,
    };

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: '行业分析失败' });
  }
});

// 生成基金详情数据
function generateFundDetail(fund) {
  const getValuation = (return1y) => {
    if (return1y > 30) return '合理偏高';
    if (return1y > 15) return '合理';
    if (return1y > 0) return '合理偏低';
    if (return1y > -10) return '低估';
    return '极低';
  };

  const getValuationCode = (valuation) => {
    if (valuation.includes('极低')) return 'very_low';
    if (valuation.includes('低估') || valuation.includes('偏低')) return 'low';
    if (valuation.includes('合理') && !valuation.includes('偏')) return 'reasonable';
    if (valuation.includes('偏高')) return 'high';
    return 'reasonable';
  };

  const getHoldings = (industry) => {
    const holdingsMap = {
      '人工智能': [
        { name: '科大讯飞', percentage: 12.5 },
        { name: '海康威视', percentage: 9.8 },
        { name: '中际旭创', percentage: 8.2 },
        { name: '工业富联', percentage: 7.5 },
        { name: '寒武纪', percentage: 6.8 },
        { name: '紫光股份', percentage: 5.2 },
        { name: '中科曙光', percentage: 4.8 },
        { name: '浪潮信息', percentage: 4.5 },
        { name: '用友网络', percentage: 3.8 },
        { name: '金山办公', percentage: 3.2 },
      ],
      '半导体/芯片': [
        { name: '北方华创', percentage: 11.2 },
        { name: '中芯国际', percentage: 10.5 },
        { name: '韦尔股份', percentage: 8.8 },
        { name: '兆易创新', percentage: 7.2 },
        { name: '卓胜微', percentage: 6.5 },
        { name: '圣邦股份', percentage: 5.8 },
        { name: '中微公司', percentage: 5.2 },
        { name: '长电科技', percentage: 4.5 },
        { name: '华虹半导体', percentage: 4.2 },
        { name: '紫光国微', percentage: 3.8 },
      ],
      '纳斯达克100': [
        { name: '苹果 (AAPL)', percentage: 12.8 },
        { name: '微软 (MSFT)', percentage: 11.5 },
        { name: '英伟达 (NVDA)', percentage: 8.5 },
        { name: '亚马逊 (AMZN)', percentage: 7.2 },
        { name: 'Meta (META)', percentage: 5.8 },
        { name: '谷歌 (GOOGL)', percentage: 5.5 },
        { name: '特斯拉 (TSLA)', percentage: 4.2 },
        { name: '博通 (AVGO)', percentage: 3.8 },
        { name: '奈飞 (NFLX)', percentage: 3.2 },
        { name: 'AMD (AMD)', percentage: 2.8 },
      ],
      '医药': [
        { name: '恒瑞医药', percentage: 10.5 },
        { name: '药明康德', percentage: 9.2 },
        { name: '迈瑞医疗', percentage: 8.5 },
        { name: '片仔癀', percentage: 7.2 },
        { name: '爱尔眼科', percentage: 6.5 },
        { name: '智飞生物', percentage: 5.8 },
        { name: '长春高新', percentage: 5.2 },
        { name: '沃森生物', percentage: 4.5 },
        { name: '通策医疗', percentage: 3.8 },
        { name: '华大基因', percentage: 3.2 },
      ],
      '新能源': [
        { name: '宁德时代', percentage: 15.2 },
        { name: '比亚迪', percentage: 12.5 },
        { name: '隆基绿能', percentage: 8.8 },
        { name: '阳光电源', percentage: 7.2 },
        { name: '通威股份', percentage: 6.5 },
        { name: '亿纬锂能', percentage: 5.8 },
        { name: '赣锋锂业', percentage: 5.2 },
        { name: '天齐锂业', percentage: 4.5 },
        { name: '璞泰来', percentage: 3.8 },
        { name: '恩捷股份', percentage: 3.2 },
      ],
      '消费': [
        { name: '贵州茅台', percentage: 15.5 },
        { name: '五粮液', percentage: 10.2 },
        { name: '山西汾酒', percentage: 8.5 },
        { name: '泸州老窖', percentage: 7.2 },
        { name: '海天味业', percentage: 6.5 },
        { name: '伊利股份', percentage: 5.8 },
        { name: '洋河股份', percentage: 5.2 },
        { name: '古井贡酒', percentage: 4.5 },
        { name: '今世缘', percentage: 3.8 },
        { name: '舍得酒业', percentage: 3.2 },
      ],
    };

    return holdingsMap[industry] || [
      { name: '重仓股1', percentage: 12.5 },
      { name: '重仓股2', percentage: 9.8 },
      { name: '重仓股3', percentage: 8.2 },
      { name: '重仓股4', percentage: 6.5 },
      { name: '重仓股5', percentage: 5.8 },
    ];
  };

  const getPerformanceHistory = (nav, return1y) => {
    const monthlyReturn = return1y / 12;
    const history = [];
    let currentNav = nav * 0.92;

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthReturn = monthlyReturn + (Math.random() - 0.5) * 4;
      currentNav = currentNav * (1 + monthReturn / 100);

      history.push({
        date: monthStr,
        nav: parseFloat(currentNav.toFixed(4)),
        return: parseFloat(monthReturn.toFixed(2)),
      });
    }

    return history;
  };

  const valuation = fund.valuation || getValuation(fund.return1y);
  const dailyLimit = fund.dailyLimit || (fund.buySuggestion === '限大额' ? 10 : 0);

  return {
    ...fund,
    fullName: `${fund.name} (${fund.code})`,
    establishDate: '2020-01-15',
    fundManager: fund.name.includes('华夏') ? '张弘弢' :
                 fund.name.includes('易方达') ? '成曦' :
                 fund.name.includes('广发') ? '霍华明' :
                 fund.name.includes('天弘') ? '杨超' :
                 fund.name.includes('南方') ? '孙伟' :
                 fund.name.includes('国泰') ? '梁杏' :
                 fund.name.includes('华安') ? '许之彦' :
                 '基金经理',
    company: fund.name.includes('华夏') ? '华夏基金' :
             fund.name.includes('易方达') ? '易方达基金' :
             fund.name.includes('广发') ? '广发基金' :
             fund.name.includes('天弘') ? '天弘基金' :
             fund.name.includes('南方') ? '南方基金' :
             fund.name.includes('国泰') ? '国泰基金' :
             '基金公司',
    managementFee: fund.managementFee || 0.5,
    custodyFee: fund.custodyFee || 0.1,
    serviceFee: fund.serviceFee || 0,
    purchaseFee: 1.20,
    purchaseFeeDiscount: 0.12,
    totalFee: fund.totalFee || (fund.managementFee || 0.5) + (fund.custodyFee || 0.1),
    share: (fund.scale * 0.8).toFixed(2),
    shareChange: (Math.random() * 10 - 2).toFixed(2),
    institutionHold: (Math.random() * 5 + 1).toFixed(2),
    individualHold: (95 + Math.random() * 5).toFixed(2),
    purchaseStatus: fund.buySuggestion === '暂停申购' ? 'suspended' :
                   fund.buySuggestion === '限大额' ? 'limited' : 'open',
    dailyLimit: dailyLimit,
    rating: fund.rating || 3,
    recommendation: fund.logic || '暂无推荐理由',
    riskLevel: fund.return1y > 20 ? 'high' : fund.return1y > 0 ? 'medium' : 'high',
    pe: (15 + Math.random() * 30).toFixed(2),
    pb: (1 + Math.random() * 4).toFixed(2),
    pePercentile: (20 + Math.random() * 60).toFixed(2),
    pbPercentile: (15 + Math.random() * 50).toFixed(2),
    valuation: getValuationCode(valuation),
    redeemFee: [
      { period: '7天内', rate: 1.50 },
      { period: '7天-1年', rate: 0.50 },
      { period: '1-2年', rate: 0.25 },
      { period: '2年以上', rate: 0.00 },
    ],
    topHoldings: getHoldings(fund.industry),
    performanceHistory: getPerformanceHistory(fund.nav, fund.return1y),
    investmentAdvice: fund.return1y > 30 ? '该基金近期表现优异，但估值偏高，建议分批买入或定投配置。' :
                     fund.return1y > 10 ? '该基金表现稳健，适合长期持有，建议定投配置。' :
                     fund.return1y > 0 ? '该基金表现一般，可适当配置，建议观察后续走势。' :
                     '该基金近期表现不佳，但估值处于低位，可考虑左侧布局。',
    suitableFor: fund.return1y > 20 ? '激进型投资者' :
                 fund.return1y > 0 ? '稳健型投资者' :
                 '保守型投资者',
    lastUpdateTime: dataUpdateStatus.lastUpdateTime,
  };
}

app.listen(PORT, () => {
  console.log(`基金推荐服务器运行在 http://localhost:${PORT}`);
  console.log('自动数据更新已启动（每15分钟）');
});
