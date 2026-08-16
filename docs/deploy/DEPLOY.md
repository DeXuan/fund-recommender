# 基金推荐网站部署方案

## 架构概览

```
┌───────────────────────────────────────────────────────────┐
│                      服务器                                 │
│                                                           │
│   ┌──────────────┐   /api/*    ┌──────────────────────┐  │
│   │   Nginx      │ ─────────→ │   Express 后端        │  │
│   │   (:8688)    │            │   (PM2, port 3003)    │  │
│   └──────┬───────┘            └──────────┬─────────────┘  │
│          │                               │                │
│          │ /web/* (静态文件)              │                │
│          ▼                               ▼                │
│   ┌──────────────┐            ┌──────────────────────┐  │
│   │   dist/      │            │   PostgreSQL          │  │
│   │   React SPA  │            │   (:5432)             │  │
│   └──────────────┘            └──────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

> **生产服务器：111.229.32.106**（47.116.77.67 为已下线废弃旧机，勿再使用）
>
> 当前有两套站点并存：
> - **旧站** `/var/www/jijin`：Nginx 8688，PM2 `fund-server`，后端 3003
> - **新站 `/var/www/jijin85`（在用）**：Nginx 8686，PM2 `fund-server-85`，后端 3303，访问 http://111.229.32.106:8686/web
>
> 共享数据库在服务器本地（PG_HOST=localhost）。部署用 `scp -r` 上传，**不要用 rsync**；不要直接运行 `deploy.sh`（会 `pm2 delete` 杀掉旧站）。

## 技术栈

| 组件 | 技术 | 端口 |
|------|------|------|
| 前端 | React 19 + Vite 8 + Ant Design 6 | Nginx 8688 |
| 后端 | Express 5 + Node.js 20+ | 3003 |
| 数据库 | PostgreSQL 14+ | 5432 |
| 进程管理 | PM2 | - |
| Web 服务器 | Nginx | 8688 |

## 目录结构

```
/var/www/jijin/
├── dist/                 # 前端构建产物
│   ├── index.html
│   └── assets/
├── server/               # 后端代码
│   ├── index.cjs         # Express 服务入口
│   ├── db.cjs            # PostgreSQL 数据库初始化
│   ├── fund-service.cjs  # 基金数据服务层
│   ├── fund-data.cjs     # 基金种子数据
│   ├── auth.cjs          # 认证模块
│   ├── admin.cjs         # 管理后台模块
│   ├── portfolio.cjs     # 持仓管理模块
│   ├── data-fetcher.cjs  # 数据抓取模块
│   ├── news-fetcher.cjs  # 新闻抓取模块
│   ├── calendar-fetcher.cjs # 实时财经日历抓取（集思录）
│   ├── fund-analysis.cjs  # 基金分析模块
│   ├── subscription-service.cjs # 订阅会员服务
│   ├── jobs/
│   │   └── index.cjs     # 每日定时任务调度中心（QDII/指数估值/全量/板块）
│   ├── routes/
│   │   ├── api.cjs               # 主 API 路由
│   │   ├── funds.cjs             # 基金数据路由
│   │   ├── market.cjs            # 市场数据路由
│   │   ├── industry.cjs          # 行业分析路由
│   │   ├── tools.cjs             # 工具路由
│   │   ├── cmb.cjs               # 招行理财路由
│   │   ├── news.cjs              # 新闻路由
│   │   ├── alerts.cjs            # 智能提醒路由
│   │   ├── ai-assistant.cjs      # AI 助手路由
│   │   ├── watchlist.cjs         # 自选基金路由
│   │   ├── subscription.cjs      # 订阅支付路由
│   │   ├── fund-compare.cjs      # 基金对比
│   │   ├── fund-diagnosis.cjs    # 基金诊断
│   │   ├── portfolio-analysis.cjs # 持仓分析
│   │   ├── stock-picker.cjs      # AI 选股核心（8 端点）
│   │   ├── stock-picker-user.cjs # 选股用户数据（10 端点）
│   │   ├── stock-picker-temperature.cjs # 指数温度计
│   │   ├── stock-picker-nl.cjs   # 自然语言筛选（SVIP）
│   │   ├── stock-picker-corr.cjs # 相关性分析
│   │   ├── stock-picker-alerts.cjs # 选股提醒
│   │   └── portfolio/
│   │       ├── index.cjs         # 持仓路由聚合
│   │       ├── records.cjs       # 持仓记录 CRUD
│   │       ├── analytics.cjs     # 持仓统计
│   │       ├── insights.cjs      # 组合洞察
│   │       ├── transactions.cjs  # 交易记录
│   │       ├── dca.cjs           # 定投计划
│   │       ├── import.cjs        # CSV 导入
│   │       └── asset-accounts.cjs # 多账户资产
│   └── utils/
│       ├── rate-limiter.cjs   # 速率限制器
│       ├── scheduler.cjs      # 定时任务调度器
│       ├── trading-hours.cjs  # 交易时间判断
│       ├── crypto.cjs         # AES-256-GCM 加密工具
│       ├── alipay.cjs         # 支付宝 SDK 封装
│       └── logger.cjs         # 结构化日志（winston）
├── scripts/              # 数据抓取脚本
│   ├── update-all-funds.cjs          # 全量基金数据更新（支付宝/蚂蚁财富 API）
│   ├── update-all-funds-full.cjs     # 全量基金数据更新（完整字段）
│   ├── update-fund-data.cjs          # 基金基础数据更新
│   ├── update-qdii-funds.cjs         # QDII 基金专项更新（限额 + 1y/3m/1m）
│   ├── update-index-valuation.cjs    # 指数估值更新（PE/PB + 历史分位）
│   ├── update-sector-data.cjs        # 行业板块数据更新
│   ├── fetch-gold-funds.cjs          # 金选基金数据抓取
├── .env                  # 环境变量（不上传到仓库）
├── package.json
└── node_modules/
```

## 前置条件

### 服务器要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |
| 内存 | 1 GB | 2 GB+ |
| 磁盘 | 2 GB 可用空间 | 10 GB+ |
| CPU | 1 核 | 2 核+ |
| 端口 | 8688（Nginx） | 8688 + 443（HTTPS） |

### 软件依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 20 LTS | 后端运行时 |
| npm | >= 9 | 包管理 |
| PostgreSQL | >= 14 | 数据库 |
| Nginx | >= 1.18 | 反向代理 |
| Python | >= 3.8 | 招行数据爬取（可选） |
| PM2 | latest | 进程管理 |

### 本地环境

- Node.js >= 20 LTS
- npm >= 9
- SSH 可连接到目标服务器
- scp 已安装（部署用 scp -r 上传，勿用 rsync）

---

## 多环境部署方案

### 环境对比

| 配置项 | 开发环境 | 测试环境 | 生产环境 |
|--------|----------|----------|----------|
| `NODE_ENV` | development | test | production |
| `ENABLE_MOCK_AUTH` | true | true | **false** |
| `PG_HOST` | localhost | localhost | localhost |
| 数据库 | fund_dev | fund_test | fund_prod |
| HTTPS | 否 | 可选 | **必须** |
| PM2 | 否（直接 node） | 是 | 是 |
| Nginx | 否（Vite 代理） | 是 | 是 |
| 日志级别 | debug | info | warn |
| 速率限制 | 宽松 | 中等 | 严格 |

### 开发环境

```bash
# 1. 克隆项目
git clone <repo-url> fund-recommender
cd fund-recommender

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：
#   ENABLE_MOCK_AUTH=true
#   PG_DATABASE=fund_dev

