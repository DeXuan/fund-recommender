import { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Space, Alert, Spin, Empty, Badge, Progress, Statistic, Divider, Tooltip } from 'antd';
import {
  CrownOutlined, ThunderboltOutlined, SafetyOutlined, RiseOutlined, FallOutlined,
  BulbOutlined, HeartOutlined, FundOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, WarningOutlined, StarOutlined, RocketOutlined,
  DashboardOutlined, LineChartOutlined, PieChartOutlined, BarChartOutlined,
  ArrowUpOutlined, ArrowDownOutlined, InfoCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { portfolioApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface FundDetail {
  code: string;
  name: string;
  shares: number;
  costPrice: number;
  currentNav: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
  holdingDays: number;
  riskLevel: string;
  buyTimingScore: number;
  diagnosis: string;
  industry: string;
  assetCategory: string;
}

interface LossDiagnosis {
  totalLoss: number;
  fundCount: number;
  worstFund: { fundName: string; pnl: number; pnlPercent: number } | null;
  analysis: { type: string; title: string; detail: string; funds?: string[] }[];
}

interface ProfitAnalysis {
  totalProfit: number;
  fundCount: number;
  bestFund: { fundName: string; pnl: number; pnlPercent: number } | null;
  analysis: { type: string; title: string; detail: string; funds?: string[] }[];
}

interface FeeImpact {
  totalFees: number;
  feeRate: number;
  impactOnReturn: number;
}

interface BenchmarkComparison {
  benchmarkName: string;
  benchmarkReturn: number;
  portfolioReturn: number;
  alpha: number;
  outperformed: boolean;
}

interface VIPData {
  healthScore: number;
  healthLevel: string;
  dataQuality: string;
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalReturn: number;
  metrics: {
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    calmarRatio: number;
    volatility: number;
    winRate: number;
    profitLossRatio: number;
    avgHoldingDays: number;
    returnPeriod?: string;
  };
  attribution: { category: string; contribution: number; weight: number; pnl: number; value: number }[];
  monthlyReturns: { month: string; return: number; value: number }[];
  riskMetrics: { name: string; value: number; benchmark: number; status: string }[];
  alerts: { type: string; level: string; title: string; detail: string; action: string }[];
  aiAdvice: { priority: string; title: string; detail: string; impact: string }[];
  fundDetails?: FundDetail[];
  lossDiagnosis?: LossDiagnosis;
  profitAnalysis?: ProfitAnalysis;
  feeImpact?: FeeImpact;
  benchmarkComparison?: BenchmarkComparison;
}

export default function VIPInsights() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VIPData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    portfolioApi.getVIPInsights()
      .then(d => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) { setData(null); setError(e.message || '加载失败'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Card style={{ marginBottom: 24 }}><div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" tip="正在分析您的持仓数据..." /></div></Card>;
  }

  if (error) {
    return <Card style={{ marginBottom: 24 }}><Alert type="error" message="VIP分析加载失败" description={error} showIcon /></Card>;
  }

  if (!data || data.dataQuality === 'empty') {
    return <Card style={{ marginBottom: 24 }}><Empty description="暂无持仓数据，请先添加持仓记录" /></Card>;
  }

  const pnlColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';
  const pnlSign = (v: number) => v >= 0 ? '+' : '';

  const qualityConfig: Record<string, { label: string; color: string; desc: string }> = {
    excellent: { label: '数据充分', color: 'var(--success)', desc: '近1年完整数据' },
    good: { label: '数据良好', color: 'var(--primary)', desc: '近2月+数据' },
    fair: { label: '数据较少', color: 'var(--warning)', desc: '部分历史数据' },
    poor: { label: '数据不足', color: 'var(--danger)', desc: '建议刷新净值' },
  };
  const quality = qualityConfig[data.dataQuality] || qualityConfig.poor;

  // 组合健康评分环形图
  const scoreOption = {
    series: [{
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max: 100,
      radius: '85%',
      progress: { show: true, width: 14, itemStyle: { color: data.healthScore >= 80 ? '#52c41a' : data.healthScore >= 60 ? '#1890ff' : data.healthScore >= 40 ? '#faad14' : '#ff4d4f' } },
      axisLine: { lineStyle: { width: 14, color: [[1, '#e8e8e8']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 36,
        fontWeight: 700,
        color: data.healthScore >= 80 ? '#52c41a' : data.healthScore >= 60 ? '#1890ff' : data.healthScore >= 40 ? '#faad14' : '#ff4d4f',
        formatter: '{value}',
        offsetCenter: [0, '10%'],
      },
      data: [{ value: data.healthScore }],
    }],
  };

  // 收益归因柱状图
  const attributionOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const a = data.attribution[params[0].dataIndex];
        return `<b>${a.category}</b><br/>贡献: ${a.contribution >= 0 ? '+' : ''}${Number(a.contribution).toFixed(2)}%<br/>市值: ¥${Number(a.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}<br/>盈亏: ${a.pnl >= 0 ? '+' : ''}¥${Math.abs(a.pnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      },
    },
    grid: { left: 100, right: 40, top: 10, bottom: 30 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 10 } },
    yAxis: { type: 'category', data: data.attribution.map(a => a.category), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar',
      barWidth: 18,
      data: data.attribution.map(a => ({
        value: a.contribution,
        itemStyle: { color: a.contribution >= 0 ? '#cf1322' : '#3f8600', borderRadius: a.contribution >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
      })),
      label: { show: true, position: 'right', formatter: (p: any) => `${p.value >= 0 ? '+' : ''}${Number(p.value).toFixed(2)}%`, fontSize: 10 },
    }],
  };

  // 月度收益柱状图
  const monthlyOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const m = data.monthlyReturns[params[0].dataIndex];
        return `<b>${m.month}</b><br/>收益: ${m.return >= 0 ? '+' : ''}${Number(m.return).toFixed(2)}%<br/>市值: ¥${Number(m.value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: data.monthlyReturns.map(m => m.month), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
    series: [{
      type: 'bar',
      barWidth: 20,
      data: data.monthlyReturns.map(m => ({
        value: m.return,
        itemStyle: { color: m.return >= 0 ? '#cf1322' : '#3f8600', borderRadius: m.return >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] },
      })),
      label: { show: true, position: 'top', formatter: (p: any) => `${p.value >= 0 ? '+' : ''}${Number(p.value).toFixed(2)}%`, fontSize: 9 },
    }],
  };

  // 雷达图
  const radarOption = {
    radar: {
      indicator: data.riskMetrics.map(r => ({ name: r.name, max: 100 })),
      radius: '60%',
      axisName: { fontSize: 10, color: isDark ? '#a0a0a0' : '#666' },
      splitArea: { areaStyle: { color: ['rgba(22,119,255,0.02)', 'rgba(22,119,255,0.05)', 'rgba(22,119,255,0.08)', 'rgba(22,119,255,0.12)'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: data.riskMetrics.map(r => r.value),
        name: '我的组合',
        areaStyle: { color: 'rgba(22,119,255,0.2)' },
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
      }, {
        value: data.riskMetrics.map(r => r.benchmark),
        name: '市场基准',
        lineStyle: { color: '#999', type: 'dashed', width: 1 },
        itemStyle: { color: '#999' },
        symbol: 'none',
      }],
    }],
  };

  const alertIcon = (type: string) => {
    switch (type) {
      case 'risk': return <ExclamationCircleOutlined style={{ color: 'var(--warning)' }} />;
      case 'opportunity': return <BulbOutlined style={{ color: 'var(--primary)' }} />;
      case 'warning': return <WarningOutlined style={{ color: 'var(--danger)' }} />;
      default: return <CheckCircleOutlined style={{ color: 'var(--success)' }} />;
    }
  };

  const priorityColor = (p: string) => {
    switch (p) { case 'high': return 'var(--danger)'; case 'medium': return 'var(--warning)'; default: return 'var(--success)'; }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* VIP 头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 12, padding: '16px 24px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <Space>
          <CrownOutlined style={{ color: '#ffd700', fontSize: 22 }} />
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>VIP 智能分析</span>
          <Tag color="gold" style={{ fontSize: 11 }}>PRO</Tag>
        </Space>
        <Space size={16} wrap>
          <Tooltip title={quality.desc}>
            <Tag color={quality.color} style={{ fontSize: 11 }}>
              <SyncOutlined style={{ marginRight: 4 }} />{quality.label}
            </Tag>
          </Tooltip>
        </Space>
      </div>

      {/* 0. 组合概览（真实持仓数据） */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {[
          { label: '总投入', value: Number(data.totalCost) || 0, color: 'var(--primary)', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
          { label: '当前市值', value: Number(data.totalValue) || 0, color: '#fff', bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
          { label: '总盈亏', value: Number(data.totalPnl) || 0, color: '#fff', bg: (Number(data.totalPnl) || 0) >= 0 ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', sign: true },
          { label: '总收益率', value: Number(data.totalReturn) || 0, color: '#fff', bg: (Number(data.totalReturn) || 0) >= 0 ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', suffix: '%', sign: true },
        ].map((item, i) => (
          <Col xs={12} sm={12} lg={6} key={i}>
            <Card style={{ background: item.bg, border: 'none', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: 22, fontWeight: 700 }}>
                {item.sign ? (item.value >= 0 ? '+' : '-') : ''}
                {item.suffix ? `${Math.abs(item.value).toFixed(2)}${item.suffix}` : `¥${Math.abs(item.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                {item.sign && (
                  <span style={{ fontSize: 13, marginLeft: 4 }}>{item.value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}</span>
                )}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 1. 健康评分 + 核心指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card style={{ height: '100%', background: isDark ? 'linear-gradient(135deg, #1f1f1f 0%, #2a2a2a 100%)' : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)', border: 'none' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}>
                <HeartOutlined style={{ marginRight: 4 }} />组合健康评分
              </div>
              <ReactECharts theme={getEchartsTheme(isDark)} option={scoreOption} style={{ height: 160 }} />
              <Tag color={data.healthScore >= 80 ? 'success' : data.healthScore >= 60 ? 'processing' : data.healthScore >= 40 ? 'warning' : 'error'} style={{ fontSize: 13, padding: '2px 12px' }}>
                {data.healthLevel}
              </Tag>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>综合收益·风控·效率·分散·胜率</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title={<><ThunderboltOutlined style={{ marginRight: 8, color: 'var(--warning)' }} />核心指标</>} style={{ height: '100%' }} bodyStyle={{ padding: '12px 16px' }}>
            <Row gutter={[12, 12]}>
              {[
                { label: data.metrics.returnPeriod === '年化' ? '年化收益率' : `期间收益(${data.metrics.returnPeriod || '收益率'})`, value: data.metrics.annualizedReturn, suffix: '%', color: pnlColor(data.metrics.annualizedReturn), icon: <RiseOutlined /> },
                { label: '最大回撤', value: data.metrics.maxDrawdown, suffix: '%', color: 'var(--danger)', icon: <FallOutlined /> },
                { label: '夏普比率', value: data.metrics.sharpeRatio, suffix: '', color: data.metrics.sharpeRatio >= 1 ? 'var(--success)' : data.metrics.sharpeRatio >= 0 ? 'var(--warning)' : 'var(--danger)', icon: <FundOutlined />, tip: '每承担1单位风险的超额收益，>1为优秀' },
                { label: '卡玛比率', value: data.metrics.calmarRatio, suffix: '', color: data.metrics.calmarRatio >= 1 ? 'var(--success)' : 'var(--warning)', icon: <SafetyOutlined />, tip: '年化收益/最大回撤，>1为优秀' },
                { label: '年化波动率', value: data.metrics.volatility, suffix: '%', color: 'var(--color-purple)', icon: <BarChartOutlined /> },
                { label: '胜率', value: data.metrics.winRate, suffix: '%', color: 'var(--primary)', icon: <CheckCircleOutlined /> },
                { label: '盈亏比', value: data.metrics.profitLossRatio, suffix: ':1', color: 'var(--color-teal)', icon: <PieChartOutlined /> },
                { label: '平均持仓天数', value: data.metrics.avgHoldingDays, suffix: '天', color: isDark ? '#a0a0a0' : '#666', icon: <StarOutlined /> },
              ].map((item, i) => (
                <Col xs={12} sm={8} key={i}>
                  <Tooltip title={item.tip}>
                    <div style={{ background: isDark ? '#1a1a1a' : '#fff', borderRadius: 8, padding: '10px 12px', border: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`, textAlign: 'center', cursor: item.tip ? 'help' : 'default' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        <span style={{ marginRight: 4 }}>{item.icon}</span>{item.label}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                        {item.value !== undefined && item.value !== null ? `${Number(item.value) >= 0 ? '+' : ''}${item.suffix === '天' ? Math.round(Number(item.value)) : Number(item.value).toFixed(2)}` : '--'}{item.suffix}
                      </div>
                    </div>
                  </Tooltip>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 2. 收益归因 + 月度表现 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<><PieChartOutlined style={{ marginRight: 8, color: 'var(--color-purple)' }} />收益归因分析</>} bodyStyle={{ padding: '8px 16px' }}>
            {data.attribution.length > 0 ? (
              <>
                <ReactECharts theme={getEchartsTheme(isDark)} option={attributionOption} style={{ height: Math.max(data.attribution.length * 44, 160) }} />
                <Divider style={{ margin: '8px 0' }} />
                <Row gutter={8}>
                  {data.attribution.map((a, i) => (
                    <Col span={Math.floor(24 / Math.min(data.attribution.length, 4))} key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.category}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: pnlColor(a.pnl) }}>{pnlSign(a.pnl)}¥{Math.abs(a.pnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>占比 {a.weight}%</div>
                    </Col>
                  ))}
                </Row>
              </>
            ) : <Empty description="暂无归因数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<><BarChartOutlined style={{ marginRight: 8, color: 'var(--primary)' }} />月度收益表现</>} bodyStyle={{ padding: '8px 16px' }}>
            {data.monthlyReturns.length > 0 ? (
              <>
                <ReactECharts theme={getEchartsTheme(isDark)} option={monthlyOption} style={{ height: 200 }} />
                <Row gutter={8} style={{ textAlign: 'center', borderTop: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`, paddingTop: 8 }}>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>盈利月</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#cf1322' }}>{data.monthlyReturns.filter(m => m.return > 0).length}</div>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>亏损月</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#3f8600' }}>{data.monthlyReturns.filter(m => m.return < 0).length}</div>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>月胜率</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)' }}>
                      {data.monthlyReturns.length > 0 ? Math.round(data.monthlyReturns.filter(m => m.return > 0).length / data.monthlyReturns.length * 100) : 0}%
                    </div>
                  </Col>
                </Row>
              </>
            ) : <Empty description="暂无月度数据" />}
          </Card>
        </Col>
      </Row>

      {/* 3. 风险雷达 + 智能预警 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={10}>
          <Card title={<><FundOutlined style={{ marginRight: 8, color: 'var(--color-teal)' }} />风险能力雷达</>} bodyStyle={{ padding: '8px 16px' }}>
            {data.riskMetrics.length > 0 ? (
              <>
                <ReactECharts theme={getEchartsTheme(isDark)} option={radarOption} style={{ height: 260 }} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--primary)', marginRight: 4, verticalAlign: 'middle' }} />我的组合</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--color-text-muted)', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed var(--color-text-muted)' }} />市场基准</span>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                {data.riskMetrics.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                    <span style={{ color: isDark ? '#a0a0a0' : '#666', width: 60 }}>{r.name}</span>
                    <Progress percent={r.value} size="small" style={{ flex: 1, margin: '0 8px' }} strokeColor={r.status === 'good' ? 'var(--success)' : 'var(--warning)'} showInfo={false} />
                    <span style={{ fontWeight: 600, color: r.status === 'good' ? 'var(--success)' : 'var(--warning)', width: 36, textAlign: 'right' }}>{r.value}</span>
                  </div>
                ))}
              </>
            ) : <Empty description="暂无风险数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title={<><ExclamationCircleOutlined style={{ marginRight: 8, color: 'var(--warning)' }} />智能预警</>}
            extra={data.alerts.length > 0 && data.alerts[0].type !== 'success' ? <Badge count={data.alerts.length} style={{ backgroundColor: 'var(--danger)' }} /> : null}
            bodyStyle={{ padding: '8px 16px' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {data.alerts.map((a, i) => (
                <Alert
                  key={i}
                  type={a.level === 'warning' ? 'warning' : a.level === 'error' ? 'error' : a.level === 'info' ? 'info' : 'success'}
                  icon={alertIcon(a.type)}
                  message={<span style={{ fontWeight: 600 }}>{a.title}</span>}
                  description={a.detail}
                  showIcon
                  style={{ borderRadius: 6 }}
                />
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 4. AI 投资顾问 */}
      <Card
        title={<><RocketOutlined style={{ marginRight: 8, color: 'var(--color-purple)' }} />AI 投资顾问</>}
        extra={<Tag color="purple">基于您的真实持仓分析</Tag>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[12, 12]}>
          {data.aiAdvice.map((advice, i) => (
            <Col xs={24} sm={12} key={i}>
              <Card
                size="small"
                style={{ borderLeft: `3px solid ${priorityColor(advice.priority)}`, borderRadius: 6 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{advice.title}</span>
                  <Tag color={advice.priority === 'high' ? 'red' : advice.priority === 'medium' ? 'orange' : 'green'} style={{ fontSize: 10 }}>
                    {advice.priority === 'high' ? '高优先' : advice.priority === 'medium' ? '中优先' : '低优先'}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', lineHeight: 1.8 }}>{advice.detail}</div>
                {advice.impact && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--primary)', background: isDark ? 'rgba(22,119,255,0.1)' : '#f0f5ff', padding: '4px 8px', borderRadius: 4 }}>
                    预期影响: {advice.impact}
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 5. 亏损诊断 + 盈利分析 + 费用影响 */}
      {(data.lossDiagnosis || data.profitAnalysis || data.feeImpact) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {data.lossDiagnosis && (
            <Col xs={24} lg={8}>
              <Card
                title={<><FallOutlined style={{ marginRight: 8, color: 'var(--danger)' }} />亏损诊断</>}
                size="small"
                style={{ height: '100%' }}
              >
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>总亏损</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#3f8600' }}>¥{Math.abs(Number(data.lossDiagnosis.totalLoss) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>亏损基金数</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{Number(data.lossDiagnosis.fundCount) || 0}</div>
                  </Col>
                </Row>
                {data.lossDiagnosis.worstFund && (
                  <div style={{ marginBottom: 8, padding: '6px 10px', background: isDark ? 'rgba(255,77,79,0.08)' : '#fff2f0', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>最大亏损：{data.lossDiagnosis.worstFund.fundName}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      亏损 ¥{Math.abs(Number(data.lossDiagnosis.worstFund.pnl) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      （{Number(data.lossDiagnosis.worstFund.pnlPercent) || 0}%）
                    </div>
                  </div>
                )}
                {data.lossDiagnosis.analysis?.map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}>
                    {a.type === 'concentration' ? <InfoCircleOutlined style={{ marginRight: 4 }} /> :
                     a.type === 'sector' ? <BarChartOutlined style={{ marginRight: 4 }} /> :
                     <WarningOutlined style={{ marginRight: 4 }} />}
                    {a.detail}
                  </div>
                ))}
              </Card>
            </Col>
          )}
          {data.profitAnalysis && (
            <Col xs={24} lg={8}>
              <Card
                title={<><RiseOutlined style={{ marginRight: 8, color: 'var(--success)' }} />盈利分析</>}
                size="small"
                style={{ height: '100%' }}
              >
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>总盈利</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#cf1322' }}>+¥{Number(data.profitAnalysis.totalProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>盈利基金数</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{Number(data.profitAnalysis.fundCount) || 0}</div>
                  </Col>
                </Row>
                {data.profitAnalysis.bestFund && (
                  <div style={{ marginBottom: 8, padding: '6px 10px', background: isDark ? 'rgba(82,196,26,0.08)' : '#f6ffed', borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>最大盈利：{data.profitAnalysis.bestFund.fundName}</div>
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      盈利 +¥{Number(data.profitAnalysis.bestFund.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      （+{Number(data.profitAnalysis.bestFund.pnlPercent) || 0}%）
                    </div>
                  </div>
                )}
                {data.profitAnalysis.analysis?.map((a, i) => (
                  <div key={i} style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}>
                    {a.type === 'sector' ? <BulbOutlined style={{ marginRight: 4 }} /> :
                     a.type === 'timing' ? <DashboardOutlined style={{ marginRight: 4 }} /> :
                     <CheckCircleOutlined style={{ marginRight: 4 }} />}
                    {a.detail}
                  </div>
                ))}
              </Card>
            </Col>
          )}
          {data.feeImpact && (
            <Col xs={24} lg={8}>
              <Card
                title={<><InfoCircleOutlined style={{ marginRight: 8, color: 'var(--color-purple)' }} />费用影响</>}
                size="small"
                style={{ height: '100%' }}
              >
                <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>累计手续费</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>¥{Number(data.feeImpact.totalFees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>费率水平</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-purple)' }}>{Number(data.feeImpact.feeRate || 0).toFixed(2)}%</div>
                  </Col>
                </Row>
                <div style={{ padding: '8px 12px', background: isDark ? 'rgba(114,46,209,0.08)' : '#f9f0ff', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>对收益的影响</div>
                  <Progress
                    percent={Math.min(Math.abs(Number(data.feeImpact.impactOnReturn) || 0) * 10, 100)}
                    strokeColor={Math.abs(Number(data.feeImpact.impactOnReturn) || 0) > 2 ? 'var(--danger)' : 'var(--warning)'}
                    format={() => `${Number(data.feeImpact!.impactOnReturn || 0).toFixed(2)}%`}
                  />
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {Math.abs(Number(data.feeImpact.impactOnReturn) || 0) > 2 ? '费率偏高，建议关注低费率产品' : '费率控制良好'}
                  </div>
                </div>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* 6. 基准对比 */}
      {data.benchmarkComparison && (
        <Card
          title={<><BarChartOutlined style={{ marginRight: 8, color: 'var(--primary)' }} />基准对比</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16} style={{ textAlign: 'center' }}>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>我的持仓收益</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: pnlColor(Number(data.benchmarkComparison.portfolioReturn)) }}>
                {pnlSign(Number(data.benchmarkComparison.portfolioReturn))}{Math.abs(Number(data.benchmarkComparison.portfolioReturn) || 0).toFixed(2)}%
              </div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{data.benchmarkComparison.benchmarkName}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: pnlColor(Number(data.benchmarkComparison.benchmarkReturn)) }}>
                {pnlSign(Number(data.benchmarkComparison.benchmarkReturn))}{Math.abs(Number(data.benchmarkComparison.benchmarkReturn) || 0).toFixed(2)}%
              </div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>超额收益 (Alpha)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-purple)' }}>
                {Number(data.benchmarkComparison.alpha) >= 0 ? '+' : ''}{Number(data.benchmarkComparison.alpha || 0).toFixed(2)}%
              </div>
            </Col>
            <Col span={6}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>是否跑赢</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {data.benchmarkComparison.outperformed
                  ? <Tag color="success" style={{ fontSize: 14, padding: '2px 12px' }}>跑赢</Tag>
                  : <Tag color="error" style={{ fontSize: 14, padding: '2px 12px' }}>跑输</Tag>
                }
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 7. 持仓基金诊断 */}
      {data.fundDetails && data.fundDetails.length > 0 && (
        <Card
          title={<><FundOutlined style={{ marginRight: 8, color: 'var(--color-teal)' }} />持仓基金诊断</>}
          size="small"
          style={{ marginBottom: 0 }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${isDark ? '#333' : '#e8e8e8'}` }}>
                  {['基金名称', '行业', '持仓占比', '持仓天数', '盈亏', '买入时机', '风险等级', '诊断建议'].map(h => (
                    <th key={h} style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.fundDetails.map((f, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${isDark ? '#262626' : '#f0f0f0'}` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 500 }}>
                      <a href={`/web/funds/${f.code}`} style={{ color: 'var(--primary)' }}>{f.name}</a>
                    </td>
                    <td style={{ padding: '8px 6px', color: isDark ? '#a0a0a0' : '#666' }}>{f.industry}</td>
                    <td style={{ padding: '8px 6px' }}>{Number(f.weight || 0).toFixed(1)}%</td>
                    <td style={{ padding: '8px 6px' }}>{f.holdingDays}天</td>
                    <td style={{ padding: '8px 6px' }}>
                      <span style={{ color: pnlColor(Number(f.pnl)), fontWeight: 600 }}>
                        {pnlSign(Number(f.pnl))}¥{Math.abs(Number(f.pnl) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span style={{ fontSize: 10, marginLeft: 2 }}>({Number(f.pnlPercent) >= 0 ? '+' : ''}{Number(f.pnlPercent || 0).toFixed(2)}%)</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <Tag color={f.buyTimingScore >= 70 ? 'green' : f.buyTimingScore >= 40 ? 'blue' : 'orange'} style={{ fontSize: 10 }}>
                        {f.buyTimingScore}分
                      </Tag>
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <Tag color={f.riskLevel === '低' ? 'green' : f.riskLevel === '中低' ? 'lime' : f.riskLevel === '中' ? 'blue' : f.riskLevel === '中高' ? 'orange' : 'red'} style={{ fontSize: 10 }}>
                        {f.riskLevel}
                      </Tag>
                    </td>
                    <td style={{ padding: '8px 6px', color: isDark ? '#a0a0a0' : '#666', maxWidth: 200 }}>{f.diagnosis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
