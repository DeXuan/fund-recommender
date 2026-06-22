import { Card, Row, Col, Tag } from 'antd';

interface StarManager {
  name: string;
  company: string;
  title: string;
  experience: string;
  specialty: string;
  bio: string;
  tags: string[];
}

interface StarManagersPanelProps {
  visible: boolean;
  isDark: boolean;
  starManagers: StarManager[];
  selectedManager: string;
  onSelectManager: (name: string) => void;
}

export function StarManagersPanel({ visible, isDark, starManagers, selectedManager, onSelectManager }: StarManagersPanelProps) {
  if (!visible || starManagers.length === 0) return null;

  return (
    <Card
      title={<span style={{ fontWeight: 600 }}>明星基金经理</span>}
      extra={<span style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c' }}>点击经理筛选其管理的基金</span>}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 16]}>
        {starManagers.map((mgr) => (
          <Col xs={24} sm={12} md={8} lg={6} key={mgr.name}>
            <Card
              size="small"
              hoverable
              style={{
                border: selectedManager === mgr.name ? '2px solid #722ed1' : `1px solid ${isDark ? '#262626' : '#f0f0f0'}`,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => onSelectManager(selectedManager === mgr.name ? '' : mgr.name)}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--gradient-card-purple)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-text-on-dark)', fontWeight: 700, fontSize: 16, marginRight: 12,
                }}>
                  {mgr.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{mgr.name}</div>
                  <div style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c' }}>{mgr.company}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}>
                <strong>职位：</strong>{mgr.title}
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}>
                <strong>经验：</strong>{mgr.experience} | <strong>擅长：</strong>{mgr.specialty}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                {mgr.bio}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {mgr.tags.map((tag) => (
                  <Tag key={tag} color="purple" style={{ fontSize: 11 }}>{tag}</Tag>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
