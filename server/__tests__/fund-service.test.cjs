'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const Module = require('module');

process.env.NODE_ENV = 'test';

// ===== Mock 数据库池 =====
// queryImpl 可在每个测试中重新赋值以控制返回结果
let queryImpl = null;
const queries = []; // 记录所有 pool.query 调用 { sql, params }

const mockPool = {
  query: async (sql, params) => {
    // 保存 params 副本，避免被调用方后续 mutate 污染记录
    queries.push({ sql, params: params ? params.slice() : params });
    if (queryImpl) return queryImpl(sql, params);
    return { rows: [] };
  },
};
global.mockPool = mockPool;

// ===== require 重写：db / logger / axios 指向 mock =====
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent) {
  if (request === '../db.cjs' || request === './db.cjs') {
    return require.resolve('./mock-db.cjs');
  }
  if (request === '../utils/logger.cjs' || request === './utils/logger.cjs') {
    return require.resolve('./mock-logger.cjs');
  }
  if (request === 'axios') {
    return require.resolve('./mock-axios.cjs');
  }
  return originalResolveFilename.apply(this, arguments);
};

// 确保 mock-db.cjs 导出指向 global.mockPool
fs.writeFileSync(
  path.join(__dirname, 'mock-db.cjs'),
  `module.exports = { getPool: () => global.mockPool };`
);

const mockAxios = require('./mock-axios.cjs');

// 加载被测模块（此时其内部 require('./db.cjs') / logger / axios 均被重定向）
const {
  getAllFunds,
  getFundByCode,
  getFundsByType,
  getFundsByIndustry,
  getIndustries,
  getAllFundsWithNav,
  queryFundsForScoring,
  batchFetchReturns,
  updateFundNav,
  updateFundReturns,
  getLatestNav,
  getMarketIndices,
  getUsIndices,
  updateMarketIndex,
  initMarketIndices,
  getSectorData,
  updateSectorData,
  seedFunds,
  updateFundManagers,
  updateFundDetail,
  getManagers,
  getFundCount,
  getHS300FundDetails,
  updateHS300FundDetail,
  batchUpdateHS300FundDetails,
} = require('../fund-service.cjs');

// 构造一行 funds 表数据（数据库字段名）
function fundRow(over = {}) {
  return Object.assign({
    code: '000001', name: '测试基金', type: '混合', industry: '消费',
    index_name: null, management_fee: '1.5', custody_fee: '0.2', service_fee: '0.3',
    total_fee: '2.0', scale: '10.5', rating: 4, buy_suggestion: '建议定投',
    valuation: '偏低估', trend: '上升', logic: '逻辑', is_gold_selected: true,
    daily_limit: 10000, manager: '张三',
  }, over);
}

beforeEach(() => {
  queries.length = 0;
  queryImpl = null;
  mockAxios.__reset();
});

