'use strict';

const express = require('express');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const { getPool } = require('../db.cjs');
const { queryFundsForScoring } = require('../fund-service.cjs');

const router = express.Router();

const DEFAULT_FACTORS = {
  return1y: { weight: 0.30, label: '近1年收益', description: '收益率越高得分越高，50%以上边际递减' },
  fee: { weight: 0.15, label: '费率', description: '综合费率越低得分越高' },
  scale: { weight: 0.15, label: '基金规模', description: '规模越大越稳定，100亿以上边际递减' },
  momentum: { weight: 0.20, label: '动量因子', description: '近期涨幅加权，越近权重越高' },
  valuation: { weight: 0.20, label: '估值', description: '基于行业估值分位数，低估加分' },
};

// 共享评分函数
function scoreFund(fund, factors) {
  const breakdown = {};
  const r1y = parseFloat(fund.return_1y) || 0;
  const r3m = parseFloat(fund.return_3m) || 0;
  const r1m = parseFloat(fund.return_1m) || 0;
  const r1w = parseFloat(fund.return_1w) || 0;
  const fee = parseFloat(fund.total_fee) || 0.6;
  const scale = parseFloat(fund.scale) || 0;

  const returnScore = r1y > 50 ? (50 + (r1y - 50) * 0.3) / 100 : r1y / 100;
  breakdown.return1y = Math.min(1, Math.max(0, returnScore));
  breakdown.fee = Math.min(1, Math.max(0, (1.5 - fee) / 1.3));
  const logScale = scale > 0 ? Math.log10(scale) : 0;
  breakdown.scale = Math.min(1, logScale / 3);
  const momentumScore = (r1w * 0.5 + r1m * 0.3 + r3m * 0.2) / 20;
  breakdown.momentum = Math.min(1, Math.max(0, momentumScore));
  let valScore = 0.5;
  if (fund.valuation === '低估') valScore = 0.9;
  else if (fund.valuation === '合理') valScore = 0.6;
  else if (fund.valuation === '高估') valScore = 0.2;
  breakdown.valuation = valScore;

  let total = 0;
  for (const [key, f] of Object.entries(factors)) {
    if (breakdown[key] !== undefined && f.weight) {
      total += breakdown[key] * f.weight;
    }
  }

  const reasons = [];
  if (breakdown.return1y > 0.6) reasons.push(`近1年收益${r1y.toFixed(1)}%表现优秀`);
  if (breakdown.fee > 0.7) reasons.push(`综合费率${fee.toFixed(2)}%较低`);
  if (breakdown.scale > 0.6) reasons.push(`规模${scale.toFixed(1)}亿稳定性好`);
  if (breakdown.momentum > 0.5) reasons.push('近期动量强劲');
  if (breakdown.valuation > 0.7) reasons.push('当前估值较低');
  const reasoning = reasons.length > 0 ? reasons.join('；') : '综合指标均衡';

  return { score: total, breakdown, reasoning };
}

// GET /api/stock-picker/factors
router.get('/api/stock-picker/factors', authMiddleware, subscriptionMiddleware, (req, res) => {
  try {
    res.json({ factors: DEFAULT_FACTORS });
  } catch (e) {
    console.error('获取因子配置失败:', e.message);
    res.status(500).json({ error: '获取因子配置失败' });
  }
});

