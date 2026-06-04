/**
 * API 路由模块 — 基金数据、市场数据、工具、行业分析等
 */

const express = require('express');
const axios = require('axios');
const fundService = require('../fund-service.cjs');
const { authMiddleware } = require('../auth.cjs');
const { isTradingHours, isTradingDay, getMarketState } = require('../utils/trading-hours.cjs');
const { getCachedCapitalFlow } = require('../data-fetcher.cjs');

const router = express.Router();

// 默认市场指数配置
const defaultIndices = [
  { code: '000300', name: '沪深300', valuation: '合理偏低', suggestion: '适合定投' },
  { code: '000905', name: '中证500', valuation: '合理偏低', suggestion: '适合定投' },
  { code: '399006', name: '创业板指', valuation: '合理', suggestion: '适合小额定投' },
  { code: '000688', name: '科创50', valuation: '合理偏高', suggestion: '建议观望' },
  { code: '000001', name: '上证指数', valuation: '合理', suggestion: '适合定投' },
];

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取数据更新状态（需要从 index.cjs 传入 dataUpdateStatus）
function createStatusRoute(dataUpdateStatus) {
  router.get('/api/status', (req, res) => {
    const marketState = getMarketState();
    res.json({
      lastUpdateTime: dataUpdateStatus.lastUpdateTime,
      nextUpdateTime: dataUpdateStatus.nextUpdateTime,
      isUpdating: dataUpdateStatus.isUpdating,
      updateCount: dataUpdateStatus.updateCount,
      error: dataUpdateStatus.error ? '数据更新遇到错误' : null,
      isTrading: isTradingHours(),
      isTradingDay: isTradingDay(),
      marketState,
      updateInterval: isTradingHours() ? '15分钟' : '等待开盘',
    });
  });
}

// 手动触发数据更新（需要认证）
function createUpdateRoute(updateAllFundData) {
  router.post('/api/update', authMiddleware, async (req, res) => {
    if (req.app.locals.dataUpdateStatus?.isUpdating) {
      return res.json({ success: false, message: '数据更新正在进行中' });
    }
    updateAllFundData();
    res.json({ success: true, message: '数据更新已启动' });
  });
}

// 获取基金列表（支持分页）
router.get('/api/funds', async (req, res) => {
  try {
    const { industry, type, sort, order, search, page, pageSize } = req.query;
    const result = await fundService.getAllFundsWithNav({ industry, type, sort, order, search, page, pageSize });
    res.json(result);
  } catch (error) {
    console.error('获取基金列表失败:', error.message);
    res.status(500).json({ error: '获取基金列表失败' });
  }
});

// 获取QDII基金数据
router.get('/api/funds/qdii', async (req, res) => {
  try {
    const result = await fundService.getAllFundsWithNav({ type: 'QDII' });
    res.json(result.data || result);
  } catch (error) {
    console.error('获取QDII基金失败:', error.message);
    res.status(500).json({ error: '获取QDII基金失败' });
  }
});

// 获取沪深300基金
router.get('/api/funds/hs300', async (req, res) => {
  try {
    const result = await fundService.getAllFundsWithNav({ industry: '沪深300' });
    res.json(result.data || result);
  } catch (error) {
    console.error('获取沪深300基金失败:', error.message);
    res.status(500).json({ error: '获取沪深300基金失败' });
  }
});

// 获取基金详情
router.get('/api/funds/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }

    const result = await fundService.getAllFundsWithNav({ search: code });
    const funds = result.data || result;
    const fund = funds.find(f => f.code === code);

    if (!fund) {
      return res.status(404).json({ error: '基金不存在' });
    }

    const detail = generateFundDetail(fund);
    res.json(detail);
  } catch (error) {
    console.error('获取基金详情失败:', error.message);
    res.status(500).json({ error: '获取基金详情失败' });
  }
});

// 获取市场指数数据
router.get('/api/market/indices', async (req, res) => {
  try {
    let indices = await fundService.getMarketIndices();
    if (indices.length === 0) {
      await fundService.initMarketIndices(defaultIndices);
      indices = defaultIndices;
    }
    res.json({
      indices,
      lastUpdate: req.app.locals.dataUpdateStatus?.lastUpdateTime,
      isTrading: isTradingHours(),
    });
  } catch (error) {
    console.error('获取指数数据失败:', error.message);
    res.status(500).json({ error: '获取指数数据失败' });
  }
});