// ========== getAllFunds ==========
describe('getAllFunds', () => {
  it('无过滤返回 formatFund 映射数组', async () => {
    queryImpl = () => ({ rows: [fundRow({ code: '000001' }), fundRow({ code: '000002', management_fee: '0.5' })] });
    const r = await getAllFunds();
    assert.equal(r.length, 2);
    assert.equal(r[0].code, '000001');
    assert.equal(r[0].name, '测试基金');
    assert.equal(r[0].managementFee, 1.5);
    assert.equal(r[0].custodyFee, 0.2);
    assert.equal(r[0].totalFee, 2.0);
    assert.equal(r[0].scale, 10.5);
    assert.equal(r[0].isGoldSelected, true);
    assert.equal(r[0].manager, '张三');
    assert.equal(r[0].nav, null); // formatFund 中 nav 固定 null
    assert.equal(r[0].return1y, null);
    assert.ok(queries[0].sql.includes("code ~ '^[0-9]{6}$'"));
  });

  it('industry 过滤追加参数', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ industry: '医药' });
    assert.ok(queries[0].sql.includes('AND industry = $1'));
    assert.deepEqual(queries[0].params, ['医药']);
  });

  it('普通 type 过滤追加参数', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ type: '债券' });
    assert.ok(queries[0].sql.includes('AND type = $1'));
    assert.deepEqual(queries[0].params, ['债券']);
  });

  it('QDII type 用前缀+名称兜底，不增加参数', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ type: 'QDII' });
    assert.ok(queries[0].sql.includes("type LIKE 'QDII%' OR name LIKE '%QDII%'"));
    assert.deepEqual(queries[0].params, []);
  });

  it('search 过滤追加 ILIKE 参数', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ search: '沪深' });
    assert.ok(queries[0].sql.includes('code ILIKE $1 OR name ILIKE $1'));
    assert.deepEqual(queries[0].params, ['%沪深%']);
  });

  it('多过滤组合参数索引递增', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ industry: '医药', type: '债券', search: '健康' });
    assert.deepEqual(queries[0].params, ['医药', '债券', '%健康%']);
  });

  it('sort + order 追加 ORDER BY', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ sort: 'totalFee', order: 'asc' });
    assert.ok(queries[0].sql.includes('ORDER BY total_fee ASC'));
  });

  it('sort 默认 order 为 DESC', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ sort: 'scale' });
    assert.ok(queries[0].sql.includes('ORDER BY scale DESC'));
  });

  it('未知 sort 字段不追加 ORDER BY', async () => {
    queryImpl = () => ({ rows: [] });
    await getAllFunds({ sort: 'unknown' });
    assert.ok(!queries[0].sql.includes('ORDER BY'));
  });

  it('费率字段非数字时回退 0', async () => {
    queryImpl = () => ({ rows: [fundRow({ management_fee: undefined, scale: null })] });
    const r = await getAllFunds();
    assert.equal(r[0].managementFee, 0);
    assert.equal(r[0].scale, 0);
  });

  it('manager 为 undefined 时映射为 null', async () => {
    queryImpl = () => ({ rows: [fundRow({ manager: undefined })] });
    const r = await getAllFunds();
    assert.equal(r[0].manager, null);
  });
});

// ========== getFundByCode ==========
describe('getFundByCode', () => {
  it('找到返回 formatFund', async () => {
    queryImpl = () => ({ rows: [fundRow()] });
    const r = await getFundByCode('000001');
    assert.equal(r.code, '000001');
    assert.equal(r.name, '测试基金');
  });

  it('未找到返回 null', async () => {
    queryImpl = () => ({ rows: [] });
    const r = await getFundByCode('999999');
    assert.equal(r, null);
  });

  it('传递 code 作为参数', async () => {
    queryImpl = () => ({ rows: [] });
    await getFundByCode('123456');
    assert.deepEqual(queries[0].params, ['123456']);
  });
});

// ========== getFundsByType ==========
describe('getFundsByType', () => {
  it('按 type 查询并映射', async () => {
    queryImpl = () => ({ rows: [fundRow({ type: '债券' })] });
    const r = await getFundsByType('债券');
    assert.equal(r.length, 1);
    assert.equal(r[0].type, '债券');
    assert.deepEqual(queries[0].params, ['债券']);
  });
});

// ========== getFundsByIndustry ==========
describe('getFundsByIndustry', () => {
  it('按 industry 查询并映射', async () => {
    queryImpl = () => ({ rows: [fundRow({ industry: '医药' })] });
    const r = await getFundsByIndustry('医药');
    assert.equal(r[0].industry, '医药');
    assert.deepEqual(queries[0].params, ['医药']);
  });
});

// ========== getIndustries ==========
describe('getIndustries', () => {
  it('返回行业名数组', async () => {
    queryImpl = () => ({ rows: [{ industry: '医药' }, { industry: '消费' }] });
    const r = await getIndustries();
    assert.deepEqual(r, ['医药', '消费']);
  });
});

