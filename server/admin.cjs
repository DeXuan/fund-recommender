const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { getPool } = require('./db.cjs');
const { authMiddleware, adminMiddleware } = require('./auth.cjs');
const logger = require('./utils/logger.cjs');

function safeExec(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim(); } catch { return ''; }
}

async function safeExecAsync(cmd, timeoutMs = 5000) {
  try {
    const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: timeoutMs });
    return stdout.trim();
  } catch { return ''; }
}

// Cache for server-resources to avoid blocking Node.js with repeated system calls
let serverResourcesCache = { data: null, timestamp: 0 };
const SERVER_RESOURCES_CACHE_TTL = 8000; // 8 seconds

const router = express.Router();

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// Request metrics (in-memory, shared via app.locals)
let requestCount = 0;
let slowQueryCount = 0;
const startTime = Date.now();

function resetQpsCounter() { requestCount = 0; }

// ========== Helper: audit log ==========
async function auditLog(adminId, adminUsername, action, targetUserId, targetUsername, detail, ip) {
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, admin_username, action, target_user_id, target_username, detail, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [adminId, adminUsername, action, targetUserId || null, targetUsername || '', detail || '', ip || '']
    );
  } catch (e) { /* don't let audit failure break the main flow */ }
}

// ========== User Management ==========

