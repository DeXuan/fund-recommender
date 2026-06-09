# 基金推荐助手

基于 React + Node.js + PostgreSQL 的公募基金分析与推荐平台，覆盖 200+ 只主流基金（含 69 只支付宝金选基金），支持 14 大行业深度分析、指数研究、基金对比、风险评估、定投模拟、持仓管理等功能。

## 功能一览

| 模块 | 路由 | 说明 |
|------|------|------|
| 首页看板 | `/web/` | 大盘行情、板块轮动、资金流向、估值温度计、快捷入口、行业推荐 |
| 基金列表 | `/web/funds` | 全市场基金检索，按行业筛选、金选筛选、多维度排序、最多 5 只横向对比 |
| 基金详情 | `/web/funds/:code` | 收益走势、费率明细、估值分析、重仓股、投资建议 |
| QDII 基金 | `/web/qdii` | 纳斯达克 100 / 标普 500 / 全部 QDII 专区，限额监控 |
| 行业分析 | `/web/industry` | 14 大行业深度分析：费率对比、收益排名、综合推荐、分批建仓方案 |
| 沪深 300 | `/web/hs300` | 沪深 300 基金对比、权重股基本面、投资策略 |
| 市场估值 | `/web/market` | 指数估值分位、行业推荐、分批建仓计划 |
| 风险评估 | `/web/risk-assessment` | 5 步问卷测评，输出风险类型 + 个性化资产配置方案 |
| 定投计算器 | `/web/dca-calculator` | 模拟定投收益，月度明细表 + 收益曲线图 |
| 持仓管理 | `/web/portfolio` | 持仓记录、盈亏统计、定投计划、基准对比（需登录） |
| 自选基金 | `/web/watchlist` | 收藏基金、实时行情、一键跳转详情（需登录） |
| 用户登录 | `/web/login` | 用户名密码登录、支付宝扫码登录（新用户自动注册） |

## 技术栈

**前端**
- React 19 + TypeScript
- Vite 8（开发端口 5174，生产 base 路径 `/web/`）
- Ant Design 6 + @ant-design/icons
- React Router 7（basename `/web`）
- ECharts 6（图表可视化）

**后端**
- Express 5（端口 3003）+ helmet 安全中间件
- PostgreSQL 数据库（基金数据持久化）
- 东方财富 API 实时获取基金净值（每 15 分钟自动更新）
- 新浪财经 API 获取市场指数和板块数据

**数据库**
- `funds` - 基金基本信息表（含经理字段）
- `fund_nav` - 基金净值历史表
- `market_indices` - 市场指数表
- `sector_data` - 板块轮动表
- `users` - 用户表
- `fund_records` - 持仓记录表（含定投功能 + 盈亏预计算）
- `dca_plans` - 定投计划表（兼容旧数据）
- `watchlist` - 自选基金表（含分组和排序）
- `risk_profiles` - 风险评估结果表
- `oauth_accounts` - 第三方登录表
- `hs300_fund_details` - 沪深300基金详情表

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写数据库连接信息

# 启动后端（端口 3003）
npm run server

# 新开终端，启动前端（端口 5174）
npm run dev
```

访问 http://localhost:5174/web

## 环境变量

创建 `.env` 文件，配置以下变量：

```env
# JWT 密钥（至少32字符）
JWT_SECRET=your_jwt_secret_here_at_least_32_chars

# CORS 允许的前端域名（逗号分隔）
ALLOWED_ORIGINS=http://your-domain:8688,http://localhost:5173,http://localhost:5174

# 模拟登录（生产环境设为false）
ENABLE_MOCK_AUTH=false

# 支付宝配置（可选）
ALIPAY_APP_ID=your_app_id
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://your-domain:8688/api/auth/alipay/callback

