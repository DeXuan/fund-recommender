@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: ============================================================
:: 基金推荐助手 - Windows 本地开发部署脚本
::
:: 功能：
::   - 自动检查 Node.js 环境
::   - 自动安装依赖
::   - 自动初始化数据库（可选）
::   - 自动启动前端和后端
::
:: 使用方法：
::   双击运行或在终端执行: deploy.bat
:: ============================================================

title 基金推荐助手 - 本地开发部署

echo.
echo ==========================================
echo   基金推荐助手 - 本地开发部署
echo ==========================================
echo.

:: ---- 检查 Node.js ----
echo [1/5] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [✗] Node.js 未安装！
    echo     请从 https://nodejs.org 下载安装 Node.js 20 LTS 或更高版本
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [✓] Node.js: %NODE_VER%

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [✓] npm: v%NPM_VER%

:: ---- 检查环境变量文件 ----
echo.
echo [2/5] 检查环境变量...
if not exist ".env" (
    if exist ".env.example" (
        echo [!] .env 文件不存在，正在从 .env.example 创建...
        copy .env.example .env >nul
        echo [✓] .env 文件已创建
        echo [!] 请编辑 .env 文件配置数据库连接信息
        echo.
    ) else (
        echo [✗] .env 和 .env.example 文件都不存在
        echo     请创建 .env 文件，参考 README.md 中的环境变量说明
        pause
        exit /b 1
    )
) else (
    echo [✓] .env 文件已存在
)

:: ---- 安装依赖 ----
echo.
echo [3/5] 安装项目依赖...
if not exist "node_modules" (
    echo     首次安装，可能需要几分钟...
    call npm install
    if %errorlevel% neq 0 (
        echo [✗] 依赖安装失败
        pause
        exit /b 1
    )
    echo [✓] 依赖安装完成
) else (
    echo [✓] node_modules 已存在
    echo     更新依赖...
    call npm install --prefer-offline 2>nul
)

:: ---- 初始化数据库（可选）----
echo.
echo [4/5] 数据库初始化...
echo     检查 PostgreSQL 连接...

:: 尝试初始化数据库表
node -e "require('./server/db.cjs').initDatabase().then(() => console.log('[✓] 数据库表初始化完成')).catch(e => console.log('[!] 数据库连接失败，请确保 PostgreSQL 已启动并配置正确'))" 2>nul

:: ---- 启动服务 ----
echo.
echo [5/5] 启动服务...
echo.
echo ==========================================
echo   启动中...
echo   后端: http://localhost:3003
echo   前端: http://localhost:5174/web
echo ==========================================
echo.

:: 在新窗口启动后端
echo [i] 启动后端服务 (端口 3003)...
start "基金推荐助手 - 后端" cmd /k "cd /d %cd% && npm run server"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 启动前端
echo [i] 启动前端服务 (端口 5174)...
echo.
echo ==========================================
echo   部署完成!
echo ==========================================
echo.
echo   前端地址: http://localhost:5174/web
echo   后端API:  http://localhost:3003/api/funds
echo.
echo   按 Ctrl+C 停止前端服务
echo   关闭后端请关闭对应的终端窗口
echo.
echo ==========================================

call npm run dev

pause
