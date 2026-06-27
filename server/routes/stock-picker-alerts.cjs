const express = require('express');
const router = express.Router();
const { getPool } = require('../db.cjs');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const logger = require('../utils/logger.cjs');

router.use(authMiddleware);
router.use(subscriptionMiddleware);

// GET /api/stock-picker/alerts
router.get('/api/stock-picker/alerts', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM stock_alert_rules WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(`获取提醒规则失败: ${error.message}`);
    res.status(500).json({ error: '获取提醒规则失败' });
  }
});

// POST /api/stock-picker/alerts
router.post('/api/stock-picker/alerts', async (req, res) => {
  try {
    const { name, rule_type, conditions } = req.body;
    if (!name || !rule_type || !conditions) {
      return res.status(400).json({ error: '请填写完整的规则信息' });
    }
    const validTypes = ['fund_score_threshold', 'industry_valuation', 'index_temperature', 'custom_screener'];
    if (!validTypes.includes(rule_type)) {
      return res.status(400).json({ error: '无效的规则类型' });
    }
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO stock_alert_rules (user_id, name, rule_type, conditions) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, name, rule_type, JSON.stringify(conditions)]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`创建提醒规则失败: ${error.message}`);
    res.status(500).json({ error: '创建提醒规则失败' });
  }
});

// PUT /api/stock-picker/alerts/:id
router.put('/api/stock-picker/alerts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const { name, conditions, is_active } = req.body;
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM stock_alert_rules WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: '规则不存在' });
    const result = await pool.query(
      'UPDATE stock_alert_rules SET name = COALESCE($1, name), conditions = COALESCE($2, conditions), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, conditions ? JSON.stringify(conditions) : null, is_active, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`更新提醒规则失败: ${error.message}`);
    res.status(500).json({ error: '更新提醒规则失败' });
  }
});

// DELETE /api/stock-picker/alerts/:id
router.delete('/api/stock-picker/alerts/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const pool = getPool();
    await pool.query('DELETE FROM stock_alert_rules WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error(`删除提醒规则失败: ${error.message}`);
    res.status(500).json({ error: '删除提醒规则失败' });
  }
});

module.exports = router;