# 4. 启动 PostgreSQL（如果本地未运行）
sudo systemctl start postgresql

# 5. 创建数据库
sudo -u postgres psql -c "CREATE DATABASE fund_dev;"
sudo -u postgres psql -c "CREATE USER fund_user WITH PASSWORD 'dev_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE fund_dev TO fund_user;"

# 6. 初始化表结构
node -e "require('./server/db.cjs').initDatabase().then(() => console.log('Done'))"

# 7. 启动后端（新终端）
npm run server

# 8. 启动前端（新终端）
npm run dev
```

访问 http://localhost:5174/web

### 测试环境

```bash
# 使用 Windows 一键部署脚本
deploy.bat

# 或手动部署到远程测试服务器
export DEPLOY_SERVER_IP=your-test-server-ip
./deploy.sh
```

测试环境 `.env` 配置：
```env
NODE_ENV=test
ENABLE_MOCK_AUTH=true
PG_DATABASE=fund_test
JWT_SECRET=test_secret_at_least_32_chars_long
ALLOWED_ORIGINS=http://test-server:8688,http://localhost:5174
```

### 生产环境

```bash
# 方式一：全新部署（推荐）
# 1. 打包项目为 fund-recommender.zip
# 2. 上传到服务器 /tmp/ 目录
# 3. SSH 登录服务器运行
bash /tmp/deploy-full.sh

# 方式二：本地一键部署到远程服务器
export DEPLOY_SERVER_IP=your-production-server-ip
./deploy.sh