// ========== getAllFundsWithNav ==========
describe('getAllFundsWithNav', () => {
  function navRow(over = {}) {
    return Object.assign({
      code: '000001', name: '测试', type: '混合', industry: '消费', index_name: null,
      management_fee: '1.5', custody_fee: '0.2', service_fee: '0.3', total_fee: '2.0',
      scale: '10', rating: 4, buy_suggestion: '', valuation: '', trend: '', logic: '',
      is_gold_selected: false, daily_limit: 0, manager: '',
      institution_hold: '30.5', individual_hold: '69.5',
      nav: '1.234', total_nav: '2.5', nav_date: '2024-01-01',
      return_1w: '0.5', return_1m: '1.0', return_3m: '3.0', return_6m: '6.0', return_1y: '12.0',
    }, over);
  }

  it('无过滤执行 count+data 查询并映射字段', async () => {
    queryImpl = (sql) => {
      if (sql.includes('COUNT')) return { rows: [{ count: '1' }] };
      return { rows: [navRow()] };
    };
    const r = await getAllFundsWithNav();
    assert.equal(r.total, 1);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].code, '000001');
    assert.equal(r.data[0].nav, 1.234);
    assert.equal(r.data[0].return1y, 12.0);
    assert.equal(r.data[0].institutionHold, 30.5);
    assert.equal(r.data[0].individualHold, 69.5);
    assert.equal(r.page, 1);
    assert.equal(r.pageSize, 100);
    assert.equal(r.totalPages, 1);
    assert.equal(queries.length, 2); // count + data
  });

  it('无过滤时命中缓存不再查询', async () => {
    let n = 0;
    queryImpl = (sql) => {
      n++;
      if (sql.includes('COUNT')) return { rows: [{ count: '0' }] };
      return { rows: [] };
    };
    await getAllFundsWithNav({ pageSize: 7777 }); // 唯一 pageSize 避免与其他测试缓存冲突
    const firstQueries = n;
    await getAllFundsWithNav({ pageSize: 7777 });
    assert.equal(n, firstQueries); // 第二次命中缓存，未查询
  });

  it('带过滤时不缓存（每次都查询）', async () => {
    let n = 0;
    queryImpl = (sql) => {
      n++;
      if (sql.includes('COUNT')) return { rows: [{ count: '0' }] };
      return { rows: [] };
    };
    await getAllFundsWithNav({ industry: '医药' });
    await getAllFundsWithNav({ industry: '医药' });
    assert.equal(n, 4); // 两次各 2 查询
  });

  it('industry 过滤追加参数', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ industry: '医药' });
    assert.deepEqual(queries[0].params, ['医药']);
    assert.deepEqual(queries[1].params.slice(0, 1), ['医药']);
  });

  it('QDII type 用前缀兜底', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ type: 'QDII' });
    assert.ok(queries[1].sql.includes("type LIKE 'QDII%'"));
  });

  it('manager 过滤', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ manager: '张三' });
    // 经理名走模糊匹配（ILIKE 包含式），与 fund-service.cjs 的实现保持一致
    assert.ok(queries[1].sql.includes('AND manager ILIKE'));
    assert.ok(queries[1].params.includes('%张三%'));
  });

  it('goldOnly 过滤', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ goldOnly: true });
    assert.ok(queries[1].sql.includes('is_gold_selected = true'));
  });

  it('排序 return1y asc', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ sort: 'return1y', order: 'asc', industry: 'x' });
    assert.ok(queries[1].sql.includes('ORDER BY return_1y ASC NULLS LAST'));
  });

  it('默认排序按 code', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ industry: 'x' });
    assert.ok(queries[1].sql.includes('ORDER BY code'));
  });

  it('分页计算 offset 与 totalPages', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '25' }] } : { rows: [] });
    const r = await getAllFundsWithNav({ page: '2', pageSize: '10', industry: 'x' });
    assert.equal(r.page, 2);
    assert.equal(r.pageSize, 10);
    assert.equal(r.totalPages, 3); // ceil(25/10)
    assert.equal(queries[1].params[queries[1].params.length - 1], 10); // offset=10
  });

  it('pageSize 上限 15000', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    const r = await getAllFundsWithNav({ pageSize: '99999', industry: 'x' });
    assert.equal(r.pageSize, 15000);
  });

  it('nav 为 null 时映射为 null', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '1' }] } : { rows: [navRow({ nav: null, return_1y: null, institution_hold: null })] });
    const r = await getAllFundsWithNav({ industry: 'x' });
    assert.equal(r.data[0].nav, null);
    assert.equal(r.data[0].return1y, null);
    assert.equal(r.data[0].institutionHold, null);
  });

  it('普通 type 过滤追加参数', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ type: '债券' });
    assert.ok(queries[1].sql.includes('AND type = $1'));
    assert.deepEqual(queries[0].params, ['债券']);
  });

  it('search 过滤追加 ILIKE 参数', async () => {
    queryImpl = (sql) => (sql.includes('COUNT') ? { rows: [{ count: '0' }] } : { rows: [] });
    await getAllFundsWithNav({ search: '沪深' });
    assert.ok(queries[1].sql.includes('code ILIKE $1 OR name ILIKE $1'));
    assert.deepEqual(queries[0].params, ['%沪深%']);
  });

  it('缓存超过 20 个 key 时淘汰最旧条目', async () => {
    let n = 0;
    queryImpl = (sql) => {
      n++;
      if (sql.includes('COUNT')) return { rows: [{ count: '0' }] };
      return { rows: [] };
    };
    // 填充 25 个不同缓存 key，触发 LRU 淘汰
    for (let i = 1; i <= 25; i++) {
      await getAllFundsWithNav({ pageSize: 9000 + i });
    }
    // 最早插入的 pageSize 已被淘汰，再次调用应重新查询
    const before = n;
    await getAllFundsWithNav({ pageSize: 9001 });
    assert.ok(n > before, '被淘汰的 key 应重新查询');
  });
});

