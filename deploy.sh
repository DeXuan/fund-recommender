#!/bin/bash
# ============================================================
# 基金推荐网站一键部署脚本
# 访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}
#
# 配置方式（三选一）:
#   1. 直接修改下方默认值
#   2. 设置环境变量: export DEPLOY_SERVER_IP=x.x.x.x
#   3. 创建 .env.deploy 文件（已 gitignore）
# ============================================================

set -e

# 加载 .env.deploy（如果存在）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/.env.deploy" ]; then
    source "${SCRIPT_DIR}/.env.deploy"
fi

# ---- 配置区（可通过环境变量覆盖）----
SERVER_IP="${DEPLOY_SERVER_IP:-47.116.77.67}"
SERVER_USER="${DEPLOY_SERVER_USER:-root}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/jijin}"
BACKEND_PORT="${BACKEND_PORT:-3003}"
NGINX_PORT="${NGINX_PORT:-8688}"
WEB_PATH="${WEB_PATH:-/web}"

REMOTE_DIR="${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---- 步骤 1: 本地构建前端 ----
info "Step 1/5: 构建前端..."
npm run build
if [ ! -d "dist" ]; then
    error "构建失败，dist 目录不存在"
fi
info "前端构建完成 ✓"

# ---- 步骤 2: 创建远程目录 ----
info "Step 2/5: 准备远程目录..."
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${DEPLOY_DIR}/server"

# ---- 步骤 3: 上传文件 ----
info "Step 3/5: 上传文件到服务器..."

# 上传前端产物
info "  上传 dist/..."
rsync -avz --delete dist/ ${REMOTE_DIR}/dist/

# 上传后端代码
info "  上传 server/..."
rsync -avz server/index.cjs server/fund-data.cjs ${REMOTE_DIR}/server/

# 上传 package.json（后端依赖）
info "  上传 package.json..."
scp package.json ${REMOTE_DIR}/

info "文件上传完成 ✓"

# ---- 步骤 4: 远程安装依赖 & 配置服务 ----
info "Step 4/5: 远程服务器配置..."
ssh ${SERVER_USER}@${SERVER_IP} << 'REMOTE_SCRIPT'
set -e
DEPLOY_DIR="/var/www/jijin"
cd "$DEPLOY_DIR"

echo "[远程] 安装 Node.js 依赖..."
npm install --omit=dev --ignore-scripts 2>/dev/null || {
    echo "npm install 部分警告，继续执行..."
}

# 安装 PM2（如果未安装）
if ! command -v pm2 &> /dev/null; then
    echo "[远程] 安装 PM2..."
    npm install -g pm2
fi

# 安装 Nginx（如果未安装）
if ! command -v nginx &> /dev/null; then
    echo "[远程] 安装 Nginx..."
    apt-get update -qq && apt-get install -y -qq nginx
fi

# 启动/重启后端服务
echo "[远程] 配置 PM2 后端服务..."
cd "$DEPLOY_DIR"
pm2 delete fund-server 2>/dev/null || true
pm2 start server/index.cjs --name fund-server --cwd "$DEPLOY_DIR"
pm2 save

# 设置 PM2 开机自启
CURRENT_USER=$(whoami)
pm2 startup systemd -u "$CURRENT_USER" --hp "$HOME" 2>/dev/null || true

echo "[远程] 后端服务已启动 ✓"
REMOTE_SCRIPT

# ---- 步骤 5: 配置 Nginx ----
info "Step 5/5: 配置 Nginx (端口 ${NGINX_PORT}, 路径 ${WEB_PATH})..."
ssh ${SERVER_USER}@${SERVER_IP} << NGINX_SCRIPT
DEPLOY_DIR="/var/www/jijin"
BACKEND_PORT=${BACKEND_PORT}
NGINX_PORT=${NGINX_PORT}
WEB_PATH="${WEB_PATH}"
SERVER_IP="${SERVER_IP}"

# 生成 Nginx 配置
cat > /etc/nginx/sites-available/jijin << EOF
server {
    listen \${NGINX_PORT};
    server_name \${SERVER_IP};

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:\${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
    }

    # /web 重定向到 /web/
    location = \${WEB_PATH} {
        return 301 \${WEB_PATH}/;
    }

    # 前端 SPA
    location \${WEB_PATH}/ {
        alias \${DEPLOY_DIR}/dist/;
        index index.html;
        try_files \$uri \$uri/ \${WEB_PATH}/index.html;
    }

    # 静态资源缓存
    location \${WEB_PATH}/assets/ {
        alias \${DEPLOY_DIR}/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 根路径重定向到 /web/
    location = / {
        return 301 \${WEB_PATH}/;
    }

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/jijin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 开放防火墙端口
if command -v ufw &> /dev/null; then
    ufw allow \${NGINX_PORT}/tcp 2>/dev/null || true
fi
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=\${NGINX_PORT}/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi

# 测试并重启 Nginx
nginx -t && systemctl restart nginx
systemctl enable nginx

echo "[远程] Nginx 配置完成 ✓"
NGINX_SCRIPT

# ---- 完成 ----
echo ""
echo "============================================"
info "部署完成! 🎉"
echo "============================================"
echo ""
echo "  前端访问: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}/"
echo "  后端 API: http://${SERVER_IP}:${NGINX_PORT}/api/"
echo ""
echo "  常用命令 (SSH 到服务器后):"
echo "    pm2 status          # 查看后端状态"
echo "    pm2 logs fund-server # 查看后端日志"
echo "    pm2 restart fund-server # 重启后端"
echo "    nginx -t            # 测试 Nginx 配置"
echo "    systemctl status nginx # 查看 Nginx 状态"
echo ""
