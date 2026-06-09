require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { allFunds, fundManagerMap } = require('./fund-data.cjs');
const { initDatabase } = require('./db.cjs');
const fundService = require('./fund-service.cjs');
const authRoutes = require('./auth.cjs');
const portfolioRoutes = require('./portfolio.cjs');
const adminRoutes = require('./admin.cjs');
const { incrementRequestCount, resetQpsCounter } = require('./admin.cjs');
const { createRateLimit } = require('./utils/rate-limiter.cjs');
const { scheduleDaily } = require('./utils/scheduler.cjs');
const { spawn } = require('child_process');
const path = require('path');
const { isTradingHours, isTradingDay, getNextUpdateTime } = require('./utils/trading-hours.cjs');
const {
  fetchCapitalFlow, fetchQDIIData, fetchHS300FundDetails,
  updateAllFundData: fetchUpdateAllFundData, updateAllFundReturns, updatePortfolioPnl,
  runDailyDataUpdate, fetchYiFangDaFundData, fetchGoldFundData,
  defaultIndices,
} = require('./data-fetcher.cjs');
const { router: apiRoutes, createStatusRoute, createUpdateRoute, createYiFangDaRoute, createGoldFundRoute } = require('./routes/api.cjs');

const app = express();
const PORT = process.env.PORT || 3003;

// Trust reverse proxy (Nginx) to set X-Forwarded-For correctly for rate limiting
app.set('trust proxy', 1);

// CORS: 仅允许前端域名
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://47.116.77.67:8688', 'http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 Origin 的请求（服务器到服务器、Postman 等非浏览器场景）
    // 浏览器跨域请求必须携带 Origin，且必须在白名单中
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 86400,
}));

// 请求体大小限制
app.use(express.json({ limit: '10kb' }));

// 速率限制（使用共享模块）
const generalLimiter = createRateLimit(60 * 1000, 300, 'general');
const updateLimiter = createRateLimit(15 * 60 * 1000, 3, 'update');

app.use('/api/', generalLimiter);
app.use('/api/update', updateLimiter);

// 安全响应头（使用 helmet + 自定义补充）
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Request counter for QPS metrics
app.use((req, res, next) => {
  incrementRequestCount();
  next();
});

// Reset QPS counter every 60 seconds
setInterval(resetQpsCounter, 60 * 1000);

// 认证和记账路由
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);

// 数据更新状态
const dataUpdateStatus = {
  lastUpdateTime: null,
  nextUpdateTime: null,
  isUpdating: false,
  updateCount: 0,
  error: null,
  lastReturnUpdateDate: null,
};

// 将 dataUpdateStatus 挂载到 app.locals 供路由使用
app.locals.dataUpdateStatus = dataUpdateStatus;

// 创建依赖 dataUpdateStatus 的路由
createStatusRoute(dataUpdateStatus);
createUpdateRoute(() => fetchUpdateAllFundData(allFunds, dataUpdateStatus, isTradingDay, getNextUpdateTime, () => updateAllFundReturns(allFunds)));
createYiFangDaRoute(fetchYiFangDaFundData);
createGoldFundRoute(fetchGoldFundData);

// API 路由
app.use(apiRoutes);

// 定时更新资金流向（使用递归 setTimeout 避免堆叠）
function scheduleCapitalFlowUpdate() {
  fetchCapitalFlow().finally(() => {
    setTimeout(scheduleCapitalFlowUpdate, 5 * 60 * 1000);
  });
}

// 包装 data-fetcher 的 updateAllFundData 以适配当前模块
async function doUpdateAllFundData() {
  try {
    await fetchUpdateAllFundData(allFunds, dataUpdateStatus, isTradingDay, getNextUpdateTime, () => updateAllFundReturns(allFunds));
  } catch (err) {
    console.warn('[自动更新] 主更新任务异常:', err.message);
  }

  // 每次净值更新后，同步更新所有用户持仓的市值/盈亏/收益率（独立执行，不受主任务影响）
  try {
    await updatePortfolioPnl(allFunds);
  } catch (err) {
    console.warn('[持仓] 自动更新持仓盈亏失败:', err.message);
  }
}

