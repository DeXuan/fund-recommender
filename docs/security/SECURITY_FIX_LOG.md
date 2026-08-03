# 安全漏洞修复记录

> 本文档记录基金推荐助手项目历次安全审查中发现的漏洞、风险等级、修复措施及验证结果。

---

## 修复统计

| 严重性 | 数量 |
|--------|------|
| CRITICAL | 6 |
| HIGH | 16 |
| MEDIUM | 33 |
| LOW | 14 |
| **合计** | **69** |

---

## v1.1.0 (2026-06-28) — AI 选股引擎安全加固

### 认证与授权

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | .env.termux 使用弱 JWT 密钥（`fund-recommender-termux-secret-key-2024`），可被暴力破解伪造 token | 替换为 64 字符随机密钥（`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) | 密钥长度 ≥32 字符，启动校验通过 |
| HIGH | ENABLE_MOCK_AUTH=true 且未设置 NODE_ENV，mock 登录端点在生产环境可访问 | .env 设置 ENABLE_MOCK_AUTH=false + NODE_ENV=production，deploy.sh 添加 --env production | POST /api/auth/alipay/mock-login 返回 404 |
| MEDIUM | Guest 登录复用 test01 用户数据，游客操作污染真实用户数据 | 改为自动创建独立 guest_visitor 账户，ON CONFLICT 处理并发创建 | Guest 登录返回 username=guest_visitor，与 test01 数据隔离 |
| MEDIUM | unhandledRejection 处理器仅日志不退出，进程可能处于不一致状态 | 添加 `setTimeout(() => process.exit(1), 1000)` 与 uncaughtException 一致，由 PM2 自动重启 | 未处理 Promise rejection 后进程延迟退出并重启 |

### 输入验证与输出编码

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| MEDIUM | AI 助手 HTML sanitizer 使用 `/<[^>]*>/g` 正则替换，可被嵌套标签绕过 | 改为 HTML 实体转义函数（`&` → `&amp;`，`<` → `&lt;`，`>` → `&gt;`，`"` → `&quot;`，`'` → `&#x27;`） | XSS payload 被正确转义 |

### 配置安全

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| MEDIUM | capacitor.config.ts 硬编码生产 IP `111.229.32.106` 作为默认值 | 改为 `process.env.VITE_API_HOST \|\| 'localhost'`，需通过环境变量配置生产 IP | 默认值为 localhost，不泄露生产服务器地址 |
| MEDIUM | CORS 白名单缺少 localhost:3003，生产模式下浏览器请求被拒绝 | 默认白名单添加 `http://localhost:3003` | 带 Origin 头的请求返回 200 |
| LOW | .env.example 缺少 NODE_ENV 文档 | 添加注释说明 NODE_ENV=production 的作用 | 文档完整 |

### 日志安全

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| LOW | 50 处 console.* 未使用 Winston 日志，生产环境日志不入文件 | 批量迁移到 logger.info/warn/error，仅保留 db.cjs 启动前 FATAL 检查 | combined.log 正确记录所有日志 |

### 性能安全

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| LOW | GSAP fallback 超时 3 秒，页面内容长时间不可见 | 降为 0.5 秒 | 页面加载后立即可见 |

### 订阅系统

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| LOW | subscription-service.cjs 仅检查 subscription_status，不识别 subscription_tier | getActiveSubscription() 查询增加 subscription_tier 字段，兼容旧版 premium + 新版 svip | 返回 tier 字段，SVIP 用户正确识别 |

---

## v0.7 (2026-06-11) — 全面安全审查

### 认证与授权

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | authMiddleware 数据库查询失败时默认放行（fail-open），禁用用户可在 DB 异常时绕过检查 | 改为 fail-closed 策略，DB 查询失败时返回 503 拒绝访问 | DB 断连场景下请求返回 503，非 200 |
| HIGH | SSE EventSource 将 JWT 放入 URL 查询参数，日志和 Referer 可泄露 token | 改用 fetch + ReadableStream + Authorization Header，token 不再暴露在 URL 中 | 浏览器 Network 面板确认 token 仅在 Header 中 |

