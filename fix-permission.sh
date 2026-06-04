#!/bin/bash
# ============================================================
# 修复网站403 Forbidden错误
# 运行: bash /var/www/fix-permission.sh
# ============================================================

set -e

DEPLOY_DIR="/var/www/jijin"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "=========================================="
echo "  修复403 Forbidden错误"
echo "=========================================="
echo ""

# ---- 检查目录是否存在 ----
if [ ! -d "$DEPLOY_DIR" ]; then
    error "目录不存在: $DEPLOY_DIR"
    exit 1
fi

# ---- 检查dist目录 ----
if [ ! -d "$DEPLOY_DIR/dist" ]; then
    error "dist目录不存在！"
    echo ""
    echo "请先在本地构建前端，然后上传："
    echo "  1. 本地运行: npm run build"
    echo "  2. 上传dist目录: scp -r dist/* root@47.116.77.67:/var/www/jijin/dist/"
    echo ""
    exit 1
fi

# ---- 修复权限 ----
info "修复文件权限..."

# 设置目录权限
chmod -R 755 "$DEPLOY_DIR/dist"
find "$DEPLOY_DIR/dist" -type f -exec chmod 644 {} \;

# 确保Nginx用户可以访问
chown -R www-data:www-data "$DEPLOY_DIR/dist" 2>/dev/null || \
chown -R nginx:nginx "$DEPLOY_DIR/dist" 2>/dev/null || \
chown -R nobody:nogroup "$DEPLOY_DIR/dist" 2>/dev/null || true

# 修复整个项目目录权限
chmod 755 "$DEPLOY_DIR"
chmod -R 755 "$DEPLOY_DIR/server" 2>/dev/null || true
chmod 600 "$DEPLOY_DIR/.env" 2>/dev/null || true

info "权限修复完成"

# ---- 重启Nginx ----
info "重启Nginx..."
nginx -t && systemctl restart nginx 2>/dev/null || \
nginx -t && service nginx restart 2>/dev/null || {
    error "Nginx重启失败"
    echo "请手动运行: nginx -t && systemctl restart nginx"
    exit 1
}
info "Nginx已重启"

# ---- 验证 ----
info "验证网站..."

# 测试静态文件
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8688/web/" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    info "网站正常！HTTP状态码: $HTTP_CODE"
else
    echo ""
    echo "HTTP状态码: $HTTP_CODE"
    echo ""
    echo "如果仍有问题，请检查："
    echo "  1. Nginx配置: nginx -t"
    echo "  2. Nginx日志: tail -f /var/log/nginx/error.log"
    echo "  3. dist目录: ls -la $DEPLOY_DIR/dist/"
    echo ""
fi

echo ""
echo "=========================================="
echo "  修复完成"
echo "=========================================="
echo ""
echo "  访问: http://47.116.77.67:8688/web/"
echo ""
