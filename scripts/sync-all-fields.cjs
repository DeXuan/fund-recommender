const https = require('https');
try { require('dotenv').config(); } catch {}
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST, port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE, user: process.env.PG_USER, password: process.env.PG_PASSWORD,
  connectionTimeoutMillis: 10000,
});

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://fund.eastmoney.com/' },
      timeout: 12000,
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parsePercent(s) {
  if (!s || s === '--' || s === '' || s === null || s === undefined) return null;
  const n = parseFloat(String(s).replace('%', ''));
  return isNaN(n) ? null : n;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchFundData(code) {
  const [basicRaw, detailRaw, holderRaw] = await Promise.all([
    httpGet(`https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`),
    httpGet(`https://fundmobapi.eastmoney.com/FundMApi/FundDetailInformation.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`),
    httpGet(`https://fundmobapi.eastmoney.com/FundMApi/FundHolderStructure.ashx?FCODE=${code}&deviceid=wap&plat=Wap&product=EFund&version=2.0.0`),
  ]);
  const basic = JSON.parse(basicRaw).Datas || {};
  const detail = JSON.parse(detailRaw).Datas || {};
  const holderData = JSON.parse(holderRaw).Datas || [];
  const holder = holderData.length > 0 ? holderData[0] : {};

  const mgmt = parsePercent(detail.MGREXP);
  const custody = parsePercent(detail.TRUSTEXP);
  const service = parsePercent(detail.SALESEXP);
  const totalFee = (mgmt != null && custody != null) ? parseFloat((mgmt + custody + (service || 0)).toFixed(4)) : null;

  const scale = basic.FEGM ? parseFloat(basic.FEGM) : null;
  const nav = parseFloat(basic.DWJZ) || null;
  const shares = (scale && nav && nav > 0) ? scale / nav : null;

  const return1y = parsePercent(basic.SYL_1N);
  const avgReturn1y = detail.AVG_1N ? parseFloat(detail.AVG_1N) : null;
  const excessReturn = (return1y != null && avgReturn1y != null) ? parseFloat((return1y - avgReturn1y).toFixed(2)) : null;

  return {
    code: basic.FCODE,
    nav, totalNav: parseFloat(basic.LJJZ) || null, navDate: basic.FSRQ,
    shares: shares ? shares / 1e8 : null,
    purchaseFee: parseFloat(detail.RATE || basic.RATE) || null,
    redemptionFee: null,
    excessReturn,
    institutionHold: holder.JGBL ? parseFloat(holder.JGBL) : null,
    individualHold: holder.GRBL ? parseFloat(holder.GRBL) : null,
    totalFee, mgmt, custody,
    indexName: detail.INDEXNAME || null,
    scale: scale ? scale / 1e8 : null,
    manager: basic.JJJL || detail.JJJL || null,
    return1w: parsePercent(basic.SYL_Z),
    return1m: parsePercent(basic.SYL_Y),
    return3m: parsePercent(basic.SYL_3Y),
    return6m: parsePercent(basic.SYL_6Y),
    return1y,
  };
}

async function main() {
  const client = await pool.connect();
  try {
    const funds = await client.query('SELECT code FROM funds ORDER BY code');
    const codes = funds.rows.map(r => r.code);
    console.log(`同步 ${codes.length} 只基金的完整数据...`);

    let success = 0, failed = 0;
    const BATCH = 10;
    const startTime = Date.now();

    for (let i = 0; i < codes.length; i += BATCH) {
      const batch = codes.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async code => {
        try {
          const data = await fetchFundData(code);
          return { code, data };
        } catch (e) {
          return { code, data: null, error: e.message };
        }
      }));

      for (const { code, data, error } of results) {
        if (!data) { failed++; continue; }
        try {
          await client.query(`
            UPDATE funds SET
              shares = COALESCE($1, shares),
              purchase_fee = COALESCE($2, purchase_fee),
              excess_return = COALESCE($3, excess_return),
              institution_hold = COALESCE($4, institution_hold),
              individual_hold = COALESCE($5, individual_hold),
              total_fee = COALESCE($6, total_fee),
              management_fee = COALESCE($7, management_fee),
              custody_fee = COALESCE($8, custody_fee),
              index_name = COALESCE($9, index_name),
              scale = COALESCE($10, scale),
              manager = COALESCE($11, manager)
            WHERE code = $12
          `, [
            data.shares, data.purchaseFee, data.excessReturn,
            data.institutionHold, data.individualHold,
            data.totalFee, data.mgmt, data.custody,
            data.indexName, data.scale, data.manager, code,
          ]);

          if (data.nav && data.navDate) {
            await client.query(`
              INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
              ON CONFLICT (fund_code, nav_date) DO UPDATE SET
                nav=EXCLUDED.nav, total_nav=EXCLUDED.total_nav,
                return_1w=COALESCE(EXCLUDED.return_1w,fund_nav.return_1w),
                return_1m=COALESCE(EXCLUDED.return_1m,fund_nav.return_1m),
                return_3m=COALESCE(EXCLUDED.return_3m,fund_nav.return_3m),
                return_6m=COALESCE(EXCLUDED.return_6m,fund_nav.return_6m),
                return_1y=COALESCE(EXCLUDED.return_1y,fund_nav.return_1y)
            `, [code, data.nav, data.totalNav, data.navDate, data.return1w, data.return1m, data.return3m, data.return6m, data.return1y]);
          }
          success++;
        } catch (e) { failed++; }
      }

      const done = Math.min(i + BATCH, codes.length);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = done / elapsed;
      const eta = Math.round((codes.length - done) / rate);
      process.stdout.write(`\r  进度: ${done}/${codes.length} | 成功:${success} 失败:${failed} | ${rate.toFixed(0)}/s | ETA:${eta}s`);

      if (i + BATCH < codes.length) await sleep(200);
    }

    console.log(`\n\n完成: 成功 ${success} | 失败 ${failed}`);
    console.log(`耗时: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // 验证
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN shares IS NOT NULL THEN 1 END) as with_shares,
        COUNT(CASE WHEN purchase_fee IS NOT NULL THEN 1 END) as with_purchase,
        COUNT(CASE WHEN excess_return IS NOT NULL THEN 1 END) as with_excess,
        COUNT(CASE WHEN institution_hold IS NOT NULL THEN 1 END) as with_holder,
        COUNT(CASE WHEN total_fee IS NOT NULL AND total_fee > 0 THEN 1 END) as with_fee,
        COUNT(CASE WHEN index_name IS NOT NULL AND index_name != '' THEN 1 END) as with_index
      FROM funds
    `);
    const s = stats.rows[0];
    console.log('\n数据完整性:');
    console.log(`  有份额: ${s.with_shares}/${s.total}`);
    console.log(`  有申购费率: ${s.with_purchase}/${s.total}`);
    console.log(`  有超额收益: ${s.with_excess}/${s.total}`);
    console.log(`  有持有人: ${s.with_holder}/${s.total}`);
    console.log(`  有综合费率: ${s.with_fee}/${s.total}`);
    console.log(`  有跟踪指数: ${s.with_index}/${s.total}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