### 输入验证

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| MEDIUM | 用户个人资料 API 无头像 URL 验证，可注入 `javascript:` 协议 | 添加 URL 格式校验 + 协议白名单（http/https/data）+ 长度限制 500 字符 | `javascript:alert(1)` 被拒绝 |
| MEDIUM | API 统计查询使用字符串拼接 INTERVAL，存在 SQL 注入风险 | 改用参数化查询 `($1 \|\| ' hours')::interval` | `' OR 1=1--` 参数被安全处理 |
| MEDIUM | CSV 用户导出未转义公式前缀，存在 Excel 公式注入风险 | 添加 escapeCsv 函数，转义 =、+、-、@ 前缀和双引号 | `=CMD(...)` 被转义为 `'CMD(...)` |
| MEDIUM | 系统配置 API 接受任意 key-value，管理员可插入恶意配置 | 添加 ALLOWED_CONFIG 白名单，仅允许修改已定义的配置键和合法值范围 | 未知配置键返回 400 |
| MEDIUM | 文件上传未校验 MIME 类型，可上传任意文件 | 添加 multer fileFilter，仅允许 CSV 文件（text/csv 或 .csv 扩展名） | .exe 文件被拒绝上传 |
| MEDIUM | 错误响应暴露数据库错误详情（表名、列名） | 统一为通用错误提示，详细错误仅记录到服务端日志 | 响应中不含 pg_ 前缀表名 |
| MEDIUM | 分页参数无上限，pageSize=999999 可获取全表数据 | 添加 Math.min(100) 上限约束，pageSize 最大 100 | pageSize=999 实际返回 100 条 |
| MEDIUM | 自选基金批量查询无数组长度限制 | 添加 codes.length > 100 校验 | 传入 101 个代码返回 400 |
| MEDIUM | 订阅订单创建无速率限制，可批量创建垃圾订单 | 添加用户级速率限制（5 次/分钟） | 第 6 次请求返回 429 |
| MEDIUM | 支付轮询无速率限制 | 添加用户级速率限制（30 次/分钟） | 超频请求返回 429 |
| MEDIUM | OAuth 回调 token 直接存入 localStorage，未验证有效性 | 先调用 getMe() 验证用户信息，成功后才存储 token | 无效 token 不会被存储 |
| MEDIUM | 管理员批量删除用户未使用事务，部分失败导致数据不一致 | 包装在 BEGIN/COMMIT 事务中，失败时 ROLLBACK | 模拟部分失败后数据完整 |
| MEDIUM | 基金对比 premium 端点无 LIMIT，可返回全量历史数据 | 添加 LIMIT 1000 限制 | 返回数据量 <= 1000 |

### 代码质量

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| LOW | StockPicker 使用 raw fetch 绕过统一 API 客户端 | 改用 fundApi.getIndustries() | 请求头包含 Authorization |
| LOW | FundCompare 页面存在但无路由，用户无法访问 | 添加 /web/fund-compare 路由 | 路由可正常访问 |

---

## v0.6 (2026-06-09) — 禁用用户即时失效 + 管理后台加固

### 认证与授权

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | 禁用用户仍可使用现有 JWT 令牌访问系统（最长 7 天） | authMiddleware 新增数据库用户状态检查（30 秒 TTL 缓存），禁用用户的所有请求立即返回 403 | 禁用后旧 token 立即返回 403 |
| HIGH | adminMiddleware 仅校验 JWT 中的 role 字段，管理员降权后旧 token 仍有效（最长 7 天） | adminMiddleware 改为实时查询数据库 role/status，不信任 JWT 缓存的 role | 降权后旧 token 立即失去管理员权限 |
| MEDIUM | POST /api/update 手动数据更新端点仅需认证，普通用户可触发全量数据刷新 | 添加 adminMiddleware，仅管理员可触发手动数据更新 | 非管理员返回 403 |
| MEDIUM | POST /api/cmb-products/update 和 /api/cmb-zhaoyin-nav/update 仅需认证，普通用户可触发 Python 爬虫进程 | 添加 adminMiddleware，仅管理员可触发招行理财产品数据更新 | 非管理员返回 403 |
| MEDIUM | adminMiddleware 输出用户敏感信息到控制台（用户名、ID、角色、状态） | 移除 console.log 调试输出，避免生产环境泄露用户隐私 | 日志中无敏感信息 |

