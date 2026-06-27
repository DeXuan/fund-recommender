'use strict';

const logger = require('./logger.cjs');

/**
 * 统一的路由处理器
 * 隐藏 try/catch、错误日志、响应格式化等重复逻辑
 */

/**
 * 模式1：业务函数返回数据，wrapper 自动 res.json
 * 用法：router.get('/api/xxx', handler(async (req) => { return data; }))
 */
function handler(bizFn, { errorMessage = '请求失败', logLabel = '' } = {}) {
  return async (req, res) => {
    try {
      const result = await bizFn(req, res);
      if (!res.headersSent) {
        res.json(result);
      }
    } catch (e) {
      const status = e.status || 500;
      const msg = status === 500 ? errorMessage : e.message;
      const label = logLabel || errorMessage;
      if (status === 500) {
        logger.error(`[${label}] ${e.message}`);
      }
      if (!res.headersSent) {
        res.status(status).json({ error: msg });
      }
    }
  };
}

/**
 * 模式2：经典模式，业务函数自行处理 req/res
 * 用法：router.get('/api/xxx', createHandler(async (req, res) => { res.json(data); }))
 */
function createHandler(bizFn, opts) {
  // 兼容旧签名：createHandler(logLabel) 返回装饰器
  if (typeof bizFn === 'string') {
    const label = bizFn;
    return (fn) => handler(fn, { logLabel: label, errorMessage: opts?.errorMessage || `${label}失败` });
  }
  return handler(bizFn, opts);
}

function createGet(serviceFn, { errorMessage, logLabel, transform } = {}) {
  return handler(async (req) => {
    const result = await serviceFn(req.query, req.params);
    return transform ? transform(result) : result;
  }, { errorMessage, logLabel });
}

function createPost(serviceFn, { errorMessage, logLabel, transform } = {}) {
  return handler(async (req) => {
    const result = await serviceFn(req.body, req.params);
    return transform ? transform(result) : result;
  }, { errorMessage, logLabel });
}

module.exports = { handler, createHandler, createGet, createPost };
