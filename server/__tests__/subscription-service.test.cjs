'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Mock the database module
let mockQueryResult = [];
let mockClientQueryResult = [];
let lastQuery = '';
let lastParams = [];
let transactionCommitted = false;
let transactionRolledBack = false;

const mockClient = {
  query: async (sql, params) => {
    lastQuery = sql;
    lastParams = params;
    if (sql === 'BEGIN') return;
    if (sql === 'COMMIT') { transactionCommitted = true; return; }
    if (sql === 'ROLLBACK') { transactionRolledBack = true; return; }
    return { rows: mockClientQueryResult };
  },
  release: () => {},
};

const mockPool = {
  query: async (sql, params) => {
    lastQuery = sql;
    lastParams = params;
    return { rows: mockQueryResult };
  },
  connect: async () => mockClient,
};

// Override require for db.cjs
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent) {
  if (request === '../db.cjs' || request === './db.cjs') {
    return require.resolve('./mock-db.cjs');
  }
  return originalResolveFilename.apply(this, arguments);
};

// Create mock db module
const mockDbPath = require('path').join(__dirname, 'mock-db.cjs');
require('fs').writeFileSync(mockDbPath, `module.exports = { getPool: () => mockPool };`);

// Now require the module under test
const {
  createOrder,
  getActiveSubscription,
  activateSubscription,
  activateByTradeNo,
  getPlans,
  getOrdersByUser,
} = require('../subscription-service.cjs');

// Make mockPool available to mock-db
global.mockPool = mockPool;
require('fs').writeFileSync(mockDbPath, `module.exports = { getPool: () => global.mockPool };`);

