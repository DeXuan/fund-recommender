/**
 * 基金数据全量更新脚本 — 从支付宝/东方财富 API 获取最新净值、收益率、规模并写入 PG
 *
 * 数据来源: 支付宝（蚂蚁财富）基金信息 API → FundBasicInformation.ashx
 * 更新频率: 每个交易日收盘后执行一次（约 17:30 北京时间）
 * 运行方式: node scripts/update-all-funds.cjs
 *
 * API 字段映射:
 *   DWJZ     → 最新净值 (nav)
 *   FSRQ     → 净值日期 (nav_date)
 *   SYL_Y    → 近1月收益率 (return_1m)
 *   SYL_3Y   → 近3月收益率 (return_3m)
 *   SYL_6Y   → 近6月收益率 (return_6m)
 *   SYL_1N   → 近1年收益率 (return_1y)
 *   SYL_Z    → 近1周收益率 (return_1w)
 *   ENDNAV   → 基金规模/元 (scale, 转换为亿)
 *   JJJL     → 基金经理
 *   SGZT     → 申购状态
 *   MAXSG    → 每日申购上限
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');

// ---- 配置 ----
const CONCURRENCY = 5;
const BATCH_DELAY_MS = 400;
const REQUEST_TIMEOUT = 12000;

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

// ---- 从 fund-data.cjs 加载基金列表 ----
const { allFunds } = require('../server/fund-data.cjs');
const fundCodes = [...new Set(allFunds.map(f => f.code))];

console.log(`[${new Date().toLocaleString()}] 基金数据全量更新启动`);
console.log(`  待更新基金: ${fundCodes.length} 只`);
console.log(`  并发数: ${CONCURRENCY} | 批次延迟: ${BATCH_DELAY_MS}ms\n`);

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

    // 申购状态
    let buySuggestion = '开放申购';
    let dailyLimit = 0;
    const sgzt = (d.SGZT || '').trim();
    const maxsg = parseInt(d.MAXSG);
    if (sgzt.includes('暂停')) {
      buySuggestion = '暂停申购';
    } else if (sgzt.includes('限') || sgzt.includes('大额')) {
      buySuggestion = '限大额';
      dailyLimit = isNaN(maxsg) ? 10 : maxsg;
    }

    // 费率
    const managementFee = pf(d.FRATE) || 0;
    const custodyFee = pf(d.DRATE) || 0;
    const serviceFee = pf(d.SRATE) || 0;
    const totalFee = parseFloat((managementFee + custodyFee + serviceFee).toFixed(2));

    return {
      code,
      name: d.SHORTNAME || '',
      type: d.FTYPE || '',
      // 基本信息
      manager: d.JJJL || null,
      scale,
      buySuggestion,
      dailyLimit,
      managementFee,
      custodyFee,
      serviceFee,
      totalFee,
      // 净值与收益率
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

// ---- 估算基金评级 ----
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

  // 1. 更新 funds 表（基本信息）
  await pool.query(
    `INSERT INTO funds (
      code, name, type, industry, index_name,
      management_fee, custody_fee, service_fee, total_fee,
      scale, rating, buy_suggestion, daily_limit, manager, updated_at
    ) VALUES ($1, $2, $3, '', '', $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (code) DO UPDATE SET
      name = COALESCE(NULLIF(EXCLUDED.name, ''), funds.name),
      type = COALESCE(NULLIF(EXCLUDED.type, ''), funds.type),
      management_fee = CASE WHEN EXCLUDED.management_fee > 0 THEN EXCLUDED.management_fee ELSE funds.management_fee END,
      custody_fee = CASE WHEN EXCLUDED.custody_fee > 0 THEN EXCLUDED.custody_fee ELSE funds.custody_fee END,
      service_fee = CASE WHEN EXCLUDED.service_fee > 0 OR funds.service_fee IS NULL THEN EXCLUDED.service_fee ELSE funds.service_fee END,
      total_fee = CASE WHEN EXCLUDED.total_fee > 0 THEN EXCLUDED.total_fee ELSE funds.total_fee END,
      scale = COALESCE(EXCLUDED.scale, funds.scale),
      rating = COALESCE($9, funds.rating),
      buy_suggestion = COALESCE(NULLIF(EXCLUDED.buy_suggestion, ''), funds.buy_suggestion),
      daily_limit = COALESCE(EXCLUDED.daily_limit, funds.daily_limit),
      manager = COALESCE(NULLIF(EXCLUDED.manager, ''), funds.manager),
      updated_at = NOW()`,
    [
      fund.code, fund.name, fund.type,
      fund.managementFee, fund.custodyFee, fund.serviceFee, fund.totalFee,
      fund.scale, rating, fund.buySuggestion, fund.dailyLimit, fund.manager,
    ],
  );

  // 2. 更新 fund_nav 表（净值 + 收益率）
  if (fund.navDate) {
    await pool.query(
      `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (fund_code, nav_date) DO UPDATE SET
         nav = EXCLUDED.nav,
         total_nav = EXCLUDED.total_nav,
         return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
         return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
         return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
         return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
         return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)`,
      [fund.code, fund.nav, fund.totalNav, fund.navDate,
       fund.return1w, fund.return1m, fund.return3m, fund.return6m, fund.return1y],
    );
  }
}

// ---- 主流程 ----
(async () => {
  const startTime = Date.now();
  let success = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < fundCodes.length; i += CONCURRENCY) {
    const batch = fundCodes.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(code => fetchOneFund(code)));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const code = batch[j];

      if (result.status !== 'fulfilled' || !result.value) {
        skipped++;
        if (errors.length < 10) errors.push(`${code}: API 返回空`);
        continue;
      }

      // 跳过债券/货币基金（防止回填）
      const f = result.value;
      if (/债|货币/.test(f.name || '') || /债|货币/.test(f.type || '')) { skipped++; continue; }

      try {
        await saveToDB(f);
        success++;
      } catch (e) {
        skipped++;
        if (errors.length < 10) errors.push(`${code}: 写入失败 ${e.message}`);
      }
    }

    // 进度日志
    const done = Math.min(i + CONCURRENCY, fundCodes.length);
    if (done % 30 === 0 || done >= fundCodes.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  进度: ${done}/${fundCodes.length} | 成功 ${success} | 跳过 ${skipped} | 耗时 ${elapsed}s`);
    }

    // 批次间延迟
    if (i + CONCURRENCY < fundCodes.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // ---- 汇总 ----
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========== 更新完成 ==========`);
  console.log(`  基金总数: ${fundCodes.length}`);
  console.log(`  更新成功: ${success}`);
  console.log(`  跳过/失败: ${skipped}`);
  console.log(`  总耗时: ${elapsed}s`);

  if (errors.length > 0) {
    console.log(`\n  错误详情 (前10条):`);
    errors.forEach(e => console.log(`    - ${e}`));
  }

  // ---- 统计验证 ----
  const { rows: [{ count: totalFunds }] } = await pool.query('SELECT COUNT(*)::int as count FROM funds');
  const { rows: [{ count: totalNav }] } = await pool.query('SELECT COUNT(*)::int as count FROM fund_nav');

  const { rows: navDates } = await pool.query(
    `SELECT fund_code, nav, nav_date, return_1m, return_3m, return_6m, return_1y
     FROM fund_nav WHERE fund_code = ANY($1)
     ORDER BY nav_date DESC LIMIT 5`,
    [fundCodes],
  );
  console.log(`\n  数据库状态: ${totalFunds} 只基金, ${totalNav} 条净值记录`);
  console.log(`  最新净值样本:`);
  navDates.forEach(r => {
    const date = r.nav_date ? new Date(r.nav_date).toISOString().slice(0, 10) : 'N/A';
    console.log(`    ${r.fund_code} | NAV: ${r.nav} | 日期: ${date} | 1m: ${r.return_1m}% | 3m: ${r.return_3m}% | 6m: ${r.return_6m}% | 1y: ${r.return_1y}%`);
  });

  await pool.end();
  process.exit(0);
})();
