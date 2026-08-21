import { useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Divider,
  Tag,
  Timeline,
  Collapse,
  Row,
  Col,
  Statistic,
  Button,
} from 'antd';
import {
  StockOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  MobileOutlined,
  CodeOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  GithubOutlined,
  LockOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text } = Typography;

const APP_VERSION = '1.3.0';
const APP_BUILD = '20260821';

const changelog = [
  {
    version: 'v1.3.0',
    date: '2026-08-21',
    tag: 'latest' as const,
    color: 'blue',
    items: [
      '第四轮代码质量优化（7 项），综合评分提升至 8.9/10',
      'Portfolio.tsx 拆分 1568→721 行（-54%），接入 16 个已有子组件',
      'StockPicker.tsx 拆分 1448→1107 行（-23%），提取图表配置纯函数',
      'AIAssistant.tsx 拆分 1453→1334 行（-8%），提取渲染辅助模块',
      '新增 fund-service 单元测试 76 个（覆盖率语句 100%）',
      '新增支付/订阅 E2E 测试 10 个（7 机型全通过）',
      'catch(e:any) → catch(e:unknown) 类型安全修复（18 处）',
      'CI/CD 流水线增强 + 覆盖率门槛 + E2E 集成',
      '全量测试 670 个通过（单元 362 + E2E 308）',
    ],
  },
  {
    version: 'v1.2.1',
    date: '2026-08-18',
    color: 'default',
    items: [
      'AI 助手流式输出修复（真 SSE 逐字输出 + 连接复用提速）',
      'AI 接入备用免费网关，主模型切换为 GLM-4.5-Air（首 token ~0.7s）',
      '持仓明细新增资产类型筛选（招行理财 / 公募基金，按代码字母区分）',
      '移除赎回功能入口（暂无该业务）',
      '正式域名绑定（https://恭喜发财888.cn）、登录 CORS 白名单修复',
      '品牌更名"个人基金数据看板"、页面底部新增免责声明',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-08-16',
    color: 'default',
    items: [
      '实时财经日历接入（集思录数据源，新股/分红/可转债/期货交割）',
      '新闻与持仓行业智能匹配（个人化资讯推送）',
      '基金池优化：移除债券/货币类基金，聚焦 6500+ 股票/指数/QDII 基金',
      '金选基金扩容至 168 只、基金诊断路由挂载修复',
      '基金列表默认每页 30 条',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-06-28',
    tag: 'stable' as const,
    color: 'green',
    items: [
      'AI 选股引擎深度优化（七因子量化模型）',
      '安全加固 + 日志统一（50 处 console 迁移至 Winston）',
      '自然语言筛选（SVIP 专属）、指数温度计、相关性热力图',
      'A/B/C/D 基金评级体系',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-06-22',
    tag: 'stable' as const,
    color: 'green',
    items: [
      'Android APK 正式发布（Capacitor 8）',
      'AI 助手斜杠命令（/diagnose, /portfolio, /market 等）',
      '多账户资产台账、交易行为分析、目标规划',
      '"关于"页面上线',
    ],
  },
  {
    version: 'v0.9',
    date: '2026-06-21',
    color: 'cyan',
    items: [
      '后端架构分层重构（7 个领域路由模块）',
      '前端主题常量抽离（消除 1100+ 处硬编码颜色）',
      'AuthContext 统一 API 客户端',
    ],
  },
  {
    version: 'v0.8',
    date: '2026-06-21',
    color: 'purple',
    items: [
      'AI 助手上线（Claude API 集成）',
      '基金诊断、估值中心、持仓分析增强',
      'GSAP 滚动动画增强、浮动 AI 聊天组件',
    ],
  },
  {
    version: 'v0.7',
    date: '2026-06-11',
    color: 'orange',
    items: [
      '个人中心、基金对比路由',
      '全面安全审查 + 15 项安全修复',
      'SSE 实时推送改用 fetch + ReadableStream',
    ],
  },
  {
    version: 'v0.6',
    date: '2026-06-09',
    color: 'gold',
    items: [
      '禁用用户即时失效（authMiddleware 实时状态检查）',
      '管理后台上线（用户管理、系统监控）',
      '招行理财产品追踪',
    ],
  },
  {
    version: 'v0.5',
    date: '2026-06-08',
    color: 'lime',
    items: [
      'helmet 安全中间件集成',
      '标普 500 深度分析、基金经理管理',
      '行业分析从 9 个扩展到 14 个',
    ],
  },
  {
    version: 'v0.4',
    date: '2026-06-05',
    color: 'geekblue',
    items: [
      '自选基金、基金对比净值走势',
      '持仓 vs 基准对比、多因子筛选器',
      '智能提醒系统、首页持仓概览',
    ],
  },
  {
    version: 'v0.3',
    date: '2026-06-05',
    color: 'volcano',
    items: [
      '煤炭/陶瓷建材行业基金新增',
      '支付宝金选基金收录 69 只',
    ],
  },
  {
    version: 'v0.2',
    date: '2026-06-05',
    color: 'magenta',
    items: [
      '支付宝扫码登录集成',
      '一键部署/更新/修复脚本',
    ],
  },
  {
    version: 'v0.1',
    date: '2026-06-04',
    color: 'default',
    items: [
      '核心功能上线：基金列表、详情、对比、QDII、行业分析、沪深 300、市场估值',
    ],
  },
];

const techStack = {
  frontend: [
    { name: 'React 19', desc: 'UI 框架' },
    { name: 'TypeScript 6', desc: '类型安全' },
    { name: 'Vite 8', desc: '构建工具' },
    { name: 'Ant Design 6', desc: 'UI 组件库' },
    { name: 'React Router 7', desc: '路由管理' },
    { name: 'ECharts 6', desc: '图表可视化' },
    { name: 'GSAP 3', desc: '动画增强' },
    { name: 'React Markdown', desc: 'AI 渲染' },
  ],
  backend: [
    { name: 'Express 5', desc: 'Web 框架' },
    { name: 'PostgreSQL', desc: '关系数据库' },
    { name: 'Claude SDK', desc: 'AI 能力' },
    { name: 'JWT + bcrypt', desc: '认证安全' },
    { name: 'Winston', desc: '结构化日志' },
    { name: 'helmet', desc: '安全中间件' },
    { name: 'Alipay SDK', desc: '支付集成' },
    { name: 'express-rate-limit', desc: '速率限制' },
  ],
  mobile: [
    { name: 'Capacitor 8', desc: '跨平台打包' },
    { name: 'Android SDK 34', desc: '原生能力' },
    { name: 'WebView', desc: '渲染引擎' },
  ],
  data: [
    { name: '东方财富 API', desc: '基金净值（每 15 分钟）' },
    { name: '新浪财经 API', desc: '市场指数 & 板块数据' },
    { name: '集思录 API', desc: '实时财经日历事件' },
    { name: '支付宝 API', desc: 'OAuth 登录 & 扫码支付' },
  ],
  testing: [
    { name: 'Vitest 3', desc: '前端单元测试（128 个）' },
    { name: 'node:test', desc: '后端单元测试（234 个）' },
    { name: 'Playwright', desc: 'E2E 测试（308 个 / 7 机型）' },
    { name: 'GitHub Actions', desc: 'CI/CD 流水线' },
  ],
};

const stats = [
  { title: '前端代码', value: '25,269', suffix: '行' },
  { title: '后端代码', value: '17,719', suffix: '行' },
  { title: 'API 端点', value: '123', suffix: '个' },
  { title: '基金数量', value: '6,569', suffix: '只' },
  { title: 'React 组件', value: '50', suffix: '个' },
  { title: '页面路由', value: '23', suffix: '个' },
];

export default function About() {
  const { isDark } = useTheme();
  const [showAllChangelog, setShowAllChangelog] = useState(false);

  const cardStyle = {
    borderRadius: 16,
    marginBottom: 24,
    boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.08)',
  };

  const sectionTitleStyle = {
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const displayedChangelog = showAllChangelog ? changelog : changelog.slice(0, 5);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px' }}>
      {/* Hero */}
      <Card style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(22, 119, 255, 0.4)',
              marginBottom: 16,
            }}
          >
            <StockOutlined style={{ fontSize: 44, color: '#fff' }} />
          </div>
          <Title level={3} style={{ marginBottom: 4 }}>
            个人基金数据看板
          </Title>
          <Text type="secondary" style={{ fontSize: 15 }}>
            智能投资分析平台
          </Text>
          <div style={{ marginTop: 12 }}>
            <Space>
              <Tag color="blue" style={{ fontSize: 14, padding: '2px 14px' }}>
                v{APP_VERSION}
              </Tag>
              <Tag style={{ fontSize: 12, padding: '2px 10px' }}>
                Build {APP_BUILD}
              </Tag>
            </Space>
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        <Row gutter={[16, 16]}>
          {stats.map((s) => (
            <Col xs={8} sm={4} key={s.title}>
              <Statistic
                title={s.title}
                value={s.value}
                suffix={s.suffix}
                valueStyle={{ fontSize: 18, fontWeight: 700 }}
              />
            </Col>
          ))}
        </Row>
      </Card>

      {/* 版权 & 制作信息 */}
      <Card style={cardStyle}>
        <div style={sectionTitleStyle}>
          <SafetyOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            版权信息
          </Title>
        </div>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={12}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">制作人</Text>
                <div><Text strong style={{ fontSize: 16 }}>guandexun</Text></div>
              </div>
              <div>
                <Text type="secondary">版权所有</Text>
                <div>
                  <Space>
                    <LockOutlined style={{ color: '#52c41a' }} />
                    <Text>© 2024-2026 guandexun. All rights reserved.</Text>
                  </Space>
                </div>
              </div>
              <div>
                <Text type="secondary">开源许可</Text>
                <div><Tag>ISC License</Tag></div>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={12}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div>
                <Text type="secondary">项目仓库</Text>
                <div>
                  <Space>
                    <GithubOutlined />
                    <a href="https://github.com/DeXuan/fund-recommender" target="_blank" rel="noopener noreferrer" style={{ color: '#1677ff' }}>
                      fund-recommender
                    </a>
                  </Space>
                </div>
              </div>
              <div>
                <Text type="secondary">数据来源</Text>
                <div>
                  <Text>东方财富 · 新浪财经 · 支付宝</Text>
                </div>
              </div>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            本应用所有数据仅供参考，不构成任何投资建议。投资有风险，入市需谨慎。
          </Text>
        </div>
      </Card>

      {/* 功能更新记录 */}
      <Card style={cardStyle}>
        <div style={sectionTitleStyle}>
          <HistoryOutlined style={{ color: '#1677ff', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            功能更新记录
          </Title>
        </div>
        <Timeline
          items={displayedChangelog.map((entry) => ({
            color: entry.color,
            children: (
              <div>
                <Space style={{ marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 15 }}>
                    {entry.version}
                  </Text>
                  <Tag
                    color={entry.color}
                    style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}
                  >
                    {entry.date}
                  </Tag>
                  {entry.tag === 'latest' && (
                    <Tag color="blue" style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                      最新
                    </Tag>
                  )}
                  {entry.tag === 'stable' && (
                    <Tag color="green" style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                      稳定版
                    </Tag>
                  )}
                </Space>
                <ul style={{ margin: 0, paddingLeft: 18, color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)' }}>
                  {entry.items.map((item, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: '22px' }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ),
          }))}
        />
        {changelog.length > 5 && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Button type="link" onClick={() => setShowAllChangelog(!showAllChangelog)}>
              {showAllChangelog ? '收起' : `查看全部 ${changelog.length} 个版本`}
            </Button>
          </div>
        )}
      </Card>

      {/* 技术架构 */}
      <Card style={cardStyle}>
        <div style={sectionTitleStyle}>
          <ApartmentOutlined style={{ color: '#722ed1', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            技术架构
          </Title>
        </div>

        <Collapse
          defaultActiveKey={['frontend', 'backend']}
          ghost
          items={[
            {
              key: 'frontend',
              label: (
                <Space>
                  <CodeOutlined style={{ color: '#1677ff' }} />
                  <Text strong>前端技术栈</Text>
                  <Tag>{techStack.frontend.length} 项</Tag>
                </Space>
              ),
              children: (
                <Row gutter={[12, 12]}>
                  {techStack.frontend.map((t) => (
                    <Col xs={12} sm={8} key={t.name}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'backend',
              label: (
                <Space>
                  <CloudServerOutlined style={{ color: '#52c41a' }} />
                  <Text strong>后端技术栈</Text>
                  <Tag>{techStack.backend.length} 项</Tag>
                </Space>
              ),
              children: (
                <Row gutter={[12, 12]}>
                  {techStack.backend.map((t) => (
                    <Col xs={12} sm={8} key={t.name}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'mobile',
              label: (
                <Space>
                  <MobileOutlined style={{ color: '#fa8c16' }} />
                  <Text strong>移动端</Text>
                  <Tag>{techStack.mobile.length} 项</Tag>
                </Space>
              ),
              children: (
                <Row gutter={[12, 12]}>
                  {techStack.mobile.map((t) => (
                    <Col xs={12} sm={8} key={t.name}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'data',
              label: (
                <Space>
                  <DatabaseOutlined style={{ color: '#eb2f96' }} />
                  <Text strong>数据源</Text>
                  <Tag>{techStack.data.length} 项</Tag>
                </Space>
              ),
              children: (
                <Row gutter={[12, 12]}>
                  {techStack.data.map((t) => (
                    <Col xs={12} sm={8} key={t.name}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            },
            {
              key: 'testing',
              label: (
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text strong>测试工具</Text>
                  <Tag>{techStack.testing.length} 项</Tag>
                </Space>
              ),
              children: (
                <Row gutter={[12, 12]}>
                  {techStack.testing.map((t) => (
                    <Col xs={12} sm={8} key={t.name}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      >
                        <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{t.desc}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            },
          ]}
        />

        <Divider style={{ margin: '16px 0' }} />

        {/* 架构图 */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 12,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: '20px',
            overflowX: 'auto',
            whiteSpace: 'pre',
            color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
          }}
        >
{`┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  React SPA   │     │ Android APK  │     │   浏览器      │
│  (Vite 8)    │     │ (Capacitor)  │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                   ┌────────▼────────┐
                   │     Nginx       │
                   │   反向代理       │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │   Express 5     │
                   │  JWT + helmet   │
                   │  7 个路由模块    │
                   └───┬────────┬───┘
                       │        │
              ┌────────▼──┐  ┌──▼──────────┐
              │ PostgreSQL │  │ 外部 API    │
              │  (31 张表) │  │ 东方财富/   │
              │            │  │ 支付宝/Claude│
              └────────────┘  └─────────────┘`}
        </div>
      </Card>

      {/* 环境要求 */}
      <Card style={cardStyle}>
        <div style={sectionTitleStyle}>
          <ThunderboltOutlined style={{ color: '#faad14', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>
            环境要求
          </Title>
        </div>
        <Row gutter={[12, 12]}>
          {[
            { icon: <CodeOutlined />, name: 'Node.js', ver: '>= 20 LTS', color: '#52c41a' },
            { icon: <DatabaseOutlined />, name: 'PostgreSQL', ver: '>= 14', color: '#1677ff' },
            { icon: <CloudServerOutlined />, name: 'Nginx', ver: '>= 1.18', color: '#52c41a' },
            { icon: <GlobalOutlined />, name: 'Python', ver: '>= 3.8', color: '#faad14' },
            { icon: <MobileOutlined />, name: 'JDK', ver: '>= 17', color: '#eb2f96' },
            { icon: <MobileOutlined />, name: 'Android SDK', ver: '>= 34', color: '#fa8c16' },
          ].map((env) => (
            <Col xs={12} sm={8} key={env.name}>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ color: env.color, fontSize: 18 }}>{env.icon}</span>
                <div>
                  <Text strong style={{ fontSize: 13 }}>{env.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{env.ver}</Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
