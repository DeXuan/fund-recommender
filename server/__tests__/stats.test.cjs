'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  calcDailyReturns,
  calcMaxDrawdown,
  calcAnnualizedReturn,
  calcFullRiskMetrics,
  calcSimpleRiskMetrics,
} = require('../utils/stats.cjs');

describe('calcDailyReturns', () => {
  it('计算连续价格间的日收益率', () => {
    assert.deepEqual(calcDailyReturns([100, 110, 121]), [0.1, 0.1]);
  });

  it('跳过前值为 0 或负的区间（防御除零）', () => {
    // 第二段 100→110 正常计算，第一段 0→100 被跳过
    assert.deepEqual(calcDailyReturns([0, 100, 110]), [0.1]);
  });

  it('空数组与单元素返回空数组', () => {
    assert.deepEqual(calcDailyReturns([]), []);
    assert.deepEqual(calcDailyReturns([100]), []);
  });

  it('下跌时收益率为负', () => {
    assert.deepEqual(calcDailyReturns([100, 90]), [-0.1]);
  });
});

describe('calcMaxDrawdown', () => {
  it('单边上涨无回撤', () => {
    assert.equal(calcMaxDrawdown([100, 110, 120, 130]), 0);
  });

  it('识别历史峰值后的最大跌幅', () => {
    // 峰值 120，跌至 90 = (120-90)/120 = 25%
    assert.equal(calcMaxDrawdown([100, 120, 90, 110]), 25);
  });

  it('回撤在后续上涨后仍保留历史最大值', () => {
    // 峰值 100 → 跌到 80 (-20%)，然后涨到 150 → 跌到 120 (-20%)
    assert.equal(calcMaxDrawdown([100, 80, 150, 120]), 20);
  });

  it('空数组返回 0', () => {
    assert.equal(calcMaxDrawdown([]), 0);
  });
});

describe('calcAnnualizedReturn', () => {
  it('数据不足 200 天返回期间收益（按自然日折算）', () => {
    // 2 个数据点 → 1 个交易间隔 ≈ 1 自然日
    const r = calcAnnualizedReturn([100, 110]);
    assert.equal(r.annualizedReturn, 10);
    assert.equal(r.returnPeriod, '1天');
  });

  it('数据足够时年化并限幅', () => {
    // 201 天涨 10% → 年化
    const prices = [100];
    for (let i = 0; i < 201; i++) prices.push(100 * Math.pow(1.1, 1 / 200));
    const r = calcAnnualizedReturn(prices);
    assert.equal(r.returnPeriod, '年化');
    assert.ok(r.annualizedReturn > 0 && r.annualizedReturn < 100);
  });

  it('少于 2 个数据点返回 0', () => {
    assert.deepEqual(calcAnnualizedReturn([100]), { annualizedReturn: 0, returnPeriod: '' });
  });
});

describe('calcFullRiskMetrics', () => {
  it('数据不足 2 个返回全零默认值', () => {
    const r = calcFullRiskMetrics([100]);
    assert.equal(r.sharpeRatio, 0);
    assert.equal(r.maxDrawdown, 0);
    assert.equal(r.sortinoRatio, 0);
    assert.equal(r.winRate, 0);
  });

  it('单边上涨时胜率 100%，回撤 0', () => {
    const prices = [];
    for (let i = 0; i < 50; i++) prices.push(100 + i * 2);
    const r = calcFullRiskMetrics(prices);
    assert.equal(r.winRate, 100);
    assert.equal(r.maxDrawdown, 0);
    assert.ok(r.annualizedReturn > 0);
    assert.ok(r.volatility > 0);
  });

  it('单边下跌时胜率 0%，回撤等于累计跌幅', () => {
    const prices = [];
    for (let i = 0; i < 50; i++) prices.push(100 - i);
    const r = calcFullRiskMetrics(prices);
    assert.equal(r.winRate, 0);
    assert.ok(r.maxDrawdown > 0);
    assert.ok(r.annualizedReturn < 0);
  });

  it('指标范围限幅生效（sharpe 不超过 ±5/10）', () => {
    const prices = [];
    // 极端波动序列
    for (let i = 0; i < 100; i++) prices.push(100 + (i % 2 === 0 ? 50 : -50));
    const r = calcFullRiskMetrics(prices);
    assert.ok(r.sharpeRatio >= -5 && r.sharpeRatio <= 10);
    assert.ok(r.volatility >= 0 && r.volatility <= 200);
  });

  it('索提诺比率在数据 ≥20 天时计算', () => {
    const prices = [];
    for (let i = 0; i < 30; i++) prices.push(100 + i);
    const r = calcFullRiskMetrics(prices);
    // 单边上涨 → 下行波动为 0 → sortinoRatio = 0
    assert.equal(r.sortinoRatio, 0);
  });
});

describe('calcSimpleRiskMetrics', () => {
  it('数据不足 30 个净值返回 null', () => {
    assert.equal(calcSimpleRiskMetrics([100, 101, 102]), null);
  });

  it('30+ 个净值返回完整指标', () => {
    const navs = [];
    for (let i = 0; i < 40; i++) navs.push(100 + i);
    const r = calcSimpleRiskMetrics(navs);
    assert.ok(r);
    assert.ok(r.sharpe !== undefined);
    assert.ok(r.sortino !== undefined);
    assert.ok(r.calmar !== undefined);
    assert.equal(r.maxDrawdown, 0); // 单边上涨无回撤
    assert.equal(r.dataPoints, 39);
  });

  it('下跌序列产生负收益与正回撤', () => {
    const navs = [];
    for (let i = 0; i < 40; i++) navs.push(100 - i);
    const r = calcSimpleRiskMetrics(navs);
    assert.ok(r.maxDrawdown > 0);
    assert.ok(r.annualReturn < 0);
  });
});
