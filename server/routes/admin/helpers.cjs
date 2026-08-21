const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const { getPool } = require('../../db.cjs');

const execAsync = promisify(exec);

function safeExec(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim(); } catch { return ''; }
}

async function safeExecAsync(cmd, timeoutMs = 5000) {
  try {
    const { stdout } = await execAsync(cmd, { encoding: 'utf-8', timeout: timeoutMs });
    return stdout.trim();
  } catch { return ''; }
}

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
  if (days > 0) return `${days}�?{hours}小时${mins}分钟`;
  if (hours > 0) return `${hours}小时${mins}分钟`;
  return `${mins}分钟`;
}

module.exports = { safeExec, safeExecAsync, auditLog, formatBytes, formatDuration };
