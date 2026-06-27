'use strict';

const express = require('express');
const logger = require('../utils/logger.cjs');
const { authMiddleware } = require('../auth.cjs');
const { getPool } = require('../db.cjs');

const router = express.Router();

// 获取自选列表
router.get('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT w.*, f.name as fund_name_db, f.type, f.industry, f.total_fee, f.scale, f.rating,
              n.nav, n.return_1y, n.return_6m, n.return_3m, n.return_1m, n.return_1w
       FROM watchlist w
       LEFT JOIN funds f ON w.fund_code = f.code
       LEFT JOIN LATERAL (
         SELECT nav, return_1y, return_6m, return_3m, return_1m, return_1w
         FROM fund_nav WHERE fund_code = w.fund_code ORDER BY nav_date DESC LIMIT 1
       ) n ON true
       WHERE w.user_id = $1
       ORDER BY w.sort_order, w.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      fund_code: r.fund_code,
      fund_name: r.fund_name || r.fund_name_db || '',
      group_name: r.group_name,
      notes: r.notes,
      created_at: r.created_at,
      type: r.type,
      industry: r.industry,
      total_fee: r.total_fee ? parseFloat(r.total_fee) : null,
      scale: r.scale ? parseFloat(r.scale) : null,
      rating: r.rating,
      nav: r.nav ? parseFloat(r.nav) : null,
      return1y: r.return_1y ? parseFloat(r.return_1y) : null,
      return6m: r.return_6m ? parseFloat(r.return_6m) : null,
      return3m: r.return_3m ? parseFloat(r.return_3m) : null,
      return1m: r.return_1m ? parseFloat(r.return_1m) : null,
      return1w: r.return_1w ? parseFloat(r.return_1w) : null,
    })));
  } catch (error) {
    logger.error('获取自选列表失败:', error.message);
    res.status(500).json({ error: '获取自选列表失败' });
  }
});

// 添加自选
router.post('/api/watchlist', authMiddleware, async (req, res) => {
  try {
    const { fund_code, fund_name, group_name } = req.body;
    if (!fund_code || !/^\d{6}$/.test(fund_code)) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO watchlist (user_id, fund_code, fund_name, group_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, fund_code) DO UPDATE SET fund_name = $3
       RETURNING *`,
      [req.user.id, fund_code, fund_name || '', group_name || '默认分组']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('添加自选失败:', error.message);
    res.status(500).json({ error: '添加自选失败' });
  }
});

// 删除自选
router.delete('/api/watchlist/:fundCode', authMiddleware, async (req, res) => {
  try {
    const { fundCode } = req.params;
    if (!/^\d{6}$/.test(fundCode)) {
      return res.status(400).json({ error: '基金代码格式不正确' });
    }
    const pool = getPool();
    await pool.query('DELETE FROM watchlist WHERE user_id = $1 AND fund_code = $2', [req.user.id, fundCode]);
    res.json({ success: true });
  } catch (error) {
    logger.error('删除自选失败:', error.message);
    res.status(500).json({ error: '删除自选失败' });
  }
});

// 批量检查自选状态
router.post('/api/watchlist/check', authMiddleware, async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes)) return res.json({});
    if (codes.length > 100) return res.status(400).json({ error: '单次查询不能超过100个基金代码' });
    const pool = getPool();
    const result = await pool.query(
      'SELECT fund_code FROM watchlist WHERE user_id = $1 AND fund_code = ANY($2)',
      [req.user.id, codes]
    );
    const watched = new Set(result.rows.map(r => r.fund_code));
    res.json(Object.fromEntries(codes.map(c => [c, watched.has(c)])));
  } catch (error) {
    res.status(500).json({ error: '检查自选状态失败' });
  }
});

module.exports = router;
