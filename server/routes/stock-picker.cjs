'use strict';

const express = require('express');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const { getPool } = require('../db.cjs');

const router = express.Router();

const DEFAULT_FACTORS = {
  return1y: { weight: 0.30, label: '近1年收益', description: '收益率越高得分越高，50%以上边际递减' },
  fee: { weight: 0.15, label: '费率', description: '综合费率越低得分越高' },
  scale: { weight: 0.15, label: '基金规模', description: '规模越大越稳定，100亿以上边际递减' },
  momentum: { weight: 0.20, label: '动量因子', description: '近期涨幅加权，越近权重越高' },
  valuation: { weight: 0.20, label: '估值', description: '基于行业估值分位数，低估加分' },
};

// GET /api/stock-picker/factors
router.get('/api/stock-picker/factors', authMiddleware, subscriptionMiddleware, (req, res) => {
  res.json({ factors: DEFAULT_FACTORS });
});

// POST /api/stock-picker/rank
router.post('/api/stock-picker/rank', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { industry, type, limit = 30, factors: userFactors } = req.body;
    const pool = getPool();
    const factors = userFactors || DEFAULT_FACTORS;

    // 查询基金+最新净值
    let query = `
      SELECT f.code, f.name, f.type, f.industry, f.total_fee, f.scale, f.valuation, f.rating,
             f.management_fee, f.custody_fee, f.service_fee, f.manager,
             n.nav, n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
      FROM funds f
      LEFT JOIN LATERAL (
        SELECT nav, return_1w, return_1m, return_3m, return_6m, return_1y
        FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
      ) n ON true
      WHERE n.nav IS NOT NULL
    `;
    const params = [];
    if (industry) { params.push(industry); query += ` AND f.industry = $${params.length}`; }
    if (type) { params.push(type); query += ` AND f.type = $${params.length}`; }
    const result = await pool.query(query, params);
    const funds = result.rows;

    // 评分函数
    function scoreFund(fund) {
      const breakdown = {};
      const r1y = parseFloat(fund.return_1y) || 0;
      const r6m = parseFloat(fund.return_6m) || 0;
      const r3m = parseFloat(fund.return_3m) || 0;
      const r1m = parseFloat(fund.return_1m) || 0;
      const r1w = parseFloat(fund.return_1w) || 0;
      const fee = parseFloat(fund.total_fee) || 0.6;
      const scale = parseFloat(fund.scale) || 0;

      // 收益得分：50%以上边际递减
      const returnScore = r1y > 50 ? (50 + (r1y - 50) * 0.3) / 100 : r1y / 100;
      breakdown.return1y = Math.min(1, Math.max(0, returnScore));

      // 费率得分：越低越好，0.2%得1分，1.5%得0分
      breakdown.fee = Math.min(1, Math.max(0, (1.5 - fee) / 1.3));

      // 规模得分：对数标准化
      const logScale = scale > 0 ? Math.log10(scale) : 0;
      breakdown.scale = Math.min(1, logScale / 3);

      // 动量得分：近期加权（1周50% + 1月30% + 3月20%）
      const momentumScore = (r1w * 0.5 + r1m * 0.3 + r3m * 0.2) / 20;
      breakdown.momentum = Math.min(1, Math.max(0, momentumScore));

      // 估值得分：基于行业估值
      let valScore = 0.5;
      if (fund.valuation === '低估') valScore = 0.9;
      else if (fund.valuation === '合理') valScore = 0.6;
      else if (fund.valuation === '高估') valScore = 0.2;
      breakdown.valuation = valScore;

      // 综合评分
      let total = 0;
      for (const [key, f] of Object.entries(factors)) {
        if (breakdown[key] !== undefined && f.weight) {
          total += breakdown[key] * f.weight;
        }
      }

      // 推荐理由
      const reasons = [];
      if (breakdown.return1y > 0.6) reasons.push(`近1年收益${r1y.toFixed(1)}%表现优秀`);
      if (breakdown.fee > 0.7) reasons.push(`综合费率${fee.toFixed(2)}%较低`);
      if (breakdown.scale > 0.6) reasons.push(`规模${scale.toFixed(1)}亿稳定性好`);
      if (breakdown.momentum > 0.5) reasons.push('近期动量强劲');
      if (breakdown.valuation > 0.7) reasons.push('当前估值较低');
      const reasoning = reasons.length > 0 ? reasons.join('；') : '综合指标均衡';

      return { score: total, breakdown, reasoning };
    }

    // 评分排序
    const ranked = funds.map(fund => {
      const { score, breakdown, reasoning } = scoreFund(fund);
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

// POST /api/stock-picker/portfolio — 一键建仓建议
router.post('/api/stock-picker/portfolio', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { topN = 5, budget = 10000, strategy = 'balanced' } = req.body;
    const pool = getPool();

    // 复用选股逻辑获取 top N
    const result = await pool.query(`
      SELECT f.code, f.name, f.type, f.industry, f.total_fee, f.scale, f.valuation,
             n.return_1y, n.return_1m, n.return_3m, n.return_1w
      FROM funds f
      LEFT JOIN LATERAL (
        SELECT return_1y, return_1m, return_3m, return_1w
        FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
      ) n ON true
      WHERE n.return_1y IS NOT NULL
      ORDER BY n.return_1y DESC NULLS LAST LIMIT 50
    `);

    // 简单评分选 top N
    const scored = result.rows.map(f => {
      const r1y = parseFloat(f.return_1y) || 0;
      const fee = parseFloat(f.total_fee) || 0.6;
      const scale = parseFloat(f.scale) || 0;
      return {
        code: f.code, name: f.name, industry: f.industry,
        score: r1y * 0.4 + (1.5 - fee) * 20 + Math.log10(scale || 1) * 10,
        return1y: r1y, totalFee: fee, scale,
      };
    }).sort((a, b) => b.score - a.score).slice(0, topN);

    // 等权分配
    const perFund = Math.round(budget / topN);
    const allocation = scored.map(f => ({
      ...f,
      amount: perFund,
      weight: Math.round(100 / topN),
    }));

    res.json({ allocation, totalBudget: budget, perFund, strategy });
  } catch (e) {
    console.error('建仓建议失败:', e.message);
    res.status(500).json({ error: '建仓建议失败' });
  }
});

module.exports = router;
