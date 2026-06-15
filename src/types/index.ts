export interface Fund {
  code: string;
  name: string;
  type: 'A' | 'C';
  company: string;
  index: string;
  nav: number;
  navDate: string;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  managementFee: number;
  custodyFee: number;
  serviceFee: number;
  purchaseFee: number;
  purchaseFeeDiscount: number;
  redeemFee: RedeemFee[];
  totalFee: number;
  scale: number;
  share: number;
  shareChange: number;
  institutionHold: number;
  individualHold: number;
  purchaseStatus: 'open' | 'limited' | 'suspended';
  dailyLimit: number;
  rating: number;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  industry: string;
}

export interface RedeemFee {
  period: string;
  rate: number;
}

export interface FundDetail extends Fund {
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  valuation: 'very_low' | 'low' | 'reasonable' | 'high' | 'very_high';
  topHoldings: Holding[];
  performanceHistory: PerformanceRecord[];
}

export interface Holding {
  name: string;
  percentage: number;
}

export interface PerformanceRecord {
  date: string;
  nav: number;
  return: number;
}

export interface MarketIndex {
  name: string;
  code: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  pe: number | null;
  pb: number | null;
  pePercentile: number | null;
  pbPercentile: number | null;
  valuation: string;
  suggestion: string;
}

export interface IndustryRecommendation {
  rank: number;
  industry: string;
  fundName: string;
  fundCode: string;
  index: string;
  rating: number;
  return1y: number;
  return3m: number;
  return1m: number;
  trend: string;
  valuation: string;
  buySuggestion: string;
  positionSuggestion: string;
  logic: string;
}

export interface BatchPlan {
  batch: number;
  time: string;
  percentage: number;
  targets: string;
  method: string;
  reason: string;
}

export interface RiskProfile {
  age: string;
  investmentAmount: string;
  investmentPeriod: string;
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  lossTolerance: string;
}

export interface DCAInput {
  monthlyAmount: number;
  period: number;
  expectedReturn: number;
}

export interface DCAOutput {
  totalInvestment: number;
  totalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  monthlyDetails: DCAMonth[];
}

export interface DCAMonth {
  month: number;
  investment: number;
  cumulativeInvestment: number;
  value: number;
  return: number;
}

// 行业基金分析
export interface IndustryAnalysis {
  industry: string;
  trend: string;
  valuation: string;
  buySuggestion: string;
  logic: string;
  fundCount: number;
  funds: IndustryFund[];
  batchPlan: IndustryBatchPlan[];
  riskWarning: string;
}

export interface IndustryFund {
  code: string;
  name: string;
  type: string;
  index: string;
  nav: number;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  managementFee: number;
  custodyFee: number;
  serviceFee: number;
  totalFee: number;
  purchaseFee: string;
  redeemFee: string;
  dailyLimit: number;
  scale: number;
  rating: number;
  buySuggestion: string;
  valuation: string;
  trend: string;
  logic: string;
  isGoldSelected: boolean;
}

export interface IndustryBatchPlan {
  batch: number;
  time: string;
  percentage: number;
  targets: string;
  method: string;
  reason: string;
}

// 沪深300分析
export interface HS300Fund {
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
  isETF: boolean;
  isEnhanced?: boolean;
  alpha?: number;
  purchaseFee?: number;
  purchaseFeeOriginal?: number;
  serviceFee?: number;
}

export interface HS300Holding {
  name: string;
  code: string;
  weight: number;
  industry: string;
  pe: number;
  pb: number;
  roe: number;
  revenueGrowth: number;
  epsGrowth: number;
  analystConsensus: string;
  outlook: string;
}

export interface HS300Analysis {
  valuation: {
    name: string;
    code: string;
    pe: number;
    pb: number;
    pePercentile: number;
    pbPercentile: number;
    valuation: string;
    suggestion: string;
    roe: number;
    dividendYield: number;
  };
  funds: HS300Fund[];
  topHoldings: HS300Holding[];
  recommendation: {
    summary: string;
    bullFactors: string[];
    bearFactors: string[];
    strategy: {
      shortTerm: string;
      mediumTerm: string;
      longTerm: string;
    };
    bestPicks: {
      code: string;
      name: string;
      reason: string;
    }[];
  };
}

