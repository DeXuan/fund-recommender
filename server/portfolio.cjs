const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { getPool } = require('./db.cjs');
const { authMiddleware } = require('./auth.cjs');
const fundService = require('./fund-service.cjs');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 } });

router.use(authMiddleware);

// POST /api/portfolio/init-demo
router.post('/init-demo', async (req, res) => {
  try {
    const pool = getPool();
    const existing = await pool.query('SELECT COUNT(*) FROM fund_records WHERE user_id = $1', [req.user.id]);
    if (parseInt(existing.rows[0].count) > 0) {
      return res.json({ message: '用户已有持仓记录，跳过初始化', imported: 0 });
    }

    const demoRecords = [
      { fund_code: '110020', fund_name: '易方达沪深300ETF联接A', shares: 5000, cost_price: 1.3200, buy_date: '2025-06-10', buy_fee: 6.60, notes: '核心宽基底仓' },
      { fund_code: '008887', fund_name: '华夏国证半导体芯片ETF联接A', shares: 3000, cost_price: 1.4800, buy_date: '2025-08-15', buy_fee: 4.44, notes: '半导体行情' },
      { fund_code: '161725', fund_name: '招商中证白酒指数A', shares: 2000, cost_price: 1.3200, buy_date: '2025-09-20', buy_fee: 2.64, notes: '消费赛道' },
      { fund_code: '110027', fund_name: '易方达安心回报债券A', shares: 8000, cost_price: 1.2400, buy_date: '2025-07-01', buy_fee: 0, notes: '债券稳健配置' },
      { fund_code: '040046', fund_name: '华安纳斯达克100ETF联接A', shares: 1500, cost_price: 3.6500, buy_date: '2025-11-05', buy_fee: 5.48, notes: '美股科技配置' },
      { fund_code: '518880', fund_name: '华安黄金ETF', shares: 3000, cost_price: 5.6000, buy_date: '2025-12-20', buy_fee: 0, notes: '避险资产配置' },
      { fund_code: '100032', fund_name: '富国中证红利指数增强A', shares: 3000, cost_price: 1.7800, buy_date: '2026-02-25', buy_fee: 5.34, notes: '红利策略' },
      { fund_code: '562500', fund_name: '华夏中证机器人ETF', shares: 4000, cost_price: 0.7200, buy_date: '2026-03-10', buy_fee: 2.88, notes: 'AI机器人主题' },
    ];

    // Ensure funds exist in funds table (FK constraint on fund_nav)
    for (const r of demoRecords) {
      await pool.query(
        'INSERT INTO funds (code, name, type, industry) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING',
        [r.fund_code, r.fund_name, 'ETF联接', '其他']
      );
    }

    for (const r of demoRecords) {
      await pool.query(
        'INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [req.user.id, r.fund_code, r.fund_name, r.shares, r.cost_price, r.buy_date, r.buy_fee, r.notes]
      );
    }

    res.json({ message: '示例数据导入成功', imported: demoRecords.length });
  } catch (error) {
    console.error('初始化示例数据失败:', error.message);
    res.status(500).json({ error: '初始化失败' });
  }
});

// GET /api/portfolio/records
router.get('/records', async (req, res) => {
  try {
    const pool = getPool();
    const { fund_code } = req.query;
    let sql = 'SELECT * FROM fund_records WHERE user_id = $1';
    const params = [req.user.id];

    if (fund_code) {
      sql += ' AND fund_code = $2';
      params.push(fund_code);
    }
    sql += ' ORDER BY buy_date DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('获取记录失败:', error.message);
    res.status(500).json({ error: '获取记录失败' });
  }
});

