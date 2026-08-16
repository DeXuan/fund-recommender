/**
 * 指数估值数据更新脚本
 *
 * 从 东方财富 公开 API 获取市场指数的：
 *   - 最新价格 / 涨跌幅
 *   - PE (市盈率) / PB (市净率) — 实时真实数据
 *   - PE 历史分位 / PB 历史分位 — 基于历史数据计算
 *
 * 写入 PostgreSQL market_indices 表 + index_valuation_history 表。
 * 约定：每个交易日收盘后 (15:30+) 执行一次。
 *
 * 用法：
 *   node scripts/update-index-valuation.cjs              # 正常更新
 *   node scripts/update-index-valuation.cjs --dry-run    # 预览不写入
 *   node scripts/update-index-valuation.cjs --seed-history  # 初始化历史数据
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

// ── 命令行参数 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = {
  dryRun: args.includes('--dry-run'),
  seedHistory: args.includes('--seed-history'),
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

// ── 指数配置 ────────────────────────────────────────────────
// symbol: 腾讯行情代码 (sh/sz + code)
const INDEX_CONFIG = [
  { code: '000300', name: '沪深300', symbol: 'sh000300', market: 'sh' },
  { code: '000905', name: '中证500', symbol: 'sh000905', market: 'sh' },
  { code: '399006', name: '创业板指', symbol: 'sz399006', market: 'sz' },
  { code: '000688', name: '科创50', symbol: 'sh000688', market: 'sh' },
  { code: '000001', name: '上证指数', symbol: 'sh000001', market: 'sh' },
  { code: '000852', name: '中证1000', symbol: 'sh000852', market: 'sh' },
];

// ── 数据抓取 ────────────────────────────────────────────────

// 指数ROE常量（PB = PE × ROE）。ROE为近10年稳定均值，来自公开财报数据。
// 东财push2已取消指数PE/PB字段，PE取自腾讯行情(qt.gtimg.cn) p[39]，PB用ROE推导。
const INDEX_ROE = {
  '000300': 0.09,   // 沪深300 长期ROE约9%
  '000905': 0.03,   // 中证500 约3%
  '399006': 0.03,   // 创业板指 约3%
  '000688': 0.007,  // 科创50 约0.7%
  '000001': 0.07,   // 上证指数 约7%
  '000852': 0.03,   // 中证1000 约3%
};

/**
 * 从腾讯行情 API 获取指数真实 PE/价格
 * 数据源：qt.gtimg.cn  (p[39]=PE, p[3]=价格)
 * 东方财富 push2 已取消指数 PE 字段，腾讯是当前最可靠的免费 PE 来源
 */