// ========== queryFundsForScoring ==========
describe('queryFundsForScoring', () => {
  it('无过滤返回原始 rows', async () => {
    const rows = [{ code: '000001', nav: '1.0' }];
    queryImpl = () => ({ rows });
    const r = await queryFundsForScoring();
    assert.deepEqual(r, rows);
  });

  it('industry/type/requireReturn1y 过滤', async () => {
    queryImpl = () => ({ rows: [] });
    await queryFundsForScoring({ industry: '医药', type: '债券', requireReturn1y: true });
    assert.ok(queries[0].sql.includes('f.industry = $1'));
    assert.ok(queries[0].sql.includes('f.type = $2'));
    assert.ok(queries[0].sql.includes('n.return_1y IS NOT NULL'));
    assert.deepEqual(queries[0].params, ['医药', '债券']);
  });
});

// ========== batchFetchReturns ==========
describe('batchFetchReturns', () => {
  it('未缓存时调用 API 并解析收益率', async () => {
    mockAxios.__setResponse({ data: "var syl_1n='15.23';var syl_6y='8.10';var syl_3y='4.50';var syl_1y='1.20';" });
    const r = await batchFetchReturns(['100001']);
    assert.equal(r.get('100001').return1y, 15.23);
    assert.equal(r.get('100001').return6m, 8.1);
    assert.equal(r.get('100001').return3m, 4.5);
    assert.equal(r.get('100001').return1m, 1.2);
    assert.equal(mockAxios.__getCalls().length, 1);
    assert.ok(mockAxios.__getCalls()[0].url.includes('100001.js'));
  });

  it('API 抛错返回 null 且不缓存', async () => {
    mockAxios.__setError(new Error('timeout'));
    const r = await batchFetchReturns(['200001']);
    assert.equal(r.get('200001'), null);
  });

  it('命中缓存不再调用 API', async () => {
    mockAxios.__setResponse({ data: "syl_1n='10.0'" });
    await batchFetchReturns(['300001']);
    const callsAfterFirst = mockAxios.__getCalls().length;
    const r = await batchFetchReturns(['300001']);
    assert.equal(mockAxios.__getCalls().length, callsAfterFirst);
    assert.equal(r.get('300001').return1y, 10.0);
  });

  it('部分缓存只 fetch 未缓存项', async () => {
    mockAxios.__setResponse({ data: "syl_1n='5.0'" });
    await batchFetchReturns(['400001']); // 缓存 400001
    const callsBefore = mockAxios.__getCalls().length;
    await batchFetchReturns(['400001', '400002']);
    assert.equal(mockAxios.__getCalls().length - callsBefore, 1);
    assert.ok(mockAxios.__getCalls()[callsBefore].url.includes('400002.js'));
  });

  it('并发批处理每批 5 个（7 个 code 触发 2 批）', async () => {
    mockAxios.__setResponse({ data: "syl_1n='1.0'" });
    const codes = ['500001', '500002', '500003', '500004', '500005', '500006', '500007'];
    const r = await batchFetchReturns(codes);
    assert.equal(r.size, 7);
    assert.equal(mockAxios.__getCalls().length, 7);
  });

  it('resp.data 为空字符串时各字段为 null', async () => {
    mockAxios.__setResponse({ data: '' });
    const r = await batchFetchReturns(['600001']);
    assert.equal(r.get('600001').return1y, null);
    assert.equal(r.get('600001').return6m, null);
  });
});