// POST /api/portfolio/records
router.post('/records', async (req, res) => {
  try {
    const { fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes,
            dca_enabled, dca_amount, dca_frequency, dca_day_of_month, dca_day_of_week,
            dca_start_date, dca_end_date } = req.body;

    if (!fund_code || !fund_name || shares == null || cost_price == null || !buy_date) {
      return res.status(400).json({ error: '请填写完整的记录信息' });
    }
    if (typeof shares !== 'number' || shares <= 0) {
      return res.status(400).json({ error: '份额必须大于0' });
    }
    if (typeof cost_price !== 'number' || cost_price <= 0) {
      return res.status(400).json({ error: '成本价必须大于0' });
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes,
        dca_enabled, dca_amount, dca_frequency, dca_day_of_month, dca_day_of_week, dca_start_date, dca_end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.user.id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee || 0, notes || '',
       dca_enabled || false, dca_amount || null, dca_frequency || 'monthly',
       dca_day_of_month || 1, dca_day_of_week || 1, dca_start_date || null, dca_end_date || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('添加记录失败:', error.message);
    res.status(500).json({ error: '添加记录失败' });
  }
});

// PUT /api/portfolio/records/:id
router.put('/records/:id', async (req, res) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });

    const existing = await pool.query('SELECT * FROM fund_records WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    const { fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes,
            dca_enabled, dca_amount, dca_frequency, dca_day_of_month, dca_day_of_week,
            dca_start_date, dca_end_date, dca_status } = req.body;

    // Validate numeric fields (same as POST endpoint)
    if (shares != null && (typeof shares !== 'number' || shares <= 0)) {
      return res.status(400).json({ error: '份额必须大于0' });
    }
    if (cost_price != null && (typeof cost_price !== 'number' || cost_price <= 0)) {
      return res.status(400).json({ error: '成本价必须大于0' });
    }

    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE fund_records SET fund_code=$1, fund_name=$2, shares=$3, cost_price=$4, buy_date=$5, buy_fee=$6, notes=$7,
        dca_enabled=$8, dca_amount=$9, dca_frequency=$10, dca_day_of_month=$11, dca_day_of_week=$12,
        dca_start_date=$13, dca_end_date=$14, dca_status=$15, updated_at=NOW() WHERE id=$16 RETURNING *`,
      [
        fund_code || current.fund_code, fund_name || current.fund_name,
        shares != null ? shares : current.shares, cost_price != null ? cost_price : current.cost_price,
        buy_date || current.buy_date, buy_fee != null ? buy_fee : current.buy_fee,
        notes !== undefined ? notes : current.notes,
        dca_enabled !== undefined ? dca_enabled : current.dca_enabled,
        dca_amount != null ? dca_amount : current.dca_amount,
        dca_frequency || current.dca_frequency,
        dca_day_of_month || current.dca_day_of_month,
        dca_day_of_week || current.dca_day_of_week,
        dca_start_date || current.dca_start_date,
        dca_end_date !== undefined ? dca_end_date : current.dca_end_date,
        dca_status || current.dca_status,
        id,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('更新记录失败:', error.message);
    res.status(500).json({ error: '更新记录失败' });
  }
});

// DELETE /api/portfolio/records/:id
router.delete('/records/:id', async (req, res) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const existing = await pool.query('SELECT id FROM fund_records WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    await pool.query('DELETE FROM fund_records WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除记录失败:', error.message);
    res.status(500).json({ error: '删除记录失败' });
  }
});

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

// Fetch historical NAV from eastmoney and store to fund_nav
async function fetchAndStoreHistoricalNav(pool, fundCode, fundName, year) {
  // Ensure fund exists in funds table (FK requirement)
  const existingFund = await pool.query('SELECT code FROM funds WHERE code = $1', [fundCode]);
  if (existingFund.rows.length === 0) {
    await pool.query(
      `INSERT INTO funds (code, name, type, industry) VALUES ($1, $2, '混合型', '其他')
       ON CONFLICT (code) DO NOTHING`,
      [fundCode, fundName || fundCode]
    );
  }

  // Fetch up to 260 days of historical NAV from eastmoney
  const res = await axios.get(
    `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fundCode}&pageIndex=1&pageSize=365`,
    { timeout: 10000, headers: { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' } }
  );
  const list = res.data?.Data?.LSJZList;
  if (!list || list.length === 0) return;

  let inserted = 0;
  for (const item of list) {
    const navDate = item.FSRQ; // e.g. "2025-01-15"
    const nav = parseFloat(item.DWJZ);
    if (!navDate || isNaN(nav)) continue;

    // Only store data for the target year
    if (!navDate.startsWith(String(year))) continue;

    await pool.query(
      `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (fund_code, nav_date) DO NOTHING`,
      [fundCode, nav, parseFloat(item.LJJZ) || null, navDate]
    );
    inserted++;
  }
  console.log(`[收益地图] ${fundCode} 获取并存储 ${inserted} 条历史净值`);
}

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

// POST /api/portfolio/import
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV文件至少需要表头和一行数据' });
    }

    // Limit CSV import to 1000 rows to prevent resource exhaustion
    const MAX_IMPORT_ROWS = 1000;
    if (lines.length - 1 > MAX_IMPORT_ROWS) {
      return res.status(400).json({ error: `CSV最多支持导入${MAX_IMPORT_ROWS}条记录，当前${lines.length - 1}条` });
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredCols = ['fund_code', 'fund_name', 'shares', 'cost_price', 'buy_date'];
    const missingCols = requiredCols.filter(col => !header.includes(col));
    if (missingCols.length > 0) {
      return res.status(400).json({ error: `CSV缺少必要列: ${missingCols.join(', ')}` });
    }

    const colIndex = {};
    header.forEach((col, i) => { colIndex[col] = i; });

    const pool = getPool();
    let imported = 0;
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < requiredCols.length) continue;

      const fundCode = cols[colIndex['fund_code']];
      const fundName = cols[colIndex['fund_name']];
      const shares = parseFloat(cols[colIndex['shares']]);
      const costPrice = parseFloat(cols[colIndex['cost_price']]);
      const buyDate = cols[colIndex['buy_date']];
      const buyFee = colIndex['buy_fee'] != null ? parseFloat(cols[colIndex['buy_fee']] || '0') : 0;
      const notes = colIndex['notes'] != null ? cols[colIndex['notes']] || '' : '';

      if (!fundCode || !fundName || isNaN(shares) || isNaN(costPrice) || !buyDate) {
        errors.push(`第${i + 1}行: 数据格式错误`);
        continue;
      }
      if (shares <= 0 || costPrice <= 0) {
        errors.push(`第${i + 1}行: 份额和成本价必须大于0`);
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(buyDate)) {
        errors.push(`第${i + 1}行: 日期格式应为 YYYY-MM-DD`);
        continue;
      }

      await pool.query(
        'INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [req.user.id, fundCode, fundName, shares, costPrice, buyDate, buyFee, notes]
      );
      imported++;
    }

    res.json({ imported, errors, total: lines.length - 1 });
  } catch (error) {
    console.error('导入失败:', error.message);
    res.status(500).json({ error: '导入失败' });
  }
});

// ============ 定投计划 ============

// GET /api/portfolio/dca-plans
router.get('/dca-plans', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM dca_plans WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('获取定投计划失败:', error.message);
    res.status(500).json({ error: '获取定投计划失败' });
  }
});

// POST /api/portfolio/dca-plans
router.post('/dca-plans', async (req, res) => {
  try {
    const { fund_code, fund_name, amount, frequency, day_of_month, day_of_week, start_date, end_date, notes } = req.body;

    if (!fund_code || !fund_name || !amount || !frequency || !start_date) {
      return res.status(400).json({ error: '请填写完整的定投计划信息' });
    }
    if (!['weekly', 'biweekly', 'monthly', 'quarterly'].includes(frequency)) {
      return res.status(400).json({ error: '定投频率不正确' });
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO dca_plans (user_id, fund_code, fund_name, amount, frequency, day_of_month, day_of_week, start_date, end_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, fund_code, fund_name, amount, frequency,
       day_of_month || 1, day_of_week || 1, start_date, end_date || null, notes || '']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('创建定投计划失败:', error.message);
    res.status(500).json({ error: '创建定投计划失败' });
  }
});

// PUT /api/portfolio/dca-plans/:id
router.put('/dca-plans/:id', async (req, res) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });

    const existing = await pool.query('SELECT * FROM dca_plans WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '定投计划不存在' });
    }

    const { fund_code, fund_name, amount, frequency, day_of_month, day_of_week, start_date, end_date, status, notes } = req.body;
    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE dca_plans SET fund_code=$1, fund_name=$2, amount=$3, frequency=$4, day_of_month=$5, day_of_week=$6,
       start_date=$7, end_date=$8, status=$9, notes=$10, updated_at=NOW() WHERE id=$11 RETURNING *`,
      [
        fund_code || current.fund_code, fund_name || current.fund_name,
        amount != null ? amount : current.amount, frequency || current.frequency,
        day_of_month != null ? day_of_month : current.day_of_month, day_of_week != null ? day_of_week : current.day_of_week,
        start_date || current.start_date, end_date !== undefined ? end_date : current.end_date,
        status || current.status, notes !== undefined ? notes : current.notes, id,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('更新定投计划失败:', error.message);
    res.status(500).json({ error: '更新定投计划失败' });
  }
});

