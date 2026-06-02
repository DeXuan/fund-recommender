# 基金推荐网站部署方案

## 架构概览

```
┌───────────────────────────────────────────────────────────┐
│                      阿里云服务器                           │
│                    47.116.77.67                             │
│                                                           │
│   ┌──────────────┐   /api/*    ┌──────────────────────┐  │
│   │   Nginx      │ ─────────→ │   Express 后端        │  │
│   │   (:8688)    │            │   (PM2, port 3003)    │  │
│   └──────┬───────┘            └──────────────────────┘  │
│          │                                               │
│          │ /web/* (静态文件)                               │
│          ▼                                               │
│   ┌──────────────┐                                       │
│   │   dist/      │                                       │
│   │   React SPA  │                                       │
│   └──────────────┘                                       │
└───────────────────────────────────────────────────────────┘

访问地址: http://47.116.77.67:8688/web
```

## 技术栈

| 组件       | 技术                    | 端口  |
| ---------- | ----------------------- | ----- |
| 前端       | React + Vite + Ant Design | Nginx 8688 |
| 后端       | Express 5 + Node.js     | 3003  |
| 进程管理   | PM2                     | -     |
| Web 服务器 | Nginx                   | 8688  |

## 目录结构

```
/var/www/jijin/
├── dist/                 # 前端构建产物
│   ├── index.html
│   └── assets/
│       ├── index-*.js
│       └── index-*.css
├── server/               # 后端代码
│   ├── index.cjs         # Express 服务入口
│   └── fund-data.cjs     # 基金数据模块
├── package.json
└── node_modules/
```

## URL 路由规则

| 访问地址                                | 说明                 |
| --------------------------------------- | -------------------- |
| `http://47.116.77.67:8688/`             | 自动 301 跳转到 /web |
| `http://47.116.77.67:8688/web`          | 前端首页             |
| `http://47.116.77.67:8688/web/funds`    | 基金列表             |
| `http://47.116.77.67:8688/web/funds/xxx`| 基金详情             |
| `http://47.116.77.67:8688/api/funds`    | 后端 API             |

## 前置条件

### 服务器要求
- **操作系统**: Ubuntu 20.04+ / Debian 11+
- **内存**: ≥ 1GB
- **磁盘**: ≥ 2GB 可用空间
- **端口**: 8688 需开放（阿里云安全组需放行）

### 本地环境
- Node.js ≥ 18
- npm ≥ 9
- SSH 可连接到目标服务器
- rsync 已安装

## 一键部署

```bash
# 1. 确保 SSH 免密登录已配置
ssh root@47.116.77.67 "echo ok"

# 2. 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

## 部署流程详解

部署脚本自动执行以下 5 个步骤：

### Step 1: 本地构建前端
```bash
npm run build    # tsc 类型检查 + vite 构建
```
- `vite.config.ts` 设置 `base: '/web/'`，确保所有静态资源路径正确
- `App.tsx` 设置 `basename="/web"`，确保前端路由前缀正确
- 输出目录: `dist/`

### Step 2: 创建远程目录
```bash
ssh root@47.116.77.67 "mkdir -p /var/www/jijin/server"
```

### Step 3: 上传文件
| 文件/目录    | 传输方式       | 说明                  |
| ------------ | -------------- | --------------------- |
| dist/        | rsync --delete | 前端产物，增量同步    |
| server/      | rsync          | 后端代码              |
| package.json | scp            | npm 依赖声明          |

### Step 4: 远程服务配置
- `npm install --omit=dev` — 只安装生产依赖
- `pm2 start server/index.cjs` — 启动后端，自动守护进程
- `pm2 save && pm2 startup` — 开机自启

### Step 5: Nginx 配置
- 监听端口: `8688`
- 前端路径: `/web/` → `alias /var/www/jijin/dist/`
- API 反向代理: `/api/` → `http://127.0.0.1:3003`
- 根路径: `/` 301 重定向到 `/web/`
- SPA 路由兜底: `try_files $uri $uri/ /web/index.html`
- Gzip 压缩: JS/CSS/JSON 等
- 静态资源缓存: `/web/assets/` 缓存 30 天
- 自动开放防火墙端口 8688

## Nginx 完整配置

```nginx
server {
    listen 8688;
    server_name 47.116.77.67;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

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

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
```

## 运维命令

### 后端管理 (PM2)
```bash
# SSH 到服务器后执行
pm2 status                # 查看所有进程状态
pm2 logs fund-server      # 查看后端实时日志
pm2 logs fund-server --lines 100  # 查看最近 100 行日志
pm2 restart fund-server   # 重启后端
pm2 stop fund-server      # 停止后端
pm2 delete fund-server    # 删除进程
pm2 monit                 # 实时监控面板
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

### 增量更新（只更新前端）
```bash
# 本地构建后上传
npm run build
rsync -avz --delete dist/ root@47.116.77.67:/var/www/jijin/dist/
```

### 增量更新（只更新后端）
```bash
# 上传后端代码并重启
rsync -avz server/ root@47.116.77.67:/var/www/jijin/server/
ssh root@47.116.77.67 "cd /var/www/jijin && pm2 restart fund-server"
```

## 阿里云安全组配置

部署前需在阿里云控制台放行 8688 端口：

1. 登录阿里云控制台 → ECS → 安全组
2. 添加入站规则：
   - 协议: TCP
   - 端口: 8688
   - 来源: 0.0.0.0/0

## 故障排查

| 问题                 | 排查命令                                            |
| -------------------- | --------------------------------------------------- |
| 网站打不开           | `curl -I http://47.116.77.67:8688/web/`             |
| API 返回 502         | `pm2 logs fund-server` 检查后端是否运行             |
| Nginx 配置错误       | `nginx -t` 查看语法错误                             |
| 端口被占用           | `lsof -i :8688` 或 `lsof -i :3003`                 |
| 磁盘空间不足         | `df -h` 查看磁盘使用                                |
| Node.js 内存溢出     | `pm2 restart fund-server` 重启即可                  |
| 阿里云安全组未放行   | 控制台检查 8688 端口入站规则                         |

## 回滚方案

```bash
# 如果新版本有问题，回滚到上一个版本
ssh root@47.116.77.67
cd /var/www/jijin

# 查看 git 历史
git log --oneline -5
git checkout <上一个稳定 commit>
npm install --omit=dev
pm2 restart fund-server
```

## 监控

```bash
# 查看服务器资源
htop                    # CPU / 内存
df -h                   # 磁盘
pm2 monit               # Node.js 进程监控

# 查看访问统计
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head 20
```
