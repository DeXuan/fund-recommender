/**
 * 基金数据统一更新脚本
 *
 * 从 天天基金/东方财富 公开 API 抓取每只基金的：
 *   - 最新净值 (NAV)
 *   - 近1年 / 近6月 / 近3月 / 近1月 收益率
 *
 * 写入 PostgreSQL fund_nav 表，供网页端直接查询。
 *
 * 用法：
 *   node scripts/update-fund-data.cjs              # 更新全部基金
 *   node scripts/update-fund-data.cjs --type=QDII  # 仅更新 QDII
 *   node scripts/update-fund-data.cjs --dry-run    # 预览不写入
 *
 * 数据源优先级：东方财富 API > 天天基金 API
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

// ── 命令行参数 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  dryRun: args.includes('--dry-run'),
  type: null,
  verbose: args.includes('--verbose'),
};
const typeArg = args.find(a => a.startsWith('--type='));
if (typeArg) opts.type = typeArg.split('=')[1];

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

// ── 数据抓取核心 ────────────────────────────────────────────

/**
 * 快速路径：从移动端 API 获取（1次请求，含预计算收益率）
 * 数据源：FundBasicInformation.ashx
 */
async function fetchFundDataFast(code) {
  try {
    const { data } = await axios.get(
      'https://fundmobapi.eastmoney.com/FundMApi/FundBasicInformation.ashx',
      { params: { FCODE: code, deviceid: 'wap', plat: 'Wap', product: 'EFund', version: '2.0.0' }, timeout: 10000 }
    );
    const d = data?.Datas;
    if (!d) return null;

    const nav = parseFloat(d.DWJZ);
    if (isNaN(nav) || nav <= 0) return null;

    const pf = (v) => (v !== undefined && v !== null && v !== '' ? parseFloat(v) : null);
    return {
      code, nav,
      totalNav: parseFloat(d.LJJZ) || nav,
      navDate: d.FSRQ || null,
      return1w: pf(d.SYL_Z),
      return1m: pf(d.SYL_Y),
      return3m: pf(d.SYL_3Y),
      return6m: pf(d.SYL_6Y),
      return1y: pf(d.SYL_1N),
    };
  } catch {
    return null;
  }
}

/**
 * 完整路径：从 lsjz API 分页并行拉取净值历史，自行计算收益率
 * 当快速路径失败时作为回退
 */
