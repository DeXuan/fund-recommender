'use strict';

async function up(client) {
  await client.query(`CREATE INDEX IF NOT EXISTS idx_fund_records_code ON fund_records(fund_code)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_subscription_orders_plan ON subscription_orders(plan_id)`);
}

module.exports = { up };
