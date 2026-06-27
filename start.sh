#!/bin/bash
# 基金推荐助手 - 一键启动脚本

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  基金推荐助手 - 一键启动"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误]${NC} 未检测到 Node.js，请先安装: https://nodejs.org"
    exit 1
fi

# 检查 .env
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}[信息]${NC} 首次运行，复制配置文件..."
        cp .env.example .env
        echo -e "${YELLOW}[提示]${NC} 请编辑 .env 文件配置数据库连接，然后重新运行"
        exit 1
    else
        echo -e "${RED}[错误]${NC} 缺少 .env 配置文件"
        exit 1
    fi
fi

# 检查 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[信息]${NC} 首次运行，安装依赖..."
    npm install
fi

# 检查 dist，不存在则构建
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}[信息]${NC} 首次运行，构建前端..."
    npm run build
    echo -e "${GREEN}[信息]${NC} 前端构建完成"
    echo ""
fi

# 清理旧进程
OLD_PID=$(lsof -ti:3003 2>/dev/null)
if [ -n "$OLD_PID" ]; then
    echo -e "${YELLOW}[清理]${NC} 终止旧进程 PID: $OLD_PID"
    kill $OLD_PID 2>/dev/null
    sleep 1
fi

# 启动服务器（后台）
echo -e "${GREEN}[启动]${NC} 正在启动服务器..."
node server/index.cjs &
SERVER_PID=$!

# 等待服务器就绪
echo -e "${YELLOW}[等待]${NC} 等待服务器响应..."
for i in $(seq 1 30); do
    if curl -s -o /dev/null http://localhost:3003/api/funds 2>/dev/null; then
        break
    fi
    sleep 1
done

# 打开浏览器
echo -e "${GREEN}[打开]${NC} 正在打开浏览器..."
URL="http://localhost:3003/web/login"
if command -v xdg-open &> /dev/null; then
    xdg-open "$URL" 2>/dev/null || true
elif command -v open &> /dev/null; then
    open "$URL"
else
    echo -e "${YELLOW}[提示]${NC} 请手动打开: $URL"
fi

echo ""
echo "=========================================="
echo "  服务已启动!"
echo "  访问地址: http://localhost:3003/web/"
echo "  按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 捕获 Ctrl+C 停止后台服务器
trap "echo ''; echo '正在停止服务...'; kill $SERVER_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# 保持前台
wait $SERVER_PID
