# CHANGELOG

本项目版本变更记录。格式参考 [Keep a Changelog](https://keepachangelog.com/)。

## [Unreleased]

## [1.4.3] — 2026-11-17

### Fixed
- **HS300 基金详情自 6 月起从未更新（严重）** — `server/data-fetcher.cjs` 的 `fetchHS300FundDetails` 直接对 `fundService.getAllFundsWithNav()` 的返回值调 `.filter()`，但该函数返回的是 `{ data: [...], total, page, ... }` 分页包装对象，包装对象没有 `.filter`，每日 9:30 的「每日数据更新」任务在这一步必炸。改为先解包 `result.data`。此 bug 影响 9:30 全链路（HS300 详情 + 后续依赖步骤），修复后沪深300 基金详情可正常刷新。
- **财联社新闻源失效** — 旧接口 `nodeapi/updateTelegraph` 下线返回 404，快讯自 11 月起只剩东方财富一个来源。改用 `v1/roll/get_roll_list`（参数按 key 排序 → sha1 → md5 生成 `sign`），实测恢复正常返回；字段结构（`id`/`ctime`/`title`/`brief`/`content`/`shareurl`/`subjects`）与旧接口完全兼容。
- **日志错误详情被静默丢弃（128 处）** — winston 的 printf 只输出第一个参数，`logger.warn('xx失败:', e.message)` 这类调用打印出来的错误原因为空（财联社抓取失败的日志一直是空的就是这个原因）。`server/utils/logger.cjs` 在出口处包装 error/warn/info/debug/http 五个级别，把额外参数拼回 message，一次修复全部 128 处调用点。
- **数据检查脚本日期显示提前一天** — `check-stale.cjs` / `check-data-status.cjs` 用 `toISOString()` 格式化 DATE 列，node-pg 把 DATE 解析为本地时区零点的 Date，UTC 转换后日期整体提前一天（本地 UTC+8 实测 11-13 显示成 11-12）。改为按本地年月日格式化。
- **About 页版本号停留在 v1.4.0** — v1.4.1 / v1.4.2 发布时未同步，现补齐至 v1.4.3。

### Changed
- **基金净值更新任务 16:00 → 20:30** — 当日净值 18:00-22:00 才陆续公布，16:00 执行的任务永远只能拿到 T-1 的净值（周一 16:00 拿到的是上周五的）。改到 20:30 后绝大多数基金当日入库，个别晚公布的由次日任务补上。指数估值（15:30）与板块数据（16:05）收盘后即时可得，时间不变。

### Data
- 全量基金净值 / 指数估值 / 板块资金流向更新至最新交易日（6569 只基金，47.5 万条净值）。

## [1.4.2] — 2026-11-16

### Fixed
- **招行理财数据长期停更（严重）** — 定时任务用 `spawn('python', ...)`，但生产服务器只有 `python3`，从 8 月起每天以 `spawn python ENOENT` 静默失败，`cmb_products` / `cmb_zhaoyin_nav` 数据停在 8 月初。`server/jobs/index.cjs` 改为按 `PYTHON_BIN` → `python3` → `python` 探测解释器。
- **Playwright 浏览器版本不匹配** — 库升级后需要 `chromium_headless_shell-1208`，机器上只有 `1234`，抓取直接报错退出。已安装匹配版本。
- **翻页抓取会静默卡死** — `fetch_cmb_personal_nav.py` 依赖点击 DOM「下一页」，缺少分页元素时在 `next_link.click()` 处无限等待（实测 `133045A` 卡住 10 分钟无输出、进程不退出）。新脚本 `update-cmb-nav-session.py` 改走官方 JSON 接口，不再触碰分页 DOM。
- **持仓估值停留在旧净值** — `fund_records` 的 `current_nav` / `market_value` / `pnl` 缓存字段未随净值刷新。新增 `scripts/sync-cmb-holdings.cjs` 并在净值更新后自动串联执行。

### Added
- `scripts/update-cmb-nav-session.py` — 招行理财净值抓取。复用页面真实请求的鉴权头（`appId`/`timespan`/`signature`）查询官方 JSON 接口，只取数据不渲染 DOM。实测 92 个产品全部成功，耗时约 2 分钟，对比原方案 30 分钟仅完成 14 个。
- `scripts/update-cmb-nav-api.py` — 纯 requests 版本（保留作为接口无签名校验环境下的备选）。
- `scripts/sync-cmb-holdings.cjs` — 持仓估值同步，支持 `--dry-run`。
- README「数据更新运维」补充招行模块维护说明，并记录 `python` 别名的运维陷阱。

### Changed
- `.gitignore` 增加 `scripts/update-cmb-nav-*.py` 例外，抓取脚本纳入版本管理（此前 `scripts/*.py` 被整体忽略，换机器会丢失运维能力）。
- 定时任务「个人理财产品净值爬取」从调用旧翻页脚本改为新脚本 + 持仓同步串联。

### Data
- 招行理财 92 个产品净值全部更新至最新交易日（2026-11-10 ~ 11-12），`cmb_zhaoyin_nav` 写入 18,769 条，已达 22,131 条 / 245 个产品。
- 33 条招行理财持仓估值同步完成，市值合计 ¥1,718,619.17。


## [1.4.1] — 2026-11-16

### Fixed
- **首屏性能：ECharts 移出预加载链路** — 删除 `src/main.tsx` 中对 `utils/echarts-theme` 的静态引用，改为图表首次渲染时经 `getEchartsTheme()` 惰性注册暗色主题。`dist/index.html` 的 `modulepreload` 从 4 条降到 3 条，首屏少传 1.1 MB。
- **首屏性能：移除 `markdown` 手动分包** — `manualChunks` 把 `react-markdown` 单独拆块时，连带入口所需的模块一起卷了进去，导致 150 KB 白进首屏预加载。现随 `AIAssistant` 懒加载页一起加载。
- **测试在 Node 22+ 全线崩溃** — Node 内置的 `localStorage` 全局 getter 不带 `--localstorage-file` 时返回 `undefined` 且优先级高于 jsdom 实现，导致 11 个测试套件在 import 阶段即 TypeError。`src/test/setup.ts` 在加载 i18n 前注入内存实现。
- **`src/i18n/index.ts` 存储读取无兜底** — 存储被禁用（隐私模式/企业策略）时会让整个应用白屏，改为 try/catch + 可选链。
- **后端测试断言过时** — `manager 过滤` 用例仍断言精确匹配 `AND manager =`，实际实现早已改为模糊匹配 `manager ILIKE '%…%'`，按现状修正测试。
- **README 重复的 `## 部署` 标题** — 连续两行重复，删掉一条。

### Added
- README 新增「首屏性能约定」「测试」「刷新防白闪（pre-paint）」「生产环境检查清单」四节，记录构建红线与上线核对项。
- README 记录 nginx `add_header` 继承陷阱：`location` 块内自带 `add_header` 会使 server 级安全头全部失效。

### Security
- `/web/` 补回 `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy`（此前因上述继承陷阱丢失）。
- `keys/` 目录权限收至 `700`，私钥文件 `600`。

### Verified
- 前端 128/128、后端 234/234 全部通过。
- 生产实测：登录 200，`/api/market/*` 与 `/api/portfolio/summary` 全 200，持仓页 5652 节点正常渲染（¥1,732,130.90 / +0.12%），图表 canvas 有实际绘制像素，暗色主题 39 段文字中 32 段为浅色（证明惰性注册生效），深色刷新 `body` 背景为 `rgb(20,20,20)` 无白闪。


## [1.4.0] — 2026-08-22

### Added
- `server/migrations/004_portfolio_alert_lines.cjs` — 持仓预警线建表迁移
- `server/routes/portfolio/alert-lines.cjs` — 预警线 CRUD API（止盈/止损设置）
- `server/routes/portfolio/backtest.cjs` — 组合回测 API（加权净值/年化收益/最大回撤/夏普/卡玛/波动率）
- `server/routes/portfolio/allocation-advice.cjs` — 资产配置建议 API（风险画像 + 目标配置 + 差距分析）
- `src/components/AlertLinesPanel.tsx` — 预警线管理组件（设置/触发状态/接近预警）
- `src/components/portfolio/BacktestTab.tsx` — 组合回测组件（基金选择/权重/时间范围/图表/8项统计）
- `src/components/portfolio/AllocationAdviceTab.tsx` — 资产配置建议组件（饼图/差距表/调仓建议）
- `src/components/portfolio/ReportTab.tsx` — 投资报告组件（从独立页面提取为 Tab 组件）
- `src/components/fundlist/types.ts` — 共享 CompareFund 接口（消除重复类型定义）
- `docs/ANALYSIS-OPTIMIZATION.md` — 全面分析与优化执行日志

### Changed
- `src/services/api.ts`：401 时派发 `auth:unauthorized` 事件自动跳转登录页；`exportTransactions` 使用 `API_BASE` 替代硬编码；新增 backtest/getAllocationAdvice/getAlertLines 等 API 方法
- `src/contexts/AuthContext.tsx`：监听 `auth:unauthorized` 事件清除用户状态；useEffect 依赖标注
- `src/components/Navbar.tsx`：轮询可见性优化（`document.visibilityState`）；移除投资报告独立入口
- `src/pages/Login.tsx`：支付宝二维码获取改用 `authApi.getAlipayQrcode()` 统一 API
- `vite.config.ts`：添加 `manualChunks` 函数分割 echarts/antd/markdown/gsap
- `src/components/MobileTabBar.tsx`：添加 aria-label/aria-current 无障碍标签；移除投资报告入口
- `src/components/PullToRefresh.tsx`：添加 aria-busy 无障碍状态
- `src/pages/Portfolio.tsx`：新增"组合回测""资产配置建议""投资报告"三个 Tab
- `src/pages/FundList.tsx`：使用共享 CompareFund 接口消除重复类型
- `src/components/fundlist/FundComparePanel.tsx`：使用共享 CompareFund 接口
- `src/pages/FundDetail.tsx`：移除未使用的 Spin 导入
- `src/pages/About.tsx`：版本号 v1.4.0、更新日志、统计数据刷新
- `src/App.tsx`：`/reports` 路由重定向到 `/portfolio`
- `server/routes/portfolio/reports.cjs`：nav_changes 新增 fund_name 字段
- `package.json`：添加 dayjs 显式依赖；版本号升至 1.4.0

### Fixed
- `server/routes/portfolio/alert-lines.cjs`：修复 SQL 语法错误（`!CORRECTED!` 占位符 + `ORDER BY?`）
- 服务器后端代码全量同步，修复 `svipExclusiveMiddleware` 全局拦截导致报告 API 返回 403 的 bug

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
