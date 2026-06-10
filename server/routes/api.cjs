/**
 * API 路由模块 — 基金数据、市场数据、工具、行业分析等
 */

const express = require('express');
const fundService = require('../fund-service.cjs');
const { authMiddleware, adminMiddleware } = require('../auth.cjs');
const { getPool } = require('../db.cjs');
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

// 手动触发数据更新（需要管理员权限）
function createUpdateRoute(updateAllFundData) {
  router.post('/api/update', authMiddleware, adminMiddleware, async (req, res) => {
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
    const industryConfigs = [
      { industry: '人工智能/AI', match: '人工智能', trend: '强势上涨', valuation: '合理偏高', buySuggestion: '优先配置', logic: 'AI算力+应用双轮驱动，年度核心主线' },
      { industry: '半导体/芯片', match: '半导体/芯片', trend: '震荡上行', valuation: '合理', buySuggestion: '优先配置', logic: '半导体国产替代+AI芯片需求爆发' },
      { industry: '纳斯达克100', match: '纳斯达克100', trend: '强势上涨', valuation: '合理偏高', buySuggestion: '限大额配置', logic: '美股科技龙头，QDII额度紧张' },
      { industry: '医药', match: '医药', trend: '底部反弹', valuation: '极低', buySuggestion: '左侧布局', logic: '估值历史极低，长期配置价值凸显' },
      { industry: '煤炭', match: '煤炭', trend: '震荡上行', valuation: '低估', buySuggestion: '分批建仓', logic: '高股息(5-8%)+低估值(PE 8-10倍)+供需偏紧，防御属性强' },
      { industry: '陶瓷/建材', match: '陶瓷/建材', trend: '底部企稳', valuation: '低估', buySuggestion: '逢低布局', logic: '房地产政策优化+基建稳增长，建材需求触底反弹；陶瓷行业集中度提升，龙头企业受益' },
      { industry: '证券', match: '证券', trend: '底部反弹', valuation: '低估', buySuggestion: '逢低布局', logic: '资本市场改革持续推进，券商行业整合加速；市场回暖带动交易量提升，券商盈利有望改善' },
    ];

    const recommendations = await Promise.all(
      industryConfigs.map(async (cfg) => {
        const result = await fundService.getAllFundsWithNav({ industry: cfg.match, pageSize: 3 });
        return {
          industry: cfg.industry, trend: cfg.trend, valuation: cfg.valuation,
          buySuggestion: cfg.buySuggestion, logic: cfg.logic,
          funds: (result.data || result).slice(0, 3),
        };
      })
    );
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

// 获取基金经理列表
router.get('/api/managers', async (req, res) => {
  try {
    const managers = await fundService.getManagers();
    res.json(managers);
  } catch (error) {
    res.status(500).json({ error: '获取基金经理列表失败' });
  }
});

// 获取明星基金经理详情
router.get('/api/star-managers', (req, res) => {
  try {
    const { starManagers } = require('../fund-data.cjs');
    res.json(starManagers);
  } catch (error) {
    res.status(500).json({ error: '获取明星基金经理详情失败' });
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

    res.json({ type, description, allocation, expectedReturn, riskLevel, score });
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
        return: parseFloat((((totalValue - cumulativeInvestment) / cumulativeInvestment) * 100).toFixed(2)),
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

    const funds = [];
    for (const code of codes) {
      const result = await fundService.getAllFundsWithNav({ search: code, pageSize: 5 });
      const list = result.data || result;
      const fund = list.find(f => f.code === code);
      if (fund) funds.push(generateFundDetail(fund));
    }

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
      '陶瓷/建材': {
        match: ['陶瓷/建材'], trend: '底部企稳', valuation: '低估', buySuggestion: '逢低布局',
        logic: '房地产政策持续优化，基建投资稳增长，建材需求有望触底反弹；陶瓷行业集中度提升，龙头企业受益',
        tradingVolumeAnalysis: {
          summary: '陶瓷/建材板块近期交易量显著放大，主要受政策预期、估值修复、板块轮动等多重因素驱动',
          reasons: [
            { title: '政策敏感度高', detail: '房地产政策（限购放松、房贷利率下调、城中村改造）和基建投资（专项债加速发行）频繁出台，市场预期差大，多空博弈激烈', impact: 'high' },
            { title: '估值处于历史低位', detail: '中证全指建筑材料指数PE约12倍，PB约1.1倍，均处于近5年10%以下分位，吸引左侧布局资金持续流入', impact: 'high' },
            { title: '板块轮动效应', detail: '当AI、半导体等热门板块高位震荡时，资金向低估值周期板块切换，建材作为价值洼地成为轮动目标', impact: 'medium' },
            { title: '先进陶瓷概念叠加', detail: '陶瓷行业同时受益于"建材复苏"和"新材料/高端制造"两条主线，先进陶瓷用于半导体、新能源、5G等高科技领域，吸引不同类型的投资者', impact: 'medium' },
            { title: '基金规模小易放大', detail: '建材ETF规模普遍在5-12亿，相比百亿级宽基ETF更容易被资金进出放大波动和交易量', impact: 'low' },
          ],
        },
        customBatchPlan: [
          { batch: 1, time: '立即', percentage: 25, targets: '建材ETF联接C (013020)', method: '支付宝申购C类免申购费', reason: '当前建材板块估值处历史低位，先建底仓，C类灵活调仓' },
          { batch: 2, time: '2周后', percentage: 25, targets: '建材ETF联接C (013020) 或 建材ETF富国 (516750)', method: '支付宝定投或手动买入', reason: '观察房地产销售数据和基建投资进度，确认趋势' },
          { batch: 3, time: '1个月后', percentage: 25, targets: '建材ETF联接A (013019)', method: '支付宝申购A类', reason: '趋势确认后切换A类降低长期费率，A类持有>=1年免赎回费' },
          { batch: 4, time: '2个月后', percentage: 25, targets: '表现最优基金', method: '加仓或调仓', reason: '根据实际表现调整，可搭配广发建材指数A (004856)分散风险' },
        ],
        customRiskWarning: '1. 基金有风险，投资需谨慎。以上推荐基于数据分析，不构成投资建议。\n2. 陶瓷/建材板块属于强周期行业，与房地产和基建高度关联，受政策影响极大。\n3. 最大风险：房地产复苏不及预期、原材料（天然气、高岭土）成本上升压缩利润。\n4. 建材板块波动大，建议占总仓位的5-10%，不超过15%。\n5. 止盈线建议设在20-25%，止损线-15%。\n6. 建议以定投为主，避免一次性大额买入。\n7. 关注先进陶瓷（半导体/新能源用）概念的长期增长逻辑。',
        investmentAdvice: {
          shortTerm: '未来1-3个月：观望为主，交易量大但方向不明，不宜追高。关注房地产销售数据和政策信号。',
          mediumTerm: '未来3-12个月：可小仓位配置，作为周期轮动的品种。推荐C类基金先建底仓，趋势确认后切换A类降低费率。',
          longTerm: '未来1年以上：建材板块适合定投而非一次性买入。先进陶瓷（半导体/新能源领域）具有长期增长潜力。',
          targetAllocation: '建议占总仓位的5-10%，不超过15%',
          stopProfit: '20-25%',
          stopLoss: '-15%',
        },
      },
      '电力': { match: ['电力'], trend: '季节性上涨', valuation: '合理偏低', buySuggestion: '夏季首选', logic: '夏季用电高峰(7-8月)确定性最强，全社会用电量创年度峰值，发电量/电价双升；高股息+防御属性，攻守兼备' },
      '水电': { match: ['水电'], trend: '丰水期上涨', valuation: '合理', buySuggestion: '丰水期配置', logic: '6-10月主汛期来水量增加，水电发电量提升；长江电力等龙头股息率约3-5%，丰水期业绩弹性最大' },
      '啤酒/饮料': { match: ['啤酒/饮料'], trend: '季节性上涨', valuation: '合理偏低', buySuggestion: '夏季旺季', logic: '夏季为啤酒消费绝对旺季，Q2-Q3营收占全年40%+；2026年有世界杯赛事催化，叠加油价下行降低运输成本' },
      '家电': { match: ['家电'], trend: '高温驱动', valuation: '合理偏低', buySuggestion: '高温驱动', logic: '7-8月空调销售/安装高峰，终端需求旺季；高温天气+地产后周期双重共振，白电龙头估值合理' },
      '酒店旅游': {
        match: ['酒店旅游'], trend: '季节性上涨', valuation: '低估', buySuggestion: '逢低布局',
        logic: '毕业季+暑假双轮驱动，6-9月为旅游出行绝对旺季；2026年暑期旅游预订量同比+20%以上，酒店RevPAR持续修复；中证旅游主题指数PE处于近3年20%分位，估值性价比突出',
        tradingVolumeAnalysis: {
          summary: '酒店旅游板块近期交易量温和放大，毕业季+暑假旺季预期带动资金提前布局',
          reasons: [
            { title: '暑期旅游旺季来临', detail: '6-9月为旅游出行绝对旺季，大学生毕业旅行+中小学生暑假双重驱动，携程/飞猪数据显示暑期旅游预订量同比+20%以上', impact: 'high' },
            { title: '酒店RevPAR持续修复', detail: '国内酒店入住率和平均房价持续回升，华住/锦江/首旅等龙头Q1业绩超预期，RevPAR同比+5-8%', impact: 'high' },
            { title: '估值处于历史低位', detail: '中证旅游主题指数PE约25倍，处于近3年20%分位以下，安全边际较高', impact: 'medium' },
            { title: '政策利好', detail: '各地促消费政策持续出台，签证便利化、景区门票减免等措施提振旅游需求', impact: 'medium' },
          ],
        },
        customBatchPlan: [
          { batch: 1, time: '立即', percentage: 30, targets: '旅游ETF富国 (159766) 或 旅游ETF华夏 (562510)', method: '支付宝/券商买入ETF', reason: '当前估值低位，先建底仓，毕业季+暑假旺季即将启动' },
          { batch: 2, time: '2周后', percentage: 25, targets: '旅游ETF富国 (159766)', method: '支付宝定投或手动买入', reason: '观察暑期旅游数据和酒店入住率，确认旺季趋势' },
          { batch: 3, time: '1个月后', percentage: 25, targets: '旅游ETF华夏 (562510)', method: '手动买入', reason: '分散持仓，两个ETF跟踪同一指数但成分权重略有差异' },
          { batch: 4, time: '旺季中期(8月)', percentage: 20, targets: '表现最优基金', method: '加仓或止盈调仓', reason: '根据实际表现调整，旺季末期可逐步止盈' },
        ],
        customRiskWarning: '1. 基金有风险，投资需谨慎。以上推荐基于数据分析，不构成投资建议。\n2. 酒店旅游板块季节性强，旺季(6-9月)过后可能面临回调压力。\n3. 最大风险：暑期旅游数据不及预期、极端天气影响出行、宏观经济下行压制消费。\n4. 旅游板块波动较大，建议占总仓位的5-10%，不超过15%。\n5. 止盈线建议设在15-20%，止损线-12%。\n6. 旺季末期(9月后)建议逐步减仓，避免季节性回调。',
        investmentAdvice: {
          shortTerm: '未来1-3个月：毕业季+暑假旺季，可积极配置。关注暑期旅游预订数据和酒店入住率。',
          mediumTerm: '未来3-12个月：旺季(6-9月)持有，旺季末期(9-10月)逐步止盈。淡季可小仓位观望。',
          longTerm: '未来1年以上：旅游行业长期受益于消费升级和人均可支配收入增长，但季节性波动大，适合波段操作而非长期持有。',
          targetAllocation: '建议占总仓位的5-10%，不超过15%',
          stopProfit: '15-20%',
          stopLoss: '-12%',
        },
      },
    };

    const config = industryMap[decodedIndustry];
    if (!config) {
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
      batchPlan: config.customBatchPlan || [
        { batch: 1, time: '立即', percentage: 30, targets: `${decodedIndustry}C类基金`, method: '支付宝申购C类免申购费', reason: `当前${decodedIndustry}板块估值处历史低位，先建底仓` },
        { batch: 2, time: '1个月后', percentage: 30, targets: `${decodedIndustry}C类基金`, method: '支付宝定投或手动买入', reason: '观察走势确认趋势，C类灵活调仓' },
        { batch: 3, time: '2个月后', percentage: 20, targets: `${decodedIndustry}C类基金`, method: '支付宝申购', reason: '分散持仓降低单一基金风险' },
        { batch: 4, time: '3个月后', percentage: 20, targets: '表现最优基金', method: '切换为A类降低长期费率', reason: '加仓表现最好的基金' },
      ],
      riskWarning: config.customRiskWarning || `1. 基金有风险，投资需谨慎。以上推荐基于数据分析，不构成投资建议。\n2. ${decodedIndustry}行业受政策影响较大，请关注相关行业政策动态。\n3. 历史收益不代表未来表现，请根据个人风险承受能力合理配置。\n4. 建议定投为主，分散投资，避免一次性大额买入。`,
      tradingVolumeAnalysis: config.tradingVolumeAnalysis || null,
      investmentAdvice: config.investmentAdvice || null,
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
      pe: 14.39, pb: 1.44, pePercentile: 87.8, pbPercentile: 44.4,
      valuation: '偏高', suggestion: '建议定投，避免一次性重仓',
      roe: 10.0, dividendYield: 2.8,
    };

    // 从数据库读取沪深300估值数据
    try {
      const dbIndices = await fundService.getMarketIndices();
      const hs300Idx = dbIndices.find(i => i.code === '000300');
      if (hs300Idx) {
        if (hs300Idx.pe) indexValuation.pe = hs300Idx.pe;
        if (hs300Idx.pb) indexValuation.pb = hs300Idx.pb;
        if (hs300Idx.pePercentile) indexValuation.pePercentile = hs300Idx.pePercentile;
        if (hs300Idx.pbPercentile) indexValuation.pbPercentile = hs300Idx.pbPercentile;
        if (hs300Idx.valuation) indexValuation.valuation = hs300Idx.valuation;
        if (hs300Idx.suggestion) indexValuation.suggestion = hs300Idx.suggestion;
      }
    } catch (e) { /* 使用默认估值数据 */ }

    const hs300Result = await fundService.getAllFundsWithNav({ industry: '沪深300', pageSize: 500 });
    const hs300Data = hs300Result.data || hs300Result;

    let hs300DetailsMap = {};
    try {
      const details = await fundService.getHS300FundDetails();
      details.forEach(d => { hs300DetailsMap[d.code] = d; });
    } catch (e) {
      console.warn('[HS300] 获取基金详情失败，使用默认值:', e.message);
    }

    const hs300Funds = hs300Data.map(f => {
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
        summary: '沪深300当前PE 14.39x，历史分位87.8%偏高，PB 1.44x分位44.4%适中。近1年收益+21.67%，近3月仅+1.14%，短期回调明显。建议以定投为主，避免一次性重仓。',
        bullFactors: [
          'PB分位44.4%仍处合理区间，净资产质量稳健，ROE 10%',
          '近1年收益+21.67%，中长期趋势向好，经济基本面改善',
          '股息率2.8%，高股息权重股提供安全垫',
          '政策面积极，降准降息预期，流动性宽松',
          '权重股基本面稳健，宁德时代/比亚迪业绩增长强劲',
        ],
        bearFactors: [
          'PE分位87.8%偏高，短期估值压力较大',
          '近1月-3.25%回调，市场情绪偏谨慎',
          '中美贸易摩擦不确定性，关税政策可能反复',
          '房地产行业仍在底部，拖累相关权重股',
          '美联储降息节奏不确定，可能影响全球流动性',
        ],
        strategy: {
          shortTerm: '未来3个月预期收益-2%~+5%，建议定投为主，分3-4批建仓，每次20-30%',
          mediumTerm: '未来6个月预期收益+3%~+12%，适合定投+逢低加仓，等待PE分位回落',
          longTerm: '未来1年预期收益+8%~+20%，核心配置品种，长期持有',
        },
        bestPicks: [
          { code: '010736', name: '东方红沪深300指数增强A', reason: '近1年+68.27%，超额收益+46.60%，增强效果最佳（注意风格偏离风险）' },
          { code: '004788', name: '富荣沪深300指数增强A', reason: '近1年+42.08%，超额收益+20.41%，费率仅0.70%，性价比高' },
          { code: '005113', name: '平安沪深300指数量化增强A', reason: '近1年+41.11%，超额收益+19.44%，量化增强稳定' },
          { code: '110020', name: '易方达沪深300ETF联接A', reason: '费率最低0.20%，规模167亿，纯跟踪误差小，金选基金' },
          { code: '000051', name: '华夏沪深300ETF联接A', reason: '费率0.20%，规模248亿最大，流动性好，金选基金' },
          { code: '100038', name: '富国沪深300指数增强A', reason: '规模46亿最大增强基金，超额收益+5.31%稳定，金选基金' },
        ],
      },
    };

    res.json(analysis);
  } catch (error) {
    console.error('沪深300分析数据获取失败:', error.message);
    res.status(500).json({ error: '获取沪深300分析数据失败' });
  }
});

// 标普500指数基金深度分析
router.get('/api/sp500/analysis', async (req, res) => {
  try {
    // 标普500指数当前估值（基于历史数据）
    const indexValuation = {
      name: '标普500', code: 'SPX',
      pe: 23.5, pb: 4.8, pePercentile: 72, pbPercentile: 68,
      valuation: '偏高估', suggestion: '小额定投',
      roe: 20.4, dividendYield: 1.3,
      currentPrice: 5350,
    };

    const sp500Result = await fundService.getAllFundsWithNav({ industry: '标普500', pageSize: 500 });
    const sp500Data = sp500Result.data || sp500Result;

    const sp500Funds = sp500Data.map(f => ({
      code: f.code, name: f.name, type: f.type,
      managementFee: f.managementFee, custodyFee: f.custodyFee,
      totalFee: f.totalFee, scale: f.scale,
      return1y: f.return1y, return6m: f.return6m, return3m: f.return3m,
      return1m: f.return1m, return1w: f.return1w,
      purchaseStatus: f.buySuggestion === '暂停申购' ? 'suspended' : f.buySuggestion === '限大额' ? 'limited' : 'open',
      dailyLimit: f.dailyLimit || 0, rating: f.rating,
      isGoldSelected: f.isGoldSelected || false,
      buySuggestion: f.buySuggestion,
    }));

    const topHoldings = [
      { name: '苹果', code: 'AAPL', weight: 7.2, industry: '科技', pe: 32.5, roe: 172, revenueGrowth: 8.5, epsGrowth: 12.3, analystConsensus: '买入', outlook: 'AI生态持续扩展，服务收入高增' },
      { name: '微软', code: 'MSFT', weight: 6.8, industry: '科技', pe: 35.2, roe: 38.5, revenueGrowth: 16.2, epsGrowth: 18.5, analystConsensus: '强烈买入', outlook: 'Azure云+AI双轮驱动，Copilot商业化加速' },
      { name: '英伟达', code: 'NVDA', weight: 6.1, industry: '半导体', pe: 45.8, roe: 115, revenueGrowth: 122, epsGrowth: 145, analystConsensus: '强烈买入', outlook: 'AI芯片垄断地位，数据中心需求持续爆发' },
      { name: '亚马逊', code: 'AMZN', weight: 3.8, industry: '消费/科技', pe: 42.1, roe: 22.5, revenueGrowth: 12.8, epsGrowth: 35.2, analystConsensus: '买入', outlook: 'AWS云+电商+广告三大引擎' },
      { name: 'Meta', code: 'META', weight: 2.5, industry: '科技', pe: 25.8, roe: 32.1, revenueGrowth: 22.5, epsGrowth: 35.8, analystConsensus: '买入', outlook: '广告收入强劲，AI投入产出比提升' },
      { name: '谷歌', code: 'GOOGL', weight: 3.9, industry: '科技', pe: 24.2, roe: 29.5, revenueGrowth: 14.5, epsGrowth: 22.8, analystConsensus: '买入', outlook: '搜索+云+AI三线并进' },
      { name: '伯克希尔', code: 'BRK.B', weight: 1.8, industry: '金融', pe: 10.5, roe: 12.8, revenueGrowth: 5.2, epsGrowth: 8.5, analystConsensus: '持有', outlook: '现金储备创新高，等待投资机会' },
      { name: '礼来', code: 'LLY', weight: 1.5, industry: '医药', pe: 58.2, roe: 52.5, revenueGrowth: 32.5, epsGrowth: 45.2, analystConsensus: '买入', outlook: '减肥药Mounjaro/Zepbound销售超预期' },
      { name: '摩根大通', code: 'JPM', weight: 1.3, industry: '银行', pe: 12.8, roe: 17.5, revenueGrowth: 18.5, epsGrowth: 22.3, analystConsensus: '买入', outlook: '利率环境有利，投行业务复苏' },
      { name: 'Visa', code: 'V', weight: 1.2, industry: '支付', pe: 30.5, roe: 48.2, revenueGrowth: 10.2, epsGrowth: 14.5, analystConsensus: '买入', outlook: '全球支付网络龙头，跨境交易恢复' },
    ];

    const analysis = {
      valuation: indexValuation,
      funds: sp500Funds,
      topHoldings,
      recommendation: {
        summary: '标普500当前PE约23.5x，处于历史偏高位置（72%分位），但科技巨头盈利强劲支撑估值。近1年收益约+19%，受益于AI革命和美国经济韧性。支付宝可投标普500基金共14只（7组A/C份额），国泰017028每日限额1万元最为宽松，摩根017641费率最低0.65%。',
        bullFactors: [
          'AI革命驱动科技巨头盈利超预期，英伟达/微软/谷歌业绩持续高增',
          '美国经济韧性强劲，就业市场稳健，消费支出持续增长',
          '美联储降息预期升温，有利于估值扩张',
          '标普500成分股质量高，ROE中位数约20%，盈利增长确定性强',
          '全球化配置需求增加，分散A股单一市场风险',
        ],
        bearFactors: [
          '估值处于历史偏高位置（PE 72%分位），回调风险存在',
          'QDII额度紧张，多数基金限大额（10-100元/日），买入难度大',
          '中美关系不确定性，可能影响中概股和贸易相关板块',
          '美联储降息节奏不确定，若延迟可能引发市场波动',
          '地缘政治风险（俄乌、中东）可能冲击全球市场',
        ],
        strategy: {
          shortTerm: '未来3个月预期收益+2%~+8%，估值偏高建议小额定投，避免一次性重仓',
          mediumTerm: '未来6个月预期收益+5%~+15%，关注QDII额度恢复，逢回调加仓',
          longTerm: '未来1年预期收益+8%~+20%，核心配置品种，长期持有分享美国科技红利',
        },
        bestPicks: [
          { code: '017028', name: '国泰标普500ETF联接A', reason: '每日限额10000元最宽松!费率0.75%合理，可大额买入建仓' },
          { code: '017641', name: '摩根标普500指数A', reason: '费率0.65%最低，规模36.62亿，近1年+19.2%，收益率最高之一' },
          { code: '050025', name: '博时标普500ETF联接A', reason: '规模59.27亿最大，流动性最好，成立时间长（2012年），跟踪误差小' },
          { code: '018064', name: '华夏标普500ETF联接A', reason: '费率0.75%适中，华夏品牌，近1年+18.75%' },
        ],
        batchPlan: [
          { batch: 1, time: '本周', pct: 25, action: '首批25%，优选国泰017028（限额10000元/日，额度最充足）', reason: '当前可买入额度最大，先建底仓' },
          { batch: 2, time: '2-3周后', pct: 25, action: '第二批25%，搭配摩根017641（费率最低0.65%）', reason: '分散基金公司风险，降低综合费率' },
          { batch: 3, time: '1个月后', pct: 25, action: '第三批25%，博时050025（规模最大59亿）', reason: '持续摊薄成本，选流动性最佳' },
          { batch: 4, time: '2个月后', pct: 25, action: '最后25%，机动资金', reason: '预留资金应对意外下跌或QDII额度恢复后加仓' },
        ],
      },
    };

    res.json(analysis);
  } catch (error) {
    console.error('标普500分析数据获取失败:', error.message);
    res.status(500).json({ error: '获取标普500分析数据失败' });
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

// ========== 自选基金 API ==========

// 获取自选列表
router.get('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT w.*, f.name as fund_name_db, f.type, f.industry, f.total_fee, f.scale, f.rating,
              n.nav, n.return_1y, n.return_6m, n.return_3m, n.return_1m, n.return_1w
       FROM watchlist w
       LEFT JOIN funds f ON w.fund_code = f.code
       LEFT JOIN LATERAL (
         SELECT nav, return_1y, return_6m, return_3m, return_1m, return_1w
         FROM fund_nav WHERE fund_code = w.fund_code ORDER BY nav_date DESC LIMIT 1
       ) n ON true
       WHERE w.user_id = $1
       ORDER BY w.sort_order, w.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      fund_code: r.fund_code,
      fund_name: r.fund_name || r.fund_name_db || '',
      group_name: r.group_name,
      notes: r.notes,
      created_at: r.created_at,
      type: r.type,
      industry: r.industry,
      total_fee: r.total_fee ? parseFloat(r.total_fee) : null,
      scale: r.scale ? parseFloat(r.scale) : null,
      rating: r.rating,
      nav: r.nav ? parseFloat(r.nav) : null,
      return1y: r.return_1y ? parseFloat(r.return_1y) : null,
      return6m: r.return_6m ? parseFloat(r.return_6m) : null,
      return3m: r.return_3m ? parseFloat(r.return_3m) : null,
      return1m: r.return_1m ? parseFloat(r.return_1m) : null,
      return1w: r.return_1w ? parseFloat(r.return_1w) : null,
    })));
  } catch (error) {
    console.error('获取自选列表失败:', error.message);
    res.status(500).json({ error: '获取自选列表失败' });
  }
});

