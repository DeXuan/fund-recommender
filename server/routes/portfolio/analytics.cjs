const express = require('express');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');
const { fetchAndStoreHistoricalNav, resolveLatestNav } = require('../../utils/portfolio-helpers.cjs');

const router = express.Router();
router.use(authMiddleware);

// GET /api/portfolio/returns-map
router.get('/returns-map', async (req, res) => {
  try {
    const pool = getPool();
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    // Get user's holdings grouped by fund
    const recordsResult = await pool.query(
      'SELECT fund_code, fund_name, shares, buy_date FROM fund_records WHERE user_id = $1 ORDER BY buy_date',
      [req.user.id]
    );
    if (recordsResult.rows.length === 0) {
      return res.json({ data: [], year: targetYear, summary: { totalDays: 0, profitDays: 0, lossDays: 0, totalReturn: 0 } });
    }

    // Aggregate shares by fund_code (cumulative)
    const fundHoldings = {};
    for (const r of recordsResult.rows) {
      const code = r.fund_code;
      if (!fundHoldings[code]) {
        fundHoldings[code] = { fund_name: r.fund_name, buyEvents: [] };
      }
      fundHoldings[code].buyEvents.push({
        date: r.buy_date,
        shares: parseFloat(r.shares),
      });
    }

    const fundCodes = Object.keys(fundHoldings);

    // Check which funds need historical NAV data fetched
    const startDate = `${targetYear}-01-01`;
    const endDate = `${targetYear}-12-31`;
    const navCountResult = await pool.query(
      `SELECT fund_code, COUNT(*) as cnt FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= $2 AND nav_date <= $3
       GROUP BY fund_code`,
      [fundCodes, startDate, endDate]
    );
    const navCountMap = {};
    for (const row of navCountResult.rows) {
      navCountMap[row.fund_code] = parseInt(row.cnt);
    }

    // Fetch historical NAV from eastmoney for funds with insufficient data
    const fundsToFetch = fundCodes.filter(code => (navCountMap[code] || 0) < 10);
    if (fundsToFetch.length > 0) {
      console.log(`[收益地图] 需要获取 ${fundsToFetch.length} 只基金的历史净值`);
      for (const code of fundsToFetch) {
        try {
          await fetchAndStoreHistoricalNav(pool, code, fundHoldings[code].fund_name, targetYear);
        } catch (e) {
          console.warn(`[收益地图] 获取 ${code} 历史净值失败:`, e.message);
        }
      }
    }

    // Fetch all historical NAV data for the year
    const navResult = await pool.query(
      `SELECT fund_code, nav, nav_date FROM fund_nav
       WHERE fund_code = ANY($1) AND nav_date >= $2 AND nav_date <= $3
       ORDER BY nav_date`,
      [fundCodes, startDate, endDate]
    );

    // Group NAV by date
    const navByDate = {};
    for (const row of navResult.rows) {
      const dateStr = row.nav_date.toISOString().slice(0, 10);
      if (!navByDate[dateStr]) navByDate[dateStr] = {};
      navByDate[dateStr][row.fund_code] = parseFloat(row.nav);
    }

    // Get all trading dates sorted
    const tradingDates = Object.keys(navByDate).sort();

    // Compute daily portfolio returns
    const dailyReturns = [];
    let prevValue = null;

    for (const dateStr of tradingDates) {
      let totalValue = 0;

      for (const code of fundCodes) {
        const nav = navByDate[dateStr]?.[code];
        if (nav == null) continue;

        // Calculate cumulative shares held on this date
        let cumulativeShares = 0;
        for (const event of fundHoldings[code].buyEvents) {
          const buyDateStr = event.date instanceof Date
            ? event.date.toISOString().slice(0, 10)
            : event.date;
          if (buyDateStr <= dateStr) {
            cumulativeShares += event.shares;
          }
        }
        if (cumulativeShares > 0) {
          totalValue += cumulativeShares * nav;
        }
      }

      if (totalValue === 0) continue;

      const dailyReturn = prevValue != null ? totalValue - prevValue : 0;
      dailyReturns.push({
        date: dateStr,
        return: parseFloat(dailyReturn.toFixed(2)),
        value: parseFloat(totalValue.toFixed(2)),
      });
      prevValue = totalValue;
    }

    // Compute stats
    const profitDays = dailyReturns.filter(d => d.return > 0).length;
    const lossDays = dailyReturns.filter(d => d.return < 0).length;
    const totalReturn = dailyReturns.length >= 2
      ? parseFloat((dailyReturns[dailyReturns.length - 1].value - dailyReturns[0].value).toFixed(2))
      : 0;

    res.json({
      data: dailyReturns,
      year: targetYear,
      summary: {
        totalDays: dailyReturns.length,
        profitDays,
        lossDays,
        flatDays: dailyReturns.length - profitDays - lossDays,
        totalReturn,
        maxProfit: dailyReturns.length > 0 ? Math.max(...dailyReturns.map(d => d.return)) : 0,
        maxLoss: dailyReturns.length > 0 ? Math.min(...dailyReturns.map(d => d.return)) : 0,
      },
    });
  } catch (error) {
    console.error('获取收益地图失败:', error.message);
    res.status(500).json({ error: '获取收益地图失败' });
  }
});

