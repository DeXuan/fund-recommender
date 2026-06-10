import { useState } from 'react';
import { Card, InputNumber, Button, Table, Space, Statistic, Row, Col, Tag, Alert, Segmented } from 'antd';
import ReactECharts from 'echarts-for-react';
import { formatCurrency } from '../utils/format';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

type Frequency = 'daily' | 'weekly' | 'monthly';

const FREQ_CONFIG: Record<Frequency, { label: string; amountLabel: string; periodLabel: string; periodsPerYear: number; defaultAmount: number }> = {
  daily:   { label: '每日',  amountLabel: '每日定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 252, defaultAmount: 100 },
  weekly:  { label: '每周',  amountLabel: '每周定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 52,  defaultAmount: 500 },
  monthly: { label: '每月',  amountLabel: '每月定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 12,  defaultAmount: 1000 },
};

// 交易日/月 和 周/月 的近似值
const TRADING_DAYS_PER_MONTH = 22;
const WEEKS_PER_MONTH = 4.33;

interface PeriodDetail {
  index: number;
  investment: number;
  cumulativeInvestment: number;
  value: number;
  returnRate: number;
}

interface DCAResult {
  totalInvestment: number;
  totalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  details: PeriodDetail[];
  totalPeriods: number;
}

function calculateDCA(amount: number, months: number, annualRate: number, freq: Frequency): DCAResult {
  const cfg = FREQ_CONFIG[freq];
  const periodRate = annualRate / 100 / cfg.periodsPerYear;

  let totalPeriods: number;
  if (freq === 'daily') totalPeriods = Math.round(months * TRADING_DAYS_PER_MONTH);
  else if (freq === 'weekly') totalPeriods = Math.round(months * WEEKS_PER_MONTH);
  else totalPeriods = months;

  let totalValue = 0;
  const details: PeriodDetail[] = [];

  for (let i = 0; i < totalPeriods; i++) {
    totalValue = (totalValue + amount) * (1 + periodRate);
    const cumulativeInvestment = amount * (i + 1);
    details.push({
      index: i + 1,
      investment: amount,
      cumulativeInvestment,
      value: parseFloat(totalValue.toFixed(2)),
      returnRate: parseFloat((((totalValue - cumulativeInvestment) / cumulativeInvestment) * 100).toFixed(2)),
    });
  }

  const totalInvestment = amount * totalPeriods;
  const totalReturn = totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0;
  const years = months / 12;
  const annualizedReturn = years > 0 ? (Math.pow(totalValue / totalInvestment, 1 / years) - 1) * 100 : 0;

  return {
    totalInvestment,
    totalValue: parseFloat(totalValue.toFixed(2)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
    details,
    totalPeriods,
  };
}

export default function DCACalculator() {
  const { isDark } = useTheme();
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [amount, setAmount] = useState(1000);
  const [period, setPeriod] = useState(36);
  const [expectedReturn, setExpectedReturn] = useState(10);
  const [result, setResult] = useState<DCAResult | null>(null);

  const cfg = FREQ_CONFIG[frequency];

  const handleFrequencyChange = (val: Frequency) => {
    setFrequency(val);
    setAmount(FREQ_CONFIG[val].defaultAmount);
    setResult(null);
  };

  const handleCalculate = () => {
    const data = calculateDCA(amount, period, expectedReturn, frequency);
    setResult(data);
  };

  // 采样：detail 数据过多时按月采样，保证图表流畅
  const sampleDetails = (details: PeriodDetail[]) => {
    if (frequency === 'monthly' || details.length <= 120) return details;
    // 按月采样：每月取最后一天/一周的数据
    const step = frequency === 'daily' ? TRADING_DAYS_PER_MONTH : Math.round(WEEKS_PER_MONTH);
    const sampled: PeriodDetail[] = [];
    for (let i = step - 1; i < details.length; i += step) {
      sampled.push(details[i]);
    }
    // 确保包含最后一条
    if (sampled[sampled.length - 1] !== details[details.length - 1]) {
      sampled.push(details[details.length - 1]);
    }
    return sampled;
  };

  const chartOption = result ? (() => {
    const sampled = sampleDetails(result.details);
    const xLabels = sampled.map((_, i) => {
      if (frequency === 'monthly') return `第${i + 1}月`;
      if (frequency === 'weekly') return `第${i + 1}月`;
      return `第${i + 1}月`;
    });
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let s = `${params[0].axisValue}<br/>`;
          params.forEach((p: any) => { s += `${p.seriesName}: ¥${p.value.toLocaleString()}<br/>`; });
          return s;
        },
      },
      legend: { data: ['累计投入', '资产市值'] },
      xAxis: { type: 'category', data: xLabels },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `¥${(v / 10000).toFixed(1)}万` } },
      series: [
        {
          name: '累计投入',
          type: 'line',
          data: sampled.map(d => d.cumulativeInvestment),
          lineStyle: { color: '#1677ff', width: 2 },
          itemStyle: { color: '#1677ff' },
          areaStyle: { color: 'rgba(22,119,255,0.1)' },
        },
        {
          name: '资产市值',
          type: 'line',
          data: sampled.map(d => d.value),
          lineStyle: { color: '#52c41a', width: 2 },
          itemStyle: { color: '#52c41a' },
          areaStyle: { color: 'rgba(82,196,26,0.1)' },
        },
      ],
      grid: { top: 40, right: 20, bottom: 30, left: 80 },
    };
  })() : null;

  // 表格按月汇总（daily/weekly 时聚合为月度视图）
  const monthlySummary = result ? (() => {
    if (frequency === 'monthly') return result.details;
    const daysPerPeriod = frequency === 'daily' ? TRADING_DAYS_PER_MONTH : Math.round(WEEKS_PER_MONTH);
    const months: PeriodDetail[] = [];
    for (let m = 0; m < period; m++) {
      const startIdx = m * daysPerPeriod;
      const endIdx = Math.min(startIdx + daysPerPeriod, result.details.length);
      if (startIdx >= result.details.length) break;
      const lastInMonth = result.details[endIdx - 1];
      months.push({
        index: m + 1,
        investment: lastInMonth.investment * (endIdx - startIdx),
        cumulativeInvestment: lastInMonth.cumulativeInvestment,
        value: lastInMonth.value,
        returnRate: lastInMonth.returnRate,
      });
    }
    return months;
  })() : [];

  const columns = [
    { title: '月份', dataIndex: 'index', key: 'index', render: (v: number) => `第 ${v} 个月` },
    { title: '当月投入', dataIndex: 'investment', key: 'investment', render: (v: number) => formatCurrency(v) },
    { title: '累计投入', dataIndex: 'cumulativeInvestment', key: 'cumulativeInvestment', render: (v: number) => formatCurrency(v) },
    { title: '资产市值', dataIndex: 'value', key: 'value', render: (v: number) => formatCurrency(v) },
    {
      title: '收益率',
      dataIndex: 'returnRate',
      key: 'returnRate',
      render: (v: number) => <span style={{ color: v >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>,
    },
  ];

  const quickPlans = [
    { label: '每日定投（沪深300）', desc: '每天50元 × 3年，预期年化8%', freq: 'daily' as Frequency, amount: 50, p: 36, r: 8 },
    { label: '每周定投（科技主题）', desc: '每周200元 × 3年，预期年化12%', freq: 'weekly' as Frequency, amount: 200, p: 36, r: 12 },
    { label: '每月定投（成长股）', desc: '每月2000元 × 2年，预期年化15%', freq: 'monthly' as Frequency, amount: 2000, p: 24, r: 15 },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>定投计算器</h1>

      <Card title="定投参数" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontWeight: 500, marginRight: 12 }}>定投频率：</span>
          <Segmented
            value={frequency}
            onChange={(val) => handleFrequencyChange(val as Frequency)}
            options={[
              { label: '每日', value: 'daily' },
              { label: '每周', value: 'weekly' },
              { label: '每月', value: 'monthly' },
            ]}
          />
        </div>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{cfg.amountLabel}</div>
            <InputNumber
              value={amount}
              onChange={(v) => setAmount(v || cfg.defaultAmount)}
              min={1}
              step={frequency === 'daily' ? 10 : frequency === 'weekly' ? 50 : 100}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{cfg.periodLabel}</div>
            <InputNumber value={period} onChange={(v) => setPeriod(v || 36)} min={1} max={120} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>预期年化收益率（%）</div>
            <InputNumber value={expectedReturn} onChange={(v) => setExpectedReturn(v || 10)} min={-50} max={100} step={0.5} style={{ width: '100%' }} />
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <span style={{ color: isDark ? '#a0a0a0' : '#666', marginRight: 12 }}>快捷设置：</span>
          <Space>
            <Tag style={{ cursor: 'pointer' }} onClick={() => { setFrequency('monthly'); setAmount(500); setPeriod(12); setExpectedReturn(8); }}>保守型</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => { setFrequency('monthly'); setAmount(1000); setPeriod(36); setExpectedReturn(10); }}>稳健型</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => { setFrequency('monthly'); setAmount(2000); setPeriod(60); setExpectedReturn(15); }}>激进型</Tag>
          </Space>
        </div>

        <Button type="primary" onClick={handleCalculate} style={{ marginTop: 16 }} size="large">
          开始计算
        </Button>
      </Card>

      {result && (
        <>
          <Card title="计算结果" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic title="总投入" value={result.totalInvestment} precision={2} prefix="¥" />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总资产" value={result.totalValue} precision={2} prefix="¥" valueStyle={{ color: '#1677ff' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总收益" value={result.totalValue - result.totalInvestment} precision={2} prefix="¥" valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总收益率" value={result.totalReturn} precision={2} suffix="%" valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="年化收益率" value={result.annualizedReturn} precision={2} suffix="%" valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="定投期数" value={result.totalPeriods} suffix={frequency === 'daily' ? '天' : frequency === 'weekly' ? '周' : '个月'} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="定投频率" value={cfg.label} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="每期金额" value={amount} precision={0} prefix="¥" />
              </Col>
            </Row>
          </Card>

          {chartOption && (
            <Card title="收益曲线（按月采样）" style={{ marginBottom: 16 }}>
              <ReactECharts theme={getEchartsTheme(isDark)} option={chartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
            </Card>
          )}

          <Card title="月度明细" style={{ marginBottom: 16 }}>
            <Table
              columns={columns}
              dataSource={monthlySummary}
              rowKey="index"
              pagination={{ pageSize: 12 }}
              size="small"
              summary={() => (
                <Table.Summary.Row style={{ fontWeight: 600, background: isDark ? '#1f1f1f' : '#f5f5f5' }}>
                  <Table.Summary.Cell index={0}>最终</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>{formatCurrency(result.totalInvestment)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{formatCurrency(result.totalInvestment)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>{formatCurrency(result.totalValue)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <span style={{ color: result.totalReturn >= 0 ? '#ff4d4f' : '#52c41a' }}>
                      {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                    </span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>

          <Alert
            type="info"
            message="定投建议"
            description={
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                <li>坚持长期投资，至少3年以上</li>
                <li>市场下跌时不要停止定投，反而是低成本买入的机会</li>
                <li>设置止盈点，达到目标收益后可分批止盈</li>
                <li>选择C类基金适合短期持有，A类基金适合长期持有</li>
                {frequency === 'daily' && <li>每日定投适合资金充裕、希望平滑波动的投资者</li>}
                {frequency === 'weekly' && <li>每周定投兼顾平滑波动和操作便利，适合工薪族</li>}
              </ul>
            }
          />
        </>
      )}

      <Card title="热门定投方案" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {quickPlans.map((plan) => (
            <Col xs={24} sm={8} key={plan.label}>
              <Card
                hoverable
                size="small"
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => { setFrequency(plan.freq); setAmount(plan.amount); setPeriod(plan.p); setExpectedReturn(plan.r); setResult(null); }}
              >
                <strong>{plan.label}</strong>
                <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginTop: 8 }}>{plan.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
