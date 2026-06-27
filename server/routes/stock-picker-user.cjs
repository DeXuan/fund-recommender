const express = require('express');
const router = express.Router();
const { getPool } = require('../db.cjs');
const { authMiddleware, subscriptionMiddleware } = require('../auth.cjs');
const logger = require('../utils/logger.cjs');

router.use(authMiddleware);
router.use(subscriptionMiddleware);

// ======================== 保存的筛选方案 ========================

// GET /api/stock-picker/screeners
router.get('/api/stock-picker/screeners', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM saved_screeners WHERE user_id = $1 ORDER BY is_default DESC, updated_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(`获取筛选方案失败: ${error.message}`);
    res.status(500).json({ error: '获取筛选方案失败' });
  }
});

// POST /api/stock-picker/screeners
router.post('/api/stock-picker/screeners', async (req, res) => {
  try {
    const { name, description, filters, is_default } = req.body;
    if (!name || !filters) return res.status(400).json({ error: '名称和筛选条件不能为空' });
    const pool = getPool();
    if (is_default) {
      await pool.query('UPDATE saved_screeners SET is_default = false WHERE user_id = $1', [req.user.id]);
    }
    const result = await pool.query(
      'INSERT INTO saved_screeners (user_id, name, description, filters, is_default) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, name, description || '', JSON.stringify(filters), is_default || false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`保存筛选方案失败: ${error.message}`);
    res.status(500).json({ error: '保存筛选方案失败' });
  }
});

// PUT /api/stock-picker/screeners/:id
router.put('/api/stock-picker/screeners/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const { name, description, filters, is_default } = req.body;
    const pool = getPool();
    const existing = await pool.query('SELECT id FROM saved_screeners WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: '方案不存在' });
    if (is_default) {
      await pool.query('UPDATE saved_screeners SET is_default = false WHERE user_id = $1', [req.user.id]);
    }
    const result = await pool.query(
      'UPDATE saved_screeners SET name = COALESCE($1, name), description = COALESCE($2, description), filters = COALESCE($3, filters), is_default = COALESCE($4, is_default), updated_at = NOW() WHERE id = $5 AND user_id = $6 RETURNING *',
      [name, description, filters ? JSON.stringify(filters) : null, is_default, id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`更新筛选方案失败: ${error.message}`);
    res.status(500).json({ error: '更新筛选方案失败' });
  }
});

// DELETE /api/stock-picker/screeners/:id
router.delete('/api/stock-picker/screeners/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const pool = getPool();
    await pool.query('DELETE FROM saved_screeners WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error(`删除筛选方案失败: ${error.message}`);
    res.status(500).json({ error: '删除筛选方案失败' });
  }
});

// ======================== 选股历史 ========================

// GET /api/stock-picker/history
router.get('/api/stock-picker/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const pool = getPool();
    const [dataResult, countResult] = await Promise.all([
      pool.query(
        'SELECT * FROM stock_pick_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [req.user.id, pageSize, offset]
      ),
      pool.query('SELECT COUNT(*) FROM stock_pick_history WHERE user_id = $1', [req.user.id])
    ]);
    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page, pageSize,
      hasMore: offset + pageSize < parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    logger.error(`获取选股历史失败: ${error.message}`);
    res.status(500).json({ error: '获取选股历史失败' });
  }
});

// POST /api/stock-picker/history
router.post('/api/stock-picker/history', async (req, res) => {
  try {
    const { strategy, filters, results, screener_id } = req.body;
    if (!results || !Array.isArray(results)) return res.status(400).json({ error: '结果数据无效' });
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO stock_pick_history (user_id, screener_id, strategy, filters, results, result_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, screener_id || null, strategy || 'balanced', JSON.stringify(filters || {}), JSON.stringify(results.slice(0, 50)), results.length]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`保存选股历史失败: ${error.message}`);
    res.status(500).json({ error: '保存选股历史失败' });
  }
});

// ======================== 保存的投资组合 ========================

// GET /api/stock-picker/portfolios
router.get('/api/stock-picker/portfolios', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM saved_portfolios WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    logger.error(`获取保存的组合失败: ${error.message}`);
    res.status(500).json({ error: '获取保存的组合失败' });
  }
});

// POST /api/stock-picker/portfolios
router.post('/api/stock-picker/portfolios', async (req, res) => {
  try {
    const { name, description, strategy, budget, allocation, backtest_summary } = req.body;
    if (!name || !allocation) return res.status(400).json({ error: '名称和配置不能为空' });
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO saved_portfolios (user_id, name, description, strategy, budget, allocation, backtest_summary) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.user.id, name, description || '', strategy || 'balanced', budget || 0, JSON.stringify(allocation), backtest_summary ? JSON.stringify(backtest_summary) : null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    logger.error(`保存组合失败: ${error.message}`);
    res.status(500).json({ error: '保存组合失败' });
  }
});

// DELETE /api/stock-picker/portfolios/:id
router.delete('/api/stock-picker/portfolios/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ error: '无效的ID' });
    const pool = getPool();
    await pool.query('DELETE FROM saved_portfolios WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    logger.error(`删除组合失败: ${error.message}`);
    res.status(500).json({ error: '删除组合失败' });
  }
});

// ======================== CSV导出 ========================

// POST /api/stock-picker/export/csv
router.post('/api/stock-picker/export/csv', async (req, res) => {
  try {
    const { results } = req.body;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: '没有可导出的数据' });
    }
    const headers = ['排名', '基金代码', '基金名称', '行业', '综合评分', '评级', '收益因子', '费率因子', '规模因子', '动量因子', '估值得分', '近1年收益(%)', '费率(%)', '规模(亿)', '基金经理', '推荐理由'];
    const rows = results.map((r, i) => {
      const f = r.fund || r;
      const b = r.breakdown || {};
      return [
        i + 1,
        f.code || '',
        (f.name || '').replace(/,/g, '，'),
        f.industry || '',
        r.score?.toFixed(1) || '',
        r.rating?.grade || '',
        (b.return1y * 100)?.toFixed(1) || '',
        (b.fee * 100)?.toFixed(1) || '',
        (b.scale * 100)?.toFixed(1) || '',
        (b.momentum * 100)?.toFixed(1) || '',
        (b.valuation * 100)?.toFixed(1) || '',
        f.return1y?.toFixed(2) || '',
        f.totalFee?.toFixed(2) || '',
        f.scale?.toFixed(2) || '',
        (f.manager || '').replace(/,/g, '，'),
        (r.reasoning || '').replace(/,/g, '，').replace(/\n/g, ' ')
      ].join(',');
    });
    const csv = '﻿' + headers.join(',') + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_picks_' + new Date().toISOString().slice(0, 10) + '.csv');
    res.send(csv);
  } catch (error) {
    logger.error(`CSV导出失败: ${error.message}`);
    res.status(500).json({ error: '导出失败' });
  }
});

module.exports = router;