// GET /api/admin/users — list all users with search/filter/pagination
router.get('/users', async (req, res) => {
  try {
    const { search, role, status, page = 1, pageSize = 20, sort = 'created_at', order = 'desc' } = req.query;
    const pool = getPool();

    let where = [];
    let params = [];
    let idx = 1;

    if (search) {
      where.push(`(u.username ILIKE $${idx} OR u.nickname ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (role && ['admin', 'user'].includes(role)) {
      where.push(`u.role = $${idx}`);
      params.push(role);
      idx++;
    }
    if (status && ['active', 'disabled'].includes(status)) {
      where.push(`u.status = $${idx}`);
      params.push(status);
      idx++;
    }
    if (req.query.vip === 'true') {
      where.push(`(u.subscription_status = 'premium' AND u.subscription_end > NOW())`);
    } else if (req.query.vip === 'false') {
      where.push(`(u.subscription_status IS NULL OR u.subscription_status = 'free' OR u.subscription_end IS NULL OR u.subscription_end <= NOW())`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const allowedSort = ['created_at', 'username', 'last_login_at', 'role', 'subscription_status'];
    const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const pg = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize)));
    const offset = (pg - 1) * size;

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT u.id, u.username, u.nickname, u.avatar_url, u.role, u.status, u.created_at, u.last_login_at,
              u.subscription_status, u.subscription_end, u.subscription_plan_id,
              COUNT(DISTINCT oa.id) AS oauth_count,
              COUNT(DISTINCT fr.id) AS record_count,
              COALESCE(SUM(fr.shares * fr.cost_price), 0) AS total_invested
       FROM users u
       LEFT JOIN oauth_accounts oa ON oa.user_id = u.id
       LEFT JOIN fund_records fr ON fr.user_id = u.id
       ${whereClause}
       GROUP BY u.id
       ORDER BY u.${sortCol} ${sortOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, size, offset]
    );

    res.json({ users: result.rows, total, page: pg, pageSize: size, totalPages: Math.ceil(total / size) });
  } catch (error) {
    logger.error(`获取用户列表失败: ${error.message}`);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// GET /api/admin/users/stats — user statistics
router.get('/users/stats', async (req, res) => {
  try {
    const pool = getPool();

    // Basic counts
    const countsResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE role = 'admin') AS admin_count,
        COUNT(*) FILTER (WHERE role = 'user') AS user_count,
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COUNT(*) FILTER (WHERE status = 'disabled') AS disabled_count,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') AS active_7d,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '30 days') AS active_30d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_30d,
        COUNT(*) FILTER (WHERE subscription_status = 'premium' AND subscription_end > NOW()) AS vip_count
      FROM users
    `);

    // Registration trend (last 30 days)
    const trendResult = await pool.query(`
      SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS date, COUNT(*) AS count
      FROM users
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY created_at::date
      ORDER BY date
    `);

    // Login trend (last 30 days)
    const loginTrendResult = await pool.query(`
      SELECT TO_CHAR(last_login_at::date, 'YYYY-MM-DD') AS date, COUNT(*) AS count
      FROM users
      WHERE last_login_at > NOW() - INTERVAL '30 days'
      GROUP BY last_login_at::date
      ORDER BY date
    `);

    // OAuth provider distribution
    const oauthResult = await pool.query(`
      SELECT provider, COUNT(*) AS count
      FROM oauth_accounts
      GROUP BY provider
    `);

    res.json({
      ...countsResult.rows[0],
      registrationTrend: trendResult.rows,
      loginTrend: loginTrendResult.rows,
      oauthDistribution: oauthResult.rows,
    });
  } catch (error) {
    logger.error(`获取用户统计失败: ${error.message}`);
    res.status(500).json({ error: '获取用户统计失败' });
  }
});

// GET /api/admin/users/:id — user detail
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const userResult = await pool.query(
      `SELECT id, username, nickname, avatar_url, role, status, created_at, last_login_at
       FROM users WHERE id = $1`, [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const user = userResult.rows[0];

    // OAuth accounts
    const oauthResult = await pool.query(
      'SELECT provider, provider_user_id, created_at FROM oauth_accounts WHERE user_id = $1', [id]
    );

    // Portfolio summary
    const portfolioResult = await pool.query(
      `SELECT COUNT(*) AS record_count,
              COALESCE(SUM(shares * cost_price), 0) AS total_cost,
              COALESCE(SUM(market_value), 0) AS total_value,
              COALESCE(SUM(pnl), 0) AS total_pnl
       FROM fund_records WHERE user_id = $1`, [id]
    );

    // Watchlist count
    const watchlistResult = await pool.query(
      'SELECT COUNT(*) AS count FROM watchlist WHERE user_id = $1', [id]
    );

    // DCA plans
    const dcaResult = await pool.query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'active') AS active
       FROM dca_plans WHERE user_id = $1`, [id]
    );

    // Risk profile
    const riskResult = await pool.query(
      'SELECT risk_type, risk_level, score, created_at FROM risk_profiles WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [id]
    );

    res.json({
      user,
      oauthAccounts: oauthResult.rows,
      portfolio: portfolioResult.rows[0],
      watchlistCount: parseInt(watchlistResult.rows[0].count),
      dcaPlans: dcaResult.rows[0],
      riskProfile: riskResult.rows[0] || null,
    });
  } catch (error) {
    logger.error(`获取用户详情失败: ${error.message}`);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// PUT /api/admin/users/:id/role — update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    if (parseInt(id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: '不能修改自己的管理员权限' });
    }
    const pool = getPool();
    const target = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    await auditLog(req.user.id, req.user.username, 'change_role', parseInt(id), target.rows[0].username, `角色改为 ${role}`, req.ip);
    logger.info(`管理员 ${req.user.username} 将用户 ${target.rows[0].username} 角色修改为 ${role}`);
    res.json({ success: true, message: '角色修改成功' });
  } catch (error) {
    logger.error(`修改用户角色失败: ${error.message}`);
    res.status(500).json({ error: '修改用户角色失败' });
  }
});

// PUT /api/admin/users/:id/status — enable/disable user
router.put('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: '无效的状态' });
    }
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能禁用自己的账户' });
    }
    const pool = getPool();
    const target = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
    await auditLog(req.user.id, req.user.username, status === 'disabled' ? 'disable_user' : 'enable_user', parseInt(id), target.rows[0].username, '', req.ip);
    logger.info(`管理员 ${req.user.username} ${status === 'disabled' ? '禁用' : '启用'}了用户 ${target.rows[0].username}`);
    res.json({ success: true, message: status === 'disabled' ? '用户已禁用' : '用户已启用' });
  } catch (error) {
    logger.error(`修改用户状态失败: ${error.message}`);
    res.status(500).json({ error: '修改用户状态失败' });
  }
});

// POST /api/admin/users/:id/reset-password — reset password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const target = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    const bcrypt = require('bcryptjs');
    const crypto = require('crypto');
    const newPassword = crypto.randomBytes(6).toString('base64url').slice(0, 12);
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);

    await auditLog(req.user.id, req.user.username, 'reset_password', parseInt(id), target.rows[0].username, '', req.ip);
    logger.info(`管理员 ${req.user.username} 重置了用户 ${target.rows[0].username} 的密码`);
    res.json({ success: true, newPassword, message: '密码已重置' });
  } catch (error) {
    logger.error(`重置密码失败: ${error.message}`);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// POST /api/admin/users/batch — batch operations
router.post('/users/batch', async (req, res) => {
  try {
    const { ids, action, role } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请选择用户' });
    }
    if (!['delete', 'disable', 'enable', 'change_role'].includes(action)) {
      return res.status(400).json({ error: '无效的操作' });
    }
    // Prevent operating on self
    if (ids.includes(req.user.id) && (action === 'delete' || action === 'disable')) {
      return res.status(400).json({ error: '不能对自己执行此操作' });
    }
    const pool = getPool();
    const safeIds = ids.filter(id => id !== req.user.id);

    if (action === 'delete') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const id of safeIds) {
          const u = await client.query('SELECT username FROM users WHERE id = $1', [id]);
          await client.query('DELETE FROM watchlist WHERE user_id = $1', [id]);
          await client.query('DELETE FROM fund_records WHERE user_id = $1', [id]);
          await client.query('DELETE FROM dca_plans WHERE user_id = $1', [id]);
          await client.query('DELETE FROM risk_profiles WHERE user_id = $1', [id]);
          await client.query('DELETE FROM oauth_accounts WHERE user_id = $1', [id]);
          await client.query('DELETE FROM subscription_orders WHERE user_id = $1', [id]);
          await client.query('DELETE FROM login_logs WHERE user_id = $1', [id]);
          await client.query('DELETE FROM chat_history WHERE user_id = $1', [id]);
          await client.query('DELETE FROM users WHERE id = $1', [id]);
          if (u.rows.length > 0) {
            await auditLog(req.user.id, req.user.username, 'batch_delete', id, u.rows[0].username, '', req.ip);
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else if (action === 'disable' || action === 'enable') {
      const newStatus = action === 'disable' ? 'disabled' : 'active';
      await pool.query(`UPDATE users SET status = $1 WHERE id = ANY($2) AND id != $3`, [newStatus, safeIds, req.user.id]);
      await auditLog(req.user.id, req.user.username, `batch_${action}`, null, '', `${safeIds.length} 个用户`, req.ip);
    } else if (action === 'change_role' && ['admin', 'user'].includes(role)) {
      await pool.query(`UPDATE users SET role = $1 WHERE id = ANY($2) AND id != $3`, [role, safeIds, req.user.id]);
      await auditLog(req.user.id, req.user.username, 'batch_change_role', null, '', `${safeIds.length} 个用户 -> ${role}`, req.ip);
    }

    res.json({ success: true, message: `批量操作成功，影响 ${safeIds.length} 个用户` });
  } catch (error) {
    logger.error(`批量操作失败: ${error.message}`);
    res.status(500).json({ error: '批量操作失败' });
  }
});

// GET /api/admin/audit-logs — admin audit logs
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

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    const pool = getPool();
    const user = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    await pool.query('DELETE FROM watchlist WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM fund_records WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM dca_plans WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM risk_profiles WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM oauth_accounts WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM subscription_orders WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM login_logs WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM chat_history WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM user_notes WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await auditLog(req.user.id, req.user.username, 'delete_user', parseInt(id), user.rows[0].username, '', req.ip);
    logger.info(`管理员 ${req.user.username} 删除了用户 ${user.rows[0].username} (ID=${id})`);
    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    logger.error(`删除用户失败: ${error.message}`);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// PUT /api/admin/users/:id — edit user profile
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, avatar_url, email, phone } = req.body;
    const pool = getPool();
    const target = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    const updates = [];
    const params = [];
    let idx = 1;
    if (nickname !== undefined) {
      if (typeof nickname !== 'string' || !nickname.trim()) return res.status(400).json({ error: '昵称不能为空' });
      if (nickname.length > 30) return res.status(400).json({ error: '昵称不能超过30个字符' });
      updates.push(`nickname = $${idx}`); params.push(nickname.trim()); idx++;
    }
    if (avatar_url !== undefined) {
      if (avatar_url && typeof avatar_url === 'string' && avatar_url.length > 0) {
        try { new URL(avatar_url); } catch { return res.status(400).json({ error: '头像URL格式无效' }); }
      }
      updates.push(`avatar_url = $${idx}`); params.push(avatar_url || ''); idx++;
    }
    if (updates.length === 0) return res.status(400).json({ error: '没有要更新的字段' });

    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    await auditLog(req.user.id, req.user.username, 'edit_user', parseInt(id), target.rows[0].username, `更新: ${Object.keys(req.body).join(', ')}`, req.ip);
    res.json({ success: true, message: '用户信息已更新' });
  } catch (error) {
    logger.error(`编辑用户失败: ${error.message}`);
    res.status(500).json({ error: '编辑用户失败' });
  }
});

// PUT /api/admin/users/:id/vip — grant/revoke VIP
router.put('/users/:id/vip', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, days, plan_name } = req.body;
    const pool = getPool();
    const target = await pool.query('SELECT username, subscription_status, subscription_end FROM users WHERE id = $1', [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    const user = target.rows[0];

    if (action === 'grant') {
      // Grant VIP: set premium status with expiration
      const grantDays = parseInt(days) || 30;
      const startDate = new Date();
      // If user already has active VIP, extend from current end date
      let endDate;
      if (user.subscription_status === 'premium' && user.subscription_end && new Date(user.subscription_end) > new Date()) {
        endDate = new Date(new Date(user.subscription_end).getTime() + grantDays * 86400000);
      } else {
        endDate = new Date(Date.now() + grantDays * 86400000);
      }

      // Get or create a default plan
      let planId = null;
      if (plan_name) {
        const planResult = await pool.query('SELECT id FROM subscription_plans WHERE name = $1', [plan_name]);
        if (planResult.rows.length > 0) planId = planResult.rows[0].id;
      }
      if (!planId) {
        const defaultPlan = await pool.query("SELECT id FROM subscription_plans WHERE is_active = true ORDER BY price DESC LIMIT 1");
        planId = defaultPlan.rows[0]?.id || null;
      }

      await pool.query(
        `UPDATE users SET subscription_status = 'premium', subscription_plan_id = $1, subscription_start = NOW(), subscription_end = $2 WHERE id = $3`,
        [planId, endDate, id]
      );

      // Create an order record for tracking
      const outTradeNo = `ADMIN_GRANT_${Date.now()}_${id}`;
      await pool.query(
        `INSERT INTO subscription_orders (user_id, plan_id, out_trade_no, amount, status, paid_at)
         VALUES ($1, $2, $3, 0, 'admin_granted', NOW())`,
        [id, planId, outTradeNo]
      ).catch(() => {}); // non-critical

      await auditLog(req.user.id, req.user.username, 'grant_vip', parseInt(id), user.username, `授予VIP ${grantDays}天，到期 ${endDate.toLocaleDateString('zh-CN')}`, req.ip);
      logger.info(`管理员 ${req.user.username} 授予用户 ${user.username} VIP ${grantDays}天`);
      res.json({ success: true, message: `已授予VIP ${grantDays}天`, expiresAt: endDate });
    } else if (action === 'revoke') {
      // Revoke VIP
      await pool.query(
        `UPDATE users SET subscription_status = 'free', subscription_plan_id = NULL, subscription_start = NULL, subscription_end = NULL WHERE id = $1`,
        [id]
      );
      await auditLog(req.user.id, req.user.username, 'revoke_vip', parseInt(id), user.username, '撤销VIP', req.ip);
      logger.info(`管理员 ${req.user.username} 撤销了用户 ${user.username} 的VIP`);
      res.json({ success: true, message: 'VIP已撤销' });
    } else if (action === 'extend') {
      // Extend VIP
      const extendDays = parseInt(days) || 30;
      if (!user.subscription_end || new Date(user.subscription_end) <= new Date()) {
        return res.status(400).json({ error: '用户不是VIP，无法延期' });
      }
      const newEnd = new Date(new Date(user.subscription_end).getTime() + extendDays * 86400000);
      await pool.query('UPDATE users SET subscription_end = $1 WHERE id = $2', [newEnd, id]);
      await auditLog(req.user.id, req.user.username, 'extend_vip', parseInt(id), user.username, `延期${extendDays}天至 ${newEnd.toLocaleDateString('zh-CN')}`, req.ip);
      res.json({ success: true, message: `VIP已延期${extendDays}天`, expiresAt: newEnd });
    } else {
      return res.status(400).json({ error: '无效操作，支持: grant, revoke, extend' });
    }
  } catch (error) {
    logger.error(`VIP操作失败: ${error.message}`);
    res.status(500).json({ error: 'VIP操作失败' });
  }
});

// GET /api/admin/users/:id/vip — get VIP detail
router.get('/users/:id/vip', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const userResult = await pool.query(
      `SELECT id, username, subscription_status, subscription_plan_id, subscription_start, subscription_end FROM users WHERE id = $1`, [id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: '用户不存在' });

    const user = userResult.rows[0];
    let plan = null;
    if (user.subscription_plan_id) {
      const planResult = await pool.query('SELECT * FROM subscription_plans WHERE id = $1', [user.subscription_plan_id]);
      plan = planResult.rows[0] || null;
    }

    // Order history
    const orders = await pool.query(
      `SELECT so.*, sp.name AS plan_name FROM subscription_orders so
       LEFT JOIN subscription_plans sp ON so.plan_id = sp.id
       WHERE so.user_id = $1 ORDER BY so.created_at DESC LIMIT 20`, [id]
    );

    const isActive = user.subscription_status === 'premium' && user.subscription_end && new Date(user.subscription_end) > new Date();
    const daysRemaining = isActive ? Math.ceil((new Date(user.subscription_end).getTime() - Date.now()) / 86400000) : 0;

    res.json({
      status: user.subscription_status || 'free',
      isActive,
      plan,
      startDate: user.subscription_start,
      endDate: user.subscription_end,
      daysRemaining,
      orders: orders.rows,
    });
  } catch (error) {
    logger.error(`获取VIP详情失败: ${error.message}`);
    res.status(500).json({ error: '获取VIP详情失败' });
  }
});

// GET /api/admin/subscriptions — list all subscription plans
router.get('/subscriptions', async (req, res) => {
  try {
    const pool = getPool();
    const plans = await pool.query('SELECT * FROM subscription_plans ORDER BY price');
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE subscription_status = 'premium' AND subscription_end > NOW()) AS active_vip,
        COUNT(*) FILTER (WHERE subscription_status = 'premium' AND subscription_end <= NOW()) AS expired_vip,
        COUNT(*) FILTER (WHERE subscription_status = 'free' OR subscription_status IS NULL) AS free_users
      FROM users
    `);
    res.json({ plans: plans.rows, stats: stats.rows[0] });
  } catch (error) {
    logger.error(`获取订阅信息失败: ${error.message}`);
    res.status(500).json({ error: '获取订阅信息失败' });
  }
});

