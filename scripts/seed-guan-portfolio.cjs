/**
 * 为用户 guan 生成10条持仓记录（使用基金列表中真实存在的基金）
 * 同时生成模拟历史净值数据，支持收益地图功能
 * 运行方式: node scripts/seed-guan-portfolio.cjs
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'your_database',
  user: process.env.PG_USER || 'your_db_user',
  password: process.env.PG_PASSWORD || 'your_db_password',
});

// 基于 fund-data.cjs 中真实存在的基金，构建多元化持仓
// 模拟不同市场行情下的真实盈亏：盈利+亏损+稳健
const portfolio = [
  { code: '110020', name: '易方达沪深300ETF联接A',  shares: 5000,  cost: 1.3200, buyDate: '2025-06-10', fee: 6.60,  navNow: 1.4580, note: '核心宽基底仓，长期定投' },
  { code: '008887', name: '华夏国证半导体芯片ETF联接A', shares: 3000, cost: 1.4800, buyDate: '2025-08-15', fee: 4.44,  navNow: 1.7760, note: '半导体行情爆发，盈利丰厚' },
  { code: '161725', name: '招商中证白酒指数A',      shares: 2000,  cost: 1.3200, buyDate: '2025-09-20', fee: 2.64,  navNow: 1.1880, note: '消费板块回调，短期承压' },
  { code: '012634', name: '国泰中证医疗ETF联接A',    shares: 2500,  cost: 0.9500, buyDate: '2025-10-08', fee: 2.38,  navNow: 0.8550, note: '医疗板块持续调整' },
  { code: '110027', name: '易方达安心回报债券A',     shares: 8000,  cost: 1.2400, buyDate: '2025-07-01', fee: 0,     navNow: 1.2894, note: '债券稳健配置，波动极小' },
  { code: '040046', name: '华安纳斯达克100ETF联接A', shares: 1500,  cost: 3.6500, buyDate: '2025-11-05', fee: 5.48,  navNow: 4.2905, note: '美股科技持续走强' },
  { code: '518880', name: '华安黄金ETF',            shares: 3000,  cost: 5.6000, buyDate: '2025-12-20', fee: 0,     navNow: 6.2720, note: '避险需求推动金价上涨' },
  { code: '009067', name: '国泰中证新能源汽车ETF联接A', shares: 2000, cost: 1.2800, buyDate: '2026-01-15', fee: 2.56,  navNow: 1.1264, note: '新能源板块震荡下行' },
  { code: '100032', name: '富国中证红利指数增强A',    shares: 3000,  cost: 1.7800, buyDate: '2026-02-25', fee: 5.34,  navNow: 1.9758, note: '红利策略稳健上行' },
  { code: '562500', name: '华夏中证机器人ETF',       shares: 4000,  cost: 0.7200, buyDate: '2026-03-10', fee: 2.88,  navNow: 0.8640, note: 'AI机器人概念持续活跃' },
];

// 用种子随机数生成器（可复现）
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 生成某只基金从 buyDate 到今天的模拟日净值序列
function generateNavHistory(buyDateStr, navStart, navEnd, seed) {
  const rand = seededRandom(seed);
  const start = new Date(buyDateStr);
  const end = new Date(); // today
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  if (days <= 0) return [];

  const history = [];
  let nav = navStart;
  // 目标总收益率
  const totalReturn = (navEnd - navStart) / navStart;
  // 日均漂移（按交易日 ~250天/年 计算）
  const tradingDays = Math.floor(days * 250 / 365);
  const dailyDrift = tradingDays > 0 ? Math.pow(1 + totalReturn, 1 / tradingDays) - 1 : 0;
  // 日波动率（基金类型不同波动不同）
  const dailyVol = 0.008 + rand() * 0.008; // 0.8% ~ 1.6%

  const current = new Date(start);
  // 周末跳过
  let prevNav = navStart;

  for (let i = 0; i < days; i++) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow === 0 || dow === 6) continue; // 跳过周末

    // 带漂移的随机游走
    const shock = (rand() - 0.5) * 2; // [-1, 1]
    const noise = shock * dailyVol;
    // 均值回归项（防止偏离太远）
    const targetProgress = i / days;
    const expectedNav = navStart * (1 + totalReturn * targetProgress);
    const reversion = (expectedNav - prevNav) / expectedNav * 0.1;

    const dailyReturn = dailyDrift + noise + reversion;
    nav = prevNav * (1 + dailyReturn);
    // 限制净值不能为负或异常
    nav = Math.max(nav * 0.3, Math.min(nav * 3, nav));
    nav = parseFloat(nav.toFixed(4));
    prevNav = nav;

    const dateStr = current.toISOString().slice(0, 10);
    history.push({ date: dateStr, nav });
  }

  // 最后一天强制为目标净值
  if (history.length > 0) {
    history[history.length - 1].nav = navEnd;
  }

  return history;
}

async function main() {
  const client = await pool.connect();
  try {
    // 查找用户 guan
    const userResult = await client.query("SELECT id, username FROM users WHERE username = $1", ['guan']);
    if (userResult.rows.length === 0) {
      console.error('用户 guan 不存在，请先注册');
      process.exit(1);
    }
    const userId = userResult.rows[0].id;
    console.log(`找到用户 guan, id=${userId}`);

    // 清空旧数据
    const existing = await client.query('SELECT COUNT(*) FROM fund_records WHERE user_id = $1', [userId]);
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`用户已有 ${existing.rows[0].count} 条记录，将清空后重新插入`);
      await client.query('DELETE FROM fund_records WHERE user_id = $1', [userId]);
    }

    // 确保所有基金都在 funds 表中（外键约束）
    console.log('\n=== 确保基金记录存在 ===');
    for (const p of portfolio) {
      await client.query(
        `INSERT INTO funds (code, name, type, industry) VALUES ($1, $2, 'ETF联接', '其他')
         ON CONFLICT (code) DO NOTHING`,
        [p.code, p.name]
      );
    }

    // 清除这些基金的旧净值数据
    const codes = portfolio.map(p => p.code);
    await client.query('DELETE FROM fund_nav WHERE fund_code = ANY($1)', [codes]);

    // 插入持仓记录 + 模拟净值历史
    console.log('\n=== 插入持仓记录并生成历史净值 ===');
    let inserted = 0;
    for (const p of portfolio) {
      // 插入持仓
      await client.query(
        `INSERT INTO fund_records (user_id, fund_code, fund_name, shares, cost_price, buy_date, buy_fee, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [userId, p.code, p.name, p.shares, p.cost, p.buyDate, p.fee, p.note]
      );

      // 计算盈亏
      const totalCost = p.shares * p.cost + p.fee;
      const marketValue = p.shares * p.navNow;
      const pnl = marketValue - totalCost;
      const pnlPercent = (pnl / totalCost) * 100;

      // 更新 fund_records 的预计算盈亏字段
      await client.query(
        `UPDATE fund_records SET current_nav=$1, market_value=$2, pnl=$3, pnl_percent=$4, nav_updated_at=NOW()
         WHERE user_id=$5 AND fund_code=$6`,
        [p.navNow, parseFloat(marketValue.toFixed(2)), parseFloat(pnl.toFixed(2)),
         parseFloat(pnlPercent.toFixed(2)), userId, p.code]
      );

      // 生成并插入模拟历史净值（2025年全年 + 2026年至今）
      const seed = p.code.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const history2025 = generateNavHistory('2025-01-02', p.cost * 0.92, p.cost * 0.98, seed);
      const history2026 = generateNavHistory('2026-01-02', p.cost * 0.98, p.navNow, seed + 1000);
      const allHistory = [...history2025, ...history2026];

      let navInserted = 0;
      for (const h of allHistory) {
        await client.query(
          `INSERT INTO fund_nav (fund_code, nav, nav_date) VALUES ($1, $2, $3)
           ON CONFLICT (fund_code, nav_date) DO NOTHING`,
          [p.code, h.nav, h.date]
        );
        navInserted++;
      }

      const sign = pnl >= 0 ? '+' : '';
      console.log(`  [${++inserted}/10] ${p.name} (${p.code}) | 成本${p.cost} → 现价${p.navNow} | ${sign}${pnl.toFixed(0)}元 (${sign}${pnlPercent.toFixed(1)}%) | 历史净值${navInserted}条`);
    }

    // 打印汇总
    const totalCost = portfolio.reduce((s, p) => s + p.shares * p.cost + p.fee, 0);
    const totalValue = portfolio.reduce((s, p) => s + p.shares * p.navNow, 0);
    const totalPnl = totalValue - totalCost;
    const totalReturn = (totalPnl / totalCost) * 100;

    console.log('\n=== 持仓汇总 ===');
    console.log(`总投入: ¥${totalCost.toFixed(2)}`);
    console.log(`当前市值: ¥${totalValue.toFixed(2)}`);
    console.log(`总盈亏: ¥${totalPnl.toFixed(2)} (${totalPnl >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%)`);
    console.log(`盈利基金: ${portfolio.filter(p => p.shares * p.navNow > p.shares * p.cost + p.fee).length} 只`);
    console.log(`亏损基金: ${portfolio.filter(p => p.shares * p.navNow < p.shares * p.cost + p.fee).length} 只`);
    console.log('\n收益地图数据已生成，可直接访问理财记账页面查看');

  } catch (error) {
    console.error('插入失败:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
