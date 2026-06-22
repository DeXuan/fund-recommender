import { Card, Table, Button, Space, Row, Col, Tag, Alert, Progress, Spin, Empty, Statistic } from 'antd';
import {
  PieChartOutlined, SwapOutlined, BarChartOutlined, ThunderboltOutlined,
  FundOutlined, DollarOutlined, SafetyOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { getEchartsTheme } from '../../utils/echarts-theme';

interface Props {
  industryData: any;
  industryLoading: boolean;
  feeData: any;
  feeLoading: boolean;
  holdingsRisk: any[];
  holdingsRiskLoading: boolean;
  attributionData: any;
  attributionLoading: boolean;
  overlapData: any;
  overlapLoading: boolean;
  isDark: boolean;
  onRefreshIndustry: () => void;
  onRefreshOverlap: () => void;
  onRefreshFee: () => void;
  onRefreshRisk: () => void;
  onRefreshAttribution: () => void;
}

export function DeepAnalysisTab({
  industryData, industryLoading, feeData, feeLoading,
  holdingsRisk, holdingsRiskLoading, attributionData, attributionLoading,
  overlapData, overlapLoading, isDark,
  onRefreshIndustry, onRefreshOverlap, onRefreshFee, onRefreshRisk, onRefreshAttribution,
}: Props) {
  const industryPieOption = industryData ? {
    tooltip: { formatter: (p: any) => `${p.name}<br/>占比：${p.data.weight}%<br/>市值：¥${p.data.value.toLocaleString()}<br/>盈亏：${p.data.pnl >= 0 ? '+' : ''}¥${p.data.pnl.toLocaleString()}` },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'],
      data: industryData.allocations.map((a: any) => ({ name: a.industry, value: a.totalValue, weight: a.weight, pnl: a.totalPnl })),
      label: { formatter: '{b}\n{d}%', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  } : null;

  const attributionBarOption = attributionData ? {
    tooltip: { formatter: (p: any) => `${p.name}<br/>贡献：${p.value >= 0 ? '+' : ''}${p.value}%<br/>盈亏：${p.data.pnl >= 0 ? '+' : ''}¥${p.data.pnl.toLocaleString()}` },
    grid: { left: 120, right: 30, top: 10, bottom: 30 },
    xAxis: { type: 'value', name: '收益贡献(%)' },
    yAxis: { type: 'category', data: attributionData.attributions.map((a: any) => a.fundName.slice(0, 10)), inverse: true },
    series: [{
      type: 'bar',
      data: attributionData.attributions.map((a: any) => ({
        value: a.contribution, pnl: a.pnl,
        itemStyle: { color: a.contribution >= 0 ? '#ff4d4f' : '#52c41a' },
      })),
      label: { show: true, position: 'right', formatter: (p: any) => `${p.value >= 0 ? '+' : ''}${p.value}%`, fontSize: 11 },
    }],
  } : null;

  return (
    <>
      {(industryLoading || feeLoading || holdingsRiskLoading || attributionLoading || overlapLoading) && (
        <div style={{ textAlign: 'center', padding: 40, marginBottom: 16 }}>
          <Spin size="large" tip="正在加载分析数据..." />
        </div>
      )}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card size="small">
            <Space wrap>
              <Button icon={<PieChartOutlined />} loading={industryLoading} onClick={onRefreshIndustry}>刷新行业配置</Button>
              <Button icon={<SwapOutlined />} loading={overlapLoading} onClick={onRefreshOverlap}>刷新持仓重叠</Button>
              <Button icon={<BarChartOutlined />} loading={feeLoading} onClick={onRefreshFee}>刷新费用分析</Button>
              <Button icon={<ThunderboltOutlined />} loading={holdingsRiskLoading} onClick={onRefreshRisk}>刷新持仓风险</Button>
              <Button icon={<FundOutlined />} loading={attributionLoading} onClick={onRefreshAttribution}>刷新收益归因</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {overlapData && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{overlapData.summary.totalFunds}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>持仓基金数</div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-purple)' }}>{overlapData.summary.industryCount}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>覆盖行业数</div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: overlapData.summary.concentrationLevel.includes('高度') ? '#ff4d4f' : overlapData.summary.concentrationLevel.includes('中度') ? '#faad14' : '#52c41a' }}>{overlapData.summary.concentrationLevel}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>集中度评估</div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>{overlapData.summary.hhi}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>HHI指数</div>
              </Card>
            </Col>
          </Row>

          <Alert
            type={overlapData.summary.concentrationLevel.includes('高度') ? 'warning' : overlapData.summary.concentrationLevel.includes('中度') ? 'info' : 'success'}
            message={overlapData.summary.concentrationLevel}
            description={overlapData.summary.concentrationAdvice}
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card title={<Space><SwapOutlined /> 基金类型分布</Space>} size="small">
                {overlapData.typeDistribution.length > 0 ? (
                  <ReactECharts
                    theme={getEchartsTheme(isDark)}
                    option={{
                      tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
                      series: [{
                        type: 'pie', radius: ['40%', '70%'],
                        data: overlapData.typeDistribution.map((td: any) => ({
                          name: td.type, value: parseFloat(td.weight.toFixed(1)),
                        })),
                        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
                      }],
                    }}
                    style={{ height: 280 }}
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              {overlapData.overlapPairs.length > 0 ? (
                <Card
                  title={<span><WarningOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />重叠行业（{overlapData.overlapPairs.length}个）</span>}
                  size="small"
                >
                  <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                    以下行业有多只基金重叠，可能导致风险集中
                  </p>
                  {overlapData.overlapPairs.map((pair: any) => {
                    const riskColor = pair.riskLevel === 'high' ? '#ff4d4f' : pair.riskLevel === 'medium' ? '#faad14' : '#52c41a';
                    return (
                      <div key={pair.industry} style={{
                        marginBottom: 10, padding: '8px 12px', borderRadius: 6,
                        border: `1px solid ${riskColor}40`, background: `${riskColor}08`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{pair.industry}</span>
                          <Space size={4}>
                            <Tag color={riskColor} style={{ fontSize: 10, lineHeight: '18px', padding: '0 4px' }}>
                              {pair.riskLevel === 'high' ? '高风险' : pair.riskLevel === 'medium' ? '中风险' : '低风险'}
                            </Tag>
                            <span style={{ fontWeight: 600, color: riskColor, fontSize: 12 }}>{pair.weight.toFixed(1)}%</span>
                          </Space>
                        </div>
                        <Progress percent={pair.weight} showInfo={false} strokeColor={riskColor} size="small" style={{ marginBottom: 6 }} />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {pair.funds.map((f: any) => (
                            <Link key={f.code} to={`/funds/${f.code}`}>
                              <Tag color="blue" style={{ cursor: 'pointer', fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{f.name}</Tag>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              ) : (
                <Card title={<Space><CheckCircleOutlined style={{ color: 'var(--success)' }} /> 无重叠风险</Space>} size="small">
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--success)' }}>
                    <CheckCircleOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                    <p>持仓行业分布合理，无明显重叠风险</p>
                  </div>
                </Card>
              )}
            </Col>
          </Row>
        </>
      )}

      {industryData && industryPieOption && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={<Space><PieChartOutlined /> 行业配置分布</Space>} size="small">
              <ReactECharts option={industryPieOption} style={{ height: 300 }} theme={getEchartsTheme(isDark)} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={<Space><FundOutlined /> 行业详情</Space>} size="small"
              extra={<Space><Tag color="blue">{industryData.industryCount}个行业</Tag><Tag color={industryData.concentration === '分散配置' ? 'green' : industryData.concentration === '中等集中度' ? 'orange' : 'red'}>{industryData.concentration}</Tag></Space>}>
              <Table dataSource={industryData.allocations} rowKey="industry" size="small" pagination={false}
                columns={[
                  { title: '行业', dataIndex: 'industry', width: 80 },
                  { title: '占比', dataIndex: 'weight', width: 80, render: (v: number) => <Progress percent={v} size="small" strokeColor={v > 30 ? '#ff4d4f' : '#1677ff'} format={() => `${v}%`} /> },
                  { title: '市值', dataIndex: 'totalValue', width: 100, render: (v: number) => `¥${v.toLocaleString()}` },
                  { title: '盈亏', dataIndex: 'totalPnl', width: 100, render: (v: number) => <span style={{ color: v >= 0 ? '#ff4d4f' : '#52c41a' }}>{v >= 0 ? '+' : ''}¥{v.toFixed(0)}</span> },
                  { title: '基金数', dataIndex: 'fundCount', width: 60 },
                ]}
              />
              {industryData.suggestions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {industryData.suggestions.map((s: any, i: number) => <Alert key={i} message={s.text} type={s.type as any} showIcon style={{ marginBottom: 4 }} />)}
                </div>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {feeData && (
        <Card title={<Space><DollarOutlined /> 费用分析</Space>} size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="总买入费用" value={feeData.summary.totalBuyFees} prefix="¥" precision={2} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="总卖出费用" value={feeData.summary.totalSellFees} prefix="¥" precision={2} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="总费用" value={feeData.summary.totalFees} prefix="¥" precision={2} valueStyle={{ color: 'var(--danger)' }} /></Card></Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="综合费率" value={feeData.summary.feeRate} suffix="%" precision={2} /></Card></Col>
          </Row>
          <Table dataSource={feeData.fundFees} rowKey="code" size="small" pagination={false}
            columns={[
              { title: '基金', dataIndex: 'name', ellipsis: true },
              { title: '代码', dataIndex: 'code', width: 80 },
              { title: '买入费', dataIndex: 'buyFees', width: 80, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
              { title: '卖出费', dataIndex: 'sellFees', width: 80, render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
              { title: '总费用', dataIndex: 'totalFees', width: 90, render: (v: number) => <span style={{ color: 'var(--danger)' }}>¥{Number(v || 0).toFixed(2)}</span> },
              { title: '费率', dataIndex: 'feeRate', width: 80, render: (v: number) => `${Number(v || 0).toFixed(2)}%` },
              { title: '投入金额', dataIndex: 'investment', width: 110, render: (v: number) => `¥${Number(v || 0).toLocaleString()}` },
            ]}
          />
        </Card>
      )}

      {holdingsRisk.length > 0 && (
        <Card title={<Space><SafetyOutlined /> 持仓风险指标</Space>} size="small" style={{ marginBottom: 16 }}>
          <Table dataSource={holdingsRisk} rowKey="fundCode" size="small" pagination={false}
            columns={[
              { title: '基金', dataIndex: 'fundName', ellipsis: true },
              { title: '代码', dataIndex: 'fundCode', width: 80 },
              { title: '行业', dataIndex: 'industry', width: 70 },
              { title: '估值', dataIndex: 'valuation', width: 60, render: (v: string) => v ? <Tag color={v === '低估' ? 'green' : v === '高估' ? 'red' : 'blue'}>{v}</Tag> : '-' },
              { title: '夏普', dataIndex: ['metrics', 'sharpe'], width: 70, render: (v: number) => v != null ? <span style={{ color: v >= 1 ? '#52c41a' : '#faad14' }}>{v}</span> : '-' },
              { title: '索提诺', dataIndex: ['metrics', 'sortino'], width: 70, render: (v: number) => v != null ? <span style={{ color: v >= 1.5 ? '#52c41a' : '#faad14' }}>{v}</span> : '-' },
              { title: '卡玛', dataIndex: ['metrics', 'calmar'], width: 70, render: (v: number) => v != null ? <span style={{ color: v >= 1 ? '#52c41a' : '#faad14' }}>{v}</span> : '-' },
              { title: '最大回撤', dataIndex: ['metrics', 'maxDrawdown'], width: 80, render: (v: number) => v != null ? <span style={{ color: v < 15 ? '#52c41a' : '#ff4d4f' }}>{v}%</span> : '-' },
              { title: '年化收益', dataIndex: ['metrics', 'annualReturn'], width: 90, render: (v: number) => v != null ? <span style={{ color: v >= 0 ? '#ff4d4f' : '#52c41a' }}>{v >= 0 ? '+' : ''}{v}%</span> : '-' },
              { title: '年化波动', dataIndex: ['metrics', 'annualVolatility'], width: 80, render: (v: number) => v != null ? `${v}%` : '-' },
            ]}
          />
        </Card>
      )}

      {attributionData && attributionBarOption && (
        <Card title={<Space><FundOutlined /> 收益归因分析</Space>} size="small" style={{ marginBottom: 16 }}
          extra={<Space>
            {attributionData.bestContributor && <Tag color="red">最大贡献：{attributionData.bestContributor.name} +{attributionData.bestContributor.contribution}%</Tag>}
            {attributionData.worstContributor && <Tag color="green">最大拖累：{attributionData.worstContributor.name} {attributionData.worstContributor.contribution}%</Tag>}
          </Space>}>
          <ReactECharts option={attributionBarOption} style={{ height: Math.max(200, attributionData.attributions.length * 40) }} theme={getEchartsTheme(isDark)} />
        </Card>
      )}
    </>
  );
}