// 启动定时更新任务
function startAutoUpdate() {
  const scheduleNext = () => {
    const nextTime = getNextUpdateTime();
    const interval = Math.max(nextTime.getTime() - Date.now(), 60 * 1000);
    const label = isTradingHours() ? '15分钟' : nextTime.toLocaleString('zh-CN');

    dataUpdateStatus.nextUpdateTime = nextTime.toISOString();
    console.log(`[调度] 下次更新: ${label} (${new Date(Date.now() + interval).toLocaleString()})`);

    setTimeout(async () => {
      await doUpdateAllFundData();
      scheduleNext();
    }, interval);
  };

  console.log('启动智能数据更新任务（开盘时间每15分钟，非开盘等待下一个交易窗口）');
  doUpdateAllFundData().then(() => scheduleNext());
}

// 初始化数据库后启动服务器
async function startServer() {
  try {
    // 先测试数据库连接
    console.log('正在连接数据库...');
    const { getPool } = require('./db.cjs');
    const testPool = getPool();
    const testClient = await testPool.connect();
    testClient.release();
    console.log('数据库连接成功');

    await initDatabase();
    console.log('数据库初始化完成');

    // 先启动HTTP服务，让用户可以立即访问
    app.listen(PORT, () => {
      console.log(`基金推荐服务器运行在 http://localhost:${PORT}`);
    });

    // 异步执行初始化任务（不阻塞HTTP请求处理）
    setImmediate(async () => {
      // 同步种子数据
      try {
        const fundCount = await fundService.getFundCount();
        console.log(`[种子数据] 数据库已有 ${fundCount} 只基金，同步 fund-data.cjs ...`);
        await fundService.seedFunds(allFunds);
        const newCount = await fundService.getFundCount();
        if (newCount > fundCount) {
          console.log(`[种子数据] 新增 ${newCount - fundCount} 只基金`);
        } else {
          console.log(`[种子数据] 已同步 ${newCount} 只基金数据`);
        }
      } catch (seedErr) {
        console.error('[种子数据] 同步失败:', seedErr.message);
      }

      // 如果基金数量为0，尝试重新同步
      try {
        const currentCount = await fundService.getFundCount();
        if (currentCount === 0) {
          console.log('[种子数据] 基金表为空，尝试重新同步...');
          await fundService.seedFunds(allFunds);
        }
      } catch (retryErr) {
        console.error('[种子数据] 重试失败:', retryErr.message);
      }

      // 更新基金经理信息
      try {
        await fundService.updateFundManagers(fundManagerMap);
      } catch (mgrErr) {
        console.error('[基金经理] 更新失败:', mgrErr.message);
      }

      // 初始化市场指数
      try {
        await fundService.initMarketIndices(defaultIndices);
      } catch (idxErr) {
        console.error('[市场指数] 初始化失败:', idxErr.message);
      }

      // 启动自动更新（开盘时间每15分钟更新净值+指数）
      startAutoUpdate();
      scheduleCapitalFlowUpdate();

      // 启动时获取一次易方达基金数据（经理、净值等）
      fetchYiFangDaFundData().catch(err => {
        console.error('[易方达] 启动时获取数据失败:', err.message);
      });

      // 启动时获取金选基金数据
      fetchGoldFundData().catch(err => {
        console.error('[金选基金] 启动时获取数据失败:', err.message);
      });
    });

    // 每日9:30执行完整数据更新（收益率+QDII限额+HS300+持仓盈亏）
    scheduleDaily(() => runDailyDataUpdate(allFunds), 9, 30, '每日数据更新');

    // 每日10:15从支付宝获取易方达基金数据（经理、净值、收益率）
    scheduleDaily(() => {
      fetchYiFangDaFundData().catch(err => {
        console.error('[易方达] 定时更新失败:', err.message);
      });
    }, 10, 15, '易方达基金数据更新');

    // 每日10:45更新金选基金数据（经理、净值、收益率）
    scheduleDaily(() => {
      fetchGoldFundData().catch(err => {
        console.error('[金选基金] 定时更新失败:', err.message);
      });
    }, 10, 45, '金选基金数据更新');

    // 每日10:00执行招行理财产品数据爬取
    scheduleDaily(() => {
      console.log('[CMB] 开始爬取招行理财产品数据...');
      const scriptPath = path.join(__dirname, '..', 'scripts', 'fetch_cmb_nav.py');
      const proc = spawn('python', [scriptPath], {
        env: { ...process.env },
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      });
      proc.stdout.on('data', (data) => console.log(`[CMB] ${data.toString().trim()}`));
      proc.stderr.on('data', (data) => console.error(`[CMB] ${data.toString().trim()}`));
      proc.on('close', (code) => console.log(`[CMB] 爬取完成，退出码: ${code}`));
      proc.on('error', (err) => console.error('[CMB] 爬取启动失败:', err.message));
    }, 10, 0, '招行理财产品爬取');

    // 每周一10:30执行个人理财产品净值爬取（weekly更新原有54只 + target更新25只目标产品）
    scheduleDaily(() => {
      const today = new Date();
      if (today.getDay() !== 1) return; // 仅周一执行
      const scriptPath = path.join(__dirname, '..', 'scripts', 'fetch_cmb_personal_nav.py');

      // 先运行 weekly 模式更新原有54只产品
      console.log('[CMB-NAV] 开始爬取个人理财产品净值（weekly）...');
      const proc1 = spawn('python', [scriptPath, 'weekly'], {
        env: { ...process.env },
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      });
      proc1.stdout.on('data', (data) => console.log(`[CMB-NAV-W] ${data.toString().trim()}`));
      proc1.stderr.on('data', (data) => console.error(`[CMB-NAV-W] ${data.toString().trim()}`));
      proc1.on('close', (code) => {
        console.log(`[CMB-NAV-W] weekly完成，退出码: ${code}`);
        // weekly 完成后运行 target 模式更新25只目标产品
        console.log('[CMB-NAV-T] 开始爬取目标产品净值（target）...');
        const proc2 = spawn('python', [scriptPath, 'target'], {
          env: { ...process.env },
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe',
        });
        proc2.stdout.on('data', (data) => console.log(`[CMB-NAV-T] ${data.toString().trim()}`));
        proc2.stderr.on('data', (data) => console.error(`[CMB-NAV-T] ${data.toString().trim()}`));
        proc2.on('close', (code2) => console.log(`[CMB-NAV-T] target完成，退出码: ${code2}`));
        proc2.on('error', (err) => console.error('[CMB-NAV-T] 启动失败:', err.message));
      });
      proc1.on('error', (err) => console.error('[CMB-NAV-W] 启动失败:', err.message));
    }, 10, 30, '个人理财产品净值爬取');

    // 每周六11:00执行招银理财净值数据爬取（最近5个交易日）
    scheduleDaily(() => {
      const day = new Date().getDay();
      if (day !== 6) return; // 仅周六执行
      console.log('[NAV] 开始爬取招银理财净值数据...');
      const scriptPath = path.join(__dirname, '..', 'scripts', 'fetch_zhaoyin_nav.py');
      const proc = spawn('python', [scriptPath, 'weekly'], {
        env: { ...process.env },
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
      });
      proc.stdout.on('data', (data) => console.log(`[NAV] ${data.toString().trim()}`));
      proc.stderr.on('data', (data) => console.error(`[NAV] ${data.toString().trim()}`));
      proc.on('close', (code) => console.log(`[NAV] 爬取完成，退出码: ${code}`));
      proc.on('error', (err) => console.error('[NAV] 爬取启动失败:', err.message));
    }, 11, 0, '招银理财净值爬取');

  } catch (err) {
    console.error('服务器启动失败:', err.message);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭...');
  generalLimiter.destroy();
  updateLimiter.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭...');
  generalLimiter.destroy();
  updateLimiter.destroy();
  process.exit(0);
});

// 防止未处理的错误导致进程崩溃
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err.message);
  // 不退出进程，让连接池自行恢复
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise rejection:', reason);
});

startServer();
