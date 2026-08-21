'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-jwt-secret-for-unit-testing-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

let mockQueryResult = [];
let lastQuery = '';
let lastParams = [];

const mockPool = {
  query: async (sql, params) => {
    lastQuery = sql;
    lastParams = params;
    return { rows: mockQueryResult };
  },
};

const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent) {
  if (request === '../db.cjs' || request === './db.cjs') {
    return require.resolve('./mock-db.cjs');
  }
  return originalResolveFilename.apply(this, arguments);
};

const mockDbPath = require('path').join(__dirname, 'mock-db.cjs');
require('fs').writeFileSync(mockDbPath, `module.exports = { getPool: () => global.mockPool };`);
global.mockPool = mockPool;

const jwt = require('jsonwebtoken');
const auth = require('../auth.cjs');
const {
  authMiddleware,
  adminMiddleware,
  subscriptionMiddleware,
  svipMiddleware,
  svipExclusiveMiddleware,
  parseUserAgent,
  authRateLimit,
} = auth;

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (data) { res.body = data; return res; };
  return res;
}

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET);
}

describe('parseUserAgent', () => {
  it('空 UA 返回空字符串', () => {
    assert.deepEqual(parseUserAgent(''), { browser: '', os: '', device: '' });
    assert.deepEqual(parseUserAgent(null), { browser: '', os: '', device: '' });
    assert.deepEqual(parseUserAgent(undefined), { browser: '', os: '', device: '' });
  });

  it('Chrome on Windows Desktop', () => {
    const r = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    assert.equal(r.browser, 'Chrome');
    assert.equal(r.os, 'Windows');
    assert.equal(r.device, 'Desktop');
  });

  it('Firefox on macOS Desktop', () => {
    const r = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Firefox/121.0');
    assert.equal(r.browser, 'Firefox');
    assert.equal(r.os, 'macOS');
    assert.equal(r.device, 'Desktop');
  });

  it('Safari on iPhone Mobile', () => {
    const r = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1');
    assert.equal(r.browser, 'Safari');
    assert.equal(r.os, 'iOS');
    assert.equal(r.device, 'Mobile');
  });

  it('Edge on Windows', () => {
    const r = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/120.0.0.0');
    assert.equal(r.browser, 'Edge');
    assert.equal(r.os, 'Windows');
  });

  it('Chrome on Android Mobile', () => {
    const r = parseUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36');
    assert.equal(r.browser, 'Chrome');
    assert.equal(r.os, 'Android');
    assert.equal(r.device, 'Mobile');
  });

  it('IE via Trident', () => {
    const r = parseUserAgent('Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko');
    assert.equal(r.browser, 'IE');
    assert.equal(r.os, 'Windows');
  });
});

describe('authRateLimit', () => {
  it('未超限放行', () => {
    const limiter = authRateLimit(60000, 3);
    const req = { ip: '10.0.0.1', connection: {} };
    let nextCalled = 0;
    limiter(req, mockRes(), () => { nextCalled++; });
    assert.equal(nextCalled, 1);
  });

  it('超限返回 429', () => {
    const limiter = authRateLimit(60000, 2);
    const req = { ip: '10.0.0.2', connection: {} };
    limiter(req, mockRes(), () => {});
    limiter(req, mockRes(), () => {});
    const res3 = mockRes();
    limiter(req, res3, () => {});
    assert.equal(res3.statusCode, 429);
    assert.equal(res3.body.error, '请求过于频繁，请稍后再试');
  });

  it('窗口重置后重新计数', () => {
    const limiter = authRateLimit(1, 1);
    const req = { ip: '10.0.0.3', connection: {} };
    limiter(req, mockRes(), () => {});
    return new Promise((resolve) => {
      setTimeout(() => {
        let nextCalled = false;
        limiter(req, mockRes(), () => { nextCalled = true; });
        assert.equal(nextCalled, true);
        resolve();
      }, 5);
    });
  });
});

describe('authMiddleware', () => {
  beforeEach(() => { mockQueryResult = []; });

  it('无 Authorization header 返回 401 未登录', async () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    await authMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, '未登录');
    assert.equal(nextCalled, false);
  });

  it('非 Bearer 前缀返回 401', async () => {
    const req = { headers: { authorization: 'Basic abc' } };
    const res = mockRes();
    await authMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, '未登录');
  });

  it('无效 token 返回 401 登录已过期', async () => {
    const req = { headers: { authorization: 'Bearer invalidtoken' } };
    const res = mockRes();
    await authMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, '登录已过期，请重新登录');
  });

  it('有效 token + 用户 active 放行并注入 req.user', async () => {
    mockQueryResult = [{ status: 'active' }];
    const token = makeToken({ id: 101, username: 'test', nickname: 'Test', role: 'user' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    await authMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 101);
    assert.equal(req.user.username, 'test');
    assert.equal(req.user.role, 'user');
  });

  it('用户被禁用返回 403', async () => {
    mockQueryResult = [{ status: 'disabled' }];
    const token = makeToken({ id: 102, username: 'banned' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    await authMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, '该账户已被禁用，请联系管理员');
  });

  it('用户不存在返回 401', async () => {
    mockQueryResult = [];
    const token = makeToken({ id: 103, username: 'ghost' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    await authMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, '用户不存在');
  });

  it('DB 异常 fail-closed 返回 503', async () => {
    const original = mockPool.query;
    mockPool.query = async () => { throw new Error('DB down'); };
    const token = makeToken({ id: 104, username: 'test' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    await authMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, '服务暂时不可用，请稍后重试');
    mockPool.query = original;
  });
});

describe('adminMiddleware', () => {
  beforeEach(() => { mockQueryResult = []; });

  it('无 req.user 返回 403', async () => {
    const res = mockRes();
    await adminMiddleware({}, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, '需要管理员权限');
  });

  it('非管理员返回 403', async () => {
    mockQueryResult = [{ role: 'user', status: 'active' }];
    const req = { user: { id: 201 } };
    const res = mockRes();
    await adminMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
  });

  it('管理员放行并刷新 role', async () => {
    mockQueryResult = [{ role: 'admin', status: 'active' }];
    const req = { user: { id: 202 } };
    const res = mockRes();
    let nextCalled = false;
    await adminMiddleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.role, 'admin');
  });

  it('被禁用管理员返回 403', async () => {
    mockQueryResult = [{ role: 'admin', status: 'disabled' }];
    const req = { user: { id: 203 } };
    const res = mockRes();
    await adminMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
  });

  it('用户不存在返回 403', async () => {
    mockQueryResult = [];
    const req = { user: { id: 204 } };
    const res = mockRes();
    await adminMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
  });

  it('DB 异常返回 500', async () => {
    const original = mockPool.query;
    mockPool.query = async () => { throw new Error('DB down'); };
    const req = { user: { id: 205 } };
    const res = mockRes();
    await adminMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 500);
    mockPool.query = original;
  });
});

