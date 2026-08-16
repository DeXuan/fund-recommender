/**
 * 基金数据全量更新 — PostgreSQL funds 表中所有基金的 净值/收益率/规模 全量刷新
 *
 * 数据来源: 支付宝（蚂蚁财富）基金信息 API → FundBasicInformation.ashx
 * 运行方式: node scripts/update-all-funds-full.cjs
 *
 * 性能预估: 14,300 只基金, 并发 10, 批次间隔 200ms, 预计耗时 25-35 分钟
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const axios = require('axios');
const { Pool } = require('pg');

// ---- 配置 ----
const CONCURRENCY = 10;
const BATCH_DELAY_MS = 200;
const REQUEST_TIMEOUT = 10000;

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

// ---- 从支付宝/东方财富 API 获取单只基金数据 ----
async function fetchOneFund(code) {
  try {
    const { data } = await axios.get(
      'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
      {
        params: { FCODE: code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' },
        timeout: REQUEST_TIMEOUT,
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
      },
    );
    const d = data?.Datas;
    if (!d) return null;

    const nav = parseFloat(d.DWJZ);
    if (isNaN(nav) || nav <= 0) return null;

    const pf = (v) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : null);
    const scaleRaw = parseFloat(d.ENDNAV);
    const scale = isNaN(scaleRaw) ? null : parseFloat((scaleRaw / 1e8).toFixed(2));

    let buySuggestion = '开放申购';
    let dailyLimit = 0;
    const sgzt = (d.SGZT || '').trim();
    const maxsg = parseInt(d.MAXSG);
    if (sgzt.includes('暂停')) { buySuggestion = '暂停申购'; }
    else if (sgzt.includes('限') || sgzt.includes('大额')) { buySuggestion = '限大额'; dailyLimit = isNaN(maxsg) ? 10 : maxsg; }

    const managementFee = pf(d.FRATE) || 0;
    const custodyFee = pf(d.DRATE) || 0;
    const serviceFee = pf(d.SRATE) || 0;
    const totalFee = parseFloat((managementFee + custodyFee + serviceFee).toFixed(2));

    return {
      code,
      name: d.SHORTNAME || '',
      type: d.FTYPE || '',
      manager: d.JJJL || null,
      scale, buySuggestion, dailyLimit,
      managementFee, custodyFee, serviceFee, totalFee,
      nav,
      totalNav: parseFloat(d.LJJZ) || nav,
      navDate: d.FSRQ || null,
      return1w: pf(d.SYL_Z),
      return1m: pf(d.SYL_Y),
      return3m: pf(d.SYL_3Y),
      return6m: pf(d.SYL_6Y),
      return1y: pf(d.SYL_1N),
    };
  } catch (e) {
    return null;
  }
}

// ---- 估算评级 ----
function estimateRating(totalFee, return1y, scale) {
  let score = 3;
  if (totalFee <= 0.6) score += 0.5;
  else if (totalFee > 1.0) score -= 0.5;
  if (return1y != null && return1y > 20) score += 1;
  else if (return1y != null && return1y > 10) score += 0.5;
  else if (return1y != null && return1y < -10) score -= 0.5;
  if (scale && scale > 10) score += 0.5;
  else if (scale != null && scale < 1) score -= 0.5;
  return Math.max(1, Math.min(5, Math.round(score)));
}

// ---- 写入数据库 ----
async function saveToDB(fund) {
  const rating = estimateRating(fund.totalFee, fund.return1y, fund.scale);

  await pool.query(`
    UPDATE funds SET
      name = COALESCE(NULLIF($2, ''), funds.name),
      type = COALESCE(NULLIF($3, ''), funds.type),
      management_fee = CASE WHEN $4 > 0 THEN $4 ELSE funds.management_fee END,
      custody_fee = CASE WHEN $5 > 0 THEN $5 ELSE funds.custody_fee END,
      service_fee = CASE WHEN $6 > 0 OR funds.service_fee IS NULL THEN $6 ELSE funds.service_fee END,
      total_fee = CASE WHEN $7 > 0 THEN $7 ELSE funds.total_fee END,
      scale = COALESCE($8, funds.scale),
      rating = COALESCE($9, funds.rating),
      buy_suggestion = COALESCE(NULLIF($10, ''), funds.buy_suggestion),
      daily_limit = COALESCE($11, funds.daily_limit),
      manager = COALESCE(NULLIF($12, ''), funds.manager),
      updated_at = NOW()
    WHERE code = $1
  `, [
    fund.code, fund.name, fund.type,
    fund.managementFee, fund.custodyFee, fund.serviceFee, fund.totalFee,
    fund.scale, rating, fund.buySuggestion, fund.dailyLimit, fund.manager,
  ]);

  if (fund.navDate) {
    await pool.query(`
      INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (fund_code, nav_date) DO UPDATE SET
        nav = EXCLUDED.nav, total_nav = EXCLUDED.total_nav,
        return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
        return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
        return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
        return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
        return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)
    `, [
      fund.code, fund.nav, fund.totalNav, fund.navDate,
      fund.return1w, fund.return1m, fund.return3m, fund.return6m, fund.return1y,
    ]);
  }
}

// ---- 主流程 ----
(async () => {
  const startTime = Date.now();

  // 1. 从数据库读取所有基金代码
  console.log('读取基金列表...');
  const { rows } = await pool.query('SELECT code FROM funds ORDER BY code');
  const fundCodes = rows.map(r => r.code);
  console.log(`[${new Date().toLocaleString()}] 全量基金数据更新启动`);
  console.log(`  待更新基金: ${fundCodes.length} 只`);
  console.log(`  并发数: ${CONCURRENCY} | 批次延迟: ${BATCH_DELAY_MS}ms\n`);

  // 2. 分批抓取
  let success = 0;
  let skipped = 0;
  let navWritten = 0;
  const errors = [];

  for (let i = 0; i < fundCodes.length; i += CONCURRENCY) {
    const batch = fundCodes.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(code => fetchOneFund(code)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const code = batch[j];

      if (result.status !== 'fulfilled' || !result.value) {
        skipped++;
        continue;
      }

      try {
        await saveToDB(result.value);
        success++;
        if (result.value.navDate) navWritten++;
      } catch (e) {
        skipped++;
        if (errors.length < 10) errors.push(`${code}: ${e.message}`);
      }
    }

    // 进度日志（每 100 只）
    const done = Math.min(i + CONCURRENCY, fundCodes.length);
    if (done % 100 === 0 || done >= fundCodes.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const pct = (done / fundCodes.length * 100).toFixed(1);
      const rate = (done / ((Date.now() - startTime) / 1000)).toFixed(0);
      console.log(`  [${elapsed}s] ${done}/${fundCodes.length} (${pct}%) | 成功 ${success} | 跳过 ${skipped} | ~${rate}只/秒`);
    }

    if (i + CONCURRENCY < fundCodes.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // 3. 汇总
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n========== 全量更新完成 ==========`);
  console.log(`  基金总数: ${fundCodes.length}`);
  console.log(`  更新成功: ${success} (${(success/fundCodes.length*100).toFixed(1)}%)`);
  console.log(`  净值写入: ${navWritten}`);
  console.log(`  跳过/失败: ${skipped}`);
  console.log(`  总耗时: ${elapsed}s (${(elapsed/60).toFixed(1)}分钟)`);

  if (errors.length > 0) {
    console.log(`\n  错误详情 (前10条):`);
    errors.forEach(e => console.log(`    - ${e}`));
  }

  // 4. 验证
  const { rows: [s] } = await pool.query('SELECT COUNT(*)::int as c FROM funds WHERE scale IS NOT NULL AND scale > 0');
  const { rows: [n] } = await pool.query('SELECT COUNT(*)::int as c FROM fund_nav');
  const { rows: [d] } = await pool.query('SELECT COUNT(DISTINCT fund_code)::int as c FROM fund_nav');
  console.log(`\n  数据库状态: ${s.c} 只有效规模, ${n.c} 条净值记录 (覆盖 ${d.c} 只基金)`);

  await pool.end();
  process.exit(0);
})();
