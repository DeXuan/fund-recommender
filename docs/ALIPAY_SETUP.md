# 支付宝扫码登录配置指南

## 概述

本项目支持支付宝OAuth2.0扫码登录功能。用户可以通过支付宝APP扫码完成登录。

## 访问地址

**http://47.116.77.67:8688/web**

## 配置步骤

### 1. 生成密钥对

```bash
npm run generate-alipay-keys
```

运行后会在 `keys/` 目录下生成两个文件：
- `alipay_private_key.pem` - 应用私钥
- `alipay_public_key.pem` - 应用公钥

### 2. 配置支付宝开放平台

1. 登录 [支付宝开放平台](https://open.alipay.com)
2. 进入你的应用（APPID: 2021006159645339）
3. 在"开发设置" -> "接口加签方式"中：
   - 选择"公钥"模式
   - 将 `keys/alipay_public_key.pem` 的内容粘贴到"填写公钥字符"输入框
   - 保存后，复制生成的"支付宝公钥"

### 3. 配置支付宝公钥

将从支付宝开放平台获取的"支付宝公钥"保存到 `keys/alipay_public_key_from_alipay.pem` 文件中。

### 4. 更新环境变量

编辑服务器上的 `/var/www/jijin/.env` 文件：

```env
ALIPAY_APP_ID=2021006159645339
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://47.116.77.67:8688/api/auth/alipay/callback
```

### 5. 配置授权回调地址

在支付宝开放平台的应用配置中，添加授权回调地址：
```
http://47.116.77.67:8688/api/auth/alipay/callback
```

### 6. 上传密钥文件到服务器

```bash
# 本地执行
scp -r keys/* root@47.116.77.67:/var/www/jijin/keys/
```

### 7. 重启服务

```bash
# SSH登录服务器
ssh root@47.116.77.67

# 重启后端
pm2 restart fund-server
```

## 测试流程

1. 访问 http://47.116.77.67:8688/web
2. 点击"支付宝扫码登录"
3. 在弹出的支付宝窗口中完成授权
4. 自动登录并跳转

## 登录流程

1. 用户点击"支付宝扫码登录"按钮
2. 系统打开新窗口显示支付宝授权页面
3. 用户在支付宝中完成授权
4. 授权成功后，窗口自动关闭
5. 原页面自动检测到授权成功并完成登录
6. 跳转到持仓页面

**新用户**会自动注册，**老用户**直接登录。

## 常见问题

### Q: 提示"支付宝登录暂未配置"
A: 检查 `.env` 文件中的支付宝配置是否正确，密钥文件是否存在。

### Q: 扫码后无法登录
A: 检查以下配置：
- 支付宝开放平台是否配置了正确的回调地址
- 密钥文件是否正确上传到服务器
- `.env` 中的 `ALIPAY_RETURN_URL` 是否正确

### Q: 如何切换回模拟模式？
A: 在 `.env` 文件中设置：
```env
ENABLE_MOCK_AUTH=true
```

## 文件结构

```
/var/www/jijin/
├── keys/                              # 密钥目录
│   ├── alipay_private_key.pem         # 应用私钥
│   ├── alipay_public_key.pem          # 应用公钥
│   └── alipay_public_key_from_alipay.pem  # 支付宝公钥
├── server/
│   ├── auth.cjs                       # 认证路由
│   └── utils/
│       └── alipay.cjs                 # 支付宝SDK封装
└── .env                               # 环境变量配置
```

## 安全说明

1. **私钥安全**：私钥必须妥善保管，不要泄露或提交到代码仓库
2. **HTTPS**：生产环境建议使用HTTPS
3. **回调地址**：确保回调地址配置正确
4. **密钥备份**：定期备份 `keys/` 目录
