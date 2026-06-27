/**
 * 基金相关路由 — 基金列表、详情、QDII、沪深300、易方达、金选基金
 */

const express = require('express');
const logger = require('../utils/logger.cjs');
const fundService = require('../fund-service.cjs');
const { getPool } = require('../db.cjs');
const { authMiddleware, adminMiddleware } = require('../auth.cjs');
const { createHandler } = require('../utils/route-handler.cjs');

const router = express.Router();
const handler = createHandler('基金');

// 获取基金列表（支持分页）
router.get('/api/funds', handler(async (req) => {
  const { industry, type, sort, order, search, page, pageSize } = req.query;
  return await fundService.getAllFundsWithNav({ industry, type, sort, order, search, page, pageSize });
}));

// 获取QDII基金数据
router.get('/api/funds/qdii', handler(async () => {
  const result = await fundService.getAllFundsWithNav({ type: 'QDII' });
  return result.data || result;
}));

// 获取沪深300基金
router.get('/api/funds/hs300', handler(async () => {
  const result = await fundService.getAllFundsWithNav({ industry: '沪深300' });
  return result.data || result;
}));

// 获取基金详情
router.get('/api/funds/:code', handler(async (req) => {
  const { code } = req.params;
  if (!/^\d{6}$/.test(code)) {
    const err = new Error('基金代码格式不正确');
    err.status = 400;
    throw err;
  }
  const result = await fundService.getAllFundsWithNav({ search: code });
  const funds = result.data || result;
  const fund = funds.find(f => f.code === code);
  if (!fund) {
    const err = new Error('基金不存在');
    err.status = 404;
    throw err;
  }
  return await getFundDetail(fund);
}));

// 获取基金详情（查询真实数据）
async function getFundDetail(fund) {
  const pool = getPool();

  let performanceHistory = [];
  try {
    const navRes = await pool.query(
      `SELECT nav, nav_date FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 180`,
      [fund.code]
    );
    if (navRes.rows.length > 0) {
      const navs = navRes.rows.reverse();
      const monthly = {};
      navs.forEach(r => {
        const month = r.nav_date.toISOString().slice(0, 7);
        if (!monthly[month]) monthly[month] = { start: parseFloat(r.nav), end: parseFloat(r.nav) };
        monthly[month].end = parseFloat(r.nav);
      });
      performanceHistory = Object.entries(monthly).map(([date, data]) => ({
        date,
        nav: parseFloat(data.end.toFixed(4)),
        return: parseFloat(((data.end - data.start) / data.start * 100).toFixed(2)),
      })).slice(-6);
    }
  } catch (e) {
    logger.error(`获取基金 ${fund.code} 净值历史失败:`, e.message);
  }

  const getValuationCode = (valuation) => {
    if (!valuation) return 'reasonable';
    if (valuation.includes('极低') || valuation.includes('很低')) return 'very_low';
    if (valuation.includes('低估') || valuation.includes('偏低')) return 'low';
    if (valuation.includes('合理') && !valuation.includes('偏')) return 'reasonable';
    if (valuation.includes('偏高') || valuation.includes('高估')) return 'high';
    if (valuation.includes('极高')) return 'very_high';
    return 'reasonable';
  };

  const return1y = fund.return1y || 0;

  return {
    ...fund,
    fullName: `${fund.name} (${fund.code})`,
    fundManager: fund.manager || null,
    managementFee: fund.managementFee || 0,
    custodyFee: fund.custodyFee || 0,
    serviceFee: fund.serviceFee || 0,
    totalFee: fund.totalFee || 0,
    purchaseStatus: fund.dailyLimit && fund.dailyLimit < 0 ? 'suspended' :
                   fund.dailyLimit && fund.dailyLimit > 0 ? 'limited' : 'open',
    dailyLimit: fund.dailyLimit || 0,
    rating: fund.rating || 3,
    recommendation: fund.logic || null,
    riskLevel: return1y > 20 ? 'high' : return1y > 0 ? 'medium' : 'high',
    pe: null, pb: null, pePercentile: null, pbPercentile: null,
    valuation: getValuationCode(fund.valuation),
    topHoldings: null,
    performanceHistory,
    investmentAdvice: return1y > 30 ? '该基金近期表现优异，但估值偏高，建议分批买入或定投配置。' :
                     return1y > 10 ? '该基金表现稳健，适合长期持有，建议定投配置。' :
                     return1y > 0 ? '该基金表现一般，可适当配置，建议观察后续走势。' :
                     '该基金近期表现不佳，但估值处于低位，可考虑左侧布局。',
    suitableFor: return1y > 20 ? '激进型投资者' : return1y > 0 ? '稳健型投资者' : '保守型投资者',
  };
}

