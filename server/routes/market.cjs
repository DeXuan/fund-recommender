/**
 * 市场数据路由 — 指数、板块、资金流向、估值中心、估值趋势
 */

const express = require('express');
const fundService = require('../fund-service.cjs');
const { isTradingHours } = require('../utils/trading-hours.cjs');
const { getCachedCapitalFlow } = require('../data-fetcher.cjs');
const { createHandler } = require('../utils/route-handler.cjs');

const router = express.Router();
const handler = createHandler('市场数据');

// 默认市场指数配置
const defaultIndices = [
  { code: '000300', name: '沪深300', valuation: '合理偏低', suggestion: '适合定投' },
  { code: '000905', name: '中证500', valuation: '合理偏低', suggestion: '适合定投' },
  { code: '399006', name: '创业板指', valuation: '合理', suggestion: '适合小额定投' },
  { code: '000688', name: '科创50', valuation: '合理偏高', suggestion: '建议观望' },
  { code: '000001', name: '上证指数', valuation: '合理', suggestion: '适合定投' },
];

// 获取市场指数数据
router.get('/api/market/indices', handler(async (req) => {
  let indices = await fundService.getMarketIndices();
  if (indices.length === 0) {
    await fundService.initMarketIndices(defaultIndices);
    indices = defaultIndices;
  }
  return {
    indices,
    lastUpdate: req.app.locals.dataUpdateStatus?.lastUpdateTime,
    isTrading: isTradingHours(),
  };
}));

// 估值中心（指数PE分位数据，供智能定投使用）
router.get('/api/market/valuation-center', handler(async () => {
  let indices = await fundService.getMarketIndices();
  if (indices.length === 0) {
    await fundService.initMarketIndices(defaultIndices);
    indices = defaultIndices;
  }
  return indices;
}));

// 获取板块轮动数据
router.get('/api/market/sectors', handler(async (req) => {
  const sectors = await fundService.getSectorData();
  return {
    sectors,
    lastUpdate: req.app.locals.dataUpdateStatus?.lastUpdateTime,
  };
}));

// 获取资金流向
router.get('/api/market/capital-flow', handler(async () => {
  return getCachedCapitalFlow();
}));

// 估值历史趋势 API — 从 index_valuation_history 表读取真实历史数据
router.get('/api/market/valuation-trend', handler(async () => {
  const { getPool } = require('../db.cjs');
  const pool = getPool();
  const indices = await fundService.getMarketIndices();

  const results = [];
  for (const idx of indices) {
    // 查询近12个月的历史估值数据
    const historyResult = await pool.query(
      `SELECT trade_date, pe, pb FROM index_valuation_history
       WHERE index_code = $1 AND pe IS NOT NULL
       ORDER BY trade_date DESC LIMIT 260`,
      [idx.code]
    );

    const rows = historyResult.rows.reverse();

    // 按月聚合：每月取最新一条
    const monthlyMap = new Map();
    for (const row of rows) {
      const monthKey = row.trade_date.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { pe: parseFloat(row.pe), pb: row.pb ? parseFloat(row.pb) : null });
      }
    }

    // 取最近12个月
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const data = monthlyMap.get(monthKey);

      // 计算分位数（基于截止到该月的历史数据）
      if (data) {
        const allPEBefore = rows
          .filter(r => r.trade_date.toISOString().slice(0, 7) <= monthKey)
          .map(r => parseFloat(r.pe))
          .filter(v => v > 0);
        const pePct = allPEBefore.length >= 5
          ? parseFloat(((allPEBefore.filter(v => v < data.pe).length / allPEBefore.length) * 100).toFixed(1))
          : null;

        months.push({
          month: monthKey,
          pe: data.pe,
          pb: data.pb,
          pe_percentile: pePct,
          pb_percentile: null, // PB分位同理可算
        });
      } else {
        months.push({
          month: monthKey,
          pe: null, pb: null,
          pe_percentile: null, pb_percentile: null,
        });
      }
    }

    results.push({
      name: idx.name,
      code: idx.code,
      current_valuation: idx.valuation,
      current_suggestion: idx.suggestion,
      months,
    });
  }

  return results;
}));

module.exports = { router, defaultIndices };
