const express = require('express');
const multer = require('multer');
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
      { fund_code: '000478', fund_name: '建信中债1-3年国开行债券A', shares: 5000, cost_price: 1.0823, buy_date: '2024-06-15', buy_fee: 0, notes: '支付宝稳健理财' },
      { fund_code: '000961', fund_name: '天弘沪深300ETF联接A', shares: 2000, cost_price: 1.3456, buy_date: '2024-03-20', buy_fee: 2.69, notes: '支付宝金选指数基金' },
      { fund_code: '110011', fund_name: '易方达中小盘混合', shares: 1500, cost_price: 5.6789, buy_date: '2024-01-10', buy_fee: 8.52, notes: '支付宝推荐混合基金' },
      { fund_code: '161725', fund_name: '招商中证白酒指数A', shares: 3000, cost_price: 1.2345, buy_date: '2024-04-08', buy_fee: 3.70, notes: '行业主题基金' },
      { fund_code: '003834', fund_name: '华夏能源革新股票A', shares: 2500, cost_price: 2.8765, buy_date: '2024-02-28', buy_fee: 4.31, notes: '新能源主题' },
      { fund_code: '005827', fund_name: '易方达蓝筹精选混合', shares: 1000, cost_price: 2.1234, buy_date: '2024-05-12', buy_fee: 2.12, notes: '支付宝金选明星基金' },
      { fund_code: '012414', fund_name: '东方红启东三年持有混合', shares: 800, cost_price: 0.9876, buy_date: '2024-07-01', buy_fee: 0, notes: '持有期基金' },
      { fund_code: '000209', fund_name: '信诚新兴产业混合A', shares: 1200, cost_price: 3.4567, buy_date: '2024-03-05', buy_fee: 1.83, notes: '新兴产业主题' },
    ];

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
    const { id } = req.params;

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
    const { id } = req.params;
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
    const { id } = req.params;

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
    const { id } = req.params;
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

module.exports = router;