### 部署安全

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | deploy.sh rsync 缺少 server/admin.cjs，部署后服务器启动崩溃 | 将 admin.cjs 加入 rsync 上传列表 | 部署后服务正常启动 |
| HIGH | deploy-full.sh 使用占位符 JWT_SECRET，管理员可能忘记修改导致安全风险 | 改为自动生成随机 JWT_SECRET（openssl rand -hex 48） | 每次部署生成不同密钥 |
| HIGH | DataStatus 组件「刷新」按钮触发 POST /api/update，普通用户点击返回 403 无提示 | 按钮仅管理员可见，非管理员点击显示 warning 提示 | 非管理员看不到按钮 |
| MEDIUM | deploy-full.sh 和 update.sh 缺少 pm2 startup，服务器重启后应用不会自动启动 | 添加 pm2 startup 配置 | 服务器重启后应用自动恢复 |
| MEDIUM | deploy-full.sh Nginx 配置缺少安全响应头 | 添加 X-Content-Type-Options、X-Frame-Options、Referrer-Policy、Permissions-Policy | 响应头已包含安全头 |
| MEDIUM | fix-server.sh 数据库测试使用硬编码占位符密码，永远连接失败 | 改为从 .env 文件读取数据库配置 | 数据库连接测试通过 |
| LOW | deploy-full.sh 安装 Node.js 18.x（已 EOL） | 升级为 Node.js 20.x LTS | node -v 显示 v20.x |

### 前端安全

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| MEDIUM | fetchApi 错误处理丢弃服务器返回的具体错误信息，用户只看到 "API error: 500" | 改为读取 response body 中的 error 字段，展示具体错误信息 | 用户可看到有意义的错误提示 |
| LOW | FundList 页面 mount 时 loadFunds() 被两个 useEffect 重复调用 | 移除第一个 useEffect 中的 loadFunds() 调用 | Network 面板确认仅一次请求 |

### 文档

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| MEDIUM | DEPLOY.md 目录结构缺少 admin.cjs、data-fetcher.cjs、routes/、utils/ 等关键文件 | 更新目录结构，完整列出所有服务端模块 | 目录结构与实际一致 |
| MEDIUM | DEPLOY.md Nginx 配置缺少安全响应头，与 deploy-full.sh 实际配置不一致 | 同步添加 5 项 Nginx 安全响应头 | 配置一致 |
| MEDIUM | DEPLOY.md 回滚方案使用 git 命令，但服务器部署基于 zip/rsync 无 git 仓库 | 改为从备份 tarball 恢复或重新部署旧版本 | 回滚流程可执行 |
| LOW | DEPLOY.md Node.js 版本要求 >=18，已 EOL | 更新为 >=20（LTS） | 文档准确 |
| LOW | DEPLOY.md 和 UPDATE_GUIDE.md 未提及 Python 依赖（招行数据爬取需要） | 添加 Python 3.8+ 依赖说明 | 文档完整 |
| LOW | UPDATE_GUIDE.md 缺少更新后验证步骤 | 添加 .env 验证、后端日志、API 响应、前端访问 4 步检查 | 验证流程完整 |

---

## v0.5 (2026-06-08) — helmet 中间件 + 支付宝配置修复

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | 行业基金代码和名称与支付宝数据不匹配 | 从天天基金网验证并更新所有 14 个行业的基金代码和名称 | 代码与支付宝一致 |
| MEDIUM | 安全响应头手动设置不完整，缺少部分 helmet 标准头 | 引入 helmet 中间件，自动管理 X-Content-Type-Options、X-Frame-Options、CSP、HSTS 等 | helmet 中间件生效 |
| MEDIUM | 支付宝回调地址硬编码在代码中（IP 地址） | 改为从 ALIPAY_RETURN_URL 环境变量读取 | 回调地址可配置 |
| MEDIUM | CSV 导入缺少基金代码格式校验 | 添加 `/^\d{6}$/` 正则校验，拒绝非法基金代码 | 非法代码被拒绝 |
| MEDIUM | auth.cjs 中 crypto 模块重复 require（函数内部） | 移除 mock-login 和 alipay/callback 中的重复 require | 代码整洁 |
| LOW | .env.example 缺少 ALLOWED_ORIGINS 配置说明 | 新增 ALLOWED_ORIGINS 示例，更新 ALIPAY_RETURN_URL 说明 | 文档完整 |

