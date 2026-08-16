/**
 * 金选基金专业分析引擎
 * 为每只金选基金计算：估值判断、趋势分析、投资逻辑、买入建议
 */

const logger = require('./utils/logger.cjs');

// 指数PE估值参考区间（基于历史分位数）
const INDEX_VALUATION = {
  '沪深300': { peLow: 11, peMid: 13, peHigh: 15, peCurrent: 14.4 },
  '中证500': { peLow: 18, peMid: 23, peHigh: 28, peCurrent: 23.5 },
  '创业板': { peLow: 28, peMid: 35, peHigh: 45, peCurrent: 32 },
  '科创50': { peLow: 35, peMid: 45, peHigh: 60, peCurrent: 47 },
  '上证50': { peLow: 9, peMid: 10.5, peHigh: 12, peCurrent: 10.8 },
  '中证1000': { peLow: 25, peMid: 32, peHigh: 40, peCurrent: 35 },
  '中证A500': { peLow: 12, peMid: 14, peHigh: 16, peCurrent: 14.5 },
  '纳斯达克100': { peLow: 22, peMid: 28, peHigh: 34, peCurrent: 30 },
  '标普500': { peLow: 18, peMid: 22, peHigh: 26, peCurrent: 23.5 },
  '恒生指数': { peLow: 8, peMid: 10, peHigh: 12, peCurrent: 9.5 },
};

// 各行业PE估值中枢（TTM）
const INDUSTRY_PE_BASE = {
  '医药': { low: 25, mid: 32, high: 42, current: 28 },
  '半导体/芯片': { low: 40, mid: 55, high: 75, current: 58 },
  '人工智能': { low: 30, mid: 42, high: 58, current: 45 },
  '新能源': { low: 18, mid: 25, high: 35, current: 22 },
  '消费': { low: 22, mid: 30, high: 40, current: 28 },
  '证券': { low: 15, mid: 20, high: 28, current: 19 },
  '军工': { low: 45, mid: 58, high: 75, current: 55 },
  '金融': { low: 5.5, mid: 7, high: 9, current: 6.5 },
  '煤炭': { low: 7, mid: 9, high: 12, current: 8.5 },
  '电力': { low: 14, mid: 18, high: 24, current: 17 },
  '家电': { low: 12, mid: 16, high: 22, current: 15 },
  '汽车': { low: 18, mid: 25, high: 35, current: 24 },
  '通信': { low: 18, mid: 24, high: 32, current: 22 },
  '酒店旅游': { low: 22, mid: 30, high: 42, current: 26 },
  '黄金': { low: 15, mid: 20, high: 28, current: 19 },
  '红利': { low: 7, mid: 9, high: 12, current: 8 },
};

/**
 * 计算估值判断
 */
function computeValuation(industry, indexName, returns) {
  // 债券/固收类不适用PE估值
  if (industry === '债券' || industry === '固收') return '不适用';

  const pe = INDUSTRY_PE_BASE[industry] || INDEX_VALUATION[industry] ||
    INDEX_VALUATION[indexName] || { low: 15, mid: 22, high: 32, current: 22 };

  const ratio = pe.current / pe.mid;
  if (ratio < 0.65) return '极低';
  if (ratio < 0.85) return '低估';
  if (ratio < 0.95) return '偏低';
  if (ratio < 1.1) return '合理';
  if (ratio < 1.3) return '偏高';
  return '高估';
}

/**
 * 计算趋势判断（基于收益率形态）
 */
function computeTrend(return1w, return1m, return3m, return6m, return1y) {
  const r1w = return1w || 0;
  const r1m = return1m || 0;
  const r3m = return3m || 0;
  const r6m = return6m || 0;
  const r1y = return1y || 0;

  // 强势上涨：短期和中期都强
  if (r1m > 5 && r3m > 10) return '强势上涨';
  if (r1m > 3 && r3m > 5 && r6m > 0) return '强势上涨';
  // 温和上涨
  if (r1m > 0 && r3m > 0 && r6m > 0) return '温和上涨';
  if (r1w > 0 && r1m > 0) return '温和上涨';
  // 底部反弹
  if (r1m > 3 && r3m < -5 && r6m < 0) return '底部反弹';
  if (r1w > 2 && r1m > 0 && r3m < -10) return '底部反弹';
  // 震荡
  if (Math.abs(r1m) < 2 && Math.abs(r3m) < 5) return '震荡';
  if (r1m > 0 !== r3m > 0) return '震荡';
  // 下跌
  if (r1m < -3 && r3m < -5) return '下跌';
  if (r1m < 0 && r3m < 0) return '下跌';
  // 大幅回调
  if (r3m < -10) return '大幅回调';
  // Default
  if (r1y > 10) return '长期向好';
  if (r1y < -10) return '长期偏弱';
  return '震荡';
}

/**
 * 生成投资逻辑（一句话总结为什么推荐/不推荐）
 */