// GET /api/admin/login-logs — login history
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

// GET /api/admin/users/export — export users as CSV
router.get('/users/export', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT u.id, u.username, u.nickname, u.role, u.status, u.created_at, u.last_login_at, u.last_login_ip,
             COUNT(DISTINCT fr.id) AS record_count,
             COALESCE(SUM(fr.shares * fr.cost_price), 0) AS total_invested
      FROM users u
      LEFT JOIN fund_records fr ON fr.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    const header = 'ID,用户名,昵称,角色,状态,注册时间,最后登录,最后IP,持仓数,总投入\n';
    const escapeCsv = (val) => {
      const s = String(val ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n') || s.startsWith('=') || s.startsWith('+') || s.startsWith('-') || s.startsWith('@')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return '"' + s + '"';
    };
    const csv = result.rows.map(r =>
      [r.id, r.username, r.nickname || '', r.role, r.status, new Date(r.created_at).toLocaleString('zh-CN'), r.last_login_at ? new Date(r.last_login_at).toLocaleString('zh-CN') : '', r.last_login_ip || '', r.record_count, parseFloat(r.total_invested).toFixed(2)].map(escapeCsv).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=users_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('﻿' + header + csv);
  } catch (error) {
    logger.error(`导出用户失败: ${error.message}`);
    res.status(500).json({ error: '导出用户失败' });
  }
});

