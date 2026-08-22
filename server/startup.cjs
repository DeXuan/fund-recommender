'use strict';

const logger = require('./utils/logger.cjs');
const { isTradingHours, getNextUpdateTime } = require('./utils/trading-hours.cjs');
const { getPool, initDatabase } = require('./db.cjs');
const { registerJobs } = require('./jobs/index.cjs');

const FETCH_INTERVAL_MS = 3 * 60 * 1000;

function createDataUpdateStatus() {
  return { lastUpdateTime: null, nextUpdateTime: null, isUpdating: false, updateCount: 0, error: null, lastReturnUpdateDate: null };
}

function buildDoUpdate({ allFunds, dataUpdateStatus, updateAllFundData, updateAllFundReturns, updatePortfolioPnl }) {
  return async function doUpdateAllFundData() {
    try { await updateAllFundData(allFunds, dataUpdateStatus, () => true, getNextUpdateTime, () => updateAllFundReturns(allFunds)); }
    catch (err) { logger.warn(`[自动更新] 主更新任务异常: ${err.message}`); }
    try { await updatePortfolioPnl(allFunds); } catch (err) { logger.warn(`[持仓] 自动更新持仓盈亏失败: ${err.message}`); }
  };
}

function startAutoUpdate(doUpdateAllFundData, dataUpdateStatus) {
  const scheduleNext = () => {
    const nextTime = getNextUpdateTime();
    const interval = Math.max(nextTime.getTime() - Date.now(), 60 * 1000);
    const label = isTradingHours() ? '15分钟' : nextTime.toLocaleString('zh-CN');
    dataUpdateStatus.nextUpdateTime = nextTime.toISOString();
    logger.info(`[调度] 下次更新: ${label}`);
    setTimeout(async () => { await doUpdateAllFundData(); scheduleNext(); }, interval);
  };
  logger.info('启动智能数据更新任务（开盘15分钟，非开盘等待下一个交易窗口）');
  doUpdateAllFundData().then(() => scheduleNext());
}

function startNewsFetching(fetchAllNews) {
  fetchAllNews().then(() => logger.info('[新闻] 初始抓取完成')).catch(e => logger.warn(`[新闻] 初始抓取失败: ${e.message}`));
  setInterval(async () => { try { await fetchAllNews(); } catch (e) { logger.warn(`[新闻] 定时抓取失败: ${e.message}`); } }, FETCH_INTERVAL_MS);
}

async function startBackgroundTasks(options) {
  const { allFunds, fundManagerMap, fundService, defaultIndices, fetchAllNews, fetchYiFangDaFundData,
    fetchGoldFundData, fetchCapitalFlow, updateAllFundData, updateAllFundReturns,
    updatePortfolioPnl, runDailyDataUpdate, dataUpdateStatus } = options;

  try {
    logger.info('正在连接数据库...');
    const pool = getPool();
    const client = await pool.connect();
    client.release();
    logger.info('数据库连接成功');

    await initDatabase();
    logger.info('数据库初始化完成');

    setImmediate(async () => {
      try {
        const fundCount = await fundService.getFundCount();
        await fundService.seedFunds(allFunds);
        const newCount = await fundService.getFundCount();
        logger.info(`[种子] ${newCount > fundCount ? `新增${newCount - fundCount}只` : `已同步${newCount}只`}基金`);
      } catch (e) { logger.error(`[种子] 同步失败: ${e.message}`); }

      try { await fundService.updateFundManagers(fundManagerMap); } catch (e) { logger.error(`[经理] 更新失败: ${e.message}`); }
      try { await fundService.initMarketIndices(defaultIndices); } catch (e) { logger.error(`[指数] 初始化失败: ${e.message}`); }

      const doUpdate = buildDoUpdate({ allFunds, dataUpdateStatus, updateAllFundData, updateAllFundReturns, updatePortfolioPnl });
      startAutoUpdate(doUpdate, dataUpdateStatus);
      fetchCapitalFlow().finally(() => setTimeout(() => fetchCapitalFlow(), 5 * 60 * 1000));
      startNewsFetching(fetchAllNews);
      fetchYiFangDaFundData().catch(e => logger.error(`[易方达] 获取失败: ${e.message}`));
      fetchGoldFundData().catch(e => logger.error(`[金选] 获取失败: ${e.message}`));
    });

    registerJobs({ allFunds, runDailyDataUpdate, fetchYiFangDaFundData, fetchGoldFundData });

  } catch (err) {
    logger.error(`启动失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { startBackgroundTasks, createDataUpdateStatus };