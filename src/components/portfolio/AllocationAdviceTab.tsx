import { useState, useEffect, useMemo } from 'react';
import { Card, Spin, Empty, Tag, Space, Table, Row, Col, Alert } from 'antd';
import { PieChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { portfolioApi } from '../../services/api';
import { getEchartsTheme } from '../../utils/echarts-theme';
import { useTheme } from '../../contexts/ThemeContext';

interface AllocationItem {
  category: string;
  weight: number;
  value: number;
  funds?: Array<{ fund_code: string; fund_name: string; value: number }>;
}

interface GapItem {
  category: string;
  currentWeight: number;
  targetWeight: number;
  diff: number;
  action: string;
  value: number;
}

interface AdviceData {
  currentAllocation: AllocationItem[];
  suggestedAllocation: Array<{ category: string; targetWeight: number }>;
  gaps: GapItem[];
  suggestions: string[];
  riskType: string | null;
  totalValue: number;
}

const RISK_LABELS: Record<string, string> = {
  conservative: '保守型',
  balanced: '平衡型',
  aggressive: '进取型',
};

const COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];

export function AllocationAdviceTab() {
  const { isDark } = useTheme();
  const [data, setData] = useState<AdviceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    portfolioApi.getAllocationAdvice()
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const currentChartOption = useMemo(() => {
    if (!data || !data.currentAllocation.length) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}% ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        label: { formatter: '{b}\n{d}%', fontSize: 11 },
        data: data.currentAllocation.map(a => ({ name: a.category, value: a.weight })),
      }],
      color: COLORS,
    };
  }, [data]);

  const suggestedChartOption = useMemo(() => {
    if (!data || !data.suggestedAllocation.length) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        label: { formatter: '{b}\n{d}%', fontSize: 11 },
        data: data.suggestedAllocation.map(a => ({ name: a.category, value: a.targetWeight })),
      }],
      color: COLORS,
    };
  }, [data]);

  if (loading) {
    return <Card title={<span><PieChartOutlined /> 资产配置建议</span>} size="small"><div style={{ textAlign: 'center', padding: 48 }}><Spin /></div></Card>;
  }

  if (!data || data.currentAllocation.length === 0) {
    return <Card title={<span><PieChartOutlined /> 资产配置建议</span>} size="small"><Empty description={data?.suggestions?.[0] || '暂无数据'} /></Card>;
  }

  const actionColor = (action: string) => action === '减仓' ? 'red' : action === '加仓' ? 'green' : 'default';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card
        title={<span><PieChartOutlined /> 资产配置建议 {data.riskType && <Tag color="blue" style={{ marginLeft: 8 }}>{RISK_LABELS[data.riskType] || data.riskType}</Tag>}</span>}
        size="small"
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 500 }}>当前配置</div>
            <ReactECharts option={currentChartOption} theme={getEchartsTheme(isDark)} style={{ height: 280 }} />
          </Col>
          <Col xs={24} md={12}>
            <div style={{ textAlign: 'center', marginBottom: 8, fontWeight: 500 }}>建议配置</div>
            <ReactECharts option={suggestedChartOption} theme={getEchartsTheme(isDark)} style={{ height: 280 }} />
          </Col>
        </Row>
      </Card>

      <Card title="配置差距分析" size="small">
        <Table
          dataSource={data.gaps}
          rowKey="category"
          size="small"
          pagination={false}
          columns={[
            { title: '资产类别', dataIndex: 'category', key: 'category' },
            { title: '当前占比', dataIndex: 'currentWeight', key: 'currentWeight', width: 100, render: (v: number) => `${v}%` },
            { title: '目标占比', dataIndex: 'targetWeight', key: 'targetWeight', width: 100, render: (v: number) => `${v}%` },
            {
              title: '差距',
              dataIndex: 'diff',
              key: 'diff',
              width: 100,
              render: (v: number) => <span style={{ color: Math.abs(v) > 5 ? (v > 0 ? '#ff4d4f' : '#52c41a') : 'inherit', fontWeight: 600 }}>{v > 0 ? '+' : ''}{v}%</span>,
            },
            { title: '建议操作', dataIndex: 'action', key: 'action', width: 80, render: (v: string) => <Tag color={actionColor(v)}>{v}</Tag> },
          ]}
        />
      </Card>

      {data.suggestions.length > 0 && (
        <Card title="调仓建议" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            {data.suggestions.map((s, i) => (
              <Alert key={i} message={s} type={i === 0 ? 'info' : 'warning'} showIcon />
            ))}
          </Space>
        </Card>
      )}
    </Space>
  );
}
