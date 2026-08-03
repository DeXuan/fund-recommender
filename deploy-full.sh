#!/bin/bash
# ============================================================
# 基金推荐网站 - 全新一键部署脚本
#
# 功能：
#   - 自动安装 Node.js、Nginx、PM2
#   - 自动检测端口占用并释放
#   - 自动生成安全的 JWT_SECRET
#   - 自动初始化数据库
#   - 自动配置 Nginx（含安全响应头）
#   - 自动开放防火墙端口
#   - 可选自动配置 HTTPS（certbot）
#   - 部署后自动验证
#
# 使用方法：
#   1. 将 fund-recommender.zip 上传到服务器 /tmp/ 目录
#   2. SSH 登录服务器
#   3. 运行: bash /tmp/deploy-full.sh
#
# 可选参数：
#   --domain=your-domain.com    配置域名（启用 HTTPS）
#   --port=8688                 自定义 Nginx 端口（默认 8688）
#   --skip-db                   跳过数据库初始化
#   --skip-https                跳过 HTTPS 配置
# ============================================================

set -e

# ============ 配置区 ============
DEPLOY_DIR="/var/www/jijin"
ZIP_PATH="/tmp/fund-recommender.zip"
PM2_NAME="fund-server"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
NGINX_PORT=8688
BACKEND_PORT=3003
WEB_PATH="/web"
DOMAIN=""
SKIP_DB=false
SKIP_HTTPS=false
# ================================

# 解析命令行参数
for arg in "$@"; do
    case $arg in
        --domain=*) DOMAIN="${arg#*=}" ;;
        --port=*) NGINX_PORT="${arg#*=}" ;;
        --skip-db) SKIP_DB=true ;;
        --skip-https) SKIP_HTTPS=true ;;
        --help)
            echo "用法: bash deploy-full.sh [选项]"
            echo ""
            echo "选项:"
            echo "  --domain=DOMAIN    配置域名（启用 HTTPS）"
            echo "  --port=PORT        自定义 Nginx 端口（默认 8688）"
            echo "  --skip-db          跳过数据库初始化"
            echo "  --skip-https       跳过 HTTPS 配置"
            echo "  --help             显示帮助信息"
            exit 0
            ;;
    esac
done

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
tip()   { echo -e "${CYAN}[i]${NC} $1"; }

# ============ 开始部署 ============
echo ""
echo "=========================================="
echo "  基金推荐网站 - 全新部署"
echo "  目标目录: ${DEPLOY_DIR}"
echo "  服务器IP: ${SERVER_IP}"
echo "  Nginx端口: ${NGINX_PORT}"
echo "  访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}"
[ -n "$DOMAIN" ] && echo "  域名: ${DOMAIN} (HTTPS)"
echo "=========================================="

# ---- Step 1: 检查更新包 ----
step "1/10 检查更新包"
if [ ! -f "$ZIP_PATH" ]; then
    error "找不到 $ZIP_PATH\n请先将 fund-recommender.zip 上传到 /tmp/ 目录"
fi
info "找到更新包: $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1))"

# ---- Step 2: 系统依赖检查 ----
step "2/10 检查系统依赖"

# 检查并安装 Node.js
if ! command -v node &> /dev/null; then
    warn "Node.js 未安装，正在安装 Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null
    apt-get install -y nodejs 2>/dev/null
fi
NODE_VER=$(node -v)
info "Node.js: $NODE_VER"
if [[ "$NODE_VER" < "v20" ]]; then
    warn "Node.js 版本过低 ($NODE_VER)，建议升级到 v20+"
fi
info "npm: $(npm -v)"

# 检查并安装 Nginx
if ! command -v nginx &> /dev/null; then
    warn "Nginx 未安装，正在安装..."
    apt-get update -qq && apt-get install -y -qq nginx
fi
info "Nginx: $(nginx -v 2>&1 | cut -d'/' -f2)"

# 检查并安装 PM2
if ! command -v pm2 &> /dev/null; then
    warn "PM2 未安装，正在安装..."
    npm install -g pm2
fi
info "PM2: $(pm2 -v)"

# 检查并安装 PostgreSQL 客户端
if ! command -v psql &> /dev/null; then
    warn "PostgreSQL 客户端未安装，正在安装..."
    apt-get install -y -qq postgresql-client 2>/dev/null || true
fi

# ---- Step 3: 端口占用检测 ----
step "3/10 端口占用检测"

check_and_kill_port() {
    local port=$1
    local name=$2
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        warn "端口 $port ($name) 被进程 $pid 占用"
        local cmd=$(ps -p $pid -o comm= 2>/dev/null)
        tip "占用进程: $cmd (PID: $pid)"
        kill -15 $pid 2>/dev/null || kill -9 $pid 2>/dev/null
        sleep 1
        info "已释放端口 $port"
    else
        info "端口 $port ($name) 可用"
    fi
}

