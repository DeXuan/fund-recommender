# 基金推荐助手

<!-- 徽章全部为静态：仓库为私有，GitHub API / Actions badge 对匿名访问均不可读，动态徽章无法渲染 -->
[![CI](https://img.shields.io/badge/CI-passing-brightgreen?style=flat-square&logo=github)](https://github.com/DeXuan/fund-recommender/actions)
[![Version](https://img.shields.io/badge/Version-1.2.0-blue?style=flat-square)](https://github.com/DeXuan/fund-recommender)
[![License](https://img.shields.io/badge/License-ISC-purple?style=flat-square)](https://github.com/DeXuan/fund-recommender)
[![Language](https://img.shields.io/badge/Language-TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://github.com/DeXuan/fund-recommender)
[![Frameworks](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Backend](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/PostgreSQL-14-4169e1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Frontend](https://img.shields.io/badge/React_Router-7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)](https://reactrouter.com)
[![Charts](https://img.shields.io/badge/ECharts-6-AA344D?style=flat-square&logo=apacheecharts&logoColor=white)](https://echarts.apache.org)
[![Mobile](https://img.shields.io/badge/Capacitor-8-119eff?style=flat-square&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![AI](https://img.shields.io/badge/Claude-API-CC785C?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Build](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)

> 基于 React + Node.js + PostgreSQL 的公募基金分析与推荐平台，覆盖 6500+ 只公募股票/指数/QDII 基金（含 168 只金选基金），支持 14 大行业深度分析、AI 智能选股引擎（七因子量化模型）、指数研究、基金对比、风险评估、定投模拟、持仓管理、AI 助手等功能。支持 Web 端 + Android APK 双端使用。三档会员体系（免费 / 会员 / 至尊 SVIP）。

## 🚀 在线演示

平台已正式部署上线，可直接访问体验：

### 网页版

🔗 **http://111.229.32.106:8686/web/**
<img width="1909" height="1080" alt="ScreenShot_2026-08-16_163050_508" src="https://github.com/user-attachments/assets/05cca001-7ee3-454b-b8b1-69c88341439a" />

已部署：Ubuntu 服务器 · Nginx 反向代理 + Express 5 + PostgreSQL · PM2 守护 · 每 15 分钟自动更新基金净值 · 集思录实时财经日历。

### 安卓 App

支持 Android APK 客户端（Capacitor 打包），与 Web 端数据互通。可配合后端服务使用。

---

> 📌 **展示提示**：向用户/客户演示时，直接打开上方网页版链接即可体验完整的基金分析、AI 选股、风险评估、持仓管理等全部功能，无需本地部署。

---

## 项目架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户浏览器                               │
│                    http://host:8688/web                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │     Nginx       │
                    │   (:8688)       │
                    │  ┌───────────┐  │
                    │  │ 静态文件   │  │──── /web/* → dist/ (React SPA)
                    │  └───────────┘  │
                    │  ┌───────────┐  │
                    │  │ 反向代理   │  │──── /api/* → http://127.0.0.1:3003
                    │  └───────────┘  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Express 5      │
                    │  (PM2 守护)      │
                    │  :3003          │
                    │                 │
                    │  ┌───────────┐  │    ┌──────────────────┐
                    │  │ 认证中间件 │  │    │  外部 API         │
                    │  │ JWT+OAuth  │  │    │  东方财富/新浪/   │
                    │  └───────────┘  │    │  支付宝           │
                    │  ┌───────────┐  │    └──────────────────┘
                    │  │ 路由层     │  │
                    │  │ 7个领域模块 │  │
                    │  └───────────┘  │
                    │  ┌───────────┐  │    ┌──────────────────┐
                    │  │ 服务层     │──│───→│  PostgreSQL       │
                    │  │ fund-svc   │  │    │  (31 张表)        │
                    │  └───────────┘  │    └──────────────────┘
                    │  ┌───────────┐  │
                    │  │ 定时任务   │  │    每 15 分钟自动更新净值
                    │  │ scheduler  │  │    每日 9:30 更新收益率
                    │  └───────────┘  │
                    └─────────────────┘
```

> 当前生产服务器 `111.229.32.106`。旧站：`http://111.229.32.106:8688/web`（`/var/www/jijin`，PM2 `fund-server`，后端 3003）；新站：`http://111.229.32.106:8686/web`（`/var/www/jijin85`，PM2 `fund-server-85`，后端 3303）。

## 功能模块

### 免费功能

| 模块 | 路由 | 说明 |
|------|------|------|
| 首页看板 | `/web/` | 大盘行情、板块轮动、资金流向、估值温度计、快捷入口、行业推荐 |
| 基金列表 | `/web/funds` | 全市场基金检索，按行业筛选、金选筛选、多维度排序、最多 5 只横向对比 |
| 基金详情 | `/web/funds/:code` | 收益走势、费率明细、估值分析、重仓股、投资建议 |
| QDII 基金 | `/web/qdii` | 纳斯达克 100 / 标普 500 / 全部 QDII 专区，限额监控 |
| 行业分析 | `/web/industry` | 14 大行业深度分析：费率对比、收益排名、综合推荐、分批建仓方案 |
| 沪深 300 | `/web/hs300` | 沪深 300 基金对比、权重股基本面、投资策略 |
| 市场估值 | `/web/market` | 指数估值分位、行业推荐、分批建仓计划 |
| 基金对比 | `/web/fund-compare` | 多只基金横向对比分析 |
| 事件日历 | `/web/events` | 市场事件日历与新闻推送 |
| 招行理财 | `/web/cmb-products` | 招商银行理财产品净值追踪 |
| 招行理财详情 | `/web/cmb-products/:code` | 单只招行理财产品详情，含净值走势图、风险等级、累计收益 |
| 用户登录 | `/web/login` | 用户名密码登录、支付宝扫码登录（新用户自动注册） |
| 关于 | `/web/about` | 应用版本信息、技术栈、版权归属 |

### 会员功能（需登录）

| 模块 | 路由 | 说明 |
|------|------|------|
| 持仓管理 | `/web/portfolio` | 持仓记录、盈亏统计、定投计划、基准对比、收益地图、组合洞察、交易行为分析、目标规划、智能定投、深度分析 |
| 自选基金 | `/web/watchlist` | 收藏基金、实时行情、一键跳转详情 |
| AI 选股引擎 | `/web/stock-picker` | 七因子量化模型、4 种策略、回测验证、一键建仓、行业洞察、量化精选、选股历史 |
| 基金诊断 | `/web/fund-diagnosis` | AI 驱动的基金深度诊断（盈利能力、风险抵抗、费率分析、同类对比） |
| 持仓重叠 | `/web/portfolio-overlap` | 持仓基金重叠度分析 |
| 估值中心 | `/web/valuation-center` | 全市场估值概览与历史分位 |
| 个人中心 | `/web/profile` | 个人信息编辑、账户安全、登录历史、会员状态 |
| 订阅会员 | `/web/subscription` | 三档会员开通与管理（支付宝扫码支付） |
| AI 助手 | `/web/ai-assistant` | 智能问答助手（支持斜杠命令：/diagnose, /portfolio, /market, /stockpick, /risk, /dca） |

### 至尊 SVIP 专属功能

| 功能 | 说明 |
|------|------|
| AI 智能筛选 | 自然语言描述需求，AI 解析并筛选基金（如"近1年收益>20%的低费率沪深300基金"） |
| 自定义因子权重 | 5 大因子（收益/费率/规模/动量/估值）自由调节权重，打造个性化选股模型 |
| A/B/C/D 基金评级 | 五因子综合评分，自动标注优势与风险 |
| 指数温度计 | PE/PB 分位加权估值温度（0-100），五档信号（极寒/偏冷/适中/偏热/极热） |
| 相关性分析 | Pearson 相关矩阵热力图，分散化评分，高相关组合预警 |
| 投资组合优化 | 等权分配 + 回测验证 + 可配置基准（沪深300/中证500/中证1000/创业板） |

## 技术栈

**前端**
- React 19 + TypeScript
- Vite 8（开发端口 8866，生产 base 路径 `/web/`）
- Ant Design 6 + @ant-design/icons
- React Router 7（basename `/web`）
- ECharts 6（图表可视化）
- GSAP 3（滚动动画增强）
- React Markdown（AI 助手 Markdown 渲染）

**后端**
- Express 5（端口 3003）+ helmet 安全中间件
- PostgreSQL 数据库（基金数据持久化）
- Anthropic Claude SDK（AI 助手、基金诊断）
- 东方财富 API 实时获取基金净值（每 15 分钟自动更新）
- 新浪财经 API 获取市场指数和板块数据
- 支付宝 SDK（OAuth 登录 + 扫码支付）
- winston 结构化日志

**移动端（Android）**
- Capacitor 8（Web → Native WebView 包装）
- 自适应图标 + 启动屏（全分辨率覆盖）
- 支持 HTTP 明文请求（cleartext traffic）

**数据库（31 张表）**

| 表名 | 说明 |
|------|------|
| `funds` | 基金基本信息表（含经理字段） |
| `fund_nav` | 基金净值历史表 |
| `market_indices` | 市场指数表 |
| `sector_data` | 板块轮动表 |
| `users` | 用户表（含角色、状态、订阅、会员等级、登录锁定） |
| `fund_records` | 持仓记录表（含定投功能 + 盈亏预计算 + 卖出记录） |
| `dca_plans` | 定投计划表（兼容旧数据） |
| `watchlist` | 自选基金表（含分组和排序） |
| `risk_profiles` | 风险评估结果表 |
| `oauth_accounts` | 第三方登录表 |
| `hs300_fund_details` | 沪深 300 基金详情表 |
| `cmb_products` | 招行理财产品表 |
| `cmb_zhaoyin_nav` | 招银理财净值表 |
| `subscription_plans` | 订阅套餐表（含 SVIP 套餐） |
| `subscription_orders` | 订阅订单表 |
| `login_logs` | 登录审计日志表 |
| `admin_audit_logs` | 管理员操作审计表 |
| `user_notes` | 用户备注表 |
| `alert_rules` | 告警规则表 |
| `alert_history` | 告警历史表 |
| `api_stats` | API 请求统计表 |
| `system_config` | 系统配置表 |
| `system_events` | 系统事件表 |
| `chat_history` | AI 聊天历史表（会话追踪、角色、内容、JSONB 数据） |
| `asset_accounts` | 多账户资产台账（账户类型、余额、成本、币种、图标、颜色） |
| `budget_rules` | 预算控制规则表（分类月度限额、告警阈值） |
| `saved_screeners` | 用户保存的筛选方案 |
| `stock_pick_history` | 选股历史记录 |
| `saved_portfolios` | 用户保存的投资组合 |
| `stock_alert_rules` | 选股提醒规则 |
| `index_temperature` | 指数估值温度缓存 |

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20 LTS | 后端运行时 |
| npm | >= 9 | 包管理 |
| PostgreSQL | >= 14 | 数据库 |
| Nginx | >= 1.18 | 反向代理（生产环境） |
| Python | >= 3.8 | 招行数据爬取（可选） |
| JDK | >= 17 | Android APK 构建（可选） |
| Android SDK | >= 34 | Android APK 构建（可选） |

## 快速开始

```bash
# 1. 克隆项目
git clone <repo-url> fund-recommender
cd fund-recommender

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填写数据库连接信息

# 4. 初始化数据库（首次运行自动建表）
node -e "require('./server/db.cjs').initDatabase().then(() => console.log('Done'))"

# 5. 启动后端（端口 3003）
npm run server

# 6. 新开终端，启动前端（端口 5174）
npm run dev
```

访问 http://localhost:5174/web

## 环境变量

创建 `.env` 文件，配置以下变量：

```env
# JWT 密钥（至少32字符，使用以下命令生成）
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=your_jwt_secret_here_at_least_32_chars

# CORS 允许的前端域名（逗号分隔，APK 需加上 http://localhost 和 https://localhost）
ALLOWED_ORIGINS=http://your-domain:8688,http://localhost:5173,http://localhost:5174,http://localhost:8866,http://localhost,https://localhost

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

## Android APK 构建

项目支持通过 Capacitor 打包为 Android APK，适配红米 K60 等安卓设备。

### 一键构建

```bash
bash build-apk.sh
```

### 手动构建

```bash
# 1. 安装依赖
npm install

# 2. 构建前端（Capacitor 模式，base 路径改为 ./）
npm run cap:build

# 3. 生成图标（自适应图标 + 启动屏，覆盖全分辨率）
node scripts/generate-icons.cjs

# 4. 同步到 Android 项目
npx cap sync android

# 5. 构建 APK
npm run cap:apk
```

构建产物：`android/app/build/outputs/apk/debug/app-debug.apk`

### APK 配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| appId | `com.guanfundrecommender.app` | 应用包名 |
| versionName | `1.0.0` | 版本号 |
| minSdk | 24 | Android 7.0+ |
| targetSdk | 36 | Android 16 |
| androidScheme | `http` | 本地页面加载协议 |
| cleartext | `true` | 允许 HTTP 明文请求 |

### 多版本并存

通过修改 `capacitor.config.ts` 中的 `appId` 和 `android/app/build.gradle` 中的 `applicationId`，每个版本使用不同的包名后缀（如 `.v100`、`.v101`），同一设备可安装多个版本。

### 服务器端 CORS 配置

APK 请求的 Origin 为 `http://localhost`（Capacitor WebView 默认），需在服务器 `.env` 中添加：

```env
ALLOWED_ORIGINS=...,http://localhost,https://localhost
```

## 部署

项目支持多种部署方式，详见 [DEPLOY.md](./docs/deploy/DEPLOY.md)。

### 一键部署（Linux 服务器）

```bash
# 全新部署
# 1. 打包项目为 fund-recommender.zip
# 2. 上传到服务器 /tmp/ 目录
# 3. SSH 登录服务器运行
bash /tmp/deploy-full.sh
```

```bash
# 一键更新
# 1. 打包项目为 fund-recommender.zip
# 2. 上传到服务器 /var/www/ 目录
# 3. SSH 登录服务器运行
bash /var/www/update.sh
```

### 本地开发（Windows）

```bash
# 双击 deploy.bat 或在终端运行
deploy.bat
```

### 修复脚本

```bash
bash /var/www/fix-server.sh      # 修复服务器问题
bash /var/www/fix-permission.sh  # 修复 403 权限错误
```

### 部署环境

| 环境 | 说明 | 配置要点 |
|------|------|----------|
| 开发环境 | 本地开发调试 | `ENABLE_MOCK_AUTH=true`，Vite 热更新 |
| 测试环境 | 功能验证 | 独立数据库，允许 mock 登录 |
| 生产环境 | 正式上线 | `ENABLE_MOCK_AUTH=false`，HTTPS，pm2 守护 |

详见 [DEPLOY.md](./docs/deploy/DEPLOY.md) 中的「多环境部署方案」章节。

## 项目结构

```
fund-recommender/
├── server/
│   ├── index.cjs              # Express 入口，启动 + 中间件 + 调度
│   ├── db.cjs                 # PostgreSQL 数据库初始化（25 张表）
│   ├── fund-service.cjs       # 基金数据服务层（含分页 + 收益率缓存）
│   ├── fund-data.cjs          # 基金种子数据（200+ 只，覆盖 14 个行业）
│   ├── auth.cjs               # 认证模块（JWT + 支付宝 OAuth + 管理员权限校验）
│   ├── admin.cjs              # 管理后台模块（用户管理、审计日志、系统监控）
│   ├── portfolio.cjs          # 持仓管理模块（含定投、收益地图、组合洞察）
│   ├── data-fetcher.cjs       # 数据抓取模块（腾讯/新浪/东方财富 API）
│   ├── news-fetcher.cjs       # 新闻抓取模块
│   ├── calendar-fetcher.cjs   # 实时财经日历抓取（集思录，30分钟缓存）
│   ├── fund-analysis.cjs      # 基金诊断分析引擎
│   ├── subscription-service.cjs # 订阅会员服务
│   ├── jobs/
│   │   └── index.cjs          # 定时任务注册中心（QDII/估值/净值/板块等）
│   ├── routes/
│   │   ├── api.cjs            # 路由聚合层（薄壳，挂载子路由）
│   │   ├── funds.cjs          # 基金路由（列表、详情、QDII、金选、易方达）
│   │   ├── market.cjs         # 市场路由（指数、板块、资金流向、估值）
│   │   ├── industry.cjs       # 行业分析路由（14行业、HS300、SP500）
│   │   ├── tools.cjs          # 工具路由（风险评估、定投计算器）
│   │   ├── cmb.cjs            # 招行理财产品路由
│   │   ├── news.cjs           # 财经新闻路由
│   │   ├── alerts.cjs         # 智能提醒路由
│   │   ├── fund-compare.cjs   # 基金对比路由
│   │   ├── fund-diagnosis.cjs # 基金诊断路由（AI 驱动）
│   │   ├── ai-assistant.cjs   # AI 助手路由（Claude API + 斜杠命令）
│   │   ├── stock-picker.cjs   # AI 选股路由（多因子量化模型，750 行）
│   │   ├── stock-picker-user.cjs # 选股用户数据路由（筛选器/历史/组合/CSV导出）
│   │   ├── stock-picker-temperature.cjs # 指数温度计路由
│   │   ├── stock-picker-nl.cjs # 自然语言筛选路由（SVIP 专属）
│   │   ├── stock-picker-corr.cjs # 相关性分析路由
│   │   ├── stock-picker-alerts.cjs # 选股提醒规则路由
│   │   ├── subscription.cjs   # 订阅支付路由（支付宝扫码）
│   │   ├── watchlist.cjs      # 自选基金路由
│   │   └── portfolio/         # 持仓子路由
│   │       ├── index.cjs      # 持仓路由聚合
│   │       ├── records.cjs    # 持仓记录 CRUD
│   │       ├── analytics.cjs  # 持仓统计分析
│   │       ├── insights.cjs   # 组合洞察
│   │       ├── transactions.cjs # 交易记录 + CSV 导出 + 费用分析
│   │       ├── dca.cjs        # 定投计划管理
│   │       └── asset-accounts.cjs # 多账户资产台账
│   ├── services/
│   │   └── aiContextProvider.cjs # AI 上下文构建器（注入持仓、行情、基金数据）
│   └── utils/
│       ├── rate-limiter.cjs   # 共享速率限制器（带 TTL 自动清理）
│       ├── scheduler.cjs      # 共享调度器（每日任务、交易时间任务）
│       ├── trading-hours.cjs  # 交易时间判断（含中国法定节假日）
│       ├── crypto.cjs         # 加密工具（AES-256-GCM）
│       ├── alipay.cjs         # 支付宝 SDK 封装
│       ├── anthropicClient.cjs # Anthropic SDK 客户端单例
│       ├── stats.cjs          # 风险指标计算（Sharpe、Sortino、Calmar、最大回撤）
│       ├── portfolio-helpers.cjs # 持仓辅助工具（历史净值获取与存储）
│       └── logger.cjs         # 结构化日志（winston）
├── src/
│   ├── App.tsx                # 路由配置（20+ 路由，懒加载）
│   ├── main.tsx               # 入口，Ant Design + 暗色模式全局配置
│   ├── index.css              # 全局 CSS 设计系统（1190+ 行，含暗色模式）
│   ├── constants/
│   │   ├── theme.ts           # 主题颜色、估值配色、因子配色
│   │   └── index.ts           # 应用常量（分页、行业列表、事件分类）
│   ├── contexts/
│   │   ├── AuthContext.tsx     # 认证上下文（JWT 管理）
│   │   └── ThemeContext.tsx    # 暗色/浅色主题上下文（自动检测 + 持久化）
│   ├── components/
│   │   ├── Navbar.tsx         # 响应式导航栏（移动端抽屉菜单）
│   │   ├── Footer.tsx         # 全局页脚
│   │   ├── DataStatus.tsx     # 数据更新状态栏
│   │   ├── ErrorBoundary.tsx  # 全局错误捕获
│   │   ├── FloatingChat.tsx   # 浮动 AI 聊天组件
│   │   ├── CommandPalette.tsx # 命令面板（Ctrl+K 快捷导航）
│   │   ├── ParticleCanvas.tsx # 粒子背景动画
│   │   ├── GsapEnhancer.tsx   # GSAP 滚动动画增强器
│   │   ├── TiltCard.tsx       # 3D 倾斜卡片（光晕边框 + 金属光泽）
│   │   ├── GlassCard.tsx      # 磨砂玻璃卡片
│   │   ├── StatCard.tsx       # 统计数值卡片
│   │   ├── NewsFeed.tsx       # 新闻流组件
│   │   ├── ReturnsMap.tsx     # 收益地图组件
│   │   ├── VIPInsights.tsx    # VIP 洞察组件
│   │   ├── fundlist/          # 基金列表子组件
│   │   │   ├── FundListFilters.tsx
│   │   │   ├── MultiFactorFilterBar.tsx
│   │   │   ├── StarManagersPanel.tsx
│   │   │   ├── GoldStatsPanel.tsx
│   │   │   ├── FundComparePanel.tsx
│   │   │   └── HS300AnalysisPanel.tsx
│   │   └── portfolio/         # 持仓管理子组件
│   │       ├── HoldingsTable.tsx
│   │       ├── HoldingsCharts.tsx
│   │       ├── HoldingsDiagnosis.tsx
│   │       ├── PortfolioSummaryCards.tsx
│   │       ├── DCAPlansPanel.tsx
│   │       ├── AssetAccountsPanel.tsx
│   │       ├── TransactionHistoryTab.tsx
│   │       ├── TransactionBehaviorAnalysis.tsx
│   │       ├── DCACalculatorTab.tsx
│   │       ├── SmartDCATab.tsx
│   │       ├── GoalPlanningTab.tsx
│   │       ├── RiskAssessmentTab.tsx
│   │       ├── DeepAnalysisTab.tsx
│   │       ├── AddEditRecordModal.tsx
│   │       ├── DCAModal.tsx
│   │       ├── SellModal.tsx
│   │       └── import.cjs    # CSV 导入子路由
│   ├── stock-picker/          # AI 选股子组件
│   │   ├── FundRatingBadge.tsx    # A/B/C/D 基金评级徽章
│   │   ├── IndexTemperatureCard.tsx # 指数温度计卡片
│   │   ├── NLScreenerInput.tsx    # 自然语言筛选输入框
│   │   ├── CustomFactorPanel.tsx  # 自定义因子权重面板
│   │   ├── CorrelationHeatmap.tsx # 相关性热力图
│   │   ├── PickHistoryTab.tsx     # 选股历史标签页
│   │   └── ProBadge.tsx          # PRO/SVIP 徽章
│   ├── pages/                 # 页面组件（懒加载）
│   │   ├── Home.tsx           # 首页看板
│   │   ├── FundList.tsx       # 基金列表
│   │   ├── FundDetail.tsx     # 基金详情
│   │   ├── FundCompare.tsx    # 基金对比
│   │   ├── QDIIFunds.tsx      # QDII 基金
│   │   ├── IndustryAnalysis.tsx # 行业分析
│   │   ├── MarketEvents.tsx   # 事件日历
│   │   ├── CMBProducts.tsx    # 招行理财列表
│   │   ├── CMBProductDetail.tsx # 招行理财详情
│   │   ├── Portfolio.tsx      # 持仓管理（14 个子 Tab）
│   │   ├── StockPicker.tsx    # AI 选股
│   │   ├── FundDiagnosis.tsx  # 基金诊断
│   │   ├── PortfolioOverlap.tsx # 持仓重叠
│   │   ├── ValuationCenter.tsx # 估值中心
│   │   ├── AIAssistant.tsx    # AI 助手
│   │   ├── Subscription.tsx   # 订阅会员
│   │   ├── Profile.tsx        # 个人中心
│   │   ├── About.tsx          # 关于页面（版本信息）
│   │   ├── Login.tsx          # 登录
│   │   └── admin/
│   │       ├── UserManagement.tsx # 用户管理
│   │       └── SystemMonitor.tsx  # 系统监控
│   ├── services/
│   │   └── api.ts             # 统一 API 客户端（700+ 行，覆盖全部接口）
│   ├── hooks/
│   │   ├── useAsyncData.ts    # 通用异步数据加载 Hook
│   │   └── useTabLazyLoad.ts  # Tab 懒加载 Hook
│   ├── utils/
│   │   ├── format.ts          # 格式化工具函数
│   │   ├── echarts-theme.ts   # ECharts 暗色主题
│   │   └── slash-commands.ts  # AI 斜杠命令定义
│   └── types/
│       └── index.ts           # TypeScript 类型定义
├── android/                   # Capacitor Android 项目
│   ├── app/
│   │   ├── build.gradle       # Android 构建配置
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── res/           # 图标 + 启动屏资源
│   └── gradle/                # Gradle Wrapper
├── scripts/
│   ├── generate-icons.cjs     # Android 图标生成脚本（sharp）
│   ├── generate-alipay-keys.cjs # 支付宝密钥生成
│   ├── fetch-gold-funds.cjs   # 金选基金数据抓取
│   ├── scrape/
│   │   ├── scrape_cmb_final.py # 招行理财爬虫（最新版）
│   │   └── archive/            # 历史爬虫版本归档
│   ├── data/
│   │   ├── import_to_pg.py     # 企业产品数据导入 PostgreSQL
│   │   └── cmb_products_summary.py # 招行产品汇总报告
│   └── test/
│       └── verify_portfolio.py # 持仓页面 E2E 验证
├── data/                       # 爬虫产出数据（gitignore）
│   ├── cmb_products_info.json
│   ├── cmb_products_detail.json
│   └── corporate_products*.{json,csv}
├── docs/
│   ├── deploy/
│   │   └── DEPLOY.md           # 部署文档
│   ├── security/
│   │   ├── SECURITY_FIX_LOG.md # 安全修复台账
│   │   └── security-audit-report.md # 安全审计报告
│   ├── UPDATE_GUIDE.md         # 更新指南
│   ├── 项目自评.md              # 项目自评报告
│   └── history/
│       ├── 基金代码更新总结.md
│       └── 基金代码验证问题汇总.md
├── public/
│   ├── icon.svg               # 应用图标（SVG 源文件）
│   └── icon.png               # 应用图标（1024x1024 PNG）
├── capacitor.config.ts        # Capacitor 配置
├── build-apk.sh               # APK 一键构建脚本
├── deploy.sh                  # 本地一键部署脚本
├── deploy-full.sh             # 服务器全新部署脚本
├── update.sh                  # 服务器一键更新脚本
├── deploy-termux.sh           # Termux (Android) 部署脚本
├── vite.config.ts             # Vite 配置（支持 Capacitor 模式）
├── vitest.config.ts           # 测试配置
├── eslint.config.js           # ESLint 配置
├── .prettierrc                # Prettier 配置
└── package.json
```

## API 接口

后端运行在 3003 端口，前端通过 `/api` 代理访问。共 88 个 API 端点 + 1 个 SSE 端点。

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
| GET | `/api/market/valuation-trend` | 估值历史趋势 |

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
| PUT | `/api/auth/profile` | 修改个人资料（需认证） |
| GET | `/api/auth/login-history` | 登录历史（需认证） |
| GET | `/api/auth/alipay/qrcode` | 获取支付宝授权 URL |
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
| GET | `/api/benchmark/hs300` | 沪深 300 基准数据 |
| GET | `/api/alerts` | 智能提醒（需认证） |

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

### AI 助手

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai-assistant/chat` | AI 对话（SSE 流式响应） |
| GET | `/api/ai-assistant/sessions` | 获取会话列表 |
| GET | `/api/ai-assistant/sessions/:id` | 获取会话详情 |
| DELETE | `/api/ai-assistant/sessions/:id` | 删除会话 |

### 基金诊断

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fund-diagnosis/:code` | AI 基金深度诊断（盈利能力、风险抵抗、费率分析、同类对比） |

### AI 选股引擎

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/stock-picker/factors` | 获取因子配置 | 会员 |
| POST | `/api/stock-picker/rank` | 多因子量化选股排名（支持自定义因子权重） | 会员 |
| POST | `/api/stock-picker/backtest` | 选股策略回测（可配置基准） | 会员 |
| POST | `/api/stock-picker/portfolio` | 一键组合构建 | 会员 |
| GET | `/api/stock-picker/market-overview` | 市场环境概览 | 会员 |
| POST | `/api/stock-picker/strategy-compare` | 策略对比分析 | 会员 |
| POST | `/api/stock-picker/deep-analysis` | 基金深度风险分析 | 会员 |
| POST | `/api/stock-picker/quant-picks` | 量化精选（6因子筛选） | 会员 |
| GET | `/api/stock-picker/screeners` | 获取保存的筛选方案 | 会员 |
| POST | `/api/stock-picker/screeners` | 保存筛选方案 | 会员 |
| DELETE | `/api/stock-picker/screeners/:id` | 删除筛选方案 | 会员 |
| GET | `/api/stock-picker/history` | 选股历史记录 | 会员 |
| POST | `/api/stock-picker/history` | 保存选股历史 | 会员 |
| GET | `/api/stock-picker/portfolios` | 获取保存的投资组合 | 会员 |
| POST | `/api/stock-picker/portfolios` | 保存投资组合 | 会员 |
| DELETE | `/api/stock-picker/portfolios/:id` | 删除投资组合 | 会员 |
| POST | `/api/stock-picker/export/csv` | CSV 导出选股结果 | 会员 |
| GET | `/api/stock-picker/temperature` | 指数估值温度计 | 会员 |
| POST | `/api/stock-picker/nl-screen` | 自然语言筛选 | SVIP |
| POST | `/api/stock-picker/correlation` | 相关性分析 | 会员 |
| GET | `/api/stock-picker/alerts` | 获取提醒规则 | 会员 |
| POST | `/api/stock-picker/alerts` | 创建提醒规则 | 会员 |
| DELETE | `/api/stock-picker/alerts/:id` | 删除提醒规则 | 会员 |

### 订阅支付

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/subscription/plans` | 获取订阅套餐列表 |
| POST | `/api/subscription/create-order` | 创建订阅订单 |
| GET | `/api/subscription/check/:orderId` | 查询支付状态 |
| POST | `/api/subscription/notify` | 支付宝异步通知回调 |

### 交易分析（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/portfolio/records/:id/sell` | 卖出持仓记录 |
| GET | `/api/portfolio/transactions` | 交易历史记录 |
| GET | `/api/portfolio/transactions/export` | 交易记录 CSV 导出 |
| GET | `/api/portfolio/fee-analysis` | 费用分析 |
| GET | `/api/portfolio/holdings-risk` | 持仓风险分析 |
| GET | `/api/portfolio/industry-allocation` | 行业配置分析 |
| GET | `/api/portfolio/performance-attribution` | 业绩归因分析 |

### 多账户资产（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/portfolio/asset-accounts` | 获取资产账户列表 |
| POST | `/api/portfolio/asset-accounts` | 创建资产账户 |
| PUT | `/api/portfolio/asset-accounts/:id` | 更新资产账户 |
| DELETE | `/api/portfolio/asset-accounts/:id` | 删除资产账户 |
| GET | `/api/portfolio/asset-accounts/summary` | 资产账户汇总 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 数据更新状态 |
| POST | `/api/update` | 手动触发数据更新（仅管理员） |
| GET | `/health` | 健康检查 |

## 覆盖基金类型

基金总数约 6500+，数据库当前排除债券类/货币类基金（"债"/"货币"名称与类型已删除）。主要类型分布：ETF、ETF 联接、QDII、指数增强、LOF、混合型-偏股、指数型-股票、混合型-灵活、股票型、混合型 等

覆盖行业：人工智能、半导体/芯片、纳斯达克 100、标普 500、医药、新能源、光伏、消费/白酒、军工、金融/银行、沪深 300、中证 500、创业板、科创 50、恒生科技、黄金、农业、地产、机器人、煤炭、陶瓷/建材 等

### 支付宝金选基金

平台收录 168 只金选基金，覆盖 20+ 个行业。在基金列表页面点击「金选基金」按钮即可筛选查看。

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
- API 统计查询参数化 INTERVAL（防止 SQL 注入）
- OAuth 用户密码使用 crypto.randomBytes 生成（非 Math.random）
- React ErrorBoundary 全局错误捕获（防止白屏）
- 路由懒加载（代码分割，减小初始包体积）
- 404 路由兜底（未知路径重定向首页）
- authMiddleware 数据库故障时拒绝访问（fail-closed 策略）
- 用户头像 URL 协议白名单校验（仅允许 http/https/data）
- CSV 导出公式注入防护（转义 =、+、-、@ 前缀）
- 系统配置项白名单校验（仅允许修改已定义的配置键）
- 文件上传类型校验（multer fileFilter 仅允许 CSV）
- 错误消息不暴露内部实现细节（通用错误提示 + 服务端详细日志）
- SSE 实时推送使用 Authorization Header（token 不再暴露在 URL 中）
- 分页参数上限约束（pageSize 最大 100，防止恶意大查询）
- 自选基金批量查询数组长度限制（最多 100 个基金代码）
- 订阅订单创建速率限制（5 次/分钟/用户）
- 支付轮询速率限制（30 次/分钟/用户）
- OAuth token 注入防护（URL 参数 token 先验证再存储）
- 管理员批量删除用户使用数据库事务（防止部分删除导致数据不一致）

> 详细的安全漏洞修复记录请参阅 [SECURITY_FIX_LOG.md](./docs/security/SECURITY_FIX_LOG.md)。

## 版本更新记录

### v1.2.0 (2026-08-16) — 实时财经日历 + 基金池优化 + 数据管道扩展

**实时财经日历**
- 新增 `server/calendar-fetcher.cjs`：集思录（jisilu）数据源，30 分钟缓存，0-200 条实时事件
- 事件覆盖：新股申购、分红、可转债、期货交割等市场日历

**新闻推送增强**
- 新闻与持仓行业智能匹配：个人化资讯推送（与用户持仓行业相关的新闻优先）
- 修复东财实时快讯源：`getNewsByColumns` 加 `req_trace=1` 解锁真实 7x24 快讯，content 支持 summary/showTime 字段格式（原缺字段会一直走公告池，个人相关新闻由 2 条增至 5 条）
- 财联社 updateTelegraph 端点已被反爬/废弃，短期放弃

**基金池优化**
- 移除债券/货币类基金（名称含"债"/"货币"），聚焦 6500+ 股票/指数/QDII 基金
- 金选基金扩容至 168 只
- 基金列表默认每页 30 条
- 修复基金诊断路由挂载、净值日期时区显示

**数据管道扩展**
- 新增 5 个数据脚本：`update-all-funds.cjs`（全量更新）、`update-all-funds-full.cjs`、`update-fund-data.cjs`、`update-qdii-funds.cjs`（QDII 专项）、`update-index-valuation.cjs`（指数估值含 PB 历史分位）、`update-sector-data.cjs`（板块数据）
- 新增 `server/jobs/index.cjs` 统一任务调度，注册每日定时任务：
  - 09:32 QDII 基金专项更新（限额 + 1y/3m/1m）
  - 15:30 指数估值更新（收盘后获取最终 PE/PB，含 PB 历史分位）
  - 16:00 基金数据全量更新
  - 16:05 板块数据更新（行业板块涨跌幅）
- 新增 `server/fund-analysis.cjs` 基金分析模块

**AI 助手增强**
- `server/routes/ai-assistant.cjs` 大幅增强，新增个人化新闻匹配能力
- 前端 `AIAssistant.tsx` 大改（+805 行）

**项目规模**
- 88+ API 端点，31 张数据库表

### v1.1.2 (2026-06-30) — 金选基金徽章与筛选

**金选基金标记**
- 扩展 `GOLD_FUND_CODES` 从 104 只到 157 只（去除重复），覆盖宽基/行业/QDII/策略/固收
- 新增分类：汽车、通信、红利低波、港股通、全球科技、黄金
- 修复 `fetchSingleFundFromAlipay` 缺失基金名称/类型导致分类全部为"混合-主动"的 bug
- 数据库标记 156 只金选基金（`is_gold_selected = true`）
- 前端基金列表：金色"金选"徽章（`<Tag color="gold">`）、点击"金选基金"按钮仅看金选、金选统计面板

### v1.1.1 (2026-06-30) — 基金数据全量自动更新

**数据更新系统**
- 新增 `scripts/update-all-funds.cjs`：一键从支付宝/蚂蚁财富 API 获取全部 219 只基金最新数据
- 数据字段：最新净值、近1月/3月/6月/1年收益率、基金规模、基金经理、申购状态
- 新增 `fetchAllCuratedFundsData()` 集成到每日定时任务（交易日 17:30 自动执行）
- 新增 `POST /api/funds/fetch-all` API 端点，支持随时手动触发全量更新
- API 数据源：支付宝基金信息 API（FundBasicInformation），每只基金一次请求获取全部字段
- 更新策略：UPSERT 到 `funds` 和 `fund_nav` 表，不覆盖人工设定字段
- 性能：219 只基金、并发 5、批次间 400ms，总耗时 ~24 秒

**AI 选股引擎（全新升级）**
- 三档会员体系：免费 → 会员（9.9元/月）→ 至尊SVIP（29.9元/月）
- 自然语言筛选（SVIP）：中文语义解析，支持"近1年收益>20%的低费率沪深300基金"
- 基金评级系统（SVIP）：A/B+/B/C/D 五档评级，自动标注优势与风险
- 指数温度计（SVIP）：PE/PB 分位加权估值温度（0-100），五档信号
- 自定义因子权重（SVIP）：5 大因子自由调节，实时饼图预览
- 相关性分析：Pearson 相关矩阵热力图，分散化评分
- 用户数据持久化：保存筛选器、选股历史、投资组合
- CSV 导出：选股结果一键导出
- 可配置回测基准：沪深300/中证500/中证1000/创业板/上证50/证券ETF
- 提醒规则：4 种规则类型，CRUD 管理
- 前端组件化：7 个独立组件（FundRatingBadge、IndexTemperatureCard、NLScreenerInput 等）
- Hero 头部重新设计：市场状态栏、统计数据、策略选择器、PRO/SVIP 徽章
- 移动端响应式适配

**安全加固（11 项修复）**
- .env.termux 弱 JWT 密钥替换为 64 字符随机密钥
- ENABLE_MOCK_AUTH 默认关闭 + NODE_ENV=production 强制设置
- Guest 登录数据隔离：独立 guest_visitor 账户，不再与 test01 共享
- unhandledRejection 处理器改为延迟退出 + PM2 重启
- AI 助手 HTML sanitizer 从正则替换改为 HTML 实体转义
- CORS 白名单补充 localhost:3003
- capacitor.config.ts 硬编码 IP 改为环境变量
- .env.example 补充 NODE_ENV 文档
- subscription-service 支持 svip tier 字段
- 50 处 console.* 迁移到 Winston 日志
- GSAP fallback 超时从 3 秒降为 0.5 秒

**前端优化**
- 页面加载速度优化：卡片默认可见，GSAP 动画变为可选增强
- AI 助手浮动窗口优化：抽屉模式隐藏侧边栏，聊天区域全宽显示
- Portfolio 页复用 ProBadge 组件
- StockPicker Hero 头部移动端响应式

**项目规模**
- 前端：28,194 行代码（.tsx/.ts）
- 后端：18,685 行代码（.cjs）
- 总计：46,879 行代码
- 88 个 API 端点，31 张数据库表，45 个 React 组件，22 个页面

### v1.1.0 (2026-06-28) — 基金金选扩展 + AI 选股引擎优化

金选基金扩展至 168 只，基金总数 6500+（数据库已排除债券类/货币类基金）。AI 选股引擎七因子量化模型深度优化，自然语言筛选（SVIP）、指数温度计、相关性热力图、A/B/C/D 基金评级体系上线。

### v1.0.0 (2026-06-22) — Android APK 发布

**Android APK**
- 基于 Capacitor 8 将 Web 应用打包为原生 Android APK
- 自适应图标（蓝色渐变 + 白色股票图标，覆盖 mdpi~xxxhdpi 全分辨率）
- 启动屏（深色渐变背景 + 居中 Logo，竖屏 + 横屏全分辨率）
- 支持 HTTP 明文请求（`usesCleartextTraffic: true`）
- "关于"页面显示版本号、制作人、技术栈、服务器地址
- 多版本并存支持（不同 applicationId 后缀）

**新增功能**
- "关于"页面：版本信息、版权归属（guandexun）、技术栈展示
- AI 助手斜杠命令：/diagnose（基金诊断）、/portfolio（持仓分析）、/market（市场解读）、/stockpick（选股推荐）、/risk（风险评估）、/dca（定投建议）
- 多账户资产台账：支持创建多个资产账户，独立管理余额和成本
- 交易行为分析：费用分析、持仓风险、行业配置、业绩归因
- 目标规划：财务目标设定与进度追踪
- 智能定投策略：根据估值自动调整定投金额

**前端优化**
- Vite 配置支持 Capacitor 构建模式（`--mode capacitor`，base 路径自动切换为 `./`）
- API 地址支持环境变量配置（`VITE_API_BASE`）
- Router basename 支持 Capacitor 模式（空字符串）和 Web 模式（`/web`）

**依赖新增**
- `@capacitor/core` / `@capacitor/cli` / `@capacitor/android` 8.x
- `@capacitor/status-bar` / `@capacitor/splash-screen` / `@capacitor/preferences`
- `@anthropic-ai/sdk` 0.105.x（Claude AI 集成）
- `sharp` 0.35.x（图标生成）

### v0.9 (2026-06-21) — 架构分层重构

**后端架构分层**
- `routes/api.cjs`（1905行）拆分为 7 个领域路由模块：
  - `routes/funds.cjs` — 基金列表、详情、QDII、沪深300、易方达、金选基金
  - `routes/market.cjs` — 市场指数、板块轮动、资金流向、估值中心、估值趋势
  - `routes/industry.cjs` — 行业深度分析、沪深300分析、标普500分析、推荐、建仓方案
  - `routes/tools.cjs` — 风险评估、定投计算器、基金对比
  - `routes/cmb.cjs` — 招行理财产品
  - `routes/news.cjs` — 财经新闻
  - `routes/alerts.cjs` — 智能提醒
- `api.cjs` 重构为薄聚合层（~100行），仅负责挂载子路由
- 统一路由处理器 `route-handler.cjs`：支持返回数据自动 res.json 模式，消除重复 try/catch

**前端架构优化**
- 新增 `constants/theme.ts` — 共享主题常量（颜色、估值配色、因子配色），消除 1100+ 处硬编码颜色值
- 新增 `constants/index.ts` — 应用常量（分页、行业列表、事件分类配置）
- `AuthContext.tsx` 改用 `authApi` 统一 API 客户端，消除 3 处 raw fetch 调用
- `main.tsx` 使用共享 `ANTD_THEME_TOKEN`，支持深色模式感知 token
- 新增 `PageLoader` 共享加载组件 + `PageErrorBoundary` 页面级错误边界
- 首页宽度与其他页面统一（移除独立 maxWidth 限制）

### v0.8 (2026-06-21)

**新增功能**
- AI 助手：智能问答、持仓诊断、市场解读（Claude API 集成）
- 基金诊断：AI 驱动的基金深度诊断页面
- 估值中心：全市场估值概览与历史分位
- 持仓分析增强：资产配置分析、组合洞察、收益地图
- 前端组件化：ErrorBoundary、DataStatus、VIPInsights 等共享组件
- GSAP 动画增强：卡片视口渐入、数字滚动效果
- 浮动 AI 聊天组件：全局可访问的 AI 助手入口

**安全加固**
- uncaughtException 处理器改为日志后退出（由 PM2 自动重启），避免进程处于 undefined 状态
- 部署脚本补全所有 server 子模块（services/config 目录）
- 部署脚本新增 Python 依赖自动安装（requests、openpyxl）
- 部署脚本新增 scripts/ 和 .env.example 上传

### v0.7 (2026-06-11)

**新增功能**
- 个人中心页面：用户头像下拉菜单新增「个人中心」入口，包含基本信息编辑、账户安全（密码修改、登录历史）、会员状态三大模块
- 基金对比路由：`/web/fund-compare` 路由正式上线，支持多只基金横向对比分析
- 用户个人资料 API：`PUT /api/auth/profile` 支持在线修改昵称和头像
- 登录历史 API：`GET /api/auth/login-history` 返回最近 20 条登录记录（含浏览器、系统、IP）

**安全加固（全面安全审查 + 修复）**
- authMiddleware 数据库故障时拒绝访问（fail-closed），防止禁用用户在 DB 异常时绕过检查
- 用户头像 URL 协议白名单校验（仅允许 http/https/data），防止 javascript: 协议注入
- API 统计查询改用参数化 INTERVAL，消除 SQL 注入风险
- CSV 导出公式注入防护（转义 =、+、-、@ 前缀），防止 Excel 公式执行
- 系统配置项白名单校验，管理员只能修改已定义的配置键和合法值范围
- 文件上传类型校验（multer fileFilter 仅允许 CSV 文件）
- 错误消息统一为通用提示，不暴露数据库表名、列名等内部细节
- SSE 实时推送改用 fetch + ReadableStream + Authorization Header，JWT 不再暴露在 URL 中
- 分页参数上限约束（pageSize 最大 100），防止恶意大查询
- 自选基金批量查询数组长度限制（最多 100 个）
- 订阅订单创建速率限制（5 次/分钟/用户）
- 支付轮询速率限制（30 次/分钟/用户）
- OAuth token 注入防护（URL 参数 token 先验证用户信息再存储）
- 管理员批量删除用户使用数据库事务（防止部分删除导致数据不一致）
- StockPicker 改用统一 API 客户端（不再绕过 auth headers）

### v0.6 (2026-06-09)

**安全加固**
- 禁用用户即时失效：authMiddleware 新增数据库用户状态检查（30 秒 TTL 缓存），管理员禁用用户后现有 JWT 令牌立即失效
- adminMiddleware 实时查询数据库 role/status，不信任 JWT 缓存的 role
- 移除 adminMiddleware 中泄露用户敏感信息的 console.log

**部署安全**
- deploy.sh rsync 补全 admin.cjs，部署后服务正常启动
- deploy-full.sh 自动生成随机 JWT_SECRET
- 添加 pm2 startup 开机自启配置
- Nginx 配置补全安全响应头

### v0.5 (2026-06-08)

**安全加固**
- 引入 helmet 中间件：替代手动设置安全响应头
- 支付宝回调地址环境变量化：不再硬编码 IP
- CSV 导入基金代码校验：添加 6 位数字正则验证

**新增功能**
- 标普 500 深度分析页：新增 `/web/sp500` 路由
- 基金经理管理：新增基金经理列表 API、明星基金经理详情 API
- 修改密码功能：登录用户可修改密码
- 沪深 300 基金扩容：从 17 只扩展到 37 只
- 行业分析扩展：从 9 个行业扩展到 14 个行业

### v0.4 (2026-06-05)

**新增功能**
- 自选基金：登录用户可收藏基金
- 基金对比净值走势：对比模式新增近 6 月净值走势曲线图
- 持仓 vs 基准对比：持仓页面新增沪深 300 基准对比线
- 多因子筛选器：基金列表新增收益阈值、规模区间、费率上限筛选条件
- 估值历史趋势图：市场估值页新增 PE/PB 分位近 12 月走势曲线
- 智能提醒系统：持仓基金大幅波动提醒、QDII 限额提醒、定投到期提醒
- 首页持仓概览：登录用户首页显示持仓摘要卡片

### v0.3 (2026-06-05)

- 煤炭/陶瓷建材行业基金新增
- 支付宝金选基金收录 69 只
- 行业分析扩展到 9 个行业

### v0.2 (2026-06-05)

- 支付宝扫码登录集成
- 一键部署/更新/修复脚本
- OAuth CSRF 防护 + Token 加密存储

### v0.1 (2026-06-04)

- 核心功能上线：基金列表、详情、对比、QDII、行业分析、沪深 300、市场估值、风险评估、定投计算器、持仓管理

## 常见问题 (FAQ)

### Q: 数据库连接失败？

确保 `PG_HOST=localhost`（数据库和服务器在同一台机器时），检查 PostgreSQL 是否运行：
```bash
sudo systemctl status postgresql
psql -h localhost -U your_user -d your_database -c "SELECT 1;"
```

### Q: 前端白屏？

检查浏览器控制台是否有 JS 错误。常见原因：
1. 后端未启动（检查 `pm2 status`）
2. API 返回 502（检查 `pm2 logs fund-server`）
3. 环境变量配置错误

### Q: 如何重置管理员密码？

```bash
# 在服务器上执行
cd /var/www/jijin
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
bcrypt.hash('new_password', 10).then(hash =>
  pool.query('UPDATE users SET password_hash = \$1 WHERE username = \$2', [hash, 'admin'])
).then(() => { console.log('Done'); process.exit(); });
"
```

### Q: 如何备份数据库？

```bash
pg_dump -h localhost -U your_user your_database > backup_$(date +%Y%m%d).sql
```

### Q: 部署后 502 Bad Gateway？

后端服务未启动：
```bash
pm2 status
pm2 restart fund-server
pm2 logs fund-server --lines 30
```

### Q: 部署后 403 Forbidden？

文件权限问题：
```bash
bash /var/www/fix-permission.sh
```

### Q: 如何开启 HTTPS？

1. 安装 certbot：`apt install certbot python3-certbot-nginx`
2. 申请证书：`certbot --nginx -d your-domain.com`
3. 自动续期：`certbot renew --dry-run`

详见 [DEPLOY.md](./docs/deploy/DEPLOY.md) 中的 HTTPS 配置章节。

### Q: 如何更新到最新版本？

```bash
# 1. 本地打包
# 2. 上传 fund-recommender.zip 到服务器 /var/www/
# 3. SSH 登录运行
bash /var/www/update.sh
```

### Q: 招行理财产品数据不更新？

确保 Python 3.8+ 已安装：
```bash
python3 --version
pip3 install requests beautifulsoup4
```

## License

ISC
