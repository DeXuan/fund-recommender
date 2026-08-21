require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger.cjs');
const { isTradingDay, getNextUpdateTime } = require('./utils/trading-hours.cjs');
const { allFunds, fundManagerMap } = require('./fund-data.cjs');
const fundService = require('./fund-service.cjs');
const { handleSSEConnection } = require('./news-fetcher.cjs');
const { fetchAllNews } = require('./news-fetcher.cjs');
const {
  fetchCapitalFlow, fetchUpdateAllFundData, updateAllFundReturns,
  updatePortfolioPnl, runDailyDataUpdate,
  fetchYiFangDaFundData, fetchGoldFundData, fetchAllCuratedFundsData, defaultIndices,
} = require('./data-fetcher.cjs');
const { setupCORS, setupSecurity, setupStaticFiles, setupRateLimiting, setupRequestCounter } = require('./middleware/index.cjs');
const { startBackgroundTasks, createDataUpdateStatus } = require('./startup.cjs');
const { router: apiRoutes, createStatusRoute, createUpdateRoute, createYiFangDaRoute, createGoldFundRoute, createNewsRefreshRoute, createFullUpdateRoute } = require('./routes/api.cjs');

// 路由模块
const authRoutes = require('./auth.cjs');
const portfolioRoutes = require('./routes/portfolio/index.cjs');
const adminRoutes = require('./routes/admin/index.cjs');
const portfolioAnalysisRoutes = require('./routes/portfolio-analysis.cjs');
const subscriptionRoutes = require('./routes/subscription.cjs');
const stockPickerRoutes = require('./routes/stock-picker.cjs');
const stockPickerUserRoutes = require('./routes/stock-picker-user.cjs');
const stockPickerTempRoutes = require('./routes/stock-picker-temperature.cjs');
const stockPickerNLRoutes = require('./routes/stock-picker-nl.cjs');
const stockPickerCorrRoutes = require('./routes/stock-picker-corr.cjs');
const stockPickerAlertRoutes = require('./routes/stock-picker-alerts.cjs');
const fundCompareRoutes = require('./routes/fund-compare.cjs');
const watchlistRoutes = require('./routes/watchlist.cjs');
const aiAssistantRoutes = require('./routes/ai-assistant.cjs');
const swaggerDocsRoutes = require('./swagger-docs.cjs');

const app = express();
const PORT = process.env.PORT || 3003;
app.set('trust proxy', 1);

// ---- 中间件 ----
setupCORS(app);
app.use(express.json({ limit: '10kb' }));
setupStaticFiles(app);
const { generalLimiter, updateLimiter } = setupRateLimiting(app);
setupSecurity(app);
setupRequestCounter(app);

// ---- 数据更新状态（路由创建依赖） ----
const dataUpdateStatus = createDataUpdateStatus();

// ---- 路由挂载 ----
app.use('/api/docs', swaggerDocsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);
app.use(portfolioAnalysisRoutes);
createStatusRoute(dataUpdateStatus);
createUpdateRoute(() => fetchUpdateAllFundData(allFunds, dataUpdateStatus, isTradingDay, getNextUpdateTime, () => updateAllFundReturns(allFunds)));
createYiFangDaRoute(fetchYiFangDaFundData);
createGoldFundRoute(fetchGoldFundData);
createNewsRefreshRoute(fetchAllNews);
createFullUpdateRoute(fetchAllCuratedFundsData);
app.get('/api/news/stream', (req, res) => { handleSSEConnection(req, res); });
app.use(apiRoutes);
app.use(subscriptionRoutes);
app.use(stockPickerRoutes);
app.use(stockPickerUserRoutes);
app.use(stockPickerTempRoutes);
app.use(stockPickerNLRoutes);
app.use(stockPickerCorrRoutes);
app.use(stockPickerAlertRoutes);
app.use(fundCompareRoutes);
app.use(watchlistRoutes);
app.use(aiAssistantRoutes);

// ---- 全局错误处理 ----
app.use((err, req, res, next) => {
  logger.error(`[未捕获错误] ${err.message || err}`, { stack: err?.stack, path: req.path, method: req.method });
  if (res.headersSent) return next(err);
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  res.status(status).json({ error: status === 500 ? '服务器内部错误' : (err.message || '服务器内部错误') });
});

// ---- 优雅关闭 ----
const { closePool } = require('./db.cjs');
const shutdown = async (sig) => {
  logger.info(`收到 ${sig}，关闭中...`);
  generalLimiter.destroy();
  updateLimiter.destroy();
  await closePool();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error(`未捕获异常: ${err.stack || err}`); setTimeout(() => process.exit(1), 1000); });
process.on('unhandledRejection', (reason) => { logger.error(`未处理Promise rejection: ${reason}`); setTimeout(() => process.exit(1), 1000); });

// ---- 启动 ----
app.listen(PORT, '0.0.0.0', () => { logger.info(`[服务器] 运行在 http://0.0.0.0:${PORT}`); });
startBackgroundTasks({ allFunds, fundManagerMap, fundService, defaultIndices, fetchAllNews, fetchYiFangDaFundData, fetchGoldFundData, fetchCapitalFlow, fetchUpdateAllFundData, updateAllFundReturns, updatePortfolioPnl, runDailyDataUpdate, dataUpdateStatus });