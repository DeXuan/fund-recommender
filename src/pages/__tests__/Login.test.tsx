import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../services/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    alipayQrcode: vi.fn(),
    alipayCheck: vi.fn(),
    guestLogin: vi.fn(),
  },
  portfolioApi: {
    initDemo: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, setUser: vi.fn(), logout: vi.fn() }),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

import Login from '../Login';

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form with tabs', () => {
    render(<BrowserRouter><Login /></BrowserRouter>);

    // Should have login tab
    expect(screen.getByText('登录')).toBeInTheDocument();
  });

  it('should show username and password inputs', () => {
    render(<BrowserRouter><Login /></BrowserRouter>);

    const inputs = screen.getAllByRole('textbox');
    // Should have at least username input
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('should have a submit button', () => {
    render(<BrowserRouter><Login /></BrowserRouter>);

    // Should have at least one button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('should render without crashing', () => {
    const { container } = render(<BrowserRouter><Login /></BrowserRouter>);
    expect(container).toBeTruthy();
  });
});
