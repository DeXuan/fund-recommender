/**
 * 从天天基金API获取所有基金的持有人结构数据并更新到PostgreSQL
 *
 * API: FundHolderStructure.ashx
 *   - GRBL: 个人持有比例(%)
 *   - JGBL: 机构持有比例(%)
 *
 * 用法: node scripts/sync-holder-structure.cjs [--limit=N]
 */

const https = require('https');
try { require('dotenv').config(); } catch {}
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST, port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE, user: process.env.PG_USER, password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 10000,
});

const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://fund.eastmoney.com/' },
      timeout: 10000,
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchHolderStructure(code) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = `https://fundmobapi.eastmoney.com/FundMApi/FundHolderStructure.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`;
      const raw = await httpGet(url);
      const r = JSON.parse(raw);
      if (!r.Datas || r.Datas.length === 0) return null;
      const latest = r.Datas[0]; // 最新一期
      return {
        individualHold: parseFloat(latest.GRBL) || null,
        institutionHold: parseFloat(latest.JGBL) || null,
      };
    } catch {
      if (attempt < 3) await sleep(500 * attempt);
    }
  }
  return null;
}

async function main() {
  console.log('=== 持有人结构数据同步 ===');

  const client = await pool.connect();
  try {
    let query = 'SELECT code FROM funds ORDER BY code';
    if (LIMIT > 0) query += ` LIMIT ${LIMIT}`;
    const allFunds = await client.query(query);
    const funds = allFunds.rows;

    console.log(`待处理: ${funds.length} 只基金`);

    let success = 0, failed = 0;
    const startTime = Date.now();
    const BATCH_SIZE = 10;

    for (let i = 0; i < funds.length; i += BATCH_SIZE) {
      const batch = funds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async (fund) => {
        const data = await fetchHolderStructure(fund.code);
        return { code: fund.code, data };
      }));

      for (const { code, data } of results) {
        if (!data) { failed++; continue; }
        try {
          await client.query(
            'UPDATE funds SET institution_hold = $2, individual_hold = $3 WHERE code = $1',
            [code, data.institutionHold, data.individualHold]
          );
          success++;
        } catch { failed++; }
      }

      const done = Math.min(i + BATCH_SIZE, funds.length);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const eta = Math.round((funds.length - done) / rate);
      process.stdout.write(`\r  进度: ${done}/${funds.length} | 成功:${success} 失败:${failed} | ${rate.toFixed(0)}/s | ETA:${eta}s`);

      if (i + BATCH_SIZE < funds.length) await sleep(300);
    }

    console.log('');
    console.log(`\n成功: ${success} | 失败: ${failed}`);
    console.log(`耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    const stats = await client.query('SELECT COUNT(CASE WHEN institution_hold IS NOT NULL THEN 1 END) as with_hold FROM funds');
    console.log(`有持有人数据: ${stats.rows[0].with_hold}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
