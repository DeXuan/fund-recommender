const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
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
  }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) query.append(key, value);
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

  getMarketIndices: () =>
    fetchApi<any[]>('/market/indices'),

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
};
