/**
 * 将指定用户设置为管理员
 * 用法: node scripts/make_admin.cjs <username>
 * 示例: node scripts/make_admin.cjs admin
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error('用法: node scripts/make_admin.cjs <username>');
    console.error('示例: node scripts/make_admin.cjs admin');
    process.exit(1);
  }

  try {
    // Ensure role column exists
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`);

    const result = await pool.query('UPDATE users SET role = $1 WHERE username = $2 RETURNING id, username, role', ['admin', username]);
    if (result.rows.length === 0) {
      console.error(`用户 "${username}" 不存在`);
      process.exit(1);
    }
    console.log(`✅ 已将用户 "${username}" (ID=${result.rows[0].id}) 设置为管理员`);
  } catch (err) {
    console.error('操作失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
