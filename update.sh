#!/bin/bash
# ============================================================
# 基金推荐网站 - 一键更新脚本
#
# 访问地址: http://47.116.77.67:8688/web
#
# 使用方法：
#   1. 本地打包项目为 fund-recommender.zip
#   2. 上传到服务器 /var/www/ 目录
#   3. SSH登录服务器运行: bash /var/www/update.sh
# ============================================================

set -e

# ============ 配置区 ============
DEPLOY_DIR="/var/www/jijin"
BACKUP_DIR="/var/www/backups"
ZIP_PATH="/var/www/fund-recommender.zip"
PM2_NAME="fund-server"
SERVER_IP="47.116.77.67"
NGINX_PORT=8688
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
echo "  基金推荐网站 - 一键更新"
echo "  目标目录: ${DEPLOY_DIR}"
echo "  访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}"
echo "=========================================="

# ---- 检查更新包 ----
step "1/7 检查更新包"
if [ ! -f "$ZIP_PATH" ]; then
    error "找不到更新包: $ZIP_PATH\n    请先将 fund-recommender.zip 上传到 /var/www/ 目录"
fi
info "找到更新包: $ZIP_PATH"

# ---- 备份当前版本 ----
step "2/7 备份当前版本"
mkdir -p "$BACKUP_DIR"
BACKUP_NAME="jijin_$(date +%Y%m%d_%H%M%S)"

if [ -d "$DEPLOY_DIR" ]; then
    # 保存.env文件
    if [ -f "$DEPLOY_DIR/.env" ]; then
        cp "$DEPLOY_DIR/.env" "/tmp/jijin_env_backup"
        info "已备份 .env 配置文件"
    fi

    # 保存密钥文件
    if [ -d "$DEPLOY_DIR/keys" ]; then
        cp -r "$DEPLOY_DIR/keys" "/tmp/jijin_keys_backup"
        info "已备份 keys/ 密钥目录"
    fi

    # 备份整个目录
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" \
        -C /var/www \
        --exclude='jijin/node_modules' \
        --exclude='jijin/dist' \
        jijin/ 2>/dev/null || true

    info "备份完成: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
else
    warn "目录不存在，将创建新目录"
    mkdir -p "$DEPLOY_DIR"
fi

# ---- 解压新版本 ----
step "3/7 解压新版本"
cd /tmp
rm -rf fund-recommender-update 2>/dev/null
mkdir -p fund-recommender-update
cd fund-recommender-update

unzip -q "$ZIP_PATH"

# 找到解压后的目录
EXTRACTED_DIR=$(find . -maxdepth 1 -type d -name "fund-recommender*" | head -1)
if [ -z "$EXTRACTED_DIR" ]; then
    EXTRACTED_DIR="."
fi

# 更新文件到部署目录
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*' \
    --exclude='dist' \
    --exclude='keys' \
    --exclude='.git' \
    --exclude='*.log' \
    "${EXTRACTED_DIR}/" "$DEPLOY_DIR/"

# 恢复.env文件
if [ -f "/tmp/jijin_env_backup" ]; then
    cp "/tmp/jijin_env_backup" "$DEPLOY_DIR/.env"
    info "已恢复 .env 配置文件"
fi

# 恢复密钥文件
if [ -d "/tmp/jijin_keys_backup" ]; then
    cp -r "/tmp/jijin_keys_backup" "$DEPLOY_DIR/keys"
    info "已恢复 keys/ 密钥目录"
fi

# 清理临时文件
cd /
rm -rf /tmp/fund-recommender-update
rm -f /tmp/jijin_env_backup
rm -rf /tmp/jijin_keys_backup

info "文件更新完成"

# ---- 安装依赖 ----
step "4/7 安装后端依赖"
cd "$DEPLOY_DIR"
npm install --omit=dev --ignore-scripts 2>&1 | tail -3
info "依赖安装完成"

# ---- 构建前端 ----
step "5/7 构建前端"
if [ -f "node_modules/.bin/vite" ]; then
    npm run build 2>&1 | tail -10
    if [ -d "$DEPLOY_DIR/dist" ]; then
        info "前端构建完成"
    else
        warn "前端构建失败，请在本地构建后上传dist目录"
    fi
else
    warn "缺少前端构建工具，请在本地运行 npm run build 后上传 dist/ 目录"
fi

# ---- 重启后端服务 ----
step "6/7 重启后端服务"

# 确保PM2已安装
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 检查.env文件
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    warn ".env 文件不存在！"
    echo "请创建配置文件，参考之前的备份或运行 deploy-full.sh"
fi

# 重启PM2服务
cd "$DEPLOY_DIR"
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start server/index.cjs --name "$PM2_NAME" --cwd "$DEPLOY_DIR"
pm2 save
info "后端服务已重启"

# ---- 重启Nginx ----
step "7/7 重启Nginx"
if command -v nginx &> /dev/null; then
    if nginx -t 2>/dev/null; then
        systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null
        info "Nginx已重启"
    else
        warn "Nginx配置测试失败"
    fi
else
    warn "Nginx未安装"
fi

# ---- 验证部署 ----
echo ""
info "验证部署..."
sleep 2

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api/funds 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    info "后端API正常"
else
    warn "后端API返回状态码: $BACKEND_STATUS"
fi

# ---- 完成 ----
echo ""
echo "=========================================="
info "更新完成! 🎉"
echo "=========================================="
echo ""
echo "  访问地址: http://${SERVER_IP}:${NGINX_PORT}${WEB_PATH}"
echo ""
echo "  验证命令:"
echo "    pm2 status"
echo "    pm2 logs $PM2_NAME --lines 20"
echo ""
echo "  如需回滚:"
echo "    cd /var/www && tar -xzf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "    pm2 restart $PM2_NAME"
echo ""
