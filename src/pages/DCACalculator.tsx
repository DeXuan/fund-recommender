import { useState } from 'react';
import { Card, InputNumber, Button, Table, Space, Statistic, Row, Col, Tag, Alert } from 'antd';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
import { formatCurrency } from '../utils/format';

interface DCAResult {
  totalInvestment: number;
  totalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  monthlyDetails: {
    month: number;
    investment: number;
    cumulativeInvestment: number;
    value: number;
    return: number;
  }[];
}

export default function DCACalculator() {
  const [monthlyAmount, setMonthlyAmount] = useState(1000);
  const [period, setPeriod] = useState(36);
  const [expectedReturn, setExpectedReturn] = useState(10);
  const [result, setResult] = useState<DCAResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const data = await fundApi.calculateDCA({ monthlyAmount, period, expectedReturn });
      setResult(data);
    } catch (error) {
      console.error('计算失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const chartOption = result ? {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let s = `${params[0].axisValue}<br/>`;
        params.forEach((p: any) => { s += `${p.seriesName}: ¥${p.value.toLocaleString()}<br/>`; });
        return s;
      },
    },
    legend: { data: ['累计投入', '资产市值'] },
    xAxis: { type: 'category', data: result.monthlyDetails.map(d => `第${d.month}月`) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => `¥${(v / 10000).toFixed(1)}万` } },
    series: [
      {
        name: '累计投入',
        type: 'line',
        data: result.monthlyDetails.map(d => d.cumulativeInvestment),
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
        areaStyle: { color: 'rgba(22,119,255,0.1)' },
      },
      {
        name: '资产市值',
        type: 'line',
        data: result.monthlyDetails.map(d => d.value),
        lineStyle: { color: '#52c41a', width: 2 },
        itemStyle: { color: '#52c41a' },
        areaStyle: { color: 'rgba(82,196,26,0.1)' },
      },
    ],
    grid: { top: 40, right: 20, bottom: 30, left: 80 },
  } : null;

  const columns = [
    { title: '月份', dataIndex: 'month', key: 'month', render: (v: number) => `第 ${v} 个月` },
    { title: '当月投入', dataIndex: 'investment', key: 'investment', render: (v: number) => formatCurrency(v) },
    { title: '累计投入', dataIndex: 'cumulativeInvestment', key: 'cumulativeInvestment', render: (v: number) => formatCurrency(v) },
    { title: '资产市值', dataIndex: 'value', key: 'value', render: (v: number) => formatCurrency(v) },
    {
      title: '收益率',
      dataIndex: 'return',
      key: 'return',
      render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>,
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>定投计算器</h1>

      <Card title="定投参数" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>每月定投金额（元）</div>
            <InputNumber value={monthlyAmount} onChange={(v) => setMonthlyAmount(v || 1000)} min={100} step={100} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>定投期限（月）</div>
            <InputNumber value={period} onChange={(v) => setPeriod(v || 36)} min={1} max={120} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>预期年化收益率（%）</div>
            <InputNumber value={expectedReturn} onChange={(v) => setExpectedReturn(v || 10)} min={0} max={50} step={0.5} style={{ width: '100%' }} />
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <span style={{ color: '#666', marginRight: 12 }}>快捷设置：</span>
          <Space>
            <Tag style={{ cursor: 'pointer' }} onClick={() => { setMonthlyAmount(500); setPeriod(12); setExpectedReturn(8); }}>保守型</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => { setMonthlyAmount(1000); setPeriod(36); setExpectedReturn(10); }}>稳健型</Tag>
            <Tag style={{ cursor: 'pointer' }} onClick={() => { setMonthlyAmount(2000); setPeriod(60); setExpectedReturn(15); }}>激进型</Tag>
          </Space>
        </div>

        <Button type="primary" onClick={handleCalculate} loading={loading} style={{ marginTop: 16 }} size="large">
          开始计算
        </Button>
      </Card>

      {result && (
        <>
          <Card title="计算结果" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={12} sm={8}>
                <Statistic title="总投入" value={result.totalInvestment} precision={2} prefix="¥" />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="总资产" value={result.totalValue} precision={2} prefix="¥" valueStyle={{ color: '#1677ff' }} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="总收益" value={result.totalValue - result.totalInvestment} precision={2} prefix="¥" valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="总收益率" value={result.totalReturn} precision={2} suffix="%" valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="年化收益率" value={result.annualizedReturn} precision={2} suffix="%" valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col xs={12} sm={8}>
                <Statistic title="定投期数" value={period} suffix="个月" />
              </Col>
            </Row>
          </Card>

          {chartOption && (
            <Card title="收益曲线" style={{ marginBottom: 16 }}>
              <ReactECharts option={chartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
            </Card>
          )}

          <Card title="月度明细" style={{ marginBottom: 16 }}>
            <Table
              columns={columns}
              dataSource={result.monthlyDetails}
              rowKey="month"
              pagination={{ pageSize: 12 }}
              size="small"
              summary={() => (
                <Table.Summary.Row style={{ fontWeight: 600, background: '#f5f5f5' }}>
                  <Table.Summary.Cell index={0}>最终</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>{formatCurrency(result.totalInvestment)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{formatCurrency(result.totalInvestment)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>{formatCurrency(result.totalValue)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <span style={{ color: result.totalReturn >= 0 ? '#52c41a' : '#ff4d4f' }}>
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
              </ul>
            }
          />
        </>
      )}

      <Card title="热门定投方案" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {[
            { label: '沪深300定投', desc: '每月500元 × 5年，预期年化8%', amount: 500, p: 60, r: 8 },
            { label: '科技主题定投', desc: '每月1000元 × 3年，预期年化12%', amount: 1000, p: 36, r: 12 },
            { label: '成长股定投', desc: '每月2000元 × 2年，预期年化15%', amount: 2000, p: 24, r: 15 },
          ].map((plan) => (
            <Col xs={24} sm={8} key={plan.label}>
              <Card
                hoverable
                size="small"
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => { setMonthlyAmount(plan.amount); setPeriod(plan.p); setExpectedReturn(plan.r); }}
              >
                <strong>{plan.label}</strong>
                <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>{plan.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