// GET /api/portfolio/summary
router.get('/summary', async (req, res) => {
  try {
    const pool = getPool();
    // 从数据库读取已预计算的盈亏数据
    const result = await pool.query(
      `SELECT id, user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes,
              current_nav, market_value, pnl, pnl_percent, nav_updated_at,
              created_at, updated_at
       FROM fund_records WHERE user_id = $1 ORDER BY buy_date DESC`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json({ holdings: [], totalCost: 0, totalValue: 0, totalPnl: 0, totalReturn: 0 });
    }

    const records = result.rows;

    // 按基金代码分组
    const grouped = {};
    for (const record of records) {
      if (!grouped[record.fund_code]) {
        grouped[record.fund_code] = { fund_code: record.fund_code, fund_name: record.fund_name, records: [] };
      }
      grouped[record.fund_code].records.push(record);
    }

    const holdings = Object.values(grouped).map(group => {
      let totalShares = 0;
      let totalCost = 0;
      let currentNav = 0;
      let totalMarketValue = 0;

      for (const r of group.records) {
        const shares = parseFloat(r.shares);
        const costPrice = parseFloat(r.cost_price);
        const buyFee = parseFloat(r.buy_fee || 0);
        totalShares += shares;
        totalCost += shares * costPrice + buyFee;

        // 使用数据库中的预计算值
        if (r.current_nav && parseFloat(r.current_nav) > 0) {
          currentNav = parseFloat(r.current_nav);
          totalMarketValue += parseFloat(r.market_value || 0);
        }
      }

      const avgCostPrice = totalShares > 0 ? totalCost / totalShares : 0;

      // 如果没有预计算值，回退到从 fund_nav 查询
      if (currentNav === 0) {
        currentNav = avgCostPrice;
        totalMarketValue = totalShares * currentNav;
      }

      const pnl = totalMarketValue - totalCost;
      const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

      return {
        fund_code: group.fund_code,
        fund_name: group.fund_name,
        total_shares: parseFloat(totalShares.toFixed(2)),
        avg_cost_price: parseFloat(avgCostPrice.toFixed(4)),
        total_cost: parseFloat(totalCost.toFixed(2)),
        current_nav: parseFloat(currentNav.toFixed(4)),
        market_value: parseFloat(totalMarketValue.toFixed(2)),
        pnl: parseFloat(pnl.toFixed(2)),
        pnl_percent: parseFloat(pnlPercent.toFixed(2)),
        nav_updated_at: group.records[0]?.nav_updated_at || null,
        records: group.records,
      };
    });

    const totalCost = holdings.reduce((sum, h) => sum + h.total_cost, 0);
    const totalValue = holdings.reduce((sum, h) => sum + h.market_value, 0);
    const totalPnl = totalValue - totalCost;
    const totalReturn = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    res.json({
      holdings,
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(2)),
    });
  } catch (error) {
    console.error('获取汇总失败:', error.message);
    res.status(500).json({ error: '获取汇总失败' });
  }
});

