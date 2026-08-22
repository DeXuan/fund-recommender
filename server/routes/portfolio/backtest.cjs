const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
router.use(authMiddleware);

router.post('/backtest', async (req, res) => {
  try {
    const pool = getPool();
    const { funds, start_date, end_date, initial_capital = 10000 } = req.body;

    if (!Array.isArray(funds) || funds.length === 0) {
      return res.status(400).json({ error: '请选择至少一只基金' });
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ error: '请选择回测时间范围' });
    }

    const totalWeight = funds.reduce((s, f) => s + (Number(f.weight) || 0), 0);
    if (totalWeight <= 0) {
      return res.status(400).json({ error: '权重总和必须大于0' });
    }
    const normalizedFunds = funds.map(f => ({ fund_code: f.fund_code, weight: Number(f.weight) / totalWeight }));

    const codes = normalizedFunds.map(f => f.fund_code);
    const navRes = await pool.query(
      `SELECT fund_code, nav, nav_date FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= $2 AND nav_date <= $3
       ORDER BY nav_date`,
      [codes, start_date, end_date]
    );

    if (navRes.rows.length === 0) {
      return res.json({ dailyValues: [], stats: null, message: '所选时间范围内无净值数据' });
    }

    const navByDate = new Map();
    const navByCode = {};
    for (const row of navRes.rows) {
      if (!navByDate.has(row.nav_date)) navByDate.set(row.nav_date, {});
      navByDate.get(row.nav_date)[row.fund_code] = parseFloat(row.nav);
      if (!navByCode[row.fund_code]) navByCode[row.fund_code] = [];
      navByCode[row.fund_code].push({ date: row.nav_date, nav: parseFloat(row.nav) });
    }

    const sortedDates = Array.from(navByDate.keys()).sort();
    const firstDate = sortedDates[0];
    const firstNavs = navByDate.get(firstDate);

    const fundsWithStart = normalizedFunds.filter(f => firstNavs[f.fund_code] !== undefined);
    if (fundsWithStart.length === 0) {
      return res.json({ dailyValues: [], stats: null, message: '起始日期无可用净值' });
    }

    const dailyValues = [];
    const dailyReturns = [];
    let prevValue = initial_capital;

    for (const date of sortedDates) {
      const navs = navByDate.get(date);
      let value = 0;
      let hasAll = true;
      for (const f of fundsWithStart) {
        const nav = navs[f.fund_code];
        if (nav === undefined) { hasAll = false; break; }
        const startNav = firstNavs[f.fund_code];
        value += f.weight * initial_capital * (nav / startNav);
      }
      if (!hasAll) continue;

      const dailyReturn = prevValue > 0 ? (value - prevValue) / prevValue : 0;
      dailyReturns.push(dailyReturn);
      dailyValues.push({ date: typeof date === 'string' ? date : date.toISOString().slice(0, 10), portfolio_value: Math.round(value * 100) / 100 });
      prevValue = value;
    }

    if (dailyValues.length < 2) {
      return res.json({ dailyValues, stats: null, message: '数据不足，至少需要2个交易日' });
    }

    const finalValue = dailyValues[dailyValues.length - 1].portfolio_value;
    const totalReturn = (finalValue - initial_capital) / initial_capital;
    const days = dailyValues.length;
    const years = days / 252;
    const annualizedReturn = years > 0 ? Math.pow(finalValue / initial_capital, 1 / years) - 1 : 0;

    let peak = dailyValues[0].portfolio_value;
    let maxDrawdown = 0;
    for (const dv of dailyValues) {
      if (dv.portfolio_value > peak) peak = dv.portfolio_value;
      const dd = (peak - dv.portfolio_value) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const avgDailyReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252);
    const sharpe = volatility > 0 ? (annualizedReturn - 0.03) / volatility : 0;
    const calmar = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    res.json({
      dailyValues,
      stats: {
        total_return: Math.round(totalReturn * 10000) / 100,
        annualized_return: Math.round(annualizedReturn * 10000) / 100,
        max_drawdown: Math.round(maxDrawdown * 10000) / 100,
        volatility: Math.round(volatility * 10000) / 100,
        sharpe: Math.round(sharpe * 100) / 100,
        calmar: Math.round(calmar * 100) / 100,
        final_value: finalValue,
        initial_capital,
        days,
      },
    });
  } catch (error) {
    logger.error('组合回测失败:', error.message);
    res.status(500).json({ error: '组合回测失败: ' + error.message });
  }
});

module.exports = router;
