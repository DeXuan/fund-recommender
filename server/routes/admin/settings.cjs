const express = require('express');
const router = express.Router();
const { getPool } = require('../../db.cjs');
const logger = require('../../utils/logger.cjs');
const { auditLog } = require('./helpers.cjs');

router.get('/settings', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT key, value, description FROM system_config ORDER BY key');
    const config = {};
    result.rows.forEach(r => { config[r.key] = { value: r.value, description: r.description }; });
    res.json({ config });
  } catch (error) {
    logger.error(`获取系统配置失败: ${error.message}`);
    res.status(500).json({ error: '获取系统配置失败' });
  }
});

// Allowed system config keys with validation
const ALLOWED_CONFIG = {
  max_login_attempts: (v) => { const n = parseInt(v); return n >= 1 && n <= 100 ? String(n) : null; },
  lockout_duration_minutes: (v) => { const n = parseInt(v); return n >= 1 && n <= 1440 ? String(n) : null; },
  password_min_length: (v) => { const n = parseInt(v); return n >= 6 && n <= 128 ? String(n) : null; },
  session_timeout_hours: (v) => { const n = parseInt(v); return n >= 1 && n <= 720 ? String(n) : null; },
  maintenance_mode: (v) => { return ['true', 'false'].includes(String(v)) ? String(v) : null; },
  registration_enabled: (v) => { return ['true', 'false'].includes(String(v)) ? String(v) : null; },
};

// PUT /api/admin/settings — update system config
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: '无效的配置' });
    const pool = getPool();
    for (const [key, value] of Object.entries(settings)) {
      const validator = ALLOWED_CONFIG[key];
      if (!validator) return res.status(400).json({ error: `不允许修改配置项: ${key}` });
      const safeValue = validator(value);
      if (safeValue === null) return res.status(400).json({ error: `配置项 ${key} 的值无效` });
      await pool.query(
        `INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, safeValue]
      );
    }
    await auditLog(req.user.id, req.user.username, 'update_settings', null, '', `更新: ${Object.keys(settings).join(', ')}`, req.ip);
    res.json({ success: true, message: '配置已更新' });
  } catch (error) {
    logger.error(`更新系统配置失败: ${error.message}`);
    res.status(500).json({ error: '更新系统配置失败' });
  }
});
router.get('/system-events', async (req, res) => {
  try {
    const { type, page = 1, pageSize = 50 } = req.query;
    const pool = getPool();
    let where = [];
    let params = [];
    let idx = 1;
    if (type) { where.push(`event_type = $${idx}`); params.push(type); idx++; }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));

    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM system_events ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT * FROM system_events ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, size, (pg - 1) * size]
    );

    res.json({ events: result.rows, total, page: pg, pageSize: size });
  } catch (error) {
    logger.error(`获取系统事件失败: ${error.message}`);
    res.status(500).json({ error: '获取系统事件失败' });
  }
});

// POST /api/admin/system-events — create system event
router.post('/system-events', async (req, res) => {
  try {
    const { event_type, severity, title, detail, source } = req.body;
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO system_events (event_type, severity, title, detail, source) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [event_type || 'custom', severity || 'info', title, detail || '', source || 'admin']
    );
    res.json({ success: true, event: result.rows[0] });
  } catch (error) {
    logger.error(`创建系统事件失败: ${error.message}`);
    res.status(500).json({ error: '创建系统事件失败' });
  }
});
module.exports = router;
