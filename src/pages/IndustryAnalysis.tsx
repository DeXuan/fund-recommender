import { useState, useEffect } from 'react';
import { fundApi } from '../services/api';

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
}

const INDUSTRIES = [
  // 夏季投资主线
  { key: '电力', icon: '💡', label: '电力', tag: '夏季' },
  { key: '水电', icon: '🌊', label: '水电', tag: '夏季' },
  { key: '煤炭', icon: '⛏️', label: '煤炭', tag: '夏季' },
  { key: '啤酒/饮料', icon: '🍺', label: '啤酒/饮料', tag: '夏季' },
  { key: '家电', icon: '❄️', label: '家电', tag: '夏季' },
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

export default function IndustryAnalysis() {
  const [selectedIndustry, setSelectedIndustry] = useState('医药');
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('compare');
  const [sortKey, setSortKey] = useState<string>('return1y');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadAnalysis(selectedIndustry);
  }, [selectedIndustry]);

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

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const getSortedFunds = () => {
    if (!data?.funds) return [];
    return [...data.funds].sort((a, b) => {
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

  const getValuationColor = (valuation: string) => {
    if (valuation.includes('极低') || valuation.includes('低估')) return '#52c41a';
    if (valuation.includes('偏低')) return '#73d13d';
    if (valuation.includes('合理')) return '#1677ff';
    if (valuation.includes('偏高') || valuation.includes('高')) return '#ff4d4f';
    return '#666';
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
                  <div style={{ width: '100%', height: 0, borderTop: '1px dashed #e8e8e8', margin: '4px 0' }} />
                )}
                <button
                  onClick={() => { setSelectedIndustry(ind.key); setActiveTab('compare'); }}
                  className={`btn ${selectedIndustry === ind.key ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: 14, padding: '8px 20px', position: 'relative' }}
                >
                  {ind.icon} {ind.label}
                  {ind.tag && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#ff4d4f', color: 'white',
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
            color: 'white',
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
            <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8' }}>
              {[
                { key: 'compare', label: '基金对比总表' },
                { key: 'fee', label: '费率对比' },
                { key: 'return', label: '收益率排名' },
                { key: 'recommend', label: '综合推荐' },
                { key: 'batch', label: '分批建仓' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom: activeTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                    color: activeTab === tab.key ? '#1677ff' : '#666',
                    fontWeight: activeTab === tab.key ? 600 : 400,
                    fontSize: 14,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 基金对比总表 */}
          {activeTab === 'compare' && (
            <div className="card">
              <h3 className="card-title">
                {data.industry}指数基金对比总表
                <span className="text-muted" style={{ fontSize: 12, fontWeight: 400, marginLeft: 12 }}>
                  点击表头排序 | 申购费率按支付宝1折计算
                </span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
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
                    {getSortedFunds().map((fund) => (
                      <tr key={fund.code}>
                        <td style={{ fontFamily: 'monospace' }}>{fund.code}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {fund.isGoldSelected && (
                              <span style={{ fontSize: 10, background: '#faad14', color: 'white', padding: '1px 4px', borderRadius: 2 }}>金选</span>
                            )}
                            <a href={`/funds/${fund.code}`} style={{ color: '#1677ff', textDecoration: 'none' }}>
                              {fund.name}
                            </a>
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
                          <span style={{ color: fund.totalFee > 0.8 ? '#ff4d4f' : '#333', fontWeight: fund.totalFee > 0.8 ? 600 : 400 }}>
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
                    {getSortedFunds().sort((a, b) => a.totalFee - b.totalFee).map((fund) => (
                      <tr key={fund.code}>
                        <td>{fund.name}</td>
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
                            color: fund.totalFee > 0.8 ? '#ff4d4f' : fund.totalFee <= 0.6 ? '#52c41a' : '#333',
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

              <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
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
                    {getSortedFunds().map((fund, index) => (
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
                            background: index < 3 ? '#faad14' : '#f0f0f0',
                            color: index < 3 ? 'white' : '#666',
                          }}>
                            {index + 1}
                          </span>
                        </td>
                        <td>{fund.name}</td>
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
                            background: fund.trend.includes('上涨') ? '#f6ffed' : fund.trend.includes('反弹') ? '#e6f4ff' : '#fff2f0',
                            color: fund.trend.includes('上涨') ? '#52c41a' : fund.trend.includes('反弹') ? '#1677ff' : '#ff4d4f',
                          }}>
                            {fund.trend}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                            <td style={{ fontWeight: 600 }}>{fund.name}</td>
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
                    background: '#e8e8e8',
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
                        background: '#1677ff',
                        border: '2px solid white',
                        boxShadow: '0 0 0 2px #1677ff',
                      }}></div>

                      <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e8e8e8' }}>
                        <div className="flex-between" style={{ marginBottom: 8 }}>
                          <h4>第 {plan.batch} 批</h4>
                          <span className="badge badge-success">{plan.percentage}%</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                          <strong>时间：</strong>{plan.time}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                          <strong>买入标的：</strong>{plan.targets}
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>
                          <strong>操作方式：</strong>{plan.method}
                        </div>
                        <div style={{ fontSize: 13, color: '#666' }}>
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
              <div className="card" style={{ border: '1px solid #ffccc7', background: '#fff2f0' }}>
                <h3 style={{ color: '#ff4d4f', marginBottom: 12 }}>风险提示</h3>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: '#666', whiteSpace: 'pre-line' }}>
                  {data.riskWarning}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
