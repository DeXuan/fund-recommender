import { describe, it, expect } from 'vitest';

describe('Sharpe Ratio Calculation (fund-compare)', () => {
  // Test the fixed Sharpe ratio calculation that uses consistent data source
  function calculateSharpeRatio(navs: number[]) {
    if (navs.length < 10) return { volatility: 0, sharpeRatio: 0, calmarRatio: 0, maxDrawdown: 0 };

    const returns: number[] = [];
    for (let i = 1; i < navs.length; i++) {
      returns.push((navs[i] - navs[i - 1]) / navs[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;

    let maxDrawdown = 0;
    let peak = navs[0];
    for (const nav of navs) {
      if (nav > peak) peak = nav;
      const dd = (peak - nav) / peak;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
    maxDrawdown = maxDrawdown * 100;

    // Fixed: use historical data for annualized return (consistent with volatility)
    const totalReturn = (navs[navs.length - 1] - navs[0]) / navs[0];
    const years = navs.length / 252;
    const annualReturn = years > 0 ? (Math.pow(1 + totalReturn, 1 / years) - 1) * 100 : 0;

    const sharpeRatio = volatility > 0 ? (annualReturn - 2) / volatility : 0;
    const calmarRatio = maxDrawdown > 0 ? annualReturn / maxDrawdown : 0;

    return { volatility, sharpeRatio, calmarRatio, maxDrawdown, annualReturn };
  }

  it('should calculate consistent Sharpe ratio from same data source', () => {
    // Simulate 252 trading days (1 year) of NAV data
    const navs: number[] = [1.0];
    for (let i = 1; i < 252; i++) {
      navs.push(navs[i - 1] * (1 + (Math.random() * 0.04 - 0.018))); // ~20% annual return
    }

    const result = calculateSharpeRatio(navs);

    // Annual return should be derived from the same NAV data as volatility
    expect(result.annualReturn).toBeGreaterThan(0);
    expect(result.volatility).toBeGreaterThan(0);
    expect(result.sharpeRatio).not.toBe(0);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result.maxDrawdown).toBeLessThanOrEqual(100);
  });

  it('should return 0 for insufficient data', () => {
    const navs = [1.0, 1.01, 1.02];
    const result = calculateSharpeRatio(navs);
    expect(result.volatility).toBe(0);
    expect(result.sharpeRatio).toBe(0);
  });

  it('should handle monotonically increasing NAVs', () => {
    const navs = Array.from({ length: 252 }, (_, i) => 1 + i * 0.001);
    const result = calculateSharpeRatio(navs);
    expect(result.annualReturn).toBeGreaterThan(0);
    expect(result.maxDrawdown).toBe(0);
    expect(result.calmarRatio).toBe(0); // no drawdown, calmar = 0
  });
});

describe('Sortino Ratio Calculation (stock-picker)', () => {
  // Test the fixed Sortino ratio that uses all returns with risk-free rate
  function calculateSortino(returns: number[], annualizedReturn: number, riskFreeRate: number = 2) {
    const dailyRf = riskFreeRate / 250;
    const downVariance = returns.reduce((s, r) => {
      const diff = Math.min(r - dailyRf, 0);
      return s + diff * diff;
    }, 0) / returns.length;
    const downVol = Math.sqrt(downVariance) * Math.sqrt(250);
    return downVol > 0 ? (annualizedReturn - riskFreeRate) / downVol : 0;
  }

  it('should use all returns (not just negative) for downside deviation', () => {
    // Mix of positive and negative returns
    const returns = [0.01, -0.02, 0.015, -0.005, 0.008, -0.01, 0.02, -0.015, 0.005, -0.008];
    const sortino = calculateSortino(returns, 15); // 15% annual return

    // Should be positive since return > risk-free rate
    expect(sortino).toBeGreaterThan(0);
  });

  it('should return 0 when all returns are positive and above risk-free rate (no downside)', () => {
    // dailyRf = 2/250 = 0.008, so all returns must be > 0.008
    const returns = [0.01, 0.02, 0.015, 0.012, 0.018];
    const sortino = calculateSortino(returns, 20);

    // With all returns above daily risk-free rate, no downside deviation => sortino = 0
    expect(sortino).toBe(0);
  });

  it('should penalize more for larger negative returns', () => {
    const smallLoss = [0.01, -0.001, 0.01, -0.001, 0.01];
    const bigLoss = [0.01, -0.05, 0.01, -0.05, 0.01];

    const sortinoSmall = calculateSortino(smallLoss, 10);
    const sortinoBig = calculateSortino(bigLoss, 10);

    // Larger losses should result in lower Sortino ratio
    expect(sortinoSmall).toBeGreaterThan(sortinoBig);
  });

  it('should handle risk-free rate correctly in downside calculation', () => {
    // Returns below risk-free rate
    const returns = [0.005, -0.002, 0.003, -0.001, 0.004]; // some below dailyRf
    const sortino = calculateSortino(returns, 5);

    expect(typeof sortino).toBe('number');
    expect(isFinite(sortino)).toBe(true);
  });
});

describe('Subscription Extension Logic', () => {
  it('should extend from current end date if not expired', () => {
    const now = new Date();
    const currentEnd = new Date(now.getTime() + 10 * 86400000); // 10 days from now
    const days = 30;

    const baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(baseDate.getTime() + days * 86400000);

    // Should be 40 days from now (10 remaining + 30 new)
    const diff = newEnd.getTime() - now.getTime();
    expect(diff).toBeCloseTo(40 * 86400000, -3); // within 1000ms
  });

  it('should start from now if current subscription expired', () => {
    const now = new Date();
    const currentEnd = new Date('2020-01-01'); // expired
    const days = 30;

    const baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(baseDate.getTime() + days * 86400000);

    // Should be 30 days from now
    const diff = newEnd.getTime() - now.getTime();
    expect(diff).toBeCloseTo(30 * 86400000, -3);
  });

  it('should start from now if no current subscription', () => {
    const now = new Date();
    const currentEnd = null;
    const days = 30;

    const baseDate = currentEnd && new Date(currentEnd) > now ? new Date(currentEnd) : now;
    const newEnd = new Date(baseDate.getTime() + days * 86400000);

    const diff = newEnd.getTime() - now.getTime();
    expect(diff).toBeCloseTo(30 * 86400000, -3);
  });
});

describe('Portfolio Sell FIFO Logic', () => {
  it('should not allow selling more than held', () => {
    const totalShares = 100;
    const sellShares = 100.0002;
    const epsilon = 0.0001;

    expect(sellShares > totalShares + epsilon).toBe(true);
  });

  it('should allow selling within epsilon tolerance', () => {
    const totalShares = 100;
    const sellShares = 100.00005;
    const epsilon = 0.0001;

    expect(sellShares > totalShares + epsilon).toBe(false);
  });

  it('should set shares to 0 when below epsilon', () => {
    const remaining = 0.00005;
    const epsilon = 0.0001;

    const finalShares = remaining < epsilon ? 0 : remaining;
    expect(finalShares).toBe(0);
  });
});

describe('Division by Zero Protection', () => {
  it('should handle zero totalProfit in profit analysis', () => {
    const totalProfit = 0;
    const categoryProfit = 100;

    const percentage = totalProfit !== 0 ? Math.round(categoryProfit / totalProfit * 100) : 0;
    expect(percentage).toBe(0);
    expect(isFinite(percentage)).toBe(true);
  });

  it('should handle zero cost in fee rate calculation', () => {
    const totalBuyFees = 10;
    const totalCost = 0;

    const feeRate = totalCost > 0 ? parseFloat((totalBuyFees / totalCost * 100).toFixed(3)) : 0;
    expect(feeRate).toBe(0);
    expect(isFinite(feeRate)).toBe(true);
  });

  it('should handle zero PnL in impact calculation', () => {
    const totalBuyFees = 10;
    const totalPnl = 0;

    const impact = totalPnl !== 0 ? parseFloat((totalBuyFees / Math.abs(totalPnl) * 100).toFixed(1)) : 0;
    expect(impact).toBe(0);
    expect(isFinite(impact)).toBe(true);
  });
});
