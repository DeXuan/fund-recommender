import { useState, useEffect } from 'react';
import { Card, Progress, Spin, Empty, Tag, Space, Row, Col } from 'antd';
import { HeartOutlined } from '@ant-design/icons';
import { portfolioApi } from '../services/api';

interface Dimension {
  score: number;
  label: string;
  detail: string;
}

interface HealthScoreData {
  score: number;
  dimensions: Record<string, Dimension>;
  suggestions: string[];
}

function getScoreColor(score: number) {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  if (score >= 40) return '#fa8c16';
  return '#ff4d4f';
}

function getScoreLabel(score: number) {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '需改善';
}

export default function HealthScore() {
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    portfolioApi.getHealthScore()
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Card title={<span><HeartOutlined /> 持仓健康度</span>} size="small"><div style={{ textAlign: 'center', padding: 24 }}><Spin /></div></Card>;
  }

  if (!data || data.score === 0) {
    return <Card title={<span><HeartOutlined /> 持仓健康度</span>} size="small"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={data?.suggestions?.[0] || '暂无数据'} /></Card>;
  }

  const dimensions = Object.entries(data.dimensions);

  return (
    <Card
      title={<span><HeartOutlined style={{ color: getScoreColor(data.score) }} /> 持仓健康度</span>}
      size="small"
    >
      <Row gutter={16} align="middle">
        <Col span={8} style={{ textAlign: 'center' }}>
          <Progress
            type="dashboard"
            percent={data.score}
            size={120}
            strokeColor={getScoreColor(data.score)}
            format={() => (
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: getScoreColor(data.score) }}>{data.score}</div>
                <div style={{ fontSize: 12 }}>{getScoreLabel(data.score)}</div>
              </div>
            )}
          />
        </Col>
        <Col span={16}>
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            {dimensions.map(([key, dim]) => (
              <div key={key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{dim.label}</span>
                  <span style={{ fontSize: 12, color: getScoreColor(dim.score), fontWeight: 600 }}>{dim.score}</span>
                </div>
                <Progress
                  percent={dim.score}
                  size="small"
                  strokeColor={getScoreColor(dim.score)}
                  showInfo={false}
                />
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{dim.detail}</div>
              </div>
            ))}
          </Space>
        </Col>
      </Row>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color-light)' }}>
        {data.suggestions.map((s, i) => (
          <Tag key={i} color={i === 0 && data.score >= 80 ? 'green' : 'orange'} style={{ marginBottom: 4, fontSize: 11 }}>
            {s}
          </Tag>
        ))}
      </div>
    </Card>
  );
}
