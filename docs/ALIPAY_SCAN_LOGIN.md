# 支付宝扫码登录功能说明

## 访问地址

**http://47.116.77.67:8688/web**

## 功能概述

本项目支持支付宝OAuth2.0扫码登录功能，用户可以通过支付宝APP扫码完成登录注册。

## 登录流程

### 1. 用户访问登录页面
- 访问 http://47.116.77.67:8688/web
- 点击"支付宝扫码登录"按钮

### 2. 打开支付宝授权窗口
- 系统自动打开新窗口显示支付宝授权页面
- 用户在支付宝窗口中扫码或登录授权

### 3. 完成登录
- 授权成功后，窗口自动关闭
- 原页面自动检测到授权成功
- 自动登录并跳转到持仓页面
- **新用户自动注册，老用户直接登录**

## 技术实现

### 前端实现
- 点击按钮后打开新窗口显示支付宝授权页
- 每2秒轮询后端检查授权状态
- 授权成功后自动登录并跳转

### 后端实现
- `GET /api/auth/alipay/qrcode` - 返回支付宝授权URL和state
- `GET /api/auth/alipay/callback` - 处理支付宝回调，存储授权结果
- `GET /api/auth/alipay/check?state=xxx` - 前端轮询检查授权状态

### 安全机制
- CSRF防护（state参数签名）
- Token安全传递
- 授权窗口自动关闭

## 配置要求

### 环境变量（/var/www/jijin/.env）
```env
ALIPAY_APP_ID=2021006159645339
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://47.116.77.67:8688/api/auth/alipay/callback
```

### 支付宝开放平台配置
1. 登录 [支付宝开放平台](https://open.alipay.com)
2. 配置授权回调地址：`http://47.116.77.67:8688/api/auth/alipay/callback`
3. 上传应用公钥

## 测试流程

### 1. 访问登录页面
```
http://47.116.77.67:8688/web
```

### 2. 点击支付宝登录
- 点击"支付宝扫码登录"按钮
- 弹出支付宝授权窗口

### 3. 完成授权
- 在支付宝窗口中完成授权
- 窗口自动关闭
- 原页面自动登录

## 常见问题

### Q: 无法打开支付宝授权窗口
A: 检查浏览器是否阻止了弹窗，允许弹窗后重试。

### Q: 授权后页面没有反应
A: 等待几秒钟，系统会自动检测授权状态。如果长时间无反应，刷新页面重试。

### Q: 提示"支付宝登录暂未配置"
A: 检查服务器上的 `.env` 文件是否正确配置了支付宝相关参数。

## 文件结构

```
/var/www/jijin/
├── src/pages/Login.tsx              # 登录页面
├── server/auth.cjs                  # 认证路由
├── server/utils/alipay.cjs         # 支付宝SDK封装
└── docs/
    ├── ALIPAY_SETUP.md              # 配置指南
    └── ALIPAY_SCAN_LOGIN.md         # 本文档
```

## 更新日志

### 2026-06-05
- 实现支付宝扫码登录功能
- 支持新用户自动注册
- 支持老用户直接登录
- 优化用户体验
