import { Card, Descriptions, Typography, Space, Divider, Tag } from 'antd';
import { StockOutlined, GithubOutlined, SafetyOutlined } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text, Link } = Typography;

const APP_VERSION = '1.0.0';
const APP_BUILD = '20260622';

export default function About() {
  const { isDark } = useTheme();

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <Card
        style={{
          borderRadius: 16,
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(22, 119, 255, 0.4)',
              marginBottom: 16,
            }}
          >
            <StockOutlined style={{ fontSize: 40, color: '#fff' }} />
          </div>
          <Title level={3} style={{ marginBottom: 4 }}>
            基金推荐助手
          </Title>
          <Text type="secondary">智能投资分析平台</Text>
        </div>

        <Divider />

        {/* 版本信息 */}
        <Descriptions column={1} size="middle" labelStyle={{ fontWeight: 600, width: 100 }}>
          <Descriptions.Item label="版本号">
            <Space>
              <Tag color="blue" style={{ fontSize: 14, padding: '2px 12px' }}>
                v{APP_VERSION}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Build {APP_BUILD}
              </Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="制作人">
            <Text strong>guandexun</Text>
          </Descriptions.Item>
          <Descriptions.Item label="版权所有">
            <Space>
              <SafetyOutlined style={{ color: '#52c41a' }} />
              <Text>© 2024-2026 guandexun. All rights reserved.</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="技术栈">
            <Space wrap>
              <Tag>React 19</Tag>
              <Tag>TypeScript</Tag>
              <Tag>Ant Design</Tag>
              <Tag>ECharts</Tag>
              <Tag>Capacitor</Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="后端服务">
            <Text>Node.js + PostgreSQL</Text>
          </Descriptions.Item>
          <Descriptions.Item label="服务器">
            <Text copyable style={{ fontSize: 12 }}>
              111.229.32.106:3003
            </Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            本应用所有数据仅供参考，不构成投资建议
          </Text>
        </div>
      </Card>
    </div>
  );
}