// POST /api/stock-picker/rank
router.post('/api/stock-picker/rank', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { industry, type, limit = 30, factors: userFactors } = req.body;
    const factors = userFactors || DEFAULT_FACTORS;

    const funds = await queryFundsForScoring({ industry, type });

    // 评分排序（使用共享评分函数）
    const ranked = funds.map(fund => {
      const { score, breakdown, reasoning } = scoreFund(fund, factors);
      return {
        fund: {
          code: fund.code,
          name: fund.name,
          type: fund.type,
          industry: fund.industry,
          nav: parseFloat(fund.nav) || 0,
          return1y: parseFloat(fund.return_1y) || 0,
          return6m: parseFloat(fund.return_6m) || 0,
          return3m: parseFloat(fund.return_3m) || 0,
          return1m: parseFloat(fund.return_1m) || 0,
          return1w: parseFloat(fund.return_1w) || 0,
          totalFee: parseFloat(fund.total_fee) || 0,
          mgmtFee: parseFloat(fund.management_fee) || 0,
          custodyFee: parseFloat(fund.custody_fee) || 0,
          scale: parseFloat(fund.scale) || 0,
          rating: fund.rating,
          manager: fund.manager || '',
        },
        score: Math.round(score * 1000) / 10,
        breakdown: {
          return1y: Math.round(breakdown.return1y * 100),
          fee: Math.round(breakdown.fee * 100),
          scale: Math.round(breakdown.scale * 100),
          momentum: Math.round(breakdown.momentum * 100),
          valuation: Math.round(breakdown.valuation * 100),
        },
        reasoning,
      };
    }).sort((a, b) => b.score - a.score).slice(0, limit);

    // 行业统计
    const industryStats = {};
    ranked.forEach(r => {
      const ind = r.fund.industry;
      if (!industryStats[ind]) industryStats[ind] = { count: 0, totalScore: 0, avgReturn: 0, totalReturn: 0 };
      industryStats[ind].count++;
      industryStats[ind].totalScore += r.score;
      industryStats[ind].totalReturn += r.fund.return1y;
    });
    Object.values(industryStats).forEach(s => {
      s.avgScore = Math.round(s.totalScore / s.count * 10) / 10;
      s.avgReturn = Math.round(s.totalReturn / s.count * 10) / 10;
    });

    res.json({ ranked, total: funds.length, factors, industryStats });
  } catch (e) {
    console.error('AI选股失败:', e.message);
    res.status(500).json({ error: '选股失败' });
  }
});

// POST /api/stock-picker/backtest — 回测模拟（top N 等权组合 vs 沪深300）
router.post('/api/stock-picker/backtest', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { codes, days = 180 } = req.body;
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: '请提供基金代码' });
    }
    const pool = getPool();
    const limit = Math.min(days, 365);

    // 获取每只基金的净值历史
    const fundHistories = {};
    for (const code of codes.slice(0, 10)) {
      const navRes = await pool.query(
        'SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT $2',
        [code, limit]
      );
      fundHistories[code] = navRes.rows.reverse();
    }

    // 获取沪深300基准（用 market_indices 里最近的价格，或从基金净值推算）
    const hs300NavRes = await pool.query(
      'SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT $2',
      ['110020', limit] // 易方达沪深300ETF联接A
    );
    const hs300History = hs300NavRes.rows.reverse();

    // 计算等权组合净值（归一化到100）
    const allDates = new Set();
    Object.values(fundHistories).forEach(h => h.forEach(r => allDates.add(r.nav_date.toISOString().slice(0, 10))));
    hs300History.forEach(r => allDates.add(r.nav_date.toISOString().slice(0, 10)));
    const sortedDates = [...allDates].sort();

    // 为每只基金建立日期->净值映射
    const fundMaps = {};
    for (const [code, history] of Object.entries(fundHistories)) {
      fundMaps[code] = {};
      history.forEach(r => { fundMaps[code][r.nav_date.toISOString().slice(0, 10)] = parseFloat(r.nav); });
    }
    const hs300Map = {};
    hs300History.forEach(r => { hs300Map[r.nav_date.toISOString().slice(0, 10)] = parseFloat(r.nav); });

    // 找到所有基金都有数据的起始日期
    const validCodes = Object.keys(fundHistories);
    const startDate = sortedDates.find(date => validCodes.every(code => fundMaps[code][date]));
    if (!startDate) return res.json({ dates: [], portfolio: [], benchmark: [], summary: null });

    const startIdx = sortedDates.indexOf(startDate);
    const activeDates = sortedDates.slice(startIdx);

    // 计算组合和基准的归一化净值（起点=100）
    const portfolio = [];
    const benchmark = [];
    const baseValues = {};
    validCodes.forEach(code => { baseValues[code] = fundMaps[code][startDate]; });
    const hs300Base = hs300Map[startDate] || 1;

    for (const date of activeDates) {
      // 等权组合
      let avgReturn = 0;
      let validCount = 0;
      validCodes.forEach(code => {
        if (fundMaps[code][date]) {
          avgReturn += (fundMaps[code][date] / baseValues[code] - 1);
          validCount++;
        }
      });
      if (validCount > 0) {
        portfolio.push({ date, value: 100 * (1 + avgReturn / validCount) });
      }
      // 基准
      if (hs300Map[date]) {
        benchmark.push({ date, value: 100 * (hs300Map[date] / hs300Base) });
      }
    }

    // 计算摘要
    const portReturn = portfolio.length > 1 ? (portfolio[portfolio.length - 1].value / 100 - 1) * 100 : 0;
    const benchReturn = benchmark.length > 1 ? (benchmark[benchmark.length - 1].value / 100 - 1) * 100 : 0;
    const alpha = portReturn - benchReturn;

    // 最大回撤
    let maxDD = 0, peak = 100;
    portfolio.forEach(p => {
      if (p.value > peak) peak = p.value;
      const dd = (peak - p.value) / peak;
      if (dd > maxDD) maxDD = dd;
    });

    // 胜率（组合跑赢基准的天数占比）
    let winDays = 0;
    const minLen = Math.min(portfolio.length, benchmark.length);
    for (let i = 0; i < minLen; i++) {
      if (portfolio[i].value > benchmark[i].value) winDays++;
    }

    res.json({
      dates: portfolio.map(p => p.date),
      portfolio: portfolio.map(p => Math.round(p.value * 100) / 100),
      benchmark: benchmark.map(p => Math.round(p.value * 100) / 100),
      summary: {
        portReturn: Math.round(portReturn * 100) / 100,
        benchReturn: Math.round(benchReturn * 100) / 100,
        alpha: Math.round(alpha * 100) / 100,
        maxDrawdown: Math.round(maxDD * 10000) / 100,
        winRate: minLen > 0 ? Math.round(winDays / minLen * 100) : 0,
        days: portfolio.length,
        funds: validCodes.length,
      },
    });
  } catch (e) {
    console.error('回测失败:', e.message);
    res.status(500).json({ error: '回测失败' });
  }
});