// POST /api/portfolio/refresh-nav — 手动刷新当前用户持仓的净值和盈亏
router.post('/refresh-nav', async (req, res) => {
  try {
    const pool = getPool();

    // 获取当前用户的所有持仓
    const recordsResult = await pool.query(
      'SELECT id, fund_code, fund_name, shares, cost_price, buy_fee FROM fund_records WHERE user_id = $1',
      [req.user.id]
    );
    if (recordsResult.rows.length === 0) {
      return res.json({ updated: 0, validated: 0, warnings: [], message: '暂无持仓记录' });
    }

    const fundCodes = [...new Set(recordsResult.rows.map(r => r.fund_code))];

    // 优先从API实时获取最新净值（确保数据最新）
    const { fetchFundNavBatch } = require('../../data-fetcher.cjs');
    const navMap = new Map();
    try {
      const batchNav = await fetchFundNavBatch(fundCodes);
      for (const [code, val] of batchNav) {
        if (val.nav > 0) {
          navMap.set(code, { nav: val.nav, date: val.navDate });
          // 同时写入 fund_nav 表持久化
          try {
            await pool.query(
              `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (fund_code, nav_date) DO UPDATE SET nav = EXCLUDED.nav`,
              [code, val.nav, val.totalNav || val.nav, val.navDate || new Date().toISOString().split('T')[0]]
            );
          } catch (e) { /* 忽略写入失败 */ }
        }
      }
    } catch (e) {
      console.warn(`[手动刷新] API获取失败，回退到 fund_nav 表: ${e.message}`);
    }

    // 对API未返回的基金，使用 resolveLatestNav 补充
    const missingCodes = fundCodes.filter(code => !navMap.has(code));
    if (missingCodes.length > 0) {
      const resolved = await resolveLatestNav(pool, missingCodes);
      for (const [code, data] of Object.entries(resolved)) {
        navMap.set(code, data);
      }
    }

    let updated = 0;
    const warnings = [];

    for (const record of recordsResult.rows) {
      const navData = navMap.get(record.fund_code);
      if (!navData || navData.nav <= 0) {
        warnings.push(`${record.fund_code}(${record.fund_name}): 无法获取净值`);
        continue;
      }

      const currentNav = navData.nav;
      const shares = parseFloat(record.shares);
      const costPrice = parseFloat(record.cost_price);
      const buyFee = parseFloat(record.buy_fee || 0);
      const totalCost = shares * costPrice + buyFee;
      const marketValue = parseFloat((shares * currentNav).toFixed(2));
      const pnl = parseFloat((marketValue - totalCost).toFixed(2));
      const pnlPercent = totalCost > 0 ? parseFloat(((pnl / totalCost) * 100).toFixed(2)) : 0;

      // 校验
      if (currentNav <= 0 || shares <= 0) {
        warnings.push(`${record.fund_code}: 数值异常(净值${currentNav}, 份额${shares})`);
        continue;
      }
      if (Math.abs(pnlPercent) > 300) {
        warnings.push(`${record.fund_code}: 收益率异常 ${pnlPercent}%，请检查持仓数据`);
      }

      await pool.query(
        `UPDATE fund_records SET current_nav = $1, market_value = $2, pnl = $3, pnl_percent = $4, nav_updated_at = NOW() WHERE id = $5`,
        [currentNav, marketValue, pnl, pnlPercent, record.id]
      );
      updated++;
    }

    if (warnings.length > 0) {
      console.warn(`[手动刷新] 用户${req.user.id} 校验警告:`, warnings);
    }

    res.json({
      updated,
      validated: recordsResult.rows.length,
      warnings,
      message: `已更新 ${updated} 条持仓记录的净值和盈亏`,
    });
  } catch (error) {
    console.error('手动刷新净值失败:', error.message);
    res.status(500).json({ error: '刷新失败' });
  }
});

module.exports = router;
