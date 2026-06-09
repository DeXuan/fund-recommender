#!/bin/bash
# ============================================================
# 基金推荐网站 - 全新一键部署脚本
#
# 访问地址: http://47.116.77.67:8688/web
#
# 使用方法：
#   1. 将 fund-recommender.zip 上传到服务器 /tmp/ 目录
#   2. SSH登录服务器
#   3. 运行: bash /tmp/deploy-full.sh
# ============================================================

set -e

# ============ 配置区 ============
DEPLOY_DIR="/var/www/jijin"
ZIP_PATH="/tmp/fund-recommender.zip"
PM2_NAME="fund-server"
SERVER_IP="47.116.77.67"
NGINX_PORT=8688
BACKEND_PORT=3003
WEB_PATH="/web"
# ================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

echo ""
echo "=========================================="
echo "  基金推荐网站 - 全新部署"
echo "  目标目录: ${DEPLOY_DIR}"
echo "  访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}"
echo "=========================================="

# ---- 检查更新包 ----
step "1/8 检查更新包"
if [ ! -f "$ZIP_PATH" ]; then
    error "找不到 $ZIP_PATH\n请先将 fund-recommender.zip 上传到 /tmp/ 目录"
fi
info "找到更新包: $ZIP_PATH"

# ---- 创建目录 ----
step "2/8 创建部署目录"
mkdir -p "$DEPLOY_DIR"
info "目录已创建: $DEPLOY_DIR"

# ---- 解压文件 ----
step "3/8 解压项目文件"
cd /tmp
rm -rf fund-recommender-deploy 2>/dev/null
mkdir -p fund-recommender-deploy
cd fund-recommender-deploy

unzip -q "$ZIP_PATH"

# 找到解压后的目录
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "fund-recommender*" | head -1)
if [ -z "$EXTRACTED_DIR" ]; then
    EXTRACTED_DIR="."
fi

# 复制文件到部署目录
rsync -av --exclude='node_modules' --exclude='.git' "${EXTRACTED_DIR}/" "$DEPLOY_DIR/"
info "文件解压完成"

# ---- 创建.env文件 ----
step "4/8 配置环境变量"
cd "$DEPLOY_DIR"

# 自动生成安全的 JWT_SECRET
AUTO_JWT_SECRET=$(openssl rand -hex 48 2>/dev/null || head -c 96 /dev/urandom | base64 | tr -d '\n/' | head -c 64)

cat > .env << EOF
# 服务器配置（已自动生成，请勿泄露）
JWT_SECRET=${AUTO_JWT_SECRET}

# CORS 允许的前端域名（逗号分隔）
ALLOWED_ORIGINS=http://${SERVER_IP}:${NGINX_PORT},http://localhost:5173,http://localhost:5174

# Mock 登录（生产环境必须为 false）
ENABLE_MOCK_AUTH=false

# 支付宝配置
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://${SERVER_IP}:${NGINX_PORT}/api/auth/alipay/callback

# 数据库配置（数据库和服务器在同一台机器，使用localhost）
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=your_database
PG_USER=your_db_user
PG_PASSWORD=your_db_password
EOF

chmod 600 .env
info ".env 文件已创建"

# ---- 安装Node.js（如果未安装）----
step "5/8 检查Node.js环境"
if ! command -v node &> /dev/null; then
    warn "Node.js未安装，正在安装..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y nodejs 2>/dev/null
fi
info "Node.js版本: $(node -v)"
info "npm版本: $(npm -v)"

# ---- 安装依赖 ----
step "6/8 安装项目依赖"
cd "$DEPLOY_DIR"
npm install --omit=dev --ignore-scripts 2>&1 | tail -5
info "依赖安装完成"

# ---- 构建前端 ----
step "7/8 构建前端"
if [ -f "node_modules/.bin/vite" ]; then
    npm run build 2>&1 | tail -10
    if [ -d "$DEPLOY_DIR/dist" ]; then
        info "前端构建完成"
    else
        warn "前端构建失败，请在本地构建后上传dist目录"
    fi
else
    warn "缺少前端构建工具"
    echo ""
    echo "请在本地构建前端:"
    echo "  1. cd c:\\Users\\gdx\\fund-recommender"
    echo "  2. npm run build"
    echo "  3. scp -r dist/* root@${SERVER_IP}:${DEPLOY_DIR}/dist/"
    echo ""
fi

# ---- 启动服务 ----
step "8/8 启动后端服务"

# 安装PM2（如果未安装）
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 启动后端
cd "$DEPLOY_DIR"
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start server/index.cjs --name "$PM2_NAME" --cwd "$DEPLOY_DIR"
pm2 save
pm2 startup 2>/dev/null || true
info "PM2服务已启动"

# ---- 配置Nginx ----
echo ""
info "配置Nginx..."

if command -v nginx &> /dev/null; then
    # 创建Nginx配置
    cat > /etc/nginx/sites-available/jijin << EOF
server {
    listen ${NGINX_PORT};
    server_name ${SERVER_IP};

    # 安全响应头
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # gzip压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1024;

    # API反向代理
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

    # ${WEB_PATH} 重定向到 ${WEB_PATH}/
    location = ${WEB_PATH} {
        return 301 ${WEB_PATH}/;
    }

    # 前端SPA
    location ${WEB_PATH}/ {
        alias ${DEPLOY_DIR}/dist/;
        index index.html;
        try_files \$uri \$uri/ ${WEB_PATH}/index.html;
    }

    # 静态资源缓存
    location ${WEB_PATH}/assets/ {
        alias ${DEPLOY_DIR}/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 根路径重定向到 ${WEB_PATH}/
    location = / {
        return 301 ${WEB_PATH}/;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
EOF

    # 启用配置
    ln -sf /etc/nginx/sites-available/jijin /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # 开放防火墙
    if command -v ufw &> /dev/null; then
        ufw allow ${NGINX_PORT}/tcp 2>/dev/null || true
    fi

    # 测试并重启Nginx
    if nginx -t 2>/dev/null; then
        systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null
        info "Nginx已配置并重启"
    else
        warn "Nginx配置测试失败"
    fi
else
    warn "Nginx未安装，正在安装..."
    apt-get update -qq && apt-get install -y -qq nginx
    bash "$0"
    exit 0
fi

# ---- 清理临时文件 ----
cd /
rm -rf /tmp/fund-recommender-deploy

# ---- 验证部署 ----
echo ""
info "验证部署..."
sleep 2

# 测试后端
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${BACKEND_PORT}/api/funds 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    info "后端API正常"
else
    warn "后端API返回状态码: $BACKEND_STATUS"
fi

# 测试Nginx
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${NGINX_PORT}${WEB_PATH}/ 2>/dev/null || echo "000")
if [ "$NGINX_STATUS" = "200" ]; then
    info "Nginx代理正常"
else
    warn "Nginx返回状态码: $NGINX_STATUS"
fi

# ---- 完成 ----
echo ""
echo "=========================================="
info "部署完成! 🎉"
echo "=========================================="
echo ""
echo "  访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}"
echo ""
echo "  验证命令:"
echo "    pm2 status                        # 查看后端状态"
echo "    pm2 logs $PM2_NAME --lines 20    # 查看日志"
echo "    curl http://localhost:${BACKEND_PORT}/api/funds  # 测试API"
echo ""
echo "  常用命令:"
echo "    pm2 restart $PM2_NAME            # 重启后端"
echo "    pm2 logs $PM2_NAME               # 查看实时日志"
echo "    systemctl restart nginx          # 重启Nginx"
echo ""