// POST /api/stock-picker/portfolio — 一键建仓建议（复用 /rank 评分逻辑）
router.post('/api/stock-picker/portfolio', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { topN = 5, budget = 10000, strategy = 'balanced', factors: userFactors, industry, type } = req.body;
    const factors = userFactors || DEFAULT_FACTORS;

    const result = { rows: await queryFundsForScoring({ industry, type }) };

    // 使用共享评分函数
    const scored = result.rows.map(f => {
      const { score, breakdown, reasoning } = scoreFund(f, factors);
      return {
        code: f.code,
        name: f.name,
        industry: f.industry,
        score: Math.round(score * 1000) / 10,
        breakdown: {
          return1y: Math.round(breakdown.return1y * 100),
          fee: Math.round(breakdown.fee * 100),
          scale: Math.round(breakdown.scale * 100),
          momentum: Math.round(breakdown.momentum * 100),
          valuation: Math.round(breakdown.valuation * 100),
        },
        return1y: parseFloat(f.return_1y) || 0,
        return6m: parseFloat(f.return_6m) || 0,
        return3m: parseFloat(f.return_3m) || 0,
        totalFee: parseFloat(f.total_fee) || 0,
        mgmtFee: parseFloat(f.management_fee) || 0,
        custodyFee: parseFloat(f.custody_fee) || 0,
        scale: parseFloat(f.scale) || 0,
        manager: f.manager || '',
        reasoning,
      };
    }).sort((a, b) => b.score - a.score).slice(0, topN);

    // 等权分配
    const perFund = Math.round(budget / topN);
    const allocation = scored.map(f => ({
      ...f,
      amount: perFund,
      weight: Math.round(100 / topN),
    }));

    res.json({ allocation, totalBudget: budget, perFund, strategy, factors });
  } catch (e) {
    console.error('建仓建议失败:', e.message);
    res.status(500).json({ error: '建仓建议失败' });
  }
});