// 获取板块轮动数据
router.get('/api/market/sectors', async (req, res) => {
  try {
    const sectors = await fundService.getSectorData();
    res.json({
      sectors,
      lastUpdate: req.app.locals.dataUpdateStatus?.lastUpdateTime,
    });
  } catch (error) {
    console.error('获取板块数据失败:', error.message);
    res.status(500).json({ error: '获取板块数据失败' });
  }
});

// 获取资金流向
router.get('/api/market/capital-flow', (req, res) => {
  try {
    res.json(getCachedCapitalFlow());
  } catch (error) {
    res.status(500).json({ error: '获取资金流向失败' });
  }
});

// 获取行业推荐
router.get('/api/recommendations/industry', async (req, res) => {
  try {
    const result = await fundService.getAllFundsWithNav();
    const allFundsData = result.data || result;
    const recommendations = [
      {
        industry: '人工智能/AI', trend: '强势上涨', valuation: '合理偏高',
        buySuggestion: '优先配置', logic: 'AI算力+应用双轮驱动，年度核心主线',
        funds: allFundsData.filter(f => f.industry === '人工智能').slice(0, 3),
      },
      {
        industry: '半导体/芯片', trend: '震荡上行', valuation: '合理',
        buySuggestion: '优先配置', logic: '半导体国产替代+AI芯片需求爆发',
        funds: allFundsData.filter(f => f.industry === '半导体/芯片').slice(0, 3),
      },
      {
        industry: '纳斯达克100', trend: '强势上涨', valuation: '合理偏高',
        buySuggestion: '限大额配置', logic: '美股科技龙头，QDII额度紧张',
        funds: allFundsData.filter(f => f.industry === '纳斯达克100').slice(0, 3),
      },
      {
        industry: '医药', trend: '底部反弹', valuation: '极低',
        buySuggestion: '左侧布局', logic: '估值历史极低，长期配置价值凸显',
        funds: allFundsData.filter(f => f.industry === '医药').slice(0, 3),
      },
      {
        industry: '煤炭', trend: '震荡上行', valuation: '低估',
        buySuggestion: '分批建仓', logic: '高股息(5-8%)+低估值(PE 8-10倍)+供需偏紧，防御属性强',
        funds: allFundsData.filter(f => f.industry === '煤炭').slice(0, 3),
      },
      {
        industry: '陶瓷/建材', trend: '底部企稳', valuation: '低估',
        buySuggestion: '逢低布局', logic: '房地产政策优化+基建稳增长，建材需求触底反弹；陶瓷行业集中度提升，龙头企业受益',
        funds: allFundsData.filter(f => f.industry === '陶瓷/建材').slice(0, 3),
      },
      {
        industry: '证券', trend: '底部反弹', valuation: '低估',
        buySuggestion: '逢低布局', logic: '资本市场改革持续推进，券商行业整合加速；市场回暖带动交易量提升，券商盈利有望改善',
        funds: allFundsData.filter(f => f.industry === '证券').slice(0, 3),
      },
    ];
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: '获取推荐失败' });
  }
});

// 获取分批建仓方案
router.get('/api/recommendations/batch-plans', async (req, res) => {
  try {
    const plans = [
      { batch: 1, time: '本周', ratio: 40, funds: ['人工智能ETF联接A(013349)', '半导体芯片ETF联接A(008887)'], method: '一次性买入', reason: 'AI+半导体为年度核心主线，Q2涨幅领先' },
      { batch: 2, time: '下周', ratio: 30, funds: ['光伏ETF联接A(011102)', '新能源ETF联接A(012348)'], method: '定投或一次性买入', reason: '光伏/新能源底部反转，估值低估区间' },
      { batch: 3, time: '第三周', ratio: 20, funds: ['军工ETF联接A(013139)', '科技ETF联接A(007873)'], method: '定投', reason: '稳健配置型标的，分散风险' },
      { batch: 4, time: '第四周', ratio: 10, funds: ['银行ETF联接A(001594)', '煤炭ETF联接C(008280)'], method: '定投', reason: '银行+煤炭高股息防守，平衡组合风险' },
    ];
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: '获取建仓方案失败' });
  }
});

// 获取行业列表
router.get('/api/industries', async (req, res) => {
  try {
    const industries = await fundService.getIndustries();
    res.json(industries);
  } catch (error) {
    res.status(500).json({ error: '获取行业列表失败' });
  }
});