// ========== updateFundNav ==========
describe('updateFundNav', () => {
  it('执行 INSERT 并传递参数', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundNav('000001', {
      nav: '1.5', totalNav: '2.0', navDate: '2024-01-01',
      return1w: '0.1', return1m: '0.2', return3m: '0.3', return6m: '0.4', return1y: '0.5',
    });
    assert.ok(queries[0].sql.includes('INSERT INTO fund_nav'));
    assert.ok(queries[0].sql.includes('ON CONFLICT'));
    assert.deepEqual(queries[0].params, ['000001', '1.5', '2.0', '2024-01-01', '0.1', '0.2', '0.3', '0.4', '0.5']);
  });

  it('缺失字段以 null 填充', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundNav('000002', { nav: '1.0', navDate: '2024-01-01' });
    assert.deepEqual(queries[0].params, ['000002', '1.0', null, '2024-01-01', null, null, null, null, null]);
  });
});

// ========== updateFundReturns ==========
describe('updateFundReturns', () => {
  it('执行 UPDATE 并传递参数', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundReturns('000001', { return1w: '0.1', return1m: '0.2', return3m: '0.3', return6m: '0.4', return1y: '0.5' });
    assert.ok(queries[0].sql.includes('UPDATE fund_nav'));
    assert.deepEqual(queries[0].params, ['000001', '0.1', '0.2', '0.3', '0.4', '0.5']);
  });

  it('缺失字段以 null 填充', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundReturns('000002', { return1y: '0.5' });
    assert.deepEqual(queries[0].params, ['000002', null, null, null, null, '0.5']);
  });
});

// ========== getLatestNav ==========
describe('getLatestNav', () => {
  it('找到返回映射对象', async () => {
    queryImpl = () => ({ rows: [{ nav: '1.234', total_nav: '2.5', nav_date: '2024-01-01', return_1w: '0.5', return_1m: '1.0', return_3m: '3.0', return_6m: '6.0', return_1y: '12.0' }] });
    const r = await getLatestNav('000001');
    assert.equal(r.nav, 1.234);
    assert.equal(r.totalNav, 2.5);
    assert.equal(r.navDate, '2024-01-01');
    assert.equal(r.return1y, 12.0);
  });

  it('未找到返回 null', async () => {
    queryImpl = () => ({ rows: [] });
    const r = await getLatestNav('999999');
    assert.equal(r, null);
  });

  it('total_nav 为 null 时映射为 null', async () => {
    queryImpl = () => ({ rows: [{ nav: '1.0', total_nav: null, nav_date: 'd', return_1w: null, return_1m: null, return_3m: null, return_6m: null, return_1y: null }] });
    const r = await getLatestNav('000003');
    assert.equal(r.totalNav, null);
    assert.equal(r.return1y, null);
  });
});

// ========== getMarketIndices ==========
describe('getMarketIndices', () => {
  it('映射字段并排除 . 开头 code', async () => {
    queryImpl = () => ({ rows: [{ code: '000300', name: '沪深300', price: '4000', change_amount: '10', change_percent: '0.25', pe: '12.5', pb: '1.4', pe_percentile: '30', pb_percentile: '40', valuation: '偏低估', suggestion: '定投', updated_at: '2024-01-01' }] });
    const r = await getMarketIndices();
    assert.equal(r[0].code, '000300');
    assert.equal(r[0].price, 4000);
    assert.equal(r[0].change, 10);
    assert.equal(r[0].changePercent, 0.25);
    assert.equal(r[0].pe, 12.5);
    assert.equal(r[0].pePercentile, 30);
    assert.equal(r[0].dataDate, '2024-01-01');
    assert.ok(queries[0].sql.includes("code NOT LIKE '.%'"));
  });

  it('price 为 null 时映射为 null', async () => {
    queryImpl = () => ({ rows: [{ code: '000300', name: 'x', price: null, change_amount: null, change_percent: null, pe: null, pb: null, pe_percentile: null, pb_percentile: null, valuation: null, suggestion: null, updated_at: null }] });
    const r = await getMarketIndices();
    assert.equal(r[0].price, null);
    assert.equal(r[0].pe, null);
  });
});