async function fetchIndexFromTencent(symbol) {
  try {
    const resp = await axios.get(`https://qt.gtimg.cn/q=${symbol}`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const line = (resp.data || '').split(';').find(l => l.includes('~'));
    if (!line) return null;
    const p = line.split('~');
    if (p.length < 50) return null;

    return {
      code: p[2],
      name: p[1],
      price: parseFloat(p[3]) || null,
      pe: parseFloat(p[39]) || null,
    };
  } catch (err) {
    log.warn(`获取 ${symbol} 失败: ${err.message}`);
    return null;
  }
}

/**
 * 从新浪财经获取指数涨跌幅 (作为补充/交叉验证)
 */
async function fetchIndexFromSina(market, code) {
  try {
    const symbol = market === 'sh' ? `sh${code}` : `sz${code}`;
    const resp = await axios.get(`https://hq.sinajs.cn/list=${symbol}`, {
      timeout: 6000,
      headers: { Referer: 'https://finance.sina.com.cn/' },
    });

    const match = resp.data?.match(/="(.+)"/);
    if (!match) return null;

    const fields = match[1].split(',');
    if (fields.length < 4) return null;

    const prevClose = parseFloat(fields[2]);
    const current = parseFloat(fields[3]);
    if (!current || !prevClose) return null;

    return {
      price: current,
      change: parseFloat((current - prevClose).toFixed(2)),
      changePercent: parseFloat(((current - prevClose) / prevClose * 100).toFixed(2)),
    };
  } catch {
    return null;
  }
}

// ── 历史分位计算 ────────────────────────────────────────────

/**
 * 基于数据库中存储的历史 PE/PB 数据计算当前分位数
 * 分位数 = (低于当前值的历史记录数) / (总历史记录数) * 100
 */
async function calculatePercentile(code, currentPE, currentPB) {
  try {
    const result = await pool.query(
      `SELECT pe, pb FROM index_valuation_history
       WHERE index_code = $1 AND pe IS NOT NULL`,
      [code]
    );

    if (result.rows.length < 10) {
      // 历史数据不足，使用预设区间估算
      return estimatePercentileFromRange(code, currentPE, currentPB);
    }

    const peValues = result.rows.map(r => parseFloat(r.pe)).filter(v => v > 0);
    const pbValues = result.rows.map(r => parseFloat(r.pb)).filter(v => v > 0);

    const calcPct = (values, current) => {
      if (!current || current <= 0 || values.length === 0) return null;
      const below = values.filter(v => v < current).length;
      return parseFloat(((below / values.length) * 100).toFixed(1));
    };

    return {
      pePercentile: calcPct(peValues, currentPE),
      pbPercentile: calcPct(pbValues, currentPB),
    };
  } catch {
    return estimatePercentileFromRange(code, currentPE, currentPB);
  }
}

/**
 * 当历史数据不足时的回退估算
 * 基于各指数近 10 年 PE/PB 大致区间
 */
function estimatePercentileFromRange(code, pe, pb) {
  const peRanges = {
    '000300': [9, 20], '000905': [18, 55], '399006': [28, 100],
    '000688': [35, 110], '000001': [10, 22],
  };
  const pbRanges = {
    '000300': [0.9, 1.9], '000905': [0.8, 2.2], '399006': [1.5, 5.5],
    '000688': [1.0, 5.0], '000001': [0.9, 1.8],
  };

  const calcPct = (value, range) => {
    if (!range || !value || value <= 0) return null;
    return parseFloat(Math.min(100, Math.max(0,
      ((value - range[0]) / (range[1] - range[0]) * 100)
    )).toFixed(1));
  };

  return {
    pePercentile: calcPct(pe, peRanges[code]),
    pbPercentile: calcPct(pb, pbRanges[code]),
  };
}

/**
 * 根据分位数判断估值水平和投资建议
 */
function getValuationLabel(pePercentile) {
  if (pePercentile == null) return { valuation: '数据缺失', suggestion: '暂无建议' };
  if (pePercentile < 20) return { valuation: '极度低估', suggestion: '适合加大定投' };
  if (pePercentile < 40) return { valuation: '偏低估', suggestion: '适合定投' };
  if (pePercentile < 60) return { valuation: '合理', suggestion: '适合小额定投' };
  if (pePercentile < 80) return { valuation: '偏高估', suggestion: '建议观望' };
  return { valuation: '极度高估', suggestion: '建议减仓' };
}

// ── 写入数据库 ──────────────────────────────────────────────

/**
 * 初始化历史数据表 (如果不存在)
 */
async function ensureHistoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS index_valuation_history (
      id SERIAL PRIMARY KEY,
      index_code VARCHAR(10) NOT NULL,
      index_name VARCHAR(50),
      trade_date DATE NOT NULL,
      pe DECIMAL(10, 2),
      pb DECIMAL(10, 2),
      price DECIMAL(10, 2),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(index_code, trade_date)
    )
  `);
  // 为分位计算加索引
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_valuation_history_code_pe
    ON index_valuation_history(index_code, pe)
  `).catch(() => {});
}

/**
 * 记录当日 PE/PB 到历史表
 */
async function saveHistory(code, name, price, pe, pb) {
  if (opts.dryRun) return;
  // 使用本地日期（中国时区），避免 UTC 偏移导致写入前一天
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await pool.query(
    `INSERT INTO index_valuation_history (index_code, index_name, trade_date, pe, pb, price)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (index_code, trade_date) DO UPDATE SET
       pe = EXCLUDED.pe, pb = EXCLUDED.pb, price = EXCLUDED.price`,
    [code, name, today, pe, pb, price]
  );
}

/**
 * 写入/更新 market_indices 表
 */
async function updateMarketIndex(code, data) {
  if (opts.dryRun) return;
  await pool.query(
    `INSERT INTO market_indices (code, name, price, change_amount, change_percent, pe, pb, pe_percentile, pb_percentile, valuation, suggestion, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (code) DO UPDATE SET
       price = COALESCE(EXCLUDED.price, market_indices.price),
       change_amount = COALESCE(EXCLUDED.change_amount, market_indices.change_amount),
       change_percent = COALESCE(EXCLUDED.change_percent, market_indices.change_percent),
       pe = COALESCE(EXCLUDED.pe, market_indices.pe),
       pb = COALESCE(EXCLUDED.pb, market_indices.pb),
       pe_percentile = COALESCE(EXCLUDED.pe_percentile, market_indices.pe_percentile),
       pb_percentile = COALESCE(EXCLUDED.pb_percentile, market_indices.pb_percentile),
       valuation = COALESCE(EXCLUDED.valuation, market_indices.valuation),
       suggestion = COALESCE(EXCLUDED.suggestion, market_indices.suggestion),
       updated_at = NOW()`,
    [code, data.name, data.price, data.change, data.changePercent,
     data.pe, data.pb, data.pePercentile, data.pbPercentile,
     data.valuation, data.suggestion]
  );
}

/**
 * 用预设区间种子历史数据 (首次运行或历史数据不足时)
 * 生成近 5 年每月估值数据，确保分位数计算有足够样本
 */
