#!/usr/bin/env node

/**
 * 支付宝SDK测试脚本
 *
 * 使用方法：
 * node scripts/test-alipay.cjs
 */

require('dotenv').config();
const { isAlipayConfigured, getAlipaySdk } = require('../server/utils/alipay.cjs');

console.log('=== 支付宝SDK配置测试 ===\n');

// 检查环境变量
console.log('1. 环境变量检查:');
console.log('   ALIPAY_APP_ID:', process.env.ALIPAY_APP_ID ? '✓ 已配置' : '✗ 未配置');
console.log('   ALIPAY_PRIVATE_KEY:', process.env.ALIPAY_PRIVATE_KEY ? '✓ 已配置' : '✗ 未配置');
console.log('   ALIPAY_PUBLIC_KEY:', process.env.ALIPAY_PUBLIC_KEY ? '✓ 已配置' : '✗ 未配置');
console.log('   ALIPAY_RETURN_URL:', process.env.ALIPAY_RETURN_URL || '未配置');

// 检查SDK配置
console.log('\n2. SDK配置检查:');
const configured = isAlipayConfigured();
console.log('   支付宝已配置:', configured ? '✓ 是' : '✗ 否');

if (configured) {
  try {
    const sdk = getAlipaySdk();
    console.log('   SDK实例创建:', sdk ? '✓ 成功' : '✗ 失败');
    if (sdk) {
      console.log('   APPID:', sdk.config?.appId || '未知');
      console.log('   签名类型:', sdk.config?.signType || '未知');
      console.log('   网关地址:', sdk.config?.gateway || '未知');
    }
  } catch (error) {
    console.log('   SDK初始化失败:', error.message);
  }
}

// 检查密钥文件
console.log('\n3. 密钥文件检查:');
const fs = require('fs');
const path = require('path');

const privateKeyPath = process.env.ALIPAY_PRIVATE_KEY;
const publicKeyPath = process.env.ALIPAY_PUBLIC_KEY;

if (privateKeyPath) {
  const fullPrivateKeyPath = path.resolve(privateKeyPath);
  const privateKeyExists = fs.existsSync(fullPrivateKeyPath);
  console.log('   私钥文件:', privateKeyExists ? '✓ 存在' : '✗ 不存在');
  if (privateKeyExists) {
    const content = fs.readFileSync(fullPrivateKeyPath, 'utf-8');
    console.log('   私钥格式:', content.includes('BEGIN') ? '✓ PEM格式' : '✗ 格式错误');
  }
}

if (publicKeyPath) {
  const fullPublicKeyPath = path.resolve(publicKeyPath);
  const publicKeyExists = fs.existsSync(fullPublicKeyPath);
  console.log('   支付宝公钥文件:', publicKeyExists ? '✓ 存在' : '✗ 不存在');
  if (publicKeyExists) {
    const content = fs.readFileSync(fullPublicKeyPath, 'utf-8');
    console.log('   支付宝公钥格式:', content.includes('BEGIN') ? '✓ PEM格式' : '✗ 格式错误');
  }
}

console.log('\n=== 测试完成 ===');

if (!configured) {
  console.log('\n提示: 支付宝登录功能当前运行在模拟模式。');
  console.log('如需启用真实支付宝登录，请：');
  console.log('1. 运行 npm run generate-alipay-keys 生成密钥对');
  console.log('2. 将应用公钥上传到支付宝开放平台');
  console.log('3. 将支付宝公钥保存到 keys/alipay_public_key_from_alipay.pem');
  console.log('4. 更新 .env 文件中的 ALIPAY_PUBLIC_KEY');
}