// ========== getUsIndices ==========
describe('getUsIndices', () => {
  it('映射字段，pe/pb 强制为 null', async () => {
    queryImpl = () => ({ rows: [{ code: '.DJI', name: '道琼斯', price: '38000', change_amount: '100', change_percent: '0.3', valuation: '合理', suggestion: '观望', updated_at: '2024-01-01' }] });
    const r = await getUsIndices();
    assert.equal(r[0].code, '.DJI');
    assert.equal(r[0].price, 38000);
    assert.equal(r[0].pe, null);
    assert.equal(r[0].pb, null);
    assert.equal(r[0].pePercentile, null);
    assert.ok(queries[0].sql.includes("code LIKE '.%'"));
  });
});

// ========== updateMarketIndex ==========
describe('updateMarketIndex', () => {
  it('执行 INSERT 并传递参数', async () => {
    queryImpl = () => ({ rows: [] });
    await updateMarketIndex('000300', { name: '沪深300', price: 4000, change: 10, changePercent: 0.25, pe: 12.5, pb: 1.4, pePercentile: 30, pbPercentile: 40, valuation: '低', suggestion: '定投' });
    assert.ok(queries[0].sql.includes('INSERT INTO market_indices'));
    assert.deepEqual(queries[0].params, ['000300', '沪深300', 4000, 10, 0.25, 12.5, 1.4, 30, 40, '低', '定投']);
  });

  it('可选字段缺失以 null 填充', async () => {
    queryImpl = () => ({ rows: [] });
    await updateMarketIndex('.DJI', { name: '道琼斯', price: 38000, change: 100, changePercent: 0.3 });
    assert.deepEqual(queries[0].params, ['.DJI', '道琼斯', 38000, 100, 0.3, null, null, null, null, null, null]);
  });
});

// ========== initMarketIndices ==========
describe('initMarketIndices', () => {
  it('循环插入每个指数', async () => {
    queryImpl = () => ({ rows: [] });
    await initMarketIndices([
      { code: '000300', name: '沪深300', valuation: '低', suggestion: '定投' },
      { code: '000905', name: '中证500', valuation: '中', suggestion: '观望' },
    ]);
    assert.equal(queries.length, 2);
    assert.ok(queries[0].sql.includes('ON CONFLICT (code) DO NOTHING'));
    assert.deepEqual(queries[0].params, ['000300', '沪深300', '低', '定投']);
    assert.deepEqual(queries[1].params, ['000905', '中证500', '中', '观望']);
  });

  it('空数组不查询', async () => {
    queryImpl = () => ({ rows: [] });
    await initMarketIndices([]);
    assert.equal(queries.length, 0);
  });
});

// ========== getSectorData ==========
describe('getSectorData', () => {
  it('映射字段', async () => {
    queryImpl = () => ({ rows: [{ name: '医药', change_percent: '1.5', volume: '1000', leading_stock: '恒瑞', trade_date: '2024-01-01' }] });
    const r = await getSectorData();
    assert.equal(r[0].name, '医药');
    assert.equal(r[0].change, 1.5);
    assert.equal(r[0].volume, '1000');
    assert.equal(r[0].leadingStock, '恒瑞');
    assert.equal(r[0].dataDate, '2024-01-01');
    assert.ok(queries[0].sql.includes('MAX(trade_date)'));
  });

  it('change_percent 非数字回退 0', async () => {
    queryImpl = () => ({ rows: [{ name: 'x', change_percent: null, volume: null, leading_stock: null, trade_date: null }] });
    const r = await getSectorData();
    assert.equal(r[0].change, 0);
  });
});

// ========== updateSectorData ==========
describe('updateSectorData', () => {
  it('循环插入并使用今天日期', async () => {
    queryImpl = () => ({ rows: [] });
    await updateSectorData([{ name: '医药', change: 1.5, volume: '1000', leadingStock: '恒瑞' }]);
    const today = new Date().toISOString().split('T')[0];
    assert.ok(queries[0].sql.includes('INSERT INTO sector_data'));
    assert.deepEqual(queries[0].params, ['医药', 1.5, '1000', '恒瑞', today]);
  });
});