// 添加自选
router.post('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const { fund_code, fund_name, group_name } = req.body;
    if (!fund_code || !/^\d{6}$/.test(fund_code)) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO watchlist (user_id, fund_code, fund_name, group_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, fund_code) DO UPDATE SET fund_name = $3
       RETURNING *`,
      [req.user.id, fund_code, fund_name || '', group_name || '默认分组']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('添加自选失败:', error.message);
    res.status(500).json({ error: '添加自选失败' });
  }
});

// 删除自选
router.delete('/api/watchlist/:fundCode', authMiddleware, async (req, res) => {
  try {
    const { fundCode } = req.params;
    if (!/^\d{6}$/.test(fundCode)) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }
    const pool = getPool();
    await pool.query('DELETE FROM watchlist WHERE user_id = $1 AND fund_code = $2', [req.user.id, fundCode]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除自选失败:', error.message);
    res.status(500).json({ error: '删除自选失败' });
  }
});

// 批量检查自选状态
router.post('/api/watchlist/check', authMiddleware, async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes)) return res.json({});
    if (codes.length > 100) return res.status(400).json({ error: '单次查询不能超过100个基金代码' });
    const pool = getPool();
    const result = await pool.query(
      'SELECT fund_code FROM watchlist WHERE user_id = $1 AND fund_code = ANY($2)',
      [req.user.id, codes]
    );
    const watched = new Set(result.rows.map(r => r.fund_code));
    res.json(Object.fromEntries(codes.map(c => [c, watched.has(c)])));
  } catch (error) {
    res.status(500).json({ error: '检查自选状态失败' });
  }
});

// ========== 基金对比净值历史 API ==========
router.post('/api/tools/compare-nav', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes) || codes.length < 1 || codes.length > 10) {
      return res.status(400).json({ error: '请提供1-10个基金代码' });
    }
    const pool = getPool();
    const result = await pool.query(
      `SELECT fund_code, nav, nav_date FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= NOW() - INTERVAL '6 months'
       ORDER BY fund_code, nav_date ASC`,
      [codes]
    );
    const grouped = {};
    result.rows.forEach(r => {
      if (!grouped[r.fund_code]) grouped[r.fund_code] = [];
      grouped[r.fund_code].push({ date: r.nav_date, nav: parseFloat(r.nav) });
    });
    const chartData = {};
    Object.entries(grouped).forEach(([code, data]) => {
      const baseNav = data[0].nav;
      chartData[code] = data.map(d => ({
        date: typeof d.date === 'string' ? d.date.slice(0, 10) : d.date.toISOString().slice(0, 10),
        nav: d.nav,
        return_pct: ((d.nav - baseNav) / baseNav * 100).toFixed(2),
      }));
    });
    res.json(chartData);
  } catch (error) {
    console.error('获取对比净值历史失败:', error.message);
    res.status(500).json({ error: '获取对比净值历史失败' });
  }
});

// ========== 沪深300基准数据 API ==========
router.get('/api/benchmark/hs300', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT nav, nav_date FROM fund_nav
       WHERE fund_code = '110020' AND nav_date >= NOW() - INTERVAL '1 year'
       ORDER BY nav_date ASC`
    );
    if (result.rows.length === 0) return res.json([]);
    const baseNav = parseFloat(result.rows[0].nav);
    res.json(result.rows.map(r => ({
      date: r.nav_date.toISOString().slice(0, 10),
      nav: parseFloat(r.nav),
      return_pct: ((parseFloat(r.nav) - baseNav) / baseNav * 100).toFixed(2),
    })));
  } catch (error) {
    console.error('获取基准数据失败:', error.message);
    res.status(500).json({ error: '获取基准数据失败' });
  }
});

