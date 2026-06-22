/**
 * 智能提醒路由
 */

const express = require('express');
const fundService = require('../fund-service.cjs');
const { getPool } = require('../db.cjs');
const { authMiddleware } = require('../auth.cjs');
const { createHandler } = require('../utils/route-handler.cjs');

const router = express.Router();
const handler = createHandler('提醒');

// 获取智能提醒
router.get('/api/alerts', authMiddleware, handler(async (req) => {
  const pool = getPool();
  const alerts = [];

  // 1. 持仓基金净值大幅波动
  const holdings = await pool.query(
    `SELECT DISTINCT fund_code, fund_name FROM fund_records WHERE user_id = $1`,
    [req.user.id]
  );
  const heldCodes = new Set(holdings.rows.map(h => h.fund_code));

  for (const h of holdings.rows) {
    const navResult = await pool.query(
      `SELECT return_1w, return_1m FROM fund_nav WHERE fund_code = $1 ORDER BY nav_date DESC LIMIT 1`,
      [h.fund_code]
    );
    if (navResult.rows.length > 0) {
      const return1w = parseFloat(navResult.rows[0].return_1w || 0);
      const return1m = parseFloat(navResult.rows[0].return_1m || 0);
      if (return1w < -5) {
        alerts.push({
          type: 'nav_drop', level: 'warning',
          title: `${h.fund_name} 近1周大跌`,
          message: `近1周收益 ${return1w.toFixed(2)}%，请注意风险`,
          fund_code: h.fund_code,
        });
      } else if (return1w > 8) {
        alerts.push({
          type: 'nav_surge', level: 'success',
          title: `${h.fund_name} 近1周大涨`,
          message: `近1周收益 +${return1w.toFixed(2)}%，可考虑止盈`,
          fund_code: h.fund_code,
        });
      }
      if (return1m < -10) {
        alerts.push({
          type: 'nav_drop_month', level: 'warning',
          title: `${h.fund_name} 近1月跌幅较大`,
          message: `近1月收益 ${return1m.toFixed(2)}%，可考虑定投摊低成本`,
          fund_code: h.fund_code,
        });
      }
    }
  }

  // 2. QDII限额提醒
  if (heldCodes.size > 0) {
    const qdiiResult = await pool.query(
      `SELECT code, name, daily_limit FROM funds WHERE code = ANY($1) AND type = 'QDII' AND daily_limit > 0 AND daily_limit < 1000`,
      [Array.from(heldCodes)]
    );
    for (const q of qdiiResult.rows) {
      alerts.push({
        type: 'qdii_limit', level: 'info',
        title: `${q.name} 限额提醒`,
        message: `当前每日限额 ${q.daily_limit} 元，注意分批买入`,
        fund_code: q.code,
      });
    }
  }

  // 3. 定投计划到期提醒
  const dcaResult = await pool.query(
    `SELECT fund_name, end_date FROM dca_plans
     WHERE user_id = $1 AND status = 'active' AND end_date IS NOT NULL AND end_date <= NOW() + INTERVAL '7 days'`,
    [req.user.id]
  );
  for (const d of dcaResult.rows) {
    alerts.push({
      type: 'dca_expiring', level: 'warning',
      title: '定投计划即将到期',
      message: `${d.fund_name} 定投计划将于 ${d.end_date.toISOString().slice(0, 10)} 到期`,
    });
  }

  // 4. 市场估值提醒
  const indices = await fundService.getMarketIndices();
  for (const idx of indices) {
    if (idx.pePercentile && idx.pePercentile < 20) {
      alerts.push({
        type: 'valuation_low', level: 'success',
        title: `${idx.name} 估值极低`,
        message: `PE分位 ${idx.pePercentile}%，处于历史低位，适合布局`,
      });
    } else if (idx.pePercentile && idx.pePercentile > 80) {
      alerts.push({
        type: 'valuation_high', level: 'warning',
        title: `${idx.name} 估值偏高`,
        message: `PE分位 ${idx.pePercentile}%，处于历史高位，注意风险`,
      });
    }
  }

  // 5. 持仓盈亏提醒
  const summaryResult = await pool.query(
    `SELECT fund_code, fund_name, pnl, pnl_percent FROM fund_records WHERE user_id = $1 AND pnl IS NOT NULL`,
    [req.user.id]
  );
  const fundPnl = {};
  for (const r of summaryResult.rows) {
    const code = r.fund_code;
    if (!fundPnl[code]) fundPnl[code] = { name: r.fund_name, pnl: 0 };
    fundPnl[code].pnl += parseFloat(r.pnl || 0);
  }
  for (const [code, d] of Object.entries(fundPnl)) {
    if (d.pnl < -500) {
      alerts.push({
        type: 'holding_loss', level: 'warning',
        title: `${d.name} 持仓亏损`,
        message: `当前亏损 ¥${Math.abs(d.pnl).toFixed(0)}，请评估是否需要调整`,
        fund_code: code,
      });
    }
  }

  // 6. 新闻事件驱动的持仓提醒
  try {
    const { generateNewsAlerts } = require('../news-fetcher.cjs');
    const newsAlerts = await generateNewsAlerts(req.user.id, pool);
    alerts.push(...newsAlerts);
  } catch (e) {
    // 新闻模块可能未初始化，忽略错误
  }

  return alerts;
}));

module.exports = { router };
