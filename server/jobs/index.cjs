/**
 * 定时任务注册中心
 * 从 index.cjs 抽离所有 scheduleDaily 任务，保持入口文件精简
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const logger = require('../utils/logger.cjs');
const { scheduleDaily } = require('../utils/scheduler.cjs');

/**
 * 解析可用的 Python 解释器。
 * 生产服务器通常只有 python3（Debian/Ubuntu 默认不提供 python 别名），
 * 而 Windows 开发机上往往只有 python。硬编码任一个都会让定时任务静默失败，
 * 所以按 PYTHON_BIN → python3 → python 的顺序探测。
 */
const PYTHON_BIN = (() => {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const bin of candidates) {
    const dirs = (process.env.PATH || '').split(path.delimiter);
    const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
    for (const dir of dirs) {
      for (const ext of exts) {
        if (!dir) continue;
        try {
          if (fs.existsSync(path.join(dir, bin + ext))) return bin;
        } catch {
          /* 忽略不可读目录 */
        }
      }
    }
  }
  return candidates[0];
})();

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

  // 每日20:30执行基金数据全量更新（最新净值+收益率）。
  // 此前 16:00 执行，但当日净值 18:00-22:00 才陆续公布，任务永远只能拿到 T-1 的净值；
  // 改到 20:30 后绝大多数基金当日入库，个别晚公布的由次日任务补上。
  jobs.push(scheduleDaily(() => {
    logger.info('[基金数据] 更新基金净值+收益率（净值公布后执行）...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'update-fund-data.cjs');
    const proc = spawn('node', [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[基金数据] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[基金数据] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[基金数据] 完成，退出码: ${code}`));
  }, 20, 30, '基金数据净值更新'));

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
    const proc = spawn(PYTHON_BIN, [scriptPath], {
      env: { ...process.env },
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[CMB] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[CMB] ${data.toString().trim()}`));
    proc.on('close', (code) => logger.info(`[CMB] 爬取完成，退出码: ${code}`));
    proc.on('error', (err) => logger.error(`[CMB] 爬取启动失败: ${err.message}`));
  }, 10, 0, '招行理财产品爬取'));

  // 每周一10:30执行个人理财产品净值爬取，并同步持仓估值
  // 使用 update-cmb-nav-session.py：走招行官方 JSON 接口 + 复用页面鉴权头。
  // 旧的 fetch_cmb_personal_nav.py 依赖点击 DOM「下一页」，遇到缺失分页元素会静默卡死。
  jobs.push(scheduleDaily(() => {
    const today = new Date();
    if (today.getDay() !== 1) return; // 仅周一执行
    const root = path.join(__dirname, '..', '..');
    const scriptPath = path.join(root, 'scripts', 'update-cmb-nav-session.py');

    logger.info('[CMB-NAV] 开始更新个人理财产品净值（近 60 天）...');
    const proc = spawn(PYTHON_BIN, ['-u', scriptPath, '--days', '60'], {
      env: { ...process.env },
      cwd: root,
      stdio: 'pipe',
    });
    proc.stdout.on('data', (data) => logger.info(`[CMB-NAV] ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => logger.error(`[CMB-NAV] ${data.toString().trim()}`));
    proc.on('close', (code) => {
      logger.info(`[CMB-NAV] 净值更新完成，退出码: ${code}`);
      // 净值落库后同步持仓缓存字段（current_nav / market_value / pnl）
      const syncPath = path.join(root, 'scripts', 'sync-cmb-holdings.cjs');
      const syncProc = spawn('node', [syncPath], { env: { ...process.env }, cwd: root, stdio: 'pipe' });
      syncProc.stdout.on('data', (d) => logger.info(`[CMB-SYNC] ${d.toString().trim()}`));
      syncProc.stderr.on('data', (d) => logger.error(`[CMB-SYNC] ${d.toString().trim()}`));
      syncProc.on('close', (c) => logger.info(`[CMB-SYNC] 持仓同步完成，退出码: ${c}`));
      syncProc.on('error', (err) => logger.error(`[CMB-SYNC] 启动失败: ${err.message}`));
    });
    proc.on('error', (err) => logger.error(`[CMB-NAV] 启动失败: ${err.message}`));
    }, 10, 30, '个人理财产品净值爬取'));

  // 每周六11:00执行招银理财净值数据爬取（最近5个交易日）
  jobs.push(scheduleDaily(() => {
    const day = new Date().getDay();
    if (day !== 6) return; // 仅周六执行
    logger.info('[NAV] 开始爬取招银理财净值数据...');
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'fetch_zhaoyin_nav.py');
    const proc = spawn(PYTHON_BIN, [scriptPath, 'weekly'], {
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