---

## v0.4 (2026-06-05) — 自选基金 + 智能提醒

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | OAuth 用户密码使用 Math.random() 生成（非密码学安全） | 改用 crypto.randomBytes(32).toString('hex') | 密码为 64 位十六进制 |
| HIGH | getAllFundsWithNav count query 正则匹配到子查询 FROM | 改用 indexOf + lastIndexOf 精确定位 | 分页总数正确 |
| HIGH | 前端无 ErrorBoundary，运行时错误导致白屏 | 新增 ErrorBoundary 组件包裹路由 | 运行时错误显示友好提示 |
| MEDIUM | X-XSS-Protection 响应头已废弃，可能引入漏洞 | 移除该 header | 响应头不含 X-XSS-Protection |
| MEDIUM | HSTS 在 HTTP 环境下无效 | 仅在 HTTPS 下设置 Strict-Transport-Security | HTTP 下不含 HSTS 头 |
| MEDIUM | Mock 登录可通过 ENABLE_MOCK_AUTH=true 在生产环境启用 | 增加 NODE_ENV !== 'production' 双重检查 | 生产环境 mock 登录被拒绝 |
| MEDIUM | 持仓/定投路由 :id 参数未校验为正整数 | 添加 parseInt + isNaN + id <= 0 校验 | 非法 ID 返回 400 |
| MEDIUM | 所有页面组件同步加载，无代码分割 | 改用 React.lazy + Suspense 懒加载 | 初始包体积减小 |
| MEDIUM | 多个页面 API 失败时无用户反馈 | 增加 message.error 错误提示 | 用户可看到错误提示 |
| MEDIUM | Portfolio 删除持仓用 forEach 无 await | 改用 Promise.all + await | 删除操作正确完成 |
| LOW | api.cjs 行业分析路由遗留 DEBUG 日志 | 移除 console.log 调试输出 | 日志干净 |
| LOW | 无 404 路由，未知路径显示空白页 | 添加 `path="*"` 兜底路由 | 未知路径重定向首页 |
| LOW | FundCompare.tsx (475行) 和 useApi.ts 从未被引用 | 删除死代码 | 无未引用文件 |

---

## v0.3 (2026-06-05) — 煤炭行业 + 金选基金

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | generateFundDetail() 引用不存在的 req 变量导致运行时报错 | 移除对 req 的引用，lastUpdateTime 由调用方自行获取 | 函数运行无报错 |
| MEDIUM | OAuth access_token 明文存储在数据库 | 使用 AES-256-GCM 加密存储（server/utils/crypto.cjs） | 数据库中 token 为密文 |
| MEDIUM | 速率限制器在 auth.cjs 和 index.cjs 中重复实现 | 提取为 server/utils/rate-limiter.cjs 共享模块 | 单一实现 |
| MEDIUM | 调度器逻辑（跳过周末、9:30 执行）重复 3 次 | 提取为 server/utils/scheduler.cjs 共享模块 | 单一实现 |
| MEDIUM | isTradingDay 仅判断周末，忽略法定节假日 | 新增 server/utils/trading-hours.cjs，内置 2025-2026 休市日历 + 调休工作日 | 节假日正确跳过 |
| MEDIUM | 基金查询无分页，数据量增长后有性能风险 | getAllFundsWithNav 新增 page/pageSize 参数，返回分页元数据 | 分页查询正常 |
| LOW | 进程退出时 setInterval 定时器未清理 | 新增 SIGTERM/SIGINT 处理，调用用 limiter.destroy() 清理 | 优雅退出 |
| LOW | destroyAll() 未清理 setInterval 定时器，存在资源泄漏 | 跟踪所有 cleanupInterval 引用，destroyAll() 时统一 clearInterval | 无资源泄漏 |

---

## v0.2 (2026-06-05) — 支付宝 OAuth

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | index.cjs 单体文件 1907 行，职责混乱 | 拆分为 data-fetcher.cjs + routes/api.cjs + utils/，入口精简至 ~200 行 | 模块职责清晰 |

