import { useState } from 'react';
import { Card, Segmented, InputNumber, Row, Col, Tag, Space, Button, Statistic, Table, Alert } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';

const DCA_FREQ_CONFIG: Record<string, { label: string; amountLabel: string; periodLabel: string; periodsPerYear: number; defaultAmount: number }> = {
  daily:   { label: '每日',  amountLabel: '每日定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 252, defaultAmount: 100 },
  weekly:  { label: '每周',  amountLabel: '每周定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 52,  defaultAmount: 500 },
  monthly: { label: '每月',  amountLabel: '每月定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 12,  defaultAmount: 1000 },
};

const TRADING_DAYS_PER_MONTH = 22;
const WEEKS_PER_MONTH = 4.33;

interface Props {
  isDark: boolean;
}

export function DCACalculatorTab({ isDark }: Props) {
  const [dcaFrequency, setDcaFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [dcaAmount, setDcaAmount] = useState(1000);
  const [dcaPeriod, setDcaPeriod] = useState(36);
  const [dcaExpectedReturn, setDcaExpectedReturn] = useState(10);
  const [dcaResult, setDcaResult] = useState<any>(null);
  const [selectedDcaPreset, setSelectedDcaPreset] = useState<string | null>(null);

  const handleDcaFrequencyChange = (val: string) => {
    setDcaFrequency(val as any);
    setDcaAmount(DCA_FREQ_CONFIG[val].defaultAmount);
    setDcaResult(null);
  };

  const handleDcaCalculate = () => {
    const cfg = DCA_FREQ_CONFIG[dcaFrequency];
    const periodRate = dcaExpectedReturn / 100 / cfg.periodsPerYear;

    let totalPeriods: number;
    if (dcaFrequency === 'daily') totalPeriods = Math.round(dcaPeriod * TRADING_DAYS_PER_MONTH);
    else if (dcaFrequency === 'weekly') totalPeriods = Math.round(dcaPeriod * WEEKS_PER_MONTH);
    else totalPeriods = dcaPeriod;

    let totalValue = 0;
    const details: any[] = [];

    for (let i = 0; i < totalPeriods; i++) {
      totalValue = (totalValue + dcaAmount) * (1 + periodRate);
      const cumulativeInvestment = dcaAmount * (i + 1);
      details.push({
        index: i + 1,
        investment: dcaAmount,
        cumulativeInvestment,
        value: parseFloat(totalValue.toFixed(2)),
        returnRate: parseFloat((((totalValue - cumulativeInvestment) / cumulativeInvestment) * 100).toFixed(2)),
      });
    }

    const totalInvestment = dcaAmount * totalPeriods;
    const totalReturn = totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0;
    const years = dcaPeriod / 12;
    const annualizedReturn = years > 0 ? (Math.pow(totalValue / totalInvestment, 1 / years) - 1) * 100 : 0;

    setDcaResult({
      totalInvestment,
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      details,
      totalPeriods,
    });
  };

  return (
    <>
      <Card title="定投参数" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontWeight: 500, marginRight: 12 }}>定投频率：</span>
          <Segmented
            value={dcaFrequency}
            onChange={(val: string | number) => handleDcaFrequencyChange(val as string)}
            options={[
              { label: '每日', value: 'daily' },
              { label: '每周', value: 'weekly' },
              { label: '每月', value: 'monthly' },
            ]}
          />
        </div>

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{DCA_FREQ_CONFIG[dcaFrequency].amountLabel}</div>
            <InputNumber
              value={dcaAmount}
              onChange={(v) => setDcaAmount(v || DCA_FREQ_CONFIG[dcaFrequency].defaultAmount)}
              min={1}
              step={dcaFrequency === 'daily' ? 10 : dcaFrequency === 'weekly' ? 50 : 100}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>{DCA_FREQ_CONFIG[dcaFrequency].periodLabel}</div>
            <InputNumber value={dcaPeriod} onChange={(v) => setDcaPeriod(v || 36)} min={1} max={120} style={{ width: '100%' }} />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>预期年化收益率（%）</div>
            <InputNumber value={dcaExpectedReturn} onChange={(v) => setDcaExpectedReturn(v || 10)} min={-50} max={100} step={0.5} style={{ width: '100%' }} />
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <span style={{ color: isDark ? '#a0a0a0' : '#666', marginRight: 12 }}>快捷设置：</span>
          <Space>
            {[
              { label: '保守型', freq: 'monthly' as const, amount: 500, period: 12, ret: 8 },
              { label: '稳健型', freq: 'monthly' as const, amount: 1000, period: 36, ret: 10 },
              { label: '激进型', freq: 'monthly' as const, amount: 2000, period: 60, ret: 15 },
            ].map(p => (
              <Tag
                key={p.label}
                style={{
                  cursor: 'pointer',
                  border: selectedDcaPreset === p.label ? '2px solid #1677ff' : undefined,
                  background: selectedDcaPreset === p.label ? (isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.06)') : undefined,
                  fontWeight: selectedDcaPreset === p.label ? 600 : undefined,
                  padding: '2px 12px',
                  borderRadius: 12,
                }}
                onClick={() => {
                  setSelectedDcaPreset(p.label);
                  setDcaFrequency(p.freq);
                  setDcaAmount(p.amount);
                  setDcaPeriod(p.period);
                  setDcaExpectedReturn(p.ret);
                  setDcaResult(null);
                }}
              >
                {p.label}
              </Tag>
            ))}
          </Space>
        </div>

        <Button type="primary" onClick={handleDcaCalculate} style={{ marginTop: 16 }} size="large">开始计算</Button>
      </Card>

      {dcaResult && (
        <>
          {selectedDcaPreset && (
            <div style={{
              marginBottom: 12,
              padding: '8px 14px',
              borderRadius: 8,
              background: isDark ? 'rgba(22,119,255,0.1)' : 'rgba(22,119,255,0.04)',
              border: `1px solid ${isDark ? 'rgba(22,119,255,0.2)' : 'rgba(22,119,255,0.12)'}`,
              fontSize: 13,
              color: isDark ? '#8cb4ff' : '#1677ff',
              fontWeight: 500,
            }}>
              当前方案：{selectedDcaPreset}
            </div>
          )}
          <Card title="计算结果" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={12} sm={6}>
                <Statistic title="总投入" value={dcaResult.totalInvestment} precision={2} prefix="¥" />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总资产" value={dcaResult.totalValue} precision={2} prefix="¥" valueStyle={{ color: '#1677ff' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总收益" value={dcaResult.totalValue - dcaResult.totalInvestment} precision={2} prefix="¥" valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="总收益率" value={dcaResult.totalReturn} precision={2} suffix="%" valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="年化收益率" value={dcaResult.annualizedReturn} precision={2} suffix="%" valueStyle={{ color: '#ff4d4f' }} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="定投期数" value={dcaResult.totalPeriods} suffix={dcaFrequency === 'daily' ? '天' : dcaFrequency === 'weekly' ? '周' : '个月'} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="定投频率" value={DCA_FREQ_CONFIG[dcaFrequency].label} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="每期金额" value={dcaAmount} precision={0} prefix="¥" />
              </Col>
            </Row>
          </Card>

          <Card title="月度明细" style={{ marginBottom: 16 }}>
            <Table
              columns={[
                { title: '月份', dataIndex: 'index', key: 'index', render: (v: number) => `第 ${v} 个月` },
                { title: '当月投入', dataIndex: 'investment', key: 'investment', render: (v: number) => formatCurrency(v) },
                { title: '累计投入', dataIndex: 'cumulativeInvestment', key: 'cumulativeInvestment', render: (v: number) => formatCurrency(v) },
                { title: '资产市值', dataIndex: 'value', key: 'value', render: (v: number) => formatCurrency(v) },
                {
                  title: '收益率', dataIndex: 'returnRate', key: 'returnRate',
                  render: (v: number) => <span style={{ color: v >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>,
                },
              ]}
              dataSource={dcaFrequency === 'monthly' ? dcaResult.details : (() => {
                const daysPerPeriod = dcaFrequency === 'daily' ? TRADING_DAYS_PER_MONTH : Math.round(WEEKS_PER_MONTH);
                const months: any[] = [];
                for (let m = 0; m < dcaPeriod; m++) {
                  const startIdx = m * daysPerPeriod;
                  const endIdx = Math.min(startIdx + daysPerPeriod, dcaResult.details.length);
                  if (startIdx >= dcaResult.details.length) break;
                  const lastInMonth = dcaResult.details[endIdx - 1];
                  months.push({
                    index: m + 1,
                    investment: lastInMonth.investment * (endIdx - startIdx),
                    cumulativeInvestment: lastInMonth.cumulativeInvestment,
                    value: lastInMonth.value,
                    returnRate: lastInMonth.returnRate,
                  });
                }
                return months;
              })()}
              rowKey="index"
              pagination={{ pageSize: 12 }}
              size="small"
              summary={() => (
                <Table.Summary.Row style={{ fontWeight: 600, background: isDark ? '#1f1f1f' : '#f5f5f5' }}>
                  <Table.Summary.Cell index={0}>最终</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>{formatCurrency(dcaResult.totalInvestment)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{formatCurrency(dcaResult.totalInvestment)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>{formatCurrency(dcaResult.totalValue)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>
                    <span style={{ color: dcaResult.totalReturn >= 0 ? '#ff4d4f' : '#52c41a' }}>
                      {dcaResult.totalReturn >= 0 ? '+' : ''}{dcaResult.totalReturn.toFixed(2)}%
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
                {dcaFrequency === 'daily' && <li>每日定投适合资金充裕、希望平滑波动的投资者</li>}
                {dcaFrequency === 'weekly' && <li>每周定投兼顾平滑波动和操作便利，适合工薪族</li>}
              </ul>
            }
          />
        </>
      )}

      <Card title="热门定投方案" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          {[
            { label: '每日定投（沪深300）', desc: '每天50元 × 3年，预期年化8%', freq: 'daily', amount: 50, p: 36, r: 8 },
            { label: '每周定投（科技主题）', desc: '每周200元 × 3年，预期年化12%', freq: 'weekly', amount: 200, p: 36, r: 12 },
            { label: '每月定投（成长股）', desc: '每月2000元 × 2年，预期年化15%', freq: 'monthly', amount: 2000, p: 24, r: 15 },
          ].map((plan) => (
            <Col xs={24} sm={8} key={plan.label}>
              <Card
                hoverable
                size="small"
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: selectedDcaPreset === plan.label ? '2px solid #1677ff' : undefined,
                  background: selectedDcaPreset === plan.label ? (isDark ? 'rgba(22,119,255,0.1)' : 'rgba(22,119,255,0.04)') : undefined,
                }}
                onClick={() => {
                  setSelectedDcaPreset(plan.label);
                  setDcaFrequency(plan.freq as any);
                  setDcaAmount(plan.amount);
                  setDcaPeriod(plan.p);
                  setDcaExpectedReturn(plan.r);
                  setDcaResult(null);
                }}
              >
                <strong>{plan.label}</strong>
                <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginTop: 8 }}>{plan.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </>
  );
}