// ========== seedFunds ==========
describe('seedFunds', () => {
  it('全部成功插入', async () => {
    queryImpl = () => ({ rows: [] });
    await seedFunds([
      { code: '000001', name: 'A', type: '混合', industry: '消费' },
      { code: '000002', name: 'B', type: '债券', industry: '固收' },
      { code: '000003', name: 'C', type: '指数', industry: '宽基' },
    ]);
    assert.equal(queries.length, 3);
    assert.ok(queries[0].sql.includes('INSERT INTO funds'));
  });

  it('单只基金首次失败后重试成功', async () => {
    let call = 0;
    queryImpl = () => {
      call++;
      if (call === 1) throw new Error('dup');
      return { rows: [] };
    };
    await seedFunds([{ code: '000001', name: 'A' }, { code: '000002', name: 'B' }]);
    // fund1: retry0 fail + retry1 success = 2 calls; fund2: 1 call
    assert.equal(queries.length, 3);
  });

  it('连续失败达到阈值后停止插入', async () => {
    queryImpl = () => { throw new Error('db down'); };
    await seedFunds([
      { code: '000001', name: 'A' }, { code: '000002', name: 'B' },
      { code: '000003', name: 'C' }, { code: '000004', name: 'D' },
      { code: '000005', name: 'E' }, { code: '000006', name: 'F' },
    ]);
    // fund1: 2 fails (cf=2), fund2: 2 fails (cf=4), fund3: 2 fails (cf=6), fund4: cf>=5 break
    assert.equal(queries.length, 6);
  });

  it('超时后停止插入', async () => {
    const realDateNow = Date.now;
    let call = 0;
    Date.now = () => {
      call++;
      if (call === 1) return 0; // startTime
      return 31000;             // 后续均超时
    };
    try {
      queryImpl = () => ({ rows: [] });
      await seedFunds([{ code: '000001', name: 'A' }, { code: '000002', name: 'B' }]);
      assert.equal(queries.length, 0); // 第一个 fund 顶部即超时 break
    } finally {
      Date.now = realDateNow;
    }
  });

  it('is_gold_selected 参数位置正确', async () => {
    queryImpl = () => ({ rows: [] });
    await seedFunds([{ code: '000001', name: 'A', isGoldSelected: true }]);
    assert.ok(queries[0].sql.includes('is_gold_selected = EXCLUDED.is_gold_selected OR funds.is_gold_selected'));
    assert.equal(queries[0].params[15], true); // isGoldSelected 是第 16 个参数
  });

  it('缺失字段使用默认值', async () => {
    queryImpl = () => ({ rows: [] });
    await seedFunds([{ code: '000001', name: 'A' }]);
    assert.equal(queries[0].params[5], 0);  // managementFee || 0
    assert.equal(queries[0].params[10], 3); // rating || 3
    assert.equal(queries[0].params[15], false); // isGoldSelected || false
  });
});

// ========== updateFundManagers ==========
describe('updateFundManagers', () => {
  it('空 map 直接返回不查询', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundManagers({});
    assert.equal(queries.length, 0);
  });

  it('正常更新执行批量 UPDATE', async () => {
    queryImpl = () => ({ rows: [], rowCount: 2 });
    await updateFundManagers({ '000001': '张三', '000002': '李四' });
    assert.equal(queries.length, 1);
    assert.ok(queries[0].sql.includes('UPDATE funds SET manager'));
    assert.deepEqual(queries[0].params[0], ['000001', '000002']);
    assert.deepEqual(queries[0].params[1], ['张三', '李四']);
  });

  it('异常时捕获不抛出', async () => {
    queryImpl = () => { throw new Error('batch fail'); };
    await assert.doesNotReject(() => updateFundManagers({ '000001': '张三' }));
  });
});

