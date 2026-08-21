const express = require('express');
const router = express.Router();
const { getPool } = require('../../db.cjs');
const logger = require('../../utils/logger.cjs');
const { auditLog } = require('./helpers.cjs');
const fs = require('fs');
const path = require('path');
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
module.exports = router;
