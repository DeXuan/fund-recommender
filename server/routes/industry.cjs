/**
 * 行业分析路由 — 行业深度分析、沪深300分析、标普500分析、推荐、建仓方案
 */

const express = require('express');
const logger = require('../utils/logger.cjs');
const fundService = require('../fund-service.cjs');
const { handler } = require('../utils/route-handler.cjs');

const router = express.Router();

// 获取行业推荐
router.get('/api/recommendations/industry', handler(async () => {
  const industryConfigs = [
    { industry: '人工智能/AI', match: '人工智能', trend: '强势上涨', valuation: '合理偏高', buySuggestion: '优先配置', logic: 'AI算力+应用双轮驱动，年度核心主线' },
    { industry: '半导体/芯片', match: '半导体/芯片', trend: '震荡上行', valuation: '合理', buySuggestion: '优先配置', logic: '半导体国产替代+AI芯片需求爆发' },
    { industry: '纳斯达克100', match: '纳斯达克100', trend: '强势上涨', valuation: '合理偏高', buySuggestion: '限大额配置', logic: '美股科技龙头，QDII额度紧张' },
    { industry: '医药', match: '医药', trend: '底部反弹', valuation: '极低', buySuggestion: '左侧布局', logic: '估值历史极低，长期配置价值凸显' },
    { industry: '煤炭', match: '煤炭', trend: '震荡上行', valuation: '低估', buySuggestion: '分批建仓', logic: '高股息(5-8%)+低估值(PE 8-10倍)+供需偏紧，防御属性强' },
    { industry: '陶瓷/建材', match: '陶瓷/建材', trend: '底部企稳', valuation: '低估', buySuggestion: '逢低布局', logic: '房地产政策优化+基建稳增长，建材需求触底反弹；陶瓷行业集中度提升，龙头企业受益' },
    { industry: '证券', match: '证券', trend: '底部反弹', valuation: '低估', buySuggestion: '逢低布局', logic: '资本市场改革持续推进，券商行业整合加速；市场回暖带动交易量提升，券商盈利有望改善' },
  ];

  return await Promise.all(
    industryConfigs.map(async (cfg) => {
      const result = await fundService.getAllFundsWithNav({ industry: cfg.match, pageSize: 3 });
      return {
        industry: cfg.industry, trend: cfg.trend, valuation: cfg.valuation,
        buySuggestion: cfg.buySuggestion, logic: cfg.logic,
        funds: (result.data || result).slice(0, 3),
      };
    })
  );
}));

// 获取分批建仓方案
router.get('/api/recommendations/batch-plans', handler(async () => {
  return [
    { batch: 1, time: '本周', ratio: 40, funds: ['人工智能ETF联接A(012733)', '半导体芯片ETF联接A(008887)'], method: '一次性买入', reason: 'AI+半导体为年度核心主线，Q2涨幅领先' },
    { batch: 2, time: '下周', ratio: 30, funds: ['光伏ETF联接A(011102)', '新能源ETF联接A(012348)'], method: '定投或一次性买入', reason: '光伏/新能源底部反转，估值低估区间' },
    { batch: 3, time: '第三周', ratio: 20, funds: ['军工ETF联接A(013139)', '科技ETF联接A(007873)'], method: '定投', reason: '稳健配置型标的，分散风险' },
    { batch: 4, time: '第四周', ratio: 10, funds: ['银行ETF联接A(001594)', '煤炭ETF联接C(008280)'], method: '定投', reason: '银行+煤炭高股息防守，平衡组合风险' },
  ];
}));

// 行业基金深度分析
router.get('/api/industry-analysis/:industry', handler(async (req) => {
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
    const err = new Error('行业不存在');
    err.status = 404;
    throw err;
  }

  const allFundsData = [];
  for (const m of config.match) {
    const result = await fundService.getAllFundsWithNav({ industry: m, pageSize: 500 });
    const funds = result.data || result;
    allFundsData.push(...funds);
  }
  const seen = new Set();
  const industryFunds = allFundsData.filter(f => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });

  return {
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
}));

// 沪深300指数基金深度分析
router.get('/api/hs300/analysis', handler(async () => {
  let indexValuation = {
    name: '沪深300', code: '000300',
    pe: 14.39, pb: 1.44, pePercentile: 87.8, pbPercentile: 44.4,
    valuation: '偏高', suggestion: '建议定投，避免一次性重仓',
    roe: 10.0, dividendYield: 2.8,
  };

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
    logger.warn('[HS300] 获取基金详情失败，使用默认值:', e.message);
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

  return {
    valuation: indexValuation, funds: hs300Funds, topHoldings,
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
}));

// 标普500指数基金深度分析
router.get('/api/sp500/analysis', handler(async () => {
  const indexValuation = {
    name: '标普500', code: 'SPX',
    pe: 23.5, pb: 4.8, pePercentile: 72, pbPercentile: 68,
    valuation: '偏高估', suggestion: '小额定投',
    roe: 20.4, dividendYield: 1.3, currentPrice: 5350,
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
    isGoldSelected: f.isGoldSelected || false, buySuggestion: f.buySuggestion,
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

  return {
    valuation: indexValuation, funds: sp500Funds, topHoldings,
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
}));

// 市场重大事件日历（静态基线 + 集思录实时事件）
router.get('/api/market-events', handler(async (req) => {
  const { marketEvents, categoryConfig, impactConfig } = require('../market-events.cjs');
  const { getCachedCalendar } = require('../calendar-fetcher.cjs');
  const { month, category, impact } = req.query;

  let live = [];
  try { live = await getCachedCalendar(); } catch { live = []; }

  // 实时事件 + 静态年报级事件，实时优先
  let events = [...live, ...marketEvents.map(e => ({ ...e, source: '手动维护' }))];
  if (month) { const m = parseInt(month); if (m >= 1 && m <= 12) events = events.filter(e => e.month === m); }
  if (category) events = events.filter(e => e.category === category);
  if (impact) events = events.filter(e => e.impact === impact);

  events.sort((a, b) => a.month - b.month || (a.date || a.dateRange || '').localeCompare(b.date || b.dateRange || ''));

  const byMonth = {};
  events.forEach(e => { if (!byMonth[e.month]) byMonth[e.month] = []; byMonth[e.month].push(e); });

  return { events, byMonth, categoryConfig, impactConfig, total: events.length, liveCount: live.length };
}));

module.exports = { router };
