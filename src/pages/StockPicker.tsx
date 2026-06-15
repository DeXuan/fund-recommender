import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Select, Slider, Button, Space, Tag, Typography, Row, Col, Spin, message, Tooltip, Statistic, Segmented, Progress, Modal, InputNumber, Descriptions } from 'antd';
import { FundOutlined, TrophyOutlined, ReloadOutlined, RocketOutlined, ThunderboltOutlined, SafetyOutlined, BarChartOutlined, FireOutlined, RiseOutlined, AimOutlined, LineChartOutlined, WalletOutlined, StarOutlined, StarFilled, DownloadOutlined, ExperimentOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { stockPickerApi, watchlistApi, fundApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatReturn, getReturnColor } from '../utils/format';

const { Title, Text, Paragraph } = Typography;

const FACTOR_META: Record<string, { label: string; desc: string; color: string; icon: React.ReactNode }> = {
  return1y: { label: '收益能力', desc: '近1年收益率，50%以上边际递减', color: '#1677ff', icon: <RiseOutlined /> },
  fee: { label: '成本优势', desc: '综合费率越低，长期持有成本越小', color: '#52c41a', icon: <SafetyOutlined /> },
  scale: { label: '规模稳定', desc: '规模越大流动性越好，清盘风险越低', color: '#faad14', icon: <BarChartOutlined /> },
  momentum: { label: '趋势动量', desc: '近期涨幅加权，捕捉上升趋势', color: '#eb2f96', icon: <ThunderboltOutlined /> },
  valuation: { label: '估值洼地', desc: '当前估值分位越低，安全边际越高', color: '#722ed1', icon: <AimOutlined /> },
};

const STRATEGIES = [
  { label: '激进进攻', value: 'aggressive', factors: { return1y: 0.40, fee: 0.05, scale: 0.05, momentum: 0.35, valuation: 0.15 }, icon: <RocketOutlined />, desc: '重收益和动量，适合牛市追涨' },
  { label: '均衡配置', value: 'balanced', factors: { return1y: 0.30, fee: 0.15, scale: 0.15, momentum: 0.20, valuation: 0.20 }, icon: <FundOutlined />, desc: '五因子均衡，攻守兼备' },
  { label: '稳健防守', value: 'conservative', factors: { return1y: 0.15, fee: 0.25, scale: 0.25, momentum: 0.10, valuation: 0.25 }, icon: <SafetyOutlined />, desc: '重费率和规模，适合长期定投' },
  { label: '价值猎手', value: 'value', factors: { return1y: 0.20, fee: 0.15, scale: 0.10, momentum: 0.10, valuation: 0.45 }, icon: <AimOutlined />, desc: '重估值，寻找低估机会' },
];

export default function StockPicker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [industries, setIndustries] = useState<string[]>([]);
  const [filters, setFilters] = useState({ industry: '', type: '', limit: 30 });
  const [strategy, setStrategy] = useState('balanced');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // 高级功能状态
  const [backtestData, setBacktestData] = useState<any>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [portfolioModal, setPortfolioModal] = useState(false);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [budget, setBudget] = useState(10000);
  const [watchedCodes, setWatchedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fundApi_getIndustries();
    handleRank();
    if (user) loadWatchlist();
  }, []);

  const fundApi_getIndustries = async () => {
    try {
      const data = await fundApi.getIndustries();
      setIndustries(Array.isArray(data) ? data : []);
    } catch (e) { console.error('加载行业列表失败:', e); }
  };

  const loadWatchlist = async () => {
    try {
      const data = await watchlistApi.getList();
      setWatchedCodes(new Set((data || []).map((w: any) => w.fund_code)));
    } catch (e) { console.error('加载自选列表失败:', e); }
  };

  const toggleWatchlist = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (watchedCodes.has(code)) {
        await watchlistApi.remove(code);
        setWatchedCodes(prev => { const s = new Set(prev); s.delete(code); return s; });
      } else {
        await watchlistApi.add(code);
        setWatchedCodes(prev => new Set(prev).add(code));
      }
    } catch (e) { console.error('自选操作失败:', e); }
  };

  const handleRank = async (strategyOverride?: string) => {
    setLoading(true);
    setError('');
    try {
      const strat = strategyOverride || strategy;
      const stratData = STRATEGIES.find(s => s.value === strat);
      const params: any = { limit: filters.limit };
      if (filters.industry) params.industry = filters.industry;
      if (filters.type) params.type = filters.type;
      if (stratData) {
        params.factors = {};
        for (const [k, w] of Object.entries(stratData.factors)) params.factors[k] = { weight: w };
      }
      const data = await stockPickerApi.rankFunds(params);
      setResults(data.ranked);
      setTotal(data.total);
    } catch (e: any) {
      if (e.message?.includes('会员')) setError('SUBSCRIPTION_REQUIRED');
      else message.error(e.message || '选股失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStrategyChange = (val: string) => {
    setStrategy(val);
    handleRank(val);
  };

  // 回测
  const handleBacktest = async () => {
    const topCodes = results.slice(0, 5).map(r => r.fund.code);
    if (topCodes.length === 0) return;
    setBacktestLoading(true);
    try {
      const data = await stockPickerApi.backtest(topCodes, 180);
      setBacktestData(data);
    } catch (e: any) {
      message.error(e.message || '回测失败');
    } finally {
      setBacktestLoading(false);
    }
  };

  // 一键建仓
  const handleBuildPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const data = await stockPickerApi.buildPortfolio({ topN: 5, budget, strategy });
      setPortfolioData(data);
    } catch (e: any) {
      message.error(e.message || '建仓建议失败');
    } finally {
      setPortfolioLoading(false);
    }
  };

  // 统计数据
  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const top10 = results.slice(0, 10);
    const avgReturn = top10.reduce((s, r) => s + (r.fund.return1y || 0), 0) / top10.length;
    const avgScore = top10.reduce((s, r) => s + r.score, 0) / top10.length;
    const maxReturn = Math.max(...results.map(r => r.fund.return1y || 0));
    const industrySet = new Set(results.map(r => r.fund.industry));
    return { avgReturn: avgReturn.toFixed(1), avgScore: avgScore.toFixed(1), maxReturn: maxReturn.toFixed(1), industries: industrySet.size };
  }, [results]);

  // 风险收益散点图
  const scatterOption = useMemo(() => {
    if (results.length === 0) return null;
    return {
      tooltip: {
        formatter: (p: any) => `<b>${p.data.name}</b><br/>评分：${p.data.value[3]}<br/>收益：${p.data.value[1].toFixed(1)}%<br/>费率：${p.data.value[0]}%<br/>规模：${p.data.value[2].toFixed(1)}亿`,
      },
      grid: { left: 60, right: 30, top: 40, bottom: 50 },
      xAxis: { type: 'value', name: '综合费率(%)', nameLocation: 'center', nameGap: 30 },
      yAxis: { type: 'value', name: '近1年收益(%)', nameLocation: 'center', nameGap: 40 },
      series: [{
        type: 'scatter',
        data: results.slice(0, 50).map(r => ({
          name: r.fund.name,
          value: [r.fund.totalFee || 0.5, r.fund.return1y || 0, r.fund.scale || 1, r.score],
          itemStyle: { color: r.score >= 70 ? '#52c41a' : r.score >= 50 ? '#1677ff' : '#faad14' },
        })),
        symbolSize: (val: number[]) => Math.max(8, Math.min(40, val[2] / 3)),
      }],
    };
  }, [results]);

  // 动量对比图
  const momentumOption = useMemo(() => {
    const top10 = results.slice(0, 10);
    if (top10.length === 0) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['近1周', '近1月', '近3月'], top: 0 },
      grid: { left: 100, right: 20, top: 40, bottom: 20 },
      xAxis: { type: 'value', name: '%' },
      yAxis: { type: 'category', data: top10.map(r => r.fund.name.slice(0, 8)), inverse: true },
      series: [
        { name: '近1周', type: 'bar', data: top10.map(r => r.fund.return1w || 0), itemStyle: { color: '#1677ff' } },
        { name: '近1月', type: 'bar', data: top10.map(r => r.fund.return1m || 0), itemStyle: { color: '#52c41a' } },
        { name: '近3月', type: 'bar', data: top10.map(r => r.fund.return3m || 0), itemStyle: { color: '#faad14' } },
      ],
    };
  }, [results]);

  // 回测曲线图
  const backtestOption = useMemo(() => {
    if (!backtestData) return null;
    return {
      tooltip: { trigger: 'axis', formatter: (params: any) => { const d = params[0]?.axisValue || ''; return `${d}<br/>${params.map((p: any) => `${p.marker} ${p.seriesName}: ${p.value.toFixed(2)}`).join('<br/>')}`; } },
      legend: { data: ['Top5等权组合', '沪深300基准'], top: 0 },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: backtestData.dates, axisLabel: { formatter: (v: string) => v.slice(5) } },
      yAxis: { type: 'value', name: '净值(起点=100)' },
      series: [
        { name: 'Top5等权组合', type: 'line', data: backtestData.portfolio, lineStyle: { width: 2.5 }, itemStyle: { color: '#1677ff' }, areaStyle: { color: 'rgba(22,119,255,0.08)' }, showSymbol: false },
        { name: '沪深300基准', type: 'line', data: backtestData.benchmark, lineStyle: { width: 1.5, type: 'dashed' }, itemStyle: { color: '#999' }, showSymbol: false },
      ],
    };
  }, [backtestData]);

  const radarOption = (item: any) => ({
    radar: {
      indicator: Object.entries(FACTOR_META).map(([, f]) => ({ name: f.label, max: 100 })),
      radius: '65%',
      splitArea: { areaStyle: { color: isDark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] : ['rgba(0,0,0,0.01)', 'rgba(0,0,0,0.03)'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: Object.keys(FACTOR_META).map(k => item.breakdown[k] || 0),
        name: item.fund.name,
        areaStyle: { opacity: 0.25, color: '#1677ff' },
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
      }],
    }],
  });

  if (error === 'SUBSCRIPTION_REQUIRED') {
    return (
      <Card style={{ textAlign: 'center', padding: 80, background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 16 }}>
        <RocketOutlined style={{ fontSize: 72, color: '#fff' }} />
        <Title level={2} style={{ color: '#fff', marginTop: 16 }}>AI 智能选股引擎</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>多因子量化模型 · 策略化筛选 · 回测验证 · 一键建仓</Paragraph>
        <Button type="primary" size="large" ghost onClick={() => navigate('/subscription')} style={{ marginTop: 16 }}>开通会员解锁</Button>
      </Card>
    );
  }

  const top3 = results.slice(0, 3);

  // 评分表格列定义
  const tableColumns = [
    { title: '排名', width: 60, render: (_: any, __: any, i: number) => <span style={{ fontWeight: 600, color: i < 3 ? '#faad14' : undefined }}>{i < 3 ? <TrophyOutlined /> : null} {i + 1}</span> },
    { title: '基金名称', dataIndex: ['fund', 'name'], width: 170, render: (v: string, r: any) => <a onClick={() => navigate(`/funds/${r.fund.code}`)} style={{ fontWeight: 500 }}>{v}</a> },
    { title: '代码', dataIndex: ['fund', 'code'], width: 70 },
    { title: '行业', dataIndex: ['fund', 'industry'], width: 70 },
    { title: '评分', dataIndex: 'score', width: 80, sorter: (a: any, b: any) => a.score - b.score, render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 70 ? '#52c41a' : v >= 50 ? '#1677ff' : '#faad14'} format={() => <b>{v}</b>} /> },
    { title: '近1年', dataIndex: ['fund', 'return1y'], width: 70, render: (v: number) => <span style={{ color: getReturnColor(v), fontWeight: 500 }}>{formatReturn(v)}</span> },
    { title: '近3月', dataIndex: ['fund', 'return3m'], width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
    { title: '近1月', dataIndex: ['fund', 'return1m'], width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
    { title: '费率', dataIndex: ['fund', 'totalFee'], width: 50, render: (v: number) => `${v}%` },
    { title: '规模(亿)', dataIndex: ['fund', 'scale'], width: 65, render: (v: number) => v?.toFixed(1) },
    {
      title: '因子得分', width: 200, render: (_: any, r: any) => (
        <Tooltip title={<div style={{ fontSize: 12, lineHeight: 2 }}><div style={{ fontWeight: 600, marginBottom: 4 }}>综合评分：{r.score}分</div>{Object.entries(FACTOR_META).map(([k, f]) => <div key={k}>{f.icon} <span style={{ color: f.color }}>{f.label}</span>：<b>{r.breakdown[k] || 0}</b>/100 — {f.desc}</div>)}</div>} placement="topLeft">
          <div style={{ display: 'flex', gap: 2, height: 20, alignItems: 'flex-end' }}>
            {Object.entries(FACTOR_META).map(([k, f]) => <Tooltip key={k} title={`${f.label}: ${r.breakdown[k] || 0}分`} placement="top"><div style={{ width: 32, height: `${Math.max(3, (r.breakdown[k] || 0) / 100 * 20)}px`, background: f.color, borderRadius: 2 }} /></Tooltip>)}
          </div>
        </Tooltip>
      ),
    },
    { title: '推荐理由', dataIndex: 'reasoning', ellipsis: true, width: 180 },
    { title: '操作', width: 60, render: (_: any, r: any) => <Tooltip title={watchedCodes.has(r.fund.code) ? '取消自选' : '加自选'}><Button type="text" size="small" icon={watchedCodes.has(r.fund.code) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={(e) => toggleWatchlist(r.fund.code, e)} /></Tooltip> },
  ];

  return (
    <div>
      {/* 策略选择 + 筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text strong style={{ marginRight: 12 }}>投资策略</Text>
            <Segmented options={STRATEGIES.map(s => ({ label: <Space>{s.icon} {s.label}</Space>, value: s.value }))} value={strategy} onChange={v => handleStrategyChange(v as string)} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>{STRATEGIES.find(s => s.value === strategy)?.desc}</Text>
          <Space wrap>
            <Select placeholder="选择行业" allowClear style={{ width: 140 }} value={filters.industry || undefined} onChange={v => setFilters(f => ({ ...f, industry: v || '' }))}>
              {industries.map(i => <Select.Option key={i} value={i}>{i}</Select.Option>)}
            </Select>
            <Select placeholder="基金类型" allowClear style={{ width: 100 }} value={filters.type || undefined} onChange={v => setFilters(f => ({ ...f, type: v || '' }))}>
              <Select.Option value="A">A类</Select.Option><Select.Option value="C">C类</Select.Option>
            </Select>
            <span style={{ fontSize: 13 }}>数量：</span>
            <Slider min={10} max={50} step={5} value={filters.limit} style={{ width: 100 }} onChange={(v: number) => setFilters(f => ({ ...f, limit: v }))} />
            <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={() => handleRank()}>重新扫描</Button>
          </Space>
        </Space>
      </Card>

      {/* 数据概览 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="扫描基金" value={total} suffix="只" valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Top10均分" value={stats.avgScore} suffix="分" precision={1} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="最高收益" value={stats.maxReturn} suffix="%" precision={1} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="覆盖行业" value={stats.industries} suffix="个" valueStyle={{ color: '#722ed1' }} /></Card></Col>
        </Row>
      )}

      {/* Top 3 精选 */}
      {top3.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {top3.map((r, i) => (
            <Col xs={24} sm={8} key={r.fund.code}>
              <Card hoverable onClick={() => navigate(`/funds/${r.fund.code}`)}
                style={{ background: i === 0 ? (isDark ? 'linear-gradient(135deg, #2d1b00, #1a1a2e)' : 'linear-gradient(135deg, #fff7e6, #fffbe6)') : undefined, border: i === 0 ? '1px solid #ffd591' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Tag color={i === 0 ? 'gold' : i === 1 ? 'default' : 'orange'} style={{ marginBottom: 8 }}>
                      {i === 0 ? '🥇 第一名' : i === 1 ? '🥈 第二名' : '🥉 第三名'}
                    </Tag>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{r.fund.name}</div>
                    <Text type="secondary">{r.fund.code} · {r.fund.industry} · {r.fund.manager && `${r.fund.manager}`}</Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: r.score >= 70 ? '#52c41a' : '#1677ff' }}>{r.score}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>综合评分</Text>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag color="blue">近1年 {formatReturn(r.fund.return1y)}</Tag>
                  <Tag color="cyan">近3月 {formatReturn(r.fund.return3m)}</Tag>
                  <Tag color="green">费率 {r.fund.totalFee}%</Tag>
                  <Tag color="orange">规模 {r.fund.scale?.toFixed(1)}亿</Tag>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>{r.reasoning}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 高级工具栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<ExperimentOutlined />} loading={backtestLoading} onClick={handleBacktest}>回测验证（Top5 vs 沪深300）</Button>
          <Button icon={<WalletOutlined />} onClick={() => { setPortfolioModal(true); handleBuildPortfolio(); }}>一键建仓建议</Button>
        </Space>
      </Card>

      {/* 回测曲线 */}
      {backtestData && (
        <Card title={<Space><LineChartOutlined /> 回测验证：Top5等权组合 vs 沪深300</Space>} size="small" style={{ marginBottom: 16 }}
          extra={backtestData.summary && (
            <Space>
              <Tag color="blue">组合收益 {formatReturn(backtestData.summary.portReturn)}</Tag>
              <Tag color={backtestData.summary.alpha > 0 ? 'green' : 'red'}>超额 {formatReturn(backtestData.summary.alpha)}</Tag>
              <Tag color="orange">最大回撤 {backtestData.summary.maxDrawdown}%</Tag>
              <Tag>胜率 {backtestData.summary.winRate}%</Tag>
            </Space>
          )}>
          <ReactECharts option={backtestOption} style={{ height: 350 }} theme={isDark ? 'dark' : undefined} />
        </Card>
      )}

      {/* 图表区 */}
      {results.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={14}>
            <Card title={<Space><AimOutlined /> 风险收益分布</Space>} size="small">
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>X轴=费率（越低越好），Y轴=收益（越高越好），气泡=规模</Text>
              <ReactECharts option={scatterOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={<Space><ThunderboltOutlined /> Top10 动量对比</Space>} size="small">
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>近1周/1月/3月收益率，判断趋势持续性</Text>
              <ReactECharts option={momentumOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 排名区域 */}
      <Card title={<Space><BarChartOutlined /> 全部排名 <Tag color="blue">{results.length}只</Tag></Space>}
        extra={<Segmented options={[{ label: '卡片视图', value: 'cards' }, { label: '表格视图', value: 'table' }]} value={viewMode} onChange={v => setViewMode(v as any)} />}>
        {viewMode === 'cards' ? (
          <Row gutter={[16, 16]}>
            {results.map((r, i) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={r.fund.code}>
                <Card hoverable size="small" onClick={() => navigate(`/funds/${r.fund.code}`)} style={{ border: i < 3 ? '1px solid #ffd591' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space><span style={{ fontWeight: 700, color: i < 3 ? '#faad14' : '#999', fontSize: i < 3 ? 18 : 14 }}>{i < 3 ? <TrophyOutlined /> : null} #{i + 1}</span><Tag>{r.fund.type}</Tag></Space>
                    <span style={{ fontSize: 24, fontWeight: 700, color: r.score >= 70 ? '#52c41a' : r.score >= 50 ? '#1677ff' : '#faad14' }}>{r.score}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.fund.name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.fund.code} · {r.fund.industry}</Text>
                  <div style={{ margin: '8px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>1年 {formatReturn(r.fund.return1y)}</Tag>
                    <Tag color="cyan" style={{ fontSize: 11 }}>3月 {formatReturn(r.fund.return3m)}</Tag>
                    <Tag color="lime" style={{ fontSize: 11 }}>1月 {formatReturn(r.fund.return1m)}</Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 14, alignItems: 'flex-end', marginBottom: 4 }}>
                    {Object.entries(FACTOR_META).map(([k, f]) => <Tooltip key={k} title={`${f.label}: ${r.breakdown[k] || 0}分`}><div style={{ flex: 1, height: `${Math.max(2, (r.breakdown[k] || 0) / 100 * 14)}px`, background: f.color, borderRadius: 1 }} /></Tooltip>)}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#8c8c8c', lineHeight: 1.4 }}>{r.reasoning}</div>
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Table dataSource={results} columns={tableColumns} rowKey={r => r.fund.code} loading={loading} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 1300 }}
            expandable={{
              expandedRowRender: (r) => (
                <Row gutter={16} style={{ padding: '8px 0' }}>
                  <Col span={8}><ReactECharts option={radarOption(r)} style={{ height: 220 }} theme={isDark ? 'dark' : undefined} /></Col>
                  <Col span={16}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {Object.entries(FACTOR_META).map(([k, f]) => (
                        <div key={k} style={{ padding: '8px 12px', background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa', borderRadius: 6 }}>
                          <div style={{ fontSize: 12, color: '#999' }}>{f.icon} {f.label}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: f.color }}>{r.breakdown[k] || 0}<span style={{ fontSize: 12, color: '#999' }}>分</span></div>
                          <Progress percent={r.breakdown[k] || 0} showInfo={false} strokeColor={f.color} size="small" />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, padding: '8px 12px', background: isDark ? 'rgba(255,255,255,0.04)' : '#f6ffed', borderRadius: 6, fontSize: 13 }}>
                      <FireOutlined style={{ color: '#52c41a' }} /> {r.reasoning}
                    </div>
                  </Col>
                </Row>
              ),
            }}
          />
        )}
      </Card>

      {/* 一键建仓弹窗 */}
      <Modal title="一键建仓建议" open={portfolioModal} onCancel={() => setPortfolioModal(false)} footer={null} width={600}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <span>投资金额：</span>
            <InputNumber value={budget} onChange={v => setBudget(v || 10000)} min={1000} step={1000} formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
            <Button type="primary" loading={portfolioLoading} onClick={handleBuildPortfolio}>生成方案</Button>
          </Space>
        </div>
        {portfolioData && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="总投资金额">¥{portfolioData.totalBudget?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="每只基金">¥{portfolioData.perFund?.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="基金数量">{portfolioData.allocation?.length}只</Descriptions.Item>
              <Descriptions.Item label="策略">{STRATEGIES.find(s => s.value === portfolioData.strategy)?.label || portfolioData.strategy}</Descriptions.Item>
            </Descriptions>
            <Table dataSource={portfolioData.allocation} rowKey="code" size="small" pagination={false}
              columns={[
                { title: '基金', dataIndex: 'name', render: (v: string, r: any) => <a onClick={() => { setPortfolioModal(false); navigate(`/funds/${r.code}`); }}>{v}</a> },
                { title: '代码', dataIndex: 'code', width: 70 },
                { title: '行业', dataIndex: 'industry', width: 70 },
                { title: '近1年', dataIndex: 'return1y', width: 70, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                { title: '建议金额', dataIndex: 'amount', width: 90, render: (v: number) => `¥${v?.toLocaleString()}` },
                { title: '权重', dataIndex: 'weight', width: 60, render: (v: number) => `${v}%` },
              ]}
            />
          </>
        )}
      </Modal>

      <div style={{ marginTop: 16, padding: '12px 16px', background: isDark ? 'rgba(255,255,255,0.04)' : '#fffbe6', borderRadius: 6, fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c' }}>
        ⚠️ 评分基于历史数据的量化模型，不代表未来表现。投资有风险，入市需谨慎。本工具仅供参考，不构成投资建议。
      </div>
    </div>
  );
}
