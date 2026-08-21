const express = require('express');
const router = express.Router();
const { getPool } = require('../../db.cjs');
const logger = require('../../utils/logger.cjs');
const { auditLog } = require('./helpers.cjs');

router.get('/audit-logs', async (req, res) => {
  try {
    const { action, admin_id, page = 1, pageSize = 50 } = req.query;
    const pool = getPool();

    let where = [];
    let params = [];
    let idx = 1;
    if (action) { where.push(`action = $${idx}`); params.push(action); idx++; }
    if (admin_id) { where.push(`admin_id = $${idx}`); params.push(parseInt(admin_id)); idx++; }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM admin_audit_logs ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const pg = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));

    const result = await pool.query(
      `SELECT * FROM admin_audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, size, (pg - 1) * size]
    );

    res.json({ logs: result.rows, total, page: pg, pageSize: size, totalPages: Math.ceil(total / size) });
  } catch (error) {
    logger.error(`获取审计日志失败: ${error.message}`);
    res.status(500).json({ error: '获取审计日志失败' });
  }
});
router.get('/login-logs', async (req, res) => {
  try {
    const { user_id, status, page = 1, pageSize = 50 } = req.query;
    const pool = getPool();
    let where = [];
    let params = [];
    let idx = 1;
    if (user_id) { where.push(`l.user_id = $${idx}`); params.push(parseInt(user_id)); idx++; }
    if (status && ['success', 'failed', 'locked'].includes(status)) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(200, Math.max(1, parseInt(pageSize)));

    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM login_logs l ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT l.*, u.nickname FROM login_logs l LEFT JOIN users u ON l.user_id = u.id ${whereClause} ORDER BY l.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, size, (pg - 1) * size]
    );

    // Stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'success') AS success_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
        COUNT(*) FILTER (WHERE status = 'locked') AS locked_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
        COUNT(DISTINCT login_ip) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS unique_ips_24h
      FROM login_logs
    `);

    res.json({ logs: result.rows, total, page: pg, pageSize: size, totalPages: Math.ceil(total / size), stats: statsResult.rows[0] });
  } catch (error) {
    logger.error(`获取登录日志失败: ${error.message}`);
    res.status(500).json({ error: '获取登录日志失败' });
  }
});

// GET /api/admin/online-users — currently active users (logged in within last 15 minutes)
router.get('/online-users', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT u.id, u.username, u.nickname, u.avatar_url, u.role, u.last_login_at, u.last_login_ip,
             l.browser, l.os, l.device
      FROM users u
      LEFT JOIN LATERAL (
        SELECT browser, os, device FROM login_logs WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
      ) l ON true
      WHERE u.last_login_at > NOW() - INTERVAL '15 minutes' AND u.status = 'active'
      ORDER BY u.last_login_at DESC
    `);

    const totalCount = await pool.query("SELECT COUNT(*) AS count FROM users WHERE last_login_at > NOW() - INTERVAL '15 minutes' AND status = 'active'");

    // Session stats
    const sessionStats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '5 minutes') AS last_5min,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '15 minutes') AS last_15min,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '1 hour') AS last_1hour,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '24 hours') AS last_24hour
      FROM users WHERE status = 'active'
    `);

    res.json({ users: result.rows, total: parseInt(totalCount.rows[0].count), sessionStats: sessionStats.rows[0] });
  } catch (error) {
    logger.error(`获取在线用户失败: ${error.message}`);
    res.status(500).json({ error: '获取在线用户失败' });
  }
});
module.exports = router;
