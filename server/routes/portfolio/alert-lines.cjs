const express = require('express');
const logger = require('../../utils/logger.cjs');
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

const router = express.Router();
router.use(authMiddleware);

// GET /api/portfolio/alert-lines — 获取用户预警线设置
router.get('/alert-lines', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT al.*, fr.fund_name, fr.pnl_percent, fr.market_value
       FROM portfolio_alert_lines al
       LEFT JOIN fund_records fr ON al.fund_code = fr.fund_code AND fr.user_id = al.user_id AND (fr.record_type IS NULL OR fr.record_type = 'buy') AND fr.shares > 0
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({
      fund_code: r.fund_code,
      fund_name: r.fund_name,
      take_profit: parseFloat(r.take_profit),
      stop_loss: parseFloat(r.stop_loss),
      current_pnl_percent: r.pnl_percent ? parseFloat(r.pnl_percent) : null,
      market_value: r.market_value ? parseFloat(r.market_value) : null,
    })));
  } catch (error) {
    logger.error('获取预警线失败:', error.message);
    res.status(500).json({ error: '获取预警线失败' });
  }
});

// POST /api/portfolio/alert-lines — 设置预警线
router.post('/alert-lines', async (req, res) => {
  try {
    const pool = getPool();
    const { fund_code, fund_name, take_profit, stop_loss } = req.body;
    if (!fund_code) return res.status(400).json({ error: '缺少 fund_code' });

    await pool.query(
      `INSERT INTO portfolio_alert_lines (user_id, fund_code, fund_name, take_profit, stop_loss)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, fund_code) DO UPDATE SET take_profit = $4, stop_loss = $5, updated_at = NOW()`,
      [req.user.id, fund_code, fund_name || null, take_profit || null, stop_loss || null]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('设置预警线失败:', error.message);
    res.status(500).json({ error: '设置预警线失败' });
  }
});

// DELETE /api/portfolio/alert-lines/:fund_code — 删除预警线
router.delete('/alert-lines/:fund_code', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('DELETE FROM portfolio_alert_lines WHERE user_id = $1 AND fund_code = $2', [req.user.id, req.params.fund_code]);
    res.json({ success: true });
  } catch (error) {
    logger.error('删除预警线失败:', error.message);
    res.status(500).json({ error: '删除预警线失败' });
  }
});

module.exports = router;
