import { useState, useEffect } from 'react';
import { Card, Row, Col, Tag, Spin, Space, Tooltip, Button, Select, Empty } from 'antd';
import { BarChartOutlined, RiseOutlined, FallOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';
import { Link } from 'react-router-dom';

interface IndexValuation {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  pe: number | null;
  pb: number | null;
  pePercentile: number | null;
  pbPercentile: number | null;
  roe: number | null;
  dividendYield: number | null;
  valuation: string | null;
  suggestion: string | null;
  history: {
    dataPoints: number;
    peMin: number | null;
    peMax: number | null;
    peAvg: number | null;
    pbMin: number | null;
    pbMax: number | null;
    pbAvg: number | null;
  };
  trend: { pe: number; pb: number; date: string }[];
}

const getValuationColor = (p: number | null) => {
  if (p === null || p === undefined) return '#999';
  if (p < 20) return '#52c41a';
  if (p < 40) return '#73d13d';
  if (p < 60) return '#1677ff';
  if (p < 80) return '#faad14';
  return '#ff4d4f';
};

const getValuationBg = (p: number | null, isDark: boolean) => {
  if (isDark) {
    if (p === null || p === undefined) return '#262626';
    if (p < 20) return '#162312';
    if (p < 40) return '#111d2c';
    if (p < 60) return '#111a2c';
    if (p < 80) return '#2b2111';
    return '#2c1618';
  }
  if (p === null || p === undefined) return '#f5f5f5';
  if (p < 20) return '#f6ffed';
  if (p < 40) return '#e6fffb';
  if (p < 60) return '#e6f4ff';
  if (p < 80) return '#fffbe6';
  return '#fff2f0';
};

const getValuationLabel = (p: number | null) => {
  if (p === null || p === undefined) return '未知';
  if (p < 20) return '极度低估';
  if (p < 40) return '偏低估';
  if (p < 60) return '合理';
  if (p < 80) return '偏高估';
  return '极度高估';
};

export default function ValuationCenter() {
  const { isDark } = useTheme();
  const [indices, setIndices] = useState<IndexValuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendDays, setTrendDays] = useState(365);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCode) loadTrend(selectedCode, trendDays);
  }, [selectedCode, trendDays]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getValuationCenter();
      setIndices(data);
      if (data.length > 0 && !selectedCode) {
        setSelectedCode(data[0].code);
      }
    } catch (e) {
      console.error('加载估值数据失败:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadTrend = async (code: string, days: number) => {
    setTrendLoading(true);
    try {
      const result = await fundApi.getIndexValuationTrend(code, days);
      setTrendData(result?.data || []);
    } catch (e) {
      console.error('加载趋势数据失败:', e);
    } finally {
      setTrendLoading(false);
    }
  };

  const selected = indices.find(i => i.code === selectedCode);

  const getTrendOption = () => {
    if (!trendData.length) return {};
    const dates = trendData.map(d => {
      const date = new Date(d.date);
      return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    });
    const peValues = trendData.map(d => d.pe);
    const pbValues = trendData.map(d => d.pb);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const date = trendData[params[0]?.dataIndex]?.date || '';
          let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
          params.forEach((p: any) => {
            html += `<div>${p.marker} ${p.seriesName}: ${p.value?.toFixed(2)}</div>`;
          });
          return html;
        },
      },
      legend: { data: ['PE', 'PB'], top: 0, textStyle: { color: 'var(--text-secondary)' } },
      grid: { top: 40, left: 50, right: 50, bottom: 30 },
      xAxis: { type: 'category', data: dates, axisLabel: { color: 'var(--color-text-muted)', fontSize: 11 } },
      yAxis: [
        { type: 'value', name: 'PE', position: 'left', axisLabel: { color: 'var(--color-text-muted)' } },
        { type: 'value', name: 'PB', position: 'right', axisLabel: { color: 'var(--color-text-muted)' } },
      ],
      series: [
        {
          name: 'PE', type: 'line', data: peValues, yAxisIndex: 0,
          lineStyle: { color: '#1677ff', width: 2 },
          itemStyle: { color: '#1677ff' },
          showSymbol: false, smooth: true,
        },
        {
          name: 'PB', type: 'line', data: pbValues, yAxisIndex: 1,
          lineStyle: { color: '#52c41a', width: 2 },
          itemStyle: { color: '#52c41a' },
          showSymbol: false, smooth: true,
        },
      ],
    };
  };

  const getPercentileBarOption = () => {
    if (!selected) return {};
    const pe = selected.pePercentile ?? 50;
    const pb = selected.pbPercentile ?? 50;
    return {
      tooltip: { trigger: 'axis' },
      grid: { top: 20, left: 80, right: 30, bottom: 30 },
      xAxis: { type: 'value', max: 100, show: false },
      yAxis: { type: 'category', data: ['PB分位', 'PE分位'], axisLabel: { color: 'var(--text-secondary)' } },
      series: [
        {
          type: 'bar',
          data: [
            { value: pb, itemStyle: { color: getValuationColor(pb), borderRadius: [0, 4, 4, 0] } },
            { value: pe, itemStyle: { color: getValuationColor(pe), borderRadius: [0, 4, 4, 0] } },
          ],
          barWidth: 24,
          label: { show: true, position: 'right', formatter: '{c}%', color: isDark ? '#e8e8e8' : '#333', fontWeight: 600 },
          backgroundStyle: { color: isDark ? '#262626' : '#f0f0f0', borderRadius: 4 },
          showBackground: true,
        },
      ],
    };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载估值数据..." /></div>;
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <BarChartOutlined style={{ color: 'var(--primary)' }} />
        指数估值中心
      </h1>
      <p style={{ marginBottom: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
        基于历史PE/PB数据计算真实百分位数，辅助判断指数高估/低估状态
      </p>

      {/* 估值总览卡片 */}
      {indices.length === 0 && !loading && (
        <Card style={{ marginBottom: 24 }}>
          <Empty description="暂无估值数据，请稍后再试" />
        </Card>
      )}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {indices.map(idx => {
          const p = idx.pePercentile ?? 50;
          const color = getValuationColor(p);
          const isSelected = idx.code === selectedCode;
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={idx.code}>
              <Card
                hoverable
                onClick={() => setSelectedCode(idx.code)}
                style={{
                  border: isSelected ? `2px solid ${color}` : `1px solid ${isDark ? '#333' : '#e8e8e8'}`,
                  background: isSelected ? getValuationBg(p, isDark) : undefined,
                  cursor: 'pointer',
                }}
                bodyStyle={{ padding: 16 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{idx.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{idx.code}</div>
                  </div>
                  <Tag color={color} style={{ margin: 0 }}>{getValuationLabel(p)}</Tag>
                </div>

                {/* PE分位条 */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>PE分位</span>
                    <span style={{ fontWeight: 600, color }}>{p}%</span>
                  </div>
                  <div style={{ height: 8, background: isDark ? '#262626' : '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>

                {/* 关键指标 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>PE {idx.pe?.toFixed(1) || '-'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>PB {idx.pb?.toFixed(2) || '-'}</span>
                  {idx.changePercent !== null && (
                    <span style={{ color: idx.changePercent >= 0 ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
                      {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent?.toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* 建议 */}
                {idx.suggestion && (
                  <div style={{ marginTop: 8, fontSize: 12, color, fontWeight: 500, textAlign: 'center', padding: '4px 0', background: `${color}10`, borderRadius: 4 }}>
                    {idx.suggestion}
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 详情区域 */}
      {selected && (
        <Row gutter={24}>
          {/* 左侧：详细指标 */}
          <Col xs={24} lg={8}>
            <Card title={<span style={{ fontWeight: 600 }}>{selected.name} 详细估值</span>} style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'PE(TTM)', value: selected.pe?.toFixed(2), suffix: '倍' },
                  { label: 'PB(MRQ)', value: selected.pb?.toFixed(3), suffix: '倍' },
                  { label: 'PE分位', value: `${selected.pePercentile ?? '-'}`, suffix: '%' },
                  { label: 'PB分位', value: `${selected.pbPercentile ?? '-'}`, suffix: '%' },
                  { label: 'ROE', value: selected.roe?.toFixed(2), suffix: '%' },
                  { label: '股息率', value: selected.dividendYield?.toFixed(2), suffix: '%' },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: 'center', padding: 12, background: isDark ? '#1f1f1f' : '#fafafa', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#e8e8e8' : '#1f1f1f' }}>
                      {item.value || '-'}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>{item.suffix}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 历史区间 */}
              {selected.history.dataPoints > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: isDark ? '#111a2c' : '#e6f4ff', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>
                    历史统计（{selected.history.dataPoints}个数据点）
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>PE最低</div>
                      <div style={{ fontWeight: 600, color: 'var(--success)' }}>{selected.history.peMin?.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>PE均值</div>
                      <div style={{ fontWeight: 600 }}>{selected.history.peAvg?.toFixed(1)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>PE最高</div>
                      <div style={{ fontWeight: 600, color: 'var(--danger)' }}>{selected.history.peMax?.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* 分位数对比 */}
            <Card title={<span style={{ fontWeight: 600 }}>分位数对比</span>}>
              <ReactECharts option={getPercentileBarOption()} theme={getEchartsTheme(isDark)} style={{ height: 120 }} />
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <p style={{ margin: 0 }}><span style={{ color: 'var(--success)' }}>低于20%</span>：极度低估，适合加大投入</p>
                <p style={{ margin: 0 }}><span style={{ color: 'var(--primary)' }}>20%-60%</span>：合理偏低，适合定投</p>
                <p style={{ margin: 0 }}><span style={{ color: 'var(--warning)' }}>60%-80%</span>：偏高估，谨慎加仓</p>
                <p style={{ margin: 0 }}><span style={{ color: 'var(--danger)' }}>高于80%</span>：极度高估，建议减仓</p>
              </div>
            </Card>
          </Col>

          {/* 右侧：趋势图 */}
          <Col xs={24} lg={16}>
            <Card
              title={<span style={{ fontWeight: 600 }}>{selected.name} PE/PB走势</span>}
              extra={
                <Space>
                  <Select value={trendDays} onChange={setTrendDays} size="small" style={{ width: 100 }}>
                    <Select.Option value={90}>近3个月</Select.Option>
                    <Select.Option value={180}>近半年</Select.Option>
                    <Select.Option value={365}>近1年</Select.Option>
                    <Select.Option value={730}>近2年</Select.Option>
                  </Select>
                  <Button icon={<ReloadOutlined />} size="small" onClick={() => loadTrend(selectedCode, trendDays)} />
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              {trendLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              ) : trendData.length > 0 ? (
                <ReactECharts option={getTrendOption()} theme={getEchartsTheme(isDark)} style={{ height: 350 }} />
              ) : (
                <Empty description="暂无历史数据，系统每日自动采集" />
              )}
            </Card>

            {/* 投资建议卡 */}
            <Card
              title={<span style={{ fontWeight: 600 }}>投资建议</span>}
              style={{ background: getValuationBg(selected.pePercentile, isDark), border: `1px solid ${getValuationColor(selected.pePercentile)}30` }}
            >
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <div style={{ fontSize: 32, fontWeight: 700, color: getValuationColor(selected.pePercentile) }}>
                      {selected.pePercentile ?? '-'}%
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>当前PE分位</div>
                    <Tag color={getValuationColor(selected.pePercentile)} style={{ marginTop: 8 }}>
                      {getValuationLabel(selected.pePercentile)}
                    </Tag>
                  </div>
                </Col>
                <Col span={16}>
                  <div style={{ padding: 16, fontSize: 13, lineHeight: 2 }}>
                    <p style={{ margin: 0 }}><strong>当前状态：</strong>{selected.valuation || getValuationLabel(selected.pePercentile)}</p>
                    <p style={{ margin: 0 }}><strong>操作建议：</strong>{selected.suggestion || '观望为主'}</p>
                    {selected.pePercentile !== null && selected.pePercentile < 40 && (
                      <p style={{ margin: 0, color: '#52c41a' }}>当前估值处于历史低位，是布局的好时机</p>
                    )}
                    {selected.pePercentile !== null && selected.pePercentile > 80 && (
                      <p style={{ margin: 0, color: '#ff4d4f' }}>当前估值处于历史高位，注意控制仓位</p>
                    )}
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                      数据来源：腾讯行情+东方财富，每日自动更新
                    </p>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