// POST /api/admin/users/:id/notes — add admin note
router.post('/users/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: '备注内容不能为空' });
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO user_notes (user_id, admin_id, admin_username, content) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.user.id, req.user.username, content.trim()]
    );
    await auditLog(req.user.id, req.user.username, 'add_note', parseInt(id), '', content.trim().slice(0, 100), req.ip);
    res.json({ success: true, note: result.rows[0] });
  } catch (error) {
    logger.error(`添加备注失败: ${error.message}`);
    res.status(500).json({ error: '添加备注失败' });
  }
});

// GET /api/admin/users/:id/notes — get user notes
router.get('/users/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM user_notes WHERE user_id = $1 ORDER BY created_at DESC`, [id]
    );
    res.json({ notes: result.rows });
  } catch (error) {
    logger.error(`获取备注失败: ${error.message}`);
    res.status(500).json({ error: '获取备注失败' });
  }
});

// DELETE /api/admin/notes/:id — delete note
router.delete('/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM user_notes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    logger.error(`删除备注失败: ${error.message}`);
    res.status(500).json({ error: '删除备注失败' });
  }
});

// ========== System Settings ==========

// GET /api/admin/settings — get system config
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

// ========== Alert Rules ==========

// GET /api/admin/alerts/rules — list alert rules
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

// ========== API Statistics ==========

// In-memory API stats collector
const apiStatsBuffer = new Map(); // key: `${method}:${endpoint}` -> { count, errors, totalTime, maxTime, times[] }

function recordApiStat(method, endpoint, statusCode, responseTimeMs) {
  const key = `${method}:${endpoint}`;
  if (!apiStatsBuffer.has(key)) {
    apiStatsBuffer.set(key, { count: 0, errors: 0, totalTime: 0, maxTime: 0, times: [] });
  }
  const stat = apiStatsBuffer.get(key);
  stat.count++;
  if (statusCode >= 400) stat.errors++;
  stat.totalTime += responseTimeMs;
  stat.maxTime = Math.max(stat.maxTime, responseTimeMs);
  stat.times.push(responseTimeMs);
  // Keep only last 1000 times for p95 calculation
  if (stat.times.length > 1000) stat.times = stat.times.slice(-1000);
}

// Flush API stats to database periodically (every 5 minutes)
async function flushApiStats() {
  if (apiStatsBuffer.size === 0) return;
  try {
    const pool = getPool();
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);

    for (const [key, stat] of apiStatsBuffer.entries()) {
      const [method, endpoint] = key.split(':');
      const sorted = [...stat.times].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      const avg = stat.count > 0 ? stat.totalTime / stat.count : 0;

      await pool.query(
        `INSERT INTO api_stats (hour_start, endpoint, method, request_count, error_count, avg_response_ms, max_response_ms, p95_response_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (hour_start, endpoint, method) DO UPDATE SET
           request_count = api_stats.request_count + $4,
           error_count = api_stats.error_count + $5,
           avg_response_ms = (api_stats.avg_response_ms + $6) / 2,
           max_response_ms = GREATEST(api_stats.max_response_ms, $7),
           p95_response_ms = GREATEST(api_stats.p95_response_ms, $8)`,
        [hourStart, endpoint, method, stat.count, stat.errors, avg, stat.maxTime, p95]
      );
    }
    apiStatsBuffer.clear();
  } catch (e) {
    logger.error(`Flush API stats failed: ${e.message}`);
  }
}
setInterval(flushApiStats, 5 * 60 * 1000);

// GET /api/admin/api-stats — API statistics
router.get('/api-stats', async (req, res) => {
  try {
    const pool = getPool();
    const { hours = 24 } = req.query;

    // From database (historical)
    const dbStats = await pool.query(`
      SELECT endpoint, method,
             SUM(request_count) AS total_requests,
             SUM(error_count) AS total_errors,
             ROUND(AVG(avg_response_ms)::numeric, 2) AS avg_ms,
             ROUND(MAX(max_response_ms)::numeric, 2) AS max_ms,
             ROUND(AVG(p95_response_ms)::numeric, 2) AS p95_ms
      FROM api_stats
      WHERE hour_start > NOW() - ($1 || ' hours')::interval
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
      LIMIT 50
    `, [String(parseInt(hours) || 24)]);

    // From memory buffer (current)
    const liveStats = [];
    for (const [key, stat] of apiStatsBuffer.entries()) {
      const [method, endpoint] = key.split(':');
      const sorted = [...stat.times].sort((a, b) => a - b);
      liveStats.push({
        endpoint, method,
        total_requests: stat.count,
        total_errors: stat.errors,
        avg_ms: stat.count > 0 ? (stat.totalTime / stat.count).toFixed(2) : 0,
        max_ms: stat.maxTime.toFixed(2),
        p95_ms: (sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2),
        live: true,
      });
    }

    // Hourly trend
    const trendResult = await pool.query(`
      SELECT hour_start,
             SUM(request_count) AS requests,
             SUM(error_count) AS errors,
             ROUND(AVG(avg_response_ms)::numeric, 2) AS avg_ms
      FROM api_stats
      WHERE hour_start > NOW() - ($1 || ' hours')::interval
      GROUP BY hour_start
      ORDER BY hour_start
    `, [String(parseInt(hours) || 24)]);

    // Error rate
    const errorRate = await pool.query(`
      SELECT
        COALESCE(SUM(request_count), 0) AS total,
        COALESCE(SUM(error_count), 0) AS errors,
        CASE WHEN SUM(request_count) > 0 THEN ROUND(SUM(error_count) * 100.0 / SUM(request_count), 2) ELSE 0 END AS error_rate
      FROM api_stats WHERE hour_start > NOW() - INTERVAL '24 hours'
    `);

    res.json({
      endpoints: [...liveStats, ...dbStats.rows.filter(d => !liveStats.find(l => l.endpoint === d.endpoint && l.method === d.method))],
      trend: trendResult.rows,
      errorRate: errorRate.rows[0],
    });
  } catch (error) {
    logger.error(`获取API统计失败: ${error.message}`);
    res.status(500).json({ error: '获取API统计失败' });
  }
});

// ========== Health Check ==========

