@echo off
chcp 65001 >nul 2>&1
title 基金推荐助手

echo.
echo ==========================================
echo   基金推荐助手 - 一键启动
echo ==========================================
echo.

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装: https://nodejs.org
    pause
    exit /b 1
)

:: 检查 .env
if not exist ".env" (
    if exist ".env.example" (
        echo [信息] 首次运行，复制配置文件...
        copy .env.example .env >nul
        echo [提示] 请编辑 .env 文件配置数据库连接，然后重新运行
        pause
        exit /b 1
    ) else (
        echo [错误] 缺少 .env 配置文件
        pause
        exit /b 1
    )
)

:: 检查 node_modules
if not exist "node_modules" (
    echo [信息] 首次运行，安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

:: 检查 dist，不存在则构建
if not exist "dist" (
    echo [信息] 首次运行，构建前端...
    call npm run build
    if %errorlevel% neq 0 (
        echo [错误] 前端构建失败
        pause
        exit /b 1
    )
    echo [信息] 前端构建完成
    echo.
)

:: 清理旧进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3003 ^| findstr LISTENING') do (
    echo [清理] 终止旧进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: 启动服务器
echo [启动] 正在启动服务器...
start /b node server/index.cjs

:: 等待服务器就绪
echo [等待] 等待服务器响应...
:WAIT_LOOP
timeout /t 1 /nobreak >nul
curl -s -o nul -w "" http://localhost:3003/api/funds 2>nul
if %errorlevel% neq 0 goto WAIT_LOOP

:: 打开浏览器
echo [打开] 正在打开浏览器...
start http://localhost:3003/web/login

echo.
echo ==========================================
echo   服务已启动!
echo   访问地址: http://localhost:3003/web/
echo   按 Ctrl+C 停止服务
echo ==========================================
echo.

:: 保持窗口
node -e "process.on('SIGINT', () => process.exit()); setInterval(() => {}, 1000)"
