import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, Table, Tag, Progress, Statistic, Spin, Space, Badge } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  FundOutlined,
  GlobalOutlined,
  SwapOutlined,
  SafetyOutlined,
  CalculatorOutlined,
  LineChartOutlined,
  BarChartOutlined,
  StockOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';

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
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const marketPrices = [3856.42, 5823.15, 2156.78, 1023.45];
  const marketChanges = [1.25, -0.68, 2.15, -1.32];

  const sectorColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <Badge count={index + 1} style={{ backgroundColor: index < 3 ? '#ff4d4f' : '#d9d9d9' }} overflowCount={99} />
      ),
    },
    { title: '板块', dataIndex: 'name', key: 'name', render: (text: string) => <strong>{text}</strong> },
    {
      title: '涨跌幅',
      dataIndex: 'change',
      key: 'change',
      align: 'right' as const,
      sorter: (a: SectorData, b: SectorData) => a.change - b.change,
      render: (val: number) => (
        <span style={{ color: getReturnColor(val), fontWeight: 600 }}>
          {formatReturn(val)}
        </span>
      ),
    },
    { title: '成交额', dataIndex: 'volume', key: 'volume', align: 'right' as const },
    { title: '领涨股', dataIndex: 'leadingStock', key: 'leadingStock', align: 'right' as const, render: (text: string) => <span style={{ color: '#1677ff' }}>{text}</span> },
  ];

  const sortedSectors = [...sectorRotation].sort((a, b) => b.change - a.change);

  const quickEntries = [
    { to: '/funds', icon: <FundOutlined />, label: '基金列表', desc: '查看全部基金', color: '#667eea' },
    { to: '/industry', icon: <BarChartOutlined />, label: '行业分析', desc: '行业深度研究', color: '#f093fb' },
    { to: '/qdii', icon: <GlobalOutlined />, label: 'QDII基金', desc: '投资海外市场', color: '#f5576c' },
    { to: '/compare', icon: <SwapOutlined />, label: '基金对比', desc: '对比选择最优', color: '#4facfe' },
    { to: '/risk-assessment', icon: <SafetyOutlined />, label: '风险评估', desc: '了解风险偏好', color: '#43e97b' },
    { to: '/dca-calculator', icon: <CalculatorOutlined />, label: '定投计算器', desc: '智能定投规划', color: '#fa709a' },
    { to: '/market', icon: <LineChartOutlined />, label: '市场分析', desc: '指数估值分析', color: '#a18cd1' },
    { to: '/hs300', icon: <StockOutlined />, label: '沪深300', desc: '核心宽基指数', color: '#fbc2eb' },
  ];

  const getGaugeOption = (name: string, percentile: number, valuation: string) => ({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 10,
      itemStyle: {
        color: percentile < 40 ? '#52c41a' : percentile < 60 ? '#faad14' : '#ff4d4f',
      },
      progress: { show: true, width: 16 },
      pointer: { show: false },
      axisLine: {
        lineStyle: {
          width: 16,
          color: [[0.4, '#52c41a'], [0.6, '#faad14'], [1, '#ff4d4f']],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: true, offsetCenter: [0, '70%'], fontSize: 14, color: '#333' },
      detail: {
        valueAnimation: true,
        fontSize: 28,
        fontWeight: 'bold',
        offsetCenter: [0, '40%'],
        formatter: '{value}%',
        color: percentile < 40 ? '#52c41a' : percentile < 60 ? '#faad14' : '#ff4d4f',
      },
      data: [{ value: percentile, name }],
    }],
  });

  return (
    <div>
      {/* 市场概览 */}
      <Card
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', marginBottom: 16, border: 'none' }}
        styles={{ body: { padding: 24 } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: 20 }}>市场概览</h2>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>数据每15分钟更新</span>
        </div>
        <Row gutter={16}>
          {indices.slice(0, 4).map((index, i) => (
            <Col xs={12} sm={6} key={index.code}>
              <Card size="small" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{index.name}</span>}
                  value={marketPrices[i]}
                  precision={2}
                  valueStyle={{ color: '#fff', fontSize: 22, fontWeight: 600 }}
                  suffix={
                    <span style={{ fontSize: 14, color: marketChanges[i] > 0 ? '#ff4d4f' : '#52c41a' }}>
                      {marketChanges[i] > 0 ? '+' : ''}{marketChanges[i]}%
                    </span>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 板块轮动 */}
      <Card title="今日板块轮动" extra={<span style={{ fontSize: 12, color: '#666' }}>按涨跌幅排序</span>} style={{ marginBottom: 16 }}>
        <Table
          columns={sectorColumns}
          dataSource={sortedSectors}
          rowKey="name"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 资金流向 */}
      <Card title="大盘资金流向" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          {fundFlows.map((flow) => (
            <Col xs={24} sm={8} key={flow.name}>
              <Card size="small" style={{ background: flow.net > 0 ? '#fff1f0' : '#f6ffed', border: `1px solid ${flow.net > 0 ? '#ffa39e' : '#b7eb8f'}` }}>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>{flow.name}</div>
                <Statistic
                  value={flow.net}
                  precision={1}
                  prefix={flow.net > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  suffix="亿"
                  valueStyle={{ color: flow.net > 0 ? '#ff4d4f' : '#52c41a', fontSize: 28, fontWeight: 700 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: '#ff4d4f' }}>流入 {flow.inflow}亿</span>
                  <span style={{ color: '#52c41a' }}>流出 {flow.outflow}亿</span>
                </div>
                <Progress
                  percent={Math.round((flow.inflow / (flow.inflow + flow.outflow)) * 100)}
                  showInfo={false}
                  strokeColor={{ from: '#ff4d4f', to: '#ff7875' }}
                  size="small"
                  style={{ marginTop: 8 }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12, fontSize: 14, color: '#333' }}>行业资金净流入TOP5</h4>
          <Row gutter={8}>
            {sortedSectors.slice(0, 5).map((sector) => (
              <Col xs={12} sm={8} md={4} key={sector.name} style={{ marginBottom: 8 }}>
                <Card size="small" style={{ textAlign: 'center', background: '#f5f5f5' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{sector.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ff4d4f' }}>
                    +{(Math.random() * 50 + 10).toFixed(1)}亿
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Card>

      {/* 快捷入口 */}
      <Card title="快捷入口" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {quickEntries.map((entry) => (
            <Col xs={12} sm={8} md={6} key={entry.to}>
              <Link to={entry.to} style={{ textDecoration: 'none' }}>
                <Card
                  hoverable
                  style={{ background: `linear-gradient(135deg, ${entry.color} 0%, ${entry.color}99 100%)`, border: 'none', textAlign: 'center' }}
                  styles={{ body: { padding: 20 } }}
                >
                  <div style={{ fontSize: 28, marginBottom: 8, color: 'white' }}>{entry.icon}</div>
                  <div style={{ fontWeight: 600, color: 'white', fontSize: 15 }}>{entry.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{entry.desc}</div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 行业推荐 */}
      <Card
        title="热门行业推荐"
        extra={<Link to="/funds" style={{ color: '#1677ff', fontSize: 13 }}>查看更多 →</Link>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          {recommendations.slice(0, 4).map((rec) => (
            <Col xs={24} sm={12} key={rec.industry}>
              <Card size="small" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 15 }}>{rec.industry}</strong>
                  <Tag color={rec.buySuggestion === '优先配置' ? 'red' : rec.buySuggestion === '限大额配置' ? 'orange' : 'green'}>
                    {rec.buySuggestion}
                  </Tag>
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>{rec.logic}</div>
                <Space size={8} wrap>
                  {rec.funds?.slice(0, 2).map((fund: any) => (
                    <Link
                      key={fund.code}
                      to={`/funds/${fund.code}`}
                      style={{ color: '#1677ff', fontSize: 12 }}
                    >
                      {fund.name?.substring(0, 10)}...
                    </Link>
                  ))}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 估值温度计 */}
      <Card title="市场估值温度计" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          {indices.map((index) => (
            <Col xs={24} sm={12} key={index.code}>
              <Card size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong>{index.name}</strong>
                  <Tag color={index.valuation.includes('低') ? 'green' : index.valuation.includes('高') ? 'red' : 'blue'}>
                    {index.valuation}
                  </Tag>
                </div>
                <ReactECharts
                  option={getGaugeOption(index.name, index.pePercentile, index.valuation)}
                  style={{ height: 200 }}
                  opts={{ renderer: 'svg' }}
                />
                <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>
                  PE分位: {index.pePercentile}% | {index.suggestion}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 今日操作建议 */}
      <Card title="今日操作建议">
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <h4 style={{ color: '#52c41a', marginBottom: 8, fontSize: 14 }}>适合买入</h4>
              <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: 16 }}>
                <li>医药指数基金（估值极低）</li>
                <li>新能源基金（底部反弹）</li>
                <li>沪深300指数（定投配置）</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}>
              <h4 style={{ color: '#faad14', marginBottom: 8, fontSize: 14 }}>观望等待</h4>
              <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: 16 }}>
                <li>AI/人工智能（估值偏高）</li>
                <li>半导体（等待回调）</li>
                <li>科创50（估值偏高）</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
              <h4 style={{ color: '#ff4d4f', marginBottom: 8, fontSize: 14 }}>谨慎持有</h4>
              <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: 16 }}>
                <li>地产基金（政策风险）</li>
                <li>白酒（估值偏高）</li>
                <li>高位QDII（限额紧张）</li>
              </ul>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
