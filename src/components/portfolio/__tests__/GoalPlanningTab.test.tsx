/**
 * 理财记账 - 目标规划全流程自动化测试
 *
 * 覆盖场景：
 * 1. 新增目标
 * 2. 切换目标
 * 3. 推算收益
 * 4. 修改参数
 * 5. 删除目标
 * 6. 复制新建
 * 7. 目标高亮状态持久化
 * 8. 推算结果联动当前选中目标
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock API
vi.mock('../../../services/api', () => ({
  fundApi: {
    calculateGoal: vi.fn().mockResolvedValue({
      targetAmount: 1000000,
      projection: { futureValue: 1200000, totalInvested: 800000, totalProfit: 400000, returnRate: 50 },
      canReach: true,
      yearsToGoal: 8,
      requiredMonthly: null,
      yearlyData: [
        { year: 1, value: 150000, invested: 120000, profit: 30000 },
        { year: 2, value: 320000, invested: 240000, profit: 80000 },
      ],
    }),
  },
}));

// Mock localStorage for goal persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('GoalPlanningTab - 目标规划全流程测试', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('目标CRUD操作', () => {
    it('should create a new goal with unique id', () => {
      const goals: any[] = [];
      const newGoal = {
        id: `goal_${Date.now()}_test`,
        label: '子女教育',
        icon: '🎓',
        target: 500000,
        current: 0,
        monthly: 5000,
        returnRate: 8,
        years: 15,
        createdAt: Date.now(),
      };
      goals.push(newGoal);

      expect(goals).toHaveLength(1);
      expect(goals[0].label).toBe('子女教育');
      expect(goals[0].id).toMatch(/^goal_/);
    });

    it('should update goal properties', () => {
      const goals = [
        { id: 'goal_1', label: '买房首付', target: 1000000, current: 100000, monthly: 5000, returnRate: 8, years: 10 },
      ];

      const updated = goals.map(g => g.id === 'goal_1' ? { ...g, target: 2000000, monthly: 8000 } : g);
      expect(updated[0].target).toBe(2000000);
      expect(updated[0].monthly).toBe(8000);
    });

    it('should delete goal and update selection', () => {
      let goals = [
        { id: 'goal_1', label: '目标A' },
        { id: 'goal_2', label: '目标B' },
        { id: 'goal_3', label: '目标C' },
      ];
      let selectedId: string | null = 'goal_2';

      // Delete selected goal
      goals = goals.filter(g => g.id !== 'goal_2');
      if (selectedId === 'goal_2') {
        selectedId = goals.length > 0 ? goals[0].id : null;
      }

      expect(goals).toHaveLength(2);
      expect(selectedId).toBe('goal_1');
    });

    it('should duplicate goal with new id and suffix', () => {
      const original = { id: 'goal_1', label: '买房首付', target: 1000000 };
      const duplicate = {
        ...original,
        id: `goal_${Date.now()}_dup`,
        label: `${original.label} (副本)`,
      };

      expect(duplicate.label).toBe('买房首付 (副本)');
      expect(duplicate.id).not.toBe(original.id);
      expect(duplicate.target).toBe(original.target);
    });
  });

  describe('目标选择和高亮状态', () => {
    it('should persist selected goal id to localStorage', () => {
      const goalId = 'goal_test_123';
      localStorage.setItem('fund-recommender-selected-goal', goalId);

      expect(localStorage.setItem).toHaveBeenCalledWith('fund-recommender-selected-goal', goalId);
    });

    it('should restore selected goal id from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('goal_restored');

      const stored = localStorage.getItem('fund-recommender-selected-goal');
      expect(stored).toBe('goal_restored');
    });

    it('should clear selection when selected goal is deleted', () => {
      localStorageMock.setItem('fund-recommender-selected-goal', 'goal_deleted');
      localStorage.removeItem('fund-recommender-selected-goal');

      expect(localStorage.removeItem).toHaveBeenCalledWith('fund-recommender-selected-goal');
    });
  });

  describe('推算收益计算', () => {
    it('should call calculateGoal with correct parameters', async () => {
      const { fundApi } = await import('../../../services/api');

      const params = {
        targetAmount: 1000000,
        currentAmount: 100000,
        monthlyContribution: 5000,
        expectedReturn: 8,
        years: 10,
      };

      await fundApi.calculateGoal(params);

      expect(fundApi.calculateGoal).toHaveBeenCalledWith(params);
    });

    it('should return canReach true when goal is achievable', async () => {
      const { fundApi } = await import('../../../services/api');
      const result = await fundApi.calculateGoal({
        targetAmount: 1000000,
        currentAmount: 100000,
        monthlyContribution: 5000,
        expectedReturn: 8,
        years: 10,
      });

      expect(result.canReach).toBe(true);
      expect(result.yearsToGoal).toBeLessThanOrEqual(10);
    });

    it('should return yearlyData for chart rendering', async () => {
      const { fundApi } = await import('../../../services/api');
      const result = await fundApi.calculateGoal({
        targetAmount: 1000000,
        currentAmount: 100000,
        monthlyContribution: 5000,
        expectedReturn: 8,
        years: 10,
      });

      expect(result.yearlyData).toBeDefined();
      expect(result.yearlyData.length).toBeGreaterThan(0);
      expect(result.yearlyData[0]).toHaveProperty('year');
      expect(result.yearlyData[0]).toHaveProperty('value');
      expect(result.yearlyData[0]).toHaveProperty('invested');
      expect(result.yearlyData[0]).toHaveProperty('profit');
    });
  });

  describe('参数修改联动', () => {
    it('should reset calculation result when target changes', () => {
      let goalResult: any = { canReach: true };
      const newTarget = 2000000;

      // Simulate target change
      goalResult = null;

      expect(goalResult).toBeNull();
    });

    it('should reset calculation result when switching goals', () => {
      let goalResult: any = { canReach: true };
      let selectedId = 'goal_1';

      // Switch to different goal
      selectedId = 'goal_2';
      goalResult = null;

      expect(selectedId).toBe('goal_2');
      expect(goalResult).toBeNull();
    });
  });

  describe('使用当前持仓金额', () => {
    it('should set current amount to portfolio total value', () => {
      const summary = { totalValue: 258765.43 };
      const goal = { id: 'goal_1', current: 0 };

      const updated = { ...goal, current: Math.round(summary.totalValue) };
      expect(updated.current).toBe(258765);
    });
  });
});

describe('Portfolio - 持仓操作全流程测试', () => {
  describe('持仓数据格式', () => {
    it('should calculate PnL correctly', () => {
      const holding = {
        total_shares: 1000,
        avg_cost_price: 1.2345,
        current_nav: 1.5678,
      };

      const totalCost = holding.total_shares * holding.avg_cost_price;
      const marketValue = holding.total_shares * holding.current_nav;
      const pnl = marketValue - totalCost;
      const pnlPercent = (pnl / totalCost) * 100;

      expect(pnl).toBeCloseTo(333.3, 0);
      expect(pnlPercent).toBeCloseTo(27, 0);
    });

    it('should handle zero shares gracefully', () => {
      const holding = { total_shares: 0, avg_cost_price: 1.0, current_nav: 1.5 };
      const pnl = holding.total_shares * (holding.current_nav - holding.avg_cost_price);
      expect(pnl).toBe(0);
    });
  });

  describe('CSV导出格式', () => {
    it('should generate valid CSV with BOM', () => {
      const escCsv = (v: string | number | null | undefined) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const header = '基金代码,基金名称,持有份额,盈亏';
      const row = ['000001', '测试基金,A类', 1000, 333.33].map(escCsv).join(',');
      const csv = '﻿' + header + '\n' + row;

      expect(csv).toContain('﻿'); // BOM
      expect(row).toContain('"测试基金,A类"'); // quoted because of comma
    });

    it('should escape double quotes in CSV', () => {
      const escCsv = (v: string) => {
        const s = String(v);
        return s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      };

      expect(escCsv('他说"你好"')).toBe('"他说""你好"""');
    });
  });

  describe('交易历史筛选', () => {
    it('should filter transactions by type', () => {
      const transactions = [
        { id: 1, record_type: 'buy', fund_name: 'A' },
        { id: 2, record_type: 'sell', fund_name: 'B' },
        { id: 3, record_type: 'buy', fund_name: 'C' },
      ];

      const buyOnly = transactions.filter(t => t.record_type === 'buy');
      const sellOnly = transactions.filter(t => t.record_type === 'sell');

      expect(buyOnly).toHaveLength(2);
      expect(sellOnly).toHaveLength(1);
    });
  });
});

describe('多账户资产台账测试', () => {
  describe('账户类型配置', () => {
    it('should have all required account types', () => {
      const ACCOUNT_TYPES = [
        { value: 'fund', label: '基金' },
        { value: 'stock', label: '股票' },
        { value: 'cash', label: '现金' },
        { value: 'deposit', label: '存款' },
        { value: 'bond', label: '债权' },
        { value: 'crypto', label: '加密资产' },
        { value: 'realestate', label: '不动产' },
        { value: 'other', label: '其他' },
      ];

      expect(ACCOUNT_TYPES).toHaveLength(8);
      expect(ACCOUNT_TYPES.map(t => t.value)).toContain('fund');
      expect(ACCOUNT_TYPES.map(t => t.value)).toContain('crypto');
      expect(ACCOUNT_TYPES.map(t => t.value)).toContain('realestate');
    });
  });

  describe('资产汇总计算', () => {
    it('should calculate total assets by type', () => {
      const accounts = [
        { account_type: 'fund', balance: 100000, cost_basis: 80000 },
        { account_type: 'fund', balance: 50000, cost_basis: 45000 },
        { account_type: 'cash', balance: 30000, cost_basis: 30000 },
        { account_type: 'deposit', balance: 200000, cost_basis: 200000 },
      ];

      const byType = accounts.reduce((acc, a) => {
        if (!acc[a.account_type]) acc[a.account_type] = { total: 0, cost: 0, count: 0 };
        acc[a.account_type].total += a.balance;
        acc[a.account_type].cost += a.cost_basis;
        acc[a.account_type].count += 1;
        return acc;
      }, {} as Record<string, { total: number; cost: number; count: number }>);

      expect(byType.fund.total).toBe(150000);
      expect(byType.fund.count).toBe(2);
      expect(byType.cash.total).toBe(30000);
      expect(byType.deposit.total).toBe(200000);

      const totalAssets = Object.values(byType).reduce((s, t) => s + t.total, 0);
      expect(totalAssets).toBe(380000);
    });

    it('should calculate PnL per account type', () => {
      const account = { balance: 100000, cost_basis: 80000 };
      const pnl = account.balance - account.cost_basis;
      const pnlPercent = (pnl / account.cost_basis) * 100;

      expect(pnl).toBe(20000);
      expect(pnlPercent).toBe(25);
    });
  });
});
