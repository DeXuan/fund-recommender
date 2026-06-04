/**
 * 加密工具模块 — 用于 OAuth token 等敏感数据的加密存储
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * 获取加密密钥（从 JWT_SECRET 派生）
 */
function getEncryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required for encryption');
  }
  // 使用 SHA-256 从 JWT_SECRET 派生 32 字节密钥
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * 加密文本
 * @param {string} text - 要加密的文本
 * @returns {string} - Base64 编码的加密数据（格式: iv:tag:ciphertext）
 */
function encrypt(text) {
  if (!text) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const tag = cipher.getAuthTag();

  // 将 iv + tag + ciphertext 合并为一个 Base64 字符串
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

/**
 * 解密文本
 * @param {string} encryptedData - Base64 编码的加密数据（格式: iv:tag:ciphertext）
 * @returns {string} - 解密后的文本
 */
function decrypt(encryptedData) {
  if (!encryptedData) return '';

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.warn('[加密] 解密失败:', error.message);
    return '';
  }
}

module.exports = { encrypt, decrypt };