// ========== 智能提醒 API ==========
router.get('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const alerts = [];

    // 1. 持仓基金净值大幅波动（近1周跌幅>5% 或 涨幅>8%）
    const holdings = await pool.query(
      `SELECT DISTINCT fund_code, fund_name FROM fund_records WHERE user_id = $1`,
      [req.user.id]
    );
    const heldCodes = new Set(holdings.rows.map(h => h.fund_code));
    for (const h of holdings.rows) {
      const navResult = await pool.query(
        `SELECT return_1w, return_1m FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1`,
        [h.fund_code]
      );
      if (navResult.rows.length > 0) {
        const return1w = parseFloat(navResult.rows[0].return_1w || 0);
        const return1m = parseFloat(navResult.rows[0].return_1m || 0);
        if (return1w < -5) {
          alerts.push({
            type: 'nav_drop', level: 'warning',
            title: `${h.fund_name} 近1周大跌`,
            message: `近1周收益 ${return1w.toFixed(2)}%，请注意风险`,
            fund_code: h.fund_code,
          });
        } else if (return1w > 8) {
          alerts.push({
            type: 'nav_surge', level: 'success',
            title: `${h.fund_name} 近1周大涨`,
            message: `近1周收益 +${return1w.toFixed(2)}%，可考虑止盈`,
            fund_code: h.fund_code,
          });
        }
        if (return1m < -10) {
          alerts.push({
            type: 'nav_drop_month', level: 'warning',
            title: `${h.fund_name} 近1月跌幅较大`,
            message: `近1月收益 ${return1m.toFixed(2)}%，可考虑定投摊低成本`,
            fund_code: h.fund_code,
          });
        }
      }
    }

    // 2. QDII限额提醒（仅用户持有的QDII基金）
    if (heldCodes.size > 0) {
      const qdiiResult = await pool.query(
        `SELECT code, name, daily_limit FROM funds WHERE code = ANY($1) AND type = 'QDII' AND daily_limit > 0 AND daily_limit < 1000`,
        [Array.from(heldCodes)]
      );
      for (const q of qdiiResult.rows) {
        alerts.push({
          type: 'qdii_limit', level: 'info',
          title: `${q.name} 限额提醒`,
          message: `当前每日限额 ${q.daily_limit} 元，注意分批买入`,
          fund_code: q.code,
        });
      }
    }

    // 3. 定投计划到期提醒
    const dcaResult = await pool.query(
      `SELECT fund_name, end_date FROM dca_plans
       WHERE user_id = $1 AND status = 'active' AND end_date IS NOT NULL AND end_date <= NOW() + INTERVAL '7 days'`,
      [req.user.id]
    );
    for (const d of dcaResult.rows) {
      alerts.push({
        type: 'dca_expiring', level: 'warning',
        title: '定投计划即将到期',
        message: `${d.fund_name} 定投计划将于 ${d.end_date.toISOString().slice(0, 10)} 到期`,
      });
    }

    // 4. 市场估值提醒
    const indices = await fundService.getMarketIndices();
    for (const idx of indices) {
      if (idx.pePercentile && idx.pePercentile < 20) {
        alerts.push({
          type: 'valuation_low', level: 'success',
          title: `${idx.name} 估值极低`,
          message: `PE分位 ${idx.pePercentile}%，处于历史低位，适合布局`,
        });
      } else if (idx.pePercentile && idx.pePercentile > 80) {
        alerts.push({
          type: 'valuation_high', level: 'warning',
          title: `${idx.name} 估值偏高`,
          message: `PE分位 ${idx.pePercentile}%，处于历史高位，注意风险`,
        });
      }
    }

    // 5. 持仓盈亏提醒（单只基金亏损>15%）
    const summaryResult = await pool.query(
      `SELECT fund_code, fund_name, pnl, pnl_percent FROM fund_records WHERE user_id = $1 AND pnl IS NOT NULL`,
      [req.user.id]
    );
    const fundPnl = {};
    for (const r of summaryResult.rows) {
      const code = r.fund_code;
      if (!fundPnl[code]) fundPnl[code] = { name: r.fund_name, pnl: 0 };
      fundPnl[code].pnl += parseFloat(r.pnl || 0);
    }
    for (const [code, d] of Object.entries(fundPnl)) {
      if (d.pnl < -500) {
        alerts.push({
          type: 'holding_loss', level: 'warning',
          title: `${d.name} 持仓亏损`,
          message: `当前亏损 ¥${Math.abs(d.pnl).toFixed(0)}，请评估是否需要调整`,
          fund_code: code,
        });
      }
    }

    // 6. 新闻事件驱动的持仓提醒
    try {
      const { generateNewsAlerts } = require('../news-fetcher.cjs');
      const newsAlerts = await generateNewsAlerts(req.user.id, pool);
      alerts.push(...newsAlerts);
    } catch (e) {
      // 新闻模块可能未初始化，忽略错误
    }

    res.json(alerts);
  } catch (error) {
    console.error('获取提醒数据失败:', error.message);
    res.status(500).json({ error: '获取提醒数据失败' });
  }
});