function computeLogic(fund, returns, valuation, trend, buySuggestion) {
  const parts = [];
  const { name, totalFee, scale, type, industry, indexName } = fund;
  const { return1y } = returns;

  // 费率评价
  if (totalFee <= 0.2) parts.push('费率极低');
  else if (totalFee <= 0.6) parts.push('费率较低');
  else if (totalFee > 1.0) parts.push('费率偏高');

  // 规模评价
  if (scale > 100) parts.push('超大规模');
  else if (scale > 10) parts.push('规模适中');
  else if (scale > 0 && scale < 1) parts.push('规模偏小');

  // 收益评价
  if (return1y > 30) parts.push('高收益');
  else if (return1y > 15) parts.push('收益良好');
  else if (return1y > 0) parts.push('正收益');
  else if (return1y < -10) parts.push('短期回撤');

  // 类型/行业特征
  if (type?.includes('增强')) parts.push('增强策略');
  if (type?.includes('ETF')) parts.push('场内交易灵活');
  if (type === 'QDII') parts.push('全球配置');
  if (name?.includes('C类') || name?.endsWith('C')) parts.push('C类灵活');
  if (industry === '债券') parts.push('稳健防守');

  // 估值状态
  if (valuation === '极低' || valuation === '低估') parts.push('估值底部');
  if (valuation === '高估') parts.push('估值偏高需谨慎');

  return parts.join('+');
}

/**
 * 生成买入建议
 */
function computeBuySuggestion(valuation, trend, returns, buyStatus, dailyLimit) {
  const { return1y } = returns;

  if (buyStatus === '暂停申购') return '暂停申购';
  if (dailyLimit > 0 && dailyLimit <= 100) return '限大额定投';

  // 估值+趋势联合判断
  if ((valuation === '极低' || valuation === '低估') && trend.includes('反弹')) return '左侧布局';
  if ((valuation === '极低' || valuation === '低估') && trend.includes('下跌')) return '分批建仓';
  if ((valuation === '极低' || valuation === '低估')) return '优先配置';
  if ((valuation === '偏低') && (trend.includes('上涨') || trend.includes('反弹'))) return '优先配置';
  if ((valuation === '偏低')) return '逢低布局';
  if ((valuation === '合理') && trend.includes('上涨')) return '可配置';
  if ((valuation === '合理')) return '小额定投';
  if ((valuation === '偏高') && trend.includes('上涨')) return '小额定投';
  if ((valuation === '偏高')) return '观望等待';
  if (valuation === '高估') return '减仓观望';

  // 债券类特殊处理
  if (return1y > 3) return '可配置';
  return '小额定投';
}

/**
 * 增强版评级（综合费率+收益+规模+趋势）
 */
function computeRating(totalFee, return1y, return3m, scale, valuation, trend) {
  let score = 3;

  if (totalFee <= 0.2) score += 1.5;
  else if (totalFee <= 0.6) score += 1;
  else if (totalFee <= 0.8) score += 0.5;
  else if (totalFee > 1.2) score -= 0.5;
  else if (totalFee > 1.5) score -= 1;

  if (return1y > 30) score += 1.5;
  else if (return1y > 20) score += 1;
  else if (return1y > 10) score += 0.5;
  else if (return1y > 0) score += 0;
  else if (return1y < -5) score -= 0.5;
  else if (return1y < -15) score -= 1;

  if (scale > 100) score += 0.5;
  else if (scale > 10) score += 0.25;
  else if (scale < 1) score -= 0.5;

  if (valuation === '极低' || valuation === '低估') score += 0.5;
  else if (valuation === '高估') score -= 0.5;

  if (trend.includes('强势上涨')) score += 0.25;
  else if (trend.includes('下跌') || trend.includes('回调')) score -= 0.25;

  return Math.max(1, Math.min(5, Math.round(score)));
}

/**
 * 对单只金选基金进行完整专业分析
 * @param {Object} fund - 基金基本信息 { code, name, type, industry, indexName, totalFee, scale, buySuggestion, dailyLimit }
 * @param {Object} returns - 收益率 { return1w, return1m, return3m, return6m, return1y }
 * @returns {Object} 分析结果 { valuation, trend, logic, buySuggestion, rating }
 */
function analyzeGoldFund(fund, returns) {
  const valuation = computeValuation(fund.industry, fund.indexName, returns);
  const trend = computeTrend(returns.return1w, returns.return1m, returns.return3m, returns.return6m, returns.return1y);
  const buySuggestion = computeBuySuggestion(valuation, trend, returns, fund.buySuggestion, fund.dailyLimit);
  const logic = computeLogic(fund, returns, valuation, trend, buySuggestion);
  const rating = computeRating(fund.totalFee || 0, returns.return1y, returns.return3m, fund.scale || 0, valuation, trend);

  return { valuation, trend, logic, buySuggestion, rating };
}

module.exports = {
  analyzeGoldFund,
  computeValuation,
  computeTrend,
  computeLogic,
  computeBuySuggestion,
  computeRating,
};
