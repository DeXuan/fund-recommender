import { RiseOutlined, SafetyOutlined, BarChartOutlined, ThunderboltOutlined, AimOutlined, RocketOutlined, FundOutlined } from '@ant-design/icons';

export const FACTOR_META: Record<string, { label: string; desc: string; color: string; icon: React.ReactNode }> = {
  return1y: { label: '收益能力', desc: '近1年收益率，50%以上边际递减', color: '#1677ff', icon: <RiseOutlined /> },
  fee: { label: '成本优势', desc: '综合费率越低，长期持有成本越小', color: '#52c41a', icon: <SafetyOutlined /> },
  scale: { label: '规模稳定', desc: '规模越大流动性越好，清盘风险越低', color: '#faad14', icon: <BarChartOutlined /> },
  momentum: { label: '趋势动量', desc: '近期涨幅加权，捕捉上升趋势', color: '#eb2f96', icon: <ThunderboltOutlined /> },
  valuation: { label: '估值洼地', desc: '当前估值分位越低，安全边际越高', color: '#722ed1', icon: <AimOutlined /> },
};

export const STRATEGIES = [
  { label: '激进进攻', value: 'aggressive', factors: { return1y: 0.40, fee: 0.05, scale: 0.05, momentum: 0.35, valuation: 0.15 }, icon: <RocketOutlined />, desc: '重收益和动量，适合牛市追涨' },
  { label: '均衡配置', value: 'balanced', factors: { return1y: 0.30, fee: 0.15, scale: 0.15, momentum: 0.20, valuation: 0.20 }, icon: <FundOutlined />, desc: '五因子均衡，攻守兼备' },
  { label: '稳健防守', value: 'conservative', factors: { return1y: 0.15, fee: 0.25, scale: 0.25, momentum: 0.10, valuation: 0.25 }, icon: <SafetyOutlined />, desc: '重费率和规模，适合长期定投' },
  { label: '价值猎手', value: 'value', factors: { return1y: 0.20, fee: 0.15, scale: 0.10, momentum: 0.10, valuation: 0.45 }, icon: <AimOutlined />, desc: '重估值，寻找低估机会' },
];

export function getScatterOption(results: any[]) {
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
      data: results.slice(0, 50).map((r: any) => ({
        name: r.fund.name,
        value: [r.fund.totalFee || 0.5, r.fund.return1y || 0, r.fund.scale || 1, r.score],
        itemStyle: { color: r.score >= 70 ? '#52c41a' : r.score >= 50 ? '#1677ff' : '#faad14' },
      })),
      symbolSize: (val: number[]) => Math.max(8, Math.min(40, val[2] / 3)),
    }],
  };
}

export function getIndustryPieOption(industryStats: Record<string, any> | null, isDark: boolean) {
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
}

export function getMomentumOption(results: any[]) {
  const top10 = results.slice(0, 10);
  if (top10.length === 0) return null;
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['近1周', '近1月', '近3月'], top: 0 },
    grid: { left: 100, right: 20, top: 40, bottom: 20 },
    xAxis: { type: 'value', name: '%' },
    yAxis: { type: 'category', data: top10.map((r: any) => r.fund.name.slice(0, 8)), inverse: true },
    series: [
      { name: '近1周', type: 'bar', data: top10.map((r: any) => r.fund.return1w || 0), itemStyle: { color: '#1677ff' } },
      { name: '近1月', type: 'bar', data: top10.map((r: any) => r.fund.return1m || 0), itemStyle: { color: '#52c41a' } },
      { name: '近3月', type: 'bar', data: top10.map((r: any) => r.fund.return3m || 0), itemStyle: { color: '#faad14' } },
    ],
  };
}

export function getBacktestOption(backtestData: any) {
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
}

export function getStrategyRadarOption(strategyData: any) {
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
}

export function getStrategyBarOption(strategyData: any) {
  if (!strategyData) return null;
  const stratNames = Object.keys(strategyData.strategies);
  const stratLabels: Record<string, string> = { aggressive: '激进进攻', balanced: '均衡配置', conservativeGMD: '稳健防守', value: '价值猎手' };
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
}

export function getDeepRadarOption(item: any) {
  return {
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
  };
}

export function getQuantFactorOption(quantData: any) {
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
}

export function getQuantIndustryPieOption(quantData: any, isDark: boolean) {
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
}

export function getRadarOption(item: any, isDark: boolean) {
  return {
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
  };
}
