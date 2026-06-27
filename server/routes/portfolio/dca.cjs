const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');
const fundService = require('../../fund-service.cjs');
const { getDcaExecutionDates } = require('../../utils/portfolio-helpers.cjs');

const router = express.Router();
router.use(authMiddleware);

// GET /api/portfolio/dca-plans
router.get('/dca-plans', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM dca_plans WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    logger.error('获取定投计划失败:', error.message);
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
    if (!/^\d{6}$/.test(fund_code)) {
      return res.status(400).json({ error: '基金代码格式不正确，应为6位数字' });
    }
    if (typeof amount !== 'number' || amount <= 0 || amount > 10000000) {
      return res.status(400).json({ error: '定投金额必须在0~1000万之间' });
    }
    if (!['weekly', 'biweekly', 'monthly', 'quarterly'].includes(frequency)) {
      return res.status(400).json({ error: '定投频率不正确' });
    }
    if (day_of_month != null && (day_of_month < 1 || day_of_month > 31)) {
      return res.status(400).json({ error: '每月定投日必须在1-31之间' });
    }
    if (day_of_week != null && (day_of_week < 1 || day_of_week > 7)) {
      return res.status(400).json({ error: '每周定投日必须在1-7之间' });
    }
    if (notes && notes.length > 500) {
      return res.status(400).json({ error: '备注不能超过500个字符' });
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
    logger.error('创建定投计划失败:', error.message);
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
    logger.error('更新定投计划失败:', error.message);
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
    logger.error('删除定投计划失败:', error.message);
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
    logger.error('同步定投失败:', error.message);
    res.status(500).json({ error: '同步定投失败' });
  }
});

module.exports = router;
