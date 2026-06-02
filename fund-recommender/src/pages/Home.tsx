import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fundApi } from '../services/api';

interface MarketIndex {
  name: string;
  code: string;
  pe: number;
  pb: number;
  pePercentile: number;
  valuation: string;
  suggestion: string;
}

interface SectorData {
  name: string;
  change: number;
  volume: string;
  leadingStock: string;
}

interface FundFlow {
  name: string;
  inflow: number;
  outflow: number;
  net: number;
}

export default function Home() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 模拟板块轮动数据
  const sectorRotation: SectorData[] = [
    { name: '人工智能', change: 3.85, volume: '856亿', leadingStock: '科大讯飞' },
    { name: '半导体', change: 2.92, volume: '623亿', leadingStock: '北方华创' },
    { name: '新能源', change: 1.56, volume: '445亿', leadingStock: '宁德时代' },
    { name: '医药', change: -0.85, volume: '312亿', leadingStock: '恒瑞医药' },
    { name: '消费', change: -1.23, volume: '278亿', leadingStock: '贵州茅台' },
    { name: '军工', change: 0.68, volume: '198亿', leadingStock: '中航沈飞' },
    { name: '金融', change: -0.45, volume: '425亿', leadingStock: '招商银行' },
    { name: '地产', change: -2.15, volume: '156亿', leadingStock: '万科A' },
  ];

  // 模拟资金流向数据
  const fundFlows: FundFlow[] = [
    { name: '北向资金', inflow: 85.6, outflow: 62.3, net: 23.3 },
    { name: '主力资金', inflow: 1256, outflow: 1189, net: 67 },
    { name: '散户资金', inflow: 856, outflow: 923, net: -67 },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [indicesData, recsData] = await Promise.all([
        fundApi.getMarketIndices(),
        fundApi.getIndustryRecommendations(),
      ]);
      setIndices(indicesData);
      setRecommendations(recsData);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center" style={{ padding: 40 }}>加载中...</div>;
  }

  return (
    <div>
      {/* 顶部市场概览 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'white', margin: 0 }}>市场概览</h2>
          <span style={{ fontSize: 12, opacity: 0.7 }}>数据每15分钟更新</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {indices.slice(0, 4).map((index, i) => {
            const prices = [3856.42, 5823.15, 2156.78, 1023.45];
            const changes = [1.25, -0.68, 2.15, -1.32];
            return (
              <div key={index.code} style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 4 }}>{index.name}</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{prices[i]?.toFixed(2)}</div>
                <div style={{ fontSize: 14, marginTop: 4 }}>
                  <span style={{ color: changes[i] > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {changes[i] > 0 ? '+' : ''}{changes[i]}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 板块轮动 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>今日板块轮动</h3>
          <span style={{ fontSize: 12, color: '#666' }}>按涨跌幅排序</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 13, color: '#666' }}>排名</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 13, color: '#666' }}>板块</th>
                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, color: '#666' }}>涨跌幅</th>
                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, color: '#666' }}>成交额</th>
                <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 13, color: '#666' }}>领涨股</th>
              </tr>
            </thead>
            <tbody>
              {sectorRotation
                .sort((a, b) => b.change - a.change)
                .map((sector, index) => (
                <tr key={sector.name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: index < 3 ? '#ff4d4f' : '#f0f0f0',
                      color: index < 3 ? 'white' : '#666',
                      textAlign: 'center',
                      lineHeight: '24px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {index + 1}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{sector.name}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>
                    <span className={sector.change > 0 ? 'rise' : 'fall'}>
                      {sector.change > 0 ? '+' : ''}{sector.change}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#666' }}>{sector.volume}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#1677ff' }}>{sector.leadingStock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 资金流向 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16 }}>大盘资金流向</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {fundFlows.map((flow) => (
            <div key={flow.name} style={{
              padding: 16,
              background: flow.net > 0 ? '#fff1f0' : '#f6ffed',
              borderRadius: 8,
              border: `1px solid ${flow.net > 0 ? '#ffa39e' : '#b7eb8f'}`,
            }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>{flow.name}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: flow.net > 0 ? '#ff4d4f' : '#52c41a' }}>
                {flow.net > 0 ? '+' : ''}{flow.net}亿
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#ff4d4f' }}>流入 {flow.inflow}亿</span>
                <span style={{ color: '#52c41a' }}>流出 {flow.outflow}亿</span>
              </div>
              <div style={{ marginTop: 8, height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${(flow.inflow / (flow.inflow + flow.outflow)) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #ff4d4f, #ff7875)',
                  borderRadius: 4,
                }}></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14 }}>行业资金净流入TOP5</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {sectorRotation
              .sort((a, b) => b.change - a.change)
              .slice(0, 5)
              .map((sector) => (
              <div key={sector.name} style={{
                padding: 12,
                background: '#f5f5f5',
                borderRadius: 8,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{sector.name}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#ff4d4f' }}>
                  +{(Math.random() * 50 + 10).toFixed(1)}亿
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16 }}>快捷入口</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Link to="/funds" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 20,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 12,
              textAlign: 'center',
              color: 'white',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 600 }}>基金列表</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>查看全部基金</div>
            </div>
          </Link>
          <Link to="/qdii" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 20,
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: 12,
              textAlign: 'center',
              color: 'white',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🌍</div>
              <div style={{ fontWeight: 600 }}>QDII基金</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>投资海外市场</div>
            </div>
          </Link>
          <Link to="/compare" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 20,
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: 12,
              textAlign: 'center',
              color: 'white',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
              <div style={{ fontWeight: 600 }}>基金对比</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>对比选择最优</div>
            </div>
          </Link>
          <Link to="/risk-assessment" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 20,
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              borderRadius: 12,
              textAlign: 'center',
              color: 'white',
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
              <div style={{ fontWeight: 600 }}>风险评估</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>了解你的风险偏好</div>
            </div>
          </Link>
        </div>
      </div>

      {/* 行业推荐 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>热门行业推荐</h3>
          <Link to="/funds" style={{ color: '#1677ff', fontSize: 13 }}>查看更多 →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {recommendations.slice(0, 4).map((rec) => (
            <div key={rec.industry} style={{
              padding: 16,
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              background: 'white',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{rec.industry}</span>
                <span className={`badge ${rec.buySuggestion === '优先配置' ? 'badge-danger' : rec.buySuggestion === '限大额配置' ? 'badge-warning' : 'badge-success'}`}>
                  {rec.buySuggestion}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{rec.logic}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {rec.funds?.slice(0, 2).map((fund: any) => (
                  <Link
                    key={fund.code}
                    to={`/funds/${fund.code}`}
                    style={{
                      padding: '4px 8px',
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#1677ff',
                      textDecoration: 'none',
                    }}
                  >
                    {fund.name?.substring(0, 8)}...
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 估值温度计 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16 }}>市场估值温度计</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {indices.map((index) => (
            <div key={index.code} style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>{index.name}</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: index.valuation.includes('低') ? '#f6ffed' : index.valuation.includes('高') ? '#fff2f0' : '#e6f4ff',
                  color: index.valuation.includes('低') ? '#52c41a' : index.valuation.includes('高') ? '#ff4d4f' : '#1677ff',
                }}>
                  {index.valuation}
                </span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginBottom: 4 }}>
                  <span>低估</span>
                  <span>适中</span>
                  <span>高估</span>
                </div>
                <div style={{ height: 8, background: 'linear-gradient(90deg, #52c41a, #faad14, #ff4d4f)', borderRadius: 4, position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${index.pePercentile}%`,
                    top: -4,
                    width: 16,
                    height: 16,
                    background: 'white',
                    border: '2px solid #1677ff',
                    borderRadius: '50%',
                    transform: 'translateX(-50%)',
                  }}></div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                PE分位: {index.pePercentile}% | {index.suggestion}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 今日操作建议 */}
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>今日操作建议</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <h4 style={{ color: '#52c41a', marginBottom: 8, fontSize: 14 }}>适合买入</h4>
            <ul style={{ fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
              <li>医药指数基金（估值极低）</li>
              <li>新能源基金（底部反弹）</li>
              <li>沪深300指数（定投配置）</li>
            </ul>
          </div>
          <div style={{ padding: 16, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
            <h4 style={{ color: '#faad14', marginBottom: 8, fontSize: 14 }}>观望等待</h4>
            <ul style={{ fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
              <li>AI/人工智能（估值偏高）</li>
              <li>半导体（等待回调）</li>
              <li>科创50（估值偏高）</li>
            </ul>
          </div>
          <div style={{ padding: 16, background: '#fff1f0', borderRadius: 8, border: '1px solid #ffa39e' }}>
            <h4 style={{ color: '#ff4d4f', marginBottom: 8, fontSize: 14 }}>谨慎持有</h4>
            <ul style={{ fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
              <li>地产基金（政策风险）</li>
              <li>白酒（估值偏高）</li>
              <li>高位QDII（限额紧张）</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
