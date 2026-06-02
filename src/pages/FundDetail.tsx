import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fundApi } from '../services/api';

interface FundDetail {
  code: string;
  name: string;
  fullName: string;
  type: string;
  company: string;
  index: string;
  industry: string;
  nav: number;
  navDate: string;
  establishDate: string;
  fundManager: string;
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
  totalFee: number;
  scale: number;
  share: number;
  shareChange: number;
  institutionHold: number;
  individualHold: number;
  purchaseStatus: string;
  dailyLimit: number;
  rating: number;
  recommendation: string;
  riskLevel: string;
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  valuation: string;
  redeemFee: { period: string; rate: number }[];
  topHoldings: { name: string; percentage: number }[];
  performanceHistory: { date: string; nav: number; return: number }[];
  investmentAdvice: string;
  suitableFor: string;
}

export default function FundDetail() {
  const { code } = useParams<{ code: string }>();
  const [fund, setFund] = useState<FundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadFundDetail();
  }, [code]);

  const loadFundDetail = async () => {
    if (!code) return;
    setLoading(true);
    try {
      const data = await fundApi.getFundDetail(code);
      setFund(data);
    } catch (error) {
      console.error('加载基金详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatReturn = (value: number) => {
    if (value === undefined || value === null) return '-';
    const colorClass = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={colorClass}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  const getValuationColor = (valuation: string) => {
    switch (valuation) {
      case 'very_low': return '#52c41a';
      case 'low': return '#73d13d';
      case 'reasonable': return '#1677ff';
      case 'high': return '#ff4d4f';
      case 'very_high': return '#cf1322';
      default: return '#666';
    }
  };

  const getValuationText = (valuation: string) => {
    switch (valuation) {
      case 'very_low': return '极低';
      case 'low': return '偏低';
      case 'reasonable': return '合理';
      case 'high': return '偏高';
      case 'very_high': return '极高';
      default: return '未知';
    }
  };

  const getRiskLevelText = (level: string) => {
    switch (level) {
      case 'high': return '高风险';
      case 'medium': return '中风险';
      case 'low': return '低风险';
      default: return '未知';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'badge-danger';
      case 'medium': return 'badge-warning';
      case 'low': return 'badge-success';
      default: return '';
    }
  };

  if (loading) {
    return <div className="text-center" style={{ padding: 40 }}>加载中...</div>;
  }

  if (!fund) {
    return (
      <div className="text-center" style={{ padding: 40 }}>
        <p>基金不存在</p>
        <Link to="/funds" className="btn btn-primary" style={{ marginTop: 16 }}>
          返回基金列表
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* 面包屑导航 */}
      <div style={{ marginBottom: 16, fontSize: 14, color: '#666' }}>
        <Link to="/" style={{ color: '#666' }}>首页</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link to="/funds" style={{ color: '#666' }}>基金列表</Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: '#333' }}>{fund.name}</span>
      </div>

      {/* 基金基本信息卡片 */}
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>{fund.name}</h1>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              {fund.fullName} | 基金经理: {fund.fundManager}
            </div>
            <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className="tag" style={{ background: '#e6f4ff', color: '#1677ff' }}>{fund.industry || fund.type}</span>
              <span className="tag">{fund.company}</span>
              <span className="tag">{fund.index}</span>
              <span className={`badge ${getRiskLevelColor(fund.riskLevel)}`}>
                {getRiskLevelText(fund.riskLevel)}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: '#1677ff' }}>
              {fund.nav?.toFixed(4)}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>最新净值 ({fund.navDate})</div>
            <div style={{ marginTop: 8 }}>
              <span className="rating" style={{ fontSize: 18 }}>{'★'.repeat(fund.rating)}</span>
            </div>
          </div>
        </div>

        {/* 收益率概览 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
          <div className="stat-item">
            <div className="stat-label">近1年</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{formatReturn(fund.return1y)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">近6月</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{formatReturn(fund.return6m)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">近3月</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{formatReturn(fund.return3m)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">近1月</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{formatReturn(fund.return1m)}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">近1周</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{formatReturn(fund.return1w)}</div>
          </div>
        </div>

        {/* 核心指标 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
          <div>
            <div style={{ color: '#666', fontSize: 12 }}>综合费率</div>
            <div style={{ fontWeight: 600, color: '#1677ff' }}>{fund.totalFee?.toFixed(2)}%/年</div>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 12 }}>基金规模</div>
            <div style={{ fontWeight: 600 }}>{fund.scale?.toFixed(2)}亿</div>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 12 }}>申购状态</div>
            <div>
              <span className={`badge ${fund.purchaseStatus === 'open' ? 'badge-success' : fund.purchaseStatus === 'limited' ? 'badge-warning' : 'badge-danger'}`}>
                {fund.purchaseStatus === 'open' ? '开放申购' : fund.purchaseStatus === 'limited' ? '限大额' : '暂停申购'}
              </span>
            </div>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 12 }}>每日限额</div>
            <div style={{ fontWeight: 600, color: fund.dailyLimit > 0 ? '#ff4d4f' : '#666' }}>
              {fund.dailyLimit > 0 ? `${fund.dailyLimit}元` : '无限额'}
            </div>
          </div>
        </div>
      </div>

      {/* 投资建议卡片 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>投资建议</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>推荐理由</div>
            <p style={{ lineHeight: 1.6 }}>{fund.recommendation}</p>
          </div>
          <div>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>适合人群</div>
            <p style={{ lineHeight: 1.6 }}>{fund.suitableFor}</p>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '12px', background: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>操作建议</div>
          <p style={{ lineHeight: 1.6 }}>{fund.investmentAdvice}</p>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8' }}>
          {[
            { key: 'overview', label: '基金概况' },
            { key: 'fee', label: '费率详情' },
            { key: 'valuation', label: '估值分析' },
            { key: 'holdings', label: '持仓分析' },
            { key: 'performance', label: '历史业绩' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '14px 24px',
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

      {/* 标签页内容 */}
      <div className="card">
        {activeTab === 'overview' && (
          <div>
            <h3 className="card-title">基金概况</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <table className="table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, width: 120, color: '#666' }}>基金代码</td>
                      <td>{fund.code}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>基金全称</td>
                      <td style={{ fontSize: 13 }}>{fund.fullName}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>基金类型</td>
                      <td>{fund.type}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>基金公司</td>
                      <td>{fund.company}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>基金经理</td>
                      <td>{fund.fundManager}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>跟踪指数</td>
                      <td>{fund.index}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>成立日期</td>
                      <td>{fund.establishDate}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, width: 120, color: '#666' }}>基金规模</td>
                      <td>{fund.scale?.toFixed(2)} 亿元</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>基金份额</td>
                      <td>{fund.share} 亿份</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>份额变化</td>
                      <td className={parseFloat(fund.shareChange) >= 0 ? 'rise' : 'fall'}>
                        {parseFloat(fund.shareChange) >= 0 ? '+' : ''}{fund.shareChange}%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>机构持有</td>
                      <td>{fund.institutionHold}%</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>个人持有</td>
                      <td>{fund.individualHold}%</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>推荐评级</td>
                      <td><span className="rating">{'★'.repeat(fund.rating)}</span></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>风险等级</td>
                      <td>
                        <span className={`badge ${getRiskLevelColor(fund.riskLevel)}`}>
                          {getRiskLevelText(fund.riskLevel)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 持有人结构可视化 */}
            <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <h4 style={{ marginBottom: 12 }}>持有人结构</h4>
              <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${fund.institutionHold}%`, background: '#1677ff' }}></div>
                <div style={{ width: `${fund.individualHold}%`, background: '#91caff' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#666' }}>
                <span>机构持有 {fund.institutionHold}%</span>
                <span>个人持有 {fund.individualHold}%</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fee' && (
          <div>
            <h3 className="card-title">费率详情</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ marginBottom: 16, fontSize: 15 }}>管理费率</h4>
                <table className="table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>管理费</td>
                      <td>{fund.managementFee?.toFixed(2)}%/年</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>托管费</td>
                      <td>{fund.custodyFee?.toFixed(2)}%/年</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>销售服务费</td>
                      <td>{fund.serviceFee?.toFixed(2)}%/年</td>
                    </tr>
                    <tr style={{ background: '#f6ffed' }}>
                      <td style={{ fontWeight: 600, color: '#52c41a' }}>综合费率</td>
                      <td style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>{fund.totalFee?.toFixed(2)}%/年</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ marginBottom: 16, fontSize: 15 }}>申购费率</h4>
                <table className="table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600, color: '#666' }}>原申购费</td>
                      <td>{fund.purchaseFee?.toFixed(2)}%</td>
                    </tr>
                    <tr style={{ background: '#f6ffed' }}>
                      <td style={{ fontWeight: 600, color: '#52c41a' }}>支付宝1折</td>
                      <td style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>{fund.purchaseFeeDiscount?.toFixed(2)}%</td>
                    </tr>
                  </tbody>
                </table>

                <h4 style={{ marginBottom: 16, marginTop: 24, fontSize: 15 }}>赎回费率</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>持有时间</th>
                      <th>费率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fund.redeemFee?.map((fee, index) => (
                      <tr key={index}>
                        <td>{fee.period}</td>
                        <td>{fee.rate?.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffe58f' }}>
              <h4 style={{ color: '#faad14', marginBottom: 8 }}>费率说明</h4>
              <ul style={{ fontSize: 13, lineHeight: 1.8, color: '#666' }}>
                <li>综合费率 = 管理费 + 托管费 + 销售服务费</li>
                <li>支付宝购买可享受申购费1折优惠</li>
                <li>持有时间越长，赎回费越低，持有2年以上通常免赎回费</li>
                <li>C类基金免申购费，但有销售服务费</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'valuation' && (
          <div>
            <h3 className="card-title">估值分析</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              <div className="stat-item" style={{ padding: 20 }}>
                <div className="stat-label" style={{ fontSize: 14 }}>PE(TTM)</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{fund.pe}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>市盈率</div>
              </div>
              <div className="stat-item" style={{ padding: 20 }}>
                <div className="stat-label" style={{ fontSize: 14 }}>PB</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{fund.pb}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>市净率</div>
              </div>
              <div className="stat-item" style={{ padding: 20 }}>
                <div className="stat-label" style={{ fontSize: 14 }}>PE历史分位</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{fund.pePercentile}%</div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div className="progress-fill" style={{ width: `${fund.pePercentile}%` }}></div>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  比 {fund.pePercentile}% 的时间便宜
                </div>
              </div>
              <div className="stat-item" style={{ padding: 20 }}>
                <div className="stat-label" style={{ fontSize: 14 }}>PB历史分位</div>
                <div className="stat-value" style={{ fontSize: 28 }}>{fund.pbPercentile}%</div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div className="progress-fill" style={{ width: `${fund.pbPercentile}%` }}></div>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  比 {fund.pbPercentile}% 的时间便宜
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 20, background: '#f5f5f5', borderRadius: 8 }}>
              <h4 style={{ marginBottom: 12 }}>估值判断</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: getValuationColor(fund.valuation),
                  padding: '8px 20px',
                  background: 'white',
                  borderRadius: 8,
                  border: `2px solid ${getValuationColor(fund.valuation)}`,
                }}>
                  {getValuationText(fund.valuation)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ lineHeight: 1.6, color: '#333' }}>
                    {fund.valuation === 'very_low' || fund.valuation === 'low'
                      ? '当前估值处于历史低位，具有较好的投资价值，适合逢低布局或定投配置。'
                      : fund.valuation === 'reasonable'
                      ? '当前估值处于合理区间，适合正常定投配置。'
                      : '当前估值偏高，建议谨慎投资，可等待回调后再买入。'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'holdings' && (
          <div>
            <h3 className="card-title">前十大持仓</h3>
            {fund.topHoldings && fund.topHoldings.length > 0 ? (
              <div>
                <div style={{ marginBottom: 16 }}>
                  {fund.topHoldings.map((holding, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: 12,
                      padding: '12px 16px',
                      background: index % 2 === 0 ? '#fafafa' : 'white',
                      borderRadius: 8,
                    }}>
                      <span style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: index < 3 ? '#1677ff' : '#e8e8e8',
                        color: index < 3 ? 'white' : '#666',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                        marginRight: 12,
                      }}>
                        {index + 1}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{holding.name}</span>
                      <span style={{ width: 80, textAlign: 'right', fontWeight: 600, color: '#1677ff' }}>
                        {holding.percentage?.toFixed(2)}%
                      </span>
                      <div style={{ width: 150, marginLeft: 16 }}>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${holding.percentage * 5}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffe58f' }}>
                  <p style={{ fontSize: 12, color: '#666' }}>
                    * 持仓数据为历史披露，仅供参考，实际持仓可能已发生变化
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted">暂无持仓数据</p>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div>
            <h3 className="card-title">历史业绩</h3>
            {fund.performanceHistory && fund.performanceHistory.length > 0 ? (
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>净值</th>
                      <th>涨跌幅</th>
                      <th>走势</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fund.performanceHistory.map((record, index) => (
                      <tr key={index}>
                        <td>{record.date}</td>
                        <td>{record.nav?.toFixed(4)}</td>
                        <td style={{ fontWeight: 600 }}>{formatReturn(record.return)}</td>
                        <td>
                          <div style={{
                            width: 100,
                            height: 8,
                            background: '#f0f0f0',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${Math.abs(record.return) * 10}%`,
                              height: '100%',
                              background: record.return >= 0 ? '#ff4d4f' : '#52c41a',
                              borderRadius: 4,
                            }}></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                  <p style={{ fontSize: 12, color: '#666' }}>
                    * 历史业绩不代表未来表现，仅供参考。基金有风险，投资需谨慎。
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted">暂无历史业绩数据</p>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Link to="/funds" className="btn btn-outline">
            返回列表
          </Link>
          <Link to={`/compare?codes=${fund.code}`} className="btn btn-outline">
            加入对比
          </Link>
          <a
            href={`https://fund.eastmoney.com/${fund.code}.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            在东方财富查看
          </a>
        </div>
      </div>
    </div>
  );
}