// DELETE /api/portfolio/dca-plans/:id
router.delete('/dca-plans/:id', async (req, res) => {
  try {
    const pool = getPool();
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const existing = await pool.query('SELECT id FROM dca_plans WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '定投计划不存在' });
    }
    await pool.query('DELETE FROM dca_plans WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除定投计划失败:', error.message);
    res.status(500).json({ error: '删除定投计划失败' });
  }
});

// POST /api/portfolio/dca-plans/sync
router.post('/dca-plans/sync', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT * FROM dca_plans WHERE user_id = $1 AND status = 'active'", [req.user.id]);
    if (result.rows.length === 0) {
      return res.json({ synced: 0, message: '没有需要同步的定投计划' });
    }

    const plans = result.rows;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    let totalSynced = 0;
    const details = [];

    for (const plan of plans) {
      if (plan.end_date && plan.end_date < todayStr) {
        await pool.query("UPDATE dca_plans SET status = 'completed' WHERE id = $1", [plan.id]);
        details.push({ plan: plan.fund_name, status: '已到期，自动停止' });
        continue;
      }

      const startDate = plan.last_executed ? new Date(plan.last_executed) : new Date(plan.start_date);
      const executionDates = getDcaExecutionDates(plan, startDate, today);

      if (executionDates.length === 0) continue;

      const navData = await fundService.getLatestNav(plan.fund_code);
      const currentNav = navData ? navData.nav : 1.0;

      let planSynced = 0;
      for (const execDate of executionDates) {
        const dateStr = execDate.toISOString().slice(0, 10);
        const shares = parseFloat((plan.amount / currentNav).toFixed(2));

        await pool.query(
          'INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [req.user.id, plan.fund_code, plan.fund_name, shares, currentNav, dateStr, 0, `定投自动同步 - ${plan.notes}`]
        );
        planSynced++;
      }

      const lastDate = executionDates[executionDates.length - 1].toISOString().slice(0, 10);
      await pool.query("UPDATE dca_plans SET last_executed = $1, updated_at = NOW() WHERE id = $2",
        [lastDate, plan.id]);

      totalSynced += planSynced;
      details.push({ plan: plan.fund_name, synced: planSynced, lastDate });
    }

    res.json({ synced: totalSynced, details, message: `同步完成，共生成 ${totalSynced} 条定投记录` });
  } catch (error) {
    console.error('同步定投失败:', error.message);
    res.status(500).json({ error: '同步定投失败' });
  }
});

