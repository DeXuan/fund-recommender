import { useState, useEffect } from 'react';
import { Card, Select, InputNumber, Slider, Button, Row, Col, Statistic, Tag, Table, Spin } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../../services/api';
import { getEchartsTheme } from '../../utils/echarts-theme';

function getSmartMultiplier(pePercentile: number) {
  if (pePercentile < 15) return { multiplier: 2.0, label: '极度低估-加倍', color: '#52c41a' };
  if (pePercentile < 30) return { multiplier: 1.5, label: '低估-多投', color: '#73d13d' };
  if (pePercentile < 45) return { multiplier: 1.2, label: '偏低-略多', color: '#95de64' };
  if (pePercentile < 55) return { multiplier: 1.0, label: '适中-正常', color: '#1677ff' };
  if (pePercentile < 70) return { multiplier: 0.8, label: '偏高-略少', color: '#ffc53d' };
  if (pePercentile < 85) return { multiplier: 0.5, label: '高估-少投', color: '#ff7a45' };
  return { multiplier: 0, label: '极高-暂停', color: '#ff4d4f' };
}

interface Props {
  isDark: boolean;
}

export function SmartDCATab({ isDark }: Props) {
  const [smartIndices, setSmartIndices] = useState<any[]>([]);
  const [smartSelectedCode, setSmartSelectedCode] = useState('000300');
  const [smartBaseAmount, setSmartBaseAmount] = useState(1000);
  const [smartPeriod, setSmartPeriod] = useState(36);
  const [smartResults, setSmartResults] = useState<any[]>([]);
  const [smartComparing, setSmartComparing] = useState<any>(null);
  const [smartCalculating, setSmartCalculating] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);

  useEffect(() => {
    if (smartIndices.length === 0 && !smartLoading) {
      setSmartLoading(true);
      fundApi.getValuationCenter().then(data => {
        setSmartIndices(data);
        if (data.length > 0 && !data.find((i: any) => i.code === '000300')) {
          setSmartSelectedCode(data[0].code);
        }
      }).catch(() => {
        // error handled silently
      }).finally(() => setSmartLoading(false));
    }
  }, []);

  const handleSmartDCACalculate = () => {
    setSmartCalculating(true);
    const idx = smartIndices.find((i: any) => i.code === smartSelectedCode);
    if (!idx || !idx.pePercentile) {
      setSmartCalculating(false);
      return;
    }
    const simResults: any[] = [];
    let cumulativeInvest = 0;
    let cumulativeShares = 0;
    const baseNav = idx.pe || 15;
    let seed = smartSelectedCode.split('').reduce((s: number, c: string) => s * 31 + c.charCodeAt(0), smartBaseAmount) | 0;
    const seededRandom = () => { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    for (let m = 0; m < smartPeriod; m++) {
      const noise = Math.sin(m * 0.7 + idx.pePercentile * 0.1) * 20 + (seededRandom() - 0.5) * 10;
      const simulatedPercentile = Math.max(0, Math.min(100, idx.pePercentile + noise));
      const { multiplier } = getSmartMultiplier(simulatedPercentile);
      const amount = Math.round(smartBaseAmount * multiplier);
      const navFactor = 1 + (simulatedPercentile - 50) / 200 + (seededRandom() - 0.5) * 0.03;
      const nav = baseNav * navFactor;
      const shares = amount > 0 ? amount / nav : 0;
      cumulativeInvest += amount;
      cumulativeShares += shares;
      const marketValue = cumulativeShares * nav;
      const profit = marketValue - cumulativeInvest;
      const returnRate = cumulativeInvest > 0 ? (profit / cumulativeInvest) * 100 : 0;
      const date = new Date();
      date.setMonth(date.getMonth() + m);
      simResults.push({
        month: m + 1,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        pePercentile: Math.round(simulatedPercentile),
        multiplier, amount,
        nav: parseFloat(nav.toFixed(4)),
        shares: parseFloat(shares.toFixed(2)),
        cumulativeInvest,
        cumulativeShares: parseFloat(cumulativeShares.toFixed(2)),
        marketValue: parseFloat(marketValue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        returnRate: parseFloat(returnRate.toFixed(2)),
      });
    }
    setSmartResults(simResults);
    const normalInvest = smartBaseAmount * smartPeriod;
    const normalShares = simResults.reduce((sum, r) => sum + (smartBaseAmount / r.nav), 0);
    const lastNav = simResults[simResults.length - 1]?.nav || baseNav;
    const normalMarketValue = normalShares * lastNav;
    const normalReturn = ((normalMarketValue - normalInvest) / normalInvest) * 100;
    const smartInvest = simResults[simResults.length - 1]?.cumulativeInvest || 0;
    const smartMarketValue = simResults[simResults.length - 1]?.marketValue || 0;
    const smartReturn = simResults[simResults.length - 1]?.returnRate || 0;
    setSmartComparing({
      normal: { invest: normalInvest, marketValue: normalMarketValue, returnRate: normalReturn },
      smart: { invest: smartInvest, marketValue: smartMarketValue, returnRate: smartReturn },
      advantage: smartReturn - normalReturn,
    });
    setSmartCalculating(false);
  };

  const smartSelected = smartIndices.find((i: any) => i.code === smartSelectedCode);

  const smartChartOption = smartResults.length ? {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const r = smartResults[params[0]?.dataIndex];
        if (!r) return '';
        return `<div style="font-weight:600">${r.date}</div><div>PE分位: ${r.pePercentile}% | 倍数: ${r.multiplier}x</div><div>定投金额: ${r.amount}元 | 累计投入: ${r.cumulativeInvest}元</div><div>市值: ${r.marketValue}元 | 收益率: ${r.returnRate}%</div>`;
      },
    },
    legend: { data: ['累计投入', '市值', 'PE分位'], top: 0, textStyle: { color: isDark ? '#a0a0a0' : '#666' } },
    grid: { top: 40, left: 60, right: 60, bottom: 30 },
    xAxis: { type: 'category', data: smartResults.map(r => r.date), axisLabel: { color: isDark ? '#6b6b6b' : '#999', fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '金额(元)', position: 'left', axisLabel: { color: isDark ? '#6b6b6b' : '#999' } },
      { type: 'value', name: 'PE分位(%)', position: 'right', max: 100, axisLabel: { color: isDark ? '#6b6b6b' : '#999' } },
    ],
    series: [
      { name: '累计投入', type: 'line', data: smartResults.map(r => r.cumulativeInvest), yAxisIndex: 0, lineStyle: { color: '#1677ff', width: 2 }, itemStyle: { color: '#1677ff' }, showSymbol: false, areaStyle: { color: 'rgba(22,119,255,0.1)' } },
      { name: '市值', type: 'line', data: smartResults.map(r => r.marketValue), yAxisIndex: 0, lineStyle: { color: '#52c41a', width: 2 }, itemStyle: { color: '#52c41a' }, showSymbol: false },
      { name: 'PE分位', type: 'bar', data: smartResults.map(r => ({ value: r.pePercentile, itemStyle: { color: getSmartMultiplier(r.pePercentile).color + '60' } })), yAxisIndex: 1, barWidth: 6 },
    ],
  } : null;

  const smartColumns = [
    { title: '期数', dataIndex: 'month', key: 'month', width: 60, render: (v: number) => `第${v}期` },
    { title: '月份', dataIndex: 'date', key: 'date', width: 90 },
    { title: 'PE分位', dataIndex: 'pePercentile', key: 'pePercentile', width: 90, render: (v: number) => <span style={{ color: getSmartMultiplier(v).color, fontWeight: 600 }}>{v}%</span> },
    { title: '倍数', dataIndex: 'multiplier', key: 'multiplier', width: 80, render: (v: number) => <Tag color={getSmartMultiplier(smartResults.find(r => r.multiplier === v)?.pePercentile ?? 50).color}>{v}x</Tag> },
    { title: '定投金额', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span> },
    { title: '累计投入', dataIndex: 'cumulativeInvest', key: 'cumulativeInvest', width: 110, render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '市值', dataIndex: 'marketValue', key: 'marketValue', width: 110, render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '收益率', dataIndex: 'returnRate', key: 'returnRate', width: 90, render: (v: number) => <span style={{ color: v >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v}%</span> },
  ];

  return (
    <>
      <p style={{ marginBottom: 16, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
        基于指数估值自动调整定投金额：低估多投、合理正常投、高估少投或暂停
      </p>
      {smartLoading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载指数数据..." /></div>
      ) : (
        <Row gutter={24}>
          <Col xs={24} lg={8}>
            <Card title={<span style={{ fontWeight: 600 }}>定投参数</span>} style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}>跟踪指数</div>
                <Select
                  value={smartSelectedCode}
                  onChange={setSmartSelectedCode}
                  style={{ width: '100%' }}
                  options={smartIndices.map((i: any) => ({ label: `${i.name} (PE分位: ${i.pePercentile ?? '-'}%)`, value: i.code }))}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}>每期基准金额（元）</div>
                <InputNumber value={smartBaseAmount} onChange={v => setSmartBaseAmount(v || 1000)} min={100} max={100000} step={100} style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}>定投期限（月）：{smartPeriod}</div>
                <Slider value={smartPeriod} onChange={setSmartPeriod} min={6} max={120} marks={{ 12: '1年', 36: '3年', 60: '5年', 120: '10年' }} />
              </div>
              <Button type="primary" block size="large" onClick={handleSmartDCACalculate} loading={smartCalculating} icon={<CalculatorOutlined />}>
                开始测算
              </Button>
            </Card>
            {smartSelected && (
              <Card title={<span style={{ fontWeight: 600 }}>{smartSelected.name} 当前估值</span>} style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic title="PE" value={smartSelected.pe?.toFixed(2) || '-'} suffix="倍" valueStyle={{ fontSize: 18 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="PE分位" value={smartSelected.pePercentile ?? '-'} suffix="%" valueStyle={{ fontSize: 18, color: getSmartMultiplier(smartSelected.pePercentile ?? 50).color }} />
                  </Col>
                </Row>
                <div style={{ marginTop: 12, padding: 8, background: getSmartMultiplier(smartSelected.pePercentile ?? 50).color + '15', borderRadius: 6, textAlign: 'center' }}>
                  <span style={{ color: getSmartMultiplier(smartSelected.pePercentile ?? 50).color, fontWeight: 600 }}>
                    当前建议：{getSmartMultiplier(smartSelected.pePercentile ?? 50).label}
                  </span>
                </div>
              </Card>
            )}
            <Card title={<span style={{ fontWeight: 600 }}>智慧定投规则</span>}>
              <div style={{ fontSize: 12, lineHeight: 2.2 }}>
                {[
                  { range: '0-15%', mult: '2.0x', label: '极度低估', color: '#52c41a' },
                  { range: '15-30%', mult: '1.5x', label: '低估', color: '#73d13d' },
                  { range: '30-45%', mult: '1.2x', label: '偏低', color: '#95de64' },
                  { range: '45-55%', mult: '1.0x', label: '适中', color: '#1677ff' },
                  { range: '55-70%', mult: '0.8x', label: '偏高', color: '#ffc53d' },
                  { range: '70-85%', mult: '0.5x', label: '高估', color: '#ff7a45' },
                  { range: '85-100%', mult: '暂停', label: '极高', color: '#ff4d4f' },
                ].map(r => (
                  <div key={r.range} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: r.color, fontWeight: 500 }}>{r.label}</span>
                    <span style={{ color: isDark ? '#a0a0a0' : '#666' }}>{r.range}</span>
                    <Tag color={r.color} style={{ margin: 0 }}>{r.mult}</Tag>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            {smartComparing ? (
              <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                      <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>智慧定投收益</span>} value={smartComparing.smart.returnRate} suffix="%" precision={2} valueStyle={{ color: '#fff', fontSize: 28 }} prefix={smartComparing.smart.returnRate >= 0 ? '+' : ''} />
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>投入 ¥{smartComparing.smart.invest.toLocaleString()}</div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', border: 'none' }}>
                      <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>普通定投收益</span>} value={smartComparing.normal.returnRate} suffix="%" precision={2} valueStyle={{ color: '#fff', fontSize: 28 }} prefix={smartComparing.normal.returnRate >= 0 ? '+' : ''} />
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>投入 ¥{smartComparing.normal.invest.toLocaleString()}</div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card style={{ background: smartComparing.advantage >= 0 ? 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' : 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', border: 'none' }}>
                      <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>智慧定投优势</span>} value={smartComparing.advantage} suffix="%" precision={2} valueStyle={{ color: '#fff', fontSize: 28 }} prefix={smartComparing.advantage >= 0 ? '+' : ''} />
                      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>{smartComparing.advantage >= 0 ? '智慧定投更优' : '普通定投更优'}</div>
                    </Card>
                  </Col>
                </Row>
                {smartChartOption && (
                  <Card title={<span style={{ fontWeight: 600 }}>定投模拟曲线</span>} style={{ marginBottom: 16 }}>
                    <ReactECharts option={smartChartOption} theme={getEchartsTheme(isDark)} style={{ height: 350 }} />
                  </Card>
                )}
                <Card title={<span style={{ fontWeight: 600 }}>逐期明细</span>}>
                  <Table columns={smartColumns} dataSource={smartResults} rowKey="month" pagination={false} size="small" scroll={{ x: 800 }} />
                </Card>
              </>
            ) : (
              <Card style={{ textAlign: 'center', padding: 60 }}>
                <CalculatorOutlined style={{ fontSize: 48, color: isDark ? '#555' : '#d9d9d9', marginBottom: 16 }} />
                <p style={{ fontSize: 16, color: isDark ? '#6b6b6b' : '#999' }}>选择指数和参数，点击"开始测算"查看智慧定投效果</p>
              </Card>
            )}
          </Col>
        </Row>
      )}
    </>
  );
}