async function fetchFundDataPaginated(code) {
  const result = { code, nav: null, navDate: null, return1m: null, return3m: null, return6m: null, return1y: null };

  try {
    // 并行拉取所有分页（最多 15 页，交错启动减轻 API 压力）
    const pageFetchers = [];
    for (let page = 1; page <= 15; page++) {
      pageFetchers.push((async (p) => {
        // 交错延迟，每页错开 30ms
        await new Promise(r => setTimeout(r, (p - 1) * 30));
        try {
          const resp = await axios.get('https://api.fund.eastmoney.com/f10/lsjz', {
            params: { fundCode: code, pageIndex: p, pageSize: 20 },
            timeout: 10000,
            headers: { Referer: 'https://fund.eastmoney.com/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          return resp.data?.Data?.LSJZList || [];
        } catch { return []; }
      })(page));
    }

    const pageResults = await Promise.all(pageFetchers);
    const allRecords = [];
    for (const pageList of pageResults) {
      if (!pageList || pageList.length === 0) break;
      allRecords.push(...pageList);
      if (pageList.length < 20) break;
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
    log.warn(`获取 ${code} 历史净值失败: ${err.message}`);
  }

  return result;
}

/**
 * 获取单只基金数据 — 快速路径优先，失败则回退到分页拉取
 */
async function fetchFundData(code) {
  // 1. 快速路径：移动端 API（1次请求）
  const fast = await fetchFundDataFast(code);
  if (fast && fast.nav) return fast;

  // 2. 回退：lsjz 分页并行拉取
  const paginated = await fetchFundDataPaginated(code);
  if (paginated.nav) return paginated;

  // 3. 最终回退：pingzhongdata 收益率
  const fallback = await fetchFundReturnsFallback(code);
  if (fallback) {
    return { code, nav: null, navDate: null, ...fallback };
  }

  return { code, nav: null, navDate: null, return1m: null, return3m: null, return6m: null, return1y: null };
}

/**
 * 备用方案：从东方财富 pingzhongdata API 获取收益率
 * 当 lsjz API 返回数据不足时使用
 */
async function fetchFundReturnsFallback(code) {
  try {
    const resp = await axios.get(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://fund.eastmoney.com/',
        Range: 'bytes=0-5000',
      },
    });
    const text = resp.data || '';
    const extract = (key) => {
      const m = text.match(new RegExp(key + "\\s*=\\s*['\"]([^'\"]+)"));
      return m ? parseFloat(m[1]) : null;
    };
    return {
      return1y: extract('syl_1n'),
      return6m: extract('syl_6y'),
      return3m: extract('syl_3y'),
      return1m: extract('syl_1y'),
    };
  } catch {
    return null;
  }
}

/**
 * 从腾讯行情 API 批量获取净值（备用/快速估值）
 * 每次最多 50 只，比东方财富 lsjz 快很多，但没有收益率数据
 */
async function fetchNavBatchTencent(codes) {
  const results = new Map();
  try {
    const symbols = codes.map(c => 'jj' + c).join(',');
    const resp = await axios.get(`https://qt.gtimg.cn/q=${symbols}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!resp.data) return results;

    const lines = resp.data.split(';').filter(l => l.includes('~'));
    for (const line of lines) {
      const parts = line.split('~');
      if (parts.length < 9) continue;
      const c = parts[0].split('"')[1]?.replace('jj', '');
      const nav = parseFloat(parts[5]);
      const navDate = parts[8];
      if (c && nav > 0 && navDate) {
        results.set(c, { nav, navDate });
      }
    }
  } catch {}
  return results;
}

// ── 写入数据库 ──────────────────────────────────────────────

async function saveToDB(data) {
  if (opts.dryRun) return;

  const totalNav = data.totalNav || data.nav;
  const query = `
    INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1m, return_3m, return_6m, return_1y)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (fund_code, nav_date)
    DO UPDATE SET
      nav = EXCLUDED.nav,
      total_nav = COALESCE(EXCLUDED.total_nav, fund_nav.total_nav),
      return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
      return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
      return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
      return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y)
  `;

  await pool.query(query, [
    data.code, data.nav, totalNav, data.navDate,
    data.return1m, data.return3m, data.return6m, data.return1y,
  ]);
}

async function updateFundBuyStatus(code, buySuggestion, dailyLimit) {
  if (opts.dryRun) return;
  await pool.query(
    `UPDATE funds SET buy_suggestion = COALESCE($1, buy_suggestion),
       daily_limit = COALESCE($2, daily_limit), updated_at = NOW()
     WHERE code = $3`,
    [buySuggestion, dailyLimit, code]
  );
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  log.info('========================================');
  log.info('基金数据统一更新脚本');
  log.info(`模式: ${opts.dryRun ? 'DRY-RUN (预览)' : '写入数据库'}`);
  if (opts.type) log.info(`基金类型: ${opts.type}`);
  log.info('========================================');

  // 1. 查询要更新的基金列表
  let query = 'SELECT code, name, type, industry FROM funds WHERE 1=1';
  const params = [];
  if (opts.type) {
    query += ' AND type = $1';
    params.push(opts.type);
  }
  query += ' ORDER BY code';

  const { rows: funds } = await pool.query(query, params);
  log.info(`待更新基金: ${funds.length} 只`);

  if (funds.length === 0) {
    log.warn('没有需要更新的基金，退出');
    await pool.end();
    process.exit(0);
  }

  // 2. 并发批量更新
  const BATCH_SIZE = 15;
  const BATCH_DELAY = 200; // ms
  let successCount = 0;
  let navCount = 0;
  let skipCount = 0;
  let fastCount = 0;
  let paginatedCount = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = 0; i < funds.length; i += BATCH_SIZE) {
    const batch = funds.slice(i, i + BATCH_SIZE);

    // 并发请求当前批次
    const results = await Promise.allSettled(
      batch.map(f => fetchFundData(f.code))
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const fund = batch[j];

      if (r.status !== 'fulfilled' || !r.value) {
        skipCount++;
        continue;
      }

      const data = r.value;

      if (data.nav && data.navDate) {
        try {
          await saveToDB(data);
          navCount++;
          successCount++;
        } catch (e) {
          skipCount++;
          if (errors.length < 10) {
            errors.push(`${fund.code}(${fund.name}): ${e.message}`);
          }
        }
      } else {
        skipCount++;
      }

      if (opts.verbose && data.nav) {
        log.info(
          `  ${fund.code} ${fund.name.padEnd(20)} NAV=${data.nav} ` +
          `1m=${data.return1m ?? '-'}% 3m=${data.return3m ?? '-'}% ` +
          `6m=${data.return6m ?? '-'}% 1y=${data.return1y ?? '-'}%`
        );
      }
    }

    // 进度
    const done = Math.min(i + BATCH_SIZE, funds.length);
    if (done % 50 === 0 || done >= funds.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log.info(`进度: ${done}/${funds.length} (成功 ${successCount}, 净值 ${navCount}, 跳过 ${skipCount}) 耗时 ${elapsed}s`);
    }

    // 批次间延迟
    if (i + BATCH_SIZE < funds.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  // 3. 汇总
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log.info('========================================');
  log.info(`更新完成: 成功 ${successCount}/${funds.length}, 跳过 ${skipCount}`);
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
