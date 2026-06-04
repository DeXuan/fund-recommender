# 部署与更新指南

## 访问地址

**http://47.116.77.67:8688/web**

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
ssh root@47.116.77.67
bash /tmp/deploy-full.sh
```

### 4. 如果前端构建失败
在本地构建后上传：
```bash
# 本地执行
cd c:\Users\gdx\fund-recommender
npm run build

# 上传到服务器
scp -r dist/* root@47.116.77.67:/var/www/jijin/dist/
```

---

## 一键更新（日常更新）

### 1. 本地打包项目
同上，打包为 `fund-recommender.zip`

### 2. 上传到服务器
将 `fund-recommender.zip` 上传到服务器的 `/var/www/` 目录

### 3. SSH登录运行更新
```bash
ssh root@47.116.77.67
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
PG_DATABASE=soulquad
PG_USER=soulquad_user
PG_PASSWORD=SoulQuad2024!
```

### 支付宝配置
```env
ALIPAY_APP_ID=2021006159645339
ALIPAY_PRIVATE_KEY=keys/alipay_private_key.pem
ALIPAY_PUBLIC_KEY=keys/alipay_public_key_from_alipay.pem
ALIPAY_RETURN_URL=http://47.116.77.67:8688/api/auth/alipay/callback
```

---

## 常用命令

```bash
# 查看后端状态
pm2 status

# 查看后端日志
pm2 logs fund-server --lines 30

# 重启后端
pm2 restart fund-server

# 测试API
curl http://localhost:3003/api/funds

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
pm2 restart fund-server
pm2 logs fund-server --lines 30
```

### 403 Forbidden
文件权限问题：
```bash
bash /var/www/fix-permission.sh
```

### 数据库连接失败
检查.env配置：
```bash
cat /var/www/jijin/.env | grep PG_
# 确保 PG_HOST=localhost
```

### 页面没有数据
```bash
# 检查API返回
curl http://localhost:3003/api/funds

# 如果返回空，检查数据库
psql -h localhost -U soulquad_user -d soulquad -c "SELECT COUNT(*) FROM funds;"
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
pm2 restart fund-server
```

---

## 首次部署检查清单

- [ ] 上传项目zip到服务器
- [ ] 运行 `deploy-full.sh`
- [ ] 上传密钥文件到 `keys/` 目录
- [ ] 确认 `.env` 文件配置正确（PG_HOST=localhost）
- [ ] 上传前端构建产物 `dist/`（如果服务器构建失败）
- [ ] 测试访问 http://47.116.77.67:8688/web
- [ ] 测试支付宝登录功能
