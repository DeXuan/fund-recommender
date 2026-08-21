require('dotenv').config();
const { getPool } = require('../server/db.cjs');
const { migrate } = require('../server/migrate.cjs');

(async () => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    await migrate(pool);
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
