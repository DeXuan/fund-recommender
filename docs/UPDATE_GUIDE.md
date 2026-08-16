# 部署与更新指南

## 访问地址

**http://111.229.32.106:8686/web**

---

## 全新部署（首次或服务器文件被删除后）

### 1. 本地打包项目
在 `c:\Users\gdx\` 目录下：
- 右键 `fund-recommender` 文件夹
- 选择 **发送到 → 压缩(zipped)文件夹**

### 2. 上传到服务器
将 `fund-recommender.zip` 上传到服务器的 `/tmp/` 目录

### 3. SSH登录运行部署
```bash
ssh root@111.229.32.106
bash /tmp/deploy-full.sh
```

### 4. 如果前端构建失败
在本地构建后上传：
```bash
# 本地执行
cd c:\Users\gdx\fund-recommender
npm run build

# 上传到服务器
scp -r dist/* root@111.229.32.106:/var/www/jijin85/dist/
```

---

## 一键更新（日常更新）

### 1. 本地打包项目
同上，打包为 `fund-recommender.zip`

### 2. 上传到服务器
将 `fund-recommender.zip` 上传到服务器的 `/var/www/` 目录

### 3. SSH登录运行更新
```bash
ssh root@111.229.32.106
bash /var/www/update.sh
```

---

## 脚本说明

| 脚本 | 用途 | 上传位置 |
|------|------|----------|
| `deploy-full.sh` | 全新部署 | `/tmp/` |
| `update.sh` | 更新已有部署 | `/var/www/` |
| `fix-server.sh` | 修复服务器问题 | `/var/www/` |
| `fix-permission.sh` | 修复403权限错误 | `/var/www/` |

---

## 重要配置说明

### 数据库配置
**数据库和服务器在同一台机器上**，必须使用 `localhost`：

```env
PG_HOST=localhost      # 不要用IP地址！
PG_PORT=5432
PG_DATABASE=your_database
PG_USER=your_db_user
PG_PASSWORD=your_db_password
```

### 支付宝配置
```env
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://111.229.32.106:8686/api/auth/alipay/callback
```

---

## 常用命令

```bash
# 查看后端状态
pm2 status

# 查看后端日志（新站 fund-server-85）
pm2 logs fund-server-85 --lines 30

# 重启后端（新站）
pm2 restart fund-server-85

# 测试API（新站后端 3303）
curl http://localhost:3303/api/funds

# 重启Nginx
systemctl restart nginx

# 查看Nginx状态
systemctl status nginx
```

---

## 故障排查

### 502 Bad Gateway
后端服务没启动：
```bash
pm2 status
pm2 restart fund-server-85
pm2 logs fund-server-85 --lines 30
```

### 403 Forbidden
文件权限问题：
```bash
bash /var/www/fix-permission.sh
```

### 数据库连接失败
检查.env配置：
```bash
cat /var/www/jijin85/.env | grep PG_
# 确保 PG_HOST=localhost
```

### 页面没有数据
```bash
# 检查API返回
curl http://localhost:3303/api/funds

# 如果返回空，检查数据库
psql -h localhost -U your_db_user -d your_database -c "SELECT COUNT(*) FROM funds;"
```

---

## 备份与恢复

### 自动备份
更新脚本会自动备份到 `/var/www/backups/`

### 手动恢复
```bash
cd /var/www
ls backups/  # 查看备份列表
tar -xzf backups/jijin_XXXXXXXX_XXXXXX.tar.gz
pm2 restart fund-server-85
```

---

## 首次部署检查清单

- [ ] 上传项目zip到服务器
- [ ] 运行 `deploy-full.sh`（JWT_SECRET 会自动生成）
- [ ] 上传密钥文件到 `keys/` 目录
- [ ] 确认 `.env` 文件配置正确（PG_HOST=localhost）
- [ ] 上传前端构建产物 `dist/`（如果服务器构建失败）
- [ ] 确认 Python 3.8+ 已安装（招行理财产品数据爬取需要，可选）
- [ ] 测试访问 http://111.229.32.106:8686/web
- [ ] 测试支付宝登录功能
- [ ] 运行 `pm2 startup` 确保开机自启已配置

## 更新后验证

每次更新后建议检查：
```bash
# 1. 确认 .env 包含所有必需变量（新版可能新增变量）
cat /var/www/jijin85/.env | grep -v "^#" | grep -v "^$"

# 2. 确认后端正常启动
pm2 logs fund-server-85 --lines 20

# 3. 确认 API 正常响应
curl http://localhost:3303/api/funds | head -c 200

# 4. 确认前端可访问
curl -I http://127.0.0.1:8686/web/
```

---

## 安全说明

### 禁用用户即时失效（v0.6+）
管理员在后台禁用用户后，该用户的现有 JWT 令牌将**立即失效**，无需等待 7 天过期。

技术实现：
- `authMiddleware` 在验证 JWT 签名后，会查询数据库检查用户状态
- 使用 30 秒 TTL 缓存避免每次请求都查询数据库
- 被禁用用户的所有请求将返回 403 错误

### 管理员权限校验
- `adminMiddleware` 实时查询数据库 role/status，不信任 JWT 缓存的 role
- 管理员降权后旧 token 立即失效
