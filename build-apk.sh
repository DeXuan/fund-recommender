#!/bin/bash
# 基金推荐助手 APK 构建脚本
# 版本信息从 capacitor.config.ts 读取
# 版权所有: guandexun

set -e

echo "========================================="
echo "  基金推荐助手 APK 构建脚本"
echo "  版权所有: guandexun"
echo "========================================="

# 1. 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
  echo "[1/5] 安装 npm 依赖..."
  npm install
else
  echo "[1/5] 依赖已存在，跳过"
fi

# 2. 构建前端（Capacitor 模式）
echo "[2/5] 构建前端资源..."
CAPACITOR=true npx vite build --mode capacitor

# 3. 生成图标
echo "[3/5] 生成应用图标..."
node scripts/generate-icons.cjs

# 4. 同步到 Android 项目
echo "[4/5] 同步到 Android 项目..."
npx cap sync android

# 5. 构建 APK
echo "[5/5] 构建 APK..."
cd android
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug

# 复制 APK 到项目根目录
APK_NAME="fund-recommender-v1.0.0-debug.apk"
cp app/build/outputs/apk/debug/app-debug.apk "../$APK_NAME"

echo ""
echo "========================================="
echo "  构建完成!"
echo "  APK: $APK_NAME"
echo "  大小: $(du -h "../$APK_NAME" | cut -f1)"
echo "========================================="
