import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Progress, Tag, Pagination } from 'antd';
import { fundApi } from '../services/api';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface IndustryFund {
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

interface BatchPlan {
  batch: number;
  time: string;
  percentage: number;
  targets: string;
  method: string;
  reason: string;
}

interface TradingVolumeReason {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
}

interface TradingVolumeAnalysis {
  summary: string;
  reasons: TradingVolumeReason[];
}

interface InvestmentAdvice {
  shortTerm: string;
  mediumTerm: string;
  longTerm: string;
  targetAllocation: string;
  stopProfit: string;
  stopLoss: string;
}

interface AnalysisData {
  industry: string;
  trend: string;
  valuation: string;
  buySuggestion: string;
  logic: string;
  fundCount: number;
  funds: IndustryFund[];
  batchPlan: BatchPlan[];
  riskWarning: string;
  tradingVolumeAnalysis?: TradingVolumeAnalysis;
  investmentAdvice?: InvestmentAdvice;
}

interface MarketIndex {
  name: string;
  code: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  pe: string | null;
  pb: string | null;
  pePercentile: string | null;
  pbPercentile: string | null;
  valuation: string;
  suggestion: string;
}

interface IndustryRecommendation {
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

const INDUSTRIES = [
  // 夏季投资主线
  { key: '电力', icon: '💡', label: '电力', tag: '夏季' },
  { key: '水电', icon: '🌊', label: '水电', tag: '夏季' },
  { key: '煤炭', icon: '⛏️', label: '煤炭', tag: '夏季' },
  { key: '啤酒/饮料', icon: '🍺', label: '啤酒/饮料', tag: '夏季' },
  { key: '家电', icon: '❄️', label: '家电', tag: '夏季' },
  { key: '酒店旅游', icon: '🏨', label: '酒店旅游', tag: '毕业季' },
  // 其他行业
  { key: '医药', icon: '💊', label: '医药' },
  { key: '人工智能', icon: '🤖', label: '人工智能' },
  { key: '半导体/芯片', icon: '🔬', label: '半导体' },
  { key: '证券', icon: '📈', label: '证券' },
  { key: '新能源', icon: '⚡', label: '新能源' },
  { key: '消费', icon: '🛒', label: '消费' },
  { key: '军工', icon: '🚀', label: '军工' },
  { key: '金融', icon: '🏦', label: '金融' },
  { key: '陶瓷/建材', icon: '🏗️', label: '陶瓷/建材' },
];

// API 行业名 → INDUSTRIES key 的映射
const INDUSTRY_NAME_MAP: Record<string, string> = {
  '人工智能/AI': '人工智能',
  '半导体/芯片': '半导体/芯片',
  '纳斯达克100': '',  // 不在 INDUSTRIES 中
};

export default function IndustryAnalysis() {
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const sectorParam = searchParams.get('sector');
  const initialIndustry = (() => {
    if (!sectorParam) return '医药';
    const mapped = INDUSTRY_NAME_MAP[sectorParam];
    if (mapped !== undefined) return mapped || '医药';
    // 直接匹配 INDUSTRIES key
    if (INDUSTRIES.some(ind => ind.key === sectorParam)) return sectorParam;
    return '医药';
  })();
  const [selectedIndustry, setSelectedIndustry] = useState(initialIndustry);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('compare');
  const [sortKey, setSortKey] = useState<string>('return1y');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [goldOnly, setGoldOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 市场分析数据
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [recommendations, setRecommendations] = useState<IndustryRecommendation[]>([]);
  const [valuationTrend, setValuationTrend] = useState<any[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);

  useEffect(() => {
    loadAnalysis(selectedIndustry);
  }, [selectedIndustry]);

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadAnalysis = async (industry: string) => {
    setLoading(true);
    try {
      const result = await fundApi.getIndustryAnalysis(industry);
      setData(result);
    } catch (error) {
      console.error('加载行业分析失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMarketData = async () => {
    setMarketLoading(true);
    try {
      const [indicesData, recsData, trendData] = await Promise.all([
        fundApi.getMarketIndices(),
        fundApi.getIndustryRecommendations(),
        fundApi.getValuationTrend().catch(() => []),
      ]);
      setIndices(indicesData);
      setRecommendations(recsData);
      setValuationTrend(trendData);
    } catch (error) {
      console.error('加载市场数据失败:', error);
    } finally {
      setMarketLoading(false);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const getSortedFunds = () => {
    if (!data?.funds) return [];
    let filtered = goldOnly ? data.funds.filter(f => f.isGoldSelected) : data.funds;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey as keyof IndustryFund] ?? 0;
      const bVal = b[sortKey as keyof IndustryFund] ?? 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const allSortedFunds = useMemo(() => getSortedFunds(), [data, goldOnly, sortKey, sortOrder]);

  const paginatedFunds = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allSortedFunds.slice(start, start + pageSize);
  }, [allSortedFunds, currentPage, pageSize]);

  const getValuationColor = (valuation: string) => {
    if (valuation.includes('极低') || valuation.includes('低估')) return '#52c41a';
    if (valuation.includes('偏低')) return '#73d13d';
    if (valuation.includes('合理')) return '#1677ff';
    if (valuation.includes('偏高') || valuation.includes('高')) return '#ff4d4f';
    return isDark ? '#a0a0a0' : '#666';
  };

  const formatReturn = (value: number | undefined) => {
    if (value === undefined || value === null) return <span>-</span>;
    const cls = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={cls}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  const getRatingStars = (rating: number) => {
    return <span className="rating">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>;
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return ' ↕';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const getAClassLabel = (name: string) => {
    if (name.includes('C类') || name.endsWith('C')) return 'C';
    return 'A';
  };

  if (loading && !data) {
    return <div className="text-center" style={{ padding: 60 }}>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>行业基金深度分析</h1>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: 13 }}>
        选择行业，查看该行业主流指数基金的费率、收益、估值等全量对比数据
      </p>

      {/* 行业选择器 */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {INDUSTRIES.map((ind, idx) => {
            const isFirstNonSummer = idx === 5;
            return (
              <span key={ind.key} style={{ display: 'contents' }}>
                {isFirstNonSummer && (
                  <div style={{ width: '100%', height: 0, borderTop: `1px dashed ${isDark ? '#333' : '#e8e8e8'}`, margin: '4px 0' }} />
                )}
                <button
                  onClick={() => { setSelectedIndustry(ind.key); setActiveTab('compare'); setCurrentPage(1); }}
                  className={`btn ${selectedIndustry === ind.key ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: 14, padding: '8px 20px', position: 'relative' }}
                >
                  {ind.icon} {ind.label}
                  {ind.tag && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      background: 'var(--danger)', color: 'var(--color-text-on-dark)',
                      fontSize: 9, padding: '1px 4px', borderRadius: 6,
                      fontWeight: 700,
                    }}>
                      {ind.tag}
                    </span>
                  )}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {data && (
        <>
          {/* 行业概况 */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'var(--color-text-on-dark)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 24, marginBottom: 8 }}>
                  {INDUSTRIES.find(i => i.key === data.industry)?.icon} {data.industry}行业
                </h2>
                <p style={{ opacity: 0.9, fontSize: 14 }}>{data.logic}</p>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{data.fundCount}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>基金数量</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning)' }}>
                    {data.funds.filter(f => f.isGoldSelected).length}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>金选基金</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>
                    {data.valuation}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>估值水平</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>
                    {data.trend}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>走势趋势</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 4 }}>
                    {data.buySuggestion}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>买入建议</div>
                </div>
              </div>
            </div>
          </div>

          {/* 标签页 */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ display: 'flex', borderBottom: `1px solid ${isDark ? '#333' : '#e8e8e8'}`, alignItems: 'center', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { key: 'compare', label: '基金对比总表' },
                { key: 'analysis', label: '专业分析' },
                { key: 'fee', label: '费率对比' },
                { key: 'return', label: '收益率排名' },
                { key: 'recommend', label: '综合推荐' },
                { key: 'batch', label: '分批建仓' },
                ...(data.tradingVolumeAnalysis ? [{ key: 'volume', label: '交易量分析' }] : []),
                ...(data.investmentAdvice ? [{ key: 'advice', label: '投资建议' }] : []),
                { key: 'indices', label: '指数估值' },
                { key: 'market-rec', label: '行业推荐' },
                { key: 'valuation-trend', label: '估值趋势' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className="industry-tab-btn"
                  onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                    color: activeTab === tab.key ? 'var(--primary)' : isDark ? '#a0a0a0' : '#666',
                    fontWeight: activeTab === tab.key ? 600 : 400,
                    fontSize: 14,
                  }}
                >
                  {tab.label}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', paddingRight: 16 }}>
                <button
                  onClick={() => { setGoldOnly(!goldOnly); setCurrentPage(1); }}
                  style={{
                    padding: '6px 16px',
                    border: goldOnly ? '1px solid var(--warning)' : `1px solid ${isDark ? '#444' : '#d9d9d9'}`,
                    background: goldOnly ? 'var(--warning)' : isDark ? '#1a1a1a' : 'white',
                    color: goldOnly ? 'white' : isDark ? '#a0a0a0' : '#666',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: goldOnly ? 600 : 400,
                  }}
                >
                  {goldOnly ? '★ 仅看金选' : '☆ 金选基金'}
                </button>
              </div>
            </div>
          </div>

          {/* 基金对比总表 */}
          {activeTab === 'compare' && (
            <div className="card">
              <h3 className="card-title">
                {data.industry}指数基金对比总表
                <span className="text-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
                  点击表头排序 | 申购费率按支付宝1折计算
                  {goldOnly && (
                    <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
                      | ★ 仅显示 {allSortedFunds.length} 只金选基金
                    </span>
                  )}
                </span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table industry-compare">
                  <thead>
                    <tr>
                      <th>基金代码</th>
                      <th>基金名称</th>
                      <th>A/C</th>
                      <th>跟踪指数</th>
                      <th>最新净值</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1y')}>
                        近1年{getSortIcon('return1y')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return6m')}>
                        近6月{getSortIcon('return6m')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return3m')}>
                        近3月{getSortIcon('return3m')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1m')}>
                        近1月{getSortIcon('return1m')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1w')}>
                        近1周{getSortIcon('return1w')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('managementFee')}>
                        管理费{getSortIcon('managementFee')}
                      </th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalFee')}>
                        综合费率{getSortIcon('totalFee')}
                      </th>
                      <th>申购费</th>
                      <th>赎回费</th>
                      <th>日限额</th>
                      <th style={{ cursor: 'pointer' }} onClick={() => handleSort('scale')}>
                        规模(亿){getSortIcon('scale')}
                      </th>
                      <th>评级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFunds.map((fund) => (
                      <tr key={fund.code}>
                        <td style={{ fontFamily: 'monospace' }}>{fund.code}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {fund.isGoldSelected && (
                              <span style={{ fontSize: 10, background: 'var(--warning)', color: 'var(--color-text-on-dark)', padding: '1px 4px', borderRadius: 2 }}>金选</span>
                            )}
                            <Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                              {fund.name}
                            </Link>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getAClassLabel(fund.name) === 'C' ? 'badge-warning' : 'badge-success'}`}>
                            {getAClassLabel(fund.name)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{fund.index}</td>
                        <td style={{ fontFamily: 'monospace' }}>{fund.nav != null ? fund.nav.toFixed(4) : '-'}</td>
                        <td style={{ fontWeight: 600 }}>{formatReturn(fund.return1y)}</td>
                        <td>{formatReturn(fund.return6m)}</td>
                        <td>{formatReturn(fund.return3m)}</td>
                        <td>{formatReturn(fund.return1m)}</td>
                        <td>{formatReturn(fund.return1w)}</td>
                        <td>{fund.managementFee}%</td>
                        <td>
                          <span style={{ color: fund.totalFee > 0.8 ? 'var(--danger)' : isDark ? '#e8e8e8' : '#333', fontWeight: fund.totalFee > 0.8 ? 600 : 400 }}>
                            {fund.totalFee}%
                          </span>
                        </td>
                        <td>{fund.purchaseFee}</td>
                        <td>{fund.redeemFee}</td>
                        <td>{fund.dailyLimit > 0 ? `${fund.dailyLimit}万` : '无限制'}</td>
                        <td>{fund.scale}</td>
                        <td>{getRatingStars(fund.rating)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allSortedFunds.length > pageSize && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={allSortedFunds.length}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 只基金`}
                    onChange={(page, size) => { setCurrentPage(page); setPageSize(size); }}
                    pageSizeOptions={['10', '20', '50', '100']}
                  />
                </div>
              )}
            </div>
          )}

          {/* 专业分析 — 金选基金的估值/趋势/逻辑/建议 */}
          {activeTab === 'analysis' && (
            <div>
              {/* 分析概览统计 */}
              <div className="card" style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                color: 'white',
              }}>
                <h3 style={{ color: 'var(--color-text-on-dark)', marginBottom: 12 }}>
                  专业分析 — {data.industry}行业
                </h3>
                <p style={{ opacity: 0.8, fontSize: 14, marginBottom: 16 }}>
                  基于估值、收益趋势、费率、规模等维度的综合分析
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {(() => {
                    const goldFunds = data.funds.filter(f => f.isGoldSelected);
                    const valuationDist: Record<string, number> = {};
                    const trendDist: Record<string, number> = {};
                    const suggestionDist: Record<string, number> = {};
                    goldFunds.forEach(f => {
                      const v = f.valuation || '--';
                      const t = f.trend || '--';
                      const s = f.buySuggestion || '--';
                      if (!valuationDist[v]) valuationDist[v] = 0;
                      if (!trendDist[t]) trendDist[t] = 0;
                      if (!suggestionDist[s]) suggestionDist[s] = 0;
                      valuationDist[v]++; trendDist[t]++; suggestionDist[s]++;
                    });
                    return (
                      <>
                        <div style={{ flex: 1, minWidth: 180, padding: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>估值分布</div>
                          {Object.entries(valuationDist).sort(([,a],[,b]) => b-a).map(([k,v]) => (
                            <div key={k} style={{ fontSize: 13, marginBottom: 2 }}>
                              {k}: <strong>{v}</strong>只
                            </div>
                          ))}
                        </div>
                        <div style={{ flex: 1, minWidth: 180, padding: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>趋势分布</div>
                          {Object.entries(trendDist).sort(([,a],[,b]) => b-a).map(([k,v]) => (
                            <div key={k} style={{ fontSize: 13, marginBottom: 2 }}>
                              {k}: <strong>{v}</strong>只
                            </div>
                          ))}
                        </div>
                        <div style={{ flex: 1, minWidth: 180, padding: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>建议分布</div>
                          {Object.entries(suggestionDist).sort(([,a],[,b]) => b-a).map(([k,v]) => (
                            <div key={k} style={{ fontSize: 13, marginBottom: 2 }}>
                              {k}: <strong>{v}</strong>只
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* 金选基金专业分析详情 */}
              <div className="card">
                <h3 className="card-title">
                  金选基金专业分析详情
                  <span className="text-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
                    共 {data.funds.filter(f => f.isGoldSelected).length} 只金选基金
                  </span>
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>基金名称</th>
                        <th>代码</th>
                        <th>估值判断</th>
                        <th>走势趋势</th>
                        <th>投资逻辑</th>
                        <th>买入建议</th>
                        <th>评级</th>
                        <th>近1年</th>
                        <th>综合费率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.funds
                        .filter(f => f.isGoldSelected)
                        .sort((a, b) => b.rating - a.rating || (b.return1y ?? 0) - (a.return1y ?? 0))
                        .map((fund) => (
                          <tr key={fund.code}>
                            <td style={{ fontWeight: 600 }}>
                              <Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                {fund.name}
                              </Link>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{fund.code}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                background: (fund.valuation || '').includes('低') ? isDark ? '#162312' : '#f6ffed'
                                  : (fund.valuation || '').includes('高') ? isDark ? '#2c1618' : '#fff2f0'
                                  : isDark ? '#1a1a1a' : '#f5f5f5',
                                color: (fund.valuation || '').includes('低') ? '#52c41a'
                                  : (fund.valuation || '').includes('高') ? '#ff4d4f'
                                  : '#1677ff',
                              }}>
                                {fund.valuation || '--'}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                background: (fund.trend || '').includes('上涨') ? isDark ? '#162312' : '#f6ffed'
                                  : (fund.trend || '').includes('反弹') ? isDark ? '#111a2c' : '#e6f4ff'
                                  : (fund.trend || '').includes('跌') ? isDark ? '#2c1618' : '#fff2f0'
                                  : isDark ? '#1a1a1a' : '#f5f5f5',
                                color: (fund.trend || '').includes('上涨') ? '#52c41a'
                                  : (fund.trend || '').includes('反弹') ? '#1677ff'
                                  : (fund.trend || '').includes('跌') ? '#ff4d4f'
                                  : isDark ? '#a0a0a0' : '#666',
                              }}>
                                {fund.trend || '--'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, maxWidth: 300, color: isDark ? '#a0a0a0' : '#666' }}>
                              {fund.logic || fund.index || '--'}
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                background: (fund.buySuggestion || '').includes('优先') ? isDark ? '#162312' : '#f6ffed'
                                  : (fund.buySuggestion || '').includes('布局') ? isDark ? '#111a2c' : '#e6f4ff'
                                  : (fund.buySuggestion || '').includes('配置') ? isDark ? '#1a1a1a' : '#f5f5f5'
                                  : isDark ? '#2c1618' : '#fff2f0',
                                color: (fund.buySuggestion || '').includes('优先') ? '#52c41a'
                                  : (fund.buySuggestion || '').includes('布局') ? '#1677ff'
                                  : (fund.buySuggestion || '').includes('配置') ? '#1677ff'
                                  : '#ff4d4f',
                              }}>
                                {fund.buySuggestion || '--'}
                              </span>
                            </td>
                            <td>{'★'.repeat(Math.min(fund.rating || 0, 5))}{'☆'.repeat(5 - Math.min(fund.rating || 0, 5))}</td>
                            <td>{formatReturn(fund.return1y)}</td>
                            <td>
                              <span style={{ color: fund.totalFee > 0.8 ? 'var(--danger)' : isDark ? '#e8e8e8' : '#333', fontWeight: fund.totalFee > 0.8 ? 600 : 400 }}>
                                {fund.totalFee}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      {data.funds.filter(f => f.isGoldSelected).length === 0 && (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: isDark ? '#a0a0a0' : '#666' }}>
                            该行业暂无金选基金数据，请先运行金选基金数据更新
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 所有基金分析总表（含非金选） */}
              <div className="card">
                <h3 className="card-title">
                  全部基金分析总表
                  <span className="text-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
                    包含估值、趋势、投资逻辑等专业分析维度
                  </span>
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>基金名称</th>
                        <th>A/C</th>
                        <th>金选</th>
                        <th>估值</th>
                        <th>趋势</th>
                        <th>投资逻辑</th>
                        <th>建议</th>
                        <th>评级</th>
                        <th>近1年</th>
                        <th>综合费率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFunds.map((fund) => (
                        <tr key={fund.code}>
                          <td><Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>{fund.name}</Link></td>
                          <td>
                            <span className={`badge ${getAClassLabel(fund.name) === 'C' ? 'badge-warning' : 'badge-success'}`}>
                              {getAClassLabel(fund.name)}
                            </span>
                          </td>
                          <td>
                            {fund.isGoldSelected ? (
                              <span style={{ fontSize: 10, background: 'var(--warning)', color: 'white', padding: '2px 6px', borderRadius: 3, fontWeight: 600 }}>金选</span>
                            ) : (
                              <span style={{ color: isDark ? '#444' : '#d9d9d9' }}>--</span>
                            )}
                          </td>
                          <td><span style={{ color: getValuationColor(fund.valuation || ''), fontWeight: 600, fontSize: 12 }}>{fund.valuation || '--'}</span></td>
                          <td><span style={{ fontSize: 12, color: (fund.trend || '').includes('上涨') ? 'var(--success)' : (fund.trend || '').includes('跌') ? 'var(--danger)' : isDark ? '#a0a0a0' : '#666' }}>{fund.trend || '--'}</span></td>
                          <td style={{ fontSize: 11, maxWidth: 250, color: isDark ? '#a0a0a0' : '#666' }}>{fund.logic || fund.index || '--'}</td>
                          <td><span style={{ fontSize: 12, color: (fund.buySuggestion || '').includes('优先') ? 'var(--success)' : (fund.buySuggestion || '').includes('观望') ? 'var(--danger)' : 'var(--primary)' }}>{fund.buySuggestion || '--'}</span></td>
                          <td>{'★'.repeat(Math.min(fund.rating || 0, 5))}</td>
                          <td>{formatReturn(fund.return1y)}</td>
                          <td><span style={{ color: fund.totalFee > 0.8 ? 'var(--danger)' : undefined, fontWeight: fund.totalFee > 0.8 ? 600 : 400 }}>{fund.totalFee}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {allSortedFunds.length > pageSize && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={allSortedFunds.length}
                      showSizeChanger
                      showQuickJumper
                      showTotal={(total) => `共 ${total} 只基金`}
                      onChange={(page, size) => { setCurrentPage(page); setPageSize(size); }}
                      pageSizeOptions={['10', '20', '50', '100']}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 费率对比 */}
          {activeTab === 'fee' && (
            <div className="card">
              <h3 className="card-title">{data.industry}指数基金费率对比（支付宝渠道）</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>基金名称</th>
                      <th>代码</th>
                      <th>A/C类</th>
                      <th>管理费/年</th>
                      <th>托管费/年</th>
                      <th>销售服务费/年</th>
                      <th>综合费率/年</th>
                      <th>申购费(支付宝1折)</th>
                      <th>赎回费(≥1年)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFunds.map((fund) => (
                      <tr key={fund.code}>
                        <td><Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{fund.name}</Link></td>
                        <td style={{ fontFamily: 'monospace' }}>{fund.code}</td>
                        <td>
                          <span className={`badge ${getAClassLabel(fund.name) === 'C' ? 'badge-warning' : 'badge-success'}`}>
                            {getAClassLabel(fund.name)}
                          </span>
                        </td>
                        <td>{fund.managementFee}%</td>
                        <td>{fund.custodyFee}%</td>
                        <td>{fund.serviceFee}%</td>
                        <td>
                          <span style={{
                            color: fund.totalFee > 0.8 ? 'var(--danger)' : fund.totalFee <= 0.6 ? 'var(--success)' : isDark ? '#e8e8e8' : '#333',
                            fontWeight: 600,
                          }}>
                            {fund.totalFee}%
                          </span>
                        </td>
                        <td>{fund.purchaseFee}</td>
                        <td>{fund.redeemFee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allSortedFunds.length > pageSize && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={allSortedFunds.length}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 只基金`}
                    onChange={(page, size) => { setCurrentPage(page); setPageSize(size); }}
                    pageSizeOptions={['10', '20', '50', '100']}
                  />
                </div>
              )}

              <div style={{ marginTop: 24, padding: 16, background: isDark ? '#1f1f1f' : '#f5f5f5', borderRadius: 8 }}>
                <h4 style={{ marginBottom: 8 }}>费率说明</h4>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <p><strong>A类 vs C类</strong>：A类收取申购费（支付宝1折），适合持有≥1年；C类免申购费但收销售服务费，适合短期持有</p>
                  <p><strong>综合费率</strong> = 管理费 + 托管费 + 销售服务费</p>
                  <p><strong>支付宝申购</strong>：通常享受1折优惠，具体以实际页面为准</p>
                </div>
              </div>
            </div>
          )}

          {/* 收益率排名 */}
          {activeTab === 'return' && (
            <div className="card">
              <h3 className="card-title">
                {data.industry}指数基金收益率排名
                <span className="text-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
                  按近1年收益降序排列 | 红涨绿跌
                </span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>基金名称</th>
                      <th>代码</th>
                      <th>A/C</th>
                      <th>近1年</th>
                      <th>近6月</th>
                      <th>近3月</th>
                      <th>近1月</th>
                      <th>近1周</th>
                      <th>走势</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFunds.map((fund, idx) => (
                      <tr key={fund.code}>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            textAlign: 'center',
                            lineHeight: '24px',
                            fontSize: 12,
                            fontWeight: 600,
                            background: (currentPage - 1) * pageSize + idx < 3 ? 'var(--warning)' : isDark ? '#262626' : '#f0f0f0',
                            color: (currentPage - 1) * pageSize + idx < 3 ? 'white' : isDark ? '#a0a0a0' : '#666',
                          }}>
                            {(currentPage - 1) * pageSize + idx + 1}
                          </span>
                        </td>
                        <td><Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{fund.name}</Link></td>
                        <td style={{ fontFamily: 'monospace' }}>{fund.code}</td>
                        <td>
                          <span className={`badge ${getAClassLabel(fund.name) === 'C' ? 'badge-warning' : 'badge-success'}`}>
                            {getAClassLabel(fund.name)}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{formatReturn(fund.return1y)}</td>
                        <td>{formatReturn(fund.return6m)}</td>
                        <td>{formatReturn(fund.return3m)}</td>
                        <td>{formatReturn(fund.return1m)}</td>
                        <td>{formatReturn(fund.return1w)}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            background: fund.trend.includes('上涨') ? isDark ? '#162312' : '#f6ffed' : fund.trend.includes('反弹') ? isDark ? '#111a2c' : '#e6f4ff' : isDark ? '#2c1618' : '#fff2f0',
                            color: fund.trend.includes('上涨') ? 'var(--success)' : fund.trend.includes('反弹') ? 'var(--primary)' : 'var(--danger)',
                          }}>
                            {fund.trend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allSortedFunds.length > pageSize && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={allSortedFunds.length}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 只基金`}
                    onChange={(page, size) => { setCurrentPage(page); setPageSize(size); }}
                    pageSizeOptions={['10', '20', '50', '100']}
                  />
                </div>
              )}
            </div>
          )}

          {/* 综合推荐 */}
          {activeTab === 'recommend' && (
            <div>
              <div className="card">
                <h3 className="card-title">{data.industry}指数基金综合推荐</h3>
                <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
                  推荐评级：★★★★★首选（收益高+费率低+规模大）| ★★★★推荐（表现好+费率合理）| ★★★一般
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>评级</th>
                        <th>基金名称</th>
                        <th>代码</th>
                        <th>推荐理由</th>
                        <th>适合人群</th>
                        <th>建议操作</th>
                        <th>持有策略</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.funds
                        .sort((a, b) => b.rating - a.rating || b.return1y - a.return1y)
                        .slice(0, 8)
                        .map((fund) => (
                          <tr key={fund.code}>
                            <td>{getRatingStars(fund.rating)}</td>
                            <td style={{ fontWeight: 600 }}><Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{fund.name}</Link></td>
                            <td style={{ fontFamily: 'monospace' }}>{fund.code}</td>
                            <td style={{ fontSize: 13, maxWidth: 300 }}>{fund.logic}</td>
                            <td>
                              <span className="badge badge-success">
                                {fund.return1y > 20 ? '激进型' : fund.return1y > 0 ? '稳健型' : '左侧布局型'}
                              </span>
                            </td>
                            <td>{fund.buySuggestion}</td>
                            <td style={{ fontSize: 13 }}>
                              {getAClassLabel(fund.name) === 'C'
                                ? '短期灵活调仓，免申购费'
                                : '长期持有>=1年，降低费率'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 核心投资逻辑 */}
              <div className="card">
                <h3 className="card-title">核心投资逻辑</h3>
                <div style={{
                  padding: 20,
                  background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                  borderRadius: 8,
                  fontSize: 14,
                  lineHeight: 1.8,
                }}>
                  <p style={{ marginBottom: 12 }}><strong>1. 行业趋势：</strong>{data.logic}</p>
                  <p style={{ marginBottom: 12 }}><strong>2. 估值判断：</strong>当前{data.industry}板块估值处于{data.valuation}水平，{data.valuation.includes('低') ? '具有较好的左侧布局价值' : '建议分批买入降低风险'}</p>
                  <p style={{ marginBottom: 12 }}><strong>3. 买入策略：</strong>{data.buySuggestion}，建议通过C类基金先建底仓，确认趋势后切换A类降低长期费率</p>
                  <p><strong>4. 风险控制：</strong>分3-4批建仓，单批不超过总仓位30%，设置止盈止损线</p>
                </div>
              </div>
            </div>
          )}

          {/* 分批建仓 */}
          {activeTab === 'batch' && (
            <div>
              <div className="card">
                <h3 className="card-title">{data.industry}行业分批建仓方案</h3>
                <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
                  核心策略：分批建仓 + C类先行 + 估值优先 + 动态调整
                </p>

                <div style={{ position: 'relative', paddingLeft: 30 }}>
                  <div style={{
                    position: 'absolute',
                    left: 15,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: isDark ? '#333' : '#e8e8e8',
                  }}></div>

                  {data.batchPlan.map((plan) => (
                    <div key={plan.batch} style={{ marginBottom: 24, position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: -22,
                        top: 4,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        border: '2px solid white',
                        boxShadow: '0 0 0 2px #1677ff',
                      }}></div>

                      <div style={{ background: isDark ? '#1a1a1a' : 'white', padding: 16, borderRadius: 8, border: `1px solid ${isDark ? '#333' : '#e8e8e8'}` }}>
                        <div className="flex-between" style={{ marginBottom: 8 }}>
                          <h4>第 {plan.batch} 批</h4>
                          <span className="badge badge-success">{plan.percentage}%</span>
                        </div>
                        <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginBottom: 8 }}>
                          <strong>时间：</strong>{plan.time}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                          <strong>买入标的：</strong>{plan.targets}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          <strong>操作方式：</strong>{plan.method}
                        </div>
                        <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
                          <strong>理由：</strong>{plan.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 建仓原则 */}
              <div className="card">
                <h3 className="card-title">建仓原则</h3>
                <div style={{ fontSize: 14, lineHeight: 2 }}>
                  <ul style={{ paddingLeft: 20 }}>
                    <li><strong>分批买入</strong>：不要一次性投入，分3-4批建仓，降低择时风险</li>
                    <li><strong>C类先行</strong>：先用C类建底仓（免申购费），确认趋势后切换A类</li>
                    <li><strong>估值优先</strong>：估值越低，仓位可以越重</li>
                    <li><strong>动态调整</strong>：根据市场变化调整后续批次的品种和比例</li>
                    <li><strong>设定止盈</strong>：收益达到20%考虑部分止盈</li>
                    <li><strong>长期持有</strong>：指数基金适合长期持有，避免频繁交易</li>
                  </ul>
                </div>
              </div>

              {/* 风险提示 */}
              <div className="card" style={{ border: '1px solid var(--danger-border)', background: isDark ? '#2c1618' : '#fff2f0' }}>
                <h3 style={{ color: 'var(--danger)', marginBottom: 12 }}>风险提示</h3>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: isDark ? '#a0a0a0' : '#666', whiteSpace: 'pre-line' }}>
                  {data.riskWarning}
                </div>
              </div>
            </div>
          )}

          {/* 交易量分析 */}
          {activeTab === 'volume' && data.tradingVolumeAnalysis && (
            <div>
              <div className="card" style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                color: 'var(--color-text-on-dark)',
              }}>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                  {data.industry}交易量分析
                </h2>
                <p style={{ opacity: 0.9, fontSize: 14 }}>
                  {data.tradingVolumeAnalysis.summary}
                </p>
              </div>

              <div className="card">
                <h3 className="card-title">交易量放大原因分析</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {data.tradingVolumeAnalysis.reasons.map((reason, idx) => (
                    <div key={idx} style={{
                      padding: 16,
                      borderRadius: 8,
                      border: `1px solid ${isDark ? '#333' : '#e8e8e8'}`,
                      background: reason.impact === 'high' ? isDark ? '#162312' : '#f6ffed' : reason.impact === 'medium' ? isDark ? '#111a2c' : '#e6f4ff' : isDark ? '#1f1f1f' : '#f5f5f5',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <h4 style={{ margin: 0, fontSize: 15 }}>
                          {idx + 1}. {reason.title}
                        </h4>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background: reason.impact === 'high' ? 'var(--success)' : reason.impact === 'medium' ? 'var(--primary)' : 'var(--color-text-muted)',
                          color: 'var(--color-text-on-dark)',
                        }}>
                          {reason.impact === 'high' ? '高影响' : reason.impact === 'medium' ? '中影响' : '低影响'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {reason.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ border: '1px solid #b7eb8f', background: isDark ? '#162312' : '#f6ffed' }}>
                <h3 style={{ color: 'var(--success)', marginBottom: 12 }}>交易量分析结论</h3>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: isDark ? '#e8e8e8' : '#333' }}>
                  <p>当前{data.industry}板块交易量放大是<strong>多重因素共振</strong>的结果：</p>
                  <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                    <li><strong>政策驱动</strong>：房地产和基建政策频繁出台，市场预期差大</li>
                    <li><strong>估值修复</strong>：低估值吸引左侧资金持续流入</li>
                    <li><strong>板块轮动</strong>：热门板块高位震荡，资金向价值洼地切换</li>
                  </ul>
                  <p style={{ marginTop: 12 }}>
                    <strong>建议</strong>：交易量大不代表方向明确，不宜追高。建议分批建仓，先用C类基金试水，确认趋势后再加仓。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 投资建议 */}
          {activeTab === 'advice' && data.investmentAdvice && (
            <div>
              <div className="card" style={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                color: 'var(--color-text-on-dark)',
              }}>
                <h2 style={{ fontSize: 20, marginBottom: 8 }}>
                  {data.industry}投资建议
                </h2>
                <p style={{ opacity: 0.9, fontSize: 14 }}>
                  基于估值水平、行业趋势、资金流向的综合分析
                </p>
              </div>

              <div className="card">
                <h3 className="card-title">分周期投资策略</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 16, borderRadius: 8, border: '1px solid #ffd666', background: isDark ? '#2b2111' : '#fffbe6' }}>
                    <h4 style={{ margin: '0 0 8px', color: 'var(--warning)' }}>短期策略（1-3个月）</h4>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>{data.investmentAdvice.shortTerm}</p>
                  </div>
                  <div style={{ padding: 16, borderRadius: 8, border: '1px solid #91d5ff', background: '#e6f7ff' }}>
                    <h4 style={{ margin: '0 0 8px', color: 'var(--primary)' }}>中期策略（3-12个月）</h4>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>{data.investmentAdvice.mediumTerm}</p>
                  </div>
                  <div style={{ padding: 16, borderRadius: 8, border: '1px solid #b7eb8f', background: isDark ? '#162312' : '#f6ffed' }}>
                    <h4 style={{ margin: '0 0 8px', color: 'var(--success)' }}>长期策略（1年以上）</h4>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>{data.investmentAdvice.longTerm}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">关键指标</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#111a2c' : '#f0f5ff', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{data.investmentAdvice.targetAllocation}</div>
                    <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginTop: 4 }}>建议仓位占比</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#162312' : '#f6ffed', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>{data.investmentAdvice.stopProfit}</div>
                    <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginTop: 4 }}>止盈线</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 8, background: isDark ? '#2c1618' : '#fff2f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{data.investmentAdvice.stopLoss}</div>
                    <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginTop: 4 }}>止损线</div>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">推荐标的</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>优先级</th>
                        <th>基金名称</th>
                        <th>代码</th>
                        <th>类型</th>
                        <th>理由</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span style={{ background: 'var(--warning)', color: 'var(--color-text-on-dark)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>首选</span></td>
                        <td><Link to={`/funds/516750`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>建材ETF富国</Link></td>
                        <td style={{ fontFamily: 'monospace' }}>516750</td>
                        <td>ETF</td>
                        <td style={{ fontSize: 13 }}>规模最大(12.3亿)，流动性最好，场内交易灵活</td>
                      </tr>
                      <tr>
                        <td><span style={{ background: 'var(--primary)', color: 'var(--color-text-on-dark)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>次选</span></td>
                        <td><Link to={`/funds/013019`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>国泰建材ETF联接A</Link></td>
                        <td style={{ fontFamily: 'monospace' }}>013019</td>
                        <td>ETF联接</td>
                        <td style={{ fontSize: 13 }}>费率低(0.60%)，适合长期持有(&gt;=1年免赎回费)</td>
                      </tr>
                      <tr>
                        <td><span style={{ background: 'var(--success)', color: 'var(--color-text-on-dark)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>短期</span></td>
                        <td><Link to={`/funds/013020`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>国泰建材ETF联接C</Link></td>
                        <td style={{ fontFamily: 'monospace' }}>013020</td>
                        <td>ETF联接</td>
                        <td style={{ fontSize: 13 }}>免申购费，短期灵活进出，适合试水建仓</td>
                      </tr>
                      <tr>
                        <td><span style={{ background: 'var(--color-purple)', color: 'var(--color-text-on-dark)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>分散</span></td>
                        <td><Link to={`/funds/004856`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>广发建材指数A</Link></td>
                        <td style={{ fontFamily: 'monospace' }}>004856</td>
                        <td>指数增强</td>
                        <td style={{ fontSize: 13 }}>不同基金公司，分散单一基金公司风险</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 指数估值 */}
          {activeTab === 'indices' && (
            <div className="card">
              {marketLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
              ) : (
                <div>
                  <h3 className="card-title">主要指数估值概览</h3>
                  <ReactECharts
                    theme={getEchartsTheme(isDark)}
                    option={{
                      tooltip: { trigger: 'axis' },
                      xAxis: { type: 'category', data: indices.map(i => i.name), axisLabel: { rotate: 15 } },
                      yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
                      series: [{
                        name: 'PE分位',
                        type: 'bar',
                        data: indices.map(i => ({ value: Number(i.pePercentile) || 0, itemStyle: { color: getValuationColor(i.valuation) } })),
                        label: { show: true, position: 'top', formatter: '{c}%' },
                      }],
                      grid: { top: 30, right: 20, bottom: 40, left: 50 },
                    }}
                    style={{ height: 300 }}
                    opts={{ renderer: 'svg' }}
                  />
                  <div style={{ overflowX: 'auto', marginTop: 16 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>指数</th>
                          <th>最新价</th>
                          <th>涨跌幅</th>
                          <th>PE(TTM)</th>
                          <th>PE历史分位</th>
                          <th>PB</th>
                          <th>PB历史分位</th>
                          <th>估值判断</th>
                          <th>投资建议</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indices.map((idx) => (
                          <tr key={idx.code}>
                            <td><strong>{idx.name}</strong></td>
                            <td style={{ fontFamily: 'monospace' }}>{idx.price != null ? idx.price.toFixed(2) : '-'}</td>
                            <td>
                              {idx.changePercent != null ? (
                                <span style={{ color: idx.changePercent >= 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>
                                  {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                                </span>
                              ) : '-'}
                            </td>
                            <td>{idx.pe ?? '--'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{idx.pePercentile != null ? `${idx.pePercentile}%` : '--'}</span>
                                {idx.pePercentile != null && (
                                  <Progress percent={Number(idx.pePercentile)} showInfo={false} size="small" strokeColor={getValuationColor(idx.valuation)} style={{ flex: 1, minWidth: 60 }} />
                                )}
                              </div>
                            </td>
                            <td>{idx.pb ?? '--'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{idx.pbPercentile != null ? `${idx.pbPercentile}%` : '--'}</span>
                                {idx.pbPercentile != null && (
                                  <Progress percent={Number(idx.pbPercentile)} showInfo={false} size="small" strokeColor={getValuationColor(idx.valuation)} style={{ flex: 1, minWidth: 60 }} />
                                )}
                              </div>
                            </td>
                            <td><span style={{ color: getValuationColor(idx.valuation), fontWeight: 600 }}>{idx.valuation}</span></td>
                            <td>{idx.suggestion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 16, padding: 12, background: isDark ? '#111a2c' : '#e6f4ff', border: '1px solid #91caff', borderRadius: 6, fontSize: 13, lineHeight: 2 }}>
                    <strong style={{ color: 'var(--primary)' }}>估值分位说明：</strong>
                    20%以下=极度低估（重仓买入）| 20-40%=偏低估（定投加仓）| 40-60%=合理（正常定投）| 60-80%=偏高估（小额定投）| 80%以上=极度高估（观望减仓）
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 行业推荐 */}
          {activeTab === 'market-rec' && (
            <div className="card">
              {marketLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
              ) : (
                <div>
                  <h3 className="card-title">行业推荐排名</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>排名</th>
                          <th>行业</th>
                          <th>走势</th>
                          <th>估值</th>
                          <th>买入建议</th>
                          <th>推荐逻辑</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recommendations.map((rec) => (
                          <tr key={rec.rank}>
                            <td>
                              <span style={{
                                display: 'inline-block', width: 24, height: 24, borderRadius: '50%',
                                textAlign: 'center', lineHeight: '24px', fontSize: 12, fontWeight: 600,
                                background: rec.rank <= 3 ? 'var(--warning)' : isDark ? '#262626' : '#f0f0f0',
                                color: rec.rank <= 3 ? 'white' : isDark ? '#a0a0a0' : '#666',
                              }}>
                                {rec.rank}
                              </span>
                            </td>
                            <td><Tag color="blue">{rec.industry || '--'}</Tag></td>
                            <td>{rec.trend || '--'}</td>
                            <td><span style={{ color: getValuationColor(rec.valuation) }}>{rec.valuation || '--'}</span></td>
                            <td>
                              <Tag color={rec.buySuggestion === '优先配置' ? 'green' : rec.buySuggestion === '逢低布局' ? 'orange' : 'default'}>
                                {rec.buySuggestion || '--'}
                              </Tag>
                            </td>
                            <td style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', maxWidth: 300 }}>{rec.logic || '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Card title="推荐逻辑" style={{ marginTop: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      {recommendations.slice(0, 4).map((rec, i) => (
                        <div key={rec.industry || i} style={{ padding: 12, background: isDark ? '#1f1f1f' : '#f5f5f5', borderRadius: 6 }}>
                          <strong>{rec.industry || '--'}</strong>
                          <p style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', margin: '8px 0 0' }}>{rec.logic || '--'}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* 估值趋势 */}
          {activeTab === 'valuation-trend' && (
            <div className="card">
              {marketLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
              ) : valuationTrend.length > 0 ? (
                <div>
                  <h3 className="card-title">主要指数估值分位趋势（近12月）</h3>
                  {valuationTrend.map((idx: any) => (
                    <Card key={idx.code} title={`${idx.name} 估值分位趋势`} size="small" style={{ marginBottom: 16 }}>
                      <ReactECharts
                        theme={getEchartsTheme(isDark)}
                        option={{
                          tooltip: {
                            trigger: 'axis',
                            formatter: (params: any) => {
                              let html = `${params[0]?.axisValue}<br/>`;
                              params.forEach((p: any) => { html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`; });
                              return html;
                            },
                          },
                          legend: { data: ['PE分位', 'PB分位'], bottom: 0 },
                          grid: { top: 20, right: 20, bottom: 40, left: 50 },
                          xAxis: { type: 'category', data: idx.months.map((m: any) => m.month), axisLabel: { fontSize: 10 } },
                          yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
                          visualMap: {
                            show: false,
                            pieces: [
                              { lte: 20, color: '#52c41a' },
                              { gt: 20, lte: 40, color: '#73d13d' },
                              { gt: 40, lte: 60, color: '#1677ff' },
                              { gt: 60, lte: 80, color: '#ff7a45' },
                              { gt: 80, color: '#ff4d4f' },
                            ],
                          },
                          series: [
                            {
                              name: 'PE分位', type: 'line',
                              data: idx.months.map((m: any) => m.pe_percentile),
                              smooth: true, lineStyle: { width: 2 }, showSymbol: false,
                              markLine: {
                                silent: true,
                                data: [
                                  { yAxis: 20, lineStyle: { color: '#52c41a', type: 'dashed' }, label: { formatter: '极低20%', fontSize: 10 } },
                                  { yAxis: 80, lineStyle: { color: '#ff4d4f', type: 'dashed' }, label: { formatter: '极高80%', fontSize: 10 } },
                                ],
                              },
                            },
                            {
                              name: 'PB分位', type: 'line',
                              data: idx.months.map((m: any) => m.pb_percentile),
                              smooth: true, lineStyle: { width: 2, type: 'dashed' }, showSymbol: false,
                            },
                          ],
                        }}
                        style={{ height: 250 }}
                        opts={{ renderer: 'svg' }}
                      />
                      <div style={{ textAlign: 'center', fontSize: 13, color: isDark ? '#a0a0a0' : '#595959', marginTop: 8 }}>
                        当前估值：<span style={{ fontWeight: 600, color: getValuationColor(idx.current_valuation) }}>{idx.current_valuation}</span>
                        <span style={{ marginLeft: 16 }}>建议：{idx.current_suggestion}</span>
                      </div>
                    </Card>
                  ))}
                  <div style={{ marginTop: 16, padding: 12, background: isDark ? '#111a2c' : '#e6f4ff', border: '1px solid #91caff', borderRadius: 6, fontSize: 13, lineHeight: 2 }}>
                    <strong style={{ color: 'var(--primary)' }}>估值趋势说明：</strong>
                    PE分位越低，估值越便宜，投资价值越高。绿色区域(20%以下)=极度低估，红色区域(80%以上)=极度高估。
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无估值趋势数据</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