// 用户认证
export interface User {
  id: number;
  username: string;
  nickname: string;
  avatar_url?: string;
  role?: 'admin' | 'user';
  subscription_status?: 'free' | 'premium';
  subscription_end?: string;
  created_at?: string;
}

// 订阅
export interface SubscriptionPlan {
  id: number;
  name: string;
  price: number;
  duration_days: number;
  features: string[];
}

export interface SubscriptionOrder {
  id: number;
  out_trade_no: string;
  amount: number;
  status: 'pending' | 'paid' | 'expired';
  plan_name?: string;
  paid_at?: string;
  created_at: string;
}

// AI选股
export interface StockPickResult {
  fund: { code: string; name: string; type: string; industry: string; nav: number; return1y: number; return6m: number; return3m: number; return1m: number; return1w: number; totalFee: number; mgmtFee: number; custodyFee: number; scale: number; rating: number; manager: string };
  score: number;
  breakdown: { return1y: number; fee: number; scale: number; valuation: number; momentum: number; riskAdjusted?: number; stability?: number };
  reasoning: string;
  riskMetrics?: RiskMetrics;
}

export interface RiskMetrics {
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  annualReturn: number;
  annualVolatility: number;
  dataPoints: number;
}

export interface IndustryInsight {
  industry: string;
  meta: { index: string; keywords: string[]; seasonal: number[]; peakMonths: number[]; desc: string } | null;
  fundCount: number;
  avgReturn1y: number;
  avgReturn3m: number;
  avgReturn1m: number;
  avgFee: number;
  totalScale: number;
  valuation: string;
  buySuggestion: string;
  isBuySeason: boolean;
  isPeakSeason: boolean;
  currentMonth: number;
}

export interface BatchEntryPlan {
  batch: number;
  ratio: number;
  amount: number;
  perFund: number;
  description: string;
  timing: string;
  funds: { code: string; name: string; amount: number }[];
}

export interface ScreenedFund {
  fund: { code: string; name: string; type: string; industry: string; nav: number; return1y: number; return3m: number; return1m: number; totalFee: number; scale: number; manager: string };
  riskMetrics: RiskMetrics;
  screenScore: number;
}

// 理财记账
export interface FundRecord {
  id: number;
  user_id: number;
  fund_code: string;
  fund_name: string;
  shares: number;
  cost_price: number;
  buy_date: string;
  buy_fee: number;
  notes: string;
  record_type?: 'buy' | 'sell';
  sell_price?: number;
  sell_date?: string;
  sell_fee?: number;
  realized_pnl?: number;
  current_nav?: number;
  market_value?: number;
  pnl?: number;
  pnl_percent?: number;
  nav_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  fund_code: string;
  fund_name: string;
  total_shares: number;
  avg_cost_price: number;
  total_cost: number;
  current_nav: number;
  market_value: number;
  pnl: number;
  pnl_percent: number;
  nav_updated_at?: string;
  records: FundRecord[];
}

export interface PortfolioSummary {
  holdings: PortfolioHolding[];
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalReturn: number;
}

export interface Transaction {
  id: number;
  fund_code: string;
  fund_name: string;
  shares: number;
  cost_price: number;
  buy_date: string;
  buy_fee: number;
  notes: string;
  record_type: 'buy' | 'sell';
  sell_price?: number;
  sell_date?: string;
  sell_fee?: number;
  realized_pnl?: number;
  created_at: string;
}

export interface FeeSummary {
  totalBuyFees: number;
  totalSellFees: number;
  totalFees: number;
  totalInvestment: number;
  feeRate: number;
}

export interface FundFee {
  code: string;
  name: string;
  buyFees: number;
  sellFees: number;
  totalFees: number;
  feeRate: number;
  investment: number;
}

export interface IndustryAllocation {
  industry: string;
  totalValue: number;
  totalPnl: number;
  weight: number;
  returnRate: number;
  fundCount: number;
  funds: { code: string; name: string; value: number; pnl: number; pnlPercent: number }[];
}

export interface HoldingRisk {
  fundCode: string;
  fundName: string;
  totalShares: number;
  totalCost: number;
  metrics: RiskMetrics | null;
  industry: string;
  valuation: string;
  scale: number;
}

export interface PerformanceAttribution {
  fundCode: string;
  fundName: string;
  cost: number;
  marketValue: number;
  pnl: number;
  returnRate: number;
  contribution: number;
  weight: number;
}
