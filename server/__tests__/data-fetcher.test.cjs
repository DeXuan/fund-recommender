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

const {
  estimatePercentile,
  getValuationByPercentile,
  validatePortfolioValues,
  classifyGoldCategory,
  inferIndustry,
  estimateRating,
} = require('../data-fetcher.cjs');

describe('estimatePercentile', () => {
  it('沪深300 PE 在区间内', () => {
    assert.equal(estimatePercentile('000300', 14.5, 'pe'), 50);
  });
  it('沪深300 PE 区间下界返回 0', () => {
    assert.equal(estimatePercentile('000300', 9, 'pe'), 0);
  });
  it('沪深300 PE 区间上界返回 100', () => {
    assert.equal(estimatePercentile('000300', 20, 'pe'), 100);
  });
  it('沪深300 PE 超出上界截断为 100', () => {
    assert.equal(estimatePercentile('000300', 30, 'pe'), 100);
  });
  it('沪深300 PE 低于下界截断为 0', () => {
    assert.equal(estimatePercentile('000300', 5, 'pe'), 0);
  });
  it('未知指数返回 50', () => {
    assert.equal(estimatePercentile('999999', 15, 'pe'), 50);
  });
  it('PB 类型使用 PB 区间', () => {
    assert.equal(estimatePercentile('000300', 1.35, 'pb'), 50);
  });
  it('中证500 PE 区间中点', () => {
    assert.equal(estimatePercentile('000905', 34, 'pe'), 50);
  });
});

describe('getValuationByPercentile', () => {
  it('null 返回数据缺失', () => {
    assert.deepEqual(getValuationByPercentile(null), { valuation: '数据缺失', suggestion: '暂无建议' });
  });
  it('<20 极度低估', () => {
    assert.deepEqual(getValuationByPercentile(10), { valuation: '极度低估', suggestion: '适合加大定投' });
  });
  it('<40 偏低估', () => {
    assert.deepEqual(getValuationByPercentile(30), { valuation: '偏低估', suggestion: '适合定投' });
  });
  it('<60 合理', () => {
    assert.deepEqual(getValuationByPercentile(50), { valuation: '合理', suggestion: '适合小额定投' });
  });
  it('<80 偏高估', () => {
    assert.deepEqual(getValuationByPercentile(70), { valuation: '偏高估', suggestion: '建议观望' });
  });
  it('>=80 极度高估', () => {
    assert.deepEqual(getValuationByPercentile(90), { valuation: '极度高估', suggestion: '建议减仓' });
  });
  it('边界 20 归偏低估', () => {
    assert.equal(getValuationByPercentile(20).valuation, '偏低估');
  });
  it('边界 80 归极度高估', () => {
    assert.equal(getValuationByPercentile(80).valuation, '极度高估');
  });
});

describe('validatePortfolioValues', () => {
  it('正常值返回 valid', () => {
    const r = validatePortfolioValues({}, 1.5, 1000, 1.2, 10);
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
    assert.equal(r.values.totalCost, 1210);
    assert.equal(r.values.marketValue, 1500);
    assert.equal(r.values.pnl, 290);
  });

  it('净值为 0 报错', () => {
    const r = validatePortfolioValues({}, 0, 1000, 1.2, 10);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('净值异常')));
  });

  it('份额为负报错', () => {
    const r = validatePortfolioValues({}, 1.5, -100, 1.2, 10);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('份额异常')));
  });

  it('成本价为 0 报错', () => {
    const r = validatePortfolioValues({}, 1.5, 1000, 0, 10);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('成本价异常')));
  });

  it('收益率超 300% 报异常', () => {
    const r = validatePortfolioValues({}, 5.0, 1000, 0.01, 0);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('收益率异常')));
  });

  it('收益率为负且合理返回 valid', () => {
    const r = validatePortfolioValues({}, 1.0, 1000, 1.5, 0);
    assert.equal(r.valid, true);
    assert.equal(r.values.pnl, -500);
    assert.ok(r.values.pnlPercent < 0);
  });
});

describe('classifyGoldCategory', () => {
  it('纳斯达克 → QDII-美股', () => {
    assert.equal(classifyGoldCategory('纳斯达克100ETF', '', ''), 'QDII-美股');
  });
  it('标普 → QDII-美股', () => {
    assert.equal(classifyGoldCategory('标普500', '', ''), 'QDII-美股');
  });
  it('沪深300 → 宽基-沪深300', () => {
    assert.equal(classifyGoldCategory('沪深300ETF', '', ''), '宽基-沪深300');
  });
  it('医药 → 行业-医药', () => {
    assert.equal(classifyGoldCategory('医药健康', '', ''), '行业-医药');
  });
  it('半导体 → 行业-半导体', () => {
    assert.equal(classifyGoldCategory('半导体芯片ETF', '', ''), '行业-半导体');
  });
  it('黄金 → 行业-黄金', () => {
    assert.equal(classifyGoldCategory('黄金ETF', '', ''), '行业-黄金');
  });
  it('债券 → 固收-债券', () => {
    assert.equal(classifyGoldCategory('信用债基金', '', ''), '固收-债券');
  });
  it('港股通 → QDII-港股', () => {
    assert.equal(classifyGoldCategory('港股通基金', '', ''), 'QDII-港股');
  });
  it('ETF联接 fallback → 指数-其他', () => {
    assert.equal(classifyGoldCategory('某未知基金', '', 'ETF联接'), '指数-其他');
  });
  it('默认 → 混合-主动', () => {
    assert.equal(classifyGoldCategory('某未知基金', '', ''), '混合-主动');
  });
  it('大小写不敏感 (nasdaq)', () => {
    assert.equal(classifyGoldCategory('Nasdaq100', '', ''), 'QDII-美股');
  });
});

describe('inferIndustry', () => {
  it('QDII-美股 + 纳斯达克 → 纳斯达克100', () => {
    assert.equal(inferIndustry('纳斯达克100', 'QDII-美股'), '纳斯达克100');
  });
  it('宽基-沪深300 → 沪深300', () => {
    assert.equal(inferIndustry('沪深300ETF', '宽基-沪深300'), '沪深300');
  });
  it('行业-半导体 → 半导体/芯片', () => {
    assert.equal(inferIndustry('芯片ETF', '行业-半导体'), '半导体/芯片');
  });
  it('行业-白酒 → 消费', () => {
    assert.equal(inferIndustry('白酒基金', '行业-白酒'), '消费');
  });
  it('混合-主动 → 混合', () => {
    assert.equal(inferIndustry('某混合基金', '混合-主动'), '混合');
  });
  it('未知分类 → 其他', () => {
    assert.equal(inferIndustry('某基金', '未知'), '其他');
  });
});

describe('estimateRating', () => {
  it('低费率 + 高收益 + 大规模 → 高评级', () => {
    const r = estimateRating(0.5, 25, 20);
    assert.ok(r >= 4);
  });
  it('高费率 + 亏损 + 小规模 → 低评级', () => {
    const r = estimateRating(1.5, -15, 0.5);
    assert.ok(r <= 2);
  });
  it('中等参数 → 中等评级', () => {
    const r = estimateRating(0.8, 5, 5);
    assert.ok(r >= 2 && r <= 4);
  });
  it('评级范围 1-5', () => {
    assert.ok(estimateRating(0.1, 100, 100) >= 1 && estimateRating(0.1, 100, 100) <= 5);
    assert.ok(estimateRating(2, -50, 0.1) >= 1 && estimateRating(2, -50, 0.1) <= 5);
  });
  it('null 收益率不影响评分', () => {
    const r = estimateRating(0.5, null, 20);
    assert.ok(r >= 3);
  });
});