---

## v0.1 (2026-06-04) — 初始版本安全加固

### CRITICAL 级别

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| CRITICAL | JWT Secret 使用硬编码默认值 | 强制从环境变量读取，缺失时启动失败 | 无 JWT_SECRET 时启动报错 |
| CRITICAL | 数据库密码硬编码在代码中 | 移除硬编码默认值，强制使用环境变量 | 代码中无硬编码密码 |
| CRITICAL | Mock 登录端点在 NODE_ENV 未设置时可访问 | 改用 ENABLE_MOCK_AUTH 环境变量控制，默认关闭 | 未设置时 mock 登录被拒绝 |
| CRITICAL | OAuth 回调将 JWT 放入 URL 查询参数 | 改用 Fragment (#) 传递，防止日志和 Referer 泄露 | URL 中无 token |
| CRITICAL | CORS 允许无 Origin 请求通过 | 移除 `!origin` 放行，仅允许白名单域名 | 非白名单 Origin 被拒绝 |
| CRITICAL | OAuth state 签名截断导致回调验证失败 | 使用完整 256-bit HMAC 签名 + timingSafeEqual 比较 | 回调验证通过 |

### HIGH 级别

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| HIGH | /api/update 端点无需认证即可触发 | 添加 authMiddleware 认证保护 | 未认证返回 401 |
| HIGH | OAuth state 使用 Math.random() 生成 | 改用 crypto.randomBytes() 密码学安全随机数 | state 为密码学安全随机数 |
| HIGH | PUT 持仓记录端点缺少输入验证 | 添加 shares > 0 和 cost_price > 0 校验 | 非法数值返回 400 |
| HIGH | 前端密码最小长度 6 与后端 8 不一致 | 前端统一为 min: 8 | 前后端一致 |
| HIGH | 基金排序字段映射错误导致 SQL 报错 | 建立 camelCase -> 数据库列名映射表 | 排序正常工作 |
| HIGH | 未配置 trust proxy 导致速率限制失效 | 添加 `app.set('trust proxy', 1)` | 速率限制生效 |

### MEDIUM 级别

| 严重性 | 问题 | 修复方案 | 验证结果 |
|--------|------|----------|----------|
| MEDIUM | CSP 允许 unsafe-eval | 移除 unsafe-eval，保留 unsafe-inline | CSP 不含 unsafe-eval |
| MEDIUM | CSV 导入缺少数值和日期验证 | 添加正数校验和 YYYY-MM-DD 格式验证 | 非法数据被拒绝 |
| MEDIUM | OAuth state 签名使用时间不安全比较 | 改用 crypto.timingSafeEqual 防止时序攻击 | 时序攻击无效 |

### 其他修复

| 问题 | 修复方案 |
|------|----------|
| iconv-lite 未在 package.json 中声明 | 添加为显式依赖 |
| 风险评估前后端选项不匹配 | 统一前后端选项映射 |
| 持仓计算使用静态种子数据 | 改用数据库实时净值 |
| 基金详情使用 Math.random() 生成伪数据 | 改用确定性算法，保证数据一致性 |

---

## 安全审查工具与方法

- **自动化审查**: 使用 `security-review` skill 对服务端代码进行全面安全审查
- **手动审查**: SQL 注入、XSS、CSRF、认证绕过等 OWASP Top 10 检查
- **验证方法**: 每项修复均通过手动测试验证修复效果

## 安全编码规范

1. **SQL 参数化查询**: 全量使用 `$1, $2` 占位符，禁止字符串拼接
2. **输入校验**: 所有用户输入在路由层校验，拒绝非法参数
3. **认证中间件**: authMiddleware 实时校验用户状态（fail-closed）
4. **权限中间件**: adminMiddleware 实时查询数据库，不信任 JWT 缓存
5. **错误处理**: 错误响应不暴露内部实现细节
6. **速率限制**: 通用 + 认证 + 数据更新三级限流
7. **安全头**: helmet + Nginx 双层防护
8. **敏感数据**: OAuth token AES-256-GCM 加密存储，JWT_SECRET 强制环境变量
