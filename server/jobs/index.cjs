/**
 * 定时任务注册中心
 * 从 index.cjs 抽离所有 scheduleDaily 任务，保持入口文件精简
 */
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../utils/logger.cjs');
const { scheduleDaily } = require('../utils/scheduler.cjs');

/**
 * 注册所有每日定时任务
 * @param {Object} deps - 依赖注入
 * @param {Array} deps.allFunds - 基金数据
 * @param {Function} deps.runDailyDataUpdate - 每日完整数据更新
 * @param {Function} deps.fetchYiFangDaFundData - 易方达数据抓取
 * @param {Function} deps.fetchGoldFundData - 金选基金数据抓取
 * @returns {Array<Object>} 调度器控制对象列表
 */
function registerJobs({ allFunds, runDailyDataUpdate, fetchYiFangDaFundData, fetchGoldFundData }) {
  const jobs = [];

  // 每日9:30执行完整数据更新（收益率+QDII限额+HS300+持仓盈亏）
  jobs.push(scheduleDaily(() => runDailyDataUpdate(allFunds), 9, 30, '每日数据更新'));

  // 每日9:32执行QDII基金专项更新（限额+1y/3m/1m，开盘时间确认）
  jobs.push(scheduleDaily(() => {
    logger.info('[QDII专项] 开始更新QDII基金数据...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update-qdii-funds.cjs');
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[QDII专项] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[QDII专项] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[QDII专项] 完成，退出码: ${code}`));
  }, 9, 32, 'QDII基金专项更新'));

  // 每日15:30执行指数估值更新（收盘后获取最终PE/PB，含PB历史分位）
  jobs.push(scheduleDaily(() => {
    logger.info('[指数估值] 收盘后更新指数PE/PB估值...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update-index-valuation.cjs');
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[指数估值] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[指数估值] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[指数估值] 完成，退出码: ${code}`));
  }, 15, 30, '指数估值收盘更新'));

  // 每日16:00执行基金数据全量更新（收盘后获取最新净值+收益率）
  jobs.push(scheduleDaily(() => {
    logger.info('[基金数据] 收盘后全量更新基金净值+收益率...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update-fund-data.cjs');
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[基金数据] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[基金数据] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[基金数据] 完成，退出码: ${code}`));
  }, 16, 0, '基金数据收盘更新'));

  // 每日16:05执行板块数据更新（收盘后获取行业板块涨跌幅）
  jobs.push(scheduleDaily(() => {
    logger.info('[板块数据] 收盘后更新行业板块涨跌幅...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update-sector-data.cjs');
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[板块数据] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[板块数据] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[板块数据] 完成，退出码: ${code}`));
  }, 16, 5, '板块数据收盘更新'));

  // 每日10:15从支付宝获取易方达基金数据（经理、净值、收益率）
  jobs.push(scheduleDaily(() => {
    fetchYiFangDaFundData().catch(err => {
      logger.error(`[易方达] 定时更新失败: ${err.message}`);
    });
  }, 10, 15, '易方达基金数据更新'));

  // 每日10:45更新金选基金数据（经理、净值、收益率）
  jobs.push(scheduleDaily(() => {
    fetchGoldFundData().catch(err => {
      logger.error(`[金选基金] 定时更新失败: ${err.message}`);
    });
  }, 10, 45, '金选基金数据更新'));

  // 每日10:00执行招行理财产品数据爬取
  jobs.push(scheduleDaily(() => {
    logger.info('[CMB] 开始爬取招行理财产品数据...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'fetch_cmb_nav.py');
    const proc = spawn('python', [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[CMB] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[CMB] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[CMB] 爬取完成，退出码: ${code}`));
    proc.on('error', (err) => logger.error(`[CMB] 爬取启动失败: ${err.message}`));
  }, 10, 0, '招行理财产品爬取'));

  // 每周一10:30执行个人理财产品净值爬取（weekly更新原有54只 + target更新25只目标产品）
  jobs.push(scheduleDaily(() => {
    const today = new Date();
    if (today.getDay() !== 1) return; // 仅周一执行
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'fetch_cmb_personal_nav.py');

    // 先运行 weekly 模式更新原有54只产品
    logger.info('[CMB-NAV] 开始爬取个人理财产品净值（weekly）...');
    const proc1 = spawn('python', [scriptPath, 'weekly'], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc1.stdout.on('data', (data) => logger.info(`[CMB-NAV-W] ${data.toString().trim()}`));
    proc1.stderr.on('data', (data) => logger.error(`[CMB-NAV-W] ${data.toString().trim()}`));
    proc1.on('close', (code) => {
      logger.info(`[CMB-NAV-W] weekly完成，退出码: ${code}`);
      logger.info('[CMB-NAV-T] 开始爬取目标产品净值（target）...');
      const proc2 = spawn('python', [scriptPath, 'target'], {
        env: { ...process.env },
        cwd: path.join(__dirname, '..', '..'),
        stdio: 'pipe',
      });
      proc2.stdout.on('data', (data) => logger.info(`[CMB-NAV-T] ${data.toString().trim()}`));
      proc2.stderr.on('data', (data) => logger.error(`[CMB-NAV-T] ${data.toString().trim()}`));
      proc2.on('close', (code2) => logger.info(`[CMB-NAV-T] target完成，退出码: ${code2}`));
      proc2.on('error', (err) => logger.error(`[CMB-NAV-T] 启动失败: ${err.message}`));
    });
    proc1.on('error', (err) => logger.error(`[CMB-NAV-W] 启动失败: ${err.message}`));
  }, 10, 30, '个人理财产品净值爬取'));

  // 每周六11:00执行招银理财净值数据爬取（最近5个交易日）
  jobs.push(scheduleDaily(() => {
    const day = new Date().getDay();
    if (day !== 6) return; // 仅周六执行
    logger.info('[NAV] 开始爬取招银理财净值数据...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'fetch_zhaoyin_nav.py');
    const proc = spawn('python', [scriptPath, 'weekly'], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[NAV] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[NAV] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[NAV] 爬取完成，退出码: ${code}`));
    proc.on('error', (err) => logger.error(`[NAV] 爬取启动失败: ${err.message}`));
  }, 11, 0, '招银理财净值爬取'));

  return jobs;
}

module.exports = { registerJobs };
