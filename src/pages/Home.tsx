import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Table, Tag, Statistic, Spin, Space, Modal, message, Tooltip } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  FundOutlined,
  SafetyOutlined,
  CalculatorOutlined,
  BarChartOutlined,
  StockOutlined,
  BankOutlined,
  PieChartOutlined,
  TrophyOutlined,
  AccountBookOutlined,
  RightOutlined,
  GlobalOutlined,
  ReloadOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  InfoCircleOutlined,
  DashboardOutlined,
  BulbOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi, portfolioApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';
import TiltCard from '../components/TiltCard';
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

const INDUSTRY_NAME_MAP: Record<string, string> = {
  '人工智能/AI': '人工智能',
  '半导体/芯片': '半导体/芯片',
  '纳斯达克100': '',
};

/* ─── 动画数字组件 ─── */
function AnimatedNumber({ value, precision = 2, prefix = '', suffix = '', style = {} }: {
  value: number | null | undefined;
  precision?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null || !ref.current) return;
    const el = ref.current;
    el.classList.remove('number-animate');
    void el.offsetWidth; // force reflow
    el.classList.add('number-animate');
    prevRef.current = value;
  }, [value]);

  if (value == null) return <span style={style}>--</span>;
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  return <span ref={ref} style={style}>{prefix}{formatted}{suffix}</span>;
}

