const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
router.use(authMiddleware);

function getPeriodRange(period, refDate) {
  const now = refDate ? new Date(refDate) : new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  if (period === 'weekly') {
    start.setDate(now.getDate() - 7);
  } else if (period === 'monthly') {
    start.setMonth(now.getMonth() - 1);
  } else if (period === 'quarterly') {
    start.setMonth(now.getMonth() - 3);
  } else if (period === 'yearly') {
    start.setFullYear(now.getFullYear() - 1);
  } else {
    start.setDate(now.getDate() - 7);
  }
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function formatDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

// GET /api/portfolio/report?period=weekly|monthly|quarterly|yearly&date=YYYY-MM-DD
router.get('/report', async (req, res) => {
  try {
    const pool = getPool();
    const period = req.query.period || 'weekly';
    const { start, end } = getPeriodRange(period, req.query.date);

    const startDateStr = formatDate(start);
    const endDateStr = formatDate(end);

    // 1. 当前持仓汇总
    const holdingsResult = await pool.query(
      `SELECT fund_code, fund_name, shares, cost_price, buy_date, buy_fee,
              current_nav, market_value, pnl, pnl_percent
       FROM fund_records
       WHERE user_id = $1 AND (record_type IS NULL OR record_type = 'buy') AND shares > 0
       ORDER BY pnl_percent DESC`,
      [req.user.id]
    );

    // 2. 期间交易记录
    const txResult = await pool.query(
      `SELECT fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes,
              record_type, sell_price, sell_date, sell_fee, realized_pnl
       FROM fund_records
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
       ORDER BY created_at DESC`,
      [req.user.id, start, end]
    );

    // 3. 期间各基金净值变化
    const fundCodes = [...new Set(holdingsResult.rows.map(r => r.fund_code))];
    const navChanges = [];
    if (fundCodes.length > 0) {
      const navResult = await pool.query(
        `SELECT fund_code, nav, nav_date FROM fund_nav
         WHERE fund_code = ANY($1) AND nav_date >= $2 AND nav_date <= $3
         ORDER BY nav_date`,
        [fundCodes, startDateStr, endDateStr]
      );

      const navByCode = {};
      for (const row of navResult.rows) {
        if (!navByCode[row.fund_code]) navByCode[row.fund_code] = [];
        navByCode[row.fund_code].push({ nav: parseFloat(row.nav), date: formatDate(row.nav_date) });
      }

      const fundNameMap = {};
      for (const r of holdingsResult.rows) {
        if (!fundNameMap[r.fund_code]) fundNameMap[r.fund_code] = r.fund_name;
      }

      for (const code of fundCodes) {
        const navs = navByCode[code] || [];
        if (navs.length >= 2) {
          const first = navs[0];
          const last = navs[navs.length - 1];
          const change = last.nav - first.nav;
          const changePercent = first.nav > 0 ? (change / first.nav) * 100 : 0;
          navChanges.push({
            fund_code: code,
            fund_name: fundNameMap[code] || code,
            start_nav: first.nav,
            end_nav: last.nav,
            change: parseFloat(change.toFixed(4)),
            change_percent: parseFloat(changePercent.toFixed(2)),
            nav_dates: [first.date, last.date],
          });
        }
      }
    }

    // 4. 汇总统计
    const holdings = holdingsResult.rows.map(r => ({
      fund_code: r.fund_code,
      fund_name: r.fund_name,
      shares: parseFloat(r.shares),
      cost_price: parseFloat(r.cost_price),
      market_value: parseFloat(r.market_value || 0),
      pnl: parseFloat(r.pnl || 0),
      pnl_percent: parseFloat(r.pnl_percent || 0),
    }));

    const totalCost = holdings.reduce((s, h) => s + h.shares * h.cost_price, 0);
    const totalValue = holdings.reduce((s, h) => s + h.market_value, 0);
    const totalPnl = totalValue - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // 5. 盈亏排行
    const winners = [...holdings].filter(h => h.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 5);
    const losers = [...holdings].filter(h => h.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 5);

    // 6. 期间交易统计
    const buyTx = txResult.rows.filter(t => !t.record_type || t.record_type === 'buy');
    const sellTx = txResult.rows.filter(t => t.record_type === 'sell');
    const buyAmount = buyTx.reduce((s, t) => s + parseFloat(t.shares) * parseFloat(t.cost_price) + parseFloat(t.buy_fee || 0), 0);
    const sellAmount = sellTx.reduce((s, t) => s + parseFloat(t.shares || 0) * parseFloat(t.sell_price || 0) - parseFloat(t.sell_fee || 0), 0);
    const realizedPnl = sellTx.reduce((s, t) => s + parseFloat(t.realized_pnl || 0), 0);

    res.json({
      period,
      start_date: startDateStr,
      end_date: endDateStr,
      summary: {
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_value: parseFloat(totalValue.toFixed(2)),
        total_pnl: parseFloat(totalPnl.toFixed(2)),
        total_return: parseFloat(totalReturn.toFixed(2)),
        holding_count: holdings.length,
      },
      winners,
      losers,
      nav_changes: navChanges,
      transactions: {
        buys: buyTx.map(t => ({
          fund_code: t.fund_code,
          fund_name: t.fund_name,
          shares: parseFloat(t.shares),
          cost_price: parseFloat(t.cost_price),
          buy_date: formatDate(t.buy_date),
          amount: parseFloat((parseFloat(t.shares) * parseFloat(t.cost_price) + parseFloat(t.buy_fee || 0)).toFixed(2)),
        })),
        sells: sellTx.map(t => ({
          fund_code: t.fund_code,
          fund_name: t.fund_name,
          shares: parseFloat(t.shares || 0),
          sell_price: parseFloat(t.sell_price || 0),
          sell_date: t.sell_date ? formatDate(t.sell_date) : null,
          realized_pnl: parseFloat(t.realized_pnl || 0),
        })),
        buy_amount: parseFloat(buyAmount.toFixed(2)),
        sell_amount: parseFloat(sellAmount.toFixed(2)),
        realized_pnl: parseFloat(realizedPnl.toFixed(2)),
        buy_count: buyTx.length,
        sell_count: sellTx.length,
      },
    });
  } catch (error) {
    logger.error('生成报告失败:', error.message);
    res.status(500).json({ error: '生成报告失败' });
  }
});

// GET /api/portfolio/reports — 列出历史报告（基于交易记录按周/月聚合）
router.get('/reports', async (req, res) => {
  try {
    const pool = getPool();
    const period = req.query.period || 'weekly';

    // 获取用户最早交易记录到现在的时间范围
    const rangeResult = await pool.query(
      'SELECT MIN(created_at) as min_date, MAX(created_at) as max_date FROM fund_records WHERE user_id = $1',
      [req.user.id]
    );

    if (!rangeResult.rows[0]?.min_date) {
      return res.json({ reports: [], period });
    }

    const minDate = new Date(rangeResult.rows[0].min_date);
    const now = new Date();

    // 生成周期列表
    const reports = [];
    let cursor = new Date(now);
    const stepDays = period === 'weekly' ? 7 : period === 'quarterly' ? 90 : 365;

    for (let i = 0; i < 12; i++) {
      const end = new Date(cursor);
      const start = new Date(cursor);
      if (period === 'monthly') {
        start.setMonth(start.getMonth() - 1);
      } else {
        start.setDate(start.getDate() - stepDays);
      }
      if (start < minDate && end < minDate) break;
      reports.push({
        period,
        start_date: formatDate(start),
        end_date: formatDate(end),
        label: period === 'monthly'
          ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
          : `${formatDate(start)} ~ ${formatDate(end)}`,
      });
      cursor = new Date(start);
    }

    res.json({ reports, period });
  } catch (error) {
    logger.error('获取报告列表失败:', error.message);
    res.status(500).json({ error: '获取报告列表失败' });
  }
});

// GET /api/portfolio/position-ranking?period=weekly|monthly — 加减仓榜单（全用户聚合）
router.get('/position-ranking', async (req, res) => {
  try {
    const pool = getPool();
    const period = req.query.period || 'weekly';
    const { start, end } = getPeriodRange(period, req.query.date);

    // 加仓榜单：期间买入最多的基金
    const buyRanking = await pool.query(
      `SELECT fund_code, fund_name,
              COUNT(*) as buy_count,
              SUM(shares * cost_price + COALESCE(buy_fee, 0)) as buy_amount,
              COUNT(DISTINCT user_id) as buyer_count
       FROM fund_records
       WHERE (record_type IS NULL OR record_type = 'buy')
         AND created_at >= $1 AND created_at <= $2
       GROUP BY fund_code, fund_name
       ORDER BY buy_amount DESC
       LIMIT 20`,
      [start, end]
    );

    // 减仓榜单：期间卖出最多的基金
    const sellRanking = await pool.query(
      `SELECT fund_code, fund_name,
              COUNT(*) as sell_count,
              SUM(COALESCE(shares, 0) * COALESCE(sell_price, 0)) as sell_amount,
              SUM(COALESCE(realized_pnl, 0)) as total_realized_pnl,
              COUNT(DISTINCT user_id) as seller_count
       FROM fund_records
       WHERE record_type = 'sell'
         AND created_at >= $1 AND created_at <= $2
       GROUP BY fund_code, fund_name
       ORDER BY sell_amount DESC
       LIMIT 20`,
      [start, end]
    );

    res.json({
      period,
      start_date: formatDate(start),
      end_date: formatDate(end),
      buy_ranking: buyRanking.rows.map(r => ({
        fund_code: r.fund_code,
        fund_name: r.fund_name,
        buy_count: parseInt(r.buy_count),
        buy_amount: parseFloat(r.buy_amount || 0),
        buyer_count: parseInt(r.buyer_count),
      })),
      sell_ranking: sellRanking.rows.map(r => ({
        fund_code: r.fund_code,
        fund_name: r.fund_name,
        sell_count: parseInt(r.sell_count),
        sell_amount: parseFloat(r.sell_amount || 0),
        total_realized_pnl: parseFloat(r.total_realized_pnl || 0),
        seller_count: parseInt(r.seller_count),
      })),
    });
  } catch (error) {
    logger.error('获取加减仓榜单失败:', error.message);
    res.status(500).json({ error: '获取加减仓榜单失败' });
  }
});

module.exports = router;