// GET /api/stock-picker/market-overview — 市场环境总览
router.get('/api/stock-picker/market-overview', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const pool = getPool();

    // 主要指数估值
    const indicesRes = await pool.query(
      'SELECT code, name, price, change_percent, pe, pb, pe_percentile, pb_percentile, valuation, suggestion FROM market_indices ORDER BY code'
    );

    // 板块涨幅（最近交易日）
    const sectorRes = await pool.query(
      'SELECT name, change_percent, volume, leading_stock FROM sector_data WHERE trade_date = (SELECT MAX(trade_date) FROM sector_data) ORDER BY change_percent DESC'
    );

    // 资金流向（从缓存获取）
    let capitalFlow = null;
    try {
      const { getCachedCapitalFlow } = require('../data-fetcher.cjs');
      capitalFlow = getCachedCapitalFlow();
    } catch (e) {
      console.error('获取资金流向数据失败:', e.message);
    }

    // 行业估值分布
    const industryValRes = await pool.query(`
      SELECT f.industry,
             COUNT(*) as fund_count,
             COUNT(CASE WHEN f.valuation = '低估' THEN 1 END) as low_count,
             COUNT(CASE WHEN f.valuation = '合理' THEN 1 END) as fair_count,
             COUNT(CASE WHEN f.valuation = '高估' THEN 1 END) as high_count,
             AVG(n.return_1y) as avg_return_1y
      FROM funds f
      LEFT JOIN LATERAL (
        SELECT return_1y FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
      ) n ON true
      WHERE f.industry IS NOT NULL
      GROUP BY f.industry
      ORDER BY avg_return_1y DESC NULLS LAST
    `);

    // 市场情绪指标
    const sentimentRes = await pool.query(`
      SELECT
        COUNT(*) as total_funds,
        COUNT(CASE WHEN n.return_1w > 0 THEN 1 END) as up_1w,
        COUNT(CASE WHEN n.return_1m > 0 THEN 1 END) as up_1m,
        COUNT(CASE WHEN n.return_3m > 0 THEN 1 END) as up_3m,
        AVG(n.return_1w) as avg_return_1w,
        AVG(n.return_1m) as avg_return_1m,
        AVG(n.return_3m) as avg_return_3m
      FROM funds f
      LEFT JOIN LATERAL (
        SELECT return_1w, return_1m, return_3m FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
      ) n ON true
      WHERE n.return_1w IS NOT NULL
    `);

    const sentiment = sentimentRes.rows[0] || {};
    const totalFunds = parseInt(sentiment.total_funds) || 1;

    res.json({
      indices: indicesRes.rows,
      sectors: sectorRes.rows,
      capitalFlow,
      industryValuation: industryValRes.rows.map(r => ({
        industry: r.industry,
        fundCount: parseInt(r.fund_count),
        lowCount: parseInt(r.low_count),
        fairCount: parseInt(r.fair_count),
        highCount: parseInt(r.high_count),
        avgReturn1y: parseFloat(r.avg_return_1y) || 0,
      })),
      sentiment: {
        totalFunds,
        upRatio1w: Math.round(parseInt(sentiment.up_1w || 0) / totalFunds * 100),
        upRatio1m: Math.round(parseInt(sentiment.up_1m || 0) / totalFunds * 100),
        upRatio3m: Math.round(parseInt(sentiment.up_3m || 0) / totalFunds * 100),
        avgReturn1w: parseFloat(sentiment.avg_return_1w) || 0,
        avgReturn1m: parseFloat(sentiment.avg_return_1m) || 0,
        avgReturn3m: parseFloat(sentiment.avg_return_3m) || 0,
      },
    });
  } catch (e) {
    console.error('市场环境数据获取失败:', e.message);
    res.status(500).json({ error: '市场环境数据获取失败' });
  }
});