// GET /api/admin/health-check — comprehensive health check
router.get('/health-check', async (req, res) => {
  const checks = [];
  const startTime = Date.now();

  // 1. Database check
  try {
    const dbStart = Date.now();
    const pool = getPool();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    checks.push({ name: 'PostgreSQL', status: 'healthy', latency: dbLatency, detail: `连接正常，延迟 ${dbLatency}ms` });
  } catch (e) {
    checks.push({ name: 'PostgreSQL', status: 'unhealthy', detail: e.message });
  }

  // 2. Memory check
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPercent = Math.round(heapUsedMB / heapTotalMB * 100);
  checks.push({
    name: '堆内存',
    status: heapPercent > 90 ? 'warning' : 'healthy',
    detail: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    value: heapPercent,
  });

  // 3. System memory
  const sysMemPercent = Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100);
  checks.push({
    name: '系统内存',
    status: sysMemPercent > 90 ? 'critical' : sysMemPercent > 80 ? 'warning' : 'healthy',
    detail: `${sysMemPercent}% 已使用`,
    value: sysMemPercent,
  });

  // 4. Disk check
  try {
    const isWin = os.platform() === 'win32';
    if (isWin) {
      const diskRaw = await safeExecAsync('powershell -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object { $_.Name + \\",\\" + $_.Used + \\",\\" + $_.Free }"');
      diskRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3) {
          const used = parseInt(p[1]) || 0;
          const free = parseInt(p[2]) || 0;
          const total = used + free;
          const percent = total > 0 ? Math.round(used / total * 100) : 0;
          checks.push({
            name: `磁盘 ${p[0].trim()}:`,
            status: percent > 95 ? 'critical' : percent > 85 ? 'warning' : 'healthy',
            detail: `${percent}% 已使用 (${formatBytes(used)} / ${formatBytes(total)})`,
            value: percent,
          });
        }
      });
    } else {
      const df = await safeExecAsync("df -h / | tail -1");
      const parts = df.split(/\s+/);
      if (parts.length >= 5) {
        const percent = parseInt(parts[4]) || 0;
        checks.push({ name: '磁盘 /', status: percent > 95 ? 'critical' : percent > 85 ? 'warning' : 'healthy', detail: `${percent} 已使用`, value: percent });
      }
    }
  } catch { checks.push({ name: '磁盘', status: 'unknown', detail: '无法获取' }); }

  // 5. Uptime
  const uptimeSec = Math.floor(process.uptime());
  checks.push({ name: '服务运行', status: 'healthy', detail: formatDuration(uptimeSec), value: uptimeSec });

  // 6. Connection pool
  try {
    const pool = getPool();
    const connResult = await pool.query("SELECT count(*) AS total FROM pg_stat_activity WHERE datname = current_database()");
    const maxConn = await pool.query("SHOW max_connections");
    const total = parseInt(connResult.rows[0].total);
    const max = parseInt(maxConn.rows[0].max_connections);
    const connPercent = Math.round(total / max * 100);
    checks.push({
      name: '数据库连接',
      status: connPercent > 80 ? 'warning' : 'healthy',
      detail: `${total} / ${max} (${connPercent}%)`,
      value: connPercent,
    });
  } catch {}

  const overallStatus = checks.some(c => c.status === 'unhealthy' || c.status === 'critical') ? 'critical'
    : checks.some(c => c.status === 'warning') ? 'warning' : 'healthy';

  res.json({ status: overallStatus, checks, totalLatency: Date.now() - startTime, timestamp: Date.now() });
});

// ========== System Events ==========

// GET /api/admin/system-events — system events
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

// ========== System Monitoring ==========

// GET /api/admin/metrics — real-time system metrics
router.get('/metrics', async (req, res) => {
  try {
    const pool = getPool();
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - startTime) / 1000);

    // QPS calculation
    const qps = uptimeSeconds > 0 ? (requestCount / Math.min(uptimeSeconds, 60)).toFixed(2) : '0.00';

    // Active connections from pg_stat_activity
    const connResult = await pool.query(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE state = 'active') AS active,
              count(*) FILTER (WHERE state = 'idle') AS idle
       FROM pg_stat_activity WHERE datname = current_database()`
    );
    const connections = connResult.rows[0];

    // Database size
    const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) AS size`);
    const dbSize = parseInt(sizeResult.rows[0].size);

    // Uptime
    const uptimeResult = await pool.query(`SELECT extract(epoch from now() - pg_postmaster_start_time())::int AS uptime`);
    const dbUptime = parseInt(uptimeResult.rows[0].uptime);

    // Max connections
    const maxConnResult = await pool.query(`SHOW max_connections`);
    const maxConnections = parseInt(maxConnResult.rows[0].max_connections);

    // Cache hit ratio
    const cacheResult = await pool.query(`
      SELECT
        CASE WHEN (blks_hit + blks_read) = 0 THEN 0
             ELSE round(blks_hit * 100.0 / (blks_hit + blks_read), 2)
        END AS cache_hit_ratio
      FROM pg_stat_database WHERE datname = current_database()
    `);
    const cacheHitRatio = parseFloat(cacheResult.rows[0]?.cache_hit_ratio || 0);

    // Deadlocks
    const deadlockResult = await pool.query(
      `SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`
    );
    const deadlocks = parseInt(deadlockResult.rows[0]?.deadlocks || 0);

    // Slow queries (transactions that took > 1s in last hour)
    const slowResult = await pool.query(`
      SELECT count(*) AS count FROM pg_stat_activity
      WHERE state = 'active' AND now() - query_start > interval '1 second'
    `);
    const activeSlowQueries = parseInt(slowResult.rows[0].count);

    // System memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Process memory
    const processMem = process.memoryUsage();

    res.json({
      qps: parseFloat(qps),
      requestCount,
      uptime: uptimeSeconds,
      connections: {
        active: parseInt(connections.active),
        idle: parseInt(connections.idle),
        total: parseInt(connections.total),
        max: maxConnections,
      },
      database: {
        size: dbSize,
        sizeFormatted: formatBytes(dbSize),
        uptime: dbUptime,
        uptimeFormatted: formatDuration(dbUptime),
        cacheHitRatio,
        deadlocks,
        activeSlowQueries,
      },
      system: {
        totalMemory: totalMem,
        freeMemory: freeMem,
        usedMemory: usedMem,
        memoryUsagePercent: ((usedMem / totalMem) * 100).toFixed(1),
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg(),
        platform: os.platform(),
        hostname: os.hostname(),
      },
      process: {
        heapUsed: processMem.heapUsed,
        heapTotal: processMem.heapTotal,
        rss: processMem.rss,
        heapUsedFormatted: formatBytes(processMem.heapUsed),
        rssFormatted: formatBytes(processMem.rss),
      },
      timestamp: now,
    });
  } catch (error) {
    logger.error(`获取系统指标失败: ${error.message}`);
    res.status(500).json({ error: '获取系统指标失败' });
  }
});

