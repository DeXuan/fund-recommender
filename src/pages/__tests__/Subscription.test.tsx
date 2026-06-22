import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Subscription from '../Subscription';
import * as AuthContext from '../../contexts/AuthContext';

// Mock API
vi.mock('../../services/api', () => ({
  subscriptionApi: {
    getPlans: vi.fn(),
    getStatus: vi.fn(),
    getOrders: vi.fn(),
    createOrder: vi.fn(),
    checkOrder: vi.fn(),
  },
}));

// Mock contexts
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { subscription_status: 'free' }, setUser: vi.fn() })),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

import { subscriptionApi } from '../../services/api';

describe('Subscription Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (subscriptionApi.getPlans as any).mockReturnValue(new Promise(() => {}));
    (subscriptionApi.getStatus as any).mockReturnValue(new Promise(() => {}));
    (subscriptionApi.getOrders as any).mockReturnValue(new Promise(() => {}));

    const { container } = render(<Subscription />);
    // Ant Design v6 Spin renders aria-busy="true" without text
    const spinner = container.querySelector('.ant-spin-spinning');
    expect(spinner).toBeTruthy();
  });

  it('should render plans after loading', async () => {
    (subscriptionApi.getPlans as any).mockResolvedValue({
      plans: [{ id: 1, name: '月度会员', price: 9.9, duration_days: 30, features: ['AI选股', '深度分析'] }],
    });
    (subscriptionApi.getStatus as any).mockResolvedValue({ isPremium: false });
    (subscriptionApi.getOrders as any).mockResolvedValue({ orders: [] });

    render(<Subscription />);

    await waitFor(() => {
      expect(screen.getByText('月度会员')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should show premium status for VIP users', async () => {
    (subscriptionApi.getPlans as any).mockResolvedValue({ plans: [] });
    (subscriptionApi.getStatus as any).mockResolvedValue({
      isPremium: true,
      expiresAt: '2099-12-31',
      planName: '月度会员',
      daysRemaining: 365,
    });
    (subscriptionApi.getOrders as any).mockResolvedValue({ orders: [] });

    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { subscription_status: 'premium', id: 1, username: 'test', nickname: 'Test', role: 'user' },
      token: 'mock-token',
      setUser: vi.fn(),
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    });

    render(<Subscription />);

    await waitFor(() => {
      expect(screen.getByText('尊享会员')).toBeInTheDocument();
    }, { timeout: 10000 });
  });

  it('should render without crashing', () => {
    (subscriptionApi.getPlans as any).mockResolvedValue({ plans: [] });
    (subscriptionApi.getStatus as any).mockResolvedValue({ isPremium: false });
    (subscriptionApi.getOrders as any).mockResolvedValue({ orders: [] });

    const { container } = render(<Subscription />);
    expect(container).toBeTruthy();
  });
});
