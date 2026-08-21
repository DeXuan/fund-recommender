'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger.cjs');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS_TABLE = '_migrations';

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(`SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`);
  return new Set(rows.map(r => r.name));
}

function loadMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.cjs'))
    .sort()
    .map(f => {
      const name = f.replace(/\.cjs$/, '');
      const mod = require(path.join(MIGRATIONS_DIR, f));
      return { name, filename: f, up: mod.up };
    });
}

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = loadMigrationFiles();

    let pending = 0;
    for (const migration of files) {
      if (applied.has(migration.name)) continue;
      pending++;
      logger.info(`[迁移] 执行 ${migration.name}...`);
      const t = Date.now();
      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [migration.name]);
        await client.query('COMMIT');
        logger.info(`[迁移] ${migration.name} 完成 (${Date.now() - t}ms)`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`迁移 ${migration.name} 失败: ${err.message}`, { cause: err });
      }
    }

    if (pending === 0) {
      logger.info(`[迁移] 无待执行迁移（已应用 ${applied.size} 个）`);
    } else {
      logger.info(`[迁移] 共执行 ${pending} 个迁移`);
    }
  } finally {
    client.release();
  }
}

async function migrate(pool) {
  try {
    await runMigrations(pool);
  } catch (err) {
    logger.error(`[迁移] ${err.message}`);
    throw err;
  }
}

module.exports = { migrate };
