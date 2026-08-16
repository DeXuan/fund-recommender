/**
 * QDII 基金数据更新脚本
 *
 * 从 天天基金/东方财富 公开 API 抓取 QDII 基金的：
 *   - 近1年 / 近3月 / 近1月 收益率
 *   - 每日限额 (daily_limit)
 *   - 申购状态 (buy_suggestion)
 *
 * 写入 PostgreSQL fund_nav 表 + funds 表，供网页端直接查询。
 *
 * 约定：每个交易日 9:30 (开盘时间) 执行一次。
 *
 * 用法：
 *   node scripts/update-qdii-funds.cjs              # 全部 QDII
 *   node scripts/update-qdii-funds.cjs --dry-run    # 预览不写入
 *   node scripts/update-qdii-funds.cjs --verbose    # 详细日志
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

// ── 命令行参数 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
};

// ── 日志 ────────────────────────────────────────────────────
const log = {
  info: (msg) => console.log(`[${new Date().toLocaleString()}] [INFO] ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toLocaleString()}] [WARN] ${msg}`),
  error: (msg) => console.error(`[${new Date().toLocaleString()}] [ERROR] ${msg}`),
};

// ── PostgreSQL 连接池 ───────────────────────────────────────
const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 15000,
});

// ── 数据抓取 ────────────────────────────────────────────────

/**
 * 从支付宝/天天基金 API 获取 QDII 基金净值和收益率
 * 数据源：FundBasicInformation.ashx（蚂蚁财富/支付宝同款接口），一次请求返回全部字段
 * QDII 基金净值通常延迟 1-2 个交易日
 */
