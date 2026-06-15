const express = require('express');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
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

// POST /api/portfolio/records/:id/sell — 快捷卖出（从持仓记录直接卖出）
router.post('/records/:id/sell', async (req, res) => {
  try {
    const { id } = req.params;
    const { shares, sell_price, sell_date, sell_fee, notes } = req.body;
    const pool = getPool();

    const recRes = await pool.query('SELECT * FROM fund_records WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (recRes.rows.length === 0) return res.status(404).json({ error: '记录不存在' });
    const rec = recRes.rows[0];

    if (!shares || shares <= 0) return res.status(400).json({ error: '赎回份额必须大于0' });
    if (shares > parseFloat(rec.shares) + 0.0001) return res.status(400).json({ error: '赎回份额超过该笔持有份额' });

    const costPrice = parseFloat(rec.cost_price);
    const pnl = (sell_price - costPrice) * shares - (sell_fee || 0);
    const pnlPercent = costPrice > 0 ? ((sell_price - costPrice) / costPrice * 100) : 0;

    // 如果全部赎回，直接更新原记录
    const isFullSell = Math.abs(shares - parseFloat(rec.shares)) < 0.001;
    if (isFullSell) {
      await pool.query(
        `UPDATE fund_records SET record_type = 'sell', sell_price = $1, sell_date = $2, sell_fee = $3, realized_pnl = $4, notes = $5, shares = $6 WHERE id = $7`,
        [sell_price, sell_date || new Date().toISOString().slice(0, 10), sell_fee || 0, pnl, notes || `赎回全部${shares}份`, -Math.abs(parseFloat(rec.shares)), id]
      );
    } else {
      // 部分赎回：减少原记录份额，新增卖出记录
      const remaining = parseFloat(rec.shares) - shares;
      await pool.query('UPDATE fund_records SET shares = $1 WHERE id = $2', [remaining, id]);
      await pool.query(
        `INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes, record_type, sell_price, sell_date, sell_fee, realized_pnl)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sell',$9,$10,$11,$12)`,
        [req.user.id, rec.fund_code, rec.fund_name, -Math.abs(shares), costPrice, rec.buy_date, 0,
         notes || `赎回${shares}份`, sell_price, sell_date || new Date().toISOString().slice(0, 10), sell_fee || 0, pnl]
      );
    }

    res.json({
      success: true,
      summary: {
        sellShares: shares,
        sellPrice: sell_price,
        realizedPnl: Math.round(pnl * 100) / 100,
        returnRate: Math.round(pnlPercent * 100) / 100,
        isFullSell,
      },
    });
  } catch (error) {
    console.error('快捷卖出失败:', error.message);
    res.status(500).json({ error: '快捷卖出失败' });
  }
});

module.exports = router;