# PostgreSQL 数据库（数据库和服务器在同一台机器，使用localhost）
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=your_database
PG_USER=your_user
PG_PASSWORD=your_password
```

**重要：** 如果数据库和服务器在同一台机器上，`PG_HOST` 必须使用 `localhost`！

## 生产构建

```bash
npm run build        # tsc 类型检查 + vite 构建 → dist/
npm run preview      # 本地预览构建产物
```

## 部署

项目支持一键部署到 Linux 服务器，详见 [DEPLOY.md](./DEPLOY.md) 和 [UPDATE_GUIDE.md](./UPDATE_GUIDE.md)。

### 访问地址
**http://47.116.77.67:8688/web**

### 全新部署
```bash
# 1. 打包项目为 fund-recommender.zip
# 2. 上传到服务器 /tmp/ 目录
# 3. SSH登录服务器运行
bash /tmp/deploy-full.sh
```

### 一键更新
```bash
# 1. 打包项目为 fund-recommender.zip
# 2. 上传到服务器 /var/www/ 目录
# 3. SSH登录服务器运行
bash /var/www/update.sh
```

### 修复脚本
```bash
# 修复服务器问题
bash /var/www/fix-server.sh

# 修复403权限错误
bash /var/www/fix-permission.sh
```

## 项目结构

```
fund-recommender/
├── server/
│   ├── index.cjs            # Express 入口（~200行），启动 + 中间件 + 调度
│   ├── db.cjs               # PostgreSQL 数据库初始化（11 张表）
│   ├── fund-service.cjs     # 基金数据服务层（含分页 + 收益率缓存）
│   ├── fund-data.cjs        # 基金种子数据（200+ 只，覆盖 14 个行业）
│   ├── auth.cjs             # 认证模块（JWT + 支付宝 OAuth + 修改密码 + 管理员权限校验）
│   ├── admin.cjs            # 管理后台模块（用户管理、审计日志、系统监控）
│   ├── portfolio.cjs        # 持仓管理模块（含定投、收益地图、组合洞察）
│   ├── data-fetcher.cjs     # 数据抓取模块（腾讯/新浪/东方财富 API）
│   ├── routes/
│   │   └── api.cjs          # API 路由（基金、市场、工具、行业分析、SP500）
│   └── utils/
│       ├── rate-limiter.cjs # 共享速率限制器（带 TTL 自动清理）
│       ├── scheduler.cjs    # 共享调度器（每日任务、交易时间任务）
│       ├── trading-hours.cjs # 交易时间判断（含中国法定节假日）
│       ├── crypto.cjs       # 加密工具（AES-256-GCM）
│       ├── alipay.cjs       # 支付宝SDK封装
│       └── logger.cjs       # 结构化日志（winston）
├── src/
│   ├── App.tsx              # 路由配置
│   ├── main.tsx             # 入口，Ant Design 全局配置
│   ├── components/
│   │   ├── Navbar.tsx       # 响应式导航栏
│   │   ├── DataStatus.tsx   # 数据更新状态栏
│   │   ├── ErrorBoundary.tsx # 全局错误捕获
│   │   ├── GsapEnhancer.tsx # GSAP 动画增强
│   │   └── ReturnsMap.tsx   # 收益地图组件
│   ├── pages/               # 12 个页面组件（懒加载）
│   ├── services/api.ts      # API 请求封装（fundApi/authApi/portfolioApi/watchlistApi/alertsApi）
│   ├── contexts/AuthContext.tsx # 认证上下文
│   ├── utils/format.ts      # 格式化工具函数
│   └── types/index.ts       # TypeScript 类型定义
├── scripts/
│   ├── generate-alipay-keys.cjs  # 支付宝密钥生成脚本
│   └── test-alipay.cjs           # 支付宝配置测试脚本
├── keys/                    # 支付宝密钥目录（不上传到仓库）
├── deploy-full.sh           # 全新部署脚本
├── update.sh                # 一键更新脚本
├── fix-server.sh            # 服务器修复脚本
├── fix-permission.sh        # 权限修复脚本
├── DEPLOY.md                # 部署文档
├── UPDATE_GUIDE.md          # 更新指南
├── vite.config.ts           # Vite 配置
└── package.json
```

## API 接口

后端运行在 3003 端口，前端通过 `/api` 代理访问。

### 基金数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/funds` | 基金列表（支持 industry/type/sort/order/search 参数） |
| GET | `/api/funds/:code` | 基金详情（6 位基金代码） |
| GET | `/api/funds/qdii` | QDII 基金列表 |
| GET | `/api/funds/hs300` | 沪深 300 基金列表 |

### 市场数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/market/indices` | 市场指数估值 |
| GET | `/api/market/sectors` | 板块轮动数据 |
| GET | `/api/market/capital-flow` | 资金流向数据 |

