import type { PortfolioSummary, FundRecord, DcaPlan, Transaction, ReturnsMapResponse, SellResponse, ImportResponse, Fund, FundDetail, MarketIndex, User } from '../types';

// Capacitor 环境使用绝对地址，Web 环境使用相对路径
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
    }
    // Try to extract server error message from response body
    let errorMsg = `API error: ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody.error) errorMsg = errBody.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const fundApi = {
  getFunds: (params?: {
    industry?: string;
    type?: string;
    sort?: string;
    order?: string;
    search?: string;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, String(value));
      });
    }
    return fetchApi<any>(`/funds?${query.toString()}`);
  },

  getFundDetail: (code: string) =>
    fetchApi<any>(`/funds/${encodeURIComponent(code)}`),

  getQDIIFunds: () =>
    fetchApi<any>('/funds/qdii'),

  getHS300Funds: () =>
    fetchApi<any>('/funds/hs300'),

  getMarketIndices: async () => {
    const data = await fetchApi<any>('/market/indices');
    return data.indices || data;
  },

  getSectors: async () => {
    const data = await fetchApi<any>('/market/sectors');
    return data.sectors || data;
  },

  getCapitalFlow: () =>
    fetchApi<{ northbound: any; mainFlow: any[]; lastUpdate: string }>('/market/capital-flow'),

  getIndustryRecommendations: () =>
    fetchApi<any[]>('/recommendations/industry'),

  getBatchPlans: () =>
    fetchApi<any[]>('/recommendations/batch-plans'),

  getRiskProfile: (profile: any) =>
    fetchApi<any>('/risk/profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),

  calculateDCA: (params: any) =>
    fetchApi<any>('/tools/dca', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  compareFunds: (codes: string[]) =>
    fetchApi<any>('/tools/compare', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    }),

  getIndustries: () =>
    fetchApi<string[]>('/industries'),

  // 获取基金经理列表
  getManagers: () =>
    fetchApi<Array<{ name: string; fundCount: number }>>('/managers'),

  // 获取明星基金经理详情
  getStarManagers: () =>
    fetchApi<Array<{ name: string; company: string; title: string; experience: string; specialty: string; bio: string; tags: string[] }>>('/star-managers'),

  // 获取数据更新状态
  getStatus: () =>
    fetchApi<any>('/status'),

  // 手动触发数据更新
  triggerUpdate: () =>
    fetchApi<any>('/update', { method: 'POST' }),

  // 行业基金深度分析
  getIndustryAnalysis: (industry: string) =>
    fetchApi<any>(`/industry-analysis/${encodeURIComponent(industry)}`),

  // 沪深300深度分析
  getHS300Analysis: () =>
    fetchApi<any>('/hs300/analysis'),

  // 标普500深度分析
  getSP500Analysis: () =>
    fetchApi<any>('/sp500/analysis'),

  // 基金对比净值历史
  compareNavHistory: (codes: string[]) =>
    fetchApi<Record<string, any[]>>('/tools/compare-nav', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    }),

  // 估值历史趋势
  getValuationTrend: () =>
    fetchApi<any[]>('/market/valuation-trend'),

  // 沪深300基准数据
  getHS300Benchmark: () =>
    fetchApi<any[]>('/benchmark/hs300'),

  // 招商银行持仓理财产品
  getCMBProducts: () =>
    fetchApi<any[]>('/cmb-products'),

  // 触发招行理财产品数据更新
  triggerCMBUpdate: () =>
    fetchApi<any>('/cmb-products/update', { method: 'POST' }),

  // 获取单个招行理财产品的净值历史
  getCmbProductNavHistory: (code: string) =>
    fetchApi<any>(`/cmb-products/${encodeURIComponent(code)}/nav-history`),

  // 按产品代码查询招行理财产品（用于添加持仓时自动关联）
  lookupCMBProduct: (code: string) =>
    fetchApi<any>(`/cmb-products/lookup/${encodeURIComponent(code)}`),

  // 从支付宝获取易方达基金数据（经理、净值等）
  fetchYiFangDaData: () =>
    fetchApi<any>('/funds/fetch-yifangda', { method: 'POST' }),

  // 获取金选基金列表
  getGoldFunds: (params?: {
    category?: string;
    industry?: string;
    search?: string;
    manager?: string;
    sort?: string;
    order?: string;
    minReturn?: number;
    maxFee?: number;
    minScale?: number;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
    }
    return fetchApi<any>(`/gold-funds?${query.toString()}`);
  },

  // 获取金选基金统计概览
  getGoldFundStats: () =>
    fetchApi<any>('/gold-funds/stats'),

  // 触发金选基金数据抓取（管理员）
  fetchGoldFundData: () =>
    fetchApi<any>('/funds/fetch-gold', { method: 'POST' }),

  // 目标规划测算
  calculateGoal: (params: { targetAmount: number; currentAmount?: number; monthlyContribution?: number; expectedReturn?: number; years: number }) =>
    fetchApi<any>('/goal-planning', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  // 估值中心（指数PE分位数据）
  getValuationCenter: () =>
    fetchApi<any[]>('/market/valuation-center'),

  // 指数估值趋势
  getIndexValuationTrend: (code: string, days: number) =>
    fetchApi<any>(`/market/valuation-trend?code=${encodeURIComponent(code)}&days=${days}`),

  // 基金诊断
  getFundDiagnosis: (code: string) =>
    fetchApi<any>(`/fund-diagnosis/${encodeURIComponent(code)}`),
};

export const authApi = {
  login: (username: string, password: string) =>
    fetchApi<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, nickname: string) =>
    fetchApi<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    }),
  getMe: () => fetchApi<{ user: User; oauthAccounts: Array<{ provider: string; provider_username: string }> }>('/auth/me'),
  getAlipayQrcode: () =>
    fetchApi<{ url: string; state: string; mock: boolean }>('/auth/alipay/qrcode'),
  alipayCheck: (state: string) =>
    fetchApi<{ status: string; token?: string; user?: User }>(`/auth/alipay/check?state=${state}`),
  alipayMockLogin: () =>
    fetchApi<{ token: string; user: User; mock: boolean }>('/auth/alipay/mock-login', {
      method: 'POST',
    }),
  guestLogin: () =>
    fetchApi<{ token: string; user: User }>('/auth/guest', {
      method: 'POST',
    }),
  changePassword: (oldPassword: string, newPassword: string) =>
    fetchApi<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
};

export const profileApi = {
  updateProfile: (data: { nickname?: string; avatar_url?: string }) =>
    fetchApi<{ success: boolean; message: string; user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getLoginHistory: () =>
    fetchApi<{ logs: Array<{ ip: string; user_agent: string; status: string; created_at: string }> }>('/auth/login-history'),
};

export const aiApi = {
  getHistory: (params: { sessionId?: string; limit?: number; before?: number | string }) => {
    const query = new URLSearchParams();
    if (params.sessionId) query.append('sessionId', params.sessionId);
    if (params.limit) query.append('limit', String(params.limit));
    if (params.before) query.append('before', String(params.before));
    return fetchApi<any>(`/ai/history?${query.toString()}`);
  },
  getSessions: () =>
    fetchApi<any>('/ai/sessions'),
  chatStream: async (message: string, sessionId: string, onChunk: (chunk: string) => void, onSessionId: (sid: string) => void, onError: (msg: string) => void, command?: string, args?: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, sessionId, command, args }),
      });
      if (!response.ok) {
        onError(`API error: ${response.status}`);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) { onError('No response body'); return; }
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              if (parsed.sessionId) onSessionId(parsed.sessionId);
              if (parsed.content) onChunk(parsed.content);
              if (parsed.error) onError(parsed.error);
            } catch {}
          }
        }
      }
    } catch (e: any) {
      onError(e.message || 'Stream error');
    }
  },
  clearHistory: (sessionId: string) =>
    fetchApi<any>('/ai/history', {
      method: 'DELETE',
      body: JSON.stringify({ sessionId }),
    }),
  sendFeedback: (messageId: string | number, sessionId: string, rating: 'up' | 'down') =>
    fetchApi<any>('/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({ messageId, sessionId, rating }),
    }),
  addFavorite: (messageId: string | number, sessionId: string, content: string) =>
    fetchApi<any>('/ai/favorites', {
      method: 'POST',
      body: JSON.stringify({ messageId, sessionId, content }),
    }),
  getFavorites: () =>
    fetchApi<any>('/ai/favorites'),
  removeFavorite: (messageId: string | number) =>
    fetchApi<any>(`/ai/favorites/${messageId}`, { method: 'DELETE' }),
};

export const portfolioApi = {
  initDemo: () =>
    fetchApi<{ message: string; imported: number }>('/portfolio/init-demo', {
      method: 'POST',
    }),
  getRecords: (fundCode?: string) =>
    fetchApi<FundRecord[]>(`/portfolio/records${fundCode ? `?fund_code=${fundCode}` : ''}`),
  addRecord: (record: Partial<FundRecord>) =>
    fetchApi<FundRecord>('/portfolio/records', {
      method: 'POST',
      body: JSON.stringify(record),
    }),
  updateRecord: (id: number, record: Partial<FundRecord>) =>
    fetchApi<FundRecord>(`/portfolio/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    }),
  deleteRecord: (id: number) =>
    fetchApi<{ message: string }>(`/portfolio/records/${id}`, { method: 'DELETE' }),
  getSummary: () => fetchApi<PortfolioSummary>('/portfolio/summary'),
  getReturnsMap: (year?: number) =>
    fetchApi<ReturnsMapResponse>(`/portfolio/returns-map${year ? `?year=${year}` : ''}`),
  getInsights: () => fetchApi<any>('/portfolio/insights'),
  getRiskProfile: () => fetchApi<any>('/portfolio/risk-profile'),
  saveRiskProfile: (profile: Record<string, unknown>) =>
    fetchApi<any>('/portfolio/risk-profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),
  importCSV: async (file: File): Promise<ImportResponse> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/portfolio/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '导入失败' }));
      throw new Error(err.error || '导入失败');
    }
    return res.json();
  },
  importAlipay: async (file: File): Promise<ImportResponse> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/portfolio/import-alipay`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '导入失败' }));
      throw new Error(err.error || '导入失败');
    }
    return res.json();
  },
  // 定投计划
  getDcaPlans: () => fetchApi<DcaPlan[]>('/portfolio/dca-plans'),
  addDcaPlan: (plan: Partial<DcaPlan>) =>
    fetchApi<DcaPlan>('/portfolio/dca-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    }),
  updateDcaPlan: (id: number, plan: Partial<DcaPlan>) =>
    fetchApi<DcaPlan>(`/portfolio/dca-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }),
  deleteDcaPlan: (id: number) =>
    fetchApi<{ message: string }>(`/portfolio/dca-plans/${id}`, { method: 'DELETE' }),
  syncDcaPlans: () =>
    fetchApi<{ synced: number; details: unknown[]; message: string }>('/portfolio/dca-plans/sync', {
      method: 'POST',
    }),
  refreshNav: () =>
    fetchApi<{ updated: number; validated: number; warnings: string[]; message: string }>('/portfolio/refresh-nav', {
      method: 'POST',
    }),
  getVIPInsights: () => fetchApi<any>('/portfolio/vip-insights'),

  // 卖出/赎回
  sell: (data: { fund_code: string; shares: number; sell_price: number; sell_date: string; sell_fee?: number; notes?: string }) =>
    fetchApi<SellResponse>('/portfolio/sell', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 交易历史
  getTransactions: (params?: { fund_code?: string; type?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
      });
    }
    return fetchApi<{ transactions: Transaction[]; total: number; page: number; stats: Record<string, number> }>(`/portfolio/transactions?${query.toString()}`);
  },

  // 手续费分析
  getFeeAnalysis: () => fetchApi<any>('/portfolio/fee-analysis'),

  // 持仓风险指标
  getHoldingsRisk: () => fetchApi<{ holdings: Array<{ fund_code: string; fund_name: string; sharpe: number; sortino: number; maxDrawdown: number; volatility: number }> }>('/portfolio/holdings-risk'),

  // 行业配置分析
  getIndustryAllocation: () => fetchApi<any>('/portfolio/industry-allocation'),

  // 业绩归因
  getPerformanceAttribution: () => fetchApi<any>('/portfolio/performance-attribution'),

  // 持仓重叠分析
  getOverlap: () => fetchApi<any>('/portfolio/overlap'),

  // 多账户资产台账
  getAssetAccounts: () => fetchApi<any[]>('/portfolio/asset-accounts'),
  getAssetAccountsSummary: () => fetchApi<{ byType: any[]; total: any }>('/portfolio/asset-accounts/summary'),
  addAssetAccount: (account: { account_type: string; account_name: string; balance?: number; cost_basis?: number; currency?: string; icon?: string; color?: string; notes?: string }) =>
    fetchApi<any>('/portfolio/asset-accounts', { method: 'POST', body: JSON.stringify(account) }),
  updateAssetAccount: (id: number, data: Partial<{ account_name: string; balance: number; cost_basis: number; currency: string; icon: string; color: string; notes: string; sort_order: number }>) =>
    fetchApi<any>(`/portfolio/asset-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssetAccount: (id: number) =>
    fetchApi<{ message: string }>(`/portfolio/asset-accounts/${id}`, { method: 'DELETE' }),

  // 交易流水导出
  exportTransactions: async (params?: { fund_code?: string; type?: string }) => {
    const token = localStorage.getItem('token');
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const res = await fetch(`/api/portfolio/transactions/export?${query.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `交易流水_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },
};

export const watchlistApi = {
  getList: () => fetchApi<any[]>('/watchlist'),
  add: (fund_code: string, fund_name?: string) =>
    fetchApi<any>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ fund_code, fund_name }),
    }),
  remove: (fund_code: string) =>
    fetchApi<any>(`/watchlist/${fund_code}`, { method: 'DELETE' }),
  check: (codes: string[]) =>
    fetchApi<Record<string, boolean>>('/watchlist/check', {
      method: 'POST',
      body: JSON.stringify({ codes }),
    }),
};

export const alertsApi = {
  getAlerts: () => fetchApi<any[]>('/alerts'),
};

export const marketEventsApi = {
  getEvents: (params?: { month?: number; category?: string; impact?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
      });
    }
    return fetchApi<{
      events: any[];
      byMonth: Record<number, any[]>;
      categoryConfig: Record<string, any>;
      impactConfig: Record<string, any>;
      total: number;
    }>(`/market-events?${query.toString()}`);
  },
};

export const newsApi = {
  getNews: (params?: { category?: string; impact?: string; keyword?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') query.append(key, String(value));
      });
    }
    return fetchApi<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
      lastFetchTime: string;
      categories: Record<string, any>;
    }>(`/news?${query.toString()}`);
  },
  getStats: () => fetchApi<any>('/news/stats'),
  getPersonalNews: () => fetchApi<{
    items: any[];
    total: number;
    holdings: any[];
    watchlist: any[];
    matchedIndustries: string[];
  }>('/news/personal'),
  refresh: () => fetchApi<any>('/news/refresh', { method: 'POST' }),
  // SSE 连接（使用 fetch + ReadableStream 避免 token 泄露到 URL）
  connectSSE: (onMessage: (data: any) => void) => {
    const token = localStorage.getItem('token');
    const controller = new AbortController();

    const connect = async () => {
      try {
        const res = await fetch('/api/news/stream', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onMessage(data);
              } catch {}
            }
          }
        }
      } catch {}
    };
    connect();
    return controller;
  },
};

export const adminApi = {
  // User management
  getUsers: (params?: { search?: string; role?: string; status?: string; page?: number; pageSize?: number; sort?: string; order?: string }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<{ users: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/admin/users?${query.toString()}`);
  },
  getUserStats: () => fetchApi<any>('/admin/users/stats'),
  getUserDetail: (id: number) => fetchApi<any>(`/admin/users/${id}`),
  editUser: (id: number, data: { nickname?: string; avatar_url?: string }) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // VIP management
  grantVip: (id: number, days?: number, plan_name?: string) =>
    fetchApi<{ success: boolean; message: string; expiresAt: string }>(`/admin/users/${id}/vip`, { method: 'PUT', body: JSON.stringify({ action: 'grant', days: days || 30, plan_name }) }),
  revokeVip: (id: number) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/users/${id}/vip`, { method: 'PUT', body: JSON.stringify({ action: 'revoke' }) }),
  extendVip: (id: number, days?: number) =>
    fetchApi<{ success: boolean; message: string; expiresAt: string }>(`/admin/users/${id}/vip`, { method: 'PUT', body: JSON.stringify({ action: 'extend', days: days || 30 }) }),
  getVipDetail: (id: number) =>
    fetchApi<any>(`/admin/users/${id}/vip`),
  getSubscriptions: () =>
    fetchApi<{ plans: any[]; stats: any }>('/admin/subscriptions'),
  updateUserRole: (id: number, role: string) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateUserStatus: (id: number, status: string) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  resetPassword: (id: number) =>
    fetchApi<{ success: boolean; newPassword: string; message: string }>(`/admin/users/${id}/reset-password`, { method: 'POST' }),
  deleteUser: (id: number) =>
    fetchApi<{ success: boolean; message: string }>(`/admin/users/${id}`, { method: 'DELETE' }),
  batchOperation: (ids: number[], action: string, role?: string) =>
    fetchApi<{ success: boolean; message: string }>('/admin/users/batch', { method: 'POST', body: JSON.stringify({ ids, action, role }) }),
  exportUsers: async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/users/export', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  // User notes
  getUserNotes: (id: number) => fetchApi<{ notes: any[] }>(`/admin/users/${id}/notes`),
  addUserNote: (id: number, content: string) =>
    fetchApi<{ success: boolean; note: any }>(`/admin/users/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteNote: (id: number) => fetchApi<{ success: boolean }>(`/admin/notes/${id}`, { method: 'DELETE' }),

  // Login logs
  getLoginLogs: (params?: { user_id?: number; status?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<any>(`/admin/login-logs?${query.toString()}`);
  },

  // Online users
  getOnlineUsers: () => fetchApi<any>('/admin/online-users'),

  // Audit logs
  getAuditLogs: (params?: { action?: string; admin_id?: number; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<any>(`/admin/audit-logs?${query.toString()}`);
  },

  // System settings
  getSettings: () => fetchApi<{ config: Record<string, { value: string; description: string }> }>('/admin/settings'),
  updateSettings: (settings: Record<string, string>) =>
    fetchApi<{ success: boolean; message: string }>('/admin/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),

  // Alert rules
  getAlertRules: () => fetchApi<{ rules: any[] }>('/admin/alerts/rules'),
  createAlertRule: (rule: any) => fetchApi<{ success: boolean; rule: any }>('/admin/alerts/rules', { method: 'POST', body: JSON.stringify(rule) }),
  updateAlertRule: (id: number, rule: any) => fetchApi<{ success: boolean }>(`/admin/alerts/rules/${id}`, { method: 'PUT', body: JSON.stringify(rule) }),
  deleteAlertRule: (id: number) => fetchApi<{ success: boolean }>(`/admin/alerts/rules/${id}`, { method: 'DELETE' }),
  getAlertHistory: (params?: { status?: string; severity?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<any>(`/admin/alerts/history?${query.toString()}`);
  },
  resolveAlert: (id: number) => fetchApi<{ success: boolean }>(`/admin/alerts/history/${id}/resolve`, { method: 'POST' }),

  // API stats
  getApiStats: (hours?: number) => fetchApi<any>(`/admin/api-stats${hours ? `?hours=${hours}` : ''}`),

  // Health check
  getHealthCheck: () => fetchApi<any>('/admin/health-check'),

  // System events
  getSystemEvents: (params?: { type?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<any>(`/admin/system-events?${query.toString()}`);
  },

  // System monitoring
  getMetrics: () => fetchApi<any>('/admin/metrics'),
  getServerResources: () => fetchApi<any>('/admin/server-resources'),
  getDbDetails: () => fetchApi<any>('/admin/db-details'),
  getTableSpace: () => fetchApi<any>('/admin/table-space'),
  getLogs: (params?: { level?: string; keyword?: string; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<any>(`/admin/logs?${query.toString()}`);
  },
};

export const subscriptionApi = {
  getPlans: () => fetchApi<{ plans: any[] }>('/subscription/plans'),
  createOrder: (planId?: number) =>
    fetchApi<{ orderId: number; outTradeNo: string; amount: number; planName: string; qrCodeUrl: string; qrCodeBase64: string }>(
      '/subscription/create-order', { method: 'POST', body: JSON.stringify({ planId }) }
    ),
  checkOrder: (outTradeNo: string) =>
    fetchApi<{ paid: boolean }>('/subscription/check-order', { method: 'POST', body: JSON.stringify({ outTradeNo }) }),
  getStatus: () => fetchApi<{ isPremium: boolean; expiresAt: string; planName: string; daysRemaining: number }>('/subscription/status'),
  getOrders: () => fetchApi<{ orders: any[] }>('/subscription/orders'),
};

export const stockPickerApi = {
  rankFunds: (params: { industry?: string; type?: string; limit?: number; factors?: Record<string, { weight: number }> }) =>
    fetchApi<{ ranked: any[]; total: number; factors: any; industryStats: any }>('/stock-picker/rank', { method: 'POST', body: JSON.stringify(params) }),
  getFactors: () => fetchApi<{ factors: any }>('/stock-picker/factors'),
  backtest: (codes: string[], days?: number, benchmarkCode?: string) =>
    fetchApi<{ dates: string[]; portfolio: number[]; benchmark: number[]; summary: any; benchmarkCode: string; benchmarkName: string; availableBenchmarks: any[] }>('/stock-picker/backtest', { method: 'POST', body: JSON.stringify({ codes, days, benchmarkCode }) }),
  buildPortfolio: (params: { topN?: number; budget?: number; strategy?: string; factors?: Record<string, { weight: number }>; industry?: string; type?: string }) =>
    fetchApi<{ allocation: any[]; totalBudget: number; perFund: number; strategy: string; factors: any }>('/stock-picker/portfolio', { method: 'POST', body: JSON.stringify(params) }),
  getMarketOverview: () =>
    fetchApi<{ indices: any[]; sectors: any[]; capitalFlow: any; industryValuation: any[]; sentiment: any }>('/stock-picker/market-overview'),
  strategyCompare: (params: { industry?: string; type?: string; limit?: number }) =>
    fetchApi<{ strategies: Record<string, any>; overlap: any; totalFunds: number }>('/stock-picker/strategy-compare', { method: 'POST', body: JSON.stringify(params) }),
  deepAnalysis: (codes: string[]) =>
    fetchApi<{ results: any[] }>('/stock-picker/deep-analysis', { method: 'POST', body: JSON.stringify({ codes }) }),
  quantPicks: () =>
    fetchApi<{ picks: any[]; totalScanned: number; passedFilter: number; industryStats: any; criteria: any }>('/stock-picker/quant-picks', { method: 'POST' }),
  // 用户持久化
  getScreeners: () => fetchApi<any[]>('/stock-picker/screeners'),
  saveScreener: (data: { name: string; description?: string; filters: any; is_default?: boolean }) =>
    fetchApi<any>('/stock-picker/screeners', { method: 'POST', body: JSON.stringify(data) }),
  deleteScreener: (id: number) => fetchApi<any>(`/stock-picker/screeners/${id}`, { method: 'DELETE' }),
  getHistory: (params?: { page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v) q.append(k, String(v)); });
    return fetchApi<any>(`/stock-picker/history?${q.toString()}`);
  },
  savePickHistory: (data: { strategy: string; filters: any; results: any[] }) =>
    fetchApi<any>('/stock-picker/history', { method: 'POST', body: JSON.stringify(data) }),
  getPortfolios: () => fetchApi<any[]>('/stock-picker/portfolios'),
  savePortfolio: (data: { name: string; strategy: string; budget: number; allocation: any[]; backtest_summary?: any }) =>
    fetchApi<any>('/stock-picker/portfolios', { method: 'POST', body: JSON.stringify(data) }),
  deletePortfolio: (id: number) => fetchApi<any>(`/stock-picker/portfolios/${id}`, { method: 'DELETE' }),
  // 指数温度
  getTemperature: () => fetchApi<any[]>('/stock-picker/temperature'),
  // 自然语言筛选 (SVIP)
  nlScreen: (query: string) =>
    fetchApi<{ parsed: any; results: any[]; total: number; suggestion?: string }>('/stock-picker/nl-screen', { method: 'POST', body: JSON.stringify({ query }) }),
  // 相关性分析
  correlation: (codes: string[]) =>
    fetchApi<any>('/stock-picker/correlation', { method: 'POST', body: JSON.stringify({ codes }) }),
  // 提醒规则
  getAlerts: () => fetchApi<any[]>('/stock-picker/alerts'),
  saveAlert: (data: { name: string; rule_type: string; conditions: any }) =>
    fetchApi<any>('/stock-picker/alerts', { method: 'POST', body: JSON.stringify(data) }),
  deleteAlert: (id: number) => fetchApi<any>(`/stock-picker/alerts/${id}`, { method: 'DELETE' }),
};

export const fundCompareApi = {
  analyze: (codes: string[]) =>
    fetchApi<{ funds: any[]; navHistories: Record<string, any[]> }>('/fund-compare/analyze', { method: 'POST', body: JSON.stringify({ codes }) }),
  premiumAnalyze: (codes: string[]) =>
    fetchApi<{ results: any[]; attribution: any; recommendation: any }>('/fund-compare/premium', { method: 'POST', body: JSON.stringify({ codes }) }),
};
