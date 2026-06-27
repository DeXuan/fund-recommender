'use strict';

const express = require('express');
const logger = require('../../utils/logger.cjs');
const router = express.Router();
const { getPool } = require('../../db.cjs');
const { authMiddleware } = require('../../auth.cjs');

// All routes require authentication
router.use(authMiddleware);

// GET /api/portfolio/asset-accounts - List all accounts for user
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM asset_accounts WHERE user_id = $1 AND is_active = true ORDER BY sort_order, id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('获取资产账户失败:', err);
    res.status(500).json({ error: '获取资产账户失败' });
  }
});

// GET /api/portfolio/asset-accounts/summary - Get summary by account type
router.get('/summary', async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT account_type,
              COUNT(*) as count,
              SUM(balance) as total_balance,
              SUM(cost_basis) as total_cost,
              SUM(balance - cost_basis) as total_pnl
       FROM asset_accounts
       WHERE user_id = $1 AND is_active = true
       GROUP BY account_type
       ORDER BY total_balance DESC`,
      [req.user.id]
    );

    const totalResult = await pool.query(
      `SELECT SUM(balance) as total_assets, SUM(cost_basis) as total_cost, SUM(balance - cost_basis) as total_pnl
       FROM asset_accounts WHERE user_id = $1 AND is_active = true`,
      [req.user.id]
    );

    res.json({
      byType: result.rows,
      total: totalResult.rows[0] || { total_assets: 0, total_cost: 0, total_pnl: 0 },
    });
  } catch (err) {
    logger.error('获取资产汇总失败:', err);
    res.status(500).json({ error: '获取资产汇总失败' });
  }
});

// POST /api/portfolio/asset-accounts - Create new account
router.post('/', async (req, res) => {
  try {
    const { account_type, account_name, balance, cost_basis, currency, icon, color, notes } = req.body;
    if (!account_type || !account_name) {
      return res.status(400).json({ error: '账户类型和名称为必填' });
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO asset_accounts (user_id, account_type, account_name, balance, cost_basis, currency, icon, color, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, account_type, account_name, balance || 0, cost_basis || 0, currency || 'CNY', icon || '💰', color || '#1677ff', notes || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('创建资产账户失败:', err);
    res.status(500).json({ error: '创建资产账户失败' });
  }
});

// PUT /api/portfolio/asset-accounts/:id - Update account
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { account_name, balance, cost_basis, currency, icon, color, notes, sort_order } = req.body;

    const pool = getPool();
    const result = await pool.query(
      `UPDATE asset_accounts SET
        account_name = COALESCE($1, account_name),
        balance = COALESCE($2, balance),
        cost_basis = COALESCE($3, cost_basis),
        currency = COALESCE($4, currency),
        icon = COALESCE($5, icon),
        color = COALESCE($6, color),
        notes = COALESCE($7, notes),
        sort_order = COALESCE($8, sort_order),
        updated_at = NOW()
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [account_name, balance, cost_basis, currency, icon, color, notes, sort_order, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '账户不存在' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    logger.error('更新资产账户失败:', err);
    res.status(500).json({ error: '更新资产账户失败' });
  }
});

// DELETE /api/portfolio/asset-accounts/:id - Soft delete account
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();
    const result = await pool.query(
      `UPDATE asset_accounts SET is_active = false, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '账户不存在' });
    }
    res.json({ message: '账户已删除', id: result.rows[0].id });
  } catch (err) {
    logger.error('删除资产账户失败:', err);
    res.status(500).json({ error: '删除资产账户失败' });
  }
});

module.exports = router;
