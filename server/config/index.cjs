const logger = require('../utils/logger.cjs');

const requiredEnvVars = [
  'PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD',
  'JWT_SECRET',
];

const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please set these in your .env file. See .env.example for reference.');
  process.exit(1);
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET must be at least 32 characters');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

const db = {
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  max: isProd ? 20 : 10,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  options: '--client_encoding=UTF8',
};

const jwt = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
};

const cors = {
  origins: (process.env.CORS_ORIGINS || `http://localhost:${process.env.PORT || 3303},http://localhost:8866,http://localhost:5173`).split(','),
};

const server = {
  port: parseInt(process.env.PORT || '3303'),
  isProd,
  enableMockAuth: process.env.ENABLE_MOCK_AUTH === 'true',
};

const alipay = {
  appId: process.env.ALIPAY_APP_ID || '',
  privateKey: process.env.ALIPAY_APP_PRIVATE_KEY || '',
  publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
  gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
};

const ai = {
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiBase: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
};

const API_URLS = {
  EASTMONEY_NAV_HISTORY: 'https://api.fund.eastmoney.com/f10/lsjz',
};

const REQUEST_DEFAULTS = {
  REFERER_EASTMONEY: 'https://fund.eastmoney.com/',
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

module.exports = { db, jwt, cors, server, alipay, ai, API_URLS, REQUEST_DEFAULTS };
