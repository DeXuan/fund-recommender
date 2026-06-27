const { getPool } = require('./db.cjs');
const logger = require('./utils/logger.cjs');

// ========== 内存缓存 ==========
const _cache = new Map();
const CACHE_TTL = 30 * 1000; // 30秒

function _cacheGet(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  _cache.delete(key);
  return null;
}

function _cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
  // 防止内存泄漏：最多缓存 20 个 key
  if (_cache.size > 20) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
}

// ========== 基金基本信息 ==========

async function getAllFunds(filters = {}) {
  const pool = getPool();
  let query = 'SELECT * FROM funds WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (filters.industry) {
    query += ` AND industry = $${paramIndex++}`;
    params.push(filters.industry);
  }
  if (filters.type) {
    query += ` AND type = $${paramIndex++}`;
    params.push(filters.type);
  }
  if (filters.search) {
    query += ` AND (code ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  // 排序（camelCase → funds 表列名映射，funds 表无收益率列）
  const sortColumnMap = { totalFee: 'total_fee', total_fee: 'total_fee', scale: 'scale', rating: 'rating' };
  const sortField = filters.sort && sortColumnMap[filters.sort] ? filters.sort : null;
  if (sortField) {
    const sortColumn = sortColumnMap[sortField];
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortColumn} ${order}`;
  }

  const result = await pool.query(query, params);
  return result.rows.map(formatFund);
}

async function getFundByCode(code) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM funds WHERE code = $1', [code]);
  return result.rows.length > 0 ? formatFund(result.rows[0]) : null;
}

async function getFundsByType(type) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM funds WHERE type = $1', [type]);
  return result.rows.map(formatFund);
}

async function getFundsByIndustry(industry) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM funds WHERE industry = $1', [industry]);
  return result.rows.map(formatFund);
}

async function getIndustries() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT DISTINCT industry FROM (
      SELECT industry FROM funds
      UNION
      (SELECT '易方达' as industry FROM yifangda_funds LIMIT 1)
    ) combined ORDER BY industry
  `);
  return result.rows.map(r => r.industry);
}

// 格式化基金数据（数据库字段名 -> API字段名）
function formatFund(row) {
  return {
    code: row.code,
    name: row.name,
    type: row.type,
    industry: row.industry,
    index: row.index_name,
    managementFee: parseFloat(row.management_fee) || 0,
    custodyFee: parseFloat(row.custody_fee) || 0,
    serviceFee: parseFloat(row.service_fee) || 0,
    totalFee: parseFloat(row.total_fee) || 0,
    scale: parseFloat(row.scale) || 0,
    rating: row.rating,
    buySuggestion: row.buy_suggestion,
    valuation: row.valuation,
    trend: row.trend,
    logic: row.logic,
    isGoldSelected: row.is_gold_selected,
    dailyLimit: row.daily_limit,
    manager: row.manager || null,
    // 从 fund_nav 表动态获取的字段（需要 JOIN 或单独查询）
    nav: null,
    navDate: null,
    return1w: null,
    return1m: null,
    return3m: null,
    return6m: null,
    return1y: null,
  };
}

// ========== 基金净值 ==========

async function updateFundNav(code, navData) {
  const pool = getPool();
  const query = `
    INSERT INTO fund_nav (fund_code, nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (fund_code, nav_date)
    DO UPDATE SET
      nav = EXCLUDED.nav,
      total_nav = EXCLUDED.total_nav,
      return_1w = COALESCE(EXCLUDED.return_1w, fund_nav.return_1w),
      return_1m = COALESCE(EXCLUDED.return_1m, fund_nav.return_1m),
      return_3m = COALESCE(EXCLUDED.return_3m, fund_nav.return_3m),
      return_6m = COALESCE(EXCLUDED.return_6m, fund_nav.return_6m),
      return_1y = COALESCE(EXCLUDED.return_1y, fund_nav.return_1y),
      created_at = NOW()
  `;
  await pool.query(query, [
    code,
    navData.nav,
    navData.totalNav || null,
    navData.navDate,
    navData.return1w || null,
    navData.return1m || null,
    navData.return3m || null,
    navData.return6m || null,
    navData.return1y || null,
  ]);
}

// 只更新最新一条净值记录的收益率字段
async function updateFundReturns(code, returns) {
  const pool = getPool();
  const query = `
    UPDATE fund_nav
    SET return_1w = COALESCE($2, return_1w),
        return_1m = COALESCE($3, return_1m),
        return_3m = COALESCE($4, return_3m),
        return_6m = COALESCE($5, return_6m),
        return_1y = COALESCE($6, return_1y)
    WHERE id = (
      SELECT id FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1
    )
  `;
  await pool.query(query, [
    code,
    returns.return1w || null,
    returns.return1m || null,
    returns.return3m || null,
    returns.return6m || null,
    returns.return1y || null,
  ]);
}

async function getLatestNav(code) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1',
    [code]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    nav: parseFloat(row.nav),
    totalNav: row.total_nav ? parseFloat(row.total_nav) : null,
    navDate: row.nav_date,
    return1w: row.return_1w ? parseFloat(row.return_1w) : null,
    return1m: row.return_1m ? parseFloat(row.return_1m) : null,
    return3m: row.return_3m ? parseFloat(row.return_3m) : null,
    return6m: row.return_6m ? parseFloat(row.return_6m) : null,
    return1y: row.return_1y ? parseFloat(row.return_1y) : null,
  };
}

// 获取所有基金的最新净值（带LEFT JOIN）
// 收益率内存缓存（code -> { returns, timestamp }）
const returnsCache = new Map();
const RETURNS_CACHE_TTL = 30 * 60 * 1000; // 30分钟

// 从东方财富API获取单只基金收益率
async function fetchReturnsFromAPI(code) {
  try {
    const axios = require('axios');
    const resp = await axios.get(`https://fund.eastmoney.com/pingzhongdata/${code}.js`, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://fund.eastmoney.com/', Range: 'bytes=0-3000' },
    });
    const text = resp.data || '';
    const extract = (key) => {
      const m = text.match(new RegExp(key + "\\s*=\\s*['\"]([^'\"]+)"));
      return m ? parseFloat(m[1]) : null;
    };
    return { return1y: extract('syl_1n'), return6m: extract('syl_6y'), return3m: extract('syl_3y'), return1m: extract('syl_1y') };
  } catch { return null; }
}