// POST /api/stock-picker/strategy-compare — 策略对比
router.post('/api/stock-picker/strategy-compare', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { industry, type, limit = 10 } = req.body;

    const strategies = {
      aggressive: { return1y: 0.40, fee: 0.05, scale: 0.05, momentum: 0.35, valuation: 0.15 },
      balanced: { return1y: 0.30, fee: 0.15, scale: 0.15, momentum: 0.20, valuation: 0.20 },
      conservative: { return1y: 0.15, fee: 0.25, scale: 0.25, momentum: 0.10, valuation: 0.25 },
      value: { return1y: 0.20, fee: 0.15, scale: 0.10, momentum: 0.10, valuation: 0.45 },
    };

    const funds = await queryFundsForScoring({ industry, type });

    // 对每个策略进行评分
    const strategyResults = {};
    for (const [name, factors] of Object.entries(strategies)) {
      const ranked = funds.map(fund => {
        const { score, breakdown, reasoning } = scoreFund(fund, factors);
        return {
          code: fund.code,
          name: fund.name,
          industry: fund.industry,
          score: Math.round(score * 1000) / 10,
          breakdown,
          return1y: parseFloat(fund.return_1y) || 0,
          totalFee: parseFloat(fund.total_fee) || 0,
        };
      }).sort((a, b) => b.score - a.score).slice(0, limit);

      const avgScore = ranked.reduce((s, r) => s + r.score, 0) / (ranked.length || 1);
      const avgReturn = ranked.reduce((s, r) => s + r.return1y, 0) / (ranked.length || 1);

      strategyResults[name] = {
        topFunds: ranked,
        avgScore: Math.round(avgScore * 10) / 10,
        avgReturn: Math.round(avgReturn * 10) / 10,
        top1Score: ranked[0]?.score || 0,
        top1Name: ranked[0]?.name || '',
      };
    }

    // 计算策略间重叠度
    const overlap = {};
    const strategyNames = Object.keys(strategyResults);
    for (let i = 0; i < strategyNames.length; i++) {
      for (let j = i + 1; j < strategyNames.length; j++) {
        const a = new Set(strategyResults[strategyNames[i]].topFunds.map(f => f.code));
        const b = new Set(strategyResults[strategyNames[j]].topFunds.map(f => f.code));
        const common = [...a].filter(x => b.has(x)).length;
        overlap[`${strategyNames[i]}_${strategyNames[j]}`] = {
          common,
          rate: Math.round(common / limit * 100),
        };
      }
    }

    res.json({ strategies: strategyResults, overlap, totalFunds: funds.length });
  } catch (e) {
    console.error('策略对比失败:', e.message);
    res.status(500).json({ error: '策略对比失败' });
  }
});

