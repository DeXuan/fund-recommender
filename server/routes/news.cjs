/**
 * 新闻路由
 */

const express = require('express');
const logger = require('../utils/logger.cjs');
const { getPool } = require('../db.cjs');
const { authMiddleware, adminMiddleware } = require('../auth.cjs');
const { createHandler } = require('../utils/route-handler.cjs');

const router = express.Router();
const handler = createHandler('新闻');

// 获取新闻列表
router.get('/api/news', handler(async (req) => {
  const { getCachedNews } = require('../news-fetcher.cjs');
  const { category, impact, limit = 50 } = req.query;
  const news = getCachedNews();
  let items = news.items || [];
  if (category) items = items.filter(n => n.category === category);
  if (impact) items = items.filter(n => n.impact === impact);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit) || 50));
  return {
    items: items.slice(0, safeLimit),
    total: items.length,
    lastUpdate: news.lastUpdate,
    categories: news.categories,
  };
}));

// 获取新闻统计
router.get('/api/news/stats', handler(async () => {
  const { getCachedNews } = require('../news-fetcher.cjs');
  const news = getCachedNews();
  return {
    total: (news.items || []).length,
    categories: news.categories,
    lastUpdate: news.lastUpdate,
  };
}));

// 获取个人相关新闻
router.get('/api/news/personal', authMiddleware, handler(async (req) => {
  const { getCachedNews } = require('../news-fetcher.cjs');
  const pool = getPool();
  const news = getCachedNews();
  const items = news.items || [];

  const holdings = await pool.query(
    `SELECT DISTINCT fr.fund_code, fr.fund_name, f.industry FROM fund_records fr
     LEFT JOIN funds f ON fr.fund_code = f.code WHERE fr.user_id = $1 AND f.industry IS NOT NULL`,
    [req.user.id]
  );
  const watchlist = await pool.query(
    `SELECT w.fund_code, f.name as fund_name, f.industry FROM watchlist w
     LEFT JOIN funds f ON w.fund_code = f.code WHERE w.user_id = $1 AND f.industry IS NOT NULL`,
    [req.user.id]
  );

  const industries = new Set();
  const heldStockNames = new Set();
  holdings.rows.forEach(r => { if (r.industry) industries.add(r.industry); });
  watchlist.rows.forEach(r => { if (r.industry) industries.add(r.industry); });

  const personalNews = [];
  const seen = new Set();

  for (const item of items) {
    const text = ((item.title || '') + (item.summary || '')).toLowerCase();
    let matched = false, matchReason = '', relevance = 'low';

    if (item.industry && industries.has(item.industry)) {
      matched = true;
      const isHeld = holdings.rows.some(r => r.industry === item.industry);
      matchReason = isHeld ? `持仓行业「${item.industry}」相关` : `自选行业「${item.industry}」相关`;
      relevance = isHeld ? 'high' : 'medium';
    }

    if (!matched && item.industries) {
      let bestMatch = null;
      for (const ind of item.industries) {
        if (industries.has(ind)) {
          const isHeld = holdings.rows.some(r => r.industry === ind);
          const candidate = { industry: ind, isHeld, keyword: ind };
          if (!bestMatch || (isHeld && !bestMatch.isHeld) || (isHeld === bestMatch.isHeld && ind.length > bestMatch.keyword.length)) {
            bestMatch = candidate;
          }
        }
      }
      if (bestMatch) {
        matched = true;
        matchReason = bestMatch.isHeld ? `持仓行业「${bestMatch.industry}」相关` : `自选行业「${bestMatch.industry}」相关`;
        relevance = bestMatch.isHeld ? 'high' : 'medium';
      }
    }

    if (!matched && item.stocks) {
      for (const stock of item.stocks) {
        if (stock.name && heldStockNames.has(stock.name)) {
          matched = true;
          matchReason = `持仓重仓股「${stock.name}」相关`;
          relevance = 'high';
          break;
        }
      }
    }
    if (!matched) {
      for (const stockName of heldStockNames) {
        if (text.includes(stockName)) {
          matched = true;
          matchReason = `持仓重仓股「${stockName}」相关`;
          relevance = 'high';
          break;
        }
      }
    }

    if (matched && !seen.has(item.id)) {
      seen.add(item.id);
      personalNews.push({ ...item, matchReason, relevance });
    }
  }

  const relOrder = { high: 0, medium: 1, low: 2 };
  personalNews.sort((a, b) => {
    if (relOrder[a.relevance] !== relOrder[b.relevance]) return relOrder[a.relevance] - relOrder[b.relevance];
    return b.timestamp - a.timestamp;
  });

  return {
    items: personalNews, total: personalNews.length,
    holdings: holdings.rows.map(r => ({ code: r.fund_code, name: r.fund_name, industry: r.industry })),
    watchlist: watchlist.rows.map(r => ({ code: r.fund_code, name: r.fund_name, industry: r.industry })),
    matchedIndustries: [...industries],
  };
}));

// 手动刷新新闻
function createNewsRefreshRoute(fetchAllNews) {
  router.post('/api/news/refresh', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const result = await fetchAllNews();
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('刷新新闻失败:', error.message);
      res.status(500).json({ error: '刷新新闻失败' });
    }
  });
}

module.exports = { router, createNewsRefreshRoute };
