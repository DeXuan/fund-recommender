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
    excellent: { label: '数据充分', color: '#52c41a', desc: '近1年完整数据' },
    good: { label: '数据良好', color: '#1890ff', desc: '近2月+数据' },
    fair: { label: '数据较少', color: '#faad14', desc: '部分历史数据' },
    poor: { label: '数据不足', color: '#ff4d4f', desc: '建议刷新净值' },
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
      case 'risk': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'opportunity': return <BulbOutlined style={{ color: '#1890ff' }} />;
      case 'warning': return <WarningOutlined style={{ color: '#ff4d4f' }} />;
      default: return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
  };

  const priorityColor = (p: string) => {
    switch (p) { case 'high': return '#ff4d4f'; case 'medium': return '#faad14'; default: return '#52c41a'; }
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
          { label: '总投入', value: data.totalCost, color: '#1677ff', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
          { label: '当前市值', value: data.totalValue, color: '#fff', bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
          { label: '总盈亏', value: data.totalPnl, color: '#fff', bg: data.totalPnl >= 0 ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', sign: true },
          { label: '总收益率', value: data.totalReturn, color: '#fff', bg: data.totalReturn >= 0 ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', suffix: '%', sign: true },
        ].map((item, i) => (
          <Col xs={12} sm={12} lg={6} key={i}>
            <Card style={{ background: item.bg, border: 'none', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: 22, fontWeight: 700 }}>
                {item.sign && typeof item.value === 'number' ? (item.value >= 0 ? '+' : '-') : ''}
                {item.suffix ? `${Math.abs(item.value).toFixed(2)}${item.suffix}` : `¥${Math.abs(item.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                {item.sign && typeof item.value === 'number' && (
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
          <Card style={{ height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)', border: 'none' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}>
                <HeartOutlined style={{ marginRight: 4 }} />组合健康评分
              </div>
              <ReactECharts option={scoreOption} style={{ height: 160 }} />
              <Tag color={data.healthScore >= 80 ? 'success' : data.healthScore >= 60 ? 'processing' : data.healthScore >= 40 ? 'warning' : 'error'} style={{ fontSize: 13, padding: '2px 12px' }}>
                {data.healthLevel}
              </Tag>
              <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>综合收益·风控·效率·分散·胜率</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title={<><ThunderboltOutlined style={{ marginRight: 8, color: '#faad14' }} />核心指标</>} style={{ height: '100%' }} bodyStyle={{ padding: '12px 16px' }}>
            <Row gutter={[12, 12]}>
              {[
                { label: data.metrics.returnPeriod === '年化' ? '年化收益率' : `期间收益(${data.metrics.returnPeriod || '收益率'})`, value: data.metrics.annualizedReturn, suffix: '%', color: pnlColor(data.metrics.annualizedReturn), icon: <RiseOutlined /> },
                { label: '最大回撤', value: data.metrics.maxDrawdown, suffix: '%', color: '#ff4d4f', icon: <FallOutlined /> },
                { label: '夏普比率', value: data.metrics.sharpeRatio, suffix: '', color: data.metrics.sharpeRatio >= 1 ? '#52c41a' : data.metrics.sharpeRatio >= 0 ? '#faad14' : '#ff4d4f', icon: <FundOutlined />, tip: '每承担1单位风险的超额收益，>1为优秀' },
                { label: '卡玛比率', value: data.metrics.calmarRatio, suffix: '', color: data.metrics.calmarRatio >= 1 ? '#52c41a' : '#faad14', icon: <SafetyOutlined />, tip: '年化收益/最大回撤，>1为优秀' },
                { label: '年化波动率', value: data.metrics.volatility, suffix: '%', color: '#722ed1', icon: <BarChartOutlined /> },
                { label: '胜率', value: data.metrics.winRate, suffix: '%', color: '#1890ff', icon: <CheckCircleOutlined /> },
                { label: '盈亏比', value: data.metrics.profitLossRatio, suffix: ':1', color: '#13c2c2', icon: <PieChartOutlined /> },
                { label: '平均持仓天数', value: data.metrics.avgHoldingDays, suffix: '天', color: isDark ? '#a0a0a0' : '#666', icon: <StarOutlined /> },
              ].map((item, i) => (
                <Col xs={12} sm={8} key={i}>
                  <Tooltip title={item.tip}>
                    <div style={{ background: isDark ? '#1a1a1a' : '#fff', borderRadius: 8, padding: '10px 12px', border: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`, textAlign: 'center', cursor: item.tip ? 'help' : 'default' }}>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                        <span style={{ marginRight: 4 }}>{item.icon}</span>{item.label}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>
                        {typeof item.value === 'number' ? `${item.value >= 0 ? '+' : ''}${item.suffix === '天' ? Math.round(item.value) : item.value.toFixed(2)}` : '--'}{item.suffix}
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
          <Card title={<><PieChartOutlined style={{ marginRight: 8, color: '#722ed1' }} />收益归因分析</>} bodyStyle={{ padding: '8px 16px' }}>
            {data.attribution.length > 0 ? (
              <>
                <ReactECharts option={attributionOption} style={{ height: Math.max(data.attribution.length * 44, 160) }} />
                <Divider style={{ margin: '8px 0' }} />
                <Row gutter={8}>
                  {data.attribution.map((a, i) => (
                    <Col span={Math.floor(24 / Math.min(data.attribution.length, 4))} key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#999' }}>{a.category}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: pnlColor(a.pnl) }}>{pnlSign(a.pnl)}¥{Math.abs(a.pnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                      <div style={{ fontSize: 10, color: '#bbb' }}>占比 {a.weight}%</div>
                    </Col>
                  ))}
                </Row>
              </>
            ) : <Empty description="暂无归因数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<><BarChartOutlined style={{ marginRight: 8, color: '#1890ff' }} />月度收益表现</>} bodyStyle={{ padding: '8px 16px' }}>
            {data.monthlyReturns.length > 0 ? (
              <>
                <ReactECharts option={monthlyOption} style={{ height: 200 }} />
                <Row gutter={8} style={{ textAlign: 'center', borderTop: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`, paddingTop: 8 }}>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: '#999' }}>盈利月</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#cf1322' }}>{data.monthlyReturns.filter(m => m.return > 0).length}</div>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: '#999' }}>亏损月</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#3f8600' }}>{data.monthlyReturns.filter(m => m.return < 0).length}</div>
                  </Col>
                  <Col span={8}>
                    <div style={{ fontSize: 11, color: '#999' }}>月胜率</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
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
          <Card title={<><FundOutlined style={{ marginRight: 8, color: '#13c2c2' }} />风险能力雷达</>} bodyStyle={{ padding: '8px 16px' }}>
            {data.riskMetrics.length > 0 ? (
              <>
                <ReactECharts option={radarOption} style={{ height: 260 }} />
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>
                  <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#1677ff', marginRight: 4, verticalAlign: 'middle' }} />我的组合</span>
                  <span><span style={{ display: 'inline-block', width: 12, height: 3, background: '#999', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed #999' }} />市场基准</span>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                {data.riskMetrics.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                    <span style={{ color: isDark ? '#a0a0a0' : '#666', width: 60 }}>{r.name}</span>
                    <Progress percent={r.value} size="small" style={{ flex: 1, margin: '0 8px' }} strokeColor={r.status === 'good' ? '#52c41a' : '#faad14'} showInfo={false} />
                    <span style={{ fontWeight: 600, color: r.status === 'good' ? '#52c41a' : '#faad14', width: 36, textAlign: 'right' }}>{r.value}</span>
                  </div>
                ))}
              </>
            ) : <Empty description="暂无风险数据" />}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card
            title={<><ExclamationCircleOutlined style={{ marginRight: 8, color: '#faad14' }} />智能预警</>}
            extra={data.alerts.length > 0 && data.alerts[0].type !== 'success' ? <Badge count={data.alerts.length} style={{ backgroundColor: '#ff4d4f' }} /> : null}
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
        title={<><RocketOutlined style={{ marginRight: 8, color: '#722ed1' }} />AI 投资顾问</>}
        extra={<Tag color="purple">基于您的真实持仓分析</Tag>}
        style={{ marginBottom: 0 }}
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
                  <div style={{ marginTop: 6, fontSize: 11, color: '#1677ff', background: '#f0f5ff', padding: '4px 8px', borderRadius: 4 }}>
                    预期影响: {advice.impact}
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
