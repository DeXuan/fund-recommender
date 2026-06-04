'use strict';

const { AlipaySdk } = require('alipay-sdk');
const fs = require('fs');
const path = require('path');

let alipayInstance = null;

/**
 * 获取支付宝SDK实例（单例模式）
 */
function getAlipaySdk() {
  if (alipayInstance) {
    return alipayInstance;
  }

  const appId = process.env.ALIPAY_APP_ID;
  const privateKey = process.env.ALIPAY_PRIVATE_KEY;
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;

  if (!appId || !privateKey || !alipayPublicKey) {
    return null;
  }

  // 支持从文件路径读取密钥
  let privateKeyContent = privateKey;
  let publicKeyContent = alipayPublicKey;

  // 如果是文件路径，读取文件内容
  if (privateKey.endsWith('.pem') || privateKey.endsWith('.key')) {
    const keyPath = path.resolve(privateKey);
    if (fs.existsSync(keyPath)) {
      privateKeyContent = fs.readFileSync(keyPath, 'utf-8');
    }
  }

  if (alipayPublicKey.endsWith('.pem')) {
    const keyPath = path.resolve(alipayPublicKey);
    if (fs.existsSync(keyPath)) {
      publicKeyContent = fs.readFileSync(keyPath, 'utf-8');
    }
  }

  alipayInstance = new AlipaySdk({
    appId,
    privateKey: privateKeyContent,
    alipayPublicKey: publicKeyContent,
    signType: 'RSA2',
    gateway: 'https://openapi.alipay.com/gateway.do',
    timeout: 10000,
  });

  return alipayInstance;
}

/**
 * 调用支付宝系统OAuth令牌接口
 * @param {string} code - 授权码
 * @returns {Promise<{access_token: string, user_id: string}>}
 */
async function getOAuthToken(code) {
  const sdk = getAlipaySdk();
  if (!sdk) {
    throw new Error('支付宝SDK未配置');
  }

  const result = await sdk.exec('alipay.system.oauth.token', {
    grantType: 'authorization_code',
    code,
  });

  return result;
}

/**
 * 获取用户信息
 * @param {string} accessToken - 访问令牌
 * @returns {Promise<{user_id: string, nick_name: string, avatar: string}>}
 */
async function getUserInfo(accessToken) {
  const sdk = getAlipaySdk();
  if (!sdk) {
    throw new Error('支付宝SDK未配置');
  }

  const result = await sdk.exec('alipay.user.info.share', {
    authToken: accessToken,
  });

  return result;
}

/**
 * 检查支付宝是否已配置
 */
function isAlipayConfigured() {
  return !!(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY);
}

module.exports = {
  getAlipaySdk,
  getOAuthToken,
  getUserInfo,
  isAlipayConfigured,
};
