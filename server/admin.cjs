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

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const allowedSort = ['created_at', 'username', 'last_login_at', 'role'];
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
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') AS new_30d
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
      for (const id of safeIds) {
        const u = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
        await pool.query('DELETE FROM watchlist WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM fund_records WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM dca_plans WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM risk_profiles WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM oauth_accounts WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (u.rows.length > 0) {
          await auditLog(req.user.id, req.user.username, 'batch_delete', id, u.rows[0].username, '', req.ip);
        }
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
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    await auditLog(req.user.id, req.user.username, 'delete_user', parseInt(id), user.rows[0].username, '', req.ip);
    logger.info(`管理员 ${req.user.username} 删除了用户 ${user.rows[0].username} (ID=${id})`);
    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    logger.error(`删除用户失败: ${error.message}`);
    res.status(500).json({ error: '删除用户失败' });
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
