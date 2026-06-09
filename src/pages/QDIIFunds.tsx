import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Tabs, Table, Tag, Button, Spin, Row, Col, Alert } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';

interface Fund {
  code: string;
  name: string;
  type: string;
  industry: string;
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
  scale: number;
  rating: number;
  buySuggestion: string;
  valuation: string;
  trend: string;
  logic: string;
  dailyLimit?: number;
}

interface SP500Fund {
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
}

interface Holding {
  name: string;
  code: string;
  weight: number;
  industry: string;
  pe: number;
  roe: number;
  revenueGrowth: number;
  epsGrowth: number;
  analystConsensus: string;
  outlook: string;
}

interface SP500Analysis {
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
  funds: SP500Fund[];
  topHoldings: Holding[];
  recommendation: {
    summary: string;
    bullFactors: string[];
    bearFactors: string[];
    strategy: {
      shortTerm: string;
      mediumTerm: string;
      longTerm: string;
    };
    bestPicks: Array<{ code: string; name: string; reason: string }>;
    batchPlan: Array<{ batch: number; time: string; pct: number; action: string; reason: string }>;
  };
}

export default function QDIIFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [sp500Data, setSp500Data] = useState<SP500Analysis | null>(null);
  const [sp500Loading, setSp500Loading] = useState(false);
  const [sp500Tab, setSp500Tab] = useState('funds');
  const [sortField, setSortField] = useState<string>('dailyLimit');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('descend');

  useEffect(() => {
    loadQDIIFunds();
    const interval = setInterval(loadQDIIFunds, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQDIIFunds = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getQDIIFunds();
      setFunds(data);
    } catch (error) {
      console.error('加载QDII基金失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSP500 = async () => {
    if (sp500Data) return;
    setSp500Loading(true);
    try {
      const result = await fundApi.getSP500Analysis();
      setSp500Data(result);
    } catch (error) {
      console.error('加载标普500分析数据失败:', error);
    } finally {
      setSp500Loading(false);
    }
  };

  const nasdaqFunds = useMemo(() => funds.filter(f => f.industry === '纳斯达克100'), [funds]);
  const sp500Funds = useMemo(() => funds.filter(f => f.industry === '标普500'), [funds]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'ascend' ? 'descend' : 'ascend');
    } else {
      setSortField(field);
      setSortOrder('descend');
    }
  };

  const sortedSP500Funds = useMemo(() => {
    if (!sp500Data) return [];
    return [...sp500Data.funds].sort((a, b) => {
      let valA = 0, valB = 0;
      switch (sortField) {
        case 'return1y': valA = a.return1y; valB = b.return1y; break;
        case 'return6m': valA = a.return6m; valB = b.return6m; break;
        case 'return3m': valA = a.return3m; valB = b.return3m; break;
        case 'return1m': valA = a.return1m; valB = b.return1m; break;
        case 'totalFee': valA = a.totalFee; valB = b.totalFee; break;
        case 'scale': valA = a.scale; valB = b.scale; break;
        case 'dailyLimit': valA = a.dailyLimit ?? 0; valB = b.dailyLimit ?? 0; break;
        default: valA = a.return1y; valB = b.return1y;
      }
      return sortOrder === 'ascend' ? valA - valB : valB - valA;
    });
  }, [sp500Data, sortField, sortOrder]);

  const renderReturn = (val: number) => (
    <span style={{ color: getReturnColor(val), fontWeight: 600 }}>{formatReturn(val)}</span>
  );

  const sp500RenderReturn = (value: number) => {
    if (value === undefined || value === null) return <span style={{ color: '#999' }}>-</span>;
    return <span style={{ color: getReturnColor(value), fontWeight: 600 }}>{formatReturn(value)}</span>;
  };

  const nasdaqColumns = [
    {
      title: '基金代码',
      dataIndex: 'code',
      key: 'code',
      width: 90,
      render: (code: string) => <Link to={`/funds/${code}`} style={{ color: '#1677ff' }}>{code}</Link>,
    },
    {
      title: '基金名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Fund) => (
        <Link to={`/funds/${record.code}`} style={{ color: '#1677ff', fontWeight: 500 }}>{name}</Link>
      ),
    },
    {
      title: '份额', key: 'type', width: 70,
      render: (_: any, record: Fund) => {
        const name = record.name;
        if (/\(C\)|C$|C类/.test(name) && !/AC/.test(name)) return <Tag color="blue">C</Tag>;
        if (/\(I\)|I$|I类/.test(name)) return <Tag color="purple">I</Tag>;
        if (/\(D\)|D$|D类/.test(name)) return <Tag color="cyan">D</Tag>;
        if (record.type === 'ETF') return <Tag color="green">ETF</Tag>;
        return <Tag color="orange">A</Tag>;
      },
    },
    { title: '近1年', dataIndex: 'return1y', key: 'return1y', sorter: (a: Fund, b: Fund) => a.return1y - b.return1y, render: renderReturn },
    { title: '近3月', dataIndex: 'return3m', key: 'return3m', sorter: (a: Fund, b: Fund) => a.return3m - b.return3m, render: renderReturn },
    { title: '近1月', dataIndex: 'return1m', key: 'return1m', sorter: (a: Fund, b: Fund) => a.return1m - b.return1m, render: renderReturn },
    { title: '管理费', dataIndex: 'managementFee', key: 'managementFee', sorter: (a: Fund, b: Fund) => a.managementFee - b.managementFee, render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '综合费率', dataIndex: 'totalFee', key: 'totalFee', sorter: (a: Fund, b: Fund) => a.totalFee - b.totalFee, render: (v: number) => <strong>{v?.toFixed(2)}%</strong> },
    { title: '规模(亿)', dataIndex: 'scale', key: 'scale', sorter: (a: Fund, b: Fund) => a.scale - b.scale, render: (v: number) => v?.toFixed(1) },
    {
      title: '每日限额',
      dataIndex: 'dailyLimit',
      key: 'dailyLimit',
      defaultSortOrder: 'descend' as const,
      sorter: (a: Fund, b: Fund) => (a.dailyLimit ?? 0) - (b.dailyLimit ?? 0),
      render: (v: number) => {
        const label = v === 0 ? '暂停' : v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}元`;
        const color = v === 0 ? '#999' : v <= 10 ? '#ff4d4f' : v >= 10000 ? '#52c41a' : '#faad14';
        return <span style={{ fontWeight: 600, color }}>{label}</span>;
      },
    },
    {
      title: '申购状态',
      dataIndex: 'buySuggestion',
      key: 'buySuggestion',
      render: (text: string) => (
        <Tag color={text === '暂停申购' ? 'red' : text === '限大额' ? 'orange' : text === '场内交易' ? 'purple' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_: any, record: Fund) => <Link to={`/funds/${record.code}`}><Button type="link" size="small">详情</Button></Link>,
    },
  ];

  const sp500Columns = [
    {
      title: '基金代码', dataIndex: 'code', key: 'code', width: 90,
      render: (code: string) => <Link to={`/funds/${code}`} style={{ color: '#1677ff' }}>{code}</Link>,
    },
    {
      title: '基金名称', dataIndex: 'name', key: 'name', width: 220,
      render: (name: string, record: SP500Fund) => (
        <div>
          <Link to={`/funds/${record.code}`} style={{ color: '#1677ff', fontWeight: 500, fontSize: 13 }}>{name}</Link>
          {record.isGoldSelected && <Tag color="gold" style={{ marginLeft: 4, fontSize: 10 }}>金选</Tag>}
        </div>
      ),
    },
    {
      title: '近1年', dataIndex: 'return1y', key: 'return1y', width: 90,
      sorter: true, sortOrder: sortField === 'return1y' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => handleSort('return1y') }),
      render: sp500RenderReturn,
    },
    {
      title: '近6月', dataIndex: 'return6m', key: 'return6m', width: 90,
      sorter: true, sortOrder: sortField === 'return6m' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => handleSort('return6m') }),
      render: sp500RenderReturn,
    },
    {
      title: '近3月', dataIndex: 'return3m', key: 'return3m', width: 90,
      sorter: true, sortOrder: sortField === 'return3m' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => handleSort('return3m') }),
      render: sp500RenderReturn,
    },
    {
      title: '近1月', dataIndex: 'return1m', key: 'return1m', width: 90,
      render: sp500RenderReturn,
    },
    {
      title: '综合费率', dataIndex: 'totalFee', key: 'totalFee', width: 90,
      sorter: true, sortOrder: sortField === 'totalFee' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => handleSort('totalFee') }),
      render: (v: number) => <strong>{v?.toFixed(2)}%</strong>,
    },
    {
      title: '规模(亿)', dataIndex: 'scale', key: 'scale', width: 90,
      sorter: true, sortOrder: sortField === 'scale' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => handleSort('scale') }),
      render: (v: number) => v?.toFixed(1),
    },
    {
      title: '每日限额', dataIndex: 'dailyLimit', key: 'dailyLimit', width: 90,
      sorter: true, sortOrder: sortField === 'dailyLimit' ? sortOrder : undefined,
      onHeaderCell: () => ({ onClick: () => handleSort('dailyLimit') }),
      render: (v: number) => {
        const label = v === 0 ? '暂停' : v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}元`;
        const color = v === 0 ? '#999' : v <= 10 ? '#ff4d4f' : v >= 10000 ? '#52c41a' : '#faad14';
        return <span style={{ fontWeight: 600, color }}>{label}</span>;
      },
    },
    {
      title: '申购状态', dataIndex: 'buySuggestion', key: 'buySuggestion', width: 100,
      render: (text: string) => (
        <Tag color={text === '暂停申购' ? 'red' : text === '限大额' ? 'orange' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '评级', dataIndex: 'rating', key: 'rating', width: 80,
      render: (r: number) => <span style={{ color: '#faad14' }}>{'★'.repeat(r)}</span>,
    },
    {
      title: '操作', key: 'action', width: 70,
      render: (_: any, record: SP500Fund) => (
        <Link to={`/funds/${record.code}`}>
          <Button type="link" size="small">详情</Button>
        </Link>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'nasdaq100',
      label: `纳斯达克100 (${nasdaqFunds.length})`,
      children: (
        <div>
          <Alert
            type="success"
            message="首选推荐"
            description={
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <strong>华安纳斯达克100ETF联接A (040046)</strong>
                  <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>费率适中0.80%，规模大47亿，金选基金</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+30.99%</span></p>
                </Col>
                <Col xs={24} sm={8}>
                  <strong>天弘纳斯达克100指数A (018043)</strong>
                  <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>费率最低0.60%，规模22亿</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+30.48%</span></p>
                </Col>
                <Col xs={24} sm={8}>
                  <strong>南方纳斯达克100指数A (016452)</strong>
                  <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>费率0.65%，限额最高200元/日</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+30.20%</span></p>
                </Col>
              </Row>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table columns={nasdaqColumns} dataSource={nasdaqFunds} rowKey="code" pagination={false} size="small" scroll={{ x: 1000 }} />
        </div>
      ),
    },
    {
      key: 'sp500',
      label: `标普500 (${sp500Funds.length})`,
      children: (
        <div>
          {/* 估值概览卡片 */}
          {sp500Data && (
            <Card style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)', border: 'none', marginBottom: 20, color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
                <div>
                  <h3 style={{ color: 'white', marginBottom: 8 }}>标普500指数估值</h3>
                  <p style={{ opacity: 0.85, fontSize: 14 }}>{sp500Data.recommendation.summary}</p>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{sp500Data.valuation.currentPrice}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>当前点位</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{sp500Data.valuation.pe}x</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>PE(TTM)</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{sp500Data.valuation.pePercentile}%</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>PE历史分位</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{sp500Data.valuation.dividendYield}%</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>股息率</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 子标签页导航 */}
          <Card style={{ padding: 0, marginBottom: 16 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', overflowX: 'auto' }}>
              {[
                { key: 'funds', label: `基金对比 (${sp500Data?.funds.length ?? 0})` },
                { key: 'holdings', label: `权重股分析 (${sp500Data?.topHoldings.length ?? 0})` },
                { key: 'strategy', label: '投资策略' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSp500Tab(tab.key)}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    borderBottom: sp500Tab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                    color: sp500Tab === tab.key ? '#1677ff' : '#666',
                    fontWeight: sp500Tab === tab.key ? 600 : 400,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </Card>

          {sp500Loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" tip="加载标普500分析数据中..." /></div>
          ) : !sp500Data ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无标普500分析数据</div>
          ) : (
            <>
              {/* 基金对比 */}
              {sp500Tab === 'funds' && (
                <div>
                  <Alert
                    type="success"
                    message="首选推荐"
                    description={
                      <Row gutter={16}>
                        {sp500Data.recommendation.bestPicks.map(pick => (
                          <Col xs={24} sm={12} key={pick.code}>
                            <div style={{ marginBottom: 8 }}>
                              <Link to={`/funds/${pick.code}`} style={{ fontWeight: 600, color: '#1677ff' }}>
                                {pick.name} ({pick.code})
                              </Link>
                              <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0' }}>{pick.reason}</p>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    }
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                  <Card title="标普500指数基金完整对比">
                    <div style={{ overflowX: 'auto' }}>
                      <Table
                        dataSource={sortedSP500Funds}
                        rowKey="code"
                        pagination={false}
                        size="small"
                        scroll={{ x: 1100 }}
                        columns={sp500Columns}
                      />
                    </div>
                  </Card>
                </div>
              )}

              {/* 权重股分析 */}
              {sp500Tab === 'holdings' && (
                <div>
                  <Card title="标普500前10大权重股分析" style={{ marginBottom: 16 }}>
                    <p style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
                      标普500由美国500家大型上市公司组成，前10大权重股占比约35%，科技巨头主导走势
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>股票</th>
                            <th>代码</th>
                            <th>行业</th>
                            <th>权重%</th>
                            <th>PE</th>
                            <th>ROE%</th>
                            <th>营收增长%</th>
                            <th>EPS增长%</th>
                            <th>分析师共识</th>
                            <th>前景判断</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sp500Data.topHoldings.map(h => (
                            <tr key={h.code}>
                              <td style={{ fontWeight: 600 }}>{h.name}</td>
                              <td style={{ fontSize: 12, color: '#999' }}>{h.code}</td>
                              <td><span className="tag tag-active">{h.industry}</span></td>
                              <td style={{ fontWeight: 600 }}>{h.weight}%</td>
                              <td>{h.pe}x</td>
                              <td style={{ fontWeight: 600, color: h.roe > 20 ? '#52c41a' : h.roe > 10 ? '#1677ff' : '#faad14' }}>
                                {h.roe}%
                              </td>
                              <td className={h.revenueGrowth > 0 ? 'rise' : 'fall'}>
                                {h.revenueGrowth > 0 ? '+' : ''}{h.revenueGrowth}%
                              </td>
                              <td className={h.epsGrowth > 0 ? 'rise' : 'fall'}>
                                {h.epsGrowth > 0 ? '+' : ''}{h.epsGrowth}%
                              </td>
                              <td>
                                <span className={`badge ${h.analystConsensus === '强烈买入' ? 'badge-success' : h.analystConsensus === '买入' ? 'badge-info' : 'badge-warning'}`}>
                                  {h.analystConsensus}
                                </span>
                              </td>
                              <td style={{ fontSize: 12, maxWidth: 200 }}>{h.outlook}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                  <Card>
                    <h4 style={{ marginBottom: 8 }}>权重股基本面小结</h4>
                    <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                      <p><strong>AI龙头：</strong>英伟达(EPS+145%)、微软(EPS+18.5%)、Meta(EPS+35.8%) — AI革命核心受益者，盈利爆发式增长</p>
                      <p><strong>稳健巨头：</strong>苹果(EPS+12.3%)、谷歌(EPS+22.8%)、亚马逊(EPS+35.2%) — 现金流充裕，业务多元化</p>
                      <p><strong>价值股：</strong>伯克希尔(PE 10.5x)、摩根大通(PE 12.8x) — 估值合理，高ROE，防御性强</p>
                    </div>
                  </Card>
                </div>
              )}

              {/* 投资策略 */}
              {sp500Tab === 'strategy' && (
                <div>
                  <Card title="投资策略建议" style={{ marginBottom: 16 }}>
                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f', height: '100%' }}>
                          <h4 style={{ color: '#52c41a', marginBottom: 8 }}>短期（3个月）</h4>
                          <p style={{ fontSize: 13 }}>{sp500Data.recommendation.strategy.shortTerm}</p>
                        </div>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div style={{ padding: 16, background: '#e6f4ff', borderRadius: 8, border: '1px solid #91caff', height: '100%' }}>
                          <h4 style={{ color: '#1677ff', marginBottom: 8 }}>中期（6个月）</h4>
                          <p style={{ fontSize: 13 }}>{sp500Data.recommendation.strategy.mediumTerm}</p>
                        </div>
                      </Col>
                      <Col xs={24} sm={8}>
                        <div style={{ padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591', height: '100%' }}>
                          <h4 style={{ color: '#fa8c16', marginBottom: 8 }}>长期（1年）</h4>
                          <p style={{ fontSize: 13 }}>{sp500Data.recommendation.strategy.longTerm}</p>
                        </div>
                      </Col>
                    </Row>
                  </Card>

                  <Card title="看多因素" style={{ marginBottom: 16 }}>
                    <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
                      {sp500Data.recommendation.bullFactors.map((f, i) => (
                        <li key={i} style={{ color: '#52c41a' }}>{f}</li>
                      ))}
                    </ul>
                  </Card>

                  <Card title="风险因素" style={{ marginBottom: 16 }}>
                    <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
                      {sp500Data.recommendation.bearFactors.map((f, i) => (
                        <li key={i} style={{ color: '#ff4d4f' }}>{f}</li>
                      ))}
                    </ul>
                  </Card>

                  <Card title="分批建仓方案" style={{ marginBottom: 16 }}>
                    <div style={{ position: 'relative', paddingLeft: 30 }}>
                      <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: '#e8e8e8' }}></div>
                      {sp500Data.recommendation.batchPlan.map((plan, idx) => (
                        <div key={idx} style={{ marginBottom: 24, position: 'relative' }}>
                          <div style={{
                            position: 'absolute', left: -22, top: 4, width: 12, height: 12,
                            borderRadius: '50%', background: '#1677ff', border: '2px solid white',
                            boxShadow: '0 0 0 2px #1677ff',
                          }}></div>
                          <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e8e8e8' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <h4>第 {plan.batch} 批</h4>
                              <span className="badge badge-success">{plan.pct}%</span>
                            </div>
                            <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}><strong>时间：</strong>{plan.time}</div>
                            <div style={{ fontSize: 13, marginBottom: 4 }}><strong>操作：</strong>{plan.action}</div>
                            <div style={{ fontSize: 13, color: '#666' }}><strong>理由：</strong>{plan.reason}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'all',
      label: `全部QDII (${funds.length})`,
      children: <Table columns={nasdaqColumns} dataSource={funds} rowKey="code" pagination={{ pageSize: 20 }} size="small" scroll={{ x: 1000 }} />,
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
        <GlobalOutlined style={{ marginRight: 8 }} />QDII基金专栏
      </h1>

      <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', marginBottom: 16 }}>
        <h3 style={{ color: 'white', marginBottom: 12 }}>什么是QDII基金？</h3>
        <p style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.8 }}>
          QDII基金是指经批准从事境外证券市场投资的基金。简单来说，就是用人民币买海外市场的基金。
        </p>
        <Row gutter={16} style={{ marginTop: 16 }}>
          {[
            { title: '分散风险', desc: '投资海外市场，降低单一市场风险' },
            { title: '全球配置', desc: '分享全球科技成长红利' },
            { title: '人民币购买', desc: '无需换汇，直接人民币申购' },
          ].map((item) => (
            <Col xs={24} sm={8} key={item.title}>
              <Card size="small" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <strong style={{ color: 'white' }}>{item.title}</strong>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>{item.desc}</p>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card>
        {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> : <Tabs items={tabItems} onChange={(key) => { if (key === 'sp500') loadSP500(); }} />}
      </Card>

      <Card title="QDII额度说明" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fff2f0', border: '1px solid #ffccc7' }}>
              <h4 style={{ color: '#ff4d4f', marginBottom: 8 }}>暂停申购</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>QDII额度紧张，基金公司暂停申购，无法买入</p>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}>
              <h4 style={{ color: '#faad14', marginBottom: 8 }}>限大额</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>每日限购10-10000元不等，国泰标普500限额最宽松(1万元/日)</p>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <h4 style={{ color: '#52c41a', marginBottom: 8 }}>开放申购</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>正常申购，无限额限制</p>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
