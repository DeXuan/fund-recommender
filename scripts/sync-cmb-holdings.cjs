/**
 * 同步持仓表中招行理财产品的估值字段
 *
 * 背景：fund_records 里缓存了 current_nav / market_value / pnl / pnl_percent，
 * 这些字段由每日「更新持仓盈亏」任务刷新。招行理财的净值来自 cmb_zhaoyin_nav，
 * 而该表的抓取任务此前因 spawn python ENOENT 长期失败，导致持仓估值停在旧日期。
 * 净地表补好之后，需要调用本脚本把缓存字段同步到最新净值。
 *
 * 用法：
 *   node scripts/sync-cmb-holdings.cjs            # 实际写入
 *   node scripts/sync-cmb-holdings.cjs --dry-run  # 只打印对比
 */
require('dotenv').config();
const { Pool } = require('pg');

const dryRun = process.argv.includes('--dry-run');

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

(async () => {
  // 招行理财等非公募代码（6 位纯数字视为公募基金，其余走 cmb_zhaoyin_nav）
  const { rows: records } = await pool.query(`
    SELECT id, user_id, fund_code, fund_name, shares, cost_price, current_nav, nav_updated_at
    FROM fund_records
    WHERE fund_code !~ '^[0-9]{6}$'
    ORDER BY fund_code, id
  `);

  if (records.length === 0) {
    console.log('没有招行理财类持仓记录');
    await pool.end();
    return;
  }

  const codes = [...new Set(records.map((r) => r.fund_code))];

  // 每个代码取最新净值
  const { rows: navs } = await pool.query(
    `SELECT DISTINCT ON (product_code) product_code, unit_nav, nav_date
     FROM cmb_zhaoyin_nav
     WHERE product_code = ANY($1)
     ORDER BY product_code, nav_date DESC`,
    [codes]
  );
  const navMap = new Map(navs.map((n) => [n.product_code, n]));

  let updated = 0;
  const missing = [];
  const changes = [];

  for (const rec of records) {
    const nav = navMap.get(rec.fund_code);
    if (!nav || !nav.unit_nav) {
      missing.push(rec.fund_code);
      continue;
    }

    const unitNav = parseFloat(nav.unit_nav);
    const shares = parseFloat(rec.shares);
    const cost = parseFloat(rec.cost_price);
    const oldNav = rec.current_nav ? parseFloat(rec.current_nav) : null;

    const marketValue = +(shares * unitNav).toFixed(2);
    const pnl = +(shares * (unitNav - cost)).toFixed(2);
    const pnlPercent = cost > 0 ? +(((unitNav - cost) / cost) * 100).toFixed(2) : 0;

    if (oldNav !== null && Math.abs(oldNav - unitNav) < 1e-9 && rec.nav_updated_at) {
      continue;
    }

    changes.push(
      `${rec.fund_code} ${rec.fund_name.slice(0, 16).padEnd(16)} ` +
        `${oldNav === null ? 'null' : oldNav.toFixed(4)} → ${unitNav.toFixed(4)} ` +
        `(${nav.nav_date instanceof Date ? nav.nav_date.toISOString().slice(0, 10) : nav.nav_date}) ` +
        `市值 ${marketValue}`
    );

    if (!dryRun) {
      await pool.query(
        `UPDATE fund_records
         SET current_nav = $1, market_value = $2, pnl = $3, pnl_percent = $4,
             nav_updated_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [unitNav, marketValue, pnl, pnlPercent, rec.id]
      );
    }
    updated += 1;
  }

  console.log(`持仓记录 ${records.length} 条，涉及产品 ${codes.length} 个`);
  console.log(`需要更新 ${updated} 条${dryRun ? '（dry-run，未写入）' : '，已写入'}`);
  changes.forEach((c) => console.log('  ' + c));
  if (missing.length > 0) {
    console.log(`无净值数据: ${[...new Set(missing)].join(', ')}`);
  }

  await pool.end();
})().catch((err) => {
  console.error('同步失败:', err.message);
  process.exit(1);
});