async function fetchQDIINavAndReturns(code) {
  const result = { nav: null, navDate: null, return1m: null, return3m: null, return6m: null, return1y: null };

  try {
    // 支付宝接口一次返回预计算收益率（最准确，与支付宝显示一致）
    const resp = await axios.get(
      'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
      { params: { FCODE: code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' }, timeout: 10000 }
    );
    const d = resp.data?.Datas;
    if (d && parseFloat(d.DWJZ) > 0) {
      const pf = (v) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : null);
      result.nav = parseFloat(d.DWJZ);
      result.navDate = d.FSRQ || null;
      result.return1m = pf(d.SYL_Y);
      result.return3m = pf(d.SYL_3Y);
      result.return6m = pf(d.SYL_6Y);
      result.return1y = pf(d.SYL_1N);
      // 申购状态 + 每日限额（支付宝接口同源）
      result.buySuggestion = '开放申购';
      result.dailyLimit = 0;
      const sgzt = (d.SGZT || '').trim();
      const maxsg = parseInt(d.MAXSG);
      if (sgzt.includes('暂停')) {
        result.buySuggestion = '暂停申购';
      } else if (sgzt.includes('限') || sgzt.includes('大额')) {
        result.buySuggestion = '限大额';
        result.dailyLimit = isNaN(maxsg) ? 10 : maxsg;
      }
      return result;
    }

    // 回退：lsjz 分页拉取净值历史自行计算
    const allRecords = [];
    for (let page = 1; page <= 20; page++) {
      const resp2 = await axios.get('https://api.fund.eastmoney.com/f10/lsjz', {
        params: { fundCode: code, pageIndex: page, pageSize: 20 },
        timeout: 15000,
        headers: {
          Referer: 'https://fund.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      const pageList = resp2.data?.Data?.LSJZList;
      if (!pageList || pageList.length === 0) break;
      allRecords.push(...pageList);
      if (allRecords.length >= 260 || pageList.length < 20) break;
      await new Promise(r => setTimeout(r, 80));
    }

    const list = allRecords;
    if (!list || list.length === 0) return result;

    result.nav = parseFloat(list[0].DWJZ);
    result.navDate = list[0].FSRQ;
    if (!result.nav || result.nav <= 0) return result;

    const findNav = (days) => {
      const target = new Date(result.navDate);
      target.setDate(target.getDate() - days);
      const ts = target.toISOString().split('T')[0];
      for (const item of list) {
        if (item.FSRQ <= ts) {
          const n = parseFloat(item.DWJZ);
          return n > 0 ? n : null;
        }
      }
      return null;
    };

    const calcReturn = (baseNav) => {
      if (!baseNav || baseNav <= 0) return null;
      return parseFloat(((result.nav - baseNav) / baseNav * 100).toFixed(2));
    };

    result.return1m = calcReturn(findNav(30));
    result.return3m = calcReturn(findNav(90));
    result.return6m = calcReturn(findNav(180));
    result.return1y = calcReturn(findNav(365));
  } catch (err) {
    log.warn(`获取 ${code} 净值失败: ${err.message}`);
  }

  return result;
}

// ── 写入数据库 ──────────────────────────────────────────────

async function saveToDB(code, navData, statusData) {
  if (opts.dryRun) return;

  // 写入 fund_nav
  if (navData.nav && navData.navDate) {
    await pool.query(
      `INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1m, return_3m, return_6m, return_1y)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (fund_code, nav_date)
       DO UPDATE SET
         nav = EXCLUDED.nav,
         total_nav = EXCLUDED.total_nav,
         return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
         return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
         return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
         return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)`,
      [code, navData.nav, navData.nav, navData.navDate,
       navData.return1m, navData.return3m, navData.return6m, navData.return1y]
    );
  }

  // 写入 funds 表 (申购状态 + 每日限额)
  await pool.query(
    `UPDATE funds SET buy_suggestion = $1, daily_limit = $2, updated_at = NOW()
     WHERE code = $3`,
    [statusData.buySuggestion, statusData.dailyLimit, code]
  );
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  log.info('========================================');
  log.info('QDII 基金数据更新脚本');
  log.info(`模式: ${opts.dryRun ? 'DRY-RUN (预览)' : '写入数据库'}`);
  log.info('========================================');

  // 1. 查询所有 QDII 基金（含 type 前缀变体 + 名称含 QDII，与 QDII 专栏/接口口径一致）
  // 注：不带 industry 过滤，确保场内ETF等全部覆盖，统一以支付宝 SGZT/MAXSG 为准
  const { rows: funds } = await pool.query(
    `SELECT code, name FROM funds
     WHERE type = 'QDII'
        OR type LIKE 'QDII%'
        OR name LIKE '%QDII%'
     ORDER BY code`
  );

  // 去重
  const seen = new Set();
  const uniqueFunds = [];
  for (const f of funds) {
    if (!seen.has(f.code)) {
      seen.add(f.code);
      uniqueFunds.push(f);
    }
  }

  log.info(`待更新 QDII 基金: ${uniqueFunds.length} 只`);

  if (uniqueFunds.length === 0) {
    log.warn('没有 QDII 基金需要更新，退出');
    await pool.end();
    process.exit(0);
  }

  // 2. 并发批量更新 (支付宝API限频不严，适度并发)
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 150;
  let successCount = 0;
  let skipCount = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < uniqueFunds.length; i += BATCH_SIZE) {
    const batch = uniqueFunds.slice(i, i + BATCH_SIZE);

    // 并发获取净值+收益率+限额（支付宝接口一次请求返回全部）
    const navResults = await Promise.allSettled(
      batch.map(f => fetchQDIINavAndReturns(f.code))
    );

    for (let j = 0; j < batch.length; j++) {
      const fund = batch[j];
      const navR = navResults[j];

      const navData = navR.status === 'fulfilled' ? navR.value : null;

      if (!navData || !navData.nav) {
        skipCount++;
        continue;
      }

      try {
        await saveToDB(fund.code, navData, {
          buySuggestion: navData.buySuggestion || '开放申购',
          dailyLimit: navData.dailyLimit || 0,
        });
        successCount++;

        if (opts.verbose) {
          log.info(
            `  ${fund.code} ${fund.name.padEnd(25)} NAV=${navData.nav} ` +
            `1m=${navData.return1m ?? '-'}% 3m=${navData.return3m ?? '-'}% ` +
            `6m=${navData.return6m ?? '-'}% 1y=${navData.return1y ?? '-'}% ` +
            `限额=${navData.dailyLimit || '无'} 状态=${navData.buySuggestion || '开放申购'}`
          );
        }
      } catch (e) {
        skipCount++;
        if (errors.length < 10) {
          errors.push(`${fund.code}(${fund.name}): ${e.message}`);
        }
      }
    }

    // 进度
    const done = Math.min(i + BATCH_SIZE, uniqueFunds.length);
    if (done % 30 === 0 || done >= uniqueFunds.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log.info(`进度: ${done}/${uniqueFunds.length} (成功 ${successCount}, 跳过 ${skipCount}) 耗时 ${elapsed}s`);
    }

    if (i + BATCH_SIZE < uniqueFunds.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  // 3. 汇总
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.info('========================================');
  log.info(`QDII 更新完成: 成功 ${successCount}/${uniqueFunds.length}, 跳过 ${skipCount}`);
  log.info(`总耗时: ${elapsed}s`);
  if (errors.length > 0) {
    log.warn(`错误 (${errors.length}):`);
    errors.forEach(e => log.warn(`  - ${e}`));
  }
  log.info('========================================');

  await pool.end();
}

main().catch(err => {
  log.error(`脚本异常: ${err.message}`);
  console.error(err);
  pool.end().then(() => process.exit(1));
});