// 风险评估
router.post('/api/risk/profile', (req, res) => {
  try {
    const { age, investmentAmount, investmentPeriod, riskTolerance, lossTolerance } = req.body;
    if (!age || !investmentAmount || !investmentPeriod || !riskTolerance || !lossTolerance) {
      return res.status(400).json({ error: '请填写完整的风险评估信息' });
    }

    const ageScores = { '18-25岁': 4, '26-35岁': 3, '36-45岁': 2, '46-55岁': 1, '55岁以上': 0 };
    const amountScores = { '1万以下': 1, '1-5万': 2, '5-20万': 3, '20-50万': 4, '50万以上': 4 };
    const periodScores = { '3个月以内': 1, '3-6个月': 2, '6-12个月': 3, '1-3年': 4, '3年以上': 5 };
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
router.post('/api/tools/dca', (req, res) => {
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
        month: i + 1, investment: monthlyAmount, cumulativeInvestment,
        value: parseFloat(totalValue.toFixed(2)),
        return: parseFloat((totalValue - cumulativeInvestment).toFixed(2)),
      });
    }

    const totalProfit = totalValue - totalInvestment;
    const totalReturnPercent = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;
    const years = period / 12;
    const annualizedReturn = years > 0
      ? parseFloat((Math.pow(totalValue / totalInvestment, 1 / years) - 1) * 100)
      : 0;

    res.json({
      totalInvestment,
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalReturn: parseFloat(totalReturnPercent.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      monthlyDetails,
    });
  } catch (error) {
    res.status(500).json({ error: '计算失败' });
  }
});

