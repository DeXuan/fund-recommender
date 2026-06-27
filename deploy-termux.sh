#!/bin/bash
# ============================================================
# Termux 部署脚本 - 基金推荐助手
# 在 Android Termux 上运行此脚本
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

DEPLOY_DIR="$HOME/fund-recommender"

# ---- 步骤 1: 检查目录 ----
info "Step 1/6: 检查部署目录..."
if [ ! -d "$DEPLOY_DIR" ]; then
    error "目录不存在: $DEPLOY_DIR"
fi
cd "$DEPLOY_DIR"
info "✓ 目录存在"

# ---- 步骤 2: 安装依赖 ----
info "Step 2/6: 安装 npm 依赖..."
if [ ! -d "node_modules" ]; then
    npm install --production 2>&1 | tail -5
fi
info "✓ 依赖已安装"

# ---- 步骤 3: 创建 .env ----
info "Step 3/6: 配置环境变量..."
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
JWT_SECRET=fund-recommender-termux-$(date +%s)
ALLOWED_ORIGINS=*
PORT=3003
EOF
    info "✓ .env 已创建"
else
    info "✓ .env 已存在"
fi

# ---- 步骤 4: 创建符号链接 ----
info "Step 4/6: 配置静态文件路径..."
cd dist
if [ ! -L "web" ]; then
    ln -s . web
    info "✓ 创建 web 符号链接"
else
    info "✓ web 符号链接已存在"
fi
cd ..

# ---- 步骤 5: 配置 Nginx ----
info "Step 5/6: 配置 Nginx..."
cat > nginx.conf << 'NGINX_EOF'
worker_processes 1;

events {
    worker_connections 1024;
}

http {
    include /data/data/com.termux/files/usr/etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    server {
        listen 8080;
        server_name _;

        # 前端静态文件
        location / {
            root /data/data/com.termux/files/home/fund-recommender/dist;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        # API 代理
        location /api/ {
            proxy_pass http://127.0.0.1:3003;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
NGINX_EOF

cp nginx.conf /data/data/com.termux/files/usr/etc/nginx/nginx.conf
nginx -t 2>&1 || error "Nginx 配置测试失败"
info "✓ Nginx 配置完成"

# ---- 步骤 6: 启动服务 ----
info "Step 6/6: 启动服务..."

# 停止旧进程
nginx -s stop 2>/dev/null || true
pkill -f "node server/start-termux.cjs" 2>/dev/null || true
sleep 1

# 启动 Nginx
nginx
info "✓ Nginx 已启动 (端口 8080)"

# 启动 Node.js
nohup node server/start-termux.cjs > server.log 2>&1 &
NODE_PID=$!
sleep 2

if kill -0 $NODE_PID 2>/dev/null; then
    info "✓ Node.js 已启动 (PID: $NODE_PID)"
else
    error "Node.js 启动失败，请查看 server.log"
fi

# ---- 完成 ----
echo ""
echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "本地访问: http://localhost:8080"
echo "局域网访问: http://$(hostname -I 2>/dev/null | awk '{print $1}'):8080"
echo ""
echo "查看日志: tail -f $DEPLOY_DIR/server.log"
echo "停止服务: nginx -s stop; pkill -f start-termux.cjs"
echo ""