// 获取易方达基金数据
router.get('/api/yifangda-funds', handler(async (req) => {
  const pool = getPool();
  const { search, sort = 'return_1y', order = 'desc', manager, page = 1, pageSize = 50 } = req.query;
  const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 50));
  const safePage = Math.max(1, parseInt(page) || 1);

  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(fund_code ILIKE $${idx} OR fund_name ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (manager) {
    conditions.push(`fund_manager = $${idx}`);
    params.push(manager);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await pool.query(`SELECT COUNT(*) FROM yifangda_funds ${where}`, params);
  const total = parseInt(countResult.rows[0].count);

  const sortMap = {
    'fund_code': 'fund_code', 'fund_name': 'fund_name', 'unit_nav': 'unit_nav',
    'return_1m': 'return_1m', 'return_3m': 'return_3m', 'return_6m': 'return_6m',
    'return_1y': 'return_1y', 'scale': 'scale', 'fund_manager': 'fund_manager',
  };
  const sortCol = sortMap[sort] || 'return_1y';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (safePage - 1) * safePageSize;

  const dataResult = await pool.query(
    `SELECT fund_code, fund_name, fund_manager, unit_nav, nav_date,
            return_1w, return_1m, return_3m, return_6m, return_1y, scale, updated_at
     FROM yifangda_funds ${where}
     ORDER BY ${sortCol} ${sortOrder} NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, safePageSize, offset]
  );

  const managersResult = await pool.query(
    `SELECT DISTINCT fund_manager, COUNT(*) as cnt
     FROM yifangda_funds WHERE fund_manager != ''
     GROUP BY fund_manager ORDER BY cnt DESC LIMIT 30`
  );

  return {
    data: dataResult.rows.map(r => ({
      fund_code: r.fund_code, fund_name: r.fund_name, fund_manager: r.fund_manager,
      unit_nav: r.unit_nav ? parseFloat(r.unit_nav) : null, nav_date: r.nav_date,
      return_1w: r.return_1w ? parseFloat(r.return_1w) : null,
      return_1m: r.return_1m ? parseFloat(r.return_1m) : null,
      return_3m: r.return_3m ? parseFloat(r.return_3m) : null,
      return_6m: r.return_6m ? parseFloat(r.return_6m) : null,
      return_1y: r.return_1y ? parseFloat(r.return_1y) : null,
      scale: r.scale ? parseFloat(r.scale) : null, updated_at: r.updated_at,
    })),
    total, page: safePage, pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
    managers: managersResult.rows.map(r => ({ name: r.fund_manager, count: parseInt(r.cnt) })),
  };
}));

// 获取金选基金列表
router.get('/api/gold-funds', handler(async (req) => {
  const pool = getPool();
  const {
    category, industry, search, manager,
    sort = 'return_1y', order = 'desc',
    page = 1, pageSize = 100,
    minReturn, maxFee, minScale,
  } = req.query;
  const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 100));
  const safePage = Math.max(1, parseInt(page) || 1);

  const conditions = ['f.is_gold_selected = true'];
  const params = [];
  let idx = 1;

  if (category) { conditions.push(`f.industry = $${idx++}`); params.push(category); }
  if (industry) { conditions.push(`f.industry = $${idx++}`); params.push(industry); }
  if (search) { conditions.push(`(f.code ILIKE $${idx} OR f.name ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
  if (manager) { conditions.push(`f.manager = $${idx++}`); params.push(manager); }
  if (minReturn) { conditions.push(`n.return_1y >= $${idx++}`); params.push(parseFloat(minReturn)); }
  if (maxFee) { conditions.push(`f.total_fee <= $${idx++}`); params.push(parseFloat(maxFee)); }
  if (minScale) { conditions.push(`f.scale >= $${idx++}`); params.push(parseFloat(minScale)); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortMap = {
    'return_1y': 'n.return_1y', 'return_6m': 'n.return_6m', 'return_3m': 'n.return_3m',
    'return_1m': 'n.return_1m', 'return_1w': 'n.return_1w', 'total_fee': 'f.total_fee',
    'scale': 'f.scale', 'rating': 'f.rating', 'nav': 'n.nav', 'name': 'f.name', 'code': 'f.code',
  };
  const sortCol = sortMap[sort] || 'n.return_1y';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM funds f LEFT JOIN LATERAL (
      SELECT return_1y FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
    ) n ON true ${where}`, params
  );
  const total = parseInt(countResult.rows[0].count);
  const offset = (safePage - 1) * safePageSize;

  const dataResult = await pool.query(
    `SELECT f.code, f.name, f.type, f.industry, f.index_name,
            f.management_fee, f.custody_fee, f.service_fee, f.total_fee,
            f.scale, f.rating, f.buy_suggestion, f.daily_limit, f.manager,
            f.valuation, f.trend, f.logic,
            n.nav, n.total_nav, n.nav_date,
            n.return_1w, n.return_1m, n.return_3m, n.return_6m, n.return_1y
     FROM funds f
     LEFT JOIN LATERAL (
       SELECT nav, total_nav, nav_date, return_1w, return_1m, return_3m, return_6m, return_1y
       FROM fund_nav WHERE fund_code = f.code
       ORDER BY return_1y IS NOT NULL DESC, nav_date DESC LIMIT 1
     ) n ON true
     ${where}
     ORDER BY ${sortCol} ${sortOrder} NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, safePageSize, offset]
  );

  const categoryResult = await pool.query(
    `SELECT industry, COUNT(*) as cnt FROM funds WHERE is_gold_selected = true GROUP BY industry ORDER BY cnt DESC`
  );
  const managerResult = await pool.query(
    `SELECT manager, COUNT(*) as cnt FROM funds
     WHERE is_gold_selected = true AND manager IS NOT NULL AND manager != ''
     GROUP BY manager ORDER BY cnt DESC LIMIT 20`
  );

  return {
    data: dataResult.rows.map(r => ({
      code: r.code, name: r.name, type: r.type, industry: r.industry, index: r.index_name,
      managementFee: parseFloat(r.management_fee) || 0, custodyFee: parseFloat(r.custody_fee) || 0,
      serviceFee: parseFloat(r.service_fee) || 0, totalFee: parseFloat(r.total_fee) || 0,
      scale: parseFloat(r.scale) || 0, rating: r.rating, buySuggestion: r.buy_suggestion,
      dailyLimit: r.daily_limit, manager: r.manager, valuation: r.valuation, trend: r.trend,
      logic: r.logic, isGoldSelected: true,
      nav: r.nav ? parseFloat(r.nav) : null, navDate: r.nav_date,
      return1w: r.return_1w ? parseFloat(r.return_1w) : null,
      return1m: r.return_1m ? parseFloat(r.return_1m) : null,
      return3m: r.return_3m ? parseFloat(r.return_3m) : null,
      return6m: r.return_6m ? parseFloat(r.return_6m) : null,
      return1y: r.return_1y ? parseFloat(r.return_1y) : null,
    })),
    total, page: safePage, pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
    categories: categoryResult.rows.map(r => ({ name: r.industry, count: parseInt(r.cnt) })),
    managers: managerResult.rows.map(r => ({ name: r.manager, count: parseInt(r.cnt) })),
  };
}));

// 金选基金统计概览
router.get('/api/gold-funds/stats', handler(async () => {
  const pool = getPool();

  const countResult = await pool.query("SELECT COUNT(*) as total FROM funds WHERE is_gold_selected = true");
  const categoryResult = await pool.query(
    `SELECT industry, COUNT(*) as cnt, AVG(f.scale) as avg_scale, AVG(f.total_fee) as avg_fee
     FROM funds f WHERE f.is_gold_selected = true GROUP BY industry ORDER BY cnt DESC`
  );
  const returnResult = await pool.query(
    `SELECT AVG(n.return_1y) as avg_return_1y, AVG(n.return_6m) as avg_return_6m,
            AVG(n.return_3m) as avg_return_3m, MAX(n.return_1y) as max_return_1y, MIN(n.return_1y) as min_return_1y
     FROM funds f LEFT JOIN LATERAL (
       SELECT return_1y, return_6m, return_3m FROM fund_nav WHERE fund_code = f.code ORDER BY nav_date DESC LIMIT 1
     ) n ON true WHERE f.is_gold_selected = true`
  );
  const feeResult = await pool.query(
    `SELECT AVG(total_fee) as avg_fee, MIN(total_fee) as min_fee, MAX(total_fee) as max_fee
     FROM funds WHERE is_gold_selected = true`
  );
  const scaleResult = await pool.query(
    `SELECT SUM(scale) as total_scale, AVG(scale) as avg_scale, MAX(scale) as max_scale
     FROM funds WHERE is_gold_selected = true`
  );

  const stats = returnResult.rows[0];
  const fee = feeResult.rows[0];
  const scale = scaleResult.rows[0];

  return {
    total: parseInt(countResult.rows[0].total),
    categories: categoryResult.rows.map(r => ({
      name: r.industry, count: parseInt(r.cnt),
      avgScale: r.avg_scale ? parseFloat(r.avg_scale).toFixed(2) : '0',
      avgFee: r.avg_fee ? parseFloat(r.avg_fee).toFixed(4) : '0',
    })),
    returns: {
      avg1y: stats.avg_return_1y ? parseFloat(stats.avg_return_1y).toFixed(2) : null,
      avg6m: stats.avg_return_6m ? parseFloat(stats.avg_return_6m).toFixed(2) : null,
      avg3m: stats.avg_return_3m ? parseFloat(stats.avg_return_3m).toFixed(2) : null,
      max1y: stats.max_return_1y ? parseFloat(stats.max_return_1y).toFixed(2) : null,
      min1y: stats.min_return_1y ? parseFloat(stats.min_return_1y).toFixed(2) : null,
    },
    fees: {
      avg: fee.avg_fee ? parseFloat(fee.avg_fee).toFixed(4) : null,
      min: fee.min_fee ? parseFloat(fee.min_fee).toFixed(4) : null,
      max: fee.max_fee ? parseFloat(fee.max_fee).toFixed(4) : null,
    },
    scale: {
      total: scale.total_scale ? parseFloat(scale.total_scale).toFixed(2) : '0',
      avg: scale.avg_scale ? parseFloat(scale.avg_scale).toFixed(2) : '0',
      max: scale.max_scale ? parseFloat(scale.max_scale).toFixed(2) : '0',
    },
  };
}));

// 获取行业列表
router.get('/api/industries', handler(async () => {
  return await fundService.getIndustries();
}));

// 获取基金经理列表
router.get('/api/managers', handler(async () => {
  return await fundService.getManagers();
}));

// 获取明星基金经理详情
router.get('/api/star-managers', handler(async () => {
  const { starManagers } = require('../fund-data.cjs');
  return starManagers;
}));

// POST /api/funds/fetch-yifangda — 管理员触发易方达数据更新
function createYiFangDaRoute(fetchYiFangDaFundData) {
  router.post('/api/funds/fetch-yifangda', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await fetchYiFangDaFundData();
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('获取易方达基金数据失败:', error.message);
      res.status(500).json({ error: '获取失败: ' + error.message });
    }
  });
}

// POST /api/funds/fetch-gold — 管理员触发金选基金数据更新
function createGoldFundRoute(fetchGoldFundData) {
  router.post('/api/funds/fetch-gold', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await fetchGoldFundData();
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('抓取金选基金数据失败:', error.message);
      res.status(500).json({ error: '抓取失败: ' + error.message });
    }
  });
}

module.exports = { router, createYiFangDaRoute, createGoldFundRoute };