describe('subscription-service', () => {
  beforeEach(() => {
    mockQueryResult = [];
    mockClientQueryResult = [];
    lastQuery = '';
    lastParams = [];
    transactionCommitted = false;
    transactionRolledBack = false;
  });

  describe('createOrder', () => {
    it('should create order with correct parameters', async () => {
      mockQueryResult = [{ id: 1, name: '月度会员', price: 9.9 }];
      const planRes = { rows: [{ id: 1, name: '月度会员', price: 9.9 }] };
      mockPool.query = async (sql, params) => {
        lastQuery = sql;
        lastParams = params;
        if (sql.includes('subscription_plans')) return planRes;
        return { rows: [{ id: 100, plan_id: 1, out_trade_no: 'SUB_1_test', amount: 9.9, status: 'pending', plan_name: '月度会员' }] };
      };

      const result = await createOrder(1, 1);
      assert.ok(result.plan_name === '月度会员');
      assert.ok(lastQuery.includes('INSERT INTO subscription_orders'));
    });

    it('should throw if plan not found', async () => {
      mockPool.query = async () => ({ rows: [] });
      await assert.rejects(() => createOrder(1, 999), /套餐不存在/);
    });
  });

  describe('getActiveSubscription', () => {
    it('should return premium for admin', async () => {
      const result = await getActiveSubscription(1, 'admin');
      assert.equal(result.isPremium, true);
      assert.equal(result.planName, '管理员');
    });

    it('should return non-premium for expired subscription', async () => {
      mockPool.query = async () => ({
        rows: [{ subscription_status: 'premium', subscription_end: '2020-01-01', subscription_plan_id: 1 }],
      });
      const result = await getActiveSubscription(1, 'user');
      assert.equal(result.isPremium, false);
    });

    it('should return premium for active subscription', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      mockPool.query = async (sql) => {
        if (sql.includes('users')) return { rows: [{ subscription_status: 'premium', subscription_end: futureDate, subscription_plan_id: 1 }] };
        return { rows: [{ name: '月度会员' }] };
      };
      const result = await getActiveSubscription(1, 'user');
      assert.equal(result.isPremium, true);
      assert.equal(result.planName, '月度会员');
    });

    it('should return non-premium for user not found', async () => {
      mockPool.query = async () => ({ rows: [] });
      const result = await getActiveSubscription(1, 'user');
      assert.equal(result.isPremium, false);
    });
  });

  describe('activateSubscription', () => {
    it('should throw if order not found', async () => {
      mockClientQueryResult = [];
      await assert.rejects(() => activateSubscription(1, 999), /订单不存在/);
    });

    it('should return alreadyPaid if order already paid', async () => {
      mockClientQueryResult = [{ id: 1, user_id: 1, plan_id: 1, status: 'paid' }];
      const result = await activateSubscription(1, 1);
      assert.equal(result.alreadyPaid, true);
      assert.equal(result.success, true);
    });

    it('should activate subscription and extend from current end date', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 10).toISOString();
      mockClient.query = async (sql, params) => {
        lastQuery = sql;
        lastParams = params;
        if (sql === 'BEGIN') return;
        if (sql === 'COMMIT') { transactionCommitted = true; return; }
        if (sql.includes('subscription_orders') && sql.includes('SELECT')) {
          return { rows: [{ id: 1, user_id: 1, plan_id: 1, status: 'pending' }] };
        }
        if (sql.includes('subscription_plans')) return { rows: [{ duration_days: 30 }] };
        if (sql.includes('SELECT subscription_end')) return { rows: [{ subscription_end: futureDate }] };
        return { rows: [] };
      };

      const result = await activateSubscription(1, 1);
      assert.equal(result.success, true);
      assert.ok(result.expiresAt > new Date());
      assert.ok(transactionCommitted);
    });

    it('should activate from now if current subscription expired', async () => {
      mockClient.query = async (sql, params) => {
        lastQuery = sql;
        lastParams = params;
        if (sql === 'BEGIN' || sql === 'COMMIT') return;
        if (sql.includes('subscription_orders') && sql.includes('SELECT')) {
          return { rows: [{ id: 1, user_id: 1, plan_id: 1, status: 'pending' }] };
        }
        if (sql.includes('subscription_plans')) return { rows: [{ duration_days: 30 }] };
        if (sql.includes('SELECT subscription_end')) return { rows: [{ subscription_end: '2020-01-01' }] };
        return { rows: [] };
      };

      const result = await activateSubscription(1, 1);
      assert.equal(result.success, true);
      // Should be ~30 days from now
      const diff = result.expiresAt.getTime() - Date.now();
      assert.ok(diff > 29 * 86400000 && diff < 31 * 86400000);
    });
  });

  describe('activateByTradeNo', () => {
    it('should return alreadyPaid if already paid', async () => {
      mockClient.query = async (sql) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return;
        if (sql.includes('subscription_orders') && sql.includes('SELECT')) {
          return { rows: [{ id: 1, user_id: 1, plan_id: 1, status: 'paid' }] };
        }
        return { rows: [] };
      };

      const result = await activateByTradeNo('OUT_123', 'TRADE_456');
      assert.equal(result.alreadyPaid, true);
    });

    it('should throw if order not found', async () => {
      mockClient.query = async (sql) => {
        if (sql === 'BEGIN') return;
        if (sql.includes('subscription_orders') && sql.includes('SELECT')) return { rows: [] };
        return { rows: [] };
      };
      await assert.rejects(() => activateByTradeNo('OUT_999', 'TRADE_999'), /订单不存在/);
    });
  });

  describe('getPlans', () => {
    it('should return active plans', async () => {
      mockPool.query = async () => ({ rows: [{ id: 1, name: '月度会员', price: 9.9 }] });
      const result = await getPlans();
      assert.equal(result.length, 1);
      assert.equal(result[0].name, '月度会员');
    });
  });

  describe('getOrdersByUser', () => {
    it('should return orders with limit', async () => {
      mockPool.query = async (sql, params) => {
        lastParams = params;
        return { rows: [{ id: 1, plan_name: '月度会员' }] };
      };
      const result = await getOrdersByUser(1, 10);
      assert.equal(result.length, 1);
      assert.equal(lastParams[1], 10);
    });
  });
});