// GET /api/admin/server-resources — real server resource info (async + cached)
router.get('/server-resources', async (req, res) => {
  try {
    // Return cached data if still fresh
    if (serverResourcesCache.data && (Date.now() - serverResourcesCache.timestamp) < SERVER_RESOURCES_CACHE_TTL) {
      return res.json(serverResourcesCache.data);
    }

    const isLinux = os.platform() === 'linux';
    const isWin = os.platform() === 'win32';

    const cpuCores = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || 'Unknown';
    const loadAvg = isLinux ? os.loadavg() : [0, 0, 0];

    if (isWin) {
      // Run all Windows PowerShell commands in PARALLEL to avoid sequential blocking
      const [cpuRaw, memRaw, diskRaw, netRaw, diskIoRaw, procRaw, captionRaw, versionRaw, tcpRaw] = await Promise.all([
        safeExecAsync('powershell -Command "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"'),
        safeExecAsync('powershell -Command "$os = Get-CimInstance Win32_OperatingSystem; $os.TotalVisibleMemorySize + \\",\\" + $os.FreePhysicalMemory"'),
        safeExecAsync('powershell -Command "Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Used -ne $null} | ForEach-Object { $_.Name + \\",\\" + $_.Used + \\",\\" + $_.Free }"'),
        safeExecAsync('powershell -Command "Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface | ForEach-Object { $_.Name + \\",\\" + $_.BytesReceivedPersec + \\",\\" + $_.BytesSentPersec }"'),
        safeExecAsync('powershell -Command "Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk | Where-Object {$_.Name -ne \'_Total\'} | ForEach-Object { $_.Name + \\",\\" + $_.DiskReadBytesPersec + \\",\\" + $_.DiskWriteBytesPersec }"'),
        safeExecAsync('powershell -Command "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Id,ProcessName,WorkingSet64 | ForEach-Object { $_.Id + \\",\\" + $_.ProcessName + \\",\\" + $_.WorkingSet64 }"'),
        safeExecAsync('powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"'),
        safeExecAsync('powershell -Command "(Get-CimInstance Win32_OperatingSystem).Version"'),
        safeExecAsync('netstat -an'),
      ]);

      // CPU
      let cpuUsage = 0;
      const cpuVal = parseInt(cpuRaw);
      if (!isNaN(cpuVal)) cpuUsage = cpuVal;

      // Memory
      let memTotal = os.totalmem(), memFree = os.freemem();
      let memBuffers = 0, memCached = 0, memAvailable = 0, swapTotal = 0, swapUsed = 0;
      const memParts = memRaw.split(',');
      if (memParts.length >= 2) {
        memTotal = parseInt(memParts[0]) * 1024;
        memFree = parseInt(memParts[1]) * 1024;
        memAvailable = memFree;
      }
      const memUsed = memTotal - (memAvailable || memFree);

      // Virtual memory
      try {
        const pf = await safeExecAsync('powershell -Command "$p = Get-CimInstance Win32_PageFileUsage; if($p){$p.AllocatedBaseSize*MB + \\",\\" + $p.CurrentUsage*MB}else{\'0,0\'}"');
        const pp = pf.split(',');
        if (pp.length >= 2) {
          swapTotal = parseInt(pp[0]) || 0;
          swapUsed = parseInt(pp[1]) || 0;
        }
      } catch { /* ignore */ }

      // Disks
      const disks = [];
      diskRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          const drive = p[0].trim() + ':';
          const used = parseInt(p[1]) || 0;
          const free = parseInt(p[2]) || 0;
          const total = used + free;
          disks.push({
            filesystem: drive,
            size: formatBytes(total), used: formatBytes(used), avail: formatBytes(free),
            usePercent: total > 0 ? Math.round(used / total * 100) + '%' : '0%',
            mount: drive,
          });
        }
      });

      // Network
      let totalRx = 0, totalTx = 0;
      const ifaces = [];
      netRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          const rx = parseInt(p[1]) || 0, tx = parseInt(p[2]) || 0;
          totalRx += rx; totalTx += tx;
          ifaces.push({ name: p[0], rxBytes: rx, txBytes: tx, rxFormatted: formatBytes(rx), txFormatted: formatBytes(tx) });
        }
      });
      const network = { rxBytes: totalRx, txBytes: totalTx, rxFormatted: formatBytes(totalRx), txFormatted: formatBytes(totalTx), interfaces: ifaces };

      // Disk I/O
      let tr = 0, tw = 0;
      diskIoRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          tr += parseInt(p[1]) || 0; tw += parseInt(p[2]) || 0;
        }
      });
      const diskIO = { readBytes: tr, writeBytes: tw, readFormatted: formatBytes(tr), writeFormatted: formatBytes(tw) };

      // Top processes
      const topProcesses = [];
      procRaw.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(',');
        if (p.length >= 3 && p[0]) {
          topProcesses.push({ user: 'SYSTEM', pid: p[0], cpu: 0, mem: 0, rss: formatBytes(parseInt(p[2]) || 0), command: p[1] });
        }
      });

      // System info
      const systemInfo = { hostname: os.hostname(), platform: os.platform(), arch: os.arch(), kernel: versionRaw || '', uptime: Math.floor(os.uptime()), osName: captionRaw || 'Windows' };

      // TCP connections
      const tcpConnections = { established: 0, timeWait: 0, closeWait: 0, listen: 0, total: 0 };
      tcpRaw.split('\n').forEach(line => {
        if (line.includes('ESTABLISHED')) tcpConnections.established++;
        else if (line.includes('TIME_WAIT')) tcpConnections.timeWait++;
        else if (line.includes('CLOSE_WAIT')) tcpConnections.closeWait++;
        else if (line.includes('LISTENING')) tcpConnections.listen++;
      });
      tcpConnections.total = tcpConnections.established + tcpConnections.timeWait + tcpConnections.closeWait + tcpConnections.listen;

      const result = {
        cpu: { usage: cpuUsage, cores: cpuCores, model: cpuModel, loadAvg },
        memory: {
          total: memTotal, used: memUsed, free: memFree, buffers: memBuffers, cached: memCached, available: memAvailable,
          totalFormatted: formatBytes(memTotal), usedFormatted: formatBytes(memUsed), freeFormatted: formatBytes(memFree),
          buffersFormatted: formatBytes(memBuffers), cachedFormatted: formatBytes(memCached),
          usagePercent: memTotal > 0 ? Math.round(memUsed / memTotal * 100) : 0,
          swapTotal, swapUsed, swapTotalFormatted: formatBytes(swapTotal), swapUsedFormatted: formatBytes(swapUsed),
        },
        disks, network, diskIO, topProcesses,
        system: systemInfo, osName: systemInfo.osName,
        tcp: tcpConnections, openFiles: -1,
        timestamp: Date.now(),
      };

      serverResourcesCache = { data: result, timestamp: Date.now() };
      return res.json(result);
    }

    // === Linux path: parallel file reads + async commands ===
    let cpuUsage = 0;
    const loadAvgForCpu = os.loadavg();

    // CPU measurement (needs 500ms delay, do it first)
    if (isLinux) {
      try {
        const s1 = fs.readFileSync('/proc/stat', 'utf-8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
        await new Promise(r => setTimeout(r, 500));
        const s2 = fs.readFileSync('/proc/stat', 'utf-8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
        const dTotal = s2.reduce((a, b) => a + b, 0) - s1.reduce((a, b) => a + b, 0);
        const dIdle = s2[3] - s1[3];
        cpuUsage = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;
      } catch { cpuUsage = Math.round(loadAvgForCpu[0] / cpuCores * 100); }
    }

    // Read all /proc files in parallel
    const [memInfo, netDev, diskStats, uptime, psOutput, uname, osRelease, ssOutput, tcpCount, fdCount] = await Promise.all([
      fs.promises.readFile('/proc/meminfo', 'utf-8').catch(() => ''),
      fs.promises.readFile('/proc/net/dev', 'utf-8').catch(() => ''),
      fs.promises.readFile('/proc/diskstats', 'utf-8').catch(() => ''),
      fs.promises.readFile('/proc/uptime', 'utf-8').catch(() => ''),
      safeExecAsync("ps aux --sort=-%cpu | head -11"),
      safeExecAsync('uname -r'),
      safeExecAsync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"'),
      safeExecAsync("ss -s 2>/dev/null"),
      safeExecAsync("cat /proc/net/tcp 2>/dev/null | wc -l"),
      safeExecAsync('ls /proc/self/fd 2>/dev/null | wc -l'),
    ]);

    // Memory
    let memTotal = os.totalmem(), memFree = os.freemem();
    let memBuffers = 0, memCached = 0, memAvailable = 0, swapTotal = 0, swapUsed = 0;
    if (memInfo) {
      const p = (k) => { const m = memInfo.match(new RegExp(`${k}:\\s+(\\d+)`)); return m ? parseInt(m[1]) * 1024 : 0; };
      memTotal = p('MemTotal') || memTotal;
      memFree = p('MemFree') || memFree;
      memAvailable = p('MemAvailable') || memFree;
      memBuffers = p('Buffers');
      memCached = p('Cached');
      swapTotal = p('SwapTotal');
      swapUsed = swapTotal - p('SwapFree');
    }
    const memUsed = memTotal - (memAvailable || memFree);

    // Disks
    const disks = [];
    try {
      const df = await safeExecAsync("df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x overlay 2>/dev/null || df -h");
      df.split('\n').filter(l => l.trim() && !l.startsWith('Filesystem')).forEach(line => {
        const p = line.trim().split(/\s+/);
        if (p[0] && p[5]) disks.push({ filesystem: p[0], size: p[1], used: p[2], avail: p[3], usePercent: p[4], mount: p[5] });
      });
    } catch { /* ignore */ }

    // Network
    let network = { rxBytes: 0, txBytes: 0, rxFormatted: '0 B', txFormatted: '0 B', interfaces: [] };
    if (netDev) {
      let totalRx = 0, totalTx = 0;
      const ifaces = [];
      netDev.split('\n').slice(2).filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(/[\s:]+/);
        if (p[0] === 'lo') return;
        const rx = parseInt(p[1]) || 0, tx = parseInt(p[9]) || 0;
        totalRx += rx; totalTx += tx;
        ifaces.push({ name: p[0], rxBytes: rx, txBytes: tx, rxFormatted: formatBytes(rx), txFormatted: formatBytes(tx) });
      });
      network = { rxBytes: totalRx, txBytes: totalTx, rxFormatted: formatBytes(totalRx), txFormatted: formatBytes(totalTx), interfaces: ifaces };
    }

    // Disk I/O
    let diskIO = { readBytes: 0, writeBytes: 0, readFormatted: '0 B', writeFormatted: '0 B' };
    if (diskStats) {
      let tr = 0, tw = 0;
      diskStats.split('\n').filter(l => l.trim()).forEach(line => {
        const p = line.trim().split(/\s+/);
        if (p[2] && /^(sd|vd|nvme|xvd)\w*$/.test(p[2])) {
          tr += (parseInt(p[5]) || 0) * 512; tw += (parseInt(p[9]) || 0) * 512;
        }
      });
      diskIO = { readBytes: tr, writeBytes: tw, readFormatted: formatBytes(tr), writeFormatted: formatBytes(tw) };
    }

    // Top processes
    const topProcesses = [];
    psOutput.split('\n').slice(1).filter(l => l.trim()).forEach(line => {
      const p = line.trim().split(/\s+/);
      topProcesses.push({ user: p[0], pid: p[1], cpu: parseFloat(p[2]) || 0, mem: parseFloat(p[3]) || 0, rss: p[5], command: p.slice(10).join(' ').slice(0, 80) });
    });

    // System info
    const systemInfo = { hostname: os.hostname(), platform: os.platform(), arch: os.arch(), kernel: uname || '', uptime: 0, osName: osRelease || 'Linux' };
    try { systemInfo.uptime = Math.floor(parseFloat(uptime.split(' ')[0])); } catch { systemInfo.uptime = Math.floor(os.uptime()); }

    // TCP connections
    const tcpConnections = { established: 0, timeWait: 0, closeWait: 0, listen: 0, total: 0 };
    const em = ssOutput.match(/estab\s+(\d+)/);
    const tm = ssOutput.match(/timewait\s+(\d+)/);
    if (em) tcpConnections.established = parseInt(em[1]);
    if (tm) tcpConnections.timeWait = parseInt(tm[1]);
    tcpConnections.total = Math.max(0, parseInt(tcpCount) - 1);

    // Open files
    let openFiles = parseInt(fdCount) || 0;

    const result = {
      cpu: { usage: cpuUsage, cores: cpuCores, model: cpuModel, loadAvg: loadAvgForCpu },
      memory: {
        total: memTotal, used: memUsed, free: memFree, buffers: memBuffers, cached: memCached, available: memAvailable,
        totalFormatted: formatBytes(memTotal), usedFormatted: formatBytes(memUsed), freeFormatted: formatBytes(memFree),
        buffersFormatted: formatBytes(memBuffers), cachedFormatted: formatBytes(memCached),
        usagePercent: memTotal > 0 ? Math.round(memUsed / memTotal * 100) : 0,
        swapTotal, swapUsed, swapTotalFormatted: formatBytes(swapTotal), swapUsedFormatted: formatBytes(swapUsed),
      },
      disks, network, diskIO, topProcesses,
      system: systemInfo, osName: systemInfo.osName,
      tcp: tcpConnections, openFiles,
      timestamp: Date.now(),
    };

    serverResourcesCache = { data: result, timestamp: Date.now() };
    res.json(result);
  } catch (error) {
    logger.error(`获取服务器资源失败: ${error.message}`);
    res.status(500).json({ error: '获取服务器资源失败' });
  }
});