// 基金对比
router.post('/api/tools/compare', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 20) {
      return res.status(400).json({ error: '基金代码列表无效' });
    }
    if (!codes.every(c => typeof c === 'string' && /^\d{6}$/.test(c))) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }

    const result = await fundService.getAllFundsWithNav();
    const allFundsData = result.data || result;
    const funds = codes
      .map(code => {
        try {
          const fund = allFundsData.find(f => f.code === code);
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

// 行业基金深度分析
router.get('/api/industry-analysis/:industry', async (req, res) => {
  try {
    const { industry } = req.params;
    const decodedIndustry = decodeURIComponent(industry);

    const industryMap = {
      '医药': { match: ['医药'], trend: '底部反弹', valuation: '极低', buySuggestion: '左侧布局', logic: '估值历史极低，长期配置价值凸显，集采政策边际缓和' },
      '人工智能': { match: ['人工智能'], trend: '强势上涨', valuation: '合理偏高', buySuggestion: '优先配置', logic: 'AI算力+应用双轮驱动，年度核心主线' },
      '半导体/芯片': { match: ['半导体/芯片'], trend: '震荡上行', valuation: '合理', buySuggestion: '优先配置', logic: '半导体国产替代+AI芯片需求爆发' },
      '证券': { match: ['证券'], trend: '底部反弹', valuation: '低估', buySuggestion: '逢低布局', logic: '资本市场改革持续推进，券商行业整合加速；市场回暖带动交易量提升，券商盈利有望改善' },
      '新能源': { match: ['新能源'], trend: '底部反弹', valuation: '低估', buySuggestion: '逢低布局', logic: '产能出清接近尾声，行业拐点将至' },
      '消费': { match: ['消费'], trend: '弱势', valuation: '偏低', buySuggestion: '等待企稳', logic: '消费复苏路径尚需验证' },
      '军工': { match: ['军工'], trend: '温和上涨', valuation: '合理', buySuggestion: '可配置', logic: '国防预算持续增长，装备放量期，八一建军节前主题催化' },
      '金融': { match: ['金融'], trend: '稳步上涨', valuation: '合理偏低', buySuggestion: '可配置', logic: '高股息+低估值，防守属性强' },
      '煤炭': { match: ['煤炭'], trend: '震荡上行', valuation: '低估', buySuggestion: '分批建仓', logic: '高股息(5-8%)+低估值(PE 8-10倍)+供需偏紧，防御属性强，冬季供暖和夏季用电旺季有支撑' },
      '陶瓷/建材': { match: ['陶瓷/建材'], trend: '底部企稳', valuation: '低估', buySuggestion: '逢低布局', logic: '房地产政策持续优化，基建投资稳增长，建材需求有望触底反弹；陶瓷行业集中度提升，龙头企业受益' },
      '电力': { match: ['电力'], trend: '季节性上涨', valuation: '合理偏低', buySuggestion: '夏季首选', logic: '夏季用电高峰(7-8月)确定性最强，全社会用电量创年度峰值，发电量/电价双升；高股息+防御属性，攻守兼备' },
      '水电': { match: ['水电'], trend: '丰水期上涨', valuation: '合理', buySuggestion: '丰水期配置', logic: '6-10月主汛期来水量增加，水电发电量提升；长江电力等龙头股息率约3-5%，丰水期业绩弹性最大' },
      '啤酒/饮料': { match: ['啤酒/饮料'], trend: '季节性上涨', valuation: '合理偏低', buySuggestion: '夏季旺季', logic: '夏季为啤酒消费绝对旺季，Q2-Q3营收占全年40%+；2026年有世界杯赛事催化，叠加油价下行降低运输成本' },
      '家电': { match: ['家电'], trend: '高温驱动', valuation: '合理偏低', buySuggestion: '高温驱动', logic: '7-8月空调销售/安装高峰，终端需求旺季；高温天气+地产后周期双重共振，白电龙头估值合理' },
    };

    const config = industryMap[decodedIndustry];
    if (!config) {
      console.log('[DEBUG] Industry not found:', decodedIndustry, 'Keys:', Object.keys(industryMap));
      return res.status(404).json({ error: '行业不存在' });
    }

    // 直接用数据库过滤，避免分页截断
    const allFundsData = [];
    for (const m of config.match) {
      const result = await fundService.getAllFundsWithNav({ industry: m, pageSize: 500 });
      const funds = result.data || result;
      allFundsData.push(...funds);
    }
    // 去重
    const seen = new Set();
    const industryFunds = allFundsData.filter(f => {
      if (seen.has(f.code)) return false;
      seen.add(f.code);
      return true;
    });

    const analysis = {
      industry: decodedIndustry,
      trend: config.trend, valuation: config.valuation,
      buySuggestion: config.buySuggestion, logic: config.logic,
      fundCount: industryFunds.length,
      funds: industryFunds.map(f => ({
        code: f.code, name: f.name, type: f.type, index: f.index,
        nav: f.nav, return1y: f.return1y, return6m: f.return6m,
        return3m: f.return3m, return1m: f.return1m, return1w: f.return1w,
        managementFee: f.managementFee, custodyFee: f.custodyFee,
        serviceFee: f.serviceFee || 0, totalFee: f.totalFee,
        purchaseFee: f.managementFee <= 0.5 ? '0.05%' : '0.12%',
        redeemFee: f.type === 'QDII' ? '0.50%' : '0.00%',
        dailyLimit: f.dailyLimit || 0, scale: f.scale, rating: f.rating,
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

// 沪深300指数基金深度分析
router.get('/api/hs300/analysis', async (req, res) => {
  try {
    let indexValuation = {
      name: '沪深300', code: '000300',
      pe: 12.5, pb: 1.3, pePercentile: 42, pbPercentile: 32,
      valuation: '合理偏低', suggestion: '适合定投',
      roe: 10.4, dividendYield: 2.8,
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
    } catch (e) { /* 使用默认估值数据 */ }

    const result = await fundService.getAllFundsWithNav();
    const allFundsData = result.data || result;

    let hs300DetailsMap = {};
    try {
      const details = await fundService.getHS300FundDetails();
      details.forEach(d => { hs300DetailsMap[d.code] = d; });
    } catch (e) {
      console.warn('[HS300] 获取基金详情失败，使用默认值:', e.message);
    }

    const hs300Funds = allFundsData.filter(f => f.industry === '沪深300').map(f => {
      const detail = hs300DetailsMap[f.code] || {};
      return {
        code: f.code, name: f.name, type: f.type,
        managementFee: f.managementFee, custodyFee: f.custodyFee,
        totalFee: f.totalFee, scale: f.scale,
        return1y: f.return1y, return6m: f.return6m, return3m: f.return3m,
        return1m: f.return1m, return1w: f.return1w,
        purchaseStatus: f.buySuggestion === '暂停申购' ? 'suspended' : f.buySuggestion === '限大额' ? 'limited' : 'open',
        dailyLimit: f.dailyLimit || 0, rating: f.rating,
        isETF: f.type === 'ETF',
        isEnhanced: detail.isEnhanced || f.type === '指数增强',
        purchaseFee: detail.purchaseFee || (f.managementFee <= 0.2 ? 0.12 : 0.15),
        purchaseFeeOriginal: detail.purchaseFeeOriginal || (f.managementFee <= 0.2 ? 1.20 : 1.50),
        alpha: detail.alpha || 0,
      };
    });

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

    const analysis = {
      valuation: indexValuation,
      funds: hs300Funds,
      topHoldings,
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

// 基于基金代码生成确定性随机数
function seededRandom(code, seed) {
  let hash = 0;
  const str = code + seed.toString();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

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
        { name: '科大讯飞', percentage: 12.5 }, { name: '海康威视', percentage: 9.8 },
        { name: '中际旭创', percentage: 8.2 }, { name: '工业富联', percentage: 7.5 },
        { name: '寒武纪', percentage: 6.8 }, { name: '紫光股份', percentage: 5.2 },
        { name: '中科曙光', percentage: 4.8 }, { name: '浪潮信息', percentage: 4.5 },
        { name: '用友网络', percentage: 3.8 }, { name: '金山办公', percentage: 3.2 },
      ],
      '半导体/芯片': [
        { name: '北方华创', percentage: 11.2 }, { name: '中芯国际', percentage: 10.5 },
        { name: '韦尔股份', percentage: 8.8 }, { name: '兆易创新', percentage: 7.2 },
        { name: '卓胜微', percentage: 6.5 }, { name: '圣邦股份', percentage: 5.8 },
        { name: '中微公司', percentage: 5.2 }, { name: '长电科技', percentage: 4.5 },
        { name: '华虹半导体', percentage: 4.2 }, { name: '紫光国微', percentage: 3.8 },
      ],
      '纳斯达克100': [
        { name: '苹果 (AAPL)', percentage: 12.8 }, { name: '微软 (MSFT)', percentage: 11.5 },
        { name: '英伟达 (NVDA)', percentage: 8.5 }, { name: '亚马逊 (AMZN)', percentage: 7.2 },
        { name: 'Meta (META)', percentage: 5.8 }, { name: '谷歌 (GOOGL)', percentage: 5.5 },
        { name: '特斯拉 (TSLA)', percentage: 4.2 }, { name: '博通 (AVGO)', percentage: 3.8 },
        { name: '奈飞 (NFLX)', percentage: 3.2 }, { name: 'AMD (AMD)', percentage: 2.8 },
      ],
      '医药': [
        { name: '恒瑞医药', percentage: 10.5 }, { name: '药明康德', percentage: 9.2 },
        { name: '迈瑞医疗', percentage: 8.5 }, { name: '片仔癀', percentage: 7.2 },
        { name: '爱尔眼科', percentage: 6.5 }, { name: '智飞生物', percentage: 5.8 },
        { name: '长春高新', percentage: 5.2 }, { name: '沃森生物', percentage: 4.5 },
        { name: '通策医疗', percentage: 3.8 }, { name: '华大基因', percentage: 3.2 },
      ],
      '新能源': [
        { name: '宁德时代', percentage: 15.2 }, { name: '比亚迪', percentage: 12.5 },
        { name: '隆基绿能', percentage: 8.8 }, { name: '阳光电源', percentage: 7.2 },
        { name: '通威股份', percentage: 6.5 }, { name: '亿纬锂能', percentage: 5.8 },
        { name: '赣锋锂业', percentage: 5.2 }, { name: '天齐锂业', percentage: 4.5 },
        { name: '璞泰来', percentage: 3.8 }, { name: '恩捷股份', percentage: 3.2 },
      ],
      '消费': [
        { name: '贵州茅台', percentage: 15.5 }, { name: '五粮液', percentage: 10.2 },
        { name: '山西汾酒', percentage: 8.5 }, { name: '泸州老窖', percentage: 7.2 },
        { name: '海天味业', percentage: 6.5 }, { name: '伊利股份', percentage: 5.8 },
        { name: '洋河股份', percentage: 5.2 }, { name: '古井贡酒', percentage: 4.5 },
        { name: '今世缘', percentage: 3.8 }, { name: '舍得酒业', percentage: 3.2 },
      ],
      '陶瓷/建材': [
        { name: '海螺水泥', percentage: 15.2 }, { name: '东方雨虹', percentage: 8.5 },
        { name: '北新建材', percentage: 7.8 }, { name: '旗滨集团', percentage: 6.5 },
        { name: '蒙娜丽莎', percentage: 5.8 }, { name: '东鹏控股', percentage: 5.2 },
        { name: '帝欧家居', percentage: 4.5 }, { name: '伟星新材', percentage: 4.2 },
        { name: '华新水泥', percentage: 3.8 }, { name: '冀东水泥', percentage: 3.5 },
      ],
      '证券': [
        { name: '中信证券', percentage: 12.8 }, { name: '东方财富', percentage: 10.5 },
        { name: '华泰证券', percentage: 8.2 }, { name: '国泰君安', percentage: 7.5 },
        { name: '海通证券', percentage: 6.8 }, { name: '招商证券', percentage: 5.5 },
        { name: '中金公司', percentage: 4.8 }, { name: '申万宏源', percentage: 4.2 },
        { name: '广发证券', percentage: 3.8 }, { name: '兴业证券', percentage: 3.5 },
      ],
    };

    return holdingsMap[industry] || [
      { name: '重仓股1', percentage: 12.5 }, { name: '重仓股2', percentage: 9.8 },
      { name: '重仓股3', percentage: 8.2 }, { name: '重仓股4', percentage: 6.5 },
      { name: '重仓股5', percentage: 5.8 },
    ];
  };

  const getPerformanceHistory = (nav, return1y, code) => {
    const monthlyReturn = return1y / 12;
    const history = [];
    let currentNav = nav * 0.92;

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthReturn = monthlyReturn + (seededRandom(code, 7 + i) - 0.5) * 4;
      currentNav = currentNav * (1 + monthReturn / 100);
      history.push({
        date: monthStr,
        nav: parseFloat(currentNav.toFixed(4)),
        return: parseFloat(monthReturn.toFixed(2)),
      });
    }
    return history;
  };

  const valuation = fund.valuation || getValuation(fund.return1y || 0);
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
    share: ((fund.scale || 0) * 0.8).toFixed(2),
    shareChange: (seededRandom(fund.code, 0) * 10 - 2).toFixed(2),
    institutionHold: (seededRandom(fund.code, 1) * 5 + 1).toFixed(2),
    individualHold: (95 + seededRandom(fund.code, 2) * 5).toFixed(2),
    purchaseStatus: fund.buySuggestion === '暂停申购' ? 'suspended' :
                   fund.buySuggestion === '限大额' ? 'limited' : 'open',
    dailyLimit: dailyLimit,
    rating: fund.rating || 3,
    recommendation: fund.logic || '暂无推荐理由',
    riskLevel: (fund.return1y || 0) > 20 ? 'high' : (fund.return1y || 0) > 0 ? 'medium' : 'high',
    pe: (15 + seededRandom(fund.code, 3) * 30).toFixed(2),
    pb: (1 + seededRandom(fund.code, 4) * 4).toFixed(2),
    pePercentile: (20 + seededRandom(fund.code, 5) * 60).toFixed(2),
    pbPercentile: (15 + seededRandom(fund.code, 6) * 50).toFixed(2),
    valuation: getValuationCode(valuation),
    redeemFee: [
      { period: '7天内', rate: 1.50 },
      { period: '7天-1年', rate: 0.50 },
      { period: '1-2年', rate: 0.25 },
      { period: '2年以上', rate: 0.00 },
    ],
    topHoldings: getHoldings(fund.industry),
    performanceHistory: getPerformanceHistory(fund.nav || 1, fund.return1y || 0, fund.code),
    investmentAdvice: (fund.return1y || 0) > 30 ? '该基金近期表现优异，但估值偏高，建议分批买入或定投配置。' :
                     (fund.return1y || 0) > 10 ? '该基金表现稳健，适合长期持有，建议定投配置。' :
                     (fund.return1y || 0) > 0 ? '该基金表现一般，可适当配置，建议观察后续走势。' :
                     '该基金近期表现不佳，但估值处于低位，可考虑左侧布局。',
    suitableFor: (fund.return1y || 0) > 20 ? '激进型投资者' :
                 (fund.return1y || 0) > 0 ? '稳健型投资者' :
                 '保守型投资者',
  };
}

module.exports = { router, createStatusRoute, createUpdateRoute };