### 分析推荐
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/recommendations/industry` | 行业推荐 |
| GET | `/api/recommendations/batch-plans` | 分批建仓方案 |
| GET | `/api/industries` | 行业列表 |
| GET | `/api/managers` | 基金经理列表 |
| GET | `/api/star-managers` | 明星基金经理详情 |
| GET | `/api/industry-analysis/:industry` | 行业深度分析（14 个行业） |
| GET | `/api/hs300/analysis` | 沪深 300 深度分析 |
| GET | `/api/sp500/analysis` | 标普 500 深度分析 |

### 工具
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/risk/profile` | 风险评估 |
| POST | `/api/tools/dca` | 定投计算器 |
| POST | `/api/tools/compare` | 基金对比 |
| POST | `/api/tools/compare-nav` | 基金对比净值历史 |

### 用户认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/change-password` | 修改密码（需认证） |
| GET | `/api/auth/me` | 获取当前用户信息 |
| GET | `/api/auth/alipay/qrcode` | 获取支付宝授权URL |
| GET | `/api/auth/alipay/callback` | 支付宝回调处理 |
| GET | `/api/auth/alipay/check` | 检查支付宝授权状态 |
| POST | `/api/auth/alipay/mock-login` | 模拟支付宝登录（仅开发） |

### 自选基金（需要认证）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/watchlist` | 获取自选列表（含净值和收益） |
| POST | `/api/watchlist` | 添加自选基金 |
| DELETE | `/api/watchlist/:fundCode` | 删除自选基金 |
| POST | `/api/watchlist/check` | 批量检查自选状态 |

### 基准与提醒
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/benchmark/hs300` | 沪深300基准数据 |
| GET | `/api/alerts` | 智能提醒（需认证） |
| GET | `/api/market/valuation-trend` | 估值历史趋势 |

### 持仓管理（需要认证）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/portfolio/records` | 获取持仓记录 |
| POST | `/api/portfolio/records` | 添加持仓记录（支持定投设置） |
| PUT | `/api/portfolio/records/:id` | 更新持仓记录 |
| DELETE | `/api/portfolio/records/:id` | 删除持仓记录 |
| GET | `/api/portfolio/summary` | 获取持仓汇总 |
| GET | `/api/portfolio/returns-map` | 收益地图（按日盈亏） |
| GET | `/api/portfolio/insights` | 组合洞察（资产配置分析） |
| GET | `/api/portfolio/risk-profile` | 获取风险评估结果 |
| POST | `/api/portfolio/risk-profile` | 保存风险评估结果 |
| POST | `/api/portfolio/import` | CSV 导入持仓 |
| GET | `/api/portfolio/dca-plans` | 定投计划列表 |
| POST | `/api/portfolio/dca-plans` | 创建定投计划 |
| PUT | `/api/portfolio/dca-plans/:id` | 更新定投计划 |
| DELETE | `/api/portfolio/dca-plans/:id` | 删除定投计划 |
| POST | `/api/portfolio/dca-plans/sync` | 同步定投计划到持仓 |

### 系统
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 数据更新状态 |
| POST | `/api/update` | 手动触发数据更新 |
| GET | `/health` | 健康检查 |

## 覆盖基金类型

ETF、ETF 联接、QDII、指数增强、LOF、债券型、混合型、货币型

覆盖行业：人工智能、半导体/芯片、纳斯达克 100、标普 500、医药、新能源、光伏、消费/白酒、军工、金融/银行、沪深 300、中证 500、创业板、科创 50、恒生科技、黄金、农业、地产、机器人、煤炭、陶瓷/建材 等

### 支付宝金选基金

平台收录 69 只支付宝金选基金，覆盖 20+ 个行业。在基金列表页面点击「金选基金」按钮即可筛选查看。

## 安全措施

