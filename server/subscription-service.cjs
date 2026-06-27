'use strict';

const { getPool } = require('./db.cjs');

/**
 * 创建订阅订单
 */
async function createOrder(userId, planId) {
  const pool = getPool();
  const plan = await pool.query('SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true', [planId]);
  if (plan.rows.length === 0) {
    throw new Error('套餐不存在或已下架');
  }
  const { price, name } = plan.rows[0];
  const outTradeNo = `SUB_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const result = await pool.query(
    `INSERT INTO subscription_orders (user_id, plan_id, out_trade_no, amount, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [userId, planId, outTradeNo, price]
  );
  return { ...result.rows[0], plan_name: name };
}

/**
 * 获取用户当前订阅状态
 */
async function getActiveSubscription(userId, role) {
  const pool = getPool();
  // 管理员直接返回会员状态
  if (role === 'admin') return { isPremium: true, expiresAt: '2099-12-31', planName: '管理员', daysRemaining: 9999 };
  const result = await pool.query(
    `SELECT subscription_status, subscription_end, subscription_plan_id, subscription_tier FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) return { isPremium: false, tier: 'free' };
  const { subscription_status, subscription_end, subscription_plan_id, subscription_tier } = result.rows[0];
  const tier = subscription_tier || 'free';
  // 兼容旧版 premium 状态 + 新版 tier 字段
  const hasLegacyPremium = subscription_status === 'premium' && subscription_end && new Date(subscription_end) > new Date();
  const hasTierPremium = tier === 'premium' || tier === 'svip';
  const isPremium = hasLegacyPremium || hasTierPremium;
  let planName = null;
  if (isPremium && subscription_plan_id) {
    const plan = await pool.query('SELECT name FROM subscription_plans WHERE id = $1', [subscription_plan_id]);
    planName = plan.rows[0]?.name || null;
  }
  return {
    isPremium,
    tier,
    expiresAt: subscription_end,
    planName,
    daysRemaining: isPremium ? Math.ceil((new Date(subscription_end) - new Date()) / 86400000) : 0,
  };
}

/**
 * 支付成功后激活订阅
 */
async function activateSubscription(userId, orderId) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT * FROM subscription_orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
    if (order.rows.length === 0) throw new Error('订单不存在');
    if (order.rows[0].status === 'paid') {
      await client.query('COMMIT');
      return { success: true, alreadyPaid: true };
    }
    const plan = await client.query('SELECT duration_days FROM subscription_plans WHERE id = $1', [order.rows[0].plan_id]);
    const days = plan.rows[0]?.duration_days || 30;
    const now = new Date();
    // 若当前会员未过期，从到期日续费；否则从当前开始
    const currentUser = await client.query('SELECT subscription_end FROM users WHERE id = $1', [userId]);
    const currentEnd = currentUser.rows[0]?.subscription_end;
    const baseDate = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
    const end = new Date(baseDate.getTime() + days * 86400000);
    await client.query(
      `UPDATE users SET subscription_status = 'premium', subscription_plan_id = $1, subscription_start = $2, subscription_end = $3 WHERE id = $4`,
      [order.rows[0].plan_id, now, end, userId]
    );
    await client.query(
      `UPDATE subscription_orders SET status = 'paid', paid_at = $1, updated_at = NOW() WHERE id = $2`,
      [now, orderId]
    );
    await client.query('COMMIT');
    return { success: true, expiresAt: end };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 通过外部交易号激活（支付宝回调用）
 */
async function activateByTradeNo(outTradeNo, tradeNo) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT * FROM subscription_orders WHERE out_trade_no = $1', [outTradeNo]);
    if (order.rows.length === 0) throw new Error('订单不存在');
    if (order.rows[0].status === 'paid') { await client.query('COMMIT'); return { success: true, alreadyPaid: true }; }
    const plan = await client.query('SELECT duration_days FROM subscription_plans WHERE id = $1', [order.rows[0].plan_id]);
    const days = plan.rows[0]?.duration_days || 30;
    const now = new Date();
    // 若当前会员未过期，从到期日续费；否则从当前开始
    const currentUser = await client.query('SELECT subscription_end FROM users WHERE id = $1', [order.rows[0].user_id]);
    const currentEnd = currentUser.rows[0]?.subscription_end;
    const baseDate = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
    const end = new Date(baseDate.getTime() + days * 86400000);
    await client.query(
      `UPDATE users SET subscription_status = 'premium', subscription_plan_id = $1, subscription_start = $2, subscription_end = $3 WHERE id = $4`,
      [order.rows[0].plan_id, now, end, order.rows[0].user_id]
    );
    await client.query(
      `UPDATE subscription_orders SET status = 'paid', trade_no = $1, paid_at = $2, updated_at = NOW() WHERE out_trade_no = $3`,
      [tradeNo, now, outTradeNo]
    );
    await client.query('COMMIT');
    return { success: true, expiresAt: end };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 获取所有活跃套餐
 */
async function getPlans() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price');
  return result.rows;
}

/**
 * 获取用户订单历史
 */
async function getOrdersByUser(userId, limit = 20) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT o.*, p.name as plan_name FROM subscription_orders o
     JOIN subscription_plans p ON o.plan_id = p.id
     WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

module.exports = { createOrder, getActiveSubscription, activateSubscription, activateByTradeNo, getPlans, getOrdersByUser };
