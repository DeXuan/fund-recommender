import type {
  Fund,
  FundDetail,
  MarketIndex,
  IndustryAnalysis,
  HS300Analysis,
  PortfolioSummary,
  PortfolioHolding,
  User,
  SubscriptionPlan,
  SubscriptionOrder,
  StockPickResult,
  RiskProfile,
  DCAInput,
  DCAOutput,
} from './index';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type FundListResponse = PaginatedResponse<Fund> | Fund[];

export interface MarketIndicesResponse {
  indices: MarketIndex[];
  usIndices?: MarketIndex[];
}

export interface Sector {
  name: string;
  change: number;
  changePercent?: number;
  netFlow?: number;
  rank?: number;
}

export interface SectorsResponse {
  sectors: Sector[];
}

export interface NorthboundTrend {
  time: string;
  sh: number;
  sz: number;
  total: number;
}

export interface MainFlowItem {
  name: string;
  net: number;
  ratio?: number;
}

export interface CapitalFlowResponse {
  northbound: { trend: NorthboundTrend[]; total?: number };
  mainFlow: MainFlowItem[];
  lastUpdate: string;
}

export interface IndustryRecommendationListResponse {
  recommendations: import('./index').IndustryRecommendation[];
}

export interface BatchPlanListResponse {
  plans: import('./index').BatchPlan[];
}

export interface RiskProfileResponse {
  recommendation: {
    allocation: { industry: string; percentage: number }[];
    suggestion: string;
  };
}

export interface FundCompareResponse {
  funds: Fund[];
  comparison: {
    metrics: string[];
    data: Record<string, number | string>[];
  };
}

export interface StatusResponse {
  lastUpdate: string;
  status: string;
  isTrading: boolean;
  nextUpdate?: string;
}

export interface UpdateResponse {
  success: boolean;
  message: string;
  updated?: number;
}

export interface CmbProduct {
  code: string;
  name: string;
  type: string;
  riskLevel: string;
  nav: number;
  navDate: string;
  cumulativeReturn: number;
}

export interface CmbProductDetail extends CmbProduct {
  navHistory: { date: string; nav: number }[];
  description?: string;
}

export interface GoldFundStats {
  total: number;
  byCategory: Record<string, number>;
  avgReturn1y: number;
}

export interface GoalPlanningResponse {
  targetAmount: number;
  monthlyInvestment: number;
  expectedReturn: number;
  years: number;
  achievable: boolean;
  projection: { month: number; value: number; invested: number }[];
}

export interface ValuationTrendResponse {
  code: string;
  name: string;
  history: { date: string; pe: number | null; pb: number | null; pePercentile: number | null }[];
}

export interface FundDiagnosisResponse {
  code: string;
  name: string;
  profitability: { score: number; analysis: string };
  riskResistance: { score: number; analysis: string };
  feeAnalysis: { score: number; analysis: string };
  peerComparison: { rank: number; total: number; analysis: string };
  overall: { score: number; rating: string; suggestion: string };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  session_id?: string;
  data?: unknown;
  feedback?: number;
  is_favorite?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  hasMore: boolean;
}

export interface PortfolioInsightsResponse {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalReturn: number;
  insights: { title: string; description: string; type: string }[];
}

export interface VipInsightsResponse {
  categories: { name: string; weight: number; funds: string[] }[];
  suggestions: { title: string; description: string; type: string }[];
  riskScore: number;
}

export interface FeeAnalysisResponse {
  totalFee: number;
  feeBreakdown: { fund: string; fee: number; percentage: number }[];
  suggestion: string;
}

export interface IndustryAllocationResponse {
  allocations: { industry: string; percentage: number; funds: string[] }[];
}

export interface PerformanceAttributionResponse {
  benchmark: string;
  alpha: number;
  beta: number;
  attribution: { factor: string; contribution: number }[];
}

export interface OverlapResponse {
  overlap: { fundA: string; fundB: string; overlap: number; sharedHoldings: string[] }[];
  diversificationScore: number;
}

export interface AssetAccount {
  id: number;
  name: string;
  type: string;
  balance: number;
  cost: number;
  currency?: string;
  icon?: string;
  color?: string;
}

