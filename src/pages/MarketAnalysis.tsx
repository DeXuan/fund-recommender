import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Tag, Progress, Timeline, Spin, Alert, Row, Col } from 'antd';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor, getValuationColor } from '../utils/format';
import ReactECharts from 'echarts-for-react';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface MarketIndex {
  name: string;
  code: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  pe: string | null;
  pb: string | null;
  pePercentile: string | null;
  pbPercentile: string | null;
  valuation: string;
  suggestion: string;
}

interface IndustryRecommendation {
  rank: number;
  industry: string;
  fundName: string;
  fundCode: string;
  index: string;
  rating: number;
  return1y: number;
  return3m: number;
  return1m: number;
  trend: string;
  valuation: string;
  buySuggestion: string;
  positionSuggestion: string;
  logic: string;
}

interface BatchPlan {
  batch: number;
  time: string;
  percentage: number;
  targets: string;
  method: string;
  reason: string;
}

export default function MarketAnalysis() {
  const { isDark } = useTheme();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [recommendations, setRecommendations] = useState<IndustryRecommendation[]>([]);
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>([]);
  const [valuationTrend, setValuationTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [indicesData, recsData, plansData, trendData] = await Promise.all([
        fundApi.getMarketIndices(),
        fundApi.getIndustryRecommendations(),
        fundApi.getBatchPlans(),
        fundApi.getValuationTrend().catch(() => []),
      ]);
      setIndices(indicesData);
      setRecommendations(recsData);
      setBatchPlans(plansData);
      setValuationTrend(trendData);
    } catch (error) {
      console.error('加载市场数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  const valuationChartOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: indices.map(i => i.name), axisLabel: { rotate: 15 } },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: 'PE分位',
        type: 'bar',
        data: indices.map(i => ({ value: Number(i.pePercentile) || 0, itemStyle: { color: getValuationColor(i.valuation) } })),
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
    grid: { top: 30, right: 20, bottom: 40, left: 50 },
  };

  const indexColumns = [
    { title: '指数', dataIndex: 'name', key: 'name', render: (text: string) => <strong>{text}</strong> },
    {
      title: '最新价',
      dataIndex: 'price',
      key: 'price',
      render: (val: number | null) => val != null ? val.toFixed(2) : '-',
    },
    {
      title: '涨跌幅',
      dataIndex: 'changePercent',
      key: 'changePercent',
      render: (val: number | null) => {
        if (val == null) return '-';
        const color = val >= 0 ? '#cf1322' : '#3f8600';
        const sign = val >= 0 ? '+' : '';
        return <span style={{ color, fontWeight: 600 }}>{sign}{val.toFixed(2)}%</span>;
      },
    },
    { title: 'PE(TTM)', dataIndex: 'pe', key: 'pe', render: (val: string | null) => val ?? '--' },
    {
      title: 'PE历史分位',
      dataIndex: 'pePercentile',
      key: 'pePercentile',
      render: (val: string | null, record: MarketIndex) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{val != null ? `${val}%` : '--'}</span>
          {val != null && <Progress percent={Number(val)} showInfo={false} size="small" strokeColor={getValuationColor(record.valuation)} style={{ flex: 1 }} />}
        </div>
      ),
    },
    { title: 'PB', dataIndex: 'pb', key: 'pb', render: (val: string | null) => val ?? '--' },
    {
      title: 'PB历史分位',
      dataIndex: 'pbPercentile',
      key: 'pbPercentile',
      render: (val: string | null, record: MarketIndex) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{val != null ? `${val}%` : '--'}</span>
          {val != null && <Progress percent={Number(val)} showInfo={false} size="small" strokeColor={getValuationColor(record.valuation)} style={{ flex: 1 }} />}
        </div>
      ),
    },
    {
      title: '估值判断',
      dataIndex: 'valuation',
      key: 'valuation',
      render: (val: string) => <span style={{ color: getValuationColor(val), fontWeight: 600 }}>{val}</span>,
    },
    { title: '投资建议', dataIndex: 'suggestion', key: 'suggestion' },
  ];

  const recColumns = [
    { title: '行业', dataIndex: 'industry', key: 'industry', render: (text: string) => <Tag color="blue">{text || '--'}</Tag> },
    { title: '走势', dataIndex: 'trend', key: 'trend', render: (text: string) => text || '--' },
    { title: '估值', dataIndex: 'valuation', key: 'valuation', render: (val: string) => <span style={{ color: getValuationColor(val) }}>{val || '--'}</span> },
    {
      title: '买入建议',
      dataIndex: 'buySuggestion',
      key: 'buySuggestion',
      render: (text: string) => (
        <Tag color={text === '优先配置' ? 'green' : text === '逢低布局' ? 'orange' : 'default'}>{text || '--'}</Tag>
      ),
    },
    { title: '推荐逻辑', dataIndex: 'logic', key: 'logic', ellipsis: true, render: (text: string) => <span style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>{text || '--'}</span> },
  ];

  const tabItems = [
    {
      key: 'indices',
      label: '指数估值',
      children: (
        <div>
          <ReactECharts theme={getEchartsTheme(isDark)} option={valuationChartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
          <Table columns={indexColumns} dataSource={indices} rowKey="code" pagination={false} size="small" scroll={{ x: 800 }} style={{ marginTop: 16 }} />
          <Alert
            type="info"
            message="估值分位说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                <li>20%以下：极度低估，适合重仓买入</li>
                <li>20-40%：偏低估，适合定投加仓</li>
                <li>40-60%：合理区间，适合正常定投</li>
                <li>60-80%：偏高估，适合小额定投</li>
                <li>80%以上：极度高估，建议观望或减仓</li>
              </ul>
            }
            style={{ marginTop: 16 }}
          />
        </div>
      ),
    },
    {
      key: 'recommendations',
      label: '行业推荐',
      children: (
        <div>
          <Table columns={recColumns} dataSource={recommendations} rowKey="rank" pagination={false} size="small" scroll={{ x: 1000 }} />
          <Card title="推荐逻辑" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              {recommendations.slice(0, 4).map((rec, i) => (
                <Col xs={24} sm={12} md={6} key={rec.industry || i}>
                  <Card size="small" style={{ background: isDark ? '#1f1f1f' : '#f5f5f5' }}>
                    <strong>{rec.industry || '--'}</strong>
                    <p style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', margin: '8px 0 0' }}>{rec.logic || '--'}</p>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </div>
      ),
    },
    {
      key: 'batch',
      label: '分批建仓',
      children: (
        <div>
          <Card title="分批建仓方案" extra={<span style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>核心策略：高低切换 + 分批建仓 + 估值优先</span>}>
            <Timeline
              items={batchPlans.map((plan: any) => ({
                color: 'blue',
                children: (
                  <Card size="small" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong>第 {plan.batch} 批</strong>
                      <Tag color="green">{plan.ratio || plan.percentage}%</Tag>
                    </div>
                    <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}><strong>时间：</strong>{plan.time}</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}><strong>买入标的：</strong>{Array.isArray(plan.funds) ? plan.funds.join('、') : plan.targets}</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}><strong>操作方式：</strong>{plan.method}</div>
                    <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}><strong>理由：</strong>{plan.reason}</div>
                  </Card>
                ),
              }))}
            />
          </Card>

          <Card title="建仓原则" style={{ marginTop: 16 }}>
            <ul style={{ fontSize: 14, lineHeight: 2, margin: 0, paddingLeft: 20 }}>
              <li><strong>分批买入</strong>：不要一次性投入，分3-4批建仓</li>
              <li><strong>估值优先</strong>：优先配置估值较低的品种</li>
              <li><strong>核心+卫星</strong>：70%配置核心品种，30%配置弹性品种</li>
              <li><strong>动态调整</strong>：根据市场变化调整后续批次的品种和比例</li>
              <li><strong>设定止损</strong>：单只基金亏损超过15%考虑止损</li>
            </ul>
          </Card>
        </div>
      ),
    },
    {
      key: 'trend',
      label: '估值趋势',
      children: (
        <div>
          {valuationTrend.length > 0 ? (
            valuationTrend.map(idx => (
              <Card key={idx.code} title={`${idx.name} 估值分位趋势（近12月）`} size="small" style={{ marginBottom: 16 }}>
                <ReactECharts
                  theme={getEchartsTheme(isDark)}
                  option={{
                    tooltip: {
                      trigger: 'axis',
                      formatter: (params: any) => {
                        let html = `${params[0]?.axisValue}<br/>`;
                        params.forEach((p: any) => {
                          html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
                        });
                        return html;
                      },
                    },
                    legend: { data: ['PE分位', 'PB分位'], bottom: 0 },
                    grid: { top: 20, right: 20, bottom: 40, left: 50 },
                    xAxis: {
                      type: 'category',
                      data: idx.months.map((m: any) => m.month),
                      axisLabel: { fontSize: 10 },
                    },
                    yAxis: {
                      type: 'value',
                      max: 100,
                      axisLabel: { formatter: '{value}%', fontSize: 10 },
                      splitLine: { lineStyle: { type: 'dashed' } },
                    },
                    visualMap: {
                      show: false,
                      pieces: [
                        { lte: 20, color: '#52c41a' },
                        { gt: 20, lte: 40, color: '#73d13d' },
                        { gt: 40, lte: 60, color: '#1677ff' },
                        { gt: 60, lte: 80, color: '#ff7a45' },
                        { gt: 80, color: '#ff4d4f' },
                      ],
                    },
                    series: [
                      {
                        name: 'PE分位',
                        type: 'line',
                        data: idx.months.map((m: any) => m.pe_percentile),
                        smooth: true,
                        lineStyle: { width: 2 },
                        showSymbol: false,
                        markLine: {
                          silent: true,
                          data: [
                            { yAxis: 20, lineStyle: { color: '#52c41a', type: 'dashed' }, label: { formatter: '极低20%', fontSize: 10 } },
                            { yAxis: 80, lineStyle: { color: '#ff4d4f', type: 'dashed' }, label: { formatter: '极高80%', fontSize: 10 } },
                          ],
                        },
                      },
                      {
                        name: 'PB分位',
                        type: 'line',
                        data: idx.months.map((m: any) => m.pb_percentile),
                        smooth: true,
                        lineStyle: { width: 2, type: 'dashed' },
                        showSymbol: false,
                      },
                    ],
                  }}
                  style={{ height: 250 }}
                  opts={{ renderer: 'svg' }}
                />
                <div style={{ textAlign: 'center', fontSize: 13, color: isDark ? '#a0a0a0' : '#595959', marginTop: 8 }}>
                  当前估值：<span style={{ fontWeight: 600, color: getValuationColor(idx.current_valuation) }}>{idx.current_valuation}</span>
                  <span style={{ marginLeft: 16 }}>建议：{idx.current_suggestion}</span>
                </div>
              </Card>
            ))
          ) : (
            <Card style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无估值趋势数据
            </Card>
          )}
          <Card size="small" style={{ marginTop: 16, background: isDark ? '#111a2c' : '#e6f4ff', border: '1px solid #91caff' }}>
            <strong style={{ color: '#1677ff' }}>估值趋势说明</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 16, lineHeight: 2, fontSize: 13 }}>
              <li>PE分位越低，表示当前估值越便宜，投资价值越高</li>
              <li>绿色区域（20%以下）为极度低估，适合重仓布局</li>
              <li>红色区域（80%以上）为极度高估，建议观望或减仓</li>
              <li>估值分位是相对指标，需结合绝对估值和市场环境综合判断</li>
            </ul>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>市场分析</h1>
      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
}