// POST /api/stock-picker/deep-analysis — 深度分析
router.post('/api/stock-picker/deep-analysis', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({ error: '请提供基金代码' });
    }
    const pool = getPool();
    const results = [];
    const slicedCodes = codes.slice(0, 10);

    // 批量查询基金基本信息
    const fundsRes = await pool.query('SELECT * FROM funds WHERE code = ANY($1)', [slicedCodes]);
    const fundsMap = new Map(fundsRes.rows.map(f => [f.code, f]));

    // 批量查询NAV历史（每个基金取最近250个交易日）
    const navRes = await pool.query(
      'SELECT fund_code, nav, nav_date FROM fund_nav WHERE fund_code = ANY($1) ORDER BY fund_code, nav_date DESC',
      [slicedCodes]
    );
    const navMap = new Map();
    for (const row of navRes.rows) {
      if (!navMap.has(row.fund_code)) navMap.set(row.fund_code, []);
      const arr = navMap.get(row.fund_code);
      if (arr.length < 250) arr.push(row);
    }

    for (const code of slicedCodes) {
      const fund = fundsMap.get(code);
      if (!fund) continue;

      const navRows = navMap.get(code) || [];
      const navHistory = navRows.reverse();

      if (navHistory.length < 30) continue;

      // 计算风险指标
      const navs = navHistory.map(r => parseFloat(r.nav));
      const returns = [];
      for (let i = 1; i < navs.length; i++) {
        returns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
      }

      // 年化收益率
      const totalReturn = (navs[navs.length - 1] - navs[0]) / navs[0];
      const tradingDays = navHistory.length;
      const annualizedReturn = Math.pow(1 + totalReturn, 250 / tradingDays) - 1;

      // 年化波动率
      const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const dailyVol = Math.sqrt(variance);
      const annualizedVol = dailyVol * Math.sqrt(250);

      // 夏普比率（假设无风险利率2%）
      const riskFreeRate = 0.02;
      const sharpe = annualizedVol > 0 ? (annualizedReturn - riskFreeRate) / annualizedVol : 0;

      // 最大回撤
      let maxDrawdown = 0, peak = navs[0];
      const drawdowns = [];
      for (const nav of navs) {
        if (nav > peak) peak = nav;
        const dd = (peak - nav) / peak;
        drawdowns.push(dd);
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      // 卡玛比率
      const calmar = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

      // 索提诺比率（只考虑下行波动率）
      const dailyRf = riskFreeRate / 250;
      const downVariance = returns.reduce((s, r) => {
        const diff = Math.min(r - dailyRf, 0);
        return s + diff * diff;
      }, 0) / returns.length;
      const downVol = Math.sqrt(downVariance) * Math.sqrt(250);
      const sortino = downVol > 0 ? (annualizedReturn - riskFreeRate) / downVol : 0;

      // 胜率
      const winDays = returns.filter(r => r > 0).length;
      const winRate = returns.length > 0 ? winDays / returns.length : 0;

      // 盈亏比
      const avgWin = returns.filter(r => r > 0).reduce((s, r) => s + r, 0) / (winDays || 1);
      const avgLoss = returns.filter(r => r < 0).reduce((s, r) => s + r, 0) / (returns.length - winDays || 1);
      const profitLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

      // 连续下跌天数
      let maxConsecutiveDown = 0, currentDown = 0;
      for (const r of returns) {
        if (r < 0) { currentDown++; maxConsecutiveDown = Math.max(maxConsecutiveDown, currentDown); }
        else currentDown = 0;
      }

      // 月度收益分布
      const monthlyReturns = {};
      navHistory.forEach((r, i) => {
        const month = r.nav_date.toISOString().slice(0, 7);
        if (!monthlyReturns[month]) monthlyReturns[month] = { start: navs[i], end: navs[i] };
        monthlyReturns[month].end = navs[i];
      });
      const monthlyReturnList = Object.entries(monthlyReturns).map(([month, data]) => ({
        month,
        return: ((data.end - data.start) / data.start * 100),
      })).slice(-12);

      results.push({
        code: fund.code,
        name: fund.name,
        industry: fund.industry,
        manager: fund.manager,
        scale: parseFloat(fund.scale) || 0,
        totalFee: parseFloat(fund.total_fee) || 0,
        metrics: {
          annualizedReturn: Math.round(annualizedReturn * 10000) / 100,
          annualizedVol: Math.round(annualizedVol * 10000) / 100,
          sharpe: Math.round(sharpe * 100) / 100,
          calmar: Math.round(calmar * 100) / 100,
          sortino: Math.round(sortino * 100) / 100,
          maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
          winRate: Math.round(winRate * 100),
          profitLossRatio: Math.round(profitLossRatio * 100) / 100,
          maxConsecutiveDown,
          totalReturn: Math.round(totalReturn * 10000) / 100,
        },
        monthlyReturns: monthlyReturnList.map(m => ({ ...m, return: Math.round(m.return * 100) / 100 })),
        navHistory: navHistory.slice(-60).map(r => ({
          date: r.nav_date.toISOString().slice(0, 10),
          nav: parseFloat(r.nav),
        })),
      });
    }

    res.json({ results });
  } catch (e) {
    console.error('深度分析失败:', e.message);
    res.status(500).json({ error: '深度分析失败' });
  }
});