// GET /api/admin/db-details — detailed PostgreSQL metrics
router.get('/db-details', async (req, res) => {
  try {
    const pool = getPool();

    // Table cache hit ratio
    const cacheResult = await pool.query(`
      SELECT
        relname AS table_name,
        CASE WHEN (heap_blks_hit + heap_blks_read) = 0 THEN 0
             ELSE round(heap_blks_hit * 100.0 / (heap_blks_hit + heap_blks_read), 2)
        END AS cache_hit_ratio,
        heap_blks_hit,
        heap_blks_read
      FROM pg_statio_user_tables
      ORDER BY heap_blks_hit + heap_blks_read DESC
      LIMIT 20
    `);

    // Temp files / disk temp tables
    const tempResult = await pool.query(`
      SELECT temp_files, temp_bytes
      FROM pg_stat_database WHERE datname = current_database()
    `);
    const tempData = tempResult.rows[0] || { temp_files: 0, temp_bytes: 0 };

    // Buffer pool (shared buffers config)
    const bufferResult = await pool.query(`SHOW shared_buffers`);
    const sharedBuffers = bufferResult.rows[0].shared_buffers;

    // Full table scans (seq_scan vs idx_scan)
    const scanResult = await pool.query(`
      SELECT
        relname AS table_name,
        seq_scan,
        idx_scan,
        CASE WHEN seq_scan + idx_scan = 0 THEN 0
             ELSE round(idx_scan * 100.0 / (seq_scan + idx_scan), 2)
        END AS idx_usage_ratio
      FROM pg_stat_user_tables
      ORDER BY seq_scan DESC
      LIMIT 20
    `);

    // Index size
    const indexSizeResult = await pool.query(`
      SELECT
        schemaname,
        relname AS table_name,
        indexrelname AS index_name,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        pg_relation_size(indexrelid) AS index_size_bytes
      FROM pg_stat_user_indexes
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 20
    `);

    // Data size per table
    const tableSizeResult = await pool.query(`
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS total_size_bytes,
        pg_size_pretty(pg_relation_size(relid)) AS data_size,
        pg_relation_size(relid) AS data_size_bytes,
        n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    // Deadlock count
    const deadlockResult = await pool.query(
      `SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`
    );

    // Long running queries
    const longQueriesResult = await pool.query(`
      SELECT pid, now() - query_start AS duration, query, state
      FROM pg_stat_activity
      WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY query_start ASC
      LIMIT 10
    `);

    // Server config
    const configResult = await pool.query(`
      SELECT name, setting, unit, short_desc
      FROM pg_settings
      WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem',
                      'effective_cache_size', 'wal_buffers', 'checkpoint_completion_target',
                      'random_page_cost', 'effective_io_concurrency')
      ORDER BY name
    `);

    res.json({
      tableCache: cacheResult.rows,
      temp: {
        files: parseInt(tempData.temp_files || 0),
        bytes: parseInt(tempData.temp_bytes || 0),
        bytesFormatted: formatBytes(parseInt(tempData.temp_bytes || 0)),
      },
      sharedBuffers,
      fullTableScans: scanResult.rows,
      indexSizes: indexSizeResult.rows,
      tableSizes: tableSizeResult.rows,
      deadlocks: parseInt(deadlockResult.rows[0]?.deadlocks || 0),
      longRunningQueries: longQueriesResult.rows.map(q => ({
        pid: q.pid,
        duration: q.duration,
        query: q.query?.substring(0, 200),
        state: q.state,
      })),
      config: configResult.rows,
    });
  } catch (error) {
    logger.error(`获取数据库详情失败: ${error.message}`);
    res.status(500).json({ error: '获取数据库详情失败' });
  }
});

// GET /api/admin/table-space — table space usage
router.get('/table-space', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_total_relation_size(relid) AS total_bytes,
        pg_size_pretty(pg_relation_size(relid)) AS data_size,
        pg_relation_size(relid) AS data_bytes,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
        pg_total_relation_size(relid) - pg_relation_size(relid) AS index_bytes,
        n_live_tup AS row_count,
        n_dead_tup AS dead_rows,
        last_vacuum,
        last_autovacuum,
        last_analyze
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);

    const dbSizeResult = await pool.query(`SELECT pg_database_size(current_database()) AS size`);
    const dbSize = parseInt(dbSizeResult.rows[0].size);

    res.json({
      tables: result.rows,
      totalDatabaseSize: dbSize,
      totalDatabaseSizeFormatted: formatBytes(dbSize),
    });
  } catch (error) {
    logger.error(`获取表空间失败: ${error.message}`);
    res.status(500).json({ error: '获取表空间失败' });
  }
});

// GET /api/admin/logs — read logs with filtering
router.get('/logs', async (req, res) => {
  try {
    const { level, keyword, page = 1, pageSize = 100 } = req.query;
    const logDir = path.join(__dirname, '..', 'logs');

    // Determine which log file to read
    let logFile;
    switch (level) {
      case 'error': logFile = 'error.log'; break;
      case 'warn': case 'warning': logFile = 'warn.log'; break;
      default: logFile = 'combined.log'; break;
    }

    const logPath = path.join(logDir, logFile);
    if (!fs.existsSync(logPath)) {
      return res.json({ logs: [], total: 0, page: parseInt(page), pageSize: parseInt(pageSize) });
    }

    let content = fs.readFileSync(logPath, 'utf-8');
    let lines = content.split('\n').filter(line => line.trim());

    // Filter by keyword
    if (keyword) {
      const kw = keyword.toLowerCase();
      lines = lines.filter(line => line.toLowerCase().includes(kw));
    }

    // Parse log lines
    const parsed = lines.map(line => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
      if (match) {
        return { timestamp: match[1], level: match[2].toLowerCase(), message: match[3] };
      }
      return { timestamp: '', level: level || 'info', message: line };
    });

    // Sort newest first
    parsed.reverse();

    // Pagination
    const total = parsed.length;
    const pg = Math.max(1, parseInt(page));
    const size = Math.min(500, Math.max(1, parseInt(pageSize)));
    const start = (pg - 1) * size;
    const paginated = parsed.slice(start, start + size);

    res.json({
      logs: paginated,
      total,
      page: pg,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (error) {
    logger.error(`读取日志失败: ${error.message}`);
    res.status(500).json({ error: '读取日志失败' });
  }
});

// ========== Helper Functions ==========

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天${hours}小时${mins}分钟`;
  if (hours > 0) return `${hours}小时${mins}分钟`;
  return `${mins}分钟`;
}

// Export metrics tracking helpers
function incrementRequestCount() { requestCount++; }
function incrementSlowQueryCount() { slowQueryCount++; }

module.exports = router;
module.exports.incrementRequestCount = incrementRequestCount;
module.exports.incrementSlowQueryCount = incrementSlowQueryCount;
module.exports.resetQpsCounter = resetQpsCounter;
module.exports.recordApiStat = recordApiStat;
