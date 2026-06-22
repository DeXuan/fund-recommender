'use strict';

const express = require('express');
const QRCode = require('qrcode');
const { authMiddleware } = require('../auth.cjs');
const subService = require('../subscription-service.cjs');
const { createPayment, queryPayment, verifyNotification } = require('../utils/alipay.cjs');

const router = express.Router();

// GET /api/subscription/plans — 公开
router.get('/api/subscription/plans', async (req, res) => {
  try {
    const plans = await subService.getPlans();
    res.json({ plans });
  } catch (e) {
    console.error('获取套餐失败:', e.message);
    res.status(500).json({ error: '获取套餐失败' });
  }
});

// Rate limiting for order creation (5 per minute per user)
const orderRateLimit = new Map();
function checkOrderRateLimit(userId) {
  const now = Date.now();
  const record = orderRateLimit.get(userId) || { count: 0, resetTime: now + 60000 };
  if (now > record.resetTime) { record.count = 0; record.resetTime = now + 60000; }
  record.count++;
  orderRateLimit.set(userId, record);
  return record.count <= 5;
}
setInterval(() => { const now = Date.now(); for (const [uid, r] of orderRateLimit) { if (now > r.resetTime + 60000) orderRateLimit.delete(uid); } }, 5 * 60 * 1000);

// POST /api/subscription/create-order — 需登录
router.post('/api/subscription/create-order', authMiddleware, async (req, res) => {
  if (!checkOrderRateLimit(req.user.id)) return res.status(429).json({ error: '创建订单过于频繁，请稍后再试' });
  try {
    const planId = req.body.planId || 1;
    const order = await subService.createOrder(req.user.id, planId);

    // 调用支付宝创建二维码
    let qrCodeUrl = '';
    let qrCodeBase64 = '';
    try {
      const alipayRes = await createPayment(order.out_trade_no, order.amount, `基金推荐助手-${order.plan_name}`);
      const precreateRes = alipayRes.alipay_trade_precreate_response || alipayRes;
      if (precreateRes.code === '10000' && precreateRes.qrCode) {
        qrCodeUrl = precreateRes.qrCode;
        qrCodeBase64 = await QRCode.toDataURL(qrCodeUrl, { width: 280, margin: 1 });
      }
    } catch (payErr) {
      console.warn('支付宝预创建失败:', payErr.message);
    }

    res.json({
      orderId: order.id,
      outTradeNo: order.out_trade_no,
      amount: order.amount,
      planName: order.plan_name,
      qrCodeUrl,
      qrCodeBase64,
    });
  } catch (e) {
    console.error('创建订单失败:', e.message);
    res.status(500).json({ error: e.message || '创建订单失败' });
  }
});

// GET /api/subscription/status — 需登录
router.get('/api/subscription/status', authMiddleware, async (req, res) => {
  try {
    const status = await subService.getActiveSubscription(req.user.id, req.user.role);
    res.json(status);
  } catch (e) {
    console.error('获取订阅状态失败:', e.message);
    res.status(500).json({ error: '获取订阅状态失败' });
  }
});

// Rate limiting for order polling (30 per minute per user)
const checkRateLimit = new Map();
function checkPollRateLimit(userId) {
  const now = Date.now();
  const record = checkRateLimit.get(userId) || { count: 0, resetTime: now + 60000 };
  if (now > record.resetTime) { record.count = 0; record.resetTime = now + 60000; }
  record.count++;
  checkRateLimit.set(userId, record);
  return record.count <= 30;
}
setInterval(() => { const now = Date.now(); for (const [uid, r] of checkRateLimit) { if (now > r.resetTime + 60000) checkRateLimit.delete(uid); } }, 5 * 60 * 1000);

// POST /api/subscription/check-order — 需登录，轮询支付结果
router.post('/api/subscription/check-order', authMiddleware, async (req, res) => {
  if (!checkPollRateLimit(req.user.id)) return res.status(429).json({ error: '查询过于频繁，请稍后再试' });
  try {
    const { outTradeNo } = req.body;
    if (!outTradeNo) return res.status(400).json({ error: '缺少订单号' });

    // 先查本地状态
    const pool = require('../db.cjs').getPool();
    const local = await pool.query('SELECT status FROM subscription_orders WHERE out_trade_no = $1 AND user_id = $2', [outTradeNo, req.user.id]);
    if (local.rows.length > 0 && local.rows[0].status === 'paid') {
      return res.json({ paid: true });
    }

    // 查支付宝
    try {
      const alipayRes = await queryPayment(outTradeNo);
      const tradeRes = alipayRes.alipay_trade_query_response || alipayRes;
      if (tradeRes.code === '10000' && (tradeRes.tradeStatus === 'TRADE_SUCCESS' || tradeRes.tradeStatus === 'TRADE_FINISHED')) {
        const order = await pool.query('SELECT id FROM subscription_orders WHERE out_trade_no = $1 AND user_id = $2', [outTradeNo, req.user.id]);
        if (order.rows.length > 0) {
          await subService.activateByTradeNo(outTradeNo, tradeRes.tradeNo || '');
          return res.json({ paid: true });
        }
      }
    } catch (queryErr) {
      console.warn('支付宝查询失败:', queryErr.message);
    }

    res.json({ paid: false });
  } catch (e) {
    console.error('查询订单失败:', e.message);
    res.status(500).json({ error: '查询订单失败' });
  }
});

// Rate limiting for Alipay callback (100 per minute per IP — generous for legitimate callbacks)
const notifyRateLimit = new Map();
function checkNotifyRateLimit(ip) {
  const now = Date.now();
  const record = notifyRateLimit.get(ip) || { count: 0, resetTime: now + 60000 };
  if (now > record.resetTime) { record.count = 0; record.resetTime = now + 60000; }
  record.count++;
  notifyRateLimit.set(ip, record);
  return record.count <= 100;
}
setInterval(() => { const now = Date.now(); for (const [ip, r] of notifyRateLimit) { if (now > r.resetTime + 60000) notifyRateLimit.delete(ip); } }, 5 * 60 * 1000);

// POST /api/subscription/notify — 支付宝异步回调（无需登录，但验证签名+限流）
router.post('/api/subscription/notify', express.urlencoded({ extended: false }), async (req, res) => {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkNotifyRateLimit(clientIp)) {
    console.warn('[支付宝回调] 速率限制触发:', clientIp);
    return res.send('failure');
  }
  try {
    const params = req.body;
    if (!verifyNotification(params)) {
      console.warn('[支付宝回调] 签名验证失败');
      return res.send('failure');
    }
    if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
      await subService.activateByTradeNo(params.out_trade_no, params.trade_no || '');
      console.log(`[支付宝回调] 订单 ${params.out_trade_no} 支付成功`);
    }
    res.send('success');
  } catch (e) {
    console.error('[支付宝回调] 处理失败:', e.message);
    res.send('failure');
  }
});

// GET /api/subscription/orders — 需登录
router.get('/api/subscription/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await subService.getOrdersByUser(req.user.id);
    res.json({ orders });
  } catch (e) {
    console.error('获取订单失败:', e.message);
    res.status(500).json({ error: '获取订单失败' });
  }
});

module.exports = router;