describe('subscriptionMiddleware', () => {
  beforeEach(() => { mockQueryResult = []; });

  it('未登录返回 403 LOGIN_REQUIRED', async () => {
    const res = mockRes();
    await subscriptionMiddleware({}, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'LOGIN_REQUIRED');
  });

  it('admin 直通', async () => {
    const req = { user: { id: 301, role: 'admin' } };
    let nextCalled = false;
    await subscriptionMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('premium 用户放行', async () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString();
    mockQueryResult = [{ subscription_status: 'premium', subscription_end: future, subscription_tier: 'premium' }];
    const req = { user: { id: 302, role: 'user' } };
    let nextCalled = false;
    await subscriptionMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user._tier, 'premium');
  });

  it('svip 用户放行', async () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString();
    mockQueryResult = [{ subscription_status: 'premium', subscription_end: future, subscription_tier: 'svip' }];
    const req = { user: { id: 303, role: 'user' } };
    let nextCalled = false;
    await subscriptionMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('free 用户拒绝 SUBSCRIPTION_REQUIRED', async () => {
    mockQueryResult = [{ subscription_status: 'free', subscription_end: null, subscription_tier: 'free' }];
    const req = { user: { id: 304, role: 'user' } };
    const res = mockRes();
    await subscriptionMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'SUBSCRIPTION_REQUIRED');
  });

  it('过期 premium 拒绝', async () => {
    mockQueryResult = [{ subscription_status: 'premium', subscription_end: '2020-01-01', subscription_tier: 'free' }];
    const req = { user: { id: 305, role: 'user' } };
    const res = mockRes();
    await subscriptionMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
  });
});

describe('svipMiddleware', () => {
  beforeEach(() => { mockQueryResult = []; });

  it('未登录返回 403', async () => {
    const res = mockRes();
    await svipMiddleware({}, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'LOGIN_REQUIRED');
  });

  it('admin 直通', async () => {
    const req = { user: { id: 401, role: 'admin' } };
    let nextCalled = false;
    await svipMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('svip 用户放行', async () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString();
    mockQueryResult = [{ subscription_status: 'premium', subscription_end: future, subscription_tier: 'svip' }];
    const req = { user: { id: 402, role: 'user' } };
    let nextCalled = false;
    await svipMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('premium 用户放行（svipMiddleware 允许 premium+svip）', async () => {
    const future = new Date(Date.now() + 86400000 * 30).toISOString();
    mockQueryResult = [{ subscription_status: 'premium', subscription_end: future, subscription_tier: 'premium' }];
    const req = { user: { id: 403, role: 'user' } };
    let nextCalled = false;
    await svipMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('free 用户拒绝', async () => {
    mockQueryResult = [{ subscription_status: 'free', subscription_end: null, subscription_tier: 'free' }];
    const req = { user: { id: 404, role: 'user' } };
    const res = mockRes();
    await svipMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
  });
});

describe('svipExclusiveMiddleware', () => {
  beforeEach(() => { mockQueryResult = []; });

  it('未登录返回 403', async () => {
    const res = mockRes();
    await svipExclusiveMiddleware({}, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'LOGIN_REQUIRED');
  });

  it('admin 直通', async () => {
    const req = { user: { id: 501, role: 'admin' } };
    let nextCalled = false;
    await svipExclusiveMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('svip 用户放行', async () => {
    mockQueryResult = [{ subscription_tier: 'svip' }];
    const req = { user: { id: 502, role: 'user' } };
    let nextCalled = false;
    await svipExclusiveMiddleware(req, mockRes(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user._tier, 'svip');
  });

  it('premium 用户拒绝（仅 svip）', async () => {
    mockQueryResult = [{ subscription_tier: 'premium' }];
    const req = { user: { id: 503, role: 'user' } };
    const res = mockRes();
    await svipExclusiveMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'SVIP_REQUIRED');
  });

  it('free 用户拒绝', async () => {
    mockQueryResult = [{ subscription_tier: 'free' }];
    const req = { user: { id: 504, role: 'user' } };
    const res = mockRes();
    await svipExclusiveMiddleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
  });
});
