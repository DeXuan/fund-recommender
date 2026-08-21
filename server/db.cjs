const { Pool } = require('pg');
const logger = require('./utils/logger.cjs');
const { migrate } = require('./migrate.cjs');
const config = require('./config/index.cjs');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  logger.error(`PostgreSQL 连接池错误: ${err.message}`);
});

async function initDatabase(retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      await migrate(pool);
      logger.info('PostgreSQL 数据库初始化完成');
      return;
    } catch (err) {
      lastError = err;
      logger.error(`数据库初始化失败 (第${attempt}次): ${err.message}`);
      if (attempt < retries) {
        logger.info('等待3秒后重试...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  throw lastError;
}

function getPool() {
  return pool;
}

async function closePool() {
  await pool.end();
  logger.info('数据库连接池已关闭');
}

module.exports = { initDatabase, getPool, closePool };