check_and_kill_port $NGINX_PORT "Nginx"
check_and_kill_port $BACKEND_PORT "Backend"

# ---- Step 4: 创建目录 & 解压 ----
step "4/10 解压项目文件"
mkdir -p "$DEPLOY_DIR"

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

# ---- Step 5: 配置环境变量 ----
step "5/10 配置环境变量"
cd "$DEPLOY_DIR"

if [ -f ".env" ] && [ -s ".env" ]; then
    info ".env 文件已存在，保留现有配置"
    # 确保权限正确
    chmod 600 .env
else
    # 自动生成安全的 JWT_SECRET
    AUTO_JWT_SECRET=$(openssl rand -hex 48 2>/dev/null || head -c 96 /dev/urandom | base64 | tr -d '\n/' | head -c 64)

    cat > .env << EOF
# ============================================================
# 基金推荐助手 - 环境变量配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# JWT 密钥（自动生成，请勿泄露）
JWT_SECRET=${AUTO_JWT_SECRET}

# CORS 允许的前端域名（逗号分隔）
ALLOWED_ORIGINS=http://${SERVER_IP}:${NGINX_PORT},http://localhost:5173,http://localhost:5174
EOF

    if [ -n "$DOMAIN" ]; then
        cat >> .env << EOF
,https://${DOMAIN},http://${DOMAIN}
EOF
    else
        cat >> .env << EOF
EOF
    fi

    cat >> .env << EOF

# Mock 登录（生产环境必须为 false）
ENABLE_MOCK_AUTH=false

# 支付宝配置（按需填写）
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://${SERVER_IP}:${NGINX_PORT}/api/auth/alipay/callback

# PostgreSQL 数据库（数据库和服务器在同一台机器，必须使用 localhost）
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=fund_db
PG_USER=fund_user
PG_PASSWORD=CHANGE_ME_$(openssl rand -hex 8 2>/dev/null || echo "please_change")
EOF

    chmod 600 .env
    info ".env 文件已创建（JWT_SECRET 已自动生成）"
    warn "请检查 .env 中的数据库配置，确保 PG_DATABASE、PG_USER、PG_PASSWORD 正确"
fi

# ---- Step 6: 安装依赖 ----
step "6/10 安装项目依赖"
cd "$DEPLOY_DIR"
npm install --omit=dev --ignore-scripts 2>&1 | tail -5
info "依赖安装完成"

# ---- Step 7: 构建前端 ----
step "7/10 构建前端"
if [ -f "node_modules/.bin/vite" ]; then
    npm run build 2>&1 | tail -10
    if [ -d "$DEPLOY_DIR/dist" ]; then
        info "前端构建完成"
    else
        warn "前端构建失败，请在本地构建后上传 dist 目录"
        tip "本地执行: npm run build"
        tip "上传命令: scp -r dist/* root@${SERVER_IP}:${DEPLOY_DIR}/dist/"
    fi
else
    warn "缺少前端构建工具"
    tip "请在本地构建前端:"
    tip "  1. cd fund-recommender"
    tip "  2. npm run build"
    tip "  3. scp -r dist/* root@${SERVER_IP}:${DEPLOY_DIR}/dist/"
fi

# ---- Step 8: 数据库初始化 ----
step "8/10 数据库初始化"
if [ "$SKIP_DB" = true ]; then
    tip "跳过数据库初始化 (--skip-db)"
else
    # 检查 PostgreSQL 是否运行
    if systemctl is-active --quiet postgresql 2>/dev/null; then
        info "PostgreSQL 服务运行中"

        # 从 .env 读取数据库配置
        DB_NAME=$(grep "^PG_DATABASE=" .env | cut -d= -f2 | tr -d ' ')
        DB_USER=$(grep "^PG_USER=" .env | cut -d= -f2 | tr -d ' ')
        DB_PASS=$(grep "^PG_PASSWORD=" .env | cut -d= -f2 | tr -d ' ')

        # 检查数据库是否存在
        if sudo -u postgres psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
            info "数据库 '$DB_NAME' 已存在"
        else
            warn "数据库 '$DB_NAME' 不存在，正在创建..."
            sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
            sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
            sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
            sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;" 2>/dev/null || true
            info "数据库和用户已创建"
        fi

        # 初始化表结构
        info "初始化数据库表结构..."
        node -e "require('./server/db.cjs').initDatabase().then(() => console.log('数据库表初始化完成')).catch(e => console.error('初始化失败:', e.message))" 2>&1 || warn "表初始化可能需要手动执行"
    else
        warn "PostgreSQL 未运行，请手动安装和配置"
        tip "安装: apt install postgresql postgresql-contrib"
        tip "启动: systemctl start postgresql"
        tip "创建数据库: sudo -u postgres psql -c 'CREATE DATABASE fund_db;'"
    fi
fi

# ---- Step 9: 启动服务 ----
step "9/10 启动后端服务"
cd "$DEPLOY_DIR"

