#!/usr/bin/env node

/**
 * 支付宝密钥对生成脚本
 *
 * 使用方法：
 * node scripts/generate-alipay-keys.cjs
 *
 * 生成的密钥文件：
 * - keys/alipay_private_key.pem - 应用私钥（用于签名）
 * - keys/alipay_public_key.pem - 应用公钥（用于上传到支付宝开放平台）
 * - keys/alipay_public_key_from_alipay.pem - 支付宝公钥（从支付宝获取，用于验证签名）
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '..', 'keys');

// 创建keys目录
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
}

console.log('=== 支付宝密钥对生成工具 ===\n');

// 生成RSA密钥对
console.log('正在生成RSA 2048位密钥对...\n');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// 保存私钥
const privateKeyPath = path.join(keysDir, 'alipay_private_key.pem');
fs.writeFileSync(privateKeyPath, privateKey);
console.log('✓ 私钥已保存到:', privateKeyPath);

// 保存公钥
const publicKeyPath = path.join(keysDir, 'alipay_public_key.pem');
fs.writeFileSync(publicKeyPath, publicKey);
console.log('✓ 公钥已保存到:', publicKeyPath);

// 提取纯公钥内容（去除头尾标记）
const publicKeyContent = publicKey
  .replace('-----BEGIN PUBLIC KEY-----', '')
  .replace('-----END PUBLIC KEY-----', '')
  .replace(/\s+/g, '');

console.log('\n=== 重要说明 ===\n');
console.log('1. 应用公钥（需要上传到支付宝开放平台）：');
console.log('   文件位置:', publicKeyPath);
console.log('\n2. 应用私钥（需要配置到服务器环境变量）：');
console.log('   文件位置:', privateKeyPath);
console.log('\n3. 配置步骤：');
console.log('   a) 登录支付宝开放平台: https://open.alipay.com');
console.log('   b) 进入应用 -> 开发设置 -> 接口加签方式');
console.log('   c) 选择"公钥"模式');
console.log('   d) 将下面的应用公钥内容粘贴到"填写公钥字符"输入框');
console.log('   e) 保存后，支付宝会生成"支付宝公钥"，将其保存到:');
console.log('      ' + path.join(keysDir, 'alipay_public_key_from_alipay.pem'));
console.log('\n4. 更新 .env 文件：');
console.log('   ALIPAY_APP_ID=your_alipay_app_id');
console.log('   ALIPAY_PRIVATE_KEY=<私钥文件路径或私钥内容>');
console.log('   ALIPAY_PUBLIC_KEY=<支付宝公钥文件路径或公钥内容>');
console.log('\n5. 应用公钥内容（可直接复制）：');
console.log('----------------------------------------');
console.log(publicKeyContent);
console.log('----------------------------------------');
console.log('\n注意: 请妥善保管私钥，不要泄露给任何人！');
