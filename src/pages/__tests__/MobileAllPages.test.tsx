import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// ===== 通用依赖 mock =====
vi.mock('../../services/api', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), getMe: vi.fn(), alipayQrcode: vi.fn(), alipayCheck: vi.fn(), guestLogin: vi.fn() },
  profileApi: { getProfile: vi.fn().mockResolvedValue({}), updateProfile: vi.fn(), getLoginHistory: vi.fn().mockResolvedValue([]) },
  alertsApi: { getAlerts: vi.fn().mockResolvedValue([]) },
  marketEventsApi: { getEvents: vi.fn().mockResolvedValue({ items: [] }) },
  adminApi: { getUsers: vi.fn().mockResolvedValue([]), getMonitor: vi.fn().mockResolvedValue({}) },
  fundApi: {
    getFunds: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getIndustries: vi.fn().mockResolvedValue([]),
    getManagers: vi.fn().mockResolvedValue([]),
    getStarManagers: vi.fn().mockResolvedValue([]),
    getGoldFundStats: vi.fn().mockResolvedValue({ total: 0, stats: {} }),
    getFundDetail: vi.fn().mockResolvedValue({}),
    getFundNavHistory: vi.fn().mockResolvedValue([]),
    getQDIIFunds: vi.fn().mockResolvedValue([]),
    compareFunds: vi.fn().mockResolvedValue({}),
    compareNavHistory: vi.fn().mockResolvedValue([]),
    getHS300: vi.fn().mockResolvedValue([]),
    getFundDist: vi.fn().mockResolvedValue({}),
    getGoldFunds: vi.fn().mockResolvedValue([]),
    getRecentFunds: vi.fn().mockResolvedValue([]),
  },
  marketApi: {
    getIndices: vi.fn().mockResolvedValue([]),
    getSectors: vi.fn().mockResolvedValue([]),
    getCapitalFlow: vi.fn().mockResolvedValue([]),
    getValuationTrend: vi.fn().mockResolvedValue([]),
    getValuationCenter: vi.fn().mockResolvedValue([]),
  },
  portfolioApi: {
    getSummary: vi.fn().mockResolvedValue({ holdings: [] }),
    getRecords: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue({ items: [] }),
    loadTransactions: vi.fn(),
    getRiskProfile: vi.fn().mockResolvedValue(null),
    getAssetAccounts: vi.fn().mockResolvedValue([]),
    getInsights: vi.fn().mockResolvedValue({}),
    getBenchmark: vi.fn().mockResolvedValue([]),
    getIndustryAllocation: vi.fn().mockResolvedValue([]),
    getPerformanceAttribution: vi.fn().mockResolvedValue([]),
    initDemo: vi.fn(),
  },
  watchlistApi: { batchCheck: vi.fn().mockResolvedValue({}), add: vi.fn(), remove: vi.fn(), getList: vi.fn().mockResolvedValue([]) },
  eventApi: { getEvents: vi.fn().mockResolvedValue({ items: [] }) },
  newsApi: {
    getNews: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getStats: vi.fn().mockResolvedValue({ total: 0, categories: {} }),
    getPersonalNews: vi.fn().mockResolvedValue({ items: [], holdings: [], watchlist: [], matchedIndustries: [] }),
    refresh: vi.fn().mockResolvedValue({}),
    connectSSE: vi.fn().mockImplementation((onMessage: (d: any) => void) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => onMessage && onMessage({ type: 'ping' }), 50);
      ctrl.signal.addEventListener('abort', () => clearTimeout(id));
      return { signal: ctrl.signal, abort: () => ctrl.abort() };
    }),
  },
  cmbApi: { getProducts: vi.fn().mockResolvedValue([]), getProductDetail: vi.fn().mockResolvedValue({}) },
  aiApi: {
    getSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue({}),
    getHistory: vi.fn().mockResolvedValue([]),
    chatStream: vi.fn(),
    clearHistory: vi.fn().mockResolvedValue({}),
    sendFeedback: vi.fn().mockResolvedValue({}),
    addFavorite: vi.fn().mockResolvedValue({}),
    getFavorites: vi.fn().mockResolvedValue([]),
    removeFavorite: vi.fn().mockResolvedValue({}),
  },
  valuationApi: { getValuation: vi.fn().mockResolvedValue([]) },
  subscriptionApi: { getPlans: vi.fn().mockResolvedValue([]) },
  stockPickerApi: {
    getFactors: vi.fn().mockResolvedValue({}),
    rank: vi.fn().mockResolvedValue({}),
    backtest: vi.fn().mockResolvedValue({}),
    getMarketOverview: vi.fn().mockResolvedValue({}),
    getScreeners: vi.fn().mockResolvedValue([]),
    getHistory: vi.fn().mockResolvedValue([]),
    getPortfolios: vi.fn().mockResolvedValue([]),
    getTemperature: vi.fn().mockResolvedValue({}),
    getAlerts: vi.fn().mockResolvedValue([]),
  },
  fundCompareApi: { premiumAnalyze: vi.fn() },
  fundDiagnosisApi: { diagnose: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'test', role: 'admin' }, loading: false, setUser: vi.fn(), logout: vi.fn() }),
}));

// antd/ECharts 环境不足时的兜底
vi.mock('echarts', () => ({
  init: () => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn() }),
  getInstanceByDom: () => null,
}));

// 页面组件
import Home from '../Home';
import FundList from '../FundList';
import QDIIFunds from '../QDIIFunds';
import IndustryAnalysis from '../IndustryAnalysis';
import MarketEvents from '../MarketEvents';
import CMBProducts from '../CMBProducts';
import CMBProductDetail from '../CMBProductDetail';
import FundCompare from '../FundCompare';
import About from '../About';
import Subscription from '../Subscription';
import ValuationCenter from '../ValuationCenter';
import AIAssistant from '../AIAssistant';
import Portfolio from '../Portfolio';
import StockPicker from '../StockPicker';
import PortfolioOverlap from '../PortfolioOverlap';
import Profile from '../Profile';
import FundDiagnosis from '../FundDiagnosis';
import FundDetail from '../FundDetail';

describe('移动端 (412px) 全页面渲染', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const cases: Array<[string, React.ReactElement]> = [
    ['首页 Home', <Home />],
    ['基金列表 FundList', <FundList />],
    ['QDII QDIIFunds', <QDIIFunds />],
    ['行业分析 IndustryAnalysis', <IndustryAnalysis />],
    ['事件日历 MarketEvents', <MarketEvents />],
    ['招行理财 CMBProducts', <CMBProducts />],
    ['招行理财详情 CMBProductDetail', <CMBProductDetail />],
    ['基金对比 FundCompare', <FundCompare />],
    ['关于 About', <About />],
    ['订阅 Subscription', <Subscription />],
    ['估值中心 ValuationCenter', <ValuationCenter />],
    ['AI 助手 AIAssistant', <AIAssistant />],
    ['持仓管理 Portfolio', <Portfolio />],
    ['AI 选股 StockPicker', <StockPicker />],
    ['持仓重叠 PortfolioOverlap', <PortfolioOverlap />],
    ['个人中心 Profile', <Profile />],
    ['基金诊断 FundDiagnosis', <FundDiagnosis />],
    ['基金详情 FundDetail', <FundDetail />],
  ];

  for (const [name, el] of cases) {
    it(`${name} 移动端渲染不崩溃`, () => {
      const { container } = render(<BrowserRouter>{el}</BrowserRouter>);
      expect(container).toBeTruthy();
      expect(container.querySelectorAll('*').length).toBeGreaterThan(0);
    });
  }
});