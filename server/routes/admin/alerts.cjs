const express = require('express');
const router = express.Router();
const { getPool } = require('../../db.cjs');
const logger = require('../../utils/logger.cjs');
const { auditLog } = require('./helpers.cjs');

router.get('/alerts/rules', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM alert_rules ORDER BY created_at DESC');
    res.json({ rules: result.rows });
  } catch (error) {
    logger.error(`获取告警规则失败: ${error.message}`);
    res.status(500).json({ error: '获取告警规则失败' });
  }
});

// POST /api/admin/alerts/rules — create alert rule
router.post('/alerts/rules', async (req, res) => {
  try {
    const { name, metric, operator, threshold, duration, severity, enabled, notify_channels } = req.body;
    if (!name || !metric || !operator || threshold === undefined) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO alert_rules (name, metric, operator, threshold, duration, severity, enabled, notify_channels, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, metric, operator, threshold, duration || 0, severity || 'warning', enabled !== false, JSON.stringify(notify_channels || ['web']), req.user.id]
    );
    await auditLog(req.user.id, req.user.username, 'create_alert_rule', null, '', name, req.ip);
    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    logger.error(`创建告警规则失败: ${error.message}`);
    res.status(500).json({ error: '创建告警规则失败' });
  }
});

// PUT /api/admin/alerts/rules/:id — update alert rule
router.put('/alerts/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, metric, operator, threshold, duration, severity, enabled, notify_channels } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE alert_rules SET name=$1, metric=$2, operator=$3, threshold=$4, duration=$5, severity=$6, enabled=$7, notify_channels=$8, updated_at=NOW() WHERE id=$9`,
      [name, metric, operator, threshold, duration || 0, severity || 'warning', enabled !== false, JSON.stringify(notify_channels || ['web']), id]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error(`更新告警规则失败: ${error.message}`);
    res.status(500).json({ error: '更新告警规则失败' });
  }
});

// DELETE /api/admin/alerts/rules/:id — delete alert rule
router.delete('/alerts/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM alert_rules WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    logger.error(`删除告警规则失败: ${error.message}`);
    res.status(500).json({ error: '删除告警规则失败' });
  }
});

// GET /api/admin/alerts/history — alert history
router.get('/alerts/history', async (req, res) => {
  try {
    const { status, severity, page = 1, pageSize = 50 } = req.query;
    const pool = getPool();
    let where = [];
    let params = [];
    let idx = 1;
    if (status && ['firing', 'resolved'].includes(status)) { where.push(`status = $${idx}`); params.push(status); idx++; }
    if (severity && ['info', 'warning', 'critical'].includes(severity)) { where.push(`severity = $${idx}`); params.push(severity); idx++; }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));

    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM alert_history ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT * FROM alert_history ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, size, (pg - 1) * size]
    );

    // Stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'firing') AS firing_count,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h
      FROM alert_history
    `);

    res.json({ history: result.rows, total, page: pg, pageSize: size, stats: statsResult.rows[0] });
  } catch (error) {
    logger.error(`获取告警历史失败: ${error.message}`);
    res.status(500).json({ error: '获取告警历史失败' });
  }
});

// POST /api/admin/alerts/history/:id/resolve — resolve alert
router.post('/alerts/history/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query("UPDATE alert_history SET status = 'resolved', resolved_at = NOW() WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    logger.error(`解决告警失败: ${error.message}`);
    res.status(500).json({ error: '解决告警失败' });
  }
});
module.exports = router;
