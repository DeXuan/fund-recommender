'use strict';

async function up(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS portfolio_alert_lines (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      fund_code VARCHAR(20) NOT NULL,
      fund_name VARCHAR(100),
      take_profit NUMERIC(10, 4),
      stop_loss NUMERIC(10, 4),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, fund_code)
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_portfolio_alert_lines_user ON portfolio_alert_lines(user_id)`);
}

module.exports = { up };
