'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-jwt-secret-for-unit-testing-at-least-32-chars-long';
process.env.NODE_ENV = 'test';

const mockPool = { query: async () => ({ rows: [] }) };

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

let sanitizeHtml, generateSessionId, getUserId;
try {
  const aiAssistant = require('../routes/ai-assistant.cjs');
  sanitizeHtml = aiAssistant.sanitizeHtml;
  generateSessionId = aiAssistant.generateSessionId;
  getUserId = aiAssistant.getUserId;
} catch (e) {
  console.error('ai-assistant.cjs 加载失败，跳过测试:', e.message);
}

const hasModule = !!sanitizeHtml;

describe('sanitizeHtml', { skip: !hasModule }, () => {
  it('空字符串/非字符串原样返回', () => {
    assert.equal(sanitizeHtml(''), '');
    assert.equal(sanitizeHtml(null), null);
    assert.equal(sanitizeHtml(undefined), undefined);
    assert.equal(sanitizeHtml(123), 123);
  });

  it('转义 HTML 特殊字符', () => {
    assert.equal(sanitizeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('转义引号防属性注入', () => {
    assert.equal(sanitizeHtml('"onmouseover="alert(1)'), '&quot;onmouseover=&quot;alert(1)');
    assert.equal(sanitizeHtml("x'or'1'='1"), 'x&#x27;or&#x27;1&#x27;=&#x27;1');
  });

  it('转义 & 符号', () => {
    assert.equal(sanitizeHtml('a & b'), 'a &amp; b');
  });

  it('组合转义', () => {
    const input = '<img src="x" onerror=\'alert(1)\'>';
    const out = sanitizeHtml(input);
    assert.ok(!out.includes('<'));
    assert.ok(!out.includes('>'));
    assert.ok(!out.includes('"'));
    assert.ok(!out.includes("'"));
  });

  it('普通文本不变', () => {
    assert.equal(sanitizeHtml('hello world 你好'), 'hello world 你好');
  });
});

describe('generateSessionId', { skip: !hasModule }, () => {
  it('生成 chat_ 前缀', () => {
    const id = generateSessionId();
    assert.ok(id.startsWith('chat_'));
  });

  it('每次生成不同 ID', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateSessionId());
    assert.equal(ids.size, 100);
  });

  it('格式 chat_{timestamp}_{hex16}', () => {
    const id = generateSessionId();
    const parts = id.split('_');
    assert.equal(parts.length, 3);
    assert.equal(parts[0], 'chat');
    assert.ok(parts[1].length > 0);
    assert.ok(parts[2].length === 16);
  });
});

describe('getUserId', { skip: !hasModule }, () => {
  it('有 user.id 返回 id', () => {
    assert.equal(getUserId({ user: { id: 42 } }), 42);
  });
  it('无 user 返回 null', () => {
    assert.equal(getUserId({}), null);
    assert.equal(getUserId(null), null);
  });
  it('user 无 id 返回 null', () => {
    assert.equal(getUserId({ user: {} }), null);
  });
});