// POST /api/stock-picker/quant-picks — 量化精选（更严格筛选）
router.post('/api/stock-picker/quant-picks', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const rows = await queryFundsForScoring({ requireReturn1y: true });
    const result = { rows };

    // 量化精选条件（比普通排名更严格）
    const picks = result.rows.filter(f => {
      const r1y = parseFloat(f.return_1y) || 0;
      const r3m = parseFloat(f.return_3m) || 0;
      const r1m = parseFloat(f.return_1m) || 0;
      const fee = parseFloat(f.total_fee) || 99;
      const scale = parseFloat(f.scale) || 0;
      const rating = f.rating;

      // 硬性筛选条件
      if (r1y < 5) return false;           // 近1年收益 >= 5%
      if (r3m < -5) return false;          // 近3月不能太差
      if (fee > 1.5) return false;         // 费率 <= 1.5%
      if (scale < 1) return false;         // 规模 >= 1亿
      if (rating && rating < 3) return false; // 评分 >= 3

      return true;
    });

    // 综合评分（加入更多因子）
    const scored = picks.map(f => {
      const r1y = parseFloat(f.return_1y) || 0;
      const r6m = parseFloat(f.return_6m) || 0;
      const r3m = parseFloat(f.return_3m) || 0;
      const r1m = parseFloat(f.return_1m) || 0;
      const r1w = parseFloat(f.return_1w) || 0;
      const fee = parseFloat(f.total_fee) || 0.6;
      const scale = parseFloat(f.scale) || 0;

      // 收益得分
      const returnScore = r1y > 50 ? (50 + (r1y - 50) * 0.3) / 100 : r1y / 100;

      // 费率得分
      const feeScore = Math.min(1, Math.max(0, (1.5 - fee) / 1.3));

      // 规模得分
      const logScale = scale > 0 ? Math.log10(scale) : 0;
      const scaleScore = Math.min(1, logScale / 3);

      // 动量得分（加权近期）
      const momentumScore = (r1w * 0.4 + r1m * 0.3 + r3m * 0.2 + r6m * 0.1) / 20;

      // 稳定性得分（收益持续性）
      const returns = [r1w, r1m, r3m, r6m].filter(r => r !== 0);
      const positiveCount = returns.filter(r => r > 0).length;
      const stabilityScore = returns.length > 0 ? positiveCount / returns.length : 0.5;

      // 估值得分
      let valScore = 0.5;
      if (f.valuation === '低估') valScore = 0.9;
      else if (f.valuation === '合理') valScore = 0.6;
      else if (f.valuation === '高估') valScore = 0.2;

      // 综合评分（6因子）
      const total = returnScore * 0.25 + feeScore * 0.15 + scaleScore * 0.15
        + Math.min(1, Math.max(0, momentumScore)) * 0.20 + stabilityScore * 0.10 + valScore * 0.15;

      const reasons = [];
      if (returnScore > 0.6) reasons.push(`年化收益${r1y.toFixed(1)}%优秀`);
      if (feeScore > 0.7) reasons.push(`费率${fee.toFixed(2)}%低廉`);
      if (momentumScore > 0.3) reasons.push('近期动量强劲');
      if (stabilityScore >= 0.75) reasons.push('收益持续稳定');
      if (valScore > 0.7) reasons.push('估值处于低位');
      if (scaleScore > 0.6) reasons.push(`规模${scale.toFixed(0)}亿`);

      return {
        code: f.code,
        name: f.name,
        type: f.type,
        industry: f.industry,
        manager: f.manager || '',
        score: Math.round(total * 1000) / 10,
        breakdown: {
          return: Math.round(returnScore * 100),
          fee: Math.round(feeScore * 100),
          scale: Math.round(scaleScore * 100),
          momentum: Math.round(Math.min(1, Math.max(0, momentumScore)) * 100),
          stability: Math.round(stabilityScore * 100),
          valuation: Math.round(valScore * 100),
        },
        return1y: r1y,
        return6m: r6m,
        return3m: r3m,
        return1m: r1m,
        totalFee: fee,
        scale,
        reasoning: reasons.length > 0 ? reasons.join('；') : '综合指标均衡',
      };
    }).sort((a, b) => b.score - a.score).slice(0, 20);

    // 行业分布
    const industryStats = {};
    scored.forEach(r => {
      if (!industryStats[r.industry]) industryStats[r.industry] = { count: 0, avgScore: 0, totalScore: 0 };
      industryStats[r.industry].count++;
      industryStats[r.industry].totalScore += r.score;
    });
    Object.values(industryStats).forEach(s => {
      s.avgScore = Math.round(s.totalScore / s.count * 10) / 10;
    });

    res.json({
      picks: scored,
      totalScanned: result.rows.length,
      passedFilter: picks.length,
      industryStats,
      criteria: {
        minReturn1y: '5%',
        minReturn3m: '-5%',
        maxFee: '1.5%',
        minScale: '1亿',
        minRating: '3星',
      },
    });
  } catch (e) {
    console.error('量化精选失败:', e.message);
    res.status(500).json({ error: '量化精选失败' });
  }
});

module.exports = router;