function getDcaExecutionDates(plan, fromDate, toDate) {
  const dates = [];
  const start = new Date(fromDate);
  start.setDate(start.getDate() + 1);
  const end = new Date(toDate);

  const current = new Date(start);
  current.setDate(1);

  while (current <= end) {
    let execDate;

    switch (plan.frequency) {
      case 'weekly': {
        const targetDay = plan.day_of_week || 1;
        const firstOfWeek = new Date(current);
        const dayDiff = (targetDay - firstOfWeek.getDay() + 7) % 7;
        firstOfWeek.setDate(firstOfWeek.getDate() + dayDiff);
        execDate = firstOfWeek;
        current.setDate(current.getDate() + 7);
        break;
      }
      case 'biweekly': {
        const targetDay = plan.day_of_week || 1;
        const firstOfWeek = new Date(current);
        const dayDiff = (targetDay - firstOfWeek.getDay() + 7) % 7;
        firstOfWeek.setDate(firstOfWeek.getDate() + dayDiff);
        execDate = firstOfWeek;
        current.setDate(current.getDate() + 14);
        break;
      }
      case 'monthly': {
        execDate = new Date(current.getFullYear(), current.getMonth(), plan.day_of_month || 1);
        current.setMonth(current.getMonth() + 1);
        break;
      }
      case 'quarterly': {
        execDate = new Date(current.getFullYear(), current.getMonth(), plan.day_of_month || 1);
        current.setMonth(current.getMonth() + 3);
        break;
      }
      default:
        return dates;
    }

    if (execDate >= start && execDate <= end) {
      dates.push(new Date(execDate));
    }
  }

  return dates;
}