# 方式三：带域名 + HTTPS
bash /tmp/deploy-full.sh --domain=your-domain.com
```

生产环境 `.env` 配置：
```env
NODE_ENV=production
ENABLE_MOCK_AUTH=false
PG_DATABASE=fund_prod
PG_PASSWORD=<strong-random-password>
JWT_SECRET=<generated-by-deploy-script>
ALLOWED_ORIGINS=https://your-domain.com
```

---

## 一键部署脚本

### 脚本一览

| 脚本 | 平台 | 用途 | 运行位置 |
|------|------|------|----------|
| `deploy-full.sh` | Linux | 全新部署 | 服务器 |
| `deploy.sh` | Linux/Mac | 远程部署 | 本地 |
| `deploy.bat` | Windows | 本地开发 | 本地 |
| `update.sh` | Linux | 更新已有部署 | 服务器 |
| `fix-server.sh` | Linux | 修复服务器问题 | 服务器 |
| `fix-permission.sh` | Linux | 修复 403 权限错误 | 服务器 |
| `deploy-termux.sh` | Android | Termux 部署 | Termux |

### deploy-full.sh 参数

```bash
bash /tmp/deploy-full.sh [选项]

选项:
  --domain=DOMAIN    配置域名（启用 HTTPS 提示）
  --port=PORT        自定义 Nginx 端口（默认 8688）
  --skip-db          跳过数据库初始化
  --skip-https       跳过 HTTPS 配置提示
  --help             显示帮助信息
```

### deploy.sh 环境变量

```bash
# 方式一：设置环境变量
export DEPLOY_SERVER_IP=192.168.1.100
export DEPLOY_SERVER_USER=root
export DEPLOY_DIR=/var/www/jijin
export NGINX_PORT=8688
./deploy.sh

# 方式二：创建 .env.deploy 文件
cat > .env.deploy << EOF
DEPLOY_SERVER_IP=192.168.1.100
DEPLOY_SERVER_USER=root
NGINX_PORT=8688
EOF
./deploy.sh
```

---

## 数据库配置

**重要：数据库和服务器在同一台机器上，PG_HOST 必须使用 localhost！**

### 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 创建数据库和用户

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 PostgreSQL 命令行中执行：
CREATE DATABASE fund_db;
CREATE USER fund_user WITH PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE fund_db TO fund_user;
ALTER USER fund_user CREATEDB;
\q
```

### 配置环境变量

在服务器上创建 `/var/www/jijin/.env` 文件：

```env
# JWT 密钥（至少32字符，使用以下命令生成）
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=your_jwt_secret_here_at_least_32_chars

# CORS 允许的前端域名（逗号分隔）
ALLOWED_ORIGINS=http://your-server-ip:8688,http://localhost:5173,http://localhost:5174

# Mock 登录（生产环境必须为 false）
ENABLE_MOCK_AUTH=false

# 支付宝配置
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://your-server-ip:8688/api/auth/alipay/callback

# PostgreSQL 数据库（数据库和服务器在同一台机器，必须使用localhost）
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=fund_db
PG_USER=fund_user
PG_PASSWORD=your_strong_password
```

**重要：** 数据库和服务器在同一台机器上，`PG_HOST` 必须使用 `localhost`，不能使用 IP 地址！

### 数据库初始化

数据库表会在服务器首次启动时自动创建。如需手动初始化：

```bash
cd /var/www/jijin
node -e "require('./server/db.cjs').initDatabase().then(() => console.log('Done'))"
```

---

## Nginx 完整配置

```nginx
server {
    listen 8688;
    server_name your-server-ip;

    # 安全响应头
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

    # 请求体大小限制
    client_max_body_size 10k;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    # 前端 SPA
    location /web/ {
        alias /var/www/jijin/dist/;
        index index.html;
        try_files $uri $uri/ /web/index.html;
    }

    # 静态资源缓存
    location /web/assets/ {
        alias /var/www/jijin/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 根路径重定向
    location = / {
        return 301 /web/;
    }

    # /web 重定向到 /web/
    location = /web {
        return 301 /web/;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

---

## 安全部署配置

### 环境变量安全

```bash
# 生成强随机 JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 生成强随机数据库密码
openssl rand -base64 32

