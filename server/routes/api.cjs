/**
 * API 路由聚合模块 — 汇集所有子路由模块
 *
 * 架构分层：
 *   routes/funds.cjs     — 基金列表、详情、QDII、沪深300、易方达、金选基金
 *   routes/market.cjs    — 市场指数、板块、资金流向、估值中心、估值趋势
 *   routes/industry.cjs  — 行业分析、沪深300分析、标普500分析、推荐、建仓方案
 *   routes/tools.cjs     — 风险评估、定投计算器、基金对比
 *   routes/cmb.cjs       — 招行理财产品
 *   routes/news.cjs      — 新闻
 *   routes/alerts.cjs    — 智能提醒
 */

const express = require('express');
const logger = require('../utils/logger.cjs');
const { isTradingHours, isTradingDay, getMarketState, getNextUpdateTime } = require('../utils/trading-hours.cjs');
const { authMiddleware, adminMiddleware } = require('../auth.cjs');

// 导入子路由模块
const { router: fundsRouter, createYiFangDaRoute, createGoldFundRoute } = require('./funds.cjs');
const { router: marketRouter } = require('./market.cjs');
const { router: industryRouter } = require('./industry.cjs');
const { router: toolsRouter } = require('./tools.cjs');
const { router: cmbRouter } = require('./cmb.cjs');
const { router: newsRouter, createNewsRefreshRoute } = require('./news.cjs');
const { router: alertsRouter } = require('./alerts.cjs');
const fundDiagnosisRouter = require('./fund-diagnosis.cjs');

const router = express.Router();

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取数据更新状态
function createStatusRoute(dataUpdateStatus) {
  router.get('/api/status', (req, res) => {
    try {
      const marketState = getMarketState();
      res.json({
        lastUpdateTime: dataUpdateStatus.lastUpdateTime,
        nextUpdateTime: dataUpdateStatus.nextUpdateTime,
        isUpdating: dataUpdateStatus.isUpdating,
        updateCount: dataUpdateStatus.updateCount,
        error: dataUpdateStatus.error ? '数据更新遇到错误' : null,
        isTrading: isTradingHours(),
        isTradingDay: isTradingDay(),
        marketState,
        updateInterval: isTradingHours() ? '15分钟' : '等待开盘',
      });
    } catch (e) {
      logger.error('获取状态失败:', e.message);
      res.status(500).json({ error: '获取状态失败' });
    }
  });
}

// 手动触发数据更新
function createUpdateRoute(updateAllFundData) {
  router.post('/api/update', authMiddleware, adminMiddleware, async (req, res) => {
    if (req.app.locals.dataUpdateStatus?.isUpdating) {
      return res.json({ success: false, message: '数据更新正在进行中' });
    }
    updateAllFundData();
    res.json({ success: true, message: '数据更新已启动' });
  });
}

// 挂载子路由
router.use(fundsRouter);
router.use(marketRouter);
router.use(industryRouter);
router.use(toolsRouter);
router.use(cmbRouter);
router.use(newsRouter);
router.use(alertsRouter);

// 手动触发全量基金数据更新（净值+收益率+规模，从支付宝/东方财富API获取）
// 不传参数 = 更新数据库中全部基金；传 ?scope=curated = 仅更新 fund-data.cjs 中的精选基金
function createFullUpdateRoute(fetchAllCuratedFundsData) {
  router.post('/api/funds/fetch-all', authMiddleware, async (req, res) => {
    try {
      const scope = req.query.scope;
      let fundCount;
      if (scope === 'curated') {
        const { allFunds } = require('../fund-data.cjs');
        fundCount = allFunds.length;
        fetchAllCuratedFundsData(allFunds).then(result => {
          logger.info(`[API] 精选基金更新完成: 成功${result.success}/${result.total}`);
        }).catch(err => {
          logger.error(`[API] 精选基金更新失败: ${err.message}`);
        });
      } else {
        // 全库模式：不传 allFunds，从数据库读取全部基金代码
        const { getPool } = require('../db.cjs');
        const { rows } = await getPool().query('SELECT COUNT(*)::int as c FROM funds');
        fundCount = rows[0].c;
        fetchAllCuratedFundsData(null).then(result => {
          logger.info(`[API] 全库更新完成: 成功${result.success}/${result.total}`);
        }).catch(err => {
          logger.error(`[API] 全库更新失败: ${err.message}`);
        });
      }
      res.json({ success: true, message: `基金数据更新已启动，共${fundCount}只基金` });
    } catch (e) {
      logger.error('启动全量更新失败:', e.message);
      res.status(500).json({ error: '启动更新失败' });
    }
  });
}

router.use(fundDiagnosisRouter);

module.exports = {
  router,
  createStatusRoute,
  createUpdateRoute,
  createYiFangDaRoute,
  createGoldFundRoute,
  createNewsRefreshRoute,
  createFullUpdateRoute,
};