// ========== 招商银行持仓理财产品 API ==========
router.get('/api/cmb-products', async (req, res) => {
  try {
    const pool = getPool();

    // 从 cmb_products 获取所有持仓产品基础信息
    const prodResult = await pool.query(
      `SELECT product_code, product_name, risk_level, product_status, investment_period, nav, nav_date, return_1m, return_3m, return_6m, return_1y, updated_at
       FROM cmb_products ORDER BY product_code`
    );

    // 获取每个产品的最新净值和区间涨跌幅（从 cmb_zhaoyin_nav）
    const navResult = await pool.query(`
      SELECT DISTINCT ON (product_code)
        product_code, unit_nav, cumulative_nav, nav_date,
        return_1m_annualized, return_3m_annualized, return_6m_annualized,
        return_ytd_annualized, return_since_annualized
      FROM cmb_zhaoyin_nav
      ORDER BY product_code, nav_date DESC
    `);
    const navMap = {};
    for (const r of navResult.rows) {
      navMap[r.product_code] = r;
    }

    const enriched = prodResult.rows.map(r => {
      const code = r.product_code;
      const nav = navMap[code] || {};

      // 优先用 cmb_zhaoyin_nav 数据，没有则回退到 cmb_products 数据
      const unitNav = nav.unit_nav ? parseFloat(nav.unit_nav) : (r.nav ? parseFloat(r.nav) : null);
      const navDate = nav.nav_date
        ? (nav.nav_date instanceof Date ? nav.nav_date.toISOString().slice(0, 10) : nav.nav_date)
        : (r.nav_date instanceof Date ? r.nav_date.toISOString().slice(0, 10) : (r.nav_date || null));
      const return1m = nav.return_1m_annualized ? parseFloat(nav.return_1m_annualized) : (r.return_1m ? parseFloat(r.return_1m) : null);
      const return3m = nav.return_3m_annualized ? parseFloat(nav.return_3m_annualized) : (r.return_3m ? parseFloat(r.return_3m) : null);
      const return6m = nav.return_6m_annualized ? parseFloat(nav.return_6m_annualized) : (r.return_6m ? parseFloat(r.return_6m) : null);
      const returnYtd = nav.return_ytd_annualized ? parseFloat(nav.return_ytd_annualized) : null;
      const returnSince = nav.return_since_annualized ? parseFloat(nav.return_since_annualized) : (r.return_1y ? parseFloat(r.return_1y) : null);

      return {
        product_code: code,
        product_name: r.product_name,
        risk_level: r.risk_level || '',
        product_status: r.product_status || '',
        investment_period: r.investment_period || '',
        unit_nav: unitNav,
        nav_date: navDate,
        return_1m: return1m,
        return_3m: return3m,
        return_6m: return6m,
        return_ytd: returnYtd,
        return_since: returnSince,
        updated_at: r.updated_at || null,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('获取招行理财产品数据失败:', error.message);
    res.status(500).json({ error: '获取招行理财产品数据失败' });
  }
});

// 按产品代码查询招行理财产品名称（轻量接口，用于添加持仓时自动关联）
router.get('/api/cmb-products/lookup/:code', async (req, res) => {
  try {
    const pool = getPool();
    const { code } = req.params;
    const result = await pool.query(
      `SELECT product_code, product_name, nav AS unit_nav, nav_date
       FROM cmb_products WHERE product_code = $1`,
      [code]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }
    // 也查最新净值
    const navResult = await pool.query(
      `SELECT unit_nav, nav_date FROM cmb_zhaoyin_nav
       WHERE product_code = $1 ORDER BY nav_date DESC LIMIT 1`,
      [code]
    );
    const row = result.rows[0];
    const nav = navResult.rows[0];
    res.json({
      product_code: row.product_code,
      product_name: row.product_name,
      unit_nav: nav ? parseFloat(nav.unit_nav) : (row.unit_nav ? parseFloat(row.unit_nav) : null),
      nav_date: nav ? nav.nav_date : row.nav_date,
    });
  } catch (error) {
    console.error('查询招行理财产品失败:', error.message);
    res.status(500).json({ error: '查询招行理财产品失败' });
  }
});

// 手动触发招行理财产品数据更新（需要管理员权限）
router.post('/api/cmb-products/update', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'fetch_cmb_personal_nav.py');

    // 先运行 weekly 模式更新原有54只产品
    const proc1 = spawn('python', [scriptPath, 'weekly'], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc1.stdout.on('data', (data) => console.log(`[CMB-WEEKLY] ${data.toString().trim()}`));
    proc1.stderr.on('data', (data) => console.error(`[CMB-WEEKLY] ${data.toString().trim()}`));
    proc1.on('close', (code) => {
      console.log(`[CMB-WEEKLY] 完成，退出码: ${code}`);
      // weekly 完成后运行 target 模式更新25只目标产品
      const proc2 = spawn('python', [scriptPath, 'target'], {
        env: { ...process.env },
        cwd: path.join(__dirname, '..', '..'),
        stdio: 'pipe',
      });
      proc2.stdout.on('data', (data) => console.log(`[CMB-TARGET] ${data.toString().trim()}`));
      proc2.stderr.on('data', (data) => console.error(`[CMB-TARGET] ${data.toString().trim()}`));
      proc2.on('close', (code2) => console.log(`[CMB-TARGET] 完成，退出码: ${code2}`));
      proc2.on('error', (err) => console.error('[CMB-TARGET] 启动失败:', err.message));
    });
    proc1.on('error', (err) => console.error('[CMB-WEEKLY] 启动失败:', err.message));

    res.json({ success: true, message: '招行理财产品数据更新已启动（全量+目标产品）' });
  } catch (error) {
    console.error('触发招行理财产品更新失败:', error.message);
    res.status(500).json({ error: '触发更新失败' });
  }
});

// 获取单个招行理财产品的净值历史
router.get('/api/cmb-products/:code/nav-history', async (req, res) => {
  try {
    const { code } = req.params;
    const pool = getPool();

    const prodResult = await pool.query(
      'SELECT product_code, product_name, risk_level, product_status FROM cmb_products WHERE product_code = $1',
      [code]
    );
    if (prodResult.rows.length === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }

    const navResult = await pool.query(
      `SELECT unit_nav, cumulative_nav, nav_date
       FROM cmb_zhaoyin_nav
       WHERE product_code = $1
       ORDER BY nav_date ASC`,
      [code]
    );

    const product = prodResult.rows[0];
    const navHistory = navResult.rows.map(r => ({
      unit_nav: parseFloat(r.unit_nav),
      cumulative_nav: r.cumulative_nav ? parseFloat(r.cumulative_nav) : null,
      nav_date: r.nav_date instanceof Date ? r.nav_date.toISOString().slice(0, 10) : r.nav_date,
    }));

    // 计算每个日期的累计收益率（基于首个净值）
    if (navHistory.length > 0) {
      const firstNav = navHistory[0].unit_nav;
      for (const item of navHistory) {
        item.cumulative_return = parseFloat(((item.unit_nav - firstNav) / firstNav * 100).toFixed(4));
      }
    }

    res.json({
      product_code: product.product_code,
      product_name: product.product_name,
      risk_level: product.risk_level,
      product_status: product.product_status,
      nav_history: navHistory,
    });
  } catch (error) {
    console.error('获取招行理财产品净值历史失败:', error.message);
    res.status(500).json({ error: '获取净值历史失败' });
  }
});

// ========== 招银理财净值 API ==========
router.get('/api/cmb-zhaoyin-nav', async (req, res) => {
  try {
    const pool = getPool();
    const { search, sort, order, page = 1, pageSize = 50 } = req.query;
    const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
    const safePage = Math.max(1, parseInt(page) || 1);

    let where = '';
    const params = [];
    let idx = 1;

    if (search) {
      where = `WHERE n.product_code ILIKE $${idx} OR n.product_name ILIKE $${idx}`;
      params.push(`%${search}%`);
      idx++;
    }

    const countSql = `SELECT COUNT(DISTINCT n.product_code) FROM cmb_zhaoyin_nav n ${where}`;
    const countResult = await pool.query(countSql, params);
    const total = parseInt(countResult.rows[0].count);

    const sortMap = {
      'product_code': 'n.product_code',
      'product_name': 'n.product_name',
      'unit_nav': 'n.unit_nav',
      'cumulative_nav': 'n.cumulative_nav',
      'nav_date': 'n.nav_date',
    };
    const sortCol = sortMap[sort] || 'n.nav_date';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const offset = (safePage - 1) * safePageSize;

    const dataSql = `
      SELECT DISTINCT ON (n.product_code)
        n.product_code,
        n.product_name,
        n.unit_nav,
        n.cumulative_nav,
        n.nav_date,
        n.return_1m_annualized, n.return_3m_annualized, n.return_6m_annualized,
        n.return_ytd_annualized, n.return_since_annualized
      FROM cmb_zhaoyin_nav n
      ${where}
      ORDER BY n.product_code, n.nav_date DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    const dataResult = await pool.query(dataSql, [...params, safePageSize, offset]);

    res.json({
      data: dataResult.rows.map(r => ({
        product_code: r.product_code,
        product_name: r.product_name,
        unit_nav: r.unit_nav ? parseFloat(r.unit_nav) : null,
        cumulative_nav: r.cumulative_nav ? parseFloat(r.cumulative_nav) : null,
        nav_date: r.nav_date,
        return_1m_annualized: r.return_1m_annualized ? parseFloat(r.return_1m_annualized) : null,
        return_3m_annualized: r.return_3m_annualized ? parseFloat(r.return_3m_annualized) : null,
        return_6m_annualized: r.return_6m_annualized ? parseFloat(r.return_6m_annualized) : null,
        return_ytd_annualized: r.return_ytd_annualized ? parseFloat(r.return_ytd_annualized) : null,
        return_since_inception_annualized: r.return_since_annualized ? parseFloat(r.return_since_annualized) : null,
      })),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    });
  } catch (error) {
    console.error('获取招银理财净值数据失败:', error.message);
    res.status(500).json({ error: '获取招银理财净值数据失败' });
  }
});

// 手动触发招银理财净值数据更新（需要管理员权限）
router.post('/api/cmb-zhaoyin-nav/update', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const scriptPath = require('path').join(__dirname, '..', '..', 'scripts', 'fetch_cmb_personal_nav.py');
    const python = spawn('python', [scriptPath], {
      env: { ...process.env },
      cwd: require('path').join(__dirname, '..', '..'),
    });
    let output = '';
    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { output += data.toString(); });
    python.on('close', (code) => {
      console.log(`[招银理财NAV] 爬取脚本退出，code=${code}`);
    });
    res.json({ success: true, message: '招银理财净值数据更新已启动' });
  } catch (error) {
    console.error('触发招银理财净值更新失败:', error.message);
    res.status(500).json({ error: '触发更新失败' });
  }
});

// ========== 估值历史趋势 API ==========
router.get('/api/market/valuation-trend', async (req, res) => {
  try {
    const indices = await fundService.getMarketIndices();
    const trendData = indices.map(idx => {
      const currentPE = idx.pePercentile || 50;
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const variation = (Math.sin(i * 0.8 + currentPE * 0.1) * 15) + (Math.random() - 0.5) * 8;
        const pe = Math.max(5, Math.min(95, currentPE + variation));
        months.push({
          month: monthStr,
          pe_percentile: parseFloat(pe.toFixed(1)),
          pb_percentile: parseFloat(Math.max(5, Math.min(95, pe * 0.85 + (Math.random() - 0.5) * 10)).toFixed(1)),
        });
      }
      months[months.length - 1].pe_percentile = currentPE;
      months[months.length - 1].pb_percentile = idx.pbPercentile || currentPE * 0.85;
      return {
        name: idx.name, code: idx.code,
        current_valuation: idx.valuation, current_suggestion: idx.suggestion,
        months,
      };
    });
    res.json(trendData);
  } catch (error) {
    console.error('获取估值趋势数据失败:', error.message);
    res.status(500).json({ error: '获取估值趋势数据失败' });
  }
});

// ========== 市场重大事件日历 API ==========
router.get('/api/market-events', (req, res) => {
  try {
    const { marketEvents, categoryConfig, impactConfig } = require('../market-events.cjs');
    const { month, category, impact } = req.query;

    let events = [...marketEvents];

    if (month) {
      const m = parseInt(month);
      if (m >= 1 && m <= 12) events = events.filter(e => e.month === m);
    }
    if (category) {
      events = events.filter(e => e.category === category);
    }
    if (impact) {
      events = events.filter(e => e.impact === impact);
    }

    // 按月份和日期排序
    events.sort((a, b) => a.month - b.month || a.id.localeCompare(b.id));

    // 按月分组
    const byMonth = {};
    events.forEach(e => {
      if (!byMonth[e.month]) byMonth[e.month] = [];
      byMonth[e.month].push(e);
    });

    res.json({
      events,
      byMonth,
      categoryConfig,
      impactConfig,
      total: events.length,
    });
  } catch (error) {
    console.error('获取市场事件失败:', error.message);
    res.status(500).json({ error: '获取市场事件失败' });
  }
});

// GET /api/yifangda-funds — 获取易方达基金数据
router.get('/api/yifangda-funds', async (req, res) => {
  try {
    const pool = getPool();
    const { search, sort = 'return_1y', order = 'desc', manager, page = 1, pageSize = 50 } = req.query;
    const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
    const safePage = Math.max(1, parseInt(page) || 1);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(fund_code ILIKE $${idx} OR fund_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (manager) {
      conditions.push(`fund_manager = $${idx}`);
      params.push(manager);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 总数
    const countResult = await pool.query(`SELECT COUNT(*) FROM yifangda_funds ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    // 排序
    const sortMap = {
      'fund_code': 'fund_code',
      'fund_name': 'fund_name',
      'unit_nav': 'unit_nav',
      'return_1m': 'return_1m',
      'return_3m': 'return_3m',
      'return_6m': 'return_6m',
      'return_1y': 'return_1y',
      'scale': 'scale',
      'fund_manager': 'fund_manager',
    };
    const sortCol = sortMap[sort] || 'return_1y';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const offset = (safePage - 1) * safePageSize;

    // 数据
    const dataResult = await pool.query(
      `SELECT fund_code, fund_name, fund_manager, unit_nav, nav_date,
              return_1w, return_1m, return_3m, return_6m, return_1y, scale, updated_at
       FROM yifangda_funds ${where}
       ORDER BY ${sortCol} ${sortOrder} NULLS LAST
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, safePageSize, offset]
    );

    // 经理列表（用于筛选）
    const managersResult = await pool.query(
      `SELECT DISTINCT fund_manager, COUNT(*) as cnt
       FROM yifangda_funds WHERE fund_manager != ''
       GROUP BY fund_manager ORDER BY cnt DESC LIMIT 30`
    );

    res.json({
      data: dataResult.rows.map(r => ({
        fund_code: r.fund_code,
        fund_name: r.fund_name,
        fund_manager: r.fund_manager,
        unit_nav: r.unit_nav ? parseFloat(r.unit_nav) : null,
        nav_date: r.nav_date,
        return_1w: r.return_1w ? parseFloat(r.return_1w) : null,
        return_1m: r.return_1m ? parseFloat(r.return_1m) : null,
        return_3m: r.return_3m ? parseFloat(r.return_3m) : null,
        return_6m: r.return_6m ? parseFloat(r.return_6m) : null,
        return_1y: r.return_1y ? parseFloat(r.return_1y) : null,
        scale: r.scale ? parseFloat(r.scale) : null,
        updated_at: r.updated_at,
      })),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      managers: managersResult.rows.map(r => ({
        name: r.fund_manager,
        count: parseInt(r.cnt),
      })),
    });
  } catch (error) {
    console.error('获取易方达基金数据失败:', error.message);
    res.status(500).json({ error: '获取易方达基金数据失败' });
  }
});

// POST /api/funds/fetch-yifangda — 从支付宝获取易方达基金的经理、净值等数据（管理员）
function createYiFangDaRoute(fetchYiFangDaFundData) {
  router.post('/api/funds/fetch-yifangda', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await fetchYiFangDaFundData();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('获取易方达基金数据失败:', error.message);
      res.status(500).json({ error: '获取失败: ' + error.message });
    }
  });
}

// ========== 金选基金 API ==========

// GET /api/gold-funds — 获取金选基金列表（支持筛选和排序）
router.get('/api/gold-funds', async (req, res) => {
  try {
    const pool = getPool();
    const {
      category, industry, search, manager,
      sort = 'return_1y', order = 'desc',
      page = 1, pageSize = 100,
      minReturn, maxFee, minScale,
    } = req.query;
    const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 100));
    const safePage = Math.max(1, parseInt(page) || 1);

    const conditions = ['f.is_gold_selected = true'];
    const params = [];
    let idx = 1;

    if (category) {
      conditions.push(`f.industry = $${idx++}`);
      params.push(category);
    }
    if (industry) {
      conditions.push(`f.industry = $${idx++}`);
      params.push(industry);
    }
    if (search) {
      conditions.push(`(f.code ILIKE $${idx} OR f.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (manager) {
      conditions.push(`f.manager = $${idx++}`);
      params.push(manager);
    }
    if (minReturn) {
      conditions.push(`n.return_1y >= $${idx++}`);
      params.push(parseFloat(minReturn));
    }
    if (maxFee) {
      conditions.push(`f.total_fee <= $${idx++}`);
      params.push(parseFloat(maxFee));
    }
    if (minScale) {
      conditions.push(`f.scale >= $${idx++}`);
      params.push(parseFloat(minScale));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 排序映射
    const sortMap = {
      'return_1y': 'n.return_1y', 'return_6m': 'n.return_6m',
      'return_3m': 'n.return_3m', 'return_1m': 'n.return_1m', 'return_1w': 'n.return_1w',
      'total_fee': 'f.total_fee', 'scale': 'f.scale', 'rating': 'f.rating',
      'nav': 'n.nav', 'name': 'f.name', 'code': 'f.code',
    };
    const sortCol = sortMap[sort] || 'n.return_1y';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    // 总数
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM funds f LEFT JOIN LATERAL (
        SELECT return_1y FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
      ) n ON true ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 分页
    const offset = (safePage - 1) * safePageSize;

    // 数据查询
    const dataResult = await pool.query(
      `SELECT f.code, f.name, f.type, f.industry, f.index_name,
              f.management_fee, f.custody_fee, f.service_fee, f.total_fee,
              f.scale, f.rating, f.buy_suggestion, f.daily_limit, f.manager,
              f.valuation, f.trend, f.logic,
              n.nav, n.total_nav, n.nav_date,
              n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
       FROM funds f
       LEFT JOIN LATERAL (
         SELECT nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y
         FROM fund_nav WHERE fund_code = f.code
         ORDER BY return_1y IS NOT NULL DESC, nav_date DESC LIMIT 1
       ) n ON true
       ${where}
       ORDER BY ${sortCol} ${sortOrder} NULLS LAST
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, safePageSize, offset]
    );

    // 统计分类分布
    const categoryResult = await pool.query(
      `SELECT industry, COUNT(*) as cnt FROM funds WHERE is_gold_selected = true GROUP BY industry ORDER BY cnt DESC`
    );

    // 统计经理分布
    const managerResult = await pool.query(
      `SELECT manager, COUNT(*) as cnt FROM funds
       WHERE is_gold_selected = true AND manager IS NOT NULL AND manager != ''
       GROUP BY manager ORDER BY cnt DESC LIMIT 20`
    );

    res.json({
      data: dataResult.rows.map(r => ({
        code: r.code,
        name: r.name,
        type: r.type,
        industry: r.industry,
        index: r.index_name,
        managementFee: parseFloat(r.management_fee) || 0,
        custodyFee: parseFloat(r.custody_fee) || 0,
        serviceFee: parseFloat(r.service_fee) || 0,
        totalFee: parseFloat(r.total_fee) || 0,
        scale: parseFloat(r.scale) || 0,
        rating: r.rating,
        buySuggestion: r.buy_suggestion,
        dailyLimit: r.daily_limit,
        manager: r.manager,
        valuation: r.valuation,
        trend: r.trend,
        logic: r.logic,
        isGoldSelected: true,
        nav: r.nav ? parseFloat(r.nav) : null,
        navDate: r.nav_date,
        return1w: r.return_1w ? parseFloat(r.return_1w) : null,
        return1m: r.return_1m ? parseFloat(r.return_1m) : null,
        return3m: r.return_3m ? parseFloat(r.return_3m) : null,
        return6m: r.return_6m ? parseFloat(r.return_6m) : null,
        return1y: r.return_1y ? parseFloat(r.return_1y) : null,
      })),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
      categories: categoryResult.rows.map(r => ({ name: r.industry, count: parseInt(r.cnt) })),
      managers: managerResult.rows.map(r => ({ name: r.manager, count: parseInt(r.cnt) })),
    });
  } catch (error) {
    console.error('获取金选基金失败:', error.message);
    res.status(500).json({ error: '获取金选基金失败' });
  }
});

// GET /api/gold-funds/stats — 金选基金统计概览
router.get('/api/gold-funds/stats', async (req, res) => {
  try {
    const pool = getPool();

    // 总数
    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM funds WHERE is_gold_selected = true"
    );

    // 分类统计
    const categoryResult = await pool.query(
      `SELECT industry, COUNT(*) as cnt,
              AVG(f.scale) as avg_scale,
              AVG(f.total_fee) as avg_fee
       FROM funds f WHERE f.is_gold_selected = true
       GROUP BY industry ORDER BY cnt DESC`
    );

    // 收益统计
    const returnResult = await pool.query(
      `SELECT
         AVG(n.return_1y) as avg_return_1y,
         AVG(n.return_6m) as avg_return_6m,
         AVG(n.return_3m) as avg_return_3m,
         MAX(n.return_1y) as max_return_1y,
         MIN(n.return_1y) as min_return_1y
       FROM funds f
       LEFT JOIN LATERAL (
         SELECT return_1y, return_6m, return_3m FROM fund_nav
         WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
       ) n ON true
       WHERE f.is_gold_selected = true`
    );

    // 费率统计
    const feeResult = await pool.query(
      `SELECT
         AVG(total_fee) as avg_fee,
         MIN(total_fee) as min_fee,
         MAX(total_fee) as max_fee
       FROM funds WHERE is_gold_selected = true`
    );

    // 规模统计
    const scaleResult = await pool.query(
      `SELECT
         SUM(scale) as total_scale,
         AVG(scale) as avg_scale,
         MAX(scale) as max_scale
       FROM funds WHERE is_gold_selected = true`
    );

    const stats = returnResult.rows[0];
    const fee = feeResult.rows[0];
    const scale = scaleResult.rows[0];

    res.json({
      total: parseInt(countResult.rows[0].total),
      categories: categoryResult.rows.map(r => ({
        name: r.industry,
        count: parseInt(r.cnt),
        avgScale: r.avg_scale ? parseFloat(r.avg_scale).toFixed(2) : '0',
        avgFee: r.avg_fee ? parseFloat(r.avg_fee).toFixed(4) : '0',
      })),
      returns: {
        avg1y: stats.avg_return_1y ? parseFloat(stats.avg_return_1y).toFixed(2) : null,
        avg6m: stats.avg_return_6m ? parseFloat(stats.avg_return_6m).toFixed(2) : null,
        avg3m: stats.avg_return_3m ? parseFloat(stats.avg_return_3m).toFixed(2) : null,
        max1y: stats.max_return_1y ? parseFloat(stats.max_return_1y).toFixed(2) : null,
        min1y: stats.min_return_1y ? parseFloat(stats.min_return_1y).toFixed(2) : null,
      },
      fees: {
        avg: fee.avg_fee ? parseFloat(fee.avg_fee).toFixed(4) : null,
        min: fee.min_fee ? parseFloat(fee.min_fee).toFixed(4) : null,
        max: fee.max_fee ? parseFloat(fee.max_fee).toFixed(4) : null,
      },
      scale: {
        total: scale.total_scale ? parseFloat(scale.total_scale).toFixed(2) : '0',
        avg: scale.avg_scale ? parseFloat(scale.avg_scale).toFixed(2) : '0',
        max: scale.max_scale ? parseFloat(scale.max_scale).toFixed(2) : '0',
      },
    });
  } catch (error) {
    console.error('获取金选基金统计失败:', error.message);
    res.status(500).json({ error: '获取金选基金统计失败' });
  }
});

// ========== 实时财经新闻 API ==========
// GET /api/news — 获取新闻列表（默认隐藏低影响）
router.get('/api/news', (req, res) => {
  try {
    const { getCachedNews } = require('../news-fetcher.cjs');
    // 默认过滤低影响公告，除非显式指定 impact=all
    const query = { ...req.query };
    if (!query.impact) query.impact = 'high,medium';
    const result = getCachedNews(query);
    res.json(result);
  } catch (error) {
    console.error('获取新闻失败:', error.message);
    res.status(500).json({ error: '获取新闻失败' });
  }
});

// GET /api/news/stats — 新闻统计
router.get('/api/news/stats', (req, res) => {
  try {
    const { getNewsStats } = require('../news-fetcher.cjs');
    res.json(getNewsStats());
  } catch (error) {
    res.status(500).json({ error: '获取新闻统计失败' });
  }
});

// GET /api/news/personal — 获取与用户持仓/自选相关的新闻
router.get('/api/news/personal', authMiddleware, async (req, res) => {
  try {
    const { getCachedNews, NEWS_INDUSTRY_MAP } = require('../news-fetcher.cjs');
    const pool = getPool();

    // 1. 获取用户持仓基金信息
    const holdings = await pool.query(
      `SELECT DISTINCT fr.fund_code, fr.fund_name, f.industry, f.type
       FROM fund_records fr
       LEFT JOIN funds f ON fr.fund_code = f.code
       WHERE fr.user_id = $1`,
      [req.user.id]
    );

    // 2. 获取用户自选基金信息
    const watchlist = await pool.query(
      `SELECT w.fund_code, w.fund_name, f.industry, f.type
       FROM watchlist w
       LEFT JOIN funds f ON w.fund_code = f.code
       WHERE w.user_id = $1`,
      [req.user.id]
    );

    // 3. 提取关键词集合
    const fundNames = new Set();
    const industries = new Set();

    [...holdings.rows, ...watchlist.rows].forEach(r => {
      if (r.fund_name) fundNames.add(r.fund_name);
      if (r.industry) industries.add(r.industry);
    });

    // 4. 构建行业关键词（从 NEWS_INDUSTRY_MAP 反向查找匹配行业的关键词）
    const industryKeywords = new Set();
    for (const [keyword, industry] of Object.entries(NEWS_INDUSTRY_MAP)) {
      if (industries.has(industry)) {
        industryKeywords.add(keyword);
      }
    }

    // 5. 构建持仓行业重仓股名称集合（用于个股匹配）
    // 行业→重仓股映射（与 api.cjs 中 generateFundDetail 的 holdingsMap 一致）
    const INDUSTRY_HOLDINGS = {
      '人工智能': ['科大讯飞', '海康威视', '中际旭创', '工业富联', '寒武纪', '紫光股份', '中科曙光', '浪潮信息', '用友网络', '金山办公'],
      '半导体/芯片': ['北方华创', '中芯国际', '韦尔股份', '兆易创新', '卓胜微', '圣邦股份', '中微公司', '长电科技', '华虹半导体', '紫光国微'],
      '医药': ['恒瑞医药', '药明康德', '迈瑞医疗', '片仔癀', '爱尔眼科', '智飞生物', '长春高新', '沃森生物', '通策医疗', '华大基因'],
      '新能源': ['宁德时代', '比亚迪', '隆基绿能', '阳光电源', '通威股份', '亿纬锂能', '赣锋锂业', '天齐锂业', '璞泰来', '恩捷股份'],
      '消费': ['贵州茅台', '五粮液', '山西汾酒', '泸州老窖', '海天味业', '伊利股份', '洋河股份', '古井贡酒', '今世缘', '舍得酒业'],
      '证券': ['中信证券', '东方财富', '华泰证券', '国泰君安', '海通证券', '招商证券', '中金公司', '申万宏源', '广发证券', '兴业证券'],
      '金融': ['招商银行', '中国平安', '工商银行', '建设银行', '农业银行', '兴业银行', '浦发银行', '民生银行'],
      '陶瓷/建材': ['海螺水泥', '东方雨虹', '北新建材', '旗滨集团', '蒙娜丽莎', '东鹏控股', '帝欧家居', '伟星新材', '华新水泥', '冀东水泥'],
      '军工': ['中航沈飞', '航发动力', '中航光电', '紫光国微', '中航西飞', '航天电器', '中直股份', '洪都航空'],
      '煤炭': ['中国神华', '陕西煤业', '兖矿能源', '中煤能源', '山西焦煤', '平煤股份', '淮北矿业', '潞安环能'],
      '电力': ['长江电力', '华能国际', '国电电力', '大唐发电', '华电国际', '中国核电', '三峡能源', '龙源电力'],
      '纳斯达克100': ['英伟达', '苹果', '微软', '亚马逊', 'Meta', '谷歌', '特斯拉', '博通', '奈飞', 'AMD', 'NVDA', 'AAPL', 'MSFT', 'AMZN'],
      '标普500': ['英伟达', '苹果', '微软', '亚马逊', '谷歌', '伯克希尔', '摩根大通', 'Visa', '礼来', 'NVDA', 'AAPL', 'MSFT'],
    };
    const heldStockNames = new Set();
    for (const industry of industries) {
      const stocks = INDUSTRY_HOLDINGS[industry] || [];
      stocks.forEach(s => heldStockNames.add(s));
    }

    // 6. 从缓存新闻中筛选相关新闻
    const allNews = getCachedNews({ pageSize: 200, page: 1 });
    const personalNews = [];
    const seen = new Set();

    for (const item of allNews.items) {
      const text = (item.title + ' ' + item.content).toLowerCase();
      let matched = false;
      let matchReason = '';
      let relevance = 'low';

      // 匹配1：基金名称（如"易方达沪深300"出现在新闻中）
      for (const name of fundNames) {
        const nameKey = name.replace(/ETF联接|指数增强|混合|股票|债券|A$|C$|基金/g, '').trim();
        if (nameKey.length >= 2 && text.includes(nameKey.toLowerCase())) {
          matched = true;
          matchReason = `持仓基金「${name}」相关`;
          relevance = 'high';
          break;
        }
      }

      // 匹配2：行业关键词（收集所有匹配，优先选持仓行业的长关键词）
      if (!matched) {
        let bestMatch = null;
        for (const keyword of industryKeywords) {
          if (text.includes(keyword.toLowerCase())) {
            const industry = NEWS_INDUSTRY_MAP[keyword];
            const isHeld = [...holdings.rows].some(h => h.industry === industry);
            const candidate = { keyword, industry, isHeld, relevance: isHeld ? 'high' : 'medium' };
            if (!bestMatch) {
              bestMatch = candidate;
            } else {
              // 优先持仓行业 > 自选行业；同级优先长关键词（更精确）
              if (candidate.isHeld && !bestMatch.isHeld) {
                bestMatch = candidate;
              } else if (candidate.isHeld === bestMatch.isHeld && keyword.length > bestMatch.keyword.length) {
                bestMatch = candidate;
              }
            }
          }
        }
        if (bestMatch) {
          matched = true;
          matchReason = bestMatch.isHeld
            ? `持仓行业「${bestMatch.industry}」相关`
            : `自选行业「${bestMatch.industry}」相关`;
          relevance = bestMatch.relevance;
        }
      }

      // 匹配3：个股名称（新闻中提到的股票名称是否在持仓行业重仓股中）
      if (!matched && item.stocks) {
        for (const stock of item.stocks) {
          if (stock.name && heldStockNames.has(stock.name)) {
            matched = true;
            matchReason = `持仓重仓股「${stock.name}」相关`;
            relevance = 'high';
            break;
          }
        }
      }
      // 补充：从新闻文本中匹配重仓股名称
      if (!matched) {
        for (const stockName of heldStockNames) {
          if (text.includes(stockName)) {
            matched = true;
            matchReason = `持仓重仓股「${stockName}」相关`;
            relevance = 'high';
            break;
          }
        }
      }

      if (matched && !seen.has(item.id)) {
        seen.add(item.id);
        personalNews.push({
          ...item,
          matchReason,
          relevance,
        });
      }
    }

    // 按相关性和时间排序
    personalNews.sort((a, b) => {
      const relOrder = { high: 0, medium: 1, low: 2 };
      if (relOrder[a.relevance] !== relOrder[b.relevance]) {
        return relOrder[a.relevance] - relOrder[b.relevance];
      }
      return b.timestamp - a.timestamp;
    });

    res.json({
      items: personalNews,
      total: personalNews.length,
      holdings: holdings.rows.map(r => ({
        code: r.fund_code,
        name: r.fund_name,
        industry: r.industry,
      })),
      watchlist: watchlist.rows.map(r => ({
        code: r.fund_code,
        name: r.fund_name,
        industry: r.industry,
      })),
      matchedIndustries: [...industries],
    });
  } catch (error) {
    console.error('获取个人相关新闻失败:', error.message);
    res.status(500).json({ error: '获取个人相关新闻失败' });
  }
});

// POST /api/news/refresh — 手动刷新新闻（管理员）
function createNewsRefreshRoute(fetchAllNews) {
  router.post('/api/news/refresh', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await fetchAllNews();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('刷新新闻失败:', error.message);
      res.status(500).json({ error: '刷新新闻失败' });
    }
  });
}

// POST /api/funds/fetch-gold — 抓取金选基金数据（管理员）
function createGoldFundRoute(fetchGoldFundData) {
  router.post('/api/funds/fetch-gold', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await fetchGoldFundData();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('抓取金选基金数据失败:', error.message);
      res.status(500).json({ error: '抓取失败: ' + error.message });
    }
  });
}

module.exports = { router, createStatusRoute, createUpdateRoute, createYiFangDaRoute, createGoldFundRoute, createNewsRefreshRoute };
