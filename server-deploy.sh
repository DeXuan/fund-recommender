#!/bin/bash
# ============================================================
# 服务器端一键部署脚本
# 使用方式：上传项目到 /var/www/jijin 后执行
#   cd /var/www/jijin && bash server-deploy.sh
# ============================================================

set -e

DEPLOY_DIR="/var/www/jijin"
BACKEND_PORT=3003
NGINX_PORT=8688
WEB_PATH="/web"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

cd "$DEPLOY_DIR"

# 1. 安装全部依赖（含 devDependencies 用于构建）
info "Step 1/6: 安装依赖..."
npm install 2>/dev/null || npm install --legacy-peer-deps

# 2. 构建前端
info "Step 2/6: 构建前端..."
npm run build
if [ ! -d "dist" ]; then
    error "构建失败，dist 目录不存在"
fi
info "前端构建完成 ✓"

# 3. 安装 PM2
info "Step 3/6: 检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 4. 启动后端
info "Step 4/6: 启动后端服务..."
pm2 delete fund-server 2>/dev/null || true
pm2 start server/index.cjs --name fund-server --cwd "$DEPLOY_DIR"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 5. 安装 Nginx
info "Step 5/6: 检查 Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq nginx
fi

# 6. 配置 Nginx
info "Step 6/6: 配置 Nginx..."
cat > /etc/nginx/sites-available/jijin << EOF
server {
    listen ${NGINX_PORT};
    server_name _;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    location = ${WEB_PATH} {
        return 301 ${WEB_PATH}/;
    }

    location ${WEB_PATH}/ {
        alias ${DEPLOY_DIR}/dist/;
        index index.html;
        try_files \$uri \$uri/ ${WEB_PATH}/index.html;
    }

    location ${WEB_PATH}/assets/ {
        alias ${DEPLOY_DIR}/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location = / {
        return 301 ${WEB_PATH}/;
    }

    location ~ /\. {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/jijin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

ufw allow ${NGINX_PORT}/tcp 2>/dev/null || true

nginx -t && systemctl restart nginx
systemctl enable nginx

echo ""
echo "============================================"
info "部署完成!"
echo "============================================"
echo ""
echo "  访问地址: http://47.116.77.67:${NGINX_PORT}${WEB_PATH}"
echo ""
echo "  常用命令:"
echo "    pm2 status            # 后端状态"
echo "    pm2 logs fund-server  # 后端日志"
echo "    pm2 restart fund-server # 重启后端"
echo "    nginx -t              # 测试 Nginx 配置"
echo ""
