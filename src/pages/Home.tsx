import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Table, Tag, Progress, Statistic, Spin, Space, Badge, Modal, message } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  FundOutlined,
  SafetyOutlined,
  CalculatorOutlined,
  LineChartOutlined,
  BarChartOutlined,
  StockOutlined,
  BankOutlined,
  PieChartOutlined,
  TrophyOutlined,
  AccountBookOutlined,
  RightOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi, portfolioApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface MarketIndex {
  name: string;
  code: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  pe: number | null;
  pb: number | null;
  pePercentile: number | null;
  valuation: string;
  suggestion: string;
}

interface SectorData {
  name: string;
  change: number;
  volume: string;
  leadingStock: string;
}

// API 行业名 → 行业分析页 INDUSTRIES key 的映射
const INDUSTRY_NAME_MAP: Record<string, string> = {
  '人工智能/AI': '人工智能',
  '半导体/芯片': '半导体/芯片',
  '纳斯达克100': '',
};

export default function Home() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [capitalFlow, setCapitalFlow] = useState<any>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAllSectors, setShowAllSectors] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const loadData = async () => {
    try {
      const promises: Promise<any>[] = [
        fundApi.getMarketIndices(),
        fundApi.getSectors().catch(() => []),
        fundApi.getIndustryRecommendations(),
        fundApi.getCapitalFlow().catch(() => null),
      ];
      if (user) {
        promises.push(portfolioApi.getSummary().catch(() => null));
      }
      const results = await Promise.all(promises);
      setIndices(results[0]);
      setSectors(results[1]);
      setRecommendations(results[2]);
      setCapitalFlow(results[3]);
      if (user && results[4]) {
        setPortfolioSummary(results[4]);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载市场数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载市场数据中..." />
      </div>
    );
  }

  // 使用API返回的真实数据
  const marketPrices = indices.slice(0, 4).map(i => i.price ?? null);
  const marketChanges = indices.slice(0, 4).map(i => i.changePercent ?? null);

  const trophyColors = ['#f5a623', '#b0b0b0', '#cd7f32'];

  const TrophyIcon = ({ index }: { index: number }) => (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 }}>
      <TrophyOutlined style={{
        fontSize: 24,
        color: trophyColors[index],
        filter: `drop-shadow(0 1px 3px ${trophyColors[index]}88)`,
      }} />
      <span style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 12, fontWeight: 900,
        color: '#3a2a00',
        textShadow: `0 0 4px rgba(255,255,255,0.8)`,
        lineHeight: 1,
      }}>
        {index + 1}
      </span>
    </span>
  );

  const sectorColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        index < 3 ? (
          <TrophyIcon index={index} />
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500 }}>
            {index + 1}
          </span>
        )
      ),
    },
    { title: '板块', dataIndex: 'name', key: 'name', render: (text: string, _: any, index: number) => <strong style={index < 3 ? { color: trophyColors[index] } : {}}>{text}</strong> },
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
    { title: '成交额', dataIndex: 'volume', key: 'volume', align: 'right' as const, defaultSortOrder: 'descend' as const, sorter: (a: SectorData, b: SectorData) => parseFloat(a.volume) - parseFloat(b.volume) },
    { title: '领涨股', dataIndex: 'leadingStock', key: 'leadingStock', align: 'right' as const, render: (text: string) => <span style={{ color: '#1677ff' }}>{text}</span> },
  ];

  const sortedSectors = [...sectors].sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));

  const quickEntries = [
    { to: '/funds', icon: <FundOutlined />, label: '基金列表', desc: '全市场基金筛选与对比', color: '#667eea' },
    { to: '/industry', icon: <BarChartOutlined />, label: '行业分析', desc: '行业深度研究与市场估值', color: '#f093fb' },
    { to: '/hs300', icon: <StockOutlined />, label: '沪深300', desc: '核心宽基指数深度分析', color: '#fbc2eb' },
    { to: '/qdii', icon: <GlobalOutlined />, label: '标普500/QDII', desc: '美股核心指数深度分析', color: '#1890ff' },
    { to: '/portfolio', icon: <PieChartOutlined />, label: '我的持仓', desc: '投资组合与盈亏管理', color: '#36cfc9' },
    { to: '/dca-calculator', icon: <CalculatorOutlined />, label: '定投计算器', desc: '智能定投收益测算', color: '#fa709a' },
    { to: '/risk-assessment', icon: <SafetyOutlined />, label: '风险评估', desc: '了解你的风险偏好', color: '#43e97b' },
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
      title: { show: true, offsetCenter: [0, '70%'], fontSize: 14, color: 'var(--text-primary)' },
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
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', marginBottom: 20, border: 'none', borderRadius: 16, overflow: 'hidden', position: 'relative' }}
        styles={{ body: { padding: 28 } }}
      >
        <div style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, background: 'radial-gradient(circle, rgba(22, 119, 255, 0.15) 0%, transparent 70%)', borderRadius: '50%', transform: 'translate(30%, -30%)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
          <div>
            <h2 style={{ color: 'white', margin: 0, fontSize: 22, fontWeight: 700 }}>市场概览</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: '4px 0 0', fontSize: 13 }}>实时追踪主要指数行情</p>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>数据每15分钟更新</span>
        </div>
        <Row gutter={[16, 16]}>
          {indices.slice(0, 4).map((index, i) => (
            <Col xs={12} sm={6} key={index.code}>
              <Card size="small" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, backdropFilter: 'blur(10px)' }} styles={{ body: { padding: 16 } }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500 }}>{index.name}</span>}
                  value={marketPrices[i] ?? '--'}
                  precision={marketPrices[i] != null ? 2 : undefined}
                  valueStyle={{ color: '#fff', fontSize: 24, fontWeight: 700 }}
                  suffix={
                    marketChanges[i] != null ? (
                      <span style={{ fontSize: 14, color: marketChanges[i]! > 0 ? '#ff4d4f' : '#52c41a' }}>
                        {marketChanges[i]! > 0 ? '+' : ''}{marketChanges[i]}%
                      </span>
                    ) : undefined
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 持仓概览（登录用户） */}
      {user && portfolioSummary && portfolioSummary.holdings?.length > 0 && (
        <Card
          style={{ marginBottom: 20, borderRadius: 12, border: '1px solid var(--primary-border)', background: 'var(--primary-bg)' }}
          title={
            <Space>
              <AccountBookOutlined style={{ color: '#1677ff' }} />
              <span style={{ fontWeight: 600 }}>我的持仓</span>
            </Space>
          }
          extra={<Link to="/portfolio" style={{ color: 'var(--primary)', fontSize: 13 }}>查看详情 <RightOutlined /></Link>}
        >
          <Row gutter={[16, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>总投入</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>¥{(portfolioSummary.totalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>当前市值</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>¥{(portfolioSummary.totalValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>总盈亏</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: (portfolioSummary.totalPnl || 0) >= 0 ? '#cf1322' : '#3f8600' }}>
                {(portfolioSummary.totalPnl || 0) >= 0 ? '+' : ''}¥{(portfolioSummary.totalPnl || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>总收益率</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: (portfolioSummary.totalReturn || 0) >= 0 ? '#cf1322' : '#3f8600' }}>
                {(portfolioSummary.totalReturn || 0) >= 0 ? '+' : ''}{(portfolioSummary.totalReturn || 0).toFixed(2)}%
              </div>
            </Col>
          </Row>
          <Row gutter={[8, 8]}>
            {portfolioSummary.holdings.slice(0, 4).map((h: any) => (
              <Col xs={12} sm={6} key={h.fund_code}>
                <Link to={`/funds/${h.fund_code}`} style={{ textDecoration: 'none' }}>
                  <Card size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0' }} hoverable>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1677ff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.fund_name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#8c8c8c' }}>¥{h.market_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <Tag color={h.pnl_percent >= 0 ? 'red' : 'green'} style={{ margin: 0, fontSize: 11 }}>
                        {h.pnl_percent >= 0 ? '+' : ''}{h.pnl_percent?.toFixed(2)}%
                      </Tag>
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 板块轮动 + 资金流向 */}
      <Row gutter={20} style={{ marginBottom: 20 }}>
        {/* 左侧：板块轮动 TOP13 */}
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ fontWeight: 600 }}>今日板块轮动</span>}
            extra={<span style={{ fontSize: 12, color: '#8c8c8c' }}>TOP13</span>}
            style={{ borderRadius: 12 }}
            styles={{ body: { padding: 0 } }}
          >
            <Table
              columns={sectorColumns}
              dataSource={sortedSectors.slice(0, 13)}
              rowKey="name"
              pagination={false}
              size="small"
            />
            {sectors.length > 13 && (
              <div style={{ textAlign: 'center', padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
                <a onClick={() => setShowAllSectors(true)} style={{ color: '#1677ff', cursor: 'pointer', fontSize: 13 }}>
                  查看全部 {sectors.length} 个板块 →
                </a>
              </div>
            )}
          </Card>
          <Modal
            title="全部板块轮动"
            open={showAllSectors}
            onCancel={() => setShowAllSectors(false)}
            footer={null}
            width={800}
          >
            <Table
              columns={[
                { title: '排名', key: 'rank', width: 60, render: (_: any, __: any, index: number) => index < 3 ? <TrophyIcon index={index} /> : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 11 }}>{index + 1}</span> },
                { title: '板块', dataIndex: 'name', key: 'name', render: (text: string, _: any, index: number) => <strong style={index < 3 ? { color: trophyColors[index] } : {}}>{text}</strong> },
                { title: '涨跌幅', dataIndex: 'change', key: 'change', align: 'right' as const, sorter: (a: SectorData, b: SectorData) => a.change - b.change, render: (val: number) => <span style={{ color: getReturnColor(val), fontWeight: 600 }}>{formatReturn(val)}</span> },
                { title: '成交额', dataIndex: 'volume', key: 'volume', align: 'right' as const },
                { title: '领涨股', dataIndex: 'leadingStock', key: 'leadingStock', align: 'right' as const, render: (text: string) => <span style={{ color: '#1677ff' }}>{text}</span> },
              ]}
              dataSource={sortedSectors}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Modal>
        </Col>

        {/* 右侧：北向资金 + 主力资金 */}
        <Col xs={24} lg={14}>
          <Row gutter={[0, 20]}>
            {/* 北向资金 */}
            {capitalFlow && (
              <Col span={24}>
                <Card
                  title={<span style={{ fontWeight: 600 }}><BankOutlined style={{ marginRight: 8, color: '#1677ff' }} />北向资金（沪深港通）</span>}
                  size="small"
                  style={{ borderRadius: 12 }}
                >
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Statistic
                        title="今日净流入"
                        value={capitalFlow.northbound?.total || 0}
                        precision={2}
                        suffix="亿"
                        valueStyle={{ color: parseFloat(capitalFlow.northbound?.total || 0) >= 0 ? '#cf1322' : '#3f8600' }}
                        prefix={parseFloat(capitalFlow.northbound?.total || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="沪股通"
                        value={capitalFlow.northbound?.sh || 0}
                        precision={2}
                        suffix="亿"
                        valueStyle={{ color: parseFloat(capitalFlow.northbound?.sh || 0) >= 0 ? '#cf1322' : '#3f8600', fontSize: 16 }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="深股通"
                        value={capitalFlow.northbound?.sz || 0}
                        precision={2}
                        suffix="亿"
                        valueStyle={{ color: parseFloat(capitalFlow.northbound?.sz || 0) >= 0 ? '#cf1322' : '#3f8600', fontSize: 16 }}
                      />
                    </Col>
                  </Row>
                  {capitalFlow.northbound?.trend?.length > 0 && (
                    <ReactECharts
                      theme={getEchartsTheme(isDark)}
                      option={{
                        tooltip: { trigger: 'axis', formatter: (params: any) => `${params[0]?.axisValue}<br/>${params.map((p: any) => `${p.seriesName}: ${p.value}亿`).join('<br/>')}` },
                        legend: { data: ['沪股通', '深股通', '合计'], bottom: 0 },
                        grid: { top: 10, bottom: 40, left: 50, right: 10 },
                        xAxis: { type: 'category', data: capitalFlow.northbound.trend.map((t: any) => t.time), axisLabel: { fontSize: 10, interval: Math.floor(capitalFlow.northbound.trend.length / 6) } },
                        yAxis: { type: 'value', name: '亿元', axisLabel: { fontSize: 10 } },
                        series: [
                          { name: '沪股通', type: 'line', data: capitalFlow.northbound.trend.map((t: any) => t.sh), lineStyle: { width: 1.5 }, itemStyle: { color: '#1677ff' }, showSymbol: false },
                          { name: '深股通', type: 'line', data: capitalFlow.northbound.trend.map((t: any) => t.sz), lineStyle: { width: 1.5 }, itemStyle: { color: '#52c41a' }, showSymbol: false },
                          { name: '合计', type: 'line', data: capitalFlow.northbound.trend.map((t: any) => t.total), lineStyle: { width: 2 }, itemStyle: { color: '#ff4d4f' }, showSymbol: false },
                        ],
                      }}
                      style={{ height: 200 }}
                      opts={{ renderer: 'svg' }}
                    />
                  )}
                </Card>
              </Col>
            )}

            {/* 主力资金行业流向 */}
            {capitalFlow && (
              <Col span={24}>
                <Card
                  title={<span style={{ fontWeight: 600 }}><BarChartOutlined style={{ marginRight: 8, color: '#faad14' }} />主力资金行业净流入</span>}
                  size="small"
                  style={{ borderRadius: 12 }}
                >
                  {capitalFlow.mainFlow?.length > 0 ? (
                    <>
                      <ReactECharts
                        theme={getEchartsTheme(isDark)}
                        option={{
                          tooltip: {
                            trigger: 'axis',
                            formatter: (params: any) => {
                              const name = params[0]?.name || '';
                              const lines = params.map((p: any) => `${p.seriesName}: ${p.value}亿`);
                              return `${name}<br/>${lines.join('<br/>')}`;
                            },
                          },
                          legend: { data: ['主力流入', '主力流出'], bottom: 0, textStyle: { fontSize: 11 } },
                          grid: { top: 10, bottom: 30, left: 80, right: 20 },
                          xAxis: { type: 'value', name: '亿元', axisLabel: { fontSize: 10 } },
                          yAxis: {
                            type: 'category',
                            data: capitalFlow.mainFlow.slice(0, 8).map((f: any) => f.name).reverse(),
                            axisLabel: { fontSize: 11 },
                          },
                          series: [
                            {
                              name: '主力流入',
                              type: 'bar',
                              stack: 'flow',
                              data: capitalFlow.mainFlow.slice(0, 8).map((f: any) => {
                                const net = parseFloat(f.mainNetInflow);
                                return { value: net >= 0 ? net : 0, itemStyle: { color: '#cf1322' } };
                              }).reverse(),
                              barWidth: 16,
                            },
                            {
                              name: '主力流出',
                              type: 'bar',
                              stack: 'flow',
                              data: capitalFlow.mainFlow.slice(0, 8).map((f: any) => {
                                const net = parseFloat(f.mainNetInflow);
                                return { value: net < 0 ? Math.abs(net) : 0, itemStyle: { color: '#3f8600' } };
                              }).reverse(),
                              barWidth: 16,
                            },
                          ],
                        }}
                        style={{ height: 200 }}
                        opts={{ renderer: 'svg' }}
                      />
                      <div style={{ textAlign: 'center', fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                        红色=净流入 | 绿色=净流出（基于涨跌幅估算）
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: '#8c8c8c' }}>暂无主力资金数据</div>
                  )}
                </Card>
              </Col>
            )}
          </Row>
        </Col>
      </Row>

      {/* 快捷入口 */}
      <Card title={<span style={{ fontWeight: 600 }}>快捷入口</span>} style={{ marginBottom: 20, borderRadius: 12 }}>
        <Row gutter={[16, 16]}>
          {quickEntries.map((entry) => (
            <Col xs={12} sm={8} md={6} key={entry.to}>
              <Link to={entry.to} style={{ textDecoration: 'none' }}>
                <Card
                  hoverable
                  style={{ background: `linear-gradient(135deg, ${entry.color} 0%, ${entry.color}99 100%)`, border: 'none', textAlign: 'center', borderRadius: 12, overflow: 'hidden' }}
                  styles={{ body: { padding: 24 } }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12, color: 'white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>{entry.icon}</div>
                  <div style={{ fontWeight: 700, color: 'white', fontSize: 16, marginBottom: 4 }}>{entry.label}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{entry.desc}</div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 行业推荐 */}
      <Card
        title={<span style={{ fontWeight: 600 }}>热门行业推荐</span>}
        extra={<Link to="/funds" style={{ color: '#1677ff', fontSize: 13 }}>查看更多 →</Link>}
        style={{ marginBottom: 20, borderRadius: 12 }}
      >
        <Row gutter={[16, 16]}>
          {recommendations.slice(0, 6).map((rec) => {
            const sectorKey = INDUSTRY_NAME_MAP[rec.industry] ?? rec.industry;
            return (
            <Col xs={24} sm={12} key={rec.industry}>
              <Card
                size="small"
                style={{ marginBottom: 0, borderRadius: 10, border: '1px solid #f0f0f0', cursor: 'pointer' }}
                hoverable
                onClick={() => sectorKey && navigate(`/industry?sector=${encodeURIComponent(sectorKey)}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 16, color: '#1f1f1f' }}>{rec.industry}</strong>
                  <Tag color={rec.buySuggestion === '优先配置' ? 'red' : rec.buySuggestion === '限大额配置' ? 'orange' : 'green'} style={{ borderRadius: 6, fontWeight: 500 }}>
                    {rec.buySuggestion}
                  </Tag>
                </div>
                <div style={{ fontSize: 13, color: '#595959', marginBottom: 12, lineHeight: 1.6 }}>{rec.logic}</div>
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
          )})}
        </Row>
      </Card>

      {/* 估值温度计 */}
      <Card title={<span style={{ fontWeight: 600 }}>市场估值温度计</span>} style={{ marginBottom: 20, borderRadius: 12 }}>
        <Row gutter={[16, 16]}>
          {indices.map((index) => (
            <Col xs={24} sm={12} key={index.code}>
              <Card size="small" style={{ marginBottom: 0, borderRadius: 10, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong style={{ fontSize: 15, color: '#1f1f1f' }}>{index.name}</strong>
                  <Tag color={index.valuation.includes('低') ? 'green' : index.valuation.includes('高') ? 'red' : 'blue'} style={{ borderRadius: 6, fontWeight: 500 }}>
                    {index.valuation}
                  </Tag>
                </div>
                <ReactECharts
                  theme={getEchartsTheme(isDark)}
                  option={getGaugeOption(index.name, index.pePercentile ?? 50, index.valuation)}
                  style={{ height: 180 }}
                  opts={{ renderer: 'svg' }}
                />
                <div style={{ textAlign: 'center', fontSize: 12, color: '#595959', marginTop: 4 }}>
                  PE分位: <span style={{ fontWeight: 600, color: '#1677ff' }}>{index.pePercentile}%</span> | {index.suggestion}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 今日操作建议 */}
      <Card title={<span style={{ fontWeight: 600 }}>今日操作建议</span>} style={{ marginBottom: 20, borderRadius: 12 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)', border: '1px solid #b7eb8f', borderRadius: 10 }}>
              <h4 style={{ color: '#52c41a', marginBottom: 8, fontSize: 15 }}>适合买入</h4>
              <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: 16 }}>
                <li>医药指数基金（估值极低）</li>
                <li>新能源基金（底部反弹）</li>
                <li>沪深300指数（定投配置）</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)', border: '1px solid #ffe58f', borderRadius: 10 }}>
              <h4 style={{ color: '#faad14', marginBottom: 8, fontSize: 15 }}>观望等待</h4>
              <ul style={{ fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: 16 }}>
                <li>AI/人工智能（估值偏高）</li>
                <li>半导体（等待回调）</li>
                <li>科创50（估值偏高）</li>
              </ul>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)', border: '1px solid #ffa39e', borderRadius: 10 }}>
              <h4 style={{ color: '#ff4d4f', marginBottom: 8, fontSize: 15 }}>谨慎持有</h4>
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
