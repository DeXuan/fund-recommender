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
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
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
