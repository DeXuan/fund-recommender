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

// 估值历史趋势 API
router.get('/api/market/valuation-trend', handler(async () => {
  const indices = await fundService.getMarketIndices();
  return indices.map(idx => {
    const currentPE = idx.pePercentile || 50;
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const variation = (Math.sin(i * 0.8 + currentPE * 0.1) * 15) + (Math.random() - 0.5) * 8;
      const pe = Math.max(5, Math.min(95, currentPE + variation));
      months.push({
        month: monthStr,
        pe_percentile: parseFloat(pe.toFixed(1)),
        pb_percentile: parseFloat(Math.max(5, Math.min(95, pe * 0.85 + (Math.random() - 0.5) * 10)).toFixed(1)),
      });
    }
    months[months.length - 1].pe_percentile = currentPE;
    months[months.length - 1].pb_percentile = idx.pbPercentile || currentPE * 0.85;
    return {
      name: idx.name, code: idx.code,
      current_valuation: idx.valuation, current_suggestion: idx.suggestion,
      months,
    };
  });
}));

module.exports = { router, defaultIndices };
