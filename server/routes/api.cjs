/**
 * API 路由模块 — 基金数据、市场数据、工具、行业分析等
 */

const express = require('express');
const axios = require('axios');
const fundService = require('../fund-service.cjs');
const { authMiddleware } = require('../auth.cjs');
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

    const result = await fundService.getAllFundsWithNav({ pageSize: 500 });
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

    const result = await fundService.getAllFundsWithNav({ pageSize: 500 });
    const allFundsData = result.data || result;

    const sp500Funds = allFundsData.filter(f => f.industry === '标普500').map(f => ({
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

    res.json(alerts);
  } catch (error) {
    console.error('获取提醒数据失败:', error.message);
    res.status(500).json({ error: '获取提醒数据失败' });
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

module.exports = { router, createStatusRoute, createUpdateRoute };