# 设置 .env 文件权限（仅 owner 可读写）
chmod 600 /var/www/jijin/.env
```

### 安全响应头（双层防护）

**Nginx 层**（静态资源 + API 响应）：
- `X-Content-Type-Options: nosniff` — 防止 MIME 类型嗅探
- `X-Frame-Options: SAMEORIGIN` — 防止点击劫持
- `X-XSS-Protection: 1; mode=block` — XSS 过滤
- `Referrer-Policy: strict-origin-when-cross-origin` — 控制 Referer 信息泄露
- `Permissions-Policy` — 禁用摄像头、麦克风、地理位置等浏览器 API

**Express helmet 中间件层**（API 响应）：
- `Content-Security-Policy` — 限制资源加载来源
- `Strict-Transport-Security` — 强制 HTTPS（需配合 SSL 证书）
- `X-DNS-Prefetch-Control` — 控制 DNS 预获取

### 用户认证与权限校验

- `authMiddleware` 实时查询数据库用户状态（30 秒 TTL 缓存），被禁用用户的 JWT 令牌立即失效
- `adminMiddleware` 实时查询数据库 role/status，不信任 JWT 缓存的 role
- 管理员降权后旧 token 立即失效（无需等待 7 天过期）

### 网络安全

```bash
# 仅开放必要端口
ufw allow 8688/tcp    # Nginx
ufw allow 22/tcp      # SSH
ufw enable            # 启用防火墙