// 批量获取收益率（带缓存+并发控制）
async function batchFetchReturns(codes) {
  const now = Date.now();
  const toFetch = codes.filter(c => {
    const cached = returnsCache.get(c);
    return !cached || (now - cached.timestamp > RETURNS_CACHE_TTL);
  });

  // 并发获取，每批5个
  for (let i = 0; i < toFetch.length; i += 5) {
    const batch = toFetch.slice(i, i + 5);
    const results = await Promise.all(batch.map(c => fetchReturnsFromAPI(c)));
    batch.forEach((code, idx) => {
      if (results[idx]) {
        returnsCache.set(code, { returns: results[idx], timestamp: now });
      }
    });
  }

  const map = new Map();
  codes.forEach(c => {
    const cached = returnsCache.get(c);
    map.set(c, cached ? cached.returns : null);
  });
  return map;
}

async function getAllFundsWithNav(filters = {}) {
  // 构建缓存 key（只缓存无筛选的场景）
  const cacheKey = (!filters.industry && !filters.type && !filters.search && !filters.manager && !filters.sort)
    ? '_all_'
    : null;

  // 尝试命中缓存
  if (cacheKey) {
    const cached = _cacheGet(cacheKey);
    if (cached) return cached;
  }

  const pool = getPool();

  // 合并 funds + yifangda_funds，以基金代码去重
  // funds 表数据为主，yifangda_funds 补充不在 funds 中的基金
  let query = `
    SELECT * FROM (
      SELECT f.code, f.name, f.type, f.industry, f.index_name,
             f.management_fee, f.custody_fee, f.service_fee, f.total_fee,
             f.scale, f.rating, f.buy_suggestion, f.valuation, f.trend,
             f.logic, f.is_gold_selected, f.daily_limit,
             COALESCE(f.manager, '') as manager,
             f.institution_hold, f.individual_hold,
             n.nav, n.total_nav, n.nav_date,
             n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
      FROM funds f
      LEFT JOIN LATERAL (
        SELECT nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y
        FROM fund_nav
        WHERE fund_code = f.code
        ORDER BY return_1y IS NOT NULL DESC, nav_date DESC
        LIMIT 1
      ) n ON true

      UNION ALL

      SELECT y.fund_code as code, y.fund_name as name,
             '易方达' as type, '易方达' as industry, '' as index_name,
             0 as management_fee, 0 as custody_fee, 0 as service_fee, 0 as total_fee,
             COALESCE(y.scale, 0) as scale, 3 as rating,
             '' as buy_suggestion, '' as valuation, '' as trend,
             '' as logic, false as is_gold_selected, 0 as daily_limit,
             COALESCE(y.fund_manager, '') as manager,
             NULL as institution_hold, NULL as individual_hold,
             y.unit_nav as nav, NULL as total_nav, y.nav_date,
             y.return_1w, y.return_1m, y.return_3m, y.return_6m, y.return_1y
      FROM yifangda_funds y
      WHERE y.fund_code NOT IN (SELECT code FROM funds)
    ) combined WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (filters.industry) {
    query += ` AND industry = $${paramIndex++}`;
    params.push(filters.industry);
  }
  if (filters.type) {
    query += ` AND type = $${paramIndex++}`;
    params.push(filters.type);
  }
  if (filters.search) {
    query += ` AND (code ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }
  if (filters.manager) {
    query += ` AND manager = $${paramIndex++}`;
    params.push(filters.manager);
  }

  // 排序
  const sortColumnMap = {
    return1y: 'return_1y', return6m: 'return_6m', return3m: 'return_3m',
    return1m: 'return_1m', return1w: 'return_1w',
    totalFee: 'total_fee', scale: 'scale', rating: 'rating',
    code: 'code', name: 'name', nav: 'nav',
  };
  const sortField = filters.sort && sortColumnMap[filters.sort] ? sortColumnMap[filters.sort] : null;
  if (sortField) {
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${order} NULLS LAST`;
  } else {
    query += ' ORDER BY code';
  }

  // 分页
  const page = parseInt(filters.page) || 1;
  const pageSize = Math.min(parseInt(filters.pageSize) || 100, 15000);
  const offset = (page - 1) * pageSize;

  // 始终执行 COUNT 查询以保证 total 准确
  const lastOrderBy = query.lastIndexOf('ORDER BY');
  const innerQuery = query.substring(query.indexOf('FROM ('), lastOrderBy > 0 ? lastOrderBy : undefined);
  const countQuery = `SELECT COUNT(*) ${innerQuery}`;
  const countResult = await pool.query(countQuery, params);
  let total = parseInt(countResult.rows[0].count);

  query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(pageSize, offset);

  const result = await pool.query(query, params);

  const response = {
    data: result.rows.map(row => ({
      code: row.code,
      name: row.name,
      type: row.type,
      industry: row.industry,
      index: row.index_name,
      managementFee: parseFloat(row.management_fee) || 0,
      custodyFee: parseFloat(row.custody_fee) || 0,
      serviceFee: parseFloat(row.service_fee) || 0,
      totalFee: parseFloat(row.total_fee) || 0,
      scale: parseFloat(row.scale) || 0,
      rating: row.rating,
      buySuggestion: row.buy_suggestion,
      valuation: row.valuation,
      trend: row.trend,
      logic: row.logic,
      isGoldSelected: row.is_gold_selected,
      dailyLimit: row.daily_limit,
      manager: row.manager || null,
      institutionHold: row.institution_hold != null ? parseFloat(row.institution_hold) : null,
      individualHold: row.individual_hold != null ? parseFloat(row.individual_hold) : null,
      nav: row.nav ? parseFloat(row.nav) : null,
      navDate: row.nav_date || null,
      return1w: row.return_1w ? parseFloat(row.return_1w) : null,
      return1m: row.return_1m ? parseFloat(row.return_1m) : null,
      return3m: row.return_3m ? parseFloat(row.return_3m) : null,
      return6m: row.return_6m ? parseFloat(row.return_6m) : null,
      return1y: row.return_1y ? parseFloat(row.return_1y) : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };

  // 写入缓存
  if (cacheKey) _cacheSet(cacheKey, response);
  return response;
}

// ========== 评分查询（共享SQL） ==========

// 查询基金+最新净值（用于评分/排名/策略对比等场景）
// 返回原始数据库行，调用方自行评分行映射
async function queryFundsForScoring(filters = {}) {
  const pool = getPool();
  let query = `
    SELECT f.code, f.name, f.type, f.industry, f.total_fee, f.scale, f.valuation, f.rating,
           f.management_fee, f.custody_fee, f.service_fee, f.manager,
           n.nav, n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
    FROM funds f
    LEFT JOIN LATERAL (
      SELECT nav, return_1w, return_1m, return_3m, return_6m, return_1y
      FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
    ) n ON true
    WHERE n.nav IS NOT NULL
  `;
  const params = [];
  if (filters.industry) { params.push(filters.industry); query += ` AND f.industry = $${params.length}`; }
  if (filters.type) { params.push(filters.type); query += ` AND f.type = $${params.length}`; }
  if (filters.requireReturn1y) { query += ' AND n.return_1y IS NOT NULL'; }
  const result = await pool.query(query, params);
  return result.rows;
}

// ========== 市场指数 ==========

async function getMarketIndices() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM market_indices ORDER BY code');
  return result.rows.map(row => ({
    code: row.code,
    name: row.name,
    price: row.price ? parseFloat(row.price) : null,
    change: row.change_amount ? parseFloat(row.change_amount) : null,
    changePercent: row.change_percent ? parseFloat(row.change_percent) : null,
    pe: row.pe ? parseFloat(row.pe) : null,
    pb: row.pb ? parseFloat(row.pb) : null,
    pePercentile: row.pe_percentile ? parseFloat(row.pe_percentile) : null,
    pbPercentile: row.pb_percentile ? parseFloat(row.pb_percentile) : null,
    valuation: row.valuation,
    suggestion: row.suggestion,
    dataDate: row.updated_at,
  }));
}

async function updateMarketIndex(code, data) {
  const pool = getPool();
  const query = `
    INSERT INTO market_indices (code, name, price, change_amount, change_percent, pe, pb, pe_percentile, pb_percentile, valuation, suggestion, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (code)
    DO UPDATE SET
      price = COALESCE(EXCLUDED.price, market_indices.price),
      change_amount = COALESCE(EXCLUDED.change_amount, market_indices.change_amount),
      change_percent = COALESCE(EXCLUDED.change_percent, market_indices.change_percent),
      pe = COALESCE(EXCLUDED.pe, market_indices.pe),
      pb = COALESCE(EXCLUDED.pb, market_indices.pb),
      pe_percentile = COALESCE(EXCLUDED.pe_percentile, market_indices.pe_percentile),
      pb_percentile = COALESCE(EXCLUDED.pb_percentile, market_indices.pb_percentile),
      valuation = COALESCE(EXCLUDED.valuation, market_indices.valuation),
      suggestion = COALESCE(EXCLUDED.suggestion, market_indices.suggestion),
      updated_at = NOW()
  `;
  await pool.query(query, [
    code, data.name, data.price, data.change, data.changePercent,
    data.pe || null, data.pb || null,
    data.pePercentile || null, data.pbPercentile || null,
    data.valuation || null, data.suggestion || null,
  ]);
}

async function initMarketIndices(indices) {
  const pool = getPool();
  for (const idx of indices) {
    await pool.query(
      `INSERT INTO market_indices (code, name, valuation, suggestion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING`,
      [idx.code, idx.name, idx.valuation, idx.suggestion]
    );
  }
}

// ========== 板块数据 ==========

async function getSectorData() {
  const pool = getPool();
  // 获取最新一天的板块数据（交易日有数据，休息日取上一个交易日）
  const result = await pool.query(
    `SELECT * FROM sector_data WHERE trade_date = (SELECT MAX(trade_date) FROM sector_data) ORDER BY change_percent DESC`
  );
  return result.rows.map(row => ({
    name: row.name,
    change: parseFloat(row.change_percent) || 0,
    volume: row.volume,
    leadingStock: row.leading_stock,
    dataDate: row.trade_date,
  }));
}

async function updateSectorData(sectors) {
  const pool = getPool();
  const today = new Date().toISOString().split('T')[0];
  for (const sector of sectors) {
    await pool.query(
      `INSERT INTO sector_data (name, change_percent, volume, leading_stock, trade_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name, trade_date)
       DO UPDATE SET
         change_percent = EXCLUDED.change_percent,
         volume = EXCLUDED.volume,
         leading_stock = EXCLUDED.leading_stock,
         created_at = NOW()`,
      [sector.name, sector.change, sector.volume, sector.leadingStock, today]
    );
  }
}

// ========== 初始化基金数据 ==========

async function seedFunds(funds) {
  const pool = getPool();
  let insertedCount = 0;
  let failedCount = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 30000; // 30秒超时

  const startTime = Date.now();

  for (const fund of funds) {
    // 检查超时
    if (Date.now() - startTime > TIMEOUT_MS) {
      logger.warn(`[种子数据] 超时（${TIMEOUT_MS}ms），停止插入`);
      break;
    }

    // 如果连续失败太多次，停止插入
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      logger.warn(`[种子数据] 连续失败 ${MAX_CONSECUTIVE_FAILURES} 次，停止插入`);
      break;
    }

    let success = false;
    for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
      try {
        await pool.query(
          `INSERT INTO funds (code, name, type, industry, index_name, management_fee, custody_fee, service_fee, total_fee, scale, rating, buy_suggestion, valuation, trend, logic, is_gold_selected, daily_limit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (code) DO UPDATE SET
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             industry = EXCLUDED.industry,
             index_name = EXCLUDED.index_name,
             management_fee = EXCLUDED.management_fee,
             custody_fee = EXCLUDED.custody_fee,
             service_fee = EXCLUDED.service_fee,
             total_fee = EXCLUDED.total_fee,
             scale = EXCLUDED.scale,
             rating = EXCLUDED.rating,
             buy_suggestion = EXCLUDED.buy_suggestion,
             valuation = EXCLUDED.valuation,
             trend = EXCLUDED.trend,
             logic = EXCLUDED.logic,
             is_gold_selected = EXCLUDED.is_gold_selected OR funds.is_gold_selected,
             daily_limit = EXCLUDED.daily_limit,
             updated_at = NOW()`,
          [
            fund.code,
            fund.name,
            fund.type,
            fund.industry,
            fund.index || null,
            fund.managementFee || 0,
            fund.custodyFee || 0,
            fund.serviceFee || 0,
            fund.totalFee || 0,
            fund.scale || 0,
            fund.rating || 3,
            fund.buySuggestion || null,
            fund.valuation || null,
            fund.trend || null,
            fund.logic || null,
            fund.isGoldSelected || false,
            fund.dailyLimit || 0,
          ]
        );
        insertedCount++;
        success = true;
        consecutiveFailures = 0;
      } catch (e) {
        consecutiveFailures++;
        if (retry < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 500));
        } else {
          failedCount++;
        }
      }
    }
  }

  logger.info(`[种子数据] 尝试插入 ${funds.length} 只基金，成功 ${insertedCount} 只${failedCount > 0 ? `，失败 ${failedCount} 只` : ''}`);
}

// 批量更新基金经理
async function updateFundManagers(managerMap) {
  const pool = getPool();
  let updatedCount = 0;
  for (const [code, manager] of Object.entries(managerMap)) {
    try {
      const result = await pool.query(
        'UPDATE funds SET manager = $1 WHERE code = $2 AND (manager IS NULL OR manager = \'\')',
        [manager, code]
      );
      if (result.rowCount > 0) updatedCount++;
    } catch (e) {
      logger.warn(`更新基金经理失败 ${code}:`, e.message);
    }
  }
  logger.info(`[基金经理] 更新 ${updatedCount} 只基金的经理信息`);
}

// 更新单只基金的详情（经理、费率、规模等）
async function updateFundDetail(code, detail) {
  const pool = getPool();
  const sets = [];
  const params = [];
  let idx = 1;

  if (detail.manager != null) { sets.push(`manager = $${idx++}`); params.push(detail.manager); }
  if (detail.managementFee != null) { sets.push(`management_fee = $${idx++}`); params.push(detail.managementFee); }
  if (detail.custodyFee != null) { sets.push(`custody_fee = $${idx++}`); params.push(detail.custodyFee); }
  if (detail.totalFee != null) { sets.push(`total_fee = $${idx++}`); params.push(detail.totalFee); }
  if (detail.scale != null) { sets.push(`scale = $${idx++}`); params.push(detail.scale); }
  if (detail.buySuggestion != null) { sets.push(`buy_suggestion = $${idx++}`); params.push(detail.buySuggestion); }
  if (detail.dailyLimit != null) { sets.push(`daily_limit = $${idx++}`); params.push(detail.dailyLimit); }

  if (sets.length === 0) return;
  sets.push('updated_at = NOW()');
  params.push(code);

  await pool.query(`UPDATE funds SET ${sets.join(', ')} WHERE code = $${idx}`, params);
}

// 获取所有基金经理列表（去重，按管理基金数量降序，含易方达）
async function getManagers() {
  const pool = getPool();
  const result = await pool.query(`
    SELECT manager, SUM(fund_count) as fund_count FROM (
      SELECT manager, COUNT(*) as fund_count
      FROM funds
      WHERE manager IS NOT NULL AND manager != ''
      GROUP BY manager
      UNION ALL
      SELECT fund_manager as manager, COUNT(*) as fund_count
      FROM yifangda_funds
      WHERE fund_manager IS NOT NULL AND fund_manager != ''
      GROUP BY fund_manager
    ) combined
    GROUP BY manager
    ORDER BY fund_count DESC
  `);
  return result.rows.map(r => ({ name: r.manager, fundCount: parseInt(r.fund_count) }));
}

async function getFundCount() {
  const pool = getPool();
  const result = await pool.query('SELECT COUNT(*) FROM funds');
  return parseInt(result.rows[0].count);
}

// ========== 沪深300基金详情 ==========

async function getHS300FundDetails() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM hs300_fund_details ORDER BY fund_code');
  return result.rows.map(row => ({
    code: row.fund_code,
    name: row.fund_name,
    type: row.fund_type,
    isEnhanced: row.is_enhanced,
    purchaseFee: parseFloat(row.purchase_fee) || 0,
    purchaseFeeOriginal: parseFloat(row.purchase_fee_original) || 0,
    alpha: parseFloat(row.alpha) || 0,
    managementFee: parseFloat(row.management_fee) || 0,
    custodyFee: parseFloat(row.custody_fee) || 0,
    totalFee: parseFloat(row.total_fee) || 0,
    scale: parseFloat(row.scale) || 0,
    rating: row.rating,
  }));
}

async function updateHS300FundDetail(code, data) {
  const pool = getPool();
  const query = `
    INSERT INTO hs300_fund_details (fund_code, fund_name, fund_type, is_enhanced, purchase_fee, purchase_fee_original, alpha, management_fee, custody_fee, total_fee, scale, rating, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (fund_code)
    DO UPDATE SET
      fund_name = EXCLUDED.fund_name,
      fund_type = EXCLUDED.fund_type,
      is_enhanced = EXCLUDED.is_enhanced,
      purchase_fee = EXCLUDED.purchase_fee,
      purchase_fee_original = EXCLUDED.purchase_fee_original,
      alpha = EXCLUDED.alpha,
      management_fee = EXCLUDED.management_fee,
      custody_fee = EXCLUDED.custody_fee,
      total_fee = EXCLUDED.total_fee,
      scale = EXCLUDED.scale,
      rating = EXCLUDED.rating,
      updated_at = NOW()
  `;
  await pool.query(query, [
    code, data.name, data.type, data.isEnhanced || false,
    data.purchaseFee || 0, data.purchaseFeeOriginal || 0, data.alpha || 0,
    data.managementFee || 0, data.custodyFee || 0, data.totalFee || 0,
    data.scale || 0, data.rating || 3,
  ]);
}

async function batchUpdateHS300FundDetails(funds) {
  let updatedCount = 0;
  for (const fund of funds) {
    try {
      await updateHS300FundDetail(fund.code, fund);
      updatedCount++;
    } catch (e) {
      logger.warn(`[HS300] 更新基金 ${fund.code} 详情失败:`, e.message);
    }
  }
  return updatedCount;
}

module.exports = {
  getAllFunds,
  getFundByCode,
  getFundsByType,
  getFundsByIndustry,
  getIndustries,
  getAllFundsWithNav,
  queryFundsForScoring,
  batchFetchReturns,
  updateFundNav,
  updateFundReturns,
  getLatestNav,
  getMarketIndices,
  updateMarketIndex,
  initMarketIndices,
  getSectorData,
  updateSectorData,
  seedFunds,
  updateFundManagers,
  updateFundDetail,
  getManagers,
  getFundCount,
  getHS300FundDetails,
  updateHS300FundDetail,
  batchUpdateHS300FundDetails,
};
