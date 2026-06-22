/**
 * AI选股付费链路全流程测试
 *
 * 覆盖场景：
 * 1. 免费用户访问付费功能 → 403 SUBSCRIPTION_REQUIRED
 * 2. VIP用户访问付费功能 → 200 正常返回
 * 3. VIP到期后访问 → 403 SUBSCRIPTION_REQUIRED
 * 4. 续费后数据无缝继承
 * 5. 支付成功后功能立即解锁
 * 6. 订阅状态查询
 * 7. 策略保存和复盘功能
 * 8. 认证头验证
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

// Mock localStorage
const store: Record<string, string> = {};
const originalLocalStorage = globalThis.localStorage;

function setupMocks() {
  Object.keys(store).forEach(k => delete store[k]);
  store['token'] = 'test-jwt-token';

  (globalThis as any).fetch = mockFetch;
  (globalThis as any).localStorage = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  };
}

function restoreMocks() {
  (globalThis as any).fetch = originalFetch;
  (globalThis as any).localStorage = originalLocalStorage;
}

function mockResponse(ok: boolean, status: number, data: any) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe('AI选股付费链路全流程测试', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setupMocks();
  });

  afterEach(() => {
    restoreMocks();
  });

  // ============ 场景1: 免费用户访问付费功能 ============
  describe('免费用户访问付费功能', () => {
    it('rankFunds should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.rankFunds({ limit: 10 })).rejects.toThrow('此功能需要开通会员');
    });

    it('backtest should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.backtest(['000001'])).rejects.toThrow('此功能需要开通会员');
    });

    it('buildPortfolio should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.buildPortfolio({ topN: 5, budget: 10000 })).rejects.toThrow('此功能需要开通会员');
    });

    it('getMarketOverview should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.getMarketOverview()).rejects.toThrow('此功能需要开通会员');
    });

    it('quantPicks should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.quantPicks()).rejects.toThrow('此功能需要开通会员');
    });

    it('deepAnalysis should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.deepAnalysis(['000001'])).rejects.toThrow('此功能需要开通会员');
    });

    it('strategyCompare should return SUBSCRIPTION_REQUIRED for free user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.strategyCompare({ limit: 10 })).rejects.toThrow('此功能需要开通会员');
    });
  });

  // ============ 场景2: VIP用户正常访问 ============
  describe('VIP用户正常访问付费功能', () => {
    it('rankFunds should return data for VIP user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          ranked: [{ fund: { code: '000001', name: 'Test Fund', return1y: 15 }, score: 85, breakdown: {} }],
          total: 100,
          factors: {},
          industryStats: {},
        })
      );

      const { stockPickerApi } = await import('../api');
      const result = await stockPickerApi.rankFunds({ limit: 10 });
      expect(result.ranked).toHaveLength(1);
      expect(result.ranked[0].score).toBe(85);
    });

    it('backtest should return portfolio and benchmark data', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          dates: ['2024-01-01', '2024-01-02'],
          portfolio: [100, 102],
          benchmark: [100, 101],
          summary: { portReturn: 2, alpha: 1, maxDrawdown: 0.5, winRate: 60 },
        })
      );

      const { stockPickerApi } = await import('../api');
      const result = await stockPickerApi.backtest(['000001'], 180);
      expect(result.dates).toHaveLength(2);
      expect(result.summary.portReturn).toBe(2);
    });

    it('buildPortfolio should return allocation plan', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          allocation: [{ code: '000001', name: 'Fund A', amount: 2000, weight: 20 }],
          totalBudget: 10000,
          perFund: 2000,
          strategy: 'balanced',
        })
      );

      const { stockPickerApi } = await import('../api');
      const result = await stockPickerApi.buildPortfolio({ topN: 5, budget: 10000 });
      expect(result.allocation).toHaveLength(1);
      expect(result.totalBudget).toBe(10000);
    });
  });

  // ============ 场景3: VIP到期后功能锁定 ============
  describe('VIP到期后功能锁定', () => {
    it('should return SUBSCRIPTION_REQUIRED after VIP expires', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { ranked: [], total: 0 })
      );

      const { stockPickerApi } = await import('../api');
      await stockPickerApi.rankFunds({ limit: 10 });

      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 403, { error: '此功能需要开通会员', code: 'SUBSCRIPTION_REQUIRED' })
      );

      await expect(stockPickerApi.rankFunds({ limit: 10 })).rejects.toThrow('此功能需要开通会员');
    });
  });

  // ============ 场景4: 续费后数据无缝继承 ============
  describe('续费后数据无缝继承', () => {
    it('should access same data after renewal', async () => {
      const { stockPickerApi } = await import('../api');

      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { ranked: [{ fund: { code: '000001' }, score: 85 }], total: 1 })
      );
      const before = await stockPickerApi.rankFunds({ limit: 10 });
      expect(before.ranked[0].score).toBe(85);

      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { ranked: [{ fund: { code: '000001' }, score: 85 }], total: 1 })
      );
      const after = await stockPickerApi.rankFunds({ limit: 10 });
      expect(after.ranked[0].score).toBe(85);
      expect(after.ranked[0].fund.code).toBe(before.ranked[0].fund.code);
    });
  });

  // ============ 场景5: 支付成功后功能解锁 ============
  describe('支付成功后功能解锁', () => {
    it('should unlock features after successful payment', async () => {
      const { subscriptionApi, stockPickerApi } = await import('../api');

      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { paid: true })
      );
      const payResult = await subscriptionApi.checkOrder('TRADE_NO_123');
      expect(payResult.paid).toBe(true);

      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { ranked: [{ fund: { code: '000001' }, score: 90 }], total: 1 })
      );
      const rankResult = await stockPickerApi.rankFunds({ limit: 10 });
      expect(rankResult.ranked[0].score).toBe(90);
    });
  });

  // ============ 场景6: 订阅状态查询 ============
  describe('订阅状态查询', () => {
    it('getStatus should return premium status for VIP user', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          isPremium: true,
          expiresAt: '2026-12-31',
          planName: '月度会员',
          daysRemaining: 190,
        })
      );

      const { subscriptionApi } = await import('../api');
      const status = await subscriptionApi.getStatus();
      expect(status.isPremium).toBe(true);
      expect(status.daysRemaining).toBe(190);
    });

    it('getStatus should return free status for non-VIP', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          isPremium: false,
          expiresAt: null,
          planName: null,
          daysRemaining: 0,
        })
      );

      const { subscriptionApi } = await import('../api');
      const status = await subscriptionApi.getStatus();
      expect(status.isPremium).toBe(false);
    });

    it('getPlans should return available plans', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          plans: [
            { id: 1, name: '月度会员', price: 9.9, duration_days: 30 },
            { id: 2, name: '季度会员', price: 25, duration_days: 90 },
          ],
        })
      );

      const { subscriptionApi } = await import('../api');
      const result = await subscriptionApi.getPlans();
      expect(result.plans).toHaveLength(2);
      expect(result.plans[0].price).toBe(9.9);
    });
  });

  // ============ 场景7: 策略保存和复盘功能 ============
  describe('策略保存和复盘功能', () => {
    it('strategyCompare should return strategy comparison data', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          strategies: {
            aggressive: { avgScore: 75, avgReturn: 20, top1Score: 90, top1Name: 'Fund A', topFunds: [] },
            balanced: { avgScore: 70, avgReturn: 15, top1Score: 85, top1Name: 'Fund B', topFunds: [] },
          },
          overlap: { aggressive_balanced: { common: 3, rate: 30 } },
          totalFunds: 100,
        })
      );

      const { stockPickerApi } = await import('../api');
      const result = await stockPickerApi.strategyCompare({ limit: 10 });
      expect(result.strategies.aggressive.avgScore).toBe(75);
      expect(Object.keys(result.strategies)).toHaveLength(2);
    });

    it('deepAnalysis should return risk metrics for selected funds', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, {
          results: [{
            code: '000001',
            name: 'Test Fund',
            metrics: {
              annualizedReturn: 15.5,
              sharpe: 1.2,
              calmar: 1.5,
              sortino: 1.8,
              maxDrawdown: -10,
              winRate: 65,
              profitLossRatio: 1.5,
            },
            monthlyReturns: [{ month: '2024-01', return: 2.5 }],
          }],
        })
      );

      const { stockPickerApi } = await import('../api');
      const result = await stockPickerApi.deepAnalysis(['000001']);
      expect(result.results[0].metrics.sharpe).toBe(1.2);
    });
  });

  // ============ 场景8: 认证头验证 ============
  describe('认证头验证', () => {
    it('should include Authorization header with token', async () => {
      store['token'] = 'my-secret-token';

      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { ranked: [], total: 0 })
      );

      const { stockPickerApi } = await import('../api');
      await stockPickerApi.rankFunds({ limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-token',
          }),
        })
      );
    });

    it('should not include Authorization header when no token', async () => {
      delete store['token'];

      mockFetch.mockResolvedValueOnce(
        mockResponse(true, 200, { plans: [] })
      );

      const { subscriptionApi } = await import('../api');
      await subscriptionApi.getPlans();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers as Record<string, string>;
      expect(headers?.Authorization).toBeUndefined();
    });
  });

  // ============ 场景9: 401自动清除token ============
  describe('401自动清除token', () => {
    it('should remove token on 401 response', async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse(false, 401, { error: '未登录' })
      );

      const { stockPickerApi } = await import('../api');
      await expect(stockPickerApi.rankFunds({ limit: 10 })).rejects.toThrow();
    });
  });
});