export interface AssetAccountsSummaryResponse {
  byType: { type: string; total: number; count: number }[];
  total: number;
}

export interface WatchlistItem {
  fund_code: string;
  fund_name: string;
  group?: string;
  sort_order?: number;
}

export interface NewsItem {
  id: string;
  title: string;
  content?: string;
  source: string;
  time: string;
  url?: string;
  category?: string;
  impact?: string;
}

export interface NewsResponse {
  items: NewsItem[];
  total: number;
}

export interface NewsStatsResponse {
  total: number;
  today: number;
  byCategory: Record<string, number>;
}

export interface AdminUserListResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUserStatsResponse {
  total: number;
  active: number;
  disabled: number;
  premium: number;
  svip: number;
  newToday: number;
}

export interface AdminNote {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface LoginLog {
  id: number;
  user_id: number;
  username: string;
  login_ip: string;
  browser: string;
  os: string;
  device: string;
  status: string;
  fail_reason?: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  admin_id: number;
  action: string;
  target: string;
  details?: string;
  created_at: string;
}

export interface AlertRule {
  id: number;
  name: string;
  type: string;
  condition: string;
  enabled: boolean;
}

export interface ApiStatsResponse {
  totalRequests: number;
  byEndpoint: { endpoint: string; count: number; avgResponseTime: number }[];
  byHour: { hour: number; count: number }[];
}

export interface SystemEvent {
  id: number;
  type: string;
  message: string;
  severity: string;
  created_at: string;
}

export interface StockRankResponse {
  ranked: StockPickResult[];
  total: number;
  factors: Record<string, number>;
  industryStats: { industry: string; count: number; avgScore: number; avgReturn: number }[];
}

export interface BacktestResponse {
  dates: string[];
  portfolio: number[];
  benchmark: number[];
  summary: { totalReturn: number; annualizedReturn: number; maxDrawdown: number; sharpe: number };
  benchmarkCode: string;
  benchmarkName: string;
  availableBenchmarks: { code: string; name: string }[];
}

export interface PortfolioOptimizationResponse {
  allocation: { code: string; name: string; weight: number; amount: number }[];
  totalBudget: number;
  perFund: number;
  strategy: string;
  factors: Record<string, number>;
}

export interface MarketOverviewResponse {
  indices: MarketIndex[];
  sectors: Sector[];
  capitalFlow: CapitalFlowResponse;
  industryValuation: { industry: string; pePercentile: number; pbPercentile: number }[];
  sentiment: { score: number; level: string };
}

export interface StrategyCompareResponse {
  strategies: Record<string, StockPickResult[]>;
  overlap: { fundA: string; fundB: string; overlap: number }[];
  totalFunds: number;
}

export interface DeepAnalysisResponse {
  results: {
    code: string;
    name: string;
    sharpe: number;
    sortino: number;
    calmar: number;
    maxDrawdown: number;
    monthlyReturns: number[];
  }[];
}

export interface QuantPicksResponse {
  picks: StockPickResult[];
  totalScanned: number;
  passedFilter: number;
  industryStats: { industry: string; count: number }[];
  criteria: Record<string, number | string>;
}

export interface Screener {
  id: number;
  name: string;
  description?: string;
  filters: Record<string, unknown>;
  is_default?: boolean;
}

export interface PickHistoryItem {
  id: number;
  strategy: string;
  filters: Record<string, unknown>;
  results: StockPickResult[];
  created_at: string;
}

export interface SavedPortfolio {
  id: number;
  name: string;
  strategy: string;
  budget: number;
  allocation: { code: string; name: string; weight: number }[];
  backtest_summary?: Record<string, number>;
}

export interface SubscriptionPlansResponse {
  plans: SubscriptionPlan[];
}

export interface SubscriptionOrdersResponse {
  orders: SubscriptionOrder[];
}

export interface DcaResult extends DCAOutput {}

export interface ValuationCenterItem {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  pe: number | null;
  pb: number | null;
  pePercentile: number | null;
  pbPercentile: number | null;
  roe: number | null;
  dividendYield: number | null;
  valuation: string | null;
  suggestion: string | null;
  history: {
    dataPoints: number;
    peMin: number | null;
    peMax: number | null;
    peAvg: number | null;
    pbMin: number | null;
    pbMax: number | null;
    pbAvg: number | null;
  };
  trend: { pe: number; pb: number; date: string }[];
}

export interface IndexValuationTrendResponse {
  data: Array<{ date: string; pe: number | null; pb: number | null; pePercentile?: number | null }>;
}

export interface CmbProductNavHistoryResponse {
  product_code: string;
  product_name: string;
  risk_level: string;
  product_status: string;
  nav_history: Array<{ unit_nav: number; cumulative_nav: number | null; nav_date: string; cumulative_return: number }>;
}

export interface SP500AnalysisResponse {
  valuation: {
    name: string;
    pe: number;
    pb: number;
    pePercentile: number;
    pbPercentile: number;
    valuation: string;
    suggestion: string;
    roe: number;
    dividendYield: number;
    currentPrice: number;
  };
  funds: Array<{
    code: string;
    name: string;
    type: string;
    managementFee: number;
    custodyFee: number;
    totalFee: number;
    scale: number;
    return1y: number;
    return6m: number;
    return3m: number;
    return1m: number;
    return1w: number;
    purchaseStatus: string;
    dailyLimit: number;
    rating: number;
    isGoldSelected: boolean;
    buySuggestion: string;
  }>;
  topHoldings: Array<{ name: string; code: string; weight: number; industry: string; pe: number; roe: number; revenueGrowth: number; epsGrowth: number; analystConsensus: string; outlook: string }>;
  recommendation: {
    summary: string;
    bullFactors: string[];
    bearFactors: string[];
    strategy: { shortTerm: string; mediumTerm: string; longTerm: string };
    bestPicks: Array<{ code: string; name: string; reason: string }>;
    batchPlan: Array<{ batch: number; time: string; pct: number; action: string; reason: string }>;
  };
}

export interface SystemMetricsResponse {
  timestamp: number;
  qps: number;
  connections: { active: number };
  database: { cacheHitRatio: number; activeSlowQueries: number };
}

export interface AdminLogsResponse {
  logs: Array<Record<string, unknown>>;
  total: number;
  totalPages: number;
  page?: number;
}

export interface AlertHistoryResponse {
  history: unknown[];
  stats: unknown;
  total?: number;
  page?: number;
  totalPages?: number;
}

export interface CorrelationResponse {
  correlationMatrix: number[][];
  fundNames: string[];
  diversificationScore: number;
  highCorrelationPairs: Array<{ a: string; b: string; aName: string; bName: string; correlation: number }>;
  suggestion: string;
}

export interface NewsListResponse {
  items: NewsItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastFetchTime: string;
  categories: Record<string, unknown>;
}

export interface PersonalNewsResponse {
  items: NewsItem[];
  total: number;
  holdings: unknown[];
  watchlist: unknown[];
  matchedIndustries: string[];
}

export interface MarketEventItem {
  month: number;
  [key: string]: unknown;
}

export interface MarketEventsResponse {
  events: MarketEventItem[];
  byMonth: Record<number, MarketEventItem[]>;
  categoryConfig: Record<string, unknown>;
  impactConfig: Record<string, unknown>;
  total: number;
}

export interface AdminSubscriptionsResponse {
  plans: SubscriptionPlan[];
  stats: Record<string, unknown>;
}

export interface LoginLogsResponse {
  logs: LoginLog[];
  total: number;
  stats: Record<string, unknown>;
  page?: number;
  totalPages?: number;
}

export interface PickHistoryListResponse {
  items: PickHistoryItem[];
  total: number;
  page?: number;
  totalPages?: number;
}

export interface FundCompareAnalyzeResponse {
  results: Array<{ code: string; riskMetrics?: { volatility: number; maxDrawdown: number; sharpeRatio: number; calmarRatio: number } }>;
  attribution: Record<string, unknown>;
  recommendation: Record<string, unknown>;
}

export interface FundComparePremiumResponse {
  results: unknown[];
  attribution: Record<string, unknown>;
  recommendation: Record<string, unknown>;
}

export { type Fund, type FundDetail, type MarketIndex, type IndustryAnalysis, type HS300Analysis, type PortfolioSummary, type PortfolioHolding, type User, type RiskProfile, type DCAInput, type DCAOutput };
