# CHANGELOG

本项目版本变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

## [Unreleased]

## [1.3.0] — 2026-08-21

### Added
- `src/components/stock-picker/chartOptions.tsx` — FACTOR_META、STRATEGIES 常量 + 10 个 chart option 纯函数提取
- `src/components/stock-picker/StockPickerHeader.tsx` — Hero 头部组件提取
- `src/components/ai-assistant/RenderHelpers.tsx` — renderFundList/renderIndices/renderIndustries/renderStructuredData 提取
- `src/components/ai-assistant/CodeBlock.tsx` — 代码块组件提取
- `server/__tests__/fund-service.test.cjs` — 76 个测试，100% 行覆盖（语句 100%、分支 86.72%、函数 100%）
- `e2e/payment.spec.ts` — 10 个支付/订阅 E2E 测试 × 7 机型 = 70 测试
- `start-e2e-servers.cjs` — E2E 测试同时启动后端+Vite 脚本
- CI/CD 覆盖率报告 + 阈值（lines 18%、functions 8%、branches 8%、statements 16%）
- CI E2E 测试（desktop 项目）+ artifact 上传 + npm cache

### Changed
- `Portfolio.tsx`：1568→721 行（-54%），重写接入 16 个已有子组件
- `StockPicker.tsx`：1448→1107 行（-23%），提取 chart options 纯函数 + Header 组件
- `AIAssistant.tsx`：1453→1334 行（-8%），提取 RenderHelpers + CodeBlock
- `HoldingsCharts.tsx`：增强，添加 portfolioDailyReturns 可选 prop
- 7 个页面文件：`catch(e: any)` → `catch(e: unknown)` + `(e as Error).message`（18 处）
- `.github/workflows/test.yml`：添加覆盖率报告、构建验证、E2E 测试、artifact 上传
- `.github/workflows/cd.yml`：添加覆盖率报告上传
- `vitest.config.ts`：添加覆盖率阈值和 lcov reporter
- `playwright.config.ts`：webServer 改为 `node start-e2e-servers.cjs`
- `src/pages/About.tsx`：版本号 v1.3.0、更新日志、统计数据刷新、新增测试工具技术栈

### Fixed
- 无（本轮为优化型变更，无 bug 修复）

## [1.2.1] — 2026-08-21

### Added
- 全局错误处理中间件（4参数 Express 错误中间件，统一捕获未处理异常）
- `Dockerfile` + `.dockerignore`（多阶段构建，支持容器化部署）
- `src/types/api.ts` — 前后端共享 API 响应 DTO 类型定义（300+ 行）
- 后端核心模块单元测试：`auth.test.cjs`(39)、`data-fetcher.test.cjs`(44)、`ai-assistant.test.cjs`(12)、`alipay.test.cjs`(9)
- CI 后端测试加 `--test-force-exit`（解决 `setInterval` 阻止进程退出）
- Playwright E2E 测试框架 + 223 个测试（7 种机型：Desktop + 6 手机）
- `e2e/navigation.spec.ts` — 页面导航与加载、登录表单、主题/语言切换
- `e2e/mobile-adaptation.spec.ts` — 水平溢出、宽度适配、滚动测试
- 数据库迁移工具 `migrate.cjs` + 3 个迁移文件（001_initial_schema、002_ai_favorites、003_add_indexes）
- 集中配置管理 `server/config/index.cjs`（db/jwt/cors/server/alipay/ai 分组校验）
- 公共 multer 配置 `server/utils/upload.cjs`
- 数据库索引：fund_records(fund_code)、subscription_orders(plan_id)
- `server/routes/admin/` 目录：index/users/audit/settings/alerts/monitoring/helpers.cjs（admin.cjs 1809行拆分）
- `server/utils/metrics.cjs`：全局指标状态模块（消除循环依赖）

### Fixed
- `parseUserAgent`：iPhone UA 含 "like Mac OS X" 被误判为 macOS → 修正 OS 判断顺序（具体优先于通用）
- `parseUserAgent`：Android UA 含 "Linux" 被误判为 Linux → 同上
- `getUserId(null)` 筛 TypeError → 改用 `req?.user?.id` 可选链
- N+1 持仓盈亏更新 → `unnest()` 批量 UPDATE（DB 往返 N→1）
- N+1 智能提醒查净值 → `DISTINCT ON + ANY($1)` 批量查询
- N+1 净值写入/回测查净值/经理更新 → 3 处批量优化
- `ai-assistant.cjs` stream 未定义变量 → `resp?.controller?.abort()`
- 优雅关闭未释放连接池 → `closePool()` + `await pool.end()`
- Dockerfile 以 root 运行 → 添加 `USER node`
- AI 助手 7 个路由认证缺失 → 添加 `authMiddleware` 强制认证 + SQL 用户所有权校验
- 荣耀 Magic V6 展开屏（852px）水平溢出 → Navbar 断点从 md(768px) 提高到 xl(1200px)

### Changed
- `services/api.ts`：约 15 个 API 的 `fetchApi<any>` 替换为具体 DTO 类型（FundListResponse、CapitalFlowResponse、DCAOutput 等），消除 101 处 `any`
- `auth.cjs` / `data-fetcher.cjs` / `ai-assistant.cjs`：导出内部纯函数供单元测试
- `vite.config.ts`：添加 `esbuild.drop: ['console', 'debugger']` 生产构建移除 console
- `auth.cjs`：`authRateLimit` 改用共享 `createRateLimit`，消除重复代码
- `eslint.config.js`：`no-unused-vars` 和 `rules-of-hooks` 从 warn 升级为 error
- `Navbar.tsx`：`isMobile` 断点从 `!screens.md` 改为 `!screens.xl`，适配折叠屏展开态
- `index.css`：`overflow-x: hidden` 断点从 767px 扩展到 1199px
- 生产环境数据库连接池 max 从 10 提升到 20

### Removed
- `server/fund-data.cjs.backup` 备份文件（由 git 历史管理）
- `server/admin.cjs`（1809行）→ 拆分为 `server/routes/admin/` 目录下 6 个路由文件

## [1.2.0] — 2026-08-16

### Added
- 实时财经日历接入（集思录数据源）
- 新闻与持仓行业智能匹配（个人化推送）
- 东财实时快讯源修复（req_trace 解锁 7x24 快讯）
- 基金池移除债券/货币类基金，聚焦 6500+ 股票/指数/QDII
- 金选基金扩容至 168 只
- `jobs/index.cjs` 统一定时调度

## [1.1.0] — 2026-06-28

### Added
- AI 选股引擎：七因子量化模型、4 种策略、回测验证、一键建仓
- 三档会员体系（free → premium → svip）
- 基金诊断、持仓重叠、估值中心
- AI 助手（Claude 流式对话 + 斜杠命令）

### Security
- 累计 69 项安全修复（CRITICAL 6 / HIGH 16 / MEDIUM 33 / LOW 14）
- JWT + bcrypt + helmet(CSP/HSTS) + CORS 白名单 + 多级 rate-limit
- SQL 全量参数化查询