- CORS 白名单限制（仅允许指定域名）
- JWT 认证（7 天有效期，JWT_SECRET 启动时强制校验）
- 用户状态实时数据库校验（authMiddleware 检查用户是否被禁用，30 秒 TTL 缓存避免性能损耗）
- 管理员权限实时数据库校验（adminMiddleware 不信任 JWT 缓存的 role，每次查询数据库确认）
- OAuth Token 加密存储（AES-256-GCM，独立加密密钥）
- 支付宝 OAuth CSRF 防护（state 参数 HMAC-SHA256 签名 + timingSafeEqual）
- Mock 登录双重防护（ENABLE_MOCK_AUTH + NODE_ENV 非 production）
- 请求速率限制（通用 300 次/分钟，认证 10 次/分钟，数据更新 3 次/15 分钟）
- helmet 安全中间件（自动管理 CSP、HSTS、X-Content-Type-Options、X-Frame-Options 等 11 项安全头）
- HSTS 仅在 HTTPS 环境下启用（trust proxy + X-Forwarded-Proto）
- 请求体大小限制 10KB
- 输入参数校验（基金代码格式、ID 正整数、搜索长度、数值范围）
- 环境变量敏感信息保护（.env 已 gitignore）
- SQL 参数化查询（全量使用 $1, $2 占位符，防止 SQL 注入）
- 持仓操作 ID 正整数校验（防止无效参数导致数据库错误）
- OAuth 用户密码使用 crypto.randomBytes 生成（非 Math.random）
- React ErrorBoundary 全局错误捕获（防止白屏）
- 路由懒加载（代码分割，减小初始包体积）
- 404 路由兜底（未知路径重定向首页）

## 版本更新记录

### v0.6 (2026-06-09)

**安全加固**
- 禁用用户即时失效：authMiddleware 新增数据库用户状态检查（30 秒 TTL 缓存），管理员禁用用户后现有 JWT 令牌立即失效，无需等待 7 天过期
- 移除 adminMiddleware 中泄露用户敏感信息的 console.log（用户名、ID、角色、状态）

**安全审查**
- 调用 security-review skill 对服务端代码进行全面安全审查
- 验证结果：SQL 参数化查询全覆盖、ORDER BY 白名单校验、JWT 签名验证、bcrypt 密码哈希、OAuth CSRF 防护等安全措施有效

### v0.5 (2026-06-08)

**安全加固**
- 引入 helmet 中间件：替代手动设置安全响应头，自动管理 CSP、HSTS、X-Content-Type-Options 等
- 支付宝回调地址环境变量化：不再硬编码 IP，改为 ALIPAY_RETURN_URL 环境变量
- CSV 导入基金代码校验：添加 6 位数字正则验证，拒绝非法代码
- auth.cjs 代码清理：移除重复的 crypto require 调用
- .env.example 完善：新增 ALLOWED_ORIGINS 配置项，更新 ALIPAY_RETURN_URL 说明

**新增功能**
- 标普500深度分析页：新增 `/web/sp500` 路由，含 14 只标普500基金对比、美股 Top10 权重股分析、建仓方案
- 基金经理管理：新增基金经理列表 API、明星基金经理详情 API
- 修改密码功能：登录用户可修改密码（需验证旧密码）
- 沪深300基金扩容：从 17 只扩展到 37 只，含 15 只指数增强基金
- 标普500基金扩容：从 5 只扩展到 14 只（7 组 A/C 份额），每日限额 10000 元
- 纳斯达克100基金补充：新增华夏/南方/天弘 I/D 类份额
- 行业分析扩展：从 9 个行业扩展到 14 个行业（电力、水电、啤酒/饮料、家电等）
- 首页持仓概览增强：持仓卡片展示更多指标

**数据优化**
- 基金收益率缓存：新增 30 分钟内存缓存，减少外部 API 调用
- 每日数据更新整合：收益率+QDII 限额+HS300+持仓盈亏统一在 9:30 执行
- 沪深300估值数据更新：PE 从 12.5 更新到 14.39，分位从 42% 更新到 87.8%

### v0.4 (2026-06-05)

**新增功能**
- 自选基金：登录用户可收藏基金，独立自选页面，基金列表/详情页星标一键收藏
- 基金对比净值走势：对比模式新增近6月净值走势曲线图，起点归一化展示相对收益
- 持仓 vs 基准对比：持仓页面新增沪深300基准对比线，显示超额收益
- 多因子筛选器：基金列表新增收益阈值、规模区间、费率上限筛选条件
- 估值历史趋势图：市场估值页新增PE/PB分位近12月走势曲线，含20%/80%阈值线
- 智能提醒系统：持仓基金大幅波动提醒、QDII限额提醒、定投到期提醒、估值极低提醒
- 首页持仓概览：登录用户首页显示持仓摘要卡片（总投入/市值/盈亏/收益率 + 前4只基金）
- 基金详情页加入持仓：详情页新增「加入持仓」快捷按钮，预填基金信息
- 持仓页基金跳转：持仓/定投表格的基金名称可点击跳转到基金详情页