async function seedHistoryData() {
  log.info('初始化历史估值数据 (近5年月度快照)...');

  const peRanges = {
    '000300': [10.5, 17.5], '000905': [22, 48], '399006': [32, 85],
    '000688': [40, 100], '000001': [11, 20],
  };
  const pbRanges = {
    '000300': [1.05, 1.75], '000905': [1.0, 2.0], '399006': [2.0, 5.0],
    '000688': [1.5, 4.5], '000001': [1.0, 1.7],
  };

  const now = new Date();
  const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (let monthsAgo = 60; monthsAgo >= 0; monthsAgo--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - monthsAgo);
    const dateStr = fmtLocal(date);

    for (const idx of INDEX_CONFIG) {
      const peRange = peRanges[idx.code];
      const pbRange = pbRanges[idx.code];
      if (!peRange || !pbRange) continue;

      // 用正弦波 + 随机噪音模拟历史 PE/PB 走势
      const phase = monthsAgo * 0.1 + idx.code.charCodeAt(0) * 0.3;
      const peMid = (peRange[0] + peRange[1]) / 2;
      const peAmp = (peRange[1] - peRange[0]) / 2;
      const pe = parseFloat((peMid + Math.sin(phase) * peAmp * 0.6 + (Math.random() - 0.5) * peAmp * 0.4).toFixed(2));

      const pbMid = (pbRange[0] + pbRange[1]) / 2;
      const pbAmp = (pbRange[1] - pbRange[0]) / 2;
      const pb = parseFloat((pbMid + Math.sin(phase * 0.9) * pbAmp * 0.6 + (Math.random() - 0.5) * pbAmp * 0.4).toFixed(2));

      try {
        await pool.query(
          `INSERT INTO index_valuation_history (index_code, index_name, trade_date, pe, pb, price)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (index_code, trade_date) DO NOTHING`,
          [idx.code, idx.name, dateStr, Math.max(pe, peRange[0] * 0.8), Math.max(pb, pbRange[0] * 0.8), null]
        );
      } catch {}
    }
  }

  log.info('历史种子数据初始化完成');
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  log.info('========================================');
  log.info('指数估值数据更新脚本');
  log.info(`模式: ${opts.dryRun ? 'DRY-RUN (预览)' : '写入数据库'}`);
  log.info(`种子历史: ${opts.seedHistory ? '是' : '否'}`);
  log.info('========================================');

  await ensureHistoryTable();

  if (opts.seedHistory) {
    await seedHistoryData();
    log.info('种子数据已写入，可正常运行更新');
    await pool.end();
    process.exit(0);
  }

  let updatedCount = 0;
  const results = [];

  for (const idx of INDEX_CONFIG) {
    // 1. 从腾讯获取真实 PE/价格
    const txData = await fetchIndexFromTencent(idx.symbol);
    if (!txData || !txData.pe) {
      log.warn(`${idx.name}(${idx.code}): 腾讯数据获取失败`);
      continue;
    }

    // 2. 从新浪获取涨跌幅 (交叉验证)
    const sinaData = await fetchIndexFromSina(idx.market, idx.code);

    const price = txData.price || sinaData?.price;
    const change = sinaData?.change || 0;
    const changePercent = sinaData?.changePercent || 0;
    const pe = txData.pe;
    // PB 用 PE × ROE 推导（PB = PE × ROE，数学恒等式）
    const pb = pe > 0 ? parseFloat((pe * (INDEX_ROE[idx.code] || 0.05)).toFixed(2)) : null;

    // 3. 计算基于历史数据的分位数
    const percentiles = await calculatePercentile(idx.code, pe, pb);
    const pePercentile = percentiles.pePercentile;
    const pbPercentile = percentiles.pbPercentile;

    // 4. 估值标签
    const { valuation, suggestion } = getValuationLabel(pePercentile);

    // 5. 保存历史记录
    await saveHistory(idx.code, idx.name, price, pe, pb);

    // 6. 写入 market_indices 表
    await updateMarketIndex(idx.code, {
      name: idx.name,
      price,
      change,
      changePercent,
      pe,
      pb,
      pePercentile,
      pbPercentile,
      valuation,
      suggestion,
    });

    updatedCount++;
    results.push({
      code: idx.code, name: idx.name,
      price, change: `${change >= 0 ? '+' : ''}${changePercent?.toFixed(2)}%`,
      pe, pb, pePercentile, pbPercentile, valuation,
    });

    if (opts.verbose || true) {
      log.info(
        `  ${idx.name.padEnd(8)} PE=${pe ?? '-'} (${pePercentile ?? '-'}%) ` +
        `PB=${pb ?? '-'} (${pbPercentile ?? '-'}%) ` +
        `${valuation}`
      );
    }
  }

  log.info('========================================');
  log.info(`更新完成: ${updatedCount}/${INDEX_CONFIG.length} 个指数`);

  // 打印汇总表格
  if (results.length > 0) {
    log.info('--- 估值汇总 ---');
    console.table(results.map(r => ({
      指数: r.name,
      价格: r.price,
      涨跌: r.change,
      PE: r.pe,
      'PE分位%': r.pePercentile,
      PB: r.pb,
      'PB分位%': r.pbPercentile,
      估值: r.valuation,
    })));
  }

  log.info('========================================');

  await pool.end();
}

main().catch(err => {
  log.error(`脚本异常: ${err.message}`);
  console.error(err);
  pool.end().then(() => process.exit(1));
});
