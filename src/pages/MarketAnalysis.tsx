import { useState, useEffect } from 'react';
import { fundApi } from '../services/api';

interface MarketIndex {
  name: string;
  code: string;
  pe: string;
  pb: string;
  pePercentile: string;
  pbPercentile: string;
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

interface BatchPlan {
  batch: number;
  time: string;
  percentage: number;
  targets: string;
  method: string;
  reason: string;
}

export default function MarketAnalysis() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [recommendations, setRecommendations] = useState<IndustryRecommendation[]>([]);
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('indices');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [indicesData, recsData, plansData] = await Promise.all([
        fundApi.getMarketIndices(),
        fundApi.getIndustryRecommendations(),
        fundApi.getBatchPlans(),
      ]);
      setIndices(indicesData);
      setRecommendations(recsData);
      setBatchPlans(plansData);
    } catch (error) {
      console.error('加载市场数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getValuationColor = (valuation: string) => {
    if (valuation.includes('极低') || valuation.includes('低估')) return '#52c41a';
    if (valuation.includes('偏低')) return '#73d13d';
    if (valuation.includes('合理')) return '#1677ff';
    if (valuation.includes('偏高') || valuation.includes('高')) return '#ff4d4f';
    return '#666';
  };

  const formatReturn = (value: number) => {
    if (value === undefined || value === null) return '-';
    const colorClass = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={colorClass}>{value >= 0 ? '+' : ''}{value.toFixed(1)}%</span>;
  };

  if (loading) {
    return <div className="text-center" style={{ padding: 40 }}>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>市场分析</h1>

      {/* 标签页导航 */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8' }}>
          {[
            { key: 'indices', label: '指数估值' },
            { key: 'recommendations', label: '行业推荐' },
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 指数估值 */}
      {activeTab === 'indices' && (
        <div className="card">
          <h3 className="card-title">A股主要指数估值水平</h3>
          <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
            数据来源：东方财富，仅供参考
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>指数</th>
                  <th>PE(TTM)</th>
                  <th>PE历史分位</th>
                  <th>PB</th>
                  <th>PB历史分位</th>
                  <th>估值判断</th>
                  <th>投资建议</th>
                </tr>
              </thead>
              <tbody>
                {indices.map((index) => (
                  <tr key={index.name}>
                    <td style={{ fontWeight: 600 }}>{index.name}</td>
                    <td>{index.pe}</td>
                    <td>
                      <div className="flex" style={{ gap: 8 }}>
                        <span>{index.pePercentile}%</span>
                        <div className="progress-bar" style={{ flex: 1, marginTop: 4 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${index.pePercentile}%`,
                              background: getValuationColor(index.valuation),
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>{index.pb}</td>
                    <td>
                      <div className="flex" style={{ gap: 8 }}>
                        <span>{index.pbPercentile}%</span>
                        <div className="progress-bar" style={{ flex: 1, marginTop: 4 }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${index.pbPercentile}%`,
                              background: getValuationColor(index.valuation),
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: getValuationColor(index.valuation), fontWeight: 600 }}>
                        {index.valuation}
                      </span>
                    </td>
                    <td>{index.suggestion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 估值说明 */}
          <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <h4 style={{ marginBottom: 8 }}>估值分位说明</h4>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <p><strong>PE历史分位</strong>：当前PE在历史上的位置，数值越低表示越便宜</p>
              <p><strong>分位解读</strong>：</p>
              <ul style={{ paddingLeft: 20 }}>
                <li>20%以下：极度低估，适合重仓买入</li>
                <li>20-40%：偏低估，适合定投加仓</li>
                <li>40-60%：合理区间，适合正常定投</li>
                <li>60-80%：偏高估，适合小额定投</li>
                <li>80%以上：极度高估，建议观望或减仓</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 行业推荐 */}
      {activeTab === 'recommendations' && (
        <div>
          <div className="card">
            <h3 className="card-title">各行业基金综合推荐</h3>
            <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
              基于收益、估值、政策面等多维度分析
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>行业</th>
                    <th>推荐基金</th>
                    <th>跟踪指数</th>
                    <th>评级</th>
                    <th>近1年</th>
                    <th>近3月</th>
                    <th>走势</th>
                    <th>估值</th>
                    <th>买入建议</th>
                    <th>仓位</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((rec) => (
                    <tr key={rec.rank}>
                      <td style={{ fontWeight: 600 }}>{rec.rank}</td>
                      <td>
                        <span className="tag tag-active">{rec.industry}</span>
                      </td>
                      <td>
                        <a href={`/funds/${rec.fundCode}`} style={{ color: '#1677ff' }}>
                          {rec.fundName}
                        </a>
                      </td>
                      <td style={{ fontSize: 12 }}>{rec.index}</td>
                      <td><span className="rating">{'★'.repeat(rec.rating)}</span></td>
                      <td>{formatReturn(rec.return1y)}</td>
                      <td>{formatReturn(rec.return3m)}</td>
                      <td>{rec.trend}</td>
                      <td>
                        <span style={{ color: getValuationColor(rec.valuation) }}>
                          {rec.valuation}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${rec.buySuggestion === '优先配置' ? 'badge-success' : rec.buySuggestion === '逢低布局' ? 'badge-warning' : 'badge-default'}`}>
                          {rec.buySuggestion}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{rec.positionSuggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 推荐逻辑 */}
          <div className="card">
            <h3 className="card-title">推荐逻辑</h3>
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.rank} style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                <h4 style={{ marginBottom: 4 }}>{rec.industry}</h4>
                <p style={{ fontSize: 13, color: '#666' }}>{rec.logic}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 分批建仓 */}
      {activeTab === 'batch' && (
        <div>
          <div className="card">
            <h3 className="card-title">分批建仓方案</h3>
            <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
              核心策略：高低切换 + 分批建仓 + 估值优先
            </p>

            {/* 时间线 */}
            <div style={{ position: 'relative', paddingLeft: 30 }}>
              <div style={{
                position: 'absolute',
                left: 15,
                top: 0,
                bottom: 0,
                width: 2,
                background: '#e8e8e8',
              }}></div>

              {batchPlans.map((plan, index) => (
                <div key={index} style={{ marginBottom: 24, position: 'relative' }}>
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
                      <strong>买入标的：</strong>
                      <pre style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 12 }}>{plan.targets}</pre>
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
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <ul style={{ paddingLeft: 20 }}>
                <li><strong>分批买入</strong>：不要一次性投入，分3-4批建仓</li>
                <li><strong>估值优先</strong>：优先配置估值较低的品种</li>
                <li><strong>核心+卫星</strong>：70%配置核心品种，30%配置弹性品种</li>
                <li><strong>动态调整</strong>：根据市场变化调整后续批次的品种和比例</li>
                <li><strong>设定止损</strong>：单只基金亏损超过15%考虑止损</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
