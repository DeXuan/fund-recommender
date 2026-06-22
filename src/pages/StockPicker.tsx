import { useState, useEffect, useMemo } from 'react';
import { Card, Table, Select, Slider, Button, Space, Tag, Typography, Row, Col, Spin, message, Tooltip, Statistic, Segmented, Progress, Modal, InputNumber, Descriptions, Tabs, Empty, Badge } from 'antd';
import { FundOutlined, TrophyOutlined, ReloadOutlined, RocketOutlined, ThunderboltOutlined, SafetyOutlined, BarChartOutlined, FireOutlined, RiseOutlined, AimOutlined, LineChartOutlined, WalletOutlined, StarOutlined, StarFilled, ExperimentOutlined, GlobalOutlined, BulbOutlined, DashboardOutlined, PieChartOutlined, StockOutlined, FundProjectionScreenOutlined } from '@ant-design/icons';
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
  const [activeTab, setActiveTab] = useState('rank');
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
  const [industryStats, setIndustryStats] = useState<Record<string, { count: number; avgScore: number; avgReturn: number }> | null>(null);

  // 市场环境状态
  const [marketData, setMarketData] = useState<any>(null);
  const [marketLoading, setMarketLoading] = useState(false);

  // 策略对比状态
  const [strategyData, setStrategyData] = useState<any>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);

  // 深度分析状态
  const [deepData, setDeepData] = useState<any>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepCodes, setDeepCodes] = useState<string>('');

  // 量化精选状态
  const [quantData, setQuantData] = useState<any>(null);
  const [quantLoading, setQuantLoading] = useState(false);

  useEffect(() => {
    fundApi_getIndustries();
    handleRank();
    if (user) loadWatchlist();
  }, []);

  const fundApi_getIndustries = async () => {
    try {
      const data = await fundApi.getIndustries();
      setIndustries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('加载行业列表失败:', e);
    }
  };

  const loadWatchlist = async () => {
    try {
      const data = await watchlistApi.getList();
      setWatchedCodes(new Set((data || []).map((w: any) => w.fund_code)));
    } catch (e) {
      console.error('加载自选列表失败:', e);
    }
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
    } catch (e) {
      console.error('切换自选状态失败:', e);
    }
  };

  // 多因子排名
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
      setIndustryStats(data.industryStats || null);
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
      const stratData = STRATEGIES.find(s => s.value === strategy);
      const params: any = { topN: 5, budget, strategy };
      if (stratData) {
        params.factors = {};
        for (const [k, w] of Object.entries(stratData.factors)) params.factors[k] = { weight: w };
      }
      if (filters.industry) params.industry = filters.industry;
      if (filters.type) params.type = filters.type;
      const data = await stockPickerApi.buildPortfolio(params);
      setPortfolioData(data);
    } catch (e: any) {
      message.error(e.message || '建仓建议失败');
    } finally {
      setPortfolioLoading(false);
    }
  };

  // 市场环境
  const loadMarketOverview = async () => {
    if (marketData) return;
    setMarketLoading(true);
    try {
      const data = await stockPickerApi.getMarketOverview();
      setMarketData(data);
    } catch (e: any) {
      message.error(e.message || '市场数据加载失败');
    } finally {
      setMarketLoading(false);
    }
  };

  // 策略对比
  const loadStrategyCompare = async () => {
    if (strategyData) return;
    setStrategyLoading(true);
    try {
      const data = await stockPickerApi.strategyCompare({ limit: 10 });
      setStrategyData(data);
    } catch (e: any) {
      message.error(e.message || '策略对比失败');
    } finally {
      setStrategyLoading(false);
    }
  };

  // 深度分析
  const handleDeepAnalysis = async () => {
    const codes = deepCodes.split(/[,，\s]+/).filter(Boolean);
    if (codes.length === 0) {
      // 默认用当前排名前5
      const top5 = results.slice(0, 5).map(r => r.fund.code);
      if (top5.length === 0) { message.warning('请先进行排名或输入基金代码'); return; }
      setDeepCodes(top5.join(','));
      await runDeepAnalysis(top5);
      return;
    }
    await runDeepAnalysis(codes);
  };

  const runDeepAnalysis = async (codes: string[]) => {
    setDeepLoading(true);
    try {
      const data = await stockPickerApi.deepAnalysis(codes);
      setDeepData(data);
    } catch (e: any) {
      message.error(e.message || '深度分析失败');
    } finally {
      setDeepLoading(false);
    }
  };

  // 量化精选
  const loadQuantPicks = async () => {
    if (quantData) return;
    setQuantLoading(true);
    try {
      const data = await stockPickerApi.quantPicks();
      setQuantData(data);
    } catch (e: any) {
      message.error(e.message || '量化精选失败');
    } finally {
      setQuantLoading(false);
    }
  };

  // Tab切换时懒加载数据
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'market' && !marketData) loadMarketOverview();
    if (key === 'strategy' && !strategyData) loadStrategyCompare();
    if (key === 'quant' && !quantData) loadQuantPicks();
  };

  // 统计数据
  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const top10 = results.slice(0, 10);
    const avgReturn = top10.reduce((s, r) => s + (Number(r.fund.return1y) || 0), 0) / top10.length;
    const avgScore = top10.reduce((s, r) => s + (Number(r.score) || 0), 0) / top10.length;
    const maxReturn = Math.max(...results.map(r => Number(r.fund.return1y) || 0));
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

  // 行业分布饼图
  const industryPieOption = useMemo(() => {
    if (!industryStats || Object.keys(industryStats).length === 0) return null;
    const data = Object.entries(industryStats)
      .map(([name, s]) => ({ name: `${name}(${s.count})`, value: s.count, avgScore: s.avgScore, avgReturn: s.avgReturn }))
      .sort((a, b) => b.value - a.value);
    return {
      tooltip: { formatter: (p: any) => `${p.data.name}<br/>平均评分：${p.data.avgScore}<br/>平均收益：${p.data.avgReturn}%` },
      series: [{
        type: 'pie', radius: ['35%', '65%'], center: ['50%', '50%'],
        itemStyle: { borderRadius: 6, borderColor: isDark ? '#1a1a2e' : '#fff', borderWidth: 2 },
        label: { formatter: '{b}', fontSize: 11 },
        data,
      }],
    };
  }, [industryStats, isDark]);

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

  // 策略对比雷达图
  const strategyRadarOption = useMemo(() => {
    if (!strategyData) return null;
    const stratNames = Object.keys(strategyData.strategies);
    const stratLabels: Record<string, string> = { aggressive: '激进进攻', balanced: '均衡配置', conservative: '稳健防守', value: '价值猎手' };
    const colors = ['#ff4d4f', '#1677ff', '#52c41a', '#faad14'];
    return {
      tooltip: {},
      legend: { data: stratNames.map(s => stratLabels[s] || s), bottom: 0 },
      radar: {
        indicator: [
          { name: '平均评分', max: 100 },
          { name: '平均收益', max: 50 },
          { name: 'Top1评分', max: 100 },
        ],
        radius: '60%',
      },
      series: [{
        type: 'radar',
        data: stratNames.map((s, i) => ({
          value: [
            strategyData.strategies[s].avgScore,
            Math.max(0, strategyData.strategies[s].avgReturn),
            strategyData.strategies[s].top1Score,
          ],
          name: stratLabels[s] || s,
          lineStyle: { color: colors[i] },
          itemStyle: { color: colors[i] },
          areaStyle: { opacity: 0.1, color: colors[i] },
        })),
      }],
    };
  }, [strategyData]);

  // 策略对比柱状图
  const strategyBarOption = useMemo(() => {
    if (!strategyData) return null;
    const stratNames = Object.keys(strategyData.strategies);
    const stratLabels: Record<string, string> = { aggressive: '激进进攻', balanced: '均衡配置', conservative: '稳健防守', value: '价值猎手' };
    const colors = ['#ff4d4f', '#1677ff', '#52c41a', '#faad14'];
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['平均评分', '平均收益(%)'], top: 0 },
      grid: { left: 80, right: 30, top: 40, bottom: 30 },
      xAxis: { type: 'category', data: stratNames.map(s => stratLabels[s] || s) },
      yAxis: [{ type: 'value', name: '评分' }, { type: 'value', name: '收益(%)', position: 'right' }],
      series: [
        { name: '平均评分', type: 'bar', data: stratNames.map(s => strategyData.strategies[s].avgScore), itemStyle: { color: '#1677ff' }, barWidth: 30 },
        { name: '平均收益(%)', type: 'line', yAxisIndex: 1, data: stratNames.map(s => strategyData.strategies[s].avgReturn), itemStyle: { color: '#faad14' }, lineStyle: { width: 2 } },
      ],
    };
  }, [strategyData]);

  // 深度分析指标雷达图
  const deepRadarOption = (item: any) => ({
    radar: {
      indicator: [
        { name: '年化收益', max: 50 },
        { name: '夏普比率', max: 3 },
        { name: '卡玛比率', max: 3 },
        { name: '索提诺', max: 4 },
        { name: '胜率', max: 100 },
        { name: '盈亏比', max: 3 },
      ],
      radius: '60%',
    },
    series: [{
      type: 'radar',
      data: [{
        value: [
          Math.max(0, item.metrics.annualizedReturn),
          item.metrics.sharpe,
          item.metrics.calmar,
          item.metrics.sortino,
          item.metrics.winRate,
          item.metrics.profitLossRatio,
        ],
        name: item.name,
        areaStyle: { opacity: 0.2, color: '#1677ff' },
        lineStyle: { color: '#1677ff' },
        itemStyle: { color: '#1677ff' },
      }],
    }],
  });

  // 量化精选因子得分图
  const quantFactorOption = useMemo(() => {
    if (!quantData || quantData.picks.length === 0) return null;
    const top5 = quantData.picks.slice(0, 5);
    const factorNames = ['收益', '费率', '规模', '动量', '稳定性', '估值'];
    const factorKeys = ['return', 'fee', 'scale', 'momentum', 'stability', 'valuation'];
    const colors = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: top5.map((f: any) => f.name.slice(0, 6)), top: 0 },
      grid: { left: 80, right: 20, top: 40, bottom: 20 },
      xAxis: { type: 'value', max: 100 },
      yAxis: { type: 'category', data: factorNames },
      series: top5.map((f: any, i: number) => ({
        name: f.name.slice(0, 6),
        type: 'bar',
        stack: 'total',
        data: factorKeys.map(k => f.breakdown[k] || 0),
        itemStyle: { color: colors[i] },
      })),
    };
  }, [quantData]);

  // 量化精选行业分布
  const quantIndustryPieOption = useMemo(() => {
    if (!quantData || !quantData.industryStats) return null;
    const data = Object.entries(quantData.industryStats)
      .map(([name, s]: any) => ({ name: `${name}(${s.count})`, value: s.count, avgScore: s.avgScore }))
      .sort((a, b) => b.value - a.value);
    return {
      tooltip: { formatter: (p: any) => `${p.data.name}<br/>平均评分：${p.data.avgScore}` },
      series: [{
        type: 'pie', radius: ['35%', '65%'],
        itemStyle: { borderRadius: 6, borderColor: isDark ? '#1a1a2e' : '#fff', borderWidth: 2 },
        label: { formatter: '{b}', fontSize: 11 },
        data,
      }],
    };
  }, [quantData, isDark]);

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

  // 表格列定义
  const tableColumns = [
    { title: '排名', width: 60, render: (_: any, __: any, i: number) => <span style={{ fontWeight: 600, color: i < 3 ? '#faad14' : undefined }}>{i < 3 ? <TrophyOutlined /> : null} {i + 1}</span> },
    { title: '基金名称', dataIndex: ['fund', 'name'], width: 170, render: (v: string, r: any) => <a onClick={() => navigate(`/funds/${r.fund.code}`)} style={{ fontWeight: 500 }}>{v}</a> },
    { title: '代码', dataIndex: ['fund', 'code'], width: 70 },
    { title: '行业', dataIndex: ['fund', 'industry'], width: 70 },
    { title: '评分', dataIndex: 'score', width: 80, sorter: (a: any, b: any) => a.score - b.score, render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 70 ? '#52c41a' : v >= 50 ? '#1677ff' : '#faad14'} format={() => <b>{v}</b>} /> },
    { title: '近1年', dataIndex: ['fund', 'return1y'], width: 70, sorter: (a: any, b: any) => (a.fund.return1y || 0) - (b.fund.return1y || 0), render: (v: number) => <span style={{ color: getReturnColor(v), fontWeight: 500 }}>{formatReturn(v)}</span> },
    { title: '近6月', dataIndex: ['fund', 'return6m'], width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
    { title: '近3月', dataIndex: ['fund', 'return3m'], width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
    { title: '近1月', dataIndex: ['fund', 'return1m'], width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
    { title: '费率', dataIndex: ['fund', 'totalFee'], width: 70, render: (v: number, r: any) => (
      <Tooltip title={<div style={{ fontSize: 12, lineHeight: 1.8 }}>管理费：{r.fund.mgmtFee}%<br/>托管费：{r.fund.custodyFee}%<br/>综合费率：{v}%</div>}>
        <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>{v}%</span>
      </Tooltip>
    ) },
    { title: '规模(亿)', dataIndex: ['fund', 'scale'], width: 65, render: (v: number) => Number(v || 0).toFixed(1) },
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

  // ====== Tab 内容 ======

  // Tab1: 多因子排名
  const rankTab = (
    <div>
      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
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
      </Card>

      {/* 数据概览 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {[
            { title: '扫描基金', value: total, suffix: '只', color: '#1677ff', icon: <FundOutlined />, bg: isDark ? 'linear-gradient(135deg, #0d1b3e, #1a2744)' : 'linear-gradient(135deg, #e8f4ff, #f0f7ff)' },
            { title: 'Top10均分', value: stats.avgScore, suffix: '分', color: '#52c41a', icon: <TrophyOutlined />, bg: isDark ? 'linear-gradient(135deg, #0d2818, #1a3020)' : 'linear-gradient(135deg, #f0fff0, #f6ffed)', precision: 1 },
            { title: '最高收益', value: stats.maxReturn, suffix: '%', color: '#faad14', icon: <RiseOutlined />, bg: isDark ? 'linear-gradient(135deg, #2d1b00, #1a1a0e)' : 'linear-gradient(135deg, #fffbe6, #fff7e6)', precision: 1 },
            { title: '覆盖行业', value: stats.industries, suffix: '个', color: '#722ed1', icon: <BarChartOutlined />, bg: isDark ? 'linear-gradient(135deg, #1a0d2e, #221233)' : 'linear-gradient(135deg, #f9f0ff, #f5e6ff)' },
          ].map((s, i) => (
            <Col xs={12} sm={6} key={i}>
              <Card size="small" bordered={false} style={{ background: s.bg, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: s.color, fontSize: 14 }}>{s.icon}</span>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{s.title}</Text>
                </div>
                <Statistic value={s.value} suffix={s.suffix} precision={s.precision} valueStyle={{ color: s.color, fontSize: 22, fontWeight: 700 }} />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Top 3 精选 */}
      {top3.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>Top 3 精选基金</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>—— 当前策略下综合评分最高</Text>
          </div>
          <Row gutter={16}>
            {top3.map((r, i) => {
              const gradients = [
                isDark ? 'linear-gradient(135deg, #2d1b00 0%, #1a1a2e 100%)' : 'linear-gradient(135deg, #fff7e6 0%, #fff1b8 50%, #fffbe6 100%)',
                isDark ? 'linear-gradient(135deg, #1a2332 0%, #1a1a2e 100%)' : 'linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 50%, #f0f7ff 100%)',
                isDark ? 'linear-gradient(135deg, #1f1215 0%, #1a1a2e 100%)' : 'linear-gradient(135deg, #fff2e8 0%, #ffccc7 50%, #fff2f0 100%)',
              ];
              const borders = ['#ffd666', '#91caff', '#ffbb96'];
              const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
              const medalColors = ['#faad14', '#8c8c8c', '#d46b08'];
              return (
                <Col xs={24} sm={8} key={r.fund.code}>
                  <Card hoverable onClick={() => navigate(`/funds/${r.fund.code}`)}
                    bordered={false}
                    style={{ background: gradients[i], border: `1px solid ${borders[i]}40`, borderRadius: 12, position: 'relative', overflow: 'hidden' }}>
                    {i === 0 && <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(250,173,20,0.08)' }} />}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 20, background: `${medalColors[i]}18`, marginBottom: 8 }}>
                          <span style={{ fontSize: 14 }}>{medals[i]}</span>
                          <Text style={{ color: medalColors[i], fontWeight: 600, fontSize: 12 }}>第{i + 1}名</Text>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{r.fund.name}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{r.fund.code} · {r.fund.industry}{r.fund.manager ? ` · ${r.fund.manager}` : ''}</Text>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 32, fontWeight: 800, color: r.score >= 70 ? '#52c41a' : '#1677ff', lineHeight: 1 }}>{r.score}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>综合评分</Text>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Tag color="blue" style={{ borderRadius: 4 }}>近1年 {formatReturn(r.fund.return1y)}</Tag>
                      <Tag color="geekblue" style={{ borderRadius: 4 }}>近6月 {formatReturn(r.fund.return6m)}</Tag>
                      <Tag color="cyan" style={{ borderRadius: 4 }}>近3月 {formatReturn(r.fund.return3m)}</Tag>
                      <Tooltip title={`管理费 ${r.fund.mgmtFee}% + 托管费 ${r.fund.custodyFee}%`}>
                        <Tag color="green" style={{ borderRadius: 4, cursor: 'help' }}>费率 {r.fund.totalFee}%</Tag>
                      </Tooltip>
                      <Tag color="orange" style={{ borderRadius: 4 }}>规模 {Number(r.fund.scale || 0).toFixed(1)}亿</Tag>
                    </div>
                    <div style={{ marginTop: 8, padding: '6px 10px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: 6, fontSize: 12, color: isDark ? '#a0a0a0' : '#666', lineHeight: 1.5 }}>
                      {r.reasoning}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}

      {/* 高级工具栏 */}
      <Card size="small" bordered={false} style={{ marginBottom: 16, background: isDark ? 'linear-gradient(135deg, #0d1b3e, #1a1a2e)' : 'linear-gradient(135deg, #f0f7ff, #e8f4ff)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <ExperimentOutlined style={{ color: '#1677ff', fontSize: 16 }} />
            <Text strong style={{ fontSize: 13 }}>高级分析工具</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>基于Top5基金进行深度分析</Text>
          </Space>
          <Space>
            <Button type="primary" ghost icon={<ExperimentOutlined />} loading={backtestLoading} onClick={handleBacktest}>回测验证</Button>
            <Button type="primary" icon={<WalletOutlined />} onClick={() => { setPortfolioModal(true); handleBuildPortfolio(); }}>一键建仓</Button>
          </Space>
        </div>
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
          <Col xs={24} lg={industryPieOption ? 10 : 14}>
            <Card bordered={false} title={<Space><AimOutlined style={{ color: '#1677ff' }} /> 风险收益分布</Space>} size="small" style={{ borderRadius: 10 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>X轴=费率（越低越好），Y轴=收益（越高越好），气泡=规模</Text>
              <ReactECharts option={scatterOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
            </Card>
          </Col>
          <Col xs={24} lg={7}>
            <Card bordered={false} title={<Space><ThunderboltOutlined style={{ color: '#eb2f96' }} /> Top10 动量对比</Space>} size="small" style={{ borderRadius: 10 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>近1周/1月/3月收益率，判断趋势持续性</Text>
              <ReactECharts option={momentumOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
            </Card>
          </Col>
          {industryPieOption && (
            <Col xs={24} lg={7}>
              <Card bordered={false} title={<Space><FundOutlined style={{ color: '#722ed1' }} /> 行业分布</Space>} size="small" style={{ borderRadius: 10 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>入选基金的行业分布与平均评分</Text>
                <ReactECharts option={industryPieOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* 排名区域 */}
      <Card bordered={false} title={<Space><BarChartOutlined style={{ color: '#1677ff' }} /> 全部排名 <Tag color="blue" style={{ borderRadius: 4 }}>{results.length}只</Tag></Space>}
        extra={<Segmented options={[{ label: '卡片视图', value: 'cards' }, { label: '表格视图', value: 'table' }]} value={viewMode} onChange={v => setViewMode(v as any)} />}
        style={{ borderRadius: 10 }}>
        {viewMode === 'cards' ? (
          <Row gutter={[16, 16]}>
            {results.map((r, i) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={r.fund.code}>
                <Card hoverable size="small" bordered={false} onClick={() => navigate(`/funds/${r.fund.code}`)}
                  style={{ borderRadius: 10, border: i < 3 ? '1px solid #ffd591' : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`, transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space><span style={{ fontWeight: 700, color: i < 3 ? '#faad14' : '#999', fontSize: i < 3 ? 18 : 14 }}>{i < 3 ? <TrophyOutlined /> : null} #{i + 1}</span><Tag>{r.fund.type}</Tag></Space>
                    <span style={{ fontSize: 24, fontWeight: 700, color: r.score >= 70 ? '#52c41a' : r.score >= 50 ? '#1677ff' : '#faad14' }}>{r.score}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.fund.name}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.fund.code} · {r.fund.industry}</Text>
                  <div style={{ margin: '8px 0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>1年 {formatReturn(r.fund.return1y)}</Tag>
                    <Tag color="geekblue" style={{ fontSize: 11 }}>6月 {formatReturn(r.fund.return6m)}</Tag>
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
    </div>
  );

  // Tab2: 行业洞察
  const industryTab = (
    <div>
      {!industryStats || Object.keys(industryStats).length === 0 ? (
        <Empty description="请先进行多因子排名以获取行业数据" />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card bordered={false} title={<Space><PieChartOutlined style={{ color: '#722ed1' }} /> 行业基金分布</Space>} size="small" style={{ borderRadius: 10 }}>
                <ReactECharts option={industryPieOption} style={{ height: 350 }} theme={isDark ? 'dark' : undefined} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card bordered={false} title={<Space><BarChartOutlined style={{ color: '#1677ff' }} /> 行业平均评分</Space>} size="small" style={{ borderRadius: 10 }}>
                <ReactECharts option={{
                  tooltip: { trigger: 'axis' },
                  grid: { left: 100, right: 30, top: 20, bottom: 30 },
                  xAxis: { type: 'value', max: 100 },
                  yAxis: { type: 'category', data: Object.entries(industryStats).sort((a, b) => b[1].avgScore - a[1].avgScore).map(([name]) => name), inverse: true },
                  series: [{
                    type: 'bar',
                    data: Object.entries(industryStats).sort((a, b) => b[1].avgScore - a[1].avgScore).map(([, s]) => ({ value: s.avgScore, itemStyle: { color: s.avgScore >= 70 ? '#52c41a' : s.avgScore >= 50 ? '#1677ff' : '#faad14' } })),
                    barWidth: 16,
                    label: { show: true, position: 'right', formatter: '{c}分', fontSize: 11 },
                  }],
                }} style={{ height: 350 }} theme={isDark ? 'dark' : undefined} />
              </Card>
            </Col>
          </Row>
          <Card bordered={false} title={<Space><FundOutlined style={{ color: '#faad14' }} /> 行业详情</Space>} size="small" style={{ borderRadius: 10 }}>
            <Table
              dataSource={Object.entries(industryStats).map(([name, s]) => ({ industry: name, ...s }))}
              rowKey="industry"
              size="small"
              pagination={false}
              columns={[
                { title: '行业', dataIndex: 'industry', width: 100 },
                { title: '入选基金数', dataIndex: 'count', width: 100, sorter: (a: any, b: any) => a.count - b.count },
                { title: '平均评分', dataIndex: 'avgScore', width: 100, sorter: (a: any, b: any) => a.avgScore - b.avgScore, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 70 ? '#52c41a' : v >= 50 ? '#1677ff' : '#faad14' }}>{v}</span> },
                { title: '平均收益', dataIndex: 'avgReturn', width: 100, sorter: (a: any, b: any) => a.avgReturn - b.avgReturn, render: (v: number) => <span style={{ color: getReturnColor(v), fontWeight: 500 }}>{formatReturn(v)}</span> },
                { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" type="link" onClick={() => { setFilters(f => ({ ...f, industry: r.industry })); setActiveTab('rank'); handleRank(); }}>查看基金</Button> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );

  // Tab3: 市场环境
  const marketTab = (
    <div>
      {marketLoading ? <Spin size="large" style={{ display: 'block', margin: '60px auto' }} /> : !marketData ? <Empty description="暂无市场数据" /> : (
        <>
          {/* 主要指数 */}
          <Card bordered={false} title={<Space><GlobalOutlined style={{ color: '#1677ff' }} /> 主要指数估值</Space>} size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
            <Row gutter={16}>
              {marketData.indices.map((idx: any) => (
                <Col xs={12} sm={8} md={4} key={idx.code}>
                  <Card size="small" bordered={false} style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{idx.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: idx.change_percent > 0 ? '#cf1322' : idx.change_percent < 0 ? '#3f8600' : '#666' }}>{idx.price}</div>
                    <div style={{ fontSize: 12, color: idx.change_percent > 0 ? '#cf1322' : idx.change_percent < 0 ? '#3f8600' : '#999' }}>{idx.change_percent > 0 ? '+' : ''}{idx.change_percent}%</div>
                    <div style={{ marginTop: 4 }}>
                      <Tag color={idx.valuation === '低估' ? 'green' : idx.valuation === '合理' ? 'blue' : idx.valuation === '高估' ? 'red' : 'default'} style={{ fontSize: 11 }}>{idx.valuation}</Tag>
                    </div>
                    {idx.pe && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>PE: {idx.pe} | PB: {idx.pb}</div>}
                    {idx.pe_percentile && <div style={{ fontSize: 11, color: '#999' }}>PE分位: {(Number(idx.pe_percentile) * 100).toFixed(0)}%</div>}
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 市场情绪 */}
          {marketData.sentiment && (
            <Card bordered={false} title={<Space><StockOutlined style={{ color: '#eb2f96' }} /> 市场情绪指标</Space>} size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
              <Row gutter={16}>
                {[
                  { title: '近1周上涨比', value: marketData.sentiment.upRatio1w, suffix: '%', color: marketData.sentiment.upRatio1w > 60 ? '#52c41a' : marketData.sentiment.upRatio1w < 40 ? '#ff4d4f' : '#faad14' },
                  { title: '近1月上涨比', value: marketData.sentiment.upRatio1m, suffix: '%', color: marketData.sentiment.upRatio1m > 60 ? '#52c41a' : marketData.sentiment.upRatio1m < 40 ? '#ff4d4f' : '#faad14' },
                  { title: '近3月上涨比', value: marketData.sentiment.upRatio3m, suffix: '%', color: marketData.sentiment.upRatio3m > 60 ? '#52c41a' : marketData.sentiment.upRatio3m < 40 ? '#ff4d4f' : '#faad14' },
                  { title: '近1周均收益', value: Number(marketData.sentiment.avgReturn1w || 0).toFixed(2), suffix: '%', color: Number(marketData.sentiment.avgReturn1w) > 0 ? '#cf1322' : '#3f8600' },
                  { title: '近1月均收益', value: Number(marketData.sentiment.avgReturn1m || 0).toFixed(2), suffix: '%', color: Number(marketData.sentiment.avgReturn1m) > 0 ? '#cf1322' : '#3f8600' },
                  { title: '近3月均收益', value: Number(marketData.sentiment.avgReturn3m || 0).toFixed(2), suffix: '%', color: Number(marketData.sentiment.avgReturn3m) > 0 ? '#cf1322' : '#3f8600' },
                ].map((s, i) => (
                  <Col xs={8} sm={4} key={i}>
                    <Card size="small" bordered={false} style={{ textAlign: 'center', borderRadius: 8 }}>
                      <Statistic title={s.title} value={s.value} suffix={s.suffix} valueStyle={{ color: s.color, fontSize: 18, fontWeight: 700 }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* 板块涨幅 */}
          {marketData.sectors && marketData.sectors.length > 0 && (
            <Card bordered={false} title={<Space><BarChartOutlined style={{ color: '#faad14' }} /> 板块涨跌幅</Space>} size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
              <ReactECharts option={{
                tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>涨跌：${p[0].value}%` },
                grid: { left: 100, right: 30, top: 10, bottom: 30 },
                xAxis: { type: 'value', name: '%' },
                yAxis: { type: 'category', data: marketData.sectors.slice(0, 15).map((s: any) => s.name), inverse: true },
                series: [{
                  type: 'bar',
                  data: marketData.sectors.slice(0, 15).map((s: any) => ({ value: s.change_percent, itemStyle: { color: s.change_percent > 0 ? '#cf1322' : '#3f8600' } })),
                  barWidth: 14,
                  label: { show: true, position: 'right', formatter: '{c}%', fontSize: 11 },
                }],
              }} style={{ height: Math.max(300, marketData.sectors.slice(0, 15).length * 28) }} theme={isDark ? 'dark' : undefined} />
            </Card>
          )}

          {/* 行业估值分布 */}
          {marketData.industryValuation && marketData.industryValuation.length > 0 && (
            <Card bordered={false} title={<Space><PieChartOutlined style={{ color: '#722ed1' }} /> 行业估值分布</Space>} size="small" style={{ borderRadius: 10 }}>
              <Table
                dataSource={marketData.industryValuation}
                rowKey="industry"
                size="small"
                pagination={false}
                columns={[
                  { title: '行业', dataIndex: 'industry', width: 80 },
                  { title: '基金数', dataIndex: 'fundCount', width: 60 },
                  { title: '低估', dataIndex: 'lowCount', width: 50, render: (v: number) => <Tag color="green">{v}</Tag> },
                  { title: '合理', dataIndex: 'fairCount', width: 50, render: (v: number) => <Tag color="blue">{v}</Tag> },
                  { title: '高估', dataIndex: 'highCount', width: 50, render: (v: number) => <Tag color="red">{v}</Tag> },
                  { title: '平均收益', dataIndex: 'avgReturn1y', width: 80, sorter: (a: any, b: any) => a.avgReturn1y - b.avgReturn1y, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                  { title: '估值状态', width: 100, render: (_: any, r: any) => {
                    const ratio = r.fundCount > 0 ? r.lowCount / r.fundCount : 0;
                    return ratio > 0.4 ? <Tag color="green">整体低估</Tag> : ratio > 0.2 ? <Tag color="blue">估值合理</Tag> : <Tag color="orange">偏高估</Tag>;
                  }},
                ]}
              />
            </Card>
          )}
        </>
      )}
    </div>
  );

  // Tab4: 策略对比
  const strategyTab = (
    <div>
      {strategyLoading ? <Spin size="large" style={{ display: 'block', margin: '60px auto' }} /> : !strategyData ? <Empty description="暂无策略对比数据" /> : (
        <>
          {/* 策略概览 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {Object.entries(strategyData.strategies).map(([name, s]: any) => {
              const strat = STRATEGIES.find(st => st.value === name);
              const colors: Record<string, string> = { aggressive: '#ff4d4f', balanced: '#1677ff', conservative: '#52c41a', value: '#faad14' };
              return (
                <Col xs={12} sm={6} key={name}>
                  <Card size="small" bordered={false} style={{ borderRadius: 10, border: `1px solid ${colors[name]}30` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ color: colors[name] }}>{strat?.icon}</span>
                      <Text strong style={{ fontSize: 13 }}>{strat?.label || name}</Text>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: colors[name] }}>{s.avgScore}<span style={{ fontSize: 12, color: '#999' }}>分</span></div>
                    <div style={{ fontSize: 12, color: '#999' }}>均收益 {formatReturn(s.avgReturn)}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Top1: {s.top1Name.slice(0, 8)}</div>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* 对比图表 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card bordered={false} title={<Space><BarChartOutlined style={{ color: '#1677ff' }} /> 策略评分与收益对比</Space>} size="small" style={{ borderRadius: 10 }}>
                <ReactECharts option={strategyBarOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card bordered={false} title={<Space><AimOutlined style={{ color: '#722ed1' }} /> 策略雷达图</Space>} size="small" style={{ borderRadius: 10 }}>
                <ReactECharts option={strategyRadarOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
              </Card>
            </Col>
          </Row>

          {/* 策略重叠度 */}
          {strategyData.overlap && (
            <Card bordered={false} title={<Space><FundOutlined style={{ color: '#eb2f96' }} /> 策略重叠度分析</Space>} size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>不同策略选出的Top10基金之间的重叠程度，重叠越高说明策略越相似</Text>
              <Row gutter={16}>
                {Object.entries(strategyData.overlap).map(([key, o]: any) => {
                  const [a, b] = key.split('_');
                  const labels: Record<string, string> = { aggressive: '激进', balanced: '均衡', conservative: '稳健', value: '价值' };
                  return (
                    <Col xs={12} sm={6} key={key}>
                      <Card size="small" bordered={false} style={{ textAlign: 'center', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa' }}>
                        <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>{labels[a]} vs {labels[b]}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: o.rate > 50 ? '#ff4d4f' : o.rate > 20 ? '#faad14' : '#52c41a' }}>{o.common}<span style={{ fontSize: 12, color: '#999' }}>只</span></div>
                        <Progress percent={o.rate} size="small" strokeColor={o.rate > 50 ? '#ff4d4f' : o.rate > 20 ? '#faad14' : '#52c41a'} format={() => `${o.rate}%`} />
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Card>
          )}

          {/* 各策略Top基金 */}
          {Object.entries(strategyData.strategies).map(([name, s]: any) => {
            const strat = STRATEGIES.find(st => st.value === name);
            const colors: Record<string, string> = { aggressive: '#ff4d4f', balanced: '#1677ff', conservative: '#52c41a', value: '#faad14' };
            return (
              <Card key={name} bordered={false} title={<Space><span style={{ color: colors[name] }}>{strat?.icon}</span> {strat?.label || name} Top基金</Space>} size="small" style={{ marginBottom: 12, borderRadius: 10 }}>
                <Table
                  dataSource={s.topFunds}
                  rowKey="code"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '排名', width: 50, render: (_: any, __: any, i: number) => i + 1 },
                    { title: '基金', dataIndex: 'name', render: (v: string, r: any) => <a onClick={() => navigate(`/funds/${r.code}`)}>{v}</a> },
                    { title: '行业', dataIndex: 'industry', width: 80 },
                    { title: '评分', dataIndex: 'score', width: 70, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 70 ? '#52c41a' : '#1677ff' }}>{v}</span> },
                    { title: '近1年', dataIndex: 'return1y', width: 70, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                    { title: '费率', dataIndex: 'totalFee', width: 60, render: (v: number) => `${v}%` },
                  ]}
                />
              </Card>
            );
          })}
        </>
      )}
    </div>
  );

  // Tab5: 深度分析
  const deepTab = (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>基金代码（逗号分隔，留空则分析Top5）：</Text>
          <Select
            mode="tags"
            placeholder="输入基金代码"
            style={{ width: 300 }}
            value={deepCodes ? deepCodes.split(',').filter(Boolean) : []}
            onChange={(vals) => setDeepCodes(vals.join(','))}
          />
          <Button type="primary" icon={<ExperimentOutlined />} loading={deepLoading} onClick={handleDeepAnalysis}>开始分析</Button>
          {results.length > 0 && <Button onClick={() => { setDeepCodes(results.slice(0, 5).map(r => r.fund.code).join(',')); }}>使用当前Top5</Button>}
        </Space>
      </Card>

      {deepLoading ? <Spin size="large" style={{ display: 'block', margin: '60px auto' }} /> : !deepData || deepData.results.length === 0 ? <Empty description="请输入基金代码进行深度分析" /> : (
        <>
          {/* 指标概览 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {deepData.results.map((item: any) => (
              <Col xs={24} sm={12} lg={8} key={item.code}>
                <Card bordered={false} size="small" style={{ borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <a onClick={() => navigate(`/funds/${item.code}`)} style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</a>
                      <div style={{ fontSize: 12, color: '#999' }}>{item.code} · {item.industry} · {item.manager}</div>
                    </div>
                    <Tag color={item.metrics.sharpe > 1 ? 'green' : item.metrics.sharpe > 0.5 ? 'blue' : 'orange'}>夏普 {item.metrics.sharpe}</Tag>
                  </div>
                  <Row gutter={[8, 8]}>
                    {[
                      { label: '年化收益', value: `${item.metrics.annualizedReturn}%`, color: getReturnColor(item.metrics.annualizedReturn) },
                      { label: '年化波动', value: `${item.metrics.annualizedVol}%`, color: '#666' },
                      { label: '最大回撤', value: `${item.metrics.maxDrawdown}%`, color: '#ff4d4f' },
                      { label: '卡玛比率', value: item.metrics.calmar, color: '#1677ff' },
                      { label: '索提诺', value: item.metrics.sortino, color: '#722ed1' },
                      { label: '胜率', value: `${item.metrics.winRate}%`, color: '#52c41a' },
                      { label: '盈亏比', value: item.metrics.profitLossRatio, color: '#faad14' },
                      { label: '连跌天数', value: item.metrics.maxConsecutiveDown, color: '#ff4d4f' },
                    ].map((m, i) => (
                      <Col span={6} key={i}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#999' }}>{m.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Card>
              </Col>
            ))}
          </Row>

          {/* 雷达图 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {deepData.results.map((item: any) => (
              <Col xs={24} sm={12} key={item.code}>
                <Card bordered={false} title={<Space><AimOutlined /> {item.name} 风险指标雷达</Space>} size="small" style={{ borderRadius: 10, marginBottom: 8 }}>
                  <ReactECharts option={deepRadarOption(item)} style={{ height: 250 }} theme={isDark ? 'dark' : undefined} />
                </Card>
              </Col>
            ))}
          </Row>

          {/* 月度收益 */}
          {deepData.results.map((item: any) => (
            <Card key={item.code} bordered={false} title={<Space><LineChartOutlined /> {item.name} 月度收益走势</Space>} size="small" style={{ marginBottom: 12, borderRadius: 10 }}>
              <ReactECharts option={{
                tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].axisValue}<br/>收益：${p[0].value}%` },
                grid: { left: 50, right: 20, top: 20, bottom: 30 },
                xAxis: { type: 'category', data: item.monthlyReturns.map((m: any) => m.month) },
                yAxis: { type: 'value', name: '%' },
                series: [{
                  type: 'bar',
                  data: item.monthlyReturns.map((m: any) => ({ value: m.return, itemStyle: { color: m.return > 0 ? '#cf1322' : '#3f8600' } })),
                  barWidth: 20,
                }],
              }} style={{ height: 200 }} theme={isDark ? 'dark' : undefined} />
            </Card>
          ))}
        </>
      )}
    </div>
  );

  // Tab6: 量化精选
  const quantTab = (
    <div>
      {quantLoading ? <Spin size="large" style={{ display: 'block', margin: '60px auto' }} /> : !quantData ? <Empty description="暂无量化精选数据" /> : (
        <>
          {/* 筛选条件 */}
          <Card size="small" style={{ marginBottom: 16, background: isDark ? 'linear-gradient(135deg, #0d2818, #1a1a2e)' : 'linear-gradient(135deg, #f6ffed, #f0fff0)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <SafetyOutlined style={{ color: '#52c41a', fontSize: 16 }} />
              <Text strong>量化精选筛选条件：</Text>
              {Object.entries(quantData.criteria).map(([k, v]) => (
                <Tag key={k} color="green" style={{ borderRadius: 4 }}>{k === 'minReturn1y' ? '年化收益' : k === 'minReturn3m' ? '近3月' : k === 'maxFee' ? '费率' : k === 'minScale' ? '规模' : '评级'} {String(v)}</Tag>
              ))}
              <Tag color="blue">扫描 {quantData.totalScanned} 只 → 通过 {quantData.passedFilter} 只 → 精选 20 只</Tag>
            </div>
          </Card>

          {/* 统计概览 */}
          <Row gutter={16} style={{ marginBottom: 16 }}>
            {[
              { title: '扫描总数', value: quantData.totalScanned, suffix: '只', color: '#1677ff' },
              { title: '通过筛选', value: quantData.passedFilter, suffix: '只', color: '#52c41a' },
              { title: '精选Top20均分', value: (quantData.picks.reduce((s: number, p: any) => s + (Number(p.score) || 0), 0) / quantData.picks.length).toFixed(1), suffix: '分', color: '#faad14' },
              { title: '覆盖行业', value: Object.keys(quantData.industryStats).length, suffix: '个', color: '#722ed1' },
            ].map((s, i) => (
              <Col xs={12} sm={6} key={i}>
                <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
                  <Statistic title={s.title} value={s.value} suffix={s.suffix} valueStyle={{ color: s.color, fontWeight: 700 }} />
                </Card>
              </Col>
            ))}
          </Row>

          {/* 因子得分对比 */}
          {quantFactorOption && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={24} lg={14}>
                <Card bordered={false} title={<Space><BarChartOutlined style={{ color: '#1677ff' }} /> Top5 因子得分对比</Space>} size="small" style={{ borderRadius: 10 }}>
                  <ReactECharts option={quantFactorOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card bordered={false} title={<Space><PieChartOutlined style={{ color: '#722ed1' }} /> 行业分布</Space>} size="small" style={{ borderRadius: 10 }}>
                  <ReactECharts option={quantIndustryPieOption} style={{ height: 300 }} theme={isDark ? 'dark' : undefined} />
                </Card>
              </Col>
            </Row>
          )}

          {/* 精选列表 */}
          <Card bordered={false} title={<Space><TrophyOutlined style={{ color: '#faad14' }} /> 量化精选 Top20</Space>} size="small" style={{ borderRadius: 10 }}>
            <Table
              dataSource={quantData.picks}
              rowKey="code"
              size="small"
              pagination={false}
              scroll={{ x: 1000 }}
              columns={[
                { title: '排名', width: 50, render: (_: any, __: any, i: number) => <span style={{ fontWeight: 600, color: i < 3 ? '#faad14' : undefined }}>{i < 3 ? <TrophyOutlined /> : null} {i + 1}</span> },
                { title: '基金名称', dataIndex: 'name', width: 160, render: (v: string, r: any) => <a onClick={() => navigate(`/funds/${r.code}`)} style={{ fontWeight: 500 }}>{v}</a> },
                { title: '代码', dataIndex: 'code', width: 70 },
                { title: '行业', dataIndex: 'industry', width: 70 },
                { title: '评分', dataIndex: 'score', width: 80, sorter: (a: any, b: any) => a.score - b.score, render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 70 ? '#52c41a' : '#1677ff'} format={() => <b>{v}</b>} /> },
                { title: '近1年', dataIndex: 'return1y', width: 70, render: (v: number) => <span style={{ color: getReturnColor(v), fontWeight: 500 }}>{formatReturn(v)}</span> },
                { title: '近6月', dataIndex: 'return6m', width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                { title: '近3月', dataIndex: 'return3m', width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                { title: '费率', dataIndex: 'totalFee', width: 60, render: (v: number) => `${Number(v || 0)}%` },
                { title: '规模(亿)', dataIndex: 'scale', width: 65, render: (v: number) => Number(v || 0).toFixed(1) },
                { title: '因子得分', width: 180, render: (_: any, r: any) => (
                  <div style={{ display: 'flex', gap: 2, height: 16, alignItems: 'flex-end' }}>
                    {['return', 'fee', 'scale', 'momentum', 'stability', 'valuation'].map((k, i) => {
                      const colors = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];
                      return <Tooltip key={k} title={`${k}: ${r.breakdown[k] || 0}分`}><div style={{ flex: 1, height: `${Math.max(2, (r.breakdown[k] || 0) / 100 * 16)}px`, background: colors[i], borderRadius: 1 }} /></Tooltip>;
                    })}
                  </div>
                ) },
                { title: '推荐理由', dataIndex: 'reasoning', ellipsis: true, width: 200 },
                { title: '操作', width: 60, render: (_: any, r: any) => <Tooltip title={watchedCodes.has(r.code) ? '取消自选' : '加自选'}><Button type="text" size="small" icon={watchedCodes.has(r.code) ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={(e) => toggleWatchlist(r.code, e)} /></Tooltip> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );

  // Tab7: 投资组合
  const portfolioTab = (
    <div>
      <Card bordered={false} title={<Space><WalletOutlined style={{ color: '#1677ff' }} /> 一键建仓建议</Space>} size="small" style={{ borderRadius: 10 }}>
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
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
                { title: '基金', dataIndex: 'name', render: (v: string, r: any) => <a onClick={() => navigate(`/funds/${r.code}`)}>{v}</a> },
                { title: '代码', dataIndex: 'code', width: 70 },
                { title: '行业', dataIndex: 'industry', width: 70 },
                { title: '评分', dataIndex: 'score', width: 60, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 70 ? '#52c41a' : v >= 50 ? '#1677ff' : '#faad14' }}>{v}</span> },
                { title: '近1年', dataIndex: 'return1y', width: 70, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                { title: '近6月', dataIndex: 'return6m', width: 65, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                { title: '费率', dataIndex: 'totalFee', width: 70, render: (v: number, r: any) => (
                  <Tooltip title={`管理费 ${r.mgmtFee}% + 托管费 ${r.custodyFee}%`}>
                    <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>{v}%</span>
                  </Tooltip>
                ) },
                { title: '建议金额', dataIndex: 'amount', width: 90, render: (v: number) => `¥${v?.toLocaleString()}` },
                { title: '权重', dataIndex: 'weight', width: 60, render: (v: number) => `${v}%` },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );

  const tabItems = [
    { key: 'rank', label: <span><BarChartOutlined /> 多因子排名</span>, children: rankTab },
    { key: 'industry', label: <span><PieChartOutlined /> 行业洞察</span>, children: industryTab },
    { key: 'market', label: <span><GlobalOutlined /> 市场环境</span>, children: marketTab },
    { key: 'strategy', label: <span><FundProjectionScreenOutlined /> 策略对比</span>, children: strategyTab },
    { key: 'deep', label: <span><ExperimentOutlined /> 深度分析</span>, children: deepTab },
    { key: 'quant', label: <span><DashboardOutlined /> 量化精选</span>, children: quantTab },
    { key: 'portfolio', label: <span><WalletOutlined /> 投资组合</span>, children: portfolioTab },
  ];

  return (
    <div>
      {/* Hero 头部 */}
      <Card bordered={false} style={{
        marginBottom: 16,
        background: isDark
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '30%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <Row align="middle" gutter={24}>
          <Col flex="auto">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}>
                <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />
              </div>
              <div>
                <Title level={3} style={{ color: '#fff', margin: 0, lineHeight: 1.2 }}>AI 智能选股引擎</Title>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>多因子量化模型 · 策略化筛选 · 回测验证 · 一键建仓</Text>
              </div>
            </div>
          </Col>
          <Col>
            <Space size={8}>
              {STRATEGIES.map(s => (
                <Button key={s.value} size="small" ghost={strategy !== s.value}
                  type={strategy === s.value ? 'primary' : 'default'}
                  icon={s.icon}
                  onClick={() => handleStrategyChange(s.value)}
                  style={{
                    borderColor: strategy === s.value ? '#fff' : 'rgba(255,255,255,0.3)',
                    color: strategy === s.value ? '#fff' : 'rgba(255,255,255,0.8)',
                    background: strategy === s.value ? 'rgba(255,255,255,0.15)' : 'transparent',
                  }}>
                  {s.label}
                </Button>
              ))}
            </Space>
          </Col>
        </Row>
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
          {STRATEGIES.find(s => s.value === strategy)?.desc}
        </div>
      </Card>

      {/* 主内容区 - Tabs */}
      <Card bordered={false} style={{ borderRadius: 10 }}>
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
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
                { title: '评分', dataIndex: 'score', width: 60, render: (v: number) => <span style={{ fontWeight: 600, color: v >= 70 ? '#52c41a' : v >= 50 ? '#1677ff' : '#faad14' }}>{v}</span> },
                { title: '近1年', dataIndex: 'return1y', width: 70, render: (v: number) => <span style={{ color: getReturnColor(v) }}>{formatReturn(v)}</span> },
                { title: '费率', dataIndex: 'totalFee', width: 70, render: (v: number, r: any) => (
                  <Tooltip title={`管理费 ${r.mgmtFee}% + 托管费 ${r.custodyFee}%`}>
                    <span style={{ borderBottom: '1px dashed #999', cursor: 'help' }}>{v}%</span>
                  </Tooltip>
                ) },
                { title: '建议金额', dataIndex: 'amount', width: 90, render: (v: number) => `¥${v?.toLocaleString()}` },
                { title: '权重', dataIndex: 'weight', width: 60, render: (v: number) => `${v}%` },
              ]}
            />
          </>
        )}
      </Modal>

      <div style={{ marginTop: 16, padding: '14px 18px', background: isDark ? 'rgba(250,173,20,0.06)' : 'linear-gradient(135deg, #fffbe6, #fff7e6)', borderRadius: 8, fontSize: 12, color: isDark ? '#a0a0a0' : '#8c8c8c', border: `1px solid ${isDark ? 'rgba(250,173,20,0.12)' : '#ffe7ba'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <SafetyOutlined style={{ color: '#faad14', fontSize: 14 }} />
        <span>评分基于历史数据的量化模型，不代表未来表现。投资有风险，入市需谨慎。本工具仅供参考，不构成投资建议。</span>
      </div>
    </div>
  );
}
