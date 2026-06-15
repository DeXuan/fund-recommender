/**
 * 共享统计工具 — Sharpe/Sortino/Calmar/最大回撤等风险指标计算
 * 消除 vip-insights 和 holdings-risk 中的重复代码
 */

const RISK_FREE_RATE = 0.02; // 年化无风险利率 2%
const TRADING_DAYS_PER_YEAR = 252;

/**
 * 从价格/净值序列计算日收益率
 * @param {number[]} prices - 价格/净值数组（按时间正序）
 * @returns {number[]} 日收益率数组
 */
function calcDailyReturns(prices) {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * 计算最大回撤（百分比）
 * @param {number[]} prices - 价格/净值数组
 * @returns {number} 最大回撤百分比（0-100）
 */
function calcMaxDrawdown(prices) {
  let maxDD = 0;
  let peak = prices[0];
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return parseFloat((maxDD * 100).toFixed(2));
}

/**
 * 计算年化收益率
 * @param {number[]} prices - 价格/净值数组
 * @returns {{ annualizedReturn: number, returnPeriod: string }}
 */
function calcAnnualizedReturn(prices) {
  const totalDays = prices.length;
  if (totalDays < 2) return { annualizedReturn: 0, returnPeriod: '' };

  const totalPeriodReturn = (prices[totalDays - 1] - prices[0]) / prices[0];

  if (totalDays >= 200) {
    const raw = (Math.pow(1 + totalPeriodReturn, TRADING_DAYS_PER_YEAR / totalDays) - 1) * 100;
    return {
      annualizedReturn: parseFloat(Math.max(-99, Math.min(500, raw)).toFixed(2)),
      returnPeriod: '年化',
    };
  }

  const calendarDays = Math.round((totalDays - 1) * 365 / TRADING_DAYS_PER_YEAR);
  return {
    annualizedReturn: parseFloat((totalPeriodReturn * 100).toFixed(2)),
    returnPeriod: `${calendarDays}天`,
  };
}

/**
 * 计算完整风险指标集（用于 vip-insights 深度分析）
 * @param {number[]} dailyValues - 每日组合净值数组
 * @returns {object} 包含所有风险指标的对象
 */
function calcFullRiskMetrics(dailyValues) {
  const result = {
    annualizedReturn: 0,
    returnPeriod: '',
    maxDrawdown: 0,
    volatility: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    winRate: 0,
    profitLossRatio: 0,
  };

  if (dailyValues.length < 2) return result;

  const dailyReturns = calcDailyReturns(dailyValues);

  // 年化收益率
  const { annualizedReturn, returnPeriod } = calcAnnualizedReturn(dailyValues);
  result.annualizedReturn = annualizedReturn;
  result.returnPeriod = returnPeriod;

  // 最大回撤
  result.maxDrawdown = calcMaxDrawdown(dailyValues);

  // 波动率（年化）
  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  result.volatility = parseFloat(Math.min(200, Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100).toFixed(2));

  // 夏普比率
  const riskFreeDaily = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const excessReturns = dailyReturns.map(r => r - riskFreeDaily);
  const avgExcess = excessReturns.reduce((s, r) => s + r, 0) / excessReturns.length;
  const stdExcess = Math.sqrt(excessReturns.reduce((s, r) => s + Math.pow(r - avgExcess, 2), 0) / excessReturns.length);
  const rawSharpe = stdExcess > 0 ? (avgExcess / stdExcess * Math.sqrt(TRADING_DAYS_PER_YEAR)) : 0;
  result.sharpeRatio = parseFloat(Math.max(-5, Math.min(10, rawSharpe)).toFixed(2));

  // 卡玛比率
  result.calmarRatio = result.maxDrawdown > 0
    ? parseFloat(Math.max(-20, Math.min(20, result.annualizedReturn / result.maxDrawdown)).toFixed(2))
    : 0;

  // 胜率
  const profitDays = dailyReturns.filter(r => r > 0).length;
  result.winRate = parseFloat(((profitDays / dailyReturns.length) * 100).toFixed(2));

  // 盈亏比
  const avgProfit = profitDays > 0
    ? dailyReturns.filter(r => r > 0).reduce((s, r) => s + r, 0) / profitDays
    : 0;
  const lossDays = dailyReturns.length - profitDays;
  const avgLoss = lossDays > 0
    ? Math.abs(dailyReturns.filter(r => r < 0).reduce((s, r) => s + r, 0) / lossDays)
    : 0;
  result.profitLossRatio = avgLoss > 0 ? parseFloat(Math.min(20, avgProfit / avgLoss).toFixed(2)) : 0;

  // 索提诺比率（需要至少20个数据点）
  if (dailyReturns.length >= 20) {
    const downSide = dailyReturns.filter(r => r < riskFreeDaily);
    const downVar = downSide.length > 0
      ? downSide.reduce((s, r) => s + (r - riskFreeDaily) ** 2, 0) / downSide.length
      : 0;
    const downDev = Math.sqrt(downVar) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100;
    result.sortinoRatio = downDev > 0
      ? parseFloat(Math.max(-10, Math.min(20, (result.annualizedReturn - RISK_FREE_RATE * 100) / downDev)).toFixed(2))
      : 0;
  }

  return result;
}

/**
 * 计算简化风险指标（用于 holdings-risk 单只基金分析）
 * @param {number[]} navs - 净值数组（按时间正序）
 * @returns {object|null} 风险指标对象，数据不足返回 null
 */
function calcSimpleRiskMetrics(navs) {
  if (navs.length < 30) return null;

  const returns = calcDailyReturns(navs);
  const n = returns.length;
  if (n < 30) return null;

  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const annualReturn = mean * TRADING_DAYS_PER_YEAR;
  const annualVol = std * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Sharpe
  const riskFreeDaily = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const excess = returns.map(r => r - riskFreeDaily);
  const meanExcess = excess.reduce((s, r) => s + r, 0) / n;
  const sharpe = std > 0 ? (meanExcess / std) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;

  // Sortino
  const downSide = returns.filter(r => r < riskFreeDaily);
  const downVar = downSide.length > 0
    ? downSide.reduce((s, r) => s + (r - riskFreeDaily) ** 2, 0) / downSide.length
    : 0;
  const downDev = Math.sqrt(downVar);
  const sortino = downDev > 0 ? (meanExcess / downDev) * Math.sqrt(TRADING_DAYS_PER_YEAR) : 0;

  // Max Drawdown
  const maxDD = calcMaxDrawdown(navs) / 100; // 转回小数

  // Calmar
  const calmar = maxDD > 0 ? annualReturn / maxDD : 0;

  return {
    sharpe: Math.round(sharpe * 100) / 100,
    sortino: Math.round(sortino * 100) / 100,
    calmar: Math.round(calmar * 100) / 100,
    maxDrawdown: Math.round(maxDD * 10000) / 100,
    annualReturn: Math.round(annualReturn * 10000) / 100,
    annualVolatility: Math.round(annualVol * 10000) / 100,
    dataPoints: n,
  };
}

module.exports = {
  calcDailyReturns,
  calcMaxDrawdown,
  calcAnnualizedReturn,
  calcFullRiskMetrics,
  calcSimpleRiskMetrics,
  RISK_FREE_RATE,
  TRADING_DAYS_PER_YEAR,
};
