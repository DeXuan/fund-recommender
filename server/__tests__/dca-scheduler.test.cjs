'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getDcaExecutionDates } = require('../utils/dca-scheduler.cjs');

// 用本地时区格式化（函数内部用本地 setMonth/setDate 操作日期，
// toISOString 的 UTC 转换会在 UTC+8 下偏移一天，导致断言失真）
const fmtLocal = (d) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

describe('getDcaExecutionDates', () => {
  it('月度定投：每月指定日执行', () => {
    const plan = { frequency: 'monthly', day_of_month: 5 };
    const dates = getDcaExecutionDates(plan, '2026-01-01', '2026-03-31');
    // start = 1月2日，所以 1月5日 也在范围内
    assert.deepEqual(dates.map(fmtLocal), ['2026-01-05', '2026-02-05', '2026-03-05']);
  });

  it('月度定投：day_of_month 缺省默认 1 号', () => {
    const plan = { frequency: 'monthly' };
    const dates = getDcaExecutionDates(plan, '2026-02-15', '2026-04-15');
    assert.deepEqual(dates.map(fmtLocal), ['2026-03-01', '2026-04-01']);
  });

  it('每周定投：每周指定星期执行', () => {
    // 2026-08-03 是周一；fromDate+1=8/4 起，周一为 8/10、8/17
    const plan = { frequency: 'weekly', day_of_week: 1 };
    const dates = getDcaExecutionDates(plan, '2026-08-03', '2026-08-23');
    assert.deepEqual(dates.map(fmtLocal), ['2026-08-10', '2026-08-17']);
  });

  it('每两周定投：间隔 14 天，跳过 start 之前的日期', () => {
    const plan = { frequency: 'biweekly', day_of_week: 1 };
    // fromDate=8-03 → start=8-04，首个周期起点 8-03 被跳过，从 8-17 起
    const dates = getDcaExecutionDates(plan, '2026-08-03', '2026-09-20');
    assert.deepEqual(dates.map(fmtLocal), ['2026-08-17', '2026-08-31', '2026-09-14']);
    // 相邻执行日期间隔固定 14 天
    for (let i = 1; i < dates.length; i++) {
      const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      assert.equal(diff, 14);
    }
  });

  it('季度定投：每 3 个月执行，跳过 start 之前的日期', () => {
    const plan = { frequency: 'quarterly', day_of_month: 1 };
    // fromDate=3-01 → start=3-02，第一个季度日 3-01 在 start 之前被跳过
    const dates = getDcaExecutionDates(plan, '2026-03-01', '2026-12-31');
    assert.deepEqual(dates.map(fmtLocal), ['2026-06-01', '2026-09-01', '2026-12-01']);
    // 相邻间隔 3 个月
    const months = dates.map(d => d.getMonth());
    assert.deepEqual(months, [5, 8, 11]);
  });

  it('未知频率返回空数组', () => {
    const plan = { frequency: 'daily' };
    assert.deepEqual(getDcaExecutionDates(plan, '2026-01-01', '2026-03-31'), []);
  });

  it('结束日期早于开始日期返回空', () => {
    const plan = { frequency: 'monthly', day_of_month: 1 };
    assert.deepEqual(getDcaExecutionDates(plan, '2026-06-01', '2026-01-01'), []);
  });
});