// ============ 风险评估持久化 ============

// POST /api/portfolio/risk-profile — 保存风险评估结果
router.post('/risk-profile', async (req, res) => {
  try {
    const pool = getPool();
    const { age, investmentAmount, investmentPeriod, riskTolerance, lossTolerance, score, riskType, riskLevel, expectedReturn, allocation } = req.body;

    if (!riskType || !riskLevel || score == null) {
      return res.status(400).json({ error: '请提供完整的风险评估结果' });
    }

    // 每个用户只保留最新一条
    await pool.query('DELETE FROM risk_profiles WHERE user_id = $1', [req.user.id]);

    const result = await pool.query(
      `INSERT INTO risk_profiles (user_id, age, investment_amount, investment_period, risk_tolerance, loss_tolerance, score, risk_type, risk_level, expected_return, allocation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, age || '', investmentAmount || '', investmentPeriod || '', riskTolerance || '', lossTolerance || '',
       score, riskType, riskLevel, expectedReturn || '', JSON.stringify(allocation || [])]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('保存风险评估失败:', error.message);
    res.status(500).json({ error: '保存失败' });
  }
});

// GET /api/portfolio/risk-profile — 获取最新风险评估结果
router.get('/risk-profile', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM risk_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.json(null);
    }
    const row = result.rows[0];
    res.json({
      ...row,
      allocation: typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation,
    });
  } catch (error) {
    console.error('获取风险评估失败:', error.message);
    res.status(500).json({ error: '获取失败' });
  }
});

// ============ 组合洞察（收益地图增强版） ============

// 资产类别分类映射
function classifyAsset(fundCode, fundName, industry, type) {
  const name = (fundName || '').toLowerCase();
  const ind = (industry || '').toLowerCase();
  const t = (type || '').toLowerCase();

  // 货币基金
  if (t === '货币' || ind.includes('货币')) return '货币基金';
  // 债券/固收
  if (t === '债券' || ind.includes('债券') || name.includes('债') || name.includes('回报')) return '固收';
  // 海外（QDII / 纳斯达克 / 标普 / 港股）
  if (t === 'qdii' || ind.includes('纳斯达克') || ind.includes('标普') || ind.includes('港股') || name.includes('纳斯达克') || name.includes('标普')) return '海外股';
  // 黄金
  if (ind.includes('黄金') || name.includes('黄金')) return '固收';
  // 国内股 - 进攻型（科技成长类）
  const aggressiveKeywords = ['半导体', '芯片', '人工智能', 'ai', '新能源', '光伏', '军工', '科创', '机器人', '信息技术', '科技'];
  if (aggressiveKeywords.some(k => ind.includes(k) || name.includes(k))) return '国内股(进攻)';
  // 国内股 - 防御型（消费、医药、红利、宽基）
  return '国内股(防御)';
}

// GET /api/portfolio/insights — 组合洞察数据
router.get('/insights', async (req, res) => {
  try {
    const pool = getPool();

    // 1. 获取用户持仓
    const recordsResult = await pool.query(
      `SELECT fr.*, f.industry, f.type FROM fund_records fr
       LEFT JOIN funds f ON fr.fund_code = f.code
       WHERE fr.user_id = $1 ORDER BY fr.buy_date`,
      [req.user.id]
    );
    if (recordsResult.rows.length === 0) {
      return res.json({ holdings: [], categories: [], market: [], riskProfile: null, suggestions: [] });
    }

    // 2. 按基金分组汇总
    const grouped = {};
    for (const r of recordsResult.rows) {
      const code = r.fund_code;
      if (!grouped[code]) {
        grouped[code] = {
          fund_code: code, fund_name: r.fund_name, industry: r.industry || '', type: r.type || '',
          total_shares: 0, total_cost: 0, market_value: 0, pnl: 0,
        };
      }
      const shares = parseFloat(r.shares);
      const cost = parseFloat(r.cost_price);
      const fee = parseFloat(r.buy_fee || 0);
      const nav = parseFloat(r.current_nav || cost);
      const mv = parseFloat(r.market_value || shares * cost);

      grouped[code].total_shares += shares;
      grouped[code].total_cost += shares * cost + fee;
      grouped[code].market_value += mv;
      grouped[code].pnl += parseFloat(r.pnl || 0);
    }

    const holdings = Object.values(grouped).map(h => ({
      ...h,
      total_cost: parseFloat(h.total_cost.toFixed(2)),
      market_value: parseFloat(h.market_value.toFixed(2)),
      pnl: parseFloat(h.pnl.toFixed(2)),
      pnl_percent: h.total_cost > 0 ? parseFloat(((h.pnl / h.total_cost) * 100).toFixed(2)) : 0,
      category: classifyAsset(h.fund_code, h.fund_name, h.industry, h.type),
    }));

    const totalValue = holdings.reduce((s, h) => s + h.market_value, 0);

    // 3. 按资产类别分组
    const categoryMap = {};
    for (const h of holdings) {
      if (!categoryMap[h.category]) {
        categoryMap[h.category] = { name: h.category, value: 0, cost: 0, pnl: 0, funds: [] };
      }
      categoryMap[h.category].value += h.market_value;
      categoryMap[h.category].cost += h.total_cost;
      categoryMap[h.category].pnl += h.pnl;
      categoryMap[h.category].funds.push({
        code: h.fund_code, name: h.fund_name, value: h.market_value, pnl: h.pnl, pnlPercent: h.pnl_percent,
      });
    }

    const categories = Object.values(categoryMap).map(c => ({
      ...c,
      value: parseFloat(c.value.toFixed(2)),
      cost: parseFloat(c.cost.toFixed(2)),
      pnl: parseFloat(c.pnl.toFixed(2)),
      pnlPercent: c.cost > 0 ? parseFloat(((c.pnl / c.cost) * 100).toFixed(2)) : 0,
      weight: totalValue > 0 ? parseFloat(((c.value / totalValue) * 100).toFixed(1)) : 0,
    }));

    // 4. 获取市场指数
    let market = [];
    try {
      const marketResult = await pool.query('SELECT * FROM market_indices ORDER BY code');
      market = marketResult.rows.map(r => ({
        code: r.code, name: r.name, price: parseFloat(r.price || 0), changePercent: parseFloat(r.change_percent || 0),
        pe: parseFloat(r.pe || 0), pePercentile: parseFloat(r.pe_percentile || 0), valuation: r.valuation || '', suggestion: r.suggestion || '',
      }));
    } catch (e) { /* ignore */ }

    // 5. 获取风险评估
    let riskProfile = null;
    try {
      const riskResult = await pool.query(
        'SELECT * FROM risk_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );
      if (riskResult.rows.length > 0) {
        const row = riskResult.rows[0];
        riskProfile = {
          riskType: row.risk_type, riskLevel: row.risk_level, expectedReturn: row.expected_return,
          allocation: typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation,
        };
      }
    } catch (e) { /* ignore */ }

    // 6. 生成智能建议
    const suggestions = generateSuggestions(holdings, categories, totalValue, market, riskProfile);

    res.json({ holdings, categories, market, riskProfile, suggestions, totalValue: parseFloat(totalValue.toFixed(2)) });
  } catch (error) {
    console.error('获取组合洞察失败:', error.message);
    res.status(500).json({ error: '获取组合洞察失败' });
  }
});

function generateSuggestions(holdings, categories, totalValue, market, riskProfile) {
  const suggestions = [];

  if (totalValue === 0) return suggestions;

  const catMap = {};
  for (const c of categories) catMap[c.name] = c;

  // --- 基于资产配置的建议 ---
  const stockCategories = categories.filter(c => c.name.includes('股'));
  const stockWeight = stockCategories.reduce((s, c) => s + c.weight, 0);
  const bondWeight = (catMap['固收']?.weight || 0) + (catMap['货币基金']?.weight || 0);

  if (stockWeight > 80) {
    suggestions.push({
      type: 'risk', level: 'warning',
      title: '权益仓位过高',
      detail: `股票类资产占比 ${stockWeight.toFixed(0)}%，建议适当增配固收或货币基金降低组合波动。`,
    });
  }
  if (bondWeight > 70) {
    suggestions.push({
      type: 'opportunity', level: 'info',
      title: '固收占比偏高',
      detail: `固收+货币占比 ${bondWeight.toFixed(0)}%，收益率可能偏低。可根据风险承受能力适当增配宽基指数基金。`,
    });
  }

  // --- 集中度风险 ---
  for (const h of holdings) {
    const weight = totalValue > 0 ? (h.market_value / totalValue) * 100 : 0;
    if (weight > 30) {
      suggestions.push({
        type: 'risk', level: 'warning',
        title: `持仓集中：${h.fund_name}`,
        detail: `单只基金占比 ${weight.toFixed(1)}%，集中度过高。建议分散至其他资产类别以降低非系统性风险。`,
      });
    }
  }

  // --- 进攻/防御平衡 ---
  const attackWeight = catMap['国内股(进攻)']?.weight || 0;
  const defenseWeight = catMap['国内股(防御)']?.weight || 0;
  if (attackWeight > 50 && defenseWeight < 20) {
    suggestions.push({
      type: 'balance', level: 'info',
      title: '进攻型仓位偏重',
      detail: `进攻型资产(半导体/AI/新能源等)占比 ${attackWeight.toFixed(0)}%，防御型(消费/红利/宽基)仅 ${defenseWeight.toFixed(0)}%。建议增配红利或沪深300等防御性资产平滑波动。`,
    });
  }

  // --- 海外配置 ---
  const overseasWeight = catMap['海外股']?.weight || 0;
  if (overseasWeight < 10 && stockWeight > 30) {
    suggestions.push({
      type: 'opportunity', level: 'info',
      title: '建议增配海外资产',
      detail: '海外资产占比偏低，适当配置纳斯达克100或标普500可提升组合地域分散度，降低单一市场风险。',
    });
  }

  // --- 基于风险评估的建议 ---
  if (riskProfile && riskProfile.allocation) {
    const targetMap = {};
    for (const a of riskProfile.allocation) {
      const ind = a.industry || '';
      if (ind.includes('货币') || ind.includes('余额')) targetMap['货币基金'] = (targetMap['货币基金'] || 0) + a.percentage;
      else if (ind.includes('债') || ind.includes('稳健')) targetMap['固收'] = (targetMap['固收'] || 0) + a.percentage;
      else if (ind.includes('纳斯达克') || ind.includes('标普') || ind.includes('港')) targetMap['海外股'] = (targetMap['海外股'] || 0) + a.percentage;
      else if (ind.includes('半导体') || ind.includes('芯片') || ind.includes('人工智能') || ind.includes('AI') || ind.includes('新能源') || ind.includes('光伏')) targetMap['国内股(进攻)'] = (targetMap['国内股(进攻)'] || 0) + a.percentage;
      else targetMap['国内股(防御)'] = (targetMap['国内股(防御)'] || 0) + a.percentage;
    }

    for (const [cat, target] of Object.entries(targetMap)) {
      const current = catMap[cat]?.weight || 0;
      const diff = target - current;
      if (Math.abs(diff) > 10) {
        const action = diff > 0 ? '增配' : '减配';
        suggestions.push({
          type: 'rebalance', level: diff > 0 ? 'info' : 'warning',
          title: `${cat}: ${action}建议`,
          detail: `您的${riskProfile.riskType}画像建议${cat}配置约${target}%，当前仅${current.toFixed(0)}%，建议${action}约${Math.abs(diff).toFixed(0)}个百分点。`,
        });
      }
    }
  }

  // --- 基于市场行情的建议 ---
  const undervalued = market.filter(m => m.pePercentile > 0 && m.pePercentile < 35);
  const overvalued = market.filter(m => m.pePercentile > 70);

  if (undervalued.length > 0) {
    const names = undervalued.map(m => m.name).join('、');
    suggestions.push({
      type: 'market', level: 'info',
      title: '低估指数值得关注',
      detail: `${names}当前估值处于历史偏低区间(PE分位<35%)，是定投或加仓的好时机。`,
    });
  }
  if (overvalued.length > 0) {
    const names = overvalued.map(m => m.name).join('、');
    suggestions.push({
      type: 'market', level: 'warning',
      title: '高估指数注意风险',
      detail: `${names}当前估值偏高(PE分位>70%)，建议减仓或暂停定投，等待回调。`,
    });
  }

  // --- 盈亏分析 ---
  const lossHoldings = holdings.filter(h => h.pnl < 0);
  const profitHoldings = holdings.filter(h => h.pnl > 0);
  if (lossHoldings.length > 0) {
    const totalLoss = lossHoldings.reduce((s, h) => s + Math.abs(h.pnl), 0);
    const avgLossPct = lossHoldings.reduce((s, h) => s + Math.abs(h.pnl_percent), 0) / lossHoldings.length;
    if (avgLossPct > 10) {
      suggestions.push({
        type: 'action', level: 'warning',
        title: '亏损基金需关注',
        detail: `${lossHoldings.length}只基金合计亏损¥${totalLoss.toFixed(0)}，平均跌幅${avgLossPct.toFixed(1)}%。若基本面未变可坚持定投摊低成本，若行业逻辑已变建议止损换仓。`,
      });
    }
  }

  if (suggestions.length === 0) {
    suggestions.push({
      type: 'info', level: 'success',
      title: '组合状态良好',
      detail: '当前资产配置较为均衡，继续保持定投纪律，定期检视组合。',
    });
  }

  return suggestions;
}

module.exports = router;
