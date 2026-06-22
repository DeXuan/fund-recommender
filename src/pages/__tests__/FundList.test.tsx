import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock API
vi.mock('../../services/api', () => ({
  fundApi: {
    getFunds: vi.fn(),
    getIndustries: vi.fn(),
    getManagers: vi.fn(),
    getStarManagers: vi.fn(),
    getGoldFundStats: vi.fn(),
    compareFunds: vi.fn(),
    compareNavHistory: vi.fn(),
  },
  watchlistApi: {
    batchCheck: vi.fn().mockResolvedValue({}),
    add: vi.fn(),
    remove: vi.fn(),
    getList: vi.fn().mockResolvedValue([]),
  },
  fundCompareApi: {
    premiumAnalyze: vi.fn(),
  },
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import { fundApi } from '../../services/api';
import FundList from '../FundList';

const mockFunds = [
  { code: '000001', name: '华夏成长', type: '混合型', industry: '综合', nav: 1.5, return_1y: 15.5, return_6m: 8.2, return_3m: 3.1, return_1m: 1.2, return_1w: 0.5, scale: 50, rating: 4 },
  { code: '000002', name: '易方达消费', type: '股票型', industry: '消费', nav: 2.1, return_1y: 22.3, return_6m: 12.1, return_3m: 5.5, return_1m: 2.1, return_1w: 0.8, scale: 100, rating: 5 },
];

describe('FundList Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fundApi.getFunds as any).mockResolvedValue({ data: mockFunds, total: 2 });
    (fundApi.getIndustries as any).mockResolvedValue(['综合', '消费']);
    (fundApi.getManagers as any).mockResolvedValue([]);
    (fundApi.getStarManagers as any).mockResolvedValue([]);
    (fundApi.getGoldFundStats as any).mockResolvedValue({ total: 0, stats: {} });
  });

  it('should render fund list after loading', async () => {
    render(<BrowserRouter><FundList /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('华夏成长')).toBeInTheDocument();
      expect(screen.getByText('易方达消费')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('should display fund codes', async () => {
    render(<BrowserRouter><FundList /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('000001')).toBeInTheDocument();
      expect(screen.getByText('000002')).toBeInTheDocument();
    }, { timeout: 15000 });
  });

  it('should call getFunds on mount', async () => {
    render(<BrowserRouter><FundList /></BrowserRouter>);

    await waitFor(() => {
      expect(fundApi.getFunds).toHaveBeenCalled();
    }, { timeout: 15000 });
  });

  it('should display fund names in the table', async () => {
    render(<BrowserRouter><FundList /></BrowserRouter>);

    await waitFor(() => {
      const fund1 = screen.getByText('华夏成长');
      const fund2 = screen.getByText('易方达消费');
      expect(fund1).toBeInTheDocument();
      expect(fund2).toBeInTheDocument();
    }, { timeout: 15000 });
  });
});