// ========== updateFundDetail ==========
describe('updateFundDetail', () => {
  it('根据 detail 字段动态构建 SET', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundDetail('000001', { manager: '张三', managementFee: 1.5, scale: 10 });
    assert.ok(queries[0].sql.includes('manager = $1'));
    assert.ok(queries[0].sql.includes('management_fee = $2'));
    assert.ok(queries[0].sql.includes('scale = $3'));
    assert.ok(queries[0].sql.includes('updated_at = NOW()'));
    assert.deepEqual(queries[0].params, ['张三', 1.5, 10, '000001']);
  });

  it('空 detail 直接返回不查询', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundDetail('000001', {});
    assert.equal(queries.length, 0);
  });

  it('仅传 buySuggestion', async () => {
    queryImpl = () => ({ rows: [] });
    await updateFundDetail('000002', { buySuggestion: '加仓' });
    assert.ok(queries[0].sql.includes('buy_suggestion = $1'));
    assert.deepEqual(queries[0].params, ['加仓', '000002']);
  });
});

// ========== getManagers ==========
describe('getManagers', () => {
  it('映射并解析 fundCount', async () => {
    queryImpl = () => ({ rows: [{ manager: '张三', fund_count: '5' }, { manager: '李四', fund_count: '3' }] });
    const r = await getManagers();
    assert.equal(r[0].name, '张三');
    assert.equal(r[0].fundCount, 5);
    assert.equal(r[1].fundCount, 3);
  });
});

// ========== getFundCount ==========
describe('getFundCount', () => {
  it('返回 parseInt 后的计数', async () => {
    queryImpl = () => ({ rows: [{ count: '123' }] });
    const r = await getFundCount();
    assert.equal(r, 123);
  });
});

// ========== getHS300FundDetails ==========
describe('getHS300FundDetails', () => {
  it('映射字段', async () => {
    queryImpl = () => ({ rows: [{ fund_code: '510300', fund_name: '沪深300ETF', fund_type: '指数', is_enhanced: false, purchase_fee: '0.12', purchase_fee_original: '1.0', alpha: '0.5', management_fee: '0.5', custody_fee: '0.1', total_fee: '0.6', scale: '100', rating: 5 }] });
    const r = await getHS300FundDetails();
    assert.equal(r[0].code, '510300');
    assert.equal(r[0].name, '沪深300ETF');
    assert.equal(r[0].isEnhanced, false);
    assert.equal(r[0].purchaseFee, 0.12);
    assert.equal(r[0].alpha, 0.5);
    assert.ok(queries[0].sql.includes('ORDER BY fund_code'));
  });
});

// ========== updateHS300FundDetail ==========
describe('updateHS300FundDetail', () => {
  it('执行 INSERT 并传递参数', async () => {
    queryImpl = () => ({ rows: [] });
    await updateHS300FundDetail('510300', { name: '沪深300ETF', type: '指数', isEnhanced: false, purchaseFee: 0.12, purchaseFeeOriginal: 1.0, alpha: 0.5, managementFee: 0.5, custodyFee: 0.1, totalFee: 0.6, scale: 100, rating: 5 });
    assert.ok(queries[0].sql.includes('INSERT INTO hs300_fund_details'));
    assert.deepEqual(queries[0].params, ['510300', '沪深300ETF', '指数', false, 0.12, 1.0, 0.5, 0.5, 0.1, 0.6, 100, 5]);
  });

  it('缺失字段使用默认值', async () => {
    queryImpl = () => ({ rows: [] });
    await updateHS300FundDetail('510300', { name: 'X', type: '指数' });
    assert.deepEqual(queries[0].params, ['510300', 'X', '指数', false, 0, 0, 0, 0, 0, 0, 0, 3]);
  });
});

// ========== batchUpdateHS300FundDetails ==========
describe('batchUpdateHS300FundDetails', () => {
  it('全部成功返回更新数', async () => {
    queryImpl = () => ({ rows: [] });
    const r = await batchUpdateHS300FundDetails([
      { code: '510300', name: 'A', type: '指数' },
      { code: '510310', name: 'B', type: '指数' },
    ]);
    assert.equal(r, 2);
    assert.equal(queries.length, 2);
  });

  it('部分失败返回成功数', async () => {
    let call = 0;
    queryImpl = () => {
      call++;
      if (call === 1) throw new Error('fail');
      return { rows: [] };
    };
    const r = await batchUpdateHS300FundDetails([
      { code: '510300', name: 'A', type: '指数' },
      { code: '510310', name: 'B', type: '指数' },
    ]);
    assert.equal(r, 1);
  });
});
