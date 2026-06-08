require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { allFunds, fundManagerMap } = require('./fund-data.cjs');
const { initDatabase } = require('./db.cjs');
const fundService = require('./fund-service.cjs');
const authRoutes = require('./auth.cjs');
const portfolioRoutes = require('./portfolio.cjs');
const { createRateLimit } = require('./utils/rate-limiter.cjs');
const { scheduleDaily } = require('./utils/scheduler.cjs');
const { isTradingHours, isTradingDay, getNextUpdateTime } = require('./utils/trading-hours.cjs');
const {
  fetchCapitalFlow, fetchQDIIData, fetchHS300FundDetails,
  updateAllFundData: fetchUpdateAllFundData, updateAllFundReturns, updatePortfolioPnl,
  runDailyDataUpdate,
  defaultIndices,
} = require('./data-fetcher.cjs');
const { router: apiRoutes, createStatusRoute, createUpdateRoute } = require('./routes/api.cjs');

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

// 认证和记账路由
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);

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
  await fetchUpdateAllFundData(allFunds, dataUpdateStatus, isTradingDay, getNextUpdateTime, () => updateAllFundReturns(allFunds));
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
    await initDatabase();
    console.log('数据库初始化完成');

    // 同步种子数据（ON CONFLICT DO UPDATE，fund-data.cjs 为数据源）
    const fundCount = await fundService.getFundCount();
    console.log(`[种子数据] 数据库已有 ${fundCount} 只基金，同步 fund-data.cjs ...`);
    await fundService.seedFunds(allFunds);
    const newCount = await fundService.getFundCount();
    if (newCount > fundCount) {
      console.log(`[种子数据] 新增 ${newCount - fundCount} 只基金`);
    } else {
      console.log(`[种子数据] 已同步 ${newCount} 只基金数据`);
    }

    // 更新基金经理信息
    await fundService.updateFundManagers(fundManagerMap);

    // 初始化市场指数
    await fundService.initMarketIndices(defaultIndices);

    // 启动自动更新（开盘时间每15分钟更新净值+指数）
    startAutoUpdate();
    scheduleCapitalFlowUpdate();

    // 每日9:30执行完整数据更新（收益率+QDII限额+HS300+持仓盈亏）
    scheduleDaily(() => runDailyDataUpdate(allFunds), 9, 30, '每日数据更新');

    app.listen(PORT, () => {
      console.log(`基金推荐服务器运行在 http://localhost:${PORT}`);
    });
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

startServer();