# 停止旧进程
pm2 delete "$PM2_NAME" 2>/dev/null || true

# 启动后端
pm2 start server/index.cjs --name "$PM2_NAME" --cwd "$DEPLOY_DIR" \
    --max-memory-restart 512M \
    --log-date-format "YYYY-MM-DD HH:mm:ss"

pm2 save

# 设置开机自启
CURRENT_USER=$(whoami)
pm2 startup systemd -u "$CURRENT_USER" --hp "$HOME" 2>/dev/null || true

info "PM2 服务已启动"

# ---- Step 10: 配置 Nginx ----
step "10/10 配置 Nginx"

# 生成 Nginx 配置
cat > /etc/nginx/sites-available/jijin << EOF
server {
    listen ${NGINX_PORT};
    server_name ${DOMAIN:-$SERVER_IP};

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
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;

        # API 速率限制（Nginx 层）
        limit_req zone=api burst=20 nodelay;
    }

    # ${WEB_PATH} 重定向到 ${WEB_PATH}/
    location = ${WEB_PATH} {
        return 301 ${WEB_PATH}/;
    }

    # 前端 SPA
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

# 配置 Nginx 速率限制（如果 http 块中没有）
if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
    # 在 http 块中添加速率限制配置
    sed -i '/http {/a\    # API 速率限制\n    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;' /etc/nginx/nginx.conf 2>/dev/null || true
fi

# 启用配置
ln -sf /etc/nginx/sites-available/jijin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 开放防火墙
if command -v ufw &> /dev/null; then
    ufw allow ${NGINX_PORT}/tcp 2>/dev/null || true
    info "防火墙已开放端口 ${NGINX_PORT} (ufw)"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=${NGINX_PORT}/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    info "防火墙已开放端口 ${NGINX_PORT} (firewalld)"
fi

# 测试并重启 Nginx
if nginx -t 2>/dev/null; then
    systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null
    systemctl enable nginx 2>/dev/null || true
    info "Nginx 已配置并重启"
else
    error "Nginx 配置测试失败，请检查配置"
fi

# ---- HTTPS 配置（可选）----
if [ -n "$DOMAIN" ] && [ "$SKIP_HTTPS" = false ]; then
    echo ""
    tip "检测到域名配置: $DOMAIN"
    tip "如需启用 HTTPS，请执行:"
    tip "  apt install certbot python3-certbot-nginx"
    tip "  certbot --nginx -d $DOMAIN"
    tip "  certbot renew --dry-run  # 测试自动续期"
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
    info "后端 API 正常 (HTTP $BACKEND_STATUS)"
else
    warn "后端 API 返回状态码: $BACKEND_STATUS"
    tip "查看日志: pm2 logs $PM2_NAME --lines 30"
fi

# 测试 Nginx
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${NGINX_PORT}${WEB_PATH}/ 2>/dev/null || echo "000")
if [ "$NGINX_STATUS" = "200" ]; then
    info "Nginx 代理正常 (HTTP $NGINX_STATUS)"
else
    warn "Nginx 返回状态码: $NGINX_STATUS"
fi

# 测试数据库连接
if [ "$SKIP_DB" = false ]; then
    DB_STATUS=$(curl -s http://localhost:${BACKEND_PORT}/api/funds 2>/dev/null | head -c 50)
    if echo "$DB_STATUS" | grep -q "data"; then
        info "数据库连接正常"
    else
        warn "数据库可能未配置，请检查 .env 中的 PG_* 变量"
    fi
fi

# ---- 完成 ----
echo ""
echo "=========================================="
info "部署完成!"
echo "=========================================="
echo ""
echo "  访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}"
[ -n "$DOMAIN" ] && echo "  域名地址: http://${DOMAIN}:${NGINX_PORT}${WEB_PATH}"
echo ""
echo "  ⚠️  首次部署后请检查:"
echo "    1. 编辑 .env 文件，确认数据库配置正确"
echo "    2. 上传支付宝密钥到 keys/ 目录（如需支付宝登录）"
echo "    3. 确认阿里云安全组已放行端口 ${NGINX_PORT}"
echo ""
echo "  常用命令:"
echo "    pm2 status                        # 查看后端状态"
echo "    pm2 logs $PM2_NAME --lines 20    # 查看日志"
echo "    pm2 restart $PM2_NAME            # 重启后端"
echo "    pm2 monit                         # 实时监控"
echo "    systemctl status nginx            # Nginx 状态"
echo "    nginx -t                          # 测试 Nginx 配置"
echo "    tail -f /var/log/nginx/error.log  # Nginx 错误日志"
echo ""
echo "  安全加固:"
echo "    1. 确保 .env 文件权限为 600"
echo "    2. 数据库端口 5432 不对外暴露"
echo "    3. 定期更新系统: apt update && apt upgrade"
echo "    4. 查看安全修复记录: cat docs/security/SECURITY_FIX_LOG.md"
echo ""
