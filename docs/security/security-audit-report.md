# 安全漏洞修复台账

**审计日期**: 2026-06-21
**审计范围**: 全项目（前端 + 后端 + 依赖）
**审计人**: Claude Code 自动化审计

---

## 一、依赖漏洞扫描 (npm audit)

| 序号 | 漏洞包 | 严重程度 | 漏洞描述 | 修复方案 | 修复状态 |
|------|--------|----------|----------|----------|----------|
| 1 | form-data 4.0.0-4.0.5 | High | CRLF 注入（通过未转义的 multipart 字段名和文件名） | `npm audit fix` 升级到安全版本 | ✅ 已修复 |
| 2 | multer 1.0.0-2.1.1 | High | 深层嵌套字段名导致 DoS；中止上传时清理不完整 | `npm audit fix` 升级到安全版本 | ✅ 已修复 |
| 3 | undici 7.0.0-7.27.2 | High | TLS 证书验证绕过、跨用户信息泄露、HTTP 头注入、WebSocket DoS 等 7 个漏洞 | `npm audit fix` 升级到安全版本 | ✅ 已修复 |
| 4 | vite 8.0.0-8.0.15 | High | Windows UNC 路径 NTLMv2 哈希泄露；`server.fs.deny` 绕过 | `npm audit fix` 升级到安全版本 | ✅ 已修复 |

**修复结果**: `npm audit fix` 后 0 个漏洞

---

## 二、服务端安全漏洞

| 序号 | 漏洞 | 严重程度 | 文件位置 | 漏洞描述 | 修复方案 | 修复状态 |
|------|------|----------|----------|----------|----------|----------|
| 1 | 硬编码服务器 IP | Medium | `server/index.cjs:40` | CORS 默认白名单包含硬编码 IP `111.229.32.106` | 移除硬编码 IP，仅保留 localhost 默认值，生产环境必须通过 `ALLOWED_ORIGINS` 环境变量配置 | ✅ 已修复 |
| 2 | 硬编码 IP（支付宝回调） | Medium | `server/auth.cjs:478` | `ALIPAY_RETURN_URL` 默认使用硬编码 IP 的 HTTP 地址 | 移除默认值，未配置时返回 503 错误，强制使用环境变量 | ✅ 已修复 |
| 3 | 硬编码 IP（支付宝通知） | Medium | `server/utils/alipay.cjs:106` | `ALIPAY_NOTIFY_URL` 默认使用硬编码 IP 的 HTTP 地址 | 移除默认值，未配置时抛出错误，强制使用环境变量 | ✅ 已修复 |
| 4 | 支付宝回调无限流 | Medium | `server/routes/subscription.cjs:129` | 支付宝异步通知端点无速率限制，可被攻击者洪泛消耗 CPU（签名验证） | 添加每 IP 100次/分钟的速率限制 | ✅ 已修复 |
| 5 | 输入验证缺失（定投计划） | Low | `server/routes/portfolio/dca.cjs:23-45` | `fund_code` 未校验格式、`amount` 未校验范围、`day_of_month/week` 未校验范围、`notes` 无长度限制 | 添加 fund_code 正则 `/^\d{6}$/`、amount 范围校验、日期范围校验、notes 500字符限制 | ✅ 已修复 |
| 6 | 输入验证缺失（持仓记录） | Low | `server/routes/portfolio/records.cjs:73-103` | `fund_code` 未校验格式、`fund_name` 无长度限制、`buy_date` 未校验格式、`notes` 无长度限制 | 添加 fund_code 正则、fund_name 100字符限制、buy_date 格式校验、notes 500字符限制 | ✅ 已修复 |
| 7 | uncaughtException 吞异常 | Low | `server/index.cjs:374-377` | 仅记录 err.message（无堆栈），且不退出进程，可能导致内存泄漏和状态不一致 | 记录完整 err.stack，延迟 1 秒后退出进程（PM2 自动重启） | ✅ 已修复 |
| 8 | Avatar data: URL 协议 | Low | `server/auth.cjs:371-381` | 允许 `data:` 协议的头像 URL，可存储任意大的 base64 数据到数据库 | 移除 `data:` 协议支持，仅允许 `http:` 和 `https:` | ✅ 已修复 |

---

## 三、已确认的安全实践（无需修复）

| 项目 | 状态 | 说明 |
|------|------|------|
| SQL 注入防护 | ✅ 安全 | 所有数据库查询使用参数化查询（`$1`, `$2`），排序字段使用白名单校验 |
| 密码安全 | ✅ 安全 | bcrypt 10轮加盐哈希，登录失败计数+账户锁定 |
| JWT 安全 | ✅ 安全 | 启动时校验 JWT_SECRET（≥32字符），7天过期，admin 中间件实时查库验证角色 |
| OAuth CSRF 防护 | ✅ 安全 | 支付宝 OAuth state 使用 HMAC-SHA256 签名 + timingSafeEqual 比较 |
| 速率限制 | ✅ 安全 | 认证端点 10次/分钟，通用 API 300次/分钟，更新端点 3次/15分钟 |
| 安全响应头 | ✅ 安全 | Helmet 配置严格 CSP、HSTS、Permissions-Policy |
| 文件上传安全 | ✅ 安全 | Multer 512KB 限制、仅 CSV、1000行导入上限 |
| 加密存储 | ✅ 安全 | OAuth token 使用 AES-256-GCM 加密存储 |
| 管理员鉴权 | ✅ 安全 | 双中间件链（auth + admin），每次请求实时查库验证角色 |

---

## 四、前端安全评估

| 项目 | 状态 | 说明 |
|------|------|------|
| 路由守卫 | ✅ 安全 | ProtectedRoute + AdminRoute 组件正确实现 |
| Token 存储 | ⚠️ 可接受 | localStorage 存储 JWT（XSS 风险下可被窃取，但 httpOnly cookie 会增加 CSRF 复杂度） |
| API 客户端 | ✅ 安全 | 统一 fetchApi 封装，401 自动清除 token |
| XSS 防护 | ✅ 安全 | React 默认转义 JSX，未发现 dangerouslySetInnerHTML |
| 敏感数据 | ✅ 安全 | 无硬编码 API key 或密钥在前端代码中 |
| 懒加载 | ✅ 安全 | 所有路由使用 React.lazy + Suspense |
| ErrorBoundary | ✅ 安全 | AppRoutes 外层包裹 ErrorBoundary |

---

## 五、环境配置建议

| 项目 | 建议 |
|------|------|
| `.env` 文件 | 确保 `.env` 在 `.gitignore` 中（已确认在列） |
| CORS | 生产环境必须设置 `ALLOWED_ORIGINS` 为实际域名（HTTPS） |
| 支付宝 | 必须设置 `ALIPAY_RETURN_URL` 和 `ALIPAY_NOTIFY_URL` 为 HTTPS 公网地址 |
| 数据库 | 生产环境使用强密码，限制 PG 仅监听 localhost 或内网 |
| PM2 | 使用 PM2 管理进程，确保 `uncaughtException` 后自动重启 |
