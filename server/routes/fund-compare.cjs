'use strict';

const express = require('express');
const logger = require('../utils/logger.cjs');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const { getPool } = require('../db.cjs');

const router = express.Router();

// POST /api/fund-compare/analyze — 免费基础对比
router.post('/api/fund-compare/analyze', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes) || codes.length < 2 || codes.length > 5) {
      return res.status(400).json({ error: '请输入2-5只基金代码' });
    }
    const pool = getPool();
    const funds = [];
    const navHistories = {};

    for (const code of codes) {
      const fundRes = await pool.query(
        `SELECT f.*, n.nav, n.nav_date, n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
         FROM funds f LEFT JOIN LATERAL (
           SELECT nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y
           FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
         ) n ON true WHERE f.code = $1`, [code]
      );
      if (fundRes.rows.length > 0) {
        funds.push(fundRes.rows[0]);
      }
      // NAV history for chart
      const navRes = await pool.query(
        'SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 180', [code]
      );
      navHistories[code] = navRes.rows.reverse();
    }

    if (funds.length < 2) {
      return res.status(400).json({ error: '至少需要找到2只有效基金' });
    }

    res.json({ funds, navHistories });
  } catch (e) {
    logger.error('基金对比失败:', e.message);
    res.status(500).json({ error: '对比失败' });
  }
});

// POST /api/fund-compare/premium — 付费深度对比
router.post('/api/fund-compare/premium', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { codes } = req.body;
    if (!codes || !Array.isArray(codes) || codes.length < 2 || codes.length > 5) {
      return res.status(400).json({ error: '请输入2-5只基金代码' });
    }
    const pool = getPool();
    const results = [];

    for (const code of codes) {
      const fundRes = await pool.query(
        `SELECT f.*, n.nav, n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
         FROM funds f LEFT JOIN LATERAL (
           SELECT nav, return_1w, return_1m, return_3m, return_6m, return_1y
           FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
         ) n ON true WHERE f.code = $1`, [code]
      );
      if (fundRes.rows.length === 0) continue;
      const fund = fundRes.rows[0];

      // 获取净值历史计算风险指标
      const navRes = await pool.query(
        'SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date ASC LIMIT 1000', [code]
      );
      const navs = navRes.rows.map(r => parseFloat(r.nav)).filter(n => n > 0);

      let volatility = 0, maxDrawdown = 0, sharpeRatio = 0, calmarRatio = 0;
      if (navs.length >= 10) {
        // 日收益率序列
        const returns = [];
        for (let i = 1; i < navs.length; i++) {
          returns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
        }
        // 年化波动率
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
        volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

        // 最大回撤
        let peak = navs[0];
        for (const nav of navs) {
          if (nav > peak) peak = nav;
          const dd = (peak - nav) / peak;
          if (dd > maxDrawdown) maxDrawdown = dd;
        }
        maxDrawdown = maxDrawdown * 100;

        // 年化收益率（基于历史数据，与波动率使用同一数据源）
        const totalReturn = (navs[navs.length - 1] - navs[0]) / navs[0];
        const years = navs.length / 252;
        const annualReturn = years > 0 ? (Math.pow(1 + totalReturn, 1 / years) - 1) * 100 : 0;

        // 夏普比率（无风险利率2%）
        sharpeRatio = volatility > 0 ? (annualReturn - 2) / volatility : 0;

        // 卡玛比率
        calmarRatio = maxDrawdown > 0 ? annualReturn / maxDrawdown : 0;
      }

      // 3年持有成本估算
      const mgmt = parseFloat(fund.management_fee) || 0.5;
      const custody = parseFloat(fund.custody_fee) || 0.1;
      const svc = parseFloat(fund.service_fee) || 0;
      const cost3y = (mgmt + custody + svc) * 3;

      results.push({
        code: fund.code,
        name: fund.name,
        type: fund.type,
        nav: parseFloat(fund.nav) || 0,
        return1y: parseFloat(fund.return_1y) || 0,
        return6m: parseFloat(fund.return_6m) || 0,
        return3m: parseFloat(fund.return_3m) || 0,
        return1m: parseFloat(fund.return_1m) || 0,
        return1w: parseFloat(fund.return_1w) || 0,
        riskMetrics: {
          volatility: Math.round(volatility * 100) / 100,
          maxDrawdown: Math.round(maxDrawdown * 100) / 100,
          sharpeRatio: Math.round(sharpeRatio * 100) / 100,
          calmarRatio: Math.round(calmarRatio * 100) / 100,
        },
        feeComparison: {
          mgmtFee: mgmt,
          custodyFee: custody,
          serviceFee: svc,
          totalFee: mgmt + custody + svc,
          cost3y: Math.round(cost3y * 100) / 100,
        },
      });
    }

    // 业绩归因：每个时间段谁最优
    const periods = ['return1w', 'return1m', 'return3m', 'return6m', 'return1y'];
    const periodLabels = { return1w: '近1周', return1m: '近1月', return3m: '近3月', return6m: '近6月', return1y: '近1年' };
    const attribution = {};
    for (const p of periods) {
      let best = null, bestVal = -Infinity;
      for (const r of results) {
        if (r[p] > bestVal) { bestVal = r[p]; best = r.code; }
      }
      attribution[p] = { winner: best, value: bestVal, label: periodLabels[p] };
    }

    // 投资建议
    const bestReturn = results.reduce((a, b) => a.return1y > b.return1y ? a : b);
    const bestFee = results.reduce((a, b) => a.feeComparison.totalFee < b.feeComparison.totalFee ? a : b);
    const bestRisk = results.reduce((a, b) => a.riskMetrics.sharpeRatio > b.riskMetrics.sharpeRatio ? a : b);

    res.json({
      results,
      attribution,
      recommendation: {
        shortTerm: `${results.reduce((a, b) => a.return1m > b.return1m ? a : b).code} 近期动量最强`,
        mediumTerm: `${bestReturn.code} 近1年收益最高(${bestReturn.return1y.toFixed(1)}%)`,
        longTerm: `${bestRisk.code} 风险调整后收益最佳(夏普${bestRisk.riskMetrics.sharpeRatio.toFixed(2)})`,
        lowestFee: `${bestFee.code} 费率最低(${bestFee.feeComparison.totalFee.toFixed(2)}%/年)`,
      },
    });
  } catch (e) {
    logger.error('深度对比失败:', e.message);
    res.status(500).json({ error: '深度对比失败' });
  }
});

module.exports = router;
