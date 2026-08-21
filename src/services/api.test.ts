import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('API Client fetchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // Import the module fresh each time
  async function loadApi() {
    vi.resetModules();
    return await import('./api');
  }

  it('should attach Authorization header when token exists', async () => {
    localStorage.setItem('token', 'test-jwt-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const { fundApi } = await loadApi();
    await fundApi.getMarketIndices();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('should not attach Authorization header when no token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const { fundApi } = await loadApi();
    await fundApi.getMarketIndices();

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('should clear token on 401 response', async () => {
    localStorage.setItem('token', 'expired-token');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const { fundApi } = await loadApi();

    await expect(fundApi.getMarketIndices()).rejects.toThrow();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('should extract error message from response body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: '基金代码格式错误' }),
    });

    const { fundApi } = await loadApi();

    await expect(fundApi.getFundDetail('abc')).rejects.toThrow('基金代码格式错误');
  });

  it('should use correct base URL for API calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { fundApi } = await loadApi();
    await fundApi.getIndustries();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/industries');
  });
});

describe('API Client - Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  async function loadApi() {
    vi.resetModules();
    return await import('./api');
  }

  it('should send POST with credentials for login', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'new-token', user: { id: 1 } }),
    });

    const { authApi } = await loadApi();
    await authApi.login('testuser', 'password123');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ username: 'testuser', password: 'password123' });
  });

  it('should send POST with credentials for register', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'new-token', user: { id: 1 } }),
    });

    const { authApi } = await loadApi();
    await authApi.register('newuser', 'password123', 'New User');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ username: 'newuser', password: 'password123', nickname: 'New User' });
  });
});

describe('API Client - Portfolio API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  async function loadApi() {
    vi.resetModules();
    return await import('./api');
  }

  it('should fetch portfolio summary', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ totalCost: 10000, totalPnl: 500 }),
    });

    const { portfolioApi } = await loadApi();
    const result = await portfolioApi.getSummary();

    expect(result.totalCost).toBe(10000);
    expect(result.totalPnl).toBe(500);
  });

  it('should add portfolio record with POST', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1 }),
    });

    const { portfolioApi } = await loadApi();
    await portfolioApi.addRecord({
      fund_code: '000001',
      fund_name: '华夏成长',
      cost_price: 1.5,
      buy_date: '2026-01-01',
      shares: 1000,
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(url).toContain('/api/portfolio/records');
  });

  it('should handle sell with POST', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { portfolioApi } = await loadApi();
    await portfolioApi.sell({
      fund_code: '000001',
      shares: 500,
      sell_price: 1.6,
      sell_date: '2026-06-01',
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(url).toContain('/api/portfolio/sell');
  });
});