# 数据库端口不对外暴露（默认已禁止）
# 确认 PostgreSQL 只监听 localhost
grep "listen_addresses" /etc/postgresql/*/main/postgresql.conf
# 应为: listen_addresses = 'localhost'
```

---

## 防火墙配置

### Ubuntu/Debian (ufw)

```bash
# 启用防火墙
sudo ufw enable

# 开放必要端口
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 8688/tcp     # Nginx

# 如果需要 HTTPS
sudo ufw allow 443/tcp      # HTTPS

# 查看状态
sudo ufw status verbose
```

### CentOS/RHEL (firewalld)

```bash
# 启用防火墙
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 开放端口
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=8688/tcp
sudo firewall-cmd --permanent --add-port=443/tcp

# 重载配置
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-all
```

### 阿里云安全组

部署前需在阿里云控制台放行端口：

1. 登录阿里云控制台 → ECS → 安全组
2. 添加入站规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 你的 IP | SSH（限制来源 IP 更安全） |
| TCP | 8688 | 0.0.0.0/0 | Web 服务 |
| TCP | 443 | 0.0.0.0/0 | HTTPS（如需） |

---

## 接口限流配置

### Express 应用层限流

项目内置三级速率限制（`server/utils/rate-limiter.cjs`）：

| 类型 | 限制 | 说明 |
|------|------|------|
| 通用 API | 300 次/分钟 | 所有 API 请求 |
| 认证接口 | 10 次/分钟 | 登录、注册、密码修改 |
| 数据更新 | 3 次/15 分钟 | 手动触发数据刷新 |
| 订阅订单 | 5 次/分钟/用户 | 防止垃圾订单 |
| 支付轮询 | 30 次/分钟/用户 | 防止频繁轮询 |

### Nginx 层限流

在 `/etc/nginx/nginx.conf` 的 `http` 块中添加：

```nginx
http {
    # 速率限制区域：每秒 30 个请求，共享内存 10MB
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    # 连接数限制
    limit_conn_zone $binary_remote_addr zone=conn:10m;
}
```

在 `server` 块中应用：

```nginx
server {
    # API 限流
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_conn conn 10;
        # ... 其他配置
    }
}
```

### 自定义限流

如需调整限流参数，修改 `server/utils/rate-limiter.cjs`：

```javascript
// 通用 API 限流
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 分钟窗口
  max: 300,              // 最大请求数
  message: '请求过于频繁，请稍后再试'
});
```

---

## HTTPS 配置

### 使用 Let's Encrypt (certbot)

```bash
# 1. 安装 certbot
apt install certbot python3-certbot-nginx

# 2. 申请证书（替换为你的域名）
certbot --nginx -d your-domain.com

# 3. 测试自动续期
certbot renew --dry-run

# 4. 设置自动续期定时任务
echo "0 3 * * * certbot renew --quiet" | crontab -
```

### 手动配置 SSL

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... 其他配置同上
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

---

## 运维命令

### 后端管理 (PM2)

```bash
pm2 status                        # 查看所有进程状态
pm2 logs fund-server              # 查看后端实时日志
pm2 logs fund-server --lines 100  # 查看最近 100 行日志
pm2 restart fund-server           # 重启后端
pm2 stop fund-server              # 停止后端
pm2 delete fund-server            # 删除进程
pm2 monit                         # 实时监控面板
pm2 show fund-server              # 查看进程详情
```

### Nginx 管理

```bash
nginx -t                          # 测试配置语法
systemctl status nginx            # 查看状态
systemctl restart nginx           # 重启
systemctl reload nginx            # 热重载配置
tail -f /var/log/nginx/access.log # 访问日志
tail -f /var/log/nginx/error.log  # 错误日志
```

### 数据库管理

```bash
# 连接数据库
psql -h localhost -U fund_user -d fund_db

# 查看表
\dt

# 查看基金数量
SELECT COUNT(*) FROM funds;

# 备份数据库
pg_dump -h localhost -U fund_user fund_db > backup_$(date +%Y%m%d).sql

# 恢复数据库
psql -h localhost -U fund_user fund_db < backup_20260101.sql
```

### 增量更新

```bash
# 只更新前端
npm run build
scp -r dist/* root@111.229.32.106:/var/www/jijin85/dist/

# 只更新后端
scp -r server/ root@111.229.32.106:/var/www/jijin85/server/
ssh root@111.229.32.106 "cd /var/www/jijin85 && pm2 restart fund-server-85"
```

---

## 故障排查

| 问题 | 排查命令 | 常见原因 |
|------|----------|----------|
| 网站打不开 | `curl -I http://server:8688/web/` | Nginx 未启动 / 端口未开放 |
| API 返回 502 | `pm2 logs fund-server` | 后端未启动 / 崩溃 |
| 数据库连接失败 | `psql -h localhost -U user -d db` | PG_HOST 不是 localhost / 密码错误 |
| 页面没有数据 | `curl http://localhost:3003/api/funds` | 数据库为空 / 表未初始化 |
| Nginx 配置错误 | `nginx -t` | 语法错误 |
| 端口被占用 | `lsof -i :8688` 或 `lsof -i :3003` | 其他进程占用 |
| 磁盘空间不足 | `df -h` | 日志文件过大 |
| Node.js 内存溢出 | `pm2 restart fund-server` | 数据量过大 |
| 403 Forbidden | `bash /var/www/fix-permission.sh` | 文件权限错误 |
| 阿里云安全组未放行 | 控制台检查入站规则 | 安全组配置遗漏 |

---

## 回滚方案

### 方式一：从备份恢复（推荐）

```bash
ssh root@server
cd /var/www

# 查看备份列表
ls -la backups/

# 恢复最近的备份
tar -xzf backups/jijin_XXXXXXXX_XXXXXX.tar.gz -C /var/www/
cd /var/www/jijin
npm install --omit=dev
pm2 restart fund-server
```

### 方式二：重新部署旧版本

```bash
# 本地打包旧版本代码为 fund-recommender.zip
# 上传到服务器 /tmp/ 目录
scp fund-recommender.zip root@server:/tmp/
ssh root@server "bash /tmp/deploy-full.sh"
```

---

## 监控

```bash
# 查看服务器资源
htop                    # CPU / 内存
df -h                   # 磁盘
pm2 monit               # Node.js 进程监控

# 查看访问统计
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head 20

# 查看错误日志
tail -f /var/log/nginx/error.log
pm2 logs fund-server --err

# 检查后端健康
curl http://localhost:3003/health
```

---

## 首次部署检查清单

- [ ] 上传项目 zip 到服务器
- [ ] 运行 `deploy-full.sh`（JWT_SECRET 会自动生成）
- [ ] 编辑 `.env` 文件，配置数据库连接（PG_HOST=localhost）
- [ ] 创建数据库和用户
- [ ] 上传支付宝密钥到 `keys/` 目录（如需支付宝登录）
- [ ] 上传前端构建产物 `dist/`（如果服务器构建失败）
- [ ] 确认 Python 3.8+ 已安装（招行理财产品数据爬取需要，可选）
- [ ] 阿里云安全组放行端口 8688
- [ ] 测试访问 http://server-ip:8688/web
- [ ] 测试 API: curl http://localhost:3003/api/funds
- [ ] 测试支付宝登录功能（如需）
- [ ] 运行 `pm2 startup` 确保开机自启已配置
- [ ] 配置 HTTPS（生产环境推荐）
- [ ] 设置数据库定期备份

## 更新后验证

每次更新后建议检查：

```bash
# 1. 确认 .env 包含所有必需变量（新版可能新增变量）
cat /var/www/jijin/.env | grep -v "^#" | grep -v "^$"

# 2. 确认后端正常启动
pm2 logs fund-server --lines 20

# 3. 确认 API 正常响应
curl http://localhost:3003/api/funds | head -c 200

# 4. 确认前端可访问
curl -I http://localhost:8688/web/

# 5. 确认安全响应头存在
curl -I http://localhost:8688/web/ | grep -E "X-Content-Type|X-Frame|Referrer"
```
