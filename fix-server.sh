#!/bin/bash
# ============================================================
# 服务器完整修复脚本
# 运行: bash /var/www/fix-server.sh
# ============================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

DEPLOY_DIR="/var/www/jijin"

echo ""
echo "=========================================="
echo "  服务器完整修复"
echo "=========================================="
echo ""

# ---- 1. 检查目录 ----
if [ ! -d "$DEPLOY_DIR" ]; then
    error "目录不存在: $DEPLOY_DIR"
    exit 1
fi
cd "$DEPLOY_DIR"
info "进入目录: $DEPLOY_DIR"

# ---- 2. 修复.env文件 ----
echo ""
info "检查 .env 文件..."
if [ ! -f ".env" ] || [ ! -s ".env" ]; then
    warn ".env 文件不存在或为空，正在创建..."
    cat > .env << 'EOF'
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_STRING_AT_LEAST_32_CHARS
ALLOWED_ORIGINS=http://47.116.77.67:8688,http://localhost:5173,http://localhost:5174
ENABLE_MOCK_AUTH=false
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://47.116.77.67:8688/api/auth/alipay/callback
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=your_database
PG_USER=your_db_user
PG_PASSWORD=your_db_password
EOF
    chmod 600 .env
    info ".env 文件已创建"
else
    info ".env 文件存在"
    echo "  数据库配置:"
    grep "PG_" .env | head -5
fi

# ---- 3. 检查数据库连接 ----
echo ""
info "检查数据库连接..."
if command -v psql &> /dev/null; then
    PGPASSWORD="your_db_password" psql -h localhost -U your_db_user -d your_database -c "SELECT 1;" 2>/dev/null && \
        info "数据库连接成功" || \
        warn "数据库连接失败，请检查PostgreSQL是否运行"
else
    warn "psql未安装，跳过数据库检查"
fi

# ---- 4. 安装依赖 ----
echo ""
info "安装Node.js依赖..."
npm install --omit=dev --ignore-scripts 2>&1 | tail -3
info "依赖安装完成"

# ---- 5. 检查端口占用 ----
echo ""
info "检查端口3003..."
PID=$(lsof -ti:3003 2>/dev/null)
if [ ! -z "$PID" ]; then
    warn "端口3003被占用 (PID: $PID)，正在释放..."
    kill -9 $PID 2>/dev/null
    sleep 1
fi

# ---- 6. 重启PM2服务 ----
echo ""
info "重启后端服务..."
pm2 delete fund-server 2>/dev/null || true
pm2 start server/index.cjs --name fund-server --cwd "$DEPLOY_DIR"
pm2 save
info "PM2服务已启动"

# ---- 7. 等待服务启动 ----
echo ""
info "等待服务启动..."
sleep 3

# ---- 8. 测试后端 ----
echo ""
info "测试后端API..."
RESPONSE=$(curl -s http://localhost:3003/api/funds 2>/dev/null | head -c 100)
if echo "$RESPONSE" | grep -q "data"; then
    info "后端API正常!"
else
    warn "后端API返回异常:"
    echo "  $RESPONSE"
    echo ""
    echo "查看详细日志:"
    echo "  pm2 logs fund-server --lines 30"
fi

# ---- 9. 重启Nginx ----
echo ""
info "重启Nginx..."
nginx -t 2>/dev/null && systemctl restart nginx 2>/dev/null && \
    info "Nginx已重启" || \
    warn "Nginx重启失败"

# ---- 10. 完成 ----
echo ""
echo "=========================================="
info "修复完成!"
echo "=========================================="
echo ""
echo "  验证命令:"
echo "    pm2 status"
echo "    pm2 logs fund-server --lines 30"
echo "    curl http://localhost:3003/api/funds"
echo ""
echo "  访问网站:"
echo "    http://47.116.77.67:8688/web/"
echo ""