**UI优化**
- 持仓总览卡片改为渐变背景设计
- 基金详情页头部改为深色渐变风格（与首页市场概览一致）
- 导航栏新增消息提醒铃铛和自选基金入口

**后端新增API**
- `GET/POST/DELETE /api/watchlist` - 自选基金CRUD
- `POST /api/watchlist/check` - 批量检查自选状态
- `POST /api/tools/compare-nav` - 基金对比净值历史
- `GET /api/benchmark/hs300` - 沪深300基准数据
- `GET /api/alerts` - 智能提醒数据
- `GET /api/market/valuation-trend` - 估值历史趋势

**数据库**
- 新增 `watchlist` 表（自选基金，含分组和排序）

### v0.3 (2026-06-05)

**新增功能**
- 煤炭行业基金：新增 9 只煤炭行业基金（招商、国泰、国联、富国），支持行业深度分析
- 陶瓷/建材行业：新增陶瓷/建材行业分析
- 支付宝金选基金：收录 69 只金选基金，基金列表支持金选筛选按钮
- 行业分析扩展：从 7 个行业扩展到 9 个行业（煤炭、陶瓷/建材）
- 首页快捷入口优化：去重、新增 QDII 入口、描述更准确
- 行业推荐展示：从 4 个增加到 6 个行业

**安全修复**
- OAuth 用户密码改用 crypto.randomBytes（替换 Math.random）
- 移除已废弃的 X-XSS-Protection 响应头
- HSTS 仅在 HTTPS 下启用（避免无效 header）
- Mock 登录增加 NODE_ENV=production 双重防护
- 持仓/定投 ID 参数增加正整数校验
- 移除 api.cjs 中的 DEBUG 日志
- getAllFundsWithNav 修复 count query 正则匹配错误

**前端优化**
- 新增 ErrorBoundary 全局错误捕获组件
- 路由懒加载（React.lazy + Suspense）
- 404 路由兜底（未知路径重定向首页）
- FundDetail 区分「加载失败」和「基金不存在」
- RiskAssessment、DCACalculator、Home 增加错误提示
- Portfolio 删除操作改用 Promise.all（修复 fire-and-forget）
- 清理死代码：FundCompare.tsx、useApi.ts
- 清理未使用导入：BellOutlined、Link

**数据库**
- fund-service.cjs 修复 count query 正则（匹配 LATERAL 子查询中的 FROM）

### v0.2 (2026-06-05)

**新增功能**
- 支付宝扫码登录：用户可通过支付宝APP扫码完成登录注册
- 新用户自动注册：首次使用支付宝登录的用户自动创建账户
- 老用户直接登录：已绑定支付宝的用户直接登录
- 支付宝SDK集成：使用alipay-sdk处理RSA2签名和API调用
- 密钥生成工具：`npm run generate-alipay-keys` 生成RSA密钥对
- 配置测试工具：`npm run test-alipay` 测试支付宝配置

**部署优化**
- 一键部署脚本：`deploy-full.sh` 全新部署
- 一键更新脚本：`update.sh` 更新已有部署
- 服务器修复脚本：`fix-server.sh` 修复常见问题
- 权限修复脚本：`fix-permission.sh` 修复403错误
- 自动备份：更新时自动备份当前版本到 `/var/www/backups/`

**安全增强**
- 支付宝OAuth CSRF防护（state参数HMAC-SHA256签名）
- 支付宝授权时序安全比较（crypto.timingSafeEqual）
- OAuth Token加密存储（AES-256-GCM）

**文档完善**
- 部署文档：`DEPLOY.md`
- 更新指南：`UPDATE_GUIDE.md`
- 支付宝配置：`docs/ALIPAY_SETUP.md`
- 登录功能说明：`docs/ALIPAY_SCAN_LOGIN.md`

### v0.1 (2026-06-04)

**核心功能**
- 基金列表：全市场基金检索，按行业筛选、多维度排序
- 基金详情：收益走势、费率明细、估值分析、重仓股、投资建议
- 基金对比：最多5只基金横向对比，30+指标
- QDII基金：纳斯达克100/标普500专区
- 行业分析：7大行业深度分析
- 沪深300：17只基金对比、权重股分析
- 市场估值：指数估值分位、行业推荐
- 风险评估：5步问卷测评
- 定投计算器：模拟定投收益
- 持仓管理：持仓记录、盈亏统计

