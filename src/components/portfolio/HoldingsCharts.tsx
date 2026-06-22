import { Card, Row, Col } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { PortfolioHolding, PortfolioSummary } from '../../types';
import { getEchartsTheme } from '../../utils/echarts-theme';

interface Props {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary | null;
  benchmarkData: any[];
  isDark: boolean;
}

export function HoldingsCharts({ holdings, summary, benchmarkData, isDark }: Props) {
  const pieOption = holdings.length > 0 ? {
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      label: { formatter: '{b}\n{d}%' },
      data: holdings.map(h => ({
        name: h.fund_name,
        value: h.market_value,
      })),
    }],
  } : null;

  const barOption = holdings.length > 0 ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: holdings.map(h => h.fund_name.slice(0, 6)),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value', name: '盈亏(元)' },
    series: [{
      type: 'bar',
      data: holdings.map(h => ({
        value: h.pnl,
        itemStyle: { color: h.pnl >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600') },
      })),
    }],
  } : null;

  return (
    <>
      {holdings.length > 0 && pieOption && barOption && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="持仓分布">
              <ReactECharts theme={getEchartsTheme(isDark)} option={pieOption} style={{ height: 300 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="各基金盈亏">
              <ReactECharts theme={getEchartsTheme(isDark)} option={barOption} style={{ height: 300 }} />
            </Card>
          </Col>
        </Row>
      )}

      {holdings.length > 0 && benchmarkData.length > 0 && (
        <Card
          title="持仓 vs 沪深300 基准对比"
          style={{ marginBottom: 24 }}
        >
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
              legend: { data: ['我的持仓', '沪深300基准'], bottom: 0 },
              grid: { top: 20, right: 20, bottom: 40, left: 60 },
              xAxis: {
                type: 'category',
                data: benchmarkData.map(d => d.date),
                axisLabel: { fontSize: 10, interval: Math.floor(benchmarkData.length / 8) },
              },
              yAxis: {
                type: 'value',
                axisLabel: { formatter: '{value}%', fontSize: 10 },
                splitLine: { lineStyle: { type: 'dashed' } },
              },
              series: [
                {
                  name: '沪深300基准',
                  type: 'line',
                  data: benchmarkData.map(d => parseFloat(d.return_pct)),
                  lineStyle: { width: 2, color: isDark ? '#666' : '#999', type: 'dashed' },
                  itemStyle: { color: isDark ? '#666' : '#999' },
                  showSymbol: false,
                },
                {
                  name: '我的持仓',
                  type: 'line',
                  data: benchmarkData.map(() => summary?.totalReturn || 0),
                  lineStyle: { width: 2, color: '#1677ff' },
                  itemStyle: { color: '#1677ff' },
                  showSymbol: false,
                  areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                      colorStops: [
                        { offset: 0, color: 'rgba(22,119,255,0.15)' },
                        { offset: 1, color: 'rgba(22,119,255,0.02)' },
                      ],
                    },
                  },
                },
              ],
            }}
            style={{ height: 300 }}
            opts={{ renderer: 'svg' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>我的持仓收益</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: (summary?.totalReturn || 0) >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600') }}>
                {(summary?.totalReturn || 0) >= 0 ? '+' : ''}{(summary?.totalReturn || 0).toFixed(2)}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>沪深300同期</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: parseFloat(benchmarkData[benchmarkData.length - 1]?.return_pct || 0) >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600') }}>
                {benchmarkData.length > 0 ? `${parseFloat(benchmarkData[benchmarkData.length - 1].return_pct) >= 0 ? '+' : ''}${benchmarkData[benchmarkData.length - 1].return_pct}%` : '-'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>超额收益</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-purple)' }}>
                {benchmarkData.length > 0
                  ? `${((summary?.totalReturn || 0) - parseFloat(benchmarkData[benchmarkData.length - 1].return_pct)) >= 0 ? '+' : ''}${((summary?.totalReturn || 0) - parseFloat(benchmarkData[benchmarkData.length - 1].return_pct)).toFixed(2)}%`
                  : '-'}
              </div>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
