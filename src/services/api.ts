const API_BASE = '/api';

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
    return fetchApi<any[]>(`/funds?${query.toString()}`);
  },

  getFundDetail: (code: string) =>
    fetchApi<any>(`/funds/${encodeURIComponent(code)}`),

  getQDIIFunds: () =>
    fetchApi<any[]>('/funds/qdii'),

  getHS300Funds: () =>
    fetchApi<any[]>('/funds/hs300'),

  getMarketIndices: async () => {
    const data = await fetchApi<any>('/market/indices');
    return data.indices || data; // 兼容新旧格式
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
};

export const authApi = {
  login: (username: string, password: string) =>
    fetchApi<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, nickname: string) =>
    fetchApi<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    }),
  getMe: () => fetchApi<{ user: any; oauthAccounts: any[] }>('/auth/me'),
  getAlipayQrcode: () =>
    fetchApi<{ url: string; state: string; mock: boolean }>('/auth/alipay/qrcode'),
  alipayCheck: (state: string) =>
    fetchApi<{ status: string; token?: string; user?: any }>(`/auth/alipay/check?state=${state}`),
  alipayMockLogin: () =>
    fetchApi<{ token: string; user: any; mock: boolean }>('/auth/alipay/mock-login', {
      method: 'POST',
    }),
  changePassword: (oldPassword: string, newPassword: string) =>
    fetchApi<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
};

export const portfolioApi = {
  initDemo: () =>
    fetchApi<{ message: string; imported: number }>('/portfolio/init-demo', {
      method: 'POST',
    }),
  getRecords: (fundCode?: string) =>
    fetchApi<any[]>(`/portfolio/records${fundCode ? `?fund_code=${fundCode}` : ''}`),
  addRecord: (record: any) =>
    fetchApi<any>('/portfolio/records', {
      method: 'POST',
      body: JSON.stringify(record),
    }),
  updateRecord: (id: number, record: any) =>
    fetchApi<any>(`/portfolio/records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(record),
    }),
  deleteRecord: (id: number) =>
    fetchApi<any>(`/portfolio/records/${id}`, { method: 'DELETE' }),
  getSummary: () => fetchApi<any>('/portfolio/summary'),
  getReturnsMap: (year?: number) =>
    fetchApi<any>(`/portfolio/returns-map${year ? `?year=${year}` : ''}`),
  getInsights: () => fetchApi<any>('/portfolio/insights'),
  getRiskProfile: () => fetchApi<any>('/portfolio/risk-profile'),
  saveRiskProfile: (profile: any) =>
    fetchApi<any>('/portfolio/risk-profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),
  importCSV: async (file: File) => {
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
  importAlipay: async (file: File) => {
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
  getDcaPlans: () => fetchApi<any[]>('/portfolio/dca-plans'),
  addDcaPlan: (plan: any) =>
    fetchApi<any>('/portfolio/dca-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    }),
  updateDcaPlan: (id: number, plan: any) =>
    fetchApi<any>(`/portfolio/dca-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(plan),
    }),
  deleteDcaPlan: (id: number) =>
    fetchApi<any>(`/portfolio/dca-plans/${id}`, { method: 'DELETE' }),
  syncDcaPlans: () =>
    fetchApi<{ synced: number; details: any[]; message: string }>('/portfolio/dca-plans/sync', {
      method: 'POST',
    }),
  refreshNav: () =>
    fetchApi<{ updated: number; validated: number; warnings: string[]; message: string }>('/portfolio/refresh-nav', {
      method: 'POST',
    }),
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

export const adminApi = {
  // User management
  getUsers: (params?: { search?: string; role?: string; status?: string; page?: number; pageSize?: number; sort?: string; order?: string }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<{ users: any[]; total: number; page: number; pageSize: number; totalPages: number }>(`/admin/users?${query.toString()}`);
  },
  getUserStats: () => fetchApi<any>('/admin/users/stats'),
  getUserDetail: (id: number) => fetchApi<any>(`/admin/users/${id}`),
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

  // Audit logs
  getAuditLogs: (params?: { action?: string; admin_id?: number; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') query.append(k, String(v)); });
    return fetchApi<any>(`/admin/audit-logs?${query.toString()}`);
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