**技术架构**
- 前端：React 19 + TypeScript + Vite 8 + Ant Design 6
- 后端：Express 5 + Node.js
- 数据库：PostgreSQL
- 数据源：东方财富API、新浪财经API

**安全措施**
- JWT认证
- CORS白名单限制
- 请求速率限制
- 安全响应头
- SQL参数化查询
- 输入参数校验

---

## 安全漏洞修复记录

| 日期 | 严重性 | 问题 | 修复方案 |
|------|--------|------|----------|
| 2026-06-04 | CRITICAL | JWT Secret 使用硬编码默认值 | 强制从环境变量读取，缺失时启动失败 |
| 2026-06-04 | CRITICAL | 数据库密码硬编码在代码中 | 移除硬编码默认值，强制使用环境变量 |
| 2026-06-04 | CRITICAL | Mock 登录端点在 NODE_ENV 未设置时可访问 | 改用 ENABLE_MOCK_AUTH 环境变量控制，默认关闭 |
| 2026-06-04 | CRITICAL | OAuth 回调将 JWT 放入 URL 查询参数 | 改用 Fragment (#) 传递，防止日志和 Referer 泄露 |
| 2026-06-04 | CRITICAL | CORS 允许无 Origin 请求通过 | 移除 `!origin` 放行，仅允许白名单域名 |
| 2026-06-04 | CRITICAL | OAuth state 签名截断导致回调验证失败 | 使用完整 256-bit HMAC 签名 + timingSafeEqual 比较 |
| 2026-06-04 | HIGH | /api/update 端点无需认证即可触发 | 添加 authMiddleware 认证保护 |
| 2026-06-04 | HIGH | OAuth state 使用 Math.random() 生成 | 改用 crypto.randomBytes() 密码学安全随机数 |
| 2026-06-04 | HIGH | PUT 持仓记录端点缺少输入验证 | 添加 shares > 0 和 cost_price > 0 校验 |
| 2026-06-04 | HIGH | 前端密码最小长度 6 与后端 8 不一致 | 前端统一为 min: 8 |
| 2026-06-04 | HIGH | 基金排序字段映射错误导致 SQL 报错 | 建立 camelCase → 数据库列名映射表 |
| 2026-06-04 | HIGH | 未配置 trust proxy 导致速率限制失效 | 添加 `app.set('trust proxy', 1)` |
| 2026-06-04 | MEDIUM | CSP 允许 unsafe-eval | 移除 unsafe-eval，保留 unsafe-inline |
| 2026-06-04 | MEDIUM | CSV 导入缺少数值和日期验证 | 添加正数校验和 YYYY-MM-DD 格式验证 |
| 2026-06-04 | MEDIUM | OAuth state 签名使用时间不安全比较 | 改用 crypto.timingSafeEqual 防止时序攻击 |
| 2026-06-04 | - | iconv-lite 未在 package.json 中声明 | 添加为显式依赖 |
| 2026-06-04 | - | 风险评估前后端选项不匹配 | 统一前后端选项映射 |
| 2026-06-04 | - | 持仓计算使用静态种子数据 | 改用数据库实时净值 |
| 2026-06-04 | - | 基金详情使用 Math.random() 生成伪数据 | 改用确定性算法，保证数据一致性 |
| 2026-06-04 | HIGH | index.cjs 单体文件 1907 行，职责混乱 | 拆分为 data-fetcher.cjs + routes/api.cjs + utils/，入口精简至 ~200 行 |
| 2026-06-04 | MEDIUM | 速率限制器在 auth.cjs 和 index.cjs 中重复实现 | 提取为 server/utils/rate-limiter.cjs 共享模块 |
| 2026-06-04 | MEDIUM | 调度器逻辑（跳过周末、9:30 执行）重复 3 次 | 提取为 server/utils/scheduler.cjs 共享模块 |
| 2026-06-04 | MEDIUM | OAuth access_token 明文存储在数据库 | 使用 AES-256-GCM 加密存储（server/utils/crypto.cjs） |
| 2026-06-04 | MEDIUM | isTradingDay 仅判断周末，忽略法定节假日 | 新增 server/utils/trading-hours.cjs，内置 2025-2026 休市日历 + 调休工作日 |
| 2026-06-04 | MEDIUM | 基金查询无分页，数据量增长后有性能风险 | getAllFundsWithNav 新增 page/pageSize 参数，返回分页元数据 |
| 2026-06-04 | LOW | 进程退出时 setInterval 定时器未清理 | 新增 SIGTERM/SIGINT 处理，调用 limiter.destroy() 清理 |
| 2026-06-04 | HIGH | generateFundDetail() 引用不存在的 req 变量导致运行时报错 | 移除对 req 的引用，lastUpdateTime 由调用方自行获取 |
| 2026-06-04 | MEDIUM | destroyAll() 未清理 setInterval 定时器，存在资源泄漏 | 跟踪所有 cleanupInterval 引用，destroyAll() 时统一 clearInterval |
| 2026-06-05 | HIGH | OAuth 用户密码使用 Math.random() 生成（非密码学安全） | 改用 crypto.randomBytes(32).toString('hex') |
| 2026-06-05 | MEDIUM | X-XSS-Protection 响应头已废弃，可能引入漏洞 | 移除该 header |
| 2026-06-05 | MEDIUM | HSTS 在 HTTP 环境下无效 | 仅在 HTTPS 下设置 Strict-Transport-Security |
| 2026-06-05 | MEDIUM | Mock 登录可通过 ENABLE_MOCK_AUTH=true 在生产环境启用 | 增加 NODE_ENV !== 'production' 双重检查 |
| 2026-06-05 | MEDIUM | 持仓/定投路由 :id 参数未校验为正整数 | 添加 parseInt + isNaN + id <= 0 校验 |
| 2026-06-05 | LOW | api.cjs 行业分析路由遗留 DEBUG 日志 | 移除 console.log 调试输出 |
| 2026-06-05 | HIGH | getAllFundsWithNav count query 正则匹配到子查询 FROM | 改用 indexOf + lastIndexOf 精确定位 |
| 2026-06-05 | HIGH | 前端无 ErrorBoundary，运行时错误导致白屏 | 新增 ErrorBoundary 组件包裹路由 |
| 2026-06-05 | MEDIUM | 所有页面组件同步加载，无代码分割 | 改用 React.lazy + Suspense 懒加载 |
| 2026-06-05 | LOW | 无 404 路由，未知路径显示空白页 | 添加 `path="*"` 兜底路由 |
| 2026-06-05 | LOW | FundCompare.tsx (475行) 和 useApi.ts 从未被引用 | 删除死代码 |
| 2026-06-05 | MEDIUM | 多个页面 API 失败时无用户反馈 | 增加 message.error 错误提示 |
| 2026-06-05 | MEDIUM | Portfolio 删除持仓用 forEach 无 await | 改用 Promise.all + await |
| 2026-06-05 | MEDIUM | CORS 允许无 Origin 请求（.env 变更后） | 保持 !origin 放行（Bearer token API 可接受） |
| 2026-06-08 | HIGH | 行业基金代码和名称与支付宝数据不匹配 | 从天天基金网验证并更新所有14个行业的基金代码和名称 |
| 2026-06-08 | MEDIUM | 安全响应头手动设置不完整，缺少部分 helmet 标准头 | 引入 helmet 中间件，自动管理 X-Content-Type-Options、X-Frame-Options、CSP、HSTS 等 |
| 2026-06-08 | MEDIUM | 支付宝回调地址硬编码在代码中（IP 地址） | 改为从 ALIPAY_RETURN_URL 环境变量读取，.env.example 已更新 |
| 2026-06-08 | MEDIUM | CSV 导入缺少基金代码格式校验 | 添加 `/^\d{6}$/` 正则校验，拒绝非法基金代码 |
| 2026-06-08 | MEDIUM | auth.cjs 中 crypto 模块重复 require（函数内部） | 移除 mock-login 和 alipay/callback 中的重复 require，使用顶部已导入的 crypto |
| 2026-06-08 | LOW | .env.example 缺少 ALLOWED_ORIGINS 配置说明 | 新增 ALLOWED_ORIGINS 示例，更新 ALIPAY_RETURN_URL 说明 |
| 2026-06-09 | HIGH | adminMiddleware 仅校验 JWT 中的 role 字段，管理员降权后旧 token 仍有效（最长 7 天） | adminMiddleware 改为实时查询数据库 role/status，不信任 JWT 缓存的 role |
| 2026-06-09 | MEDIUM | POST /api/update 手动数据更新端点仅需认证，普通用户可触发全量数据刷新 | 添加 adminMiddleware，仅管理员可触发手动数据更新 |
| 2026-06-09 | MEDIUM | POST /api/cmb-products/update 和 /api/cmb-zhaoyin-nav/update 仅需认证，普通用户可触发 Python 爬虫进程 | 添加 adminMiddleware，仅管理员可触发招行理财产品数据更新 |
| 2026-06-09 | MEDIUM | deploy-full.sh Nginx 配置缺少安全响应头（X-Frame-Options、X-Content-Type-Options 等） | 添加 5 项安全响应头：X-Content-Type-Options、X-Frame-Options、Referrer-Policy、Permissions-Policy |
| 2026-06-09 | LOW | deploy-full.sh 安装 Node.js 18.x（已 EOL） | 升级为 Node.js 20.x LTS |
| 2026-06-09 | LOW | db.cjs 连接池 max=2 过小，高并发时连接等待 | 调整为 max=10，idleTimeoutMillis=5000，添加 keepAlive |
| 2026-06-09 | HIGH | DataStatus 组件「刷新」按钮触发 POST /api/update，普通用户点击返回 403 无提示 | 按钮仅管理员可见，非管理员点击显示 warning 提示 |
| 2026-06-09 | MEDIUM | fetchApi 错误处理丢弃服务器返回的具体错误信息，用户只看到 "API error: 500" | 改为读取 response body 中的 error 字段，展示具体错误信息 |
| 2026-06-09 | LOW | FundList 页面 mount 时 loadFunds() 被两个 useEffect 重复调用 | 移除第一个 useEffect 中的 loadFunds() 调用，由第二个 useEffect 统一处理 |
| 2026-06-09 | HIGH | deploy.sh rsync 缺少 server/admin.cjs，部署后服务器启动崩溃 | 将 admin.cjs 加入 rsync 上传列表 |
| 2026-06-09 | HIGH | deploy-full.sh 使用占位符 JWT_SECRET，管理员可能忘记修改导致安全风险 | 改为自动生成随机 JWT_SECRET（openssl rand -hex 48） |
| 2026-06-09 | MEDIUM | deploy-full.sh 和 update.sh 缺少 pm2 startup，服务器重启后应用不会自动启动 | 添加 pm2 startup 配置 |
| 2026-06-09 | MEDIUM | fix-server.sh 数据库测试使用硬编码占位符密码，永远连接失败 | 改为从 .env 文件读取数据库配置 |
| 2026-06-09 | MEDIUM | DEPLOY.md 目录结构缺少 admin.cjs、data-fetcher.cjs、routes/、utils/ 等关键文件 | 更新目录结构，完整列出所有服务端模块 |
| 2026-06-09 | MEDIUM | DEPLOY.md Nginx 配置缺少安全响应头，与 deploy-full.sh 实际配置不一致 | 同步添加 5 项 Nginx 安全响应头 |
| 2026-06-09 | MEDIUM | DEPLOY.md 回滚方案使用 git 命令，但服务器部署基于 zip/rsync 无 git 仓库 | 改为从备份 tarball 恢复或重新部署旧版本 |
| 2026-06-09 | LOW | DEPLOY.md Node.js 版本要求 ≥18，已 EOL | 更新为 ≥20（LTS） |
| 2026-06-09 | LOW | DEPLOY.md 和 UPDATE_GUIDE.md 未提及 Python 依赖（招行数据爬取需要） | 添加 Python 3.8+ 依赖说明 |
| 2026-06-09 | LOW | UPDATE_GUIDE.md 缺少更新后验证步骤 | 添加 .env 验证、后端日志、API 响应、前端访问 4 步检查 |
| 2026-06-09 | HIGH | 禁用用户仍可使用现有 JWT 令牌访问系统（最长 7 天） | authMiddleware 新增数据库用户状态检查（30 秒 TTL 缓存），禁用用户的所有请求立即返回 403 |
| 2026-06-09 | MEDIUM | adminMiddleware 输出用户敏感信息到控制台（用户名、ID、角色、状态） | 移除 console.log 调试输出，避免生产环境泄露用户隐私 |

## License

ISC
