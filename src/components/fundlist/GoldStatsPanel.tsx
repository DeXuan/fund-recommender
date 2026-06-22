import { Card, Row, Col, Space, Tag } from 'antd';

interface GoldStatsPanelProps {
  visible: boolean;
  isDark: boolean;
  goldStats: any;
}

export function GoldStatsPanel({ visible, isDark, goldStats }: GoldStatsPanelProps) {
  if (!visible || !goldStats) return null;

  return (
    <Card
      title={
        <Space>
          <span style={{ fontSize: 18, color: 'var(--warning)' }}>★</span>
          <span style={{ fontWeight: 600 }}>金选基金统计概览</span>
        </Space>
      }
      extra={<span style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c' }}>来自支付宝精选基金池</span>}
      style={{ marginBottom: 16, border: '1px solid var(--warning)' }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <div style={{ textAlign: 'center', padding: 16, background: isDark ? '#2b2111' : '#fffbe6', borderRadius: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning)' }}>{goldStats.total}</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>金选基金总数</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div style={{ textAlign: 'center', padding: 16, background: isDark ? '#162312' : '#f6ffed', borderRadius: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{goldStats.returns?.avg1y || '-'}%</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>平均近1年收益</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div style={{ textAlign: 'center', padding: 16, background: isDark ? '#111a2c' : '#e6f4ff', borderRadius: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{goldStats.fees?.avg ? (goldStats.fees.avg * 100).toFixed(2) : '-'}%</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>平均综合费率</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div style={{ textAlign: 'center', padding: 16, background: isDark ? '#2c1618' : '#fff2f0', borderRadius: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{goldStats.scale?.total || '-'}亿</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>总规模</div>
          </div>
        </Col>
      </Row>
      {goldStats.categories && goldStats.categories.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>分类分布</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {goldStats.categories.slice(0, 10).map((cat: any) => (
              <Tag key={cat.name} color="gold">
                {cat.name}: {cat.count}只
              </Tag>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