/* ─── KPI 卡片 ─── */
function KPICard({ label, value, precision, prefix, suffix, color, icon, onClick, trend }: {
  label: string;
  value: number | null | undefined;
  precision?: number;
  prefix?: string;
  suffix?: string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  trend?: 'up' | 'down' | 'flat';
}) {
  const displayColor = color || (value != null ? getReturnColor(value) : 'rgba(255,255,255,0.85)');

  return (
    <div className="kpi-glass" onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon && <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }}>{icon}</span>}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: displayColor, fontFamily: 'var(--font-mono)' }}>
        <AnimatedNumber value={value} precision={precision ?? 2} prefix={prefix} suffix={suffix} />
      </div>
      {trend && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {trend === 'up' ? <RiseOutlined style={{ color: '#ff4d4f' }} /> : trend === 'down' ? <FallOutlined style={{ color: '#52c41a' }} /> : null}
        </div>
      )}
    </div>
  );
}

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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
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
      setLastUpdate(new Date());
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载市场数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 400, gap: 16 }}>
        <Spin size="large" />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>加载市场数据中...</span>
      </div>
    );
  }

  // Derived data
  const marketPrices = indices.slice(0, 4).map(i => i.price ?? null);
  const marketChanges = indices.slice(0, 4).map(i => i.changePercent ?? null);
  const totalPnl = portfolioSummary?.totalPnl || 0;
  const totalReturn = portfolioSummary?.totalReturn || 0;
  const totalValue = portfolioSummary?.totalValue || 0;
  const totalCost = portfolioSummary?.totalCost || 0;
  const holdings = portfolioSummary?.holdings || [];

  // Risk index: based on holdings count and return volatility
  const riskIndex = holdings.length > 0
    ? Math.min(100, Math.round(30 + holdings.length * 5 + Math.abs(totalReturn) * 2))
    : 0;

  // Today's P&L estimate (approximate from total return change)
  const todayPnl = totalPnl * 0.003; // rough estimate

  // Monthly return estimate
  const monthlyReturn = totalReturn * 0.15; // rough estimate

  // Upcoming DCA plans count (placeholder)
  const alertCount = holdings.filter((h: any) => h.pnl_percent < -10).length;

  const trophyColors = ['#f5a623', '#b0b0b0', '#cd7f32'];

  const TrophyIcon = ({ index }: { index: number }) => (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26 }}>
      <TrophyOutlined style={{ fontSize: 24, color: trophyColors[index], filter: `drop-shadow(0 1px 3px ${trophyColors[index]}88)` }} />
      <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 12, fontWeight: 900, color: isDark ? '#ffd700' : '#3a2a00', textShadow: '0 0 4px rgba(255,255,255,0.8)', lineHeight: 1 }}>
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
        index < 3 ? <TrophyIcon index={index} /> : (
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
        <span style={{ color: getReturnColor(val), fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {formatReturn(val)}
        </span>
      ),
    },
    { title: '成交额', dataIndex: 'volume', key: 'volume', align: 'right' as const, defaultSortOrder: 'descend' as const, sorter: (a: SectorData, b: SectorData) => parseFloat(a.volume) - parseFloat(b.volume) },
    { title: '领涨股', dataIndex: 'leadingStock', key: 'leadingStock', align: 'right' as const, render: (text: string) => <span style={{ color: 'var(--primary)' }}>{text}</span> },
  ];

  const sortedSectors = [...sectors].sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));

  const quickEntries = [
    { to: '/funds', icon: <FundOutlined />, label: '基金列表', desc: '全市场基金筛选', color: '#667eea' },
    { to: '/industry', icon: <BarChartOutlined />, label: '行业分析', desc: '行业深度研究', color: '#f093fb' },
    { to: '/qdii', icon: <GlobalOutlined />, label: '标普500/QDII', desc: '美股指数分析', color: '#1890ff' },
    { to: '/portfolio', icon: <PieChartOutlined />, label: '我的持仓', desc: '投资组合管理', color: '#36cfc9' },
  ];

  const getGaugeOption = (name: string, percentile: number, valuation: string) => ({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 10,
      itemStyle: { color: percentile < 40 ? '#52c41a' : percentile < 60 ? '#faad14' : '#ff4d4f' },
      progress: { show: true, width: 14 },
      pointer: { show: false },
      axisLine: { lineStyle: { width: 14, color: [[0.4, '#52c41a'], [0.6, '#faad14'], [1, '#ff4d4f']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: true, offsetCenter: [0, '70%'], fontSize: 13, color: 'var(--text-primary)' },
      detail: {
        valueAnimation: true,
        fontSize: 26,
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
      {/* ═══════════════ 1. 核心指标头部看板 ═══════════════ */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #0a0e1a 0%, #111b2e 40%, #0d1f3c 100%)',
          marginBottom: 20,
          border: 'none',
          borderRadius: 16,
          overflow: 'hidden',
          position: 'relative',
        }}
        styles={{ body: { padding: '24px 28px' } }}
      >
        {/* 装饰光效 */}
        <div style={{ position: 'absolute', top: -80, right: -40, width: 280, height: 280, background: 'radial-gradient(circle, rgba(22, 119, 255, 0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '30%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(82, 196, 26, 0.08) 0%, transparent 70%)', borderRadius: '50%' }} />

        {/* 头部标题行 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DashboardOutlined style={{ fontSize: 22, color: '#4096ff' }} />
            <div>
              <h2 style={{ color: 'var(--color-text-on-dark)', margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>投资总览</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="live-dot" />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                  最后更新 {lastUpdate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
          <Tooltip title="刷新数据">
            <ReloadOutlined
              className={refreshing ? 'spin-icon' : ''}
              onClick={handleRefresh}
              style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'color 0.2s' }}
            />
          </Tooltip>
        </div>

        {/* KPI 指标网格 */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={user ? 4 : 6}>
            <KPICard
              label="上证指数"
              value={marketPrices[0]}
              precision={2}
              icon={<StockOutlined />}
              color="#fff"
              onClick={() => navigate('/funds')}
            />
          </Col>
          <Col xs={12} sm={8} md={user ? 4 : 6}>
            <KPICard
              label="沪深300"
              value={marketPrices[1]}
              precision={2}
              icon={<BarChartOutlined />}
              color="#fff"
              onClick={() => navigate('/funds')}
            />
          </Col>
          <Col xs={12} sm={8} md={user ? 4 : 6}>
            <KPICard
              label="创业板指"
              value={marketPrices[2]}
              precision={2}
              icon={<RiseOutlined />}
              color="#fff"
              onClick={() => navigate('/industry')}
            />
          </Col>
          <Col xs={12} sm={8} md={user ? 4 : 6}>
            <KPICard
              label="科创50"
              value={marketPrices[3]}
              precision={2}
              icon={<ThunderboltOutlined />}
              color="#fff"
              onClick={() => navigate('/industry')}
            />
          </Col>
          {user && (
            <>
              <Col xs={12} sm={8} md={4}>
                <KPICard
                  label="总资产"
                  value={totalValue}
                  precision={0}
                  prefix="¥"
                  icon={<AccountBookOutlined />}
                  color="#4096ff"
                  onClick={() => navigate('/portfolio')}
                />
              </Col>
              <Col xs={12} sm={8} md={4}>
                <KPICard
                  label="总盈亏"
                  value={totalPnl}
                  precision={0}
                  prefix={totalPnl >= 0 ? '+¥' : '-¥'}
                  suffix=""
                  icon={totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  trend={totalPnl >= 0 ? 'up' : 'down'}
                  onClick={() => navigate('/portfolio')}
                />
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* ═══════════════ 2. 资产收益分区（登录用户） ═══════════════ */}
      {user && holdings.length > 0 && (
        <Row gutter={20} style={{ marginBottom: 20 }}>
          {/* 持仓概览 */}
          <Col xs={24} lg={14}>
            <Card
              style={{ borderRadius: 12, border: '1px solid var(--border-color-light)', height: '100%' }}
              title={
                <div className="section-title-bar" style={{ marginBottom: 0 }}>
                  <AccountBookOutlined style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600 }}>持仓概览</span>
                </div>
              }
              extra={<Link to="/portfolio" style={{ color: 'var(--primary)', fontSize: 13 }}>详情 <RightOutlined /></Link>}
            >
              {/* 核心指标 */}
              <Row gutter={[16, 12]} style={{ marginBottom: 20 }}>
                <Col span={6}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>总投入</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    ¥{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>当前市值</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    ¥{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>总收益率</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: getReturnColor(totalReturn), fontFamily: 'var(--font-mono)' }}>
                    {formatReturn(totalReturn)}
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>风险指数</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: riskIndex > 70 ? 'var(--danger)' : riskIndex > 40 ? 'var(--warning)' : 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                      {riskIndex}
                    </div>
                    <div style={{ flex: 1, height: 4, background: 'var(--border-color-light)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${riskIndex}%`, height: '100%', background: riskIndex > 70 ? 'var(--danger)' : riskIndex > 40 ? 'var(--warning)' : 'var(--success)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                </Col>
              </Row>

              {/* 持仓列表 */}
              <Row gutter={[10, 10]}>
                {holdings.slice(0, 6).map((h: any) => (
                  <Col xs={12} sm={8} key={h.fund_code}>
                    <Link to={`/funds/${h.fund_code}`} style={{ textDecoration: 'none' }}>
                      <Card
                        size="small"
                        style={{ borderRadius: 8, border: `1px solid ${isDark ? '#333' : '#f0f0f0'}`, transition: 'all 0.2s' }}
                        hoverable
                      >
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--primary)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.fund_name}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                            ¥{h.market_value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <Tag color={h.pnl_percent >= 0 ? 'red' : 'green'} style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
                            {h.pnl_percent >= 0 ? '+' : ''}{h.pnl_percent?.toFixed(2)}%
                          </Tag>
                        </div>
                      </Card>
                    </Link>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>

          {/* 风险预警 + 快捷操作 */}
          <Col xs={24} lg={10}>
            <Row gutter={[0, 20]}>
              {/* 风险预警 */}
              <Col span={24}>
                <Card
                  style={{ borderRadius: 12, border: `1px solid ${alertCount > 0 ? 'rgba(255,77,79,0.3)' : 'var(--border-color-light)'}` }}
                  title={
                    <div className="section-title-bar" style={{ marginBottom: 0 }}>
                      <WarningOutlined style={{ color: alertCount > 0 ? 'var(--danger)' : 'var(--warning)' }} />
                      <span style={{ fontWeight: 600 }}>风险预警</span>
                      {alertCount > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{alertCount}项</Tag>}
                    </div>
                  }
                >
                  {alertCount > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {holdings.filter((h: any) => h.pnl_percent < -10).map((h: any) => (
                        <div
                          key={h.fund_code}
                          className="alert-pulse"
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 14px', borderRadius: 8,
                            background: isDark ? 'rgba(255,77,79,0.08)' : 'rgba(255,77,79,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,77,79,0.2)' : 'rgba(255,77,79,0.15)'}`,
                            cursor: 'pointer',
                          }}
                          onClick={() => navigate(`/funds/${h.fund_code}`)}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{h.fund_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>亏损超过10%，建议关注</div>
                          </div>
                          <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-mono)' }}>
                            {h.pnl_percent?.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                      <CheckCircleOutlined style={{ fontSize: 32, color: 'var(--success)', marginBottom: 8 }} />
                      <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>持仓状态健康，暂无风险预警</div>
                    </div>
                  )}
                </Card>
              </Col>

              {/* 快捷入口 */}
              <Col span={24}>
                <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                  <Row gutter={[10, 10]}>
                    {quickEntries.map((entry) => (
                      <Col xs={12} key={entry.to}>
                        <Link to={entry.to} style={{ textDecoration: 'none' }}>
                          <TiltCard glowBorder={false} sheen={false}>
                            <div
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 14px', borderRadius: 10,
                                background: `linear-gradient(135deg, ${entry.color}18 0%, ${entry.color}08 100%)`,
                                border: `1px solid ${entry.color}25`,
                                transition: 'all 0.2s', cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = entry.color + '50'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = entry.color + '25'; e.currentTarget.style.transform = 'none'; }}
                            >
                              <span style={{ fontSize: 20, color: entry.color }}>{entry.icon}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{entry.label}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{entry.desc}</div>
                              </div>
                            </div>
                          </TiltCard>
                        </Link>
                      </Col>
                    ))}
                  </Row>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      )}

      {/* ═══════════════ 3. 行情监控区 ═══════════════ */}
      <Row gutter={20} style={{ marginBottom: 20 }}>
        {/* 板块轮动 */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <div className="section-title-bar" style={{ marginBottom: 0 }}>
                <BarChartOutlined style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 600 }}>板块轮动</span>
                <Tag style={{ marginLeft: 8, fontSize: 11 }}>TOP13</Tag>
              </div>
            }
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
              <div style={{ textAlign: 'center', padding: '8px 0', borderTop: `1px solid ${isDark ? '#333' : '#f0f0f0'}` }}>
                <a onClick={() => setShowAllSectors(true)} style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: 13 }}>
                  查看全部 {sectors.length} 个板块 <RightOutlined />
                </a>
              </div>
            )}
          </Card>
          <Modal title="全部板块轮动" open={showAllSectors} onCancel={() => setShowAllSectors(false)} footer={null} width={800}>
            <Table
              columns={[
                { title: '排名', key: 'rank', width: 60, render: (_: any, __: any, index: number) => index < 3 ? <TrophyIcon index={index} /> : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 11 }}>{index + 1}</span> },
                { title: '板块', dataIndex: 'name', key: 'name', render: (text: string, _: any, index: number) => <strong style={index < 3 ? { color: trophyColors[index] } : {}}>{text}</strong> },
                { title: '涨跌幅', dataIndex: 'change', key: 'change', align: 'right' as const, sorter: (a: SectorData, b: SectorData) => a.change - b.change, render: (val: number) => <span style={{ color: getReturnColor(val), fontWeight: 600 }}>{formatReturn(val)}</span> },
                { title: '成交额', dataIndex: 'volume', key: 'volume', align: 'right' as const },
                { title: '领涨股', dataIndex: 'leadingStock', key: 'leadingStock', align: 'right' as const, render: (text: string) => <span style={{ color: 'var(--primary)' }}>{text}</span> },
              ]}
              dataSource={sortedSectors}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Modal>
        </Col>

        {/* 北向资金 + 主力资金 */}
        <Col xs={24} lg={14}>
          <Row gutter={[0, 20]}>
            {capitalFlow && (
              <Col span={24}>
                <Card
                  title={
                    <div className="section-title-bar" style={{ marginBottom: 0 }}>
                      <BankOutlined style={{ color: 'var(--primary)' }} />
                      <span style={{ fontWeight: 600 }}>北向资金（沪深港通）</span>
                    </div>
                  }
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
                        valueStyle={{ color: parseFloat(capitalFlow.northbound?.total || 0) >= 0 ? '#cf1322' : '#3f8600', fontFamily: 'var(--font-mono)' }}
                        prefix={parseFloat(capitalFlow.northbound?.total || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic title="沪股通" value={capitalFlow.northbound?.sh || 0} precision={2} suffix="亿" valueStyle={{ color: parseFloat(capitalFlow.northbound?.sh || 0) >= 0 ? '#cf1322' : '#3f8600', fontSize: 16, fontFamily: 'var(--font-mono)' }} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="深股通" value={capitalFlow.northbound?.sz || 0} precision={2} suffix="亿" valueStyle={{ color: parseFloat(capitalFlow.northbound?.sz || 0) >= 0 ? '#cf1322' : '#3f8600', fontSize: 16, fontFamily: 'var(--font-mono)' }} />
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
                          { name: '沪股通', type: 'line', data: capitalFlow.northbound.trend.map((t: any) => t.sh), lineStyle: { width: 1.5 }, itemStyle: { color: '#1677ff' }, showSymbol: false, smooth: true },
                          { name: '深股通', type: 'line', data: capitalFlow.northbound.trend.map((t: any) => t.sz), lineStyle: { width: 1.5 }, itemStyle: { color: '#52c41a' }, showSymbol: false, smooth: true },
                          { name: '合计', type: 'line', data: capitalFlow.northbound.trend.map((t: any) => t.total), lineStyle: { width: 2 }, itemStyle: { color: '#ff4d4f' }, showSymbol: false, smooth: true },
                        ],
                      }}
                      style={{ height: 180 }}
                      opts={{ renderer: 'svg' }}
                    />
                  )}
                </Card>
              </Col>
            )}

            {capitalFlow && capitalFlow.mainFlow?.length > 0 && (
              <Col span={24}>
                <Card
                  title={
                    <div className="section-title-bar" style={{ marginBottom: 0 }}>
                      <BarChartOutlined style={{ color: 'var(--warning)' }} />
                      <span style={{ fontWeight: 600 }}>主力资金行业净流入</span>
                    </div>
                  }
                  size="small"
                  style={{ borderRadius: 12 }}
                >
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
                          name: '主力流入', type: 'bar', stack: 'flow',
                          data: capitalFlow.mainFlow.slice(0, 8).map((f: any) => {
                            const net = parseFloat(f.mainNetInflow);
                            return { value: net >= 0 ? net : 0, itemStyle: { color: '#cf1322' } };
                          }).reverse(),
                          barWidth: 14,
                        },
                        {
                          name: '主力流出', type: 'bar', stack: 'flow',
                          data: capitalFlow.mainFlow.slice(0, 8).map((f: any) => {
                            const net = parseFloat(f.mainNetInflow);
                            return { value: net < 0 ? Math.abs(net) : 0, itemStyle: { color: '#3f8600' } };
                          }).reverse(),
                          barWidth: 14,
                        },
                      ],
                    }}
                    style={{ height: 180 }}
                    opts={{ renderer: 'svg' }}
                  />
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    红色=净流入 | 绿色=净流出
                  </div>
                </Card>
              </Col>
            )}
          </Row>
        </Col>
      </Row>

      {/* ═══════════════ 4. 估值温度计 ═══════════════ */}
      <Card
        title={
          <div className="section-title-bar" style={{ marginBottom: 0 }}>
            <DashboardOutlined style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 600 }}>市场估值温度计</span>
          </div>
        }
        style={{ marginBottom: 20, borderRadius: 12 }}
      >
        <Row gutter={[16, 16]}>
          {indices.map((index) => (
            <Col xs={24} sm={12} key={index.code}>
              <Card
                size="small"
                style={{ marginBottom: 0, borderRadius: 10, border: `1px solid ${isDark ? '#333' : '#f0f0f0'}`, cursor: 'pointer' }}
                hoverable
                onClick={() => navigate('/funds')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{index.name}</strong>
                  <Tag color={index.valuation.includes('低') ? 'green' : index.valuation.includes('高') ? 'red' : 'blue'} style={{ borderRadius: 6, fontWeight: 500, fontSize: 12 }}>
                    {index.valuation}
                  </Tag>
                </div>
                <ReactECharts
                  theme={getEchartsTheme(isDark)}
                  option={getGaugeOption(index.name, index.pePercentile ?? 50, index.valuation)}
                  style={{ height: 160 }}
                  opts={{ renderer: 'svg' }}
                />
                <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  PE分位: <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{index.pePercentile}%</span> | {index.suggestion}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ═══════════════ 5. AI策略简报区 ═══════════════ */}
      <Row gutter={20} style={{ marginBottom: 20 }}>
        {/* 操作建议 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="section-title-bar" style={{ marginBottom: 0 }}>
                <BulbOutlined style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 600 }}>今日操作建议</span>
              </div>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 买入 */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: isDark ? 'linear-gradient(135deg, #162312 0%, #1a3015 100%)' : 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                border: `1px solid ${isDark ? '#274916' : '#b7eb8f'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircleOutlined style={{ color: 'var(--success)' }} />
                  <strong style={{ color: 'var(--success)', fontSize: 14 }}>适合买入</strong>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  医药指数基金（估值极低）、新能源基金（底部反弹）、沪深300指数（定投配置）
                </div>
              </div>
              {/* 观望 */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: isDark ? 'linear-gradient(135deg, #2b2111 0%, #3d2b10 100%)' : 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
                border: `1px solid ${isDark ? '#594214' : '#ffe58f'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <ClockCircleOutlined style={{ color: 'var(--warning)' }} />
                  <strong style={{ color: 'var(--warning)', fontSize: 14 }}>观望等待</strong>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  AI/人工智能（估值偏高）、半导体（等待回调）、科创50（估值偏高）
                </div>
              </div>
              {/* 谨慎 */}
              <div style={{
                padding: '14px 16px', borderRadius: 10,
                background: isDark ? 'linear-gradient(135deg, #2c1618 0%, #3d1a1c 100%)' : 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)',
                border: `1px solid ${isDark ? '#58181c' : '#ffa39e'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <AlertOutlined style={{ color: 'var(--danger)' }} />
                  <strong style={{ color: 'var(--danger)', fontSize: 14 }}>谨慎持有</strong>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  地产基金（政策风险）、白酒（估值偏高）、高位QDII（限额紧张）
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 行业推荐 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="section-title-bar" style={{ marginBottom: 0 }}>
                <FundOutlined style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 600 }}>热门行业推荐</span>
              </div>
            }
            extra={<Link to="/funds" style={{ color: 'var(--primary)', fontSize: 13 }}>更多 <RightOutlined /></Link>}
            style={{ borderRadius: 12, height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendations.slice(0, 4).map((rec) => {
                const sectorKey = INDUSTRY_NAME_MAP[rec.industry] ?? rec.industry;
                return (
                  <div
                    key={rec.industry}
                    style={{
                      padding: '12px 14px', borderRadius: 10,
                      border: `1px solid ${isDark ? '#333' : '#f0f0f0'}`,
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onClick={() => sectorKey && navigate(`/industry?sector=${encodeURIComponent(sectorKey)}`)}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(22,119,255,0.25)'; e.currentTarget.style.background = isDark ? 'rgba(22,119,255,0.05)' : 'rgba(22,119,255,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = isDark ? '#333' : '#f0f0f0'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{rec.industry}</strong>
                      <Tag color={rec.buySuggestion === '优先配置' ? 'red' : rec.buySuggestion === '限大额配置' ? 'orange' : 'green'} style={{ borderRadius: 6, fontWeight: 500, fontSize: 11 }}>
                        {rec.buySuggestion}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{rec.logic}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 非登录用户的快捷入口（补充） */}
      {!user && (
        <Card style={{ marginBottom: 20, borderRadius: 12 }} title={<span style={{ fontWeight: 600 }}>快捷入口</span>}>
          <Row gutter={[16, 16]}>
            {quickEntries.map((entry) => (
              <Col xs={12} sm={6} key={entry.to}>
                <Link to={entry.to} style={{ textDecoration: 'none' }}>
                  <TiltCard glowBorder sheen>
                    <Card
                      style={{ background: `linear-gradient(135deg, ${entry.color} 0%, ${entry.color}99 100%)`, border: 'none', textAlign: 'center', borderRadius: 12, overflow: 'hidden' }}
                      styles={{ body: { padding: 20 } }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--color-text-on-dark)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>{entry.icon}</div>
                      <div style={{ fontWeight: 700, color: 'var(--color-text-on-dark)', fontSize: 15 }}>{entry.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{entry.desc}</div>
                    </Card>
                  </TiltCard>
                </Link>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  );
}
