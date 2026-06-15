import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Tag, Timeline, Select, Space, Typography, Row, Col, Badge, Tooltip, Empty, Spin, Collapse, Button, List } from 'antd';
import {
  CalendarOutlined, FileProtectOutlined, GlobalOutlined, ShopOutlined,
  BarChartOutlined, BankOutlined, ThunderboltOutlined, FireOutlined,
  FilterOutlined, ClockCircleOutlined, BellOutlined, StarOutlined,
  StockOutlined, RiseOutlined, FallOutlined, EyeOutlined, LinkOutlined,
  ReloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { marketEventsApi, newsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import NewsFeed from '../components/NewsFeed';

const { Text, Paragraph } = Typography;

const monthNames = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const categoryIcons: Record<string, React.ReactNode> = {
  policy: <FileProtectOutlined />, summit: <GlobalOutlined />, expo: <ShopOutlined />,
  earnings: <BarChartOutlined />, global: <BankOutlined />, holiday: <CalendarOutlined />, event: <ThunderboltOutlined />,
};

// 统一的状态标签样式
const statusTag = (bg: string, color: string, text: string) => (
  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: bg, color }}>{text}</span>
);

export default function MarketEvents() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const c = isDark
    ? { bg: '#1a1a1a', bg2: '#262626', bg3: '#1f1f1f', border: '#333', borderLight: '#262626', text: '#e8e8e8', text2: '#a0a0a0', text3: '#6b6b6b', primaryBg: '#111a2c', primaryBorder: '#15395b', dangerBg: '#2c1618', dangerBorder: '#58181c', warningBg: '#2b2111', warningBorder: '#594214', tagBg: '#262626', btnBg: '#1f1f1f', hoverBg: '#2a2a2a' }
    : { bg: '#fff', bg2: '#fafafa', bg3: '#f5f5f5', border: '#d9d9d9', borderLight: '#f0f0f0', text: '#1f1f1f', text2: '#595959', text3: '#8c8c8c', primaryBg: '#e6f4ff', primaryBorder: '#91caff', dangerBg: '#fff2f0', dangerBorder: '#ffccc7', warningBg: '#fffbe6', warningBorder: '#ffe58f', tagBg: '#f5f5f5', btnBg: '#fff', hoverBg: '#f0f0f0' };
  const [events, setEvents] = useState<any[]>([]);
  const [categoryConfig, setCategoryConfig] = useState<Record<string, any>>({});
  const [impactConfig, setImpactConfig] = useState<Record<string, any>>({});
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterImpact, setFilterImpact] = useState<string>('');
  const [viewMode, setViewMode] = useState<string>('timeline');
  const [activeTab, setActiveTab] = useState<string>(user ? 'personal' : 'news');

  const currentMonth = new Date().getMonth() + 1;
  const defaultMonth = currentMonth >= 7 && currentMonth <= 12 ? currentMonth : 7;

  useEffect(() => {
    marketEventsApi.getEvents().then(data => {
      setEvents(data.events);
      setCategoryConfig(data.categoryConfig);
      setImpactConfig(data.impactConfig);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (filterCategory || filterImpact) {
      marketEventsApi.getEvents({ category: filterCategory || undefined, impact: filterImpact || undefined })
        .then(data => { setEvents(data.events); }).catch(() => {});
    }
  }, [filterCategory, filterImpact]);

  const eventsByMonth: Record<number, any[]> = {};
  events.forEach(e => {
    if (!eventsByMonth[e.month]) eventsByMonth[e.month] = [];
    eventsByMonth[e.month].push(e);
  });
  const months = Object.keys(eventsByMonth).map(Number).sort((a, b) => a - b);

  const tabs = [
    ...(user ? [{ key: 'personal', label: '与我相关', icon: <StarOutlined /> }] : []),
    { key: 'news', label: '实时快讯', icon: <BellOutlined /> },
    { key: 'calendar', label: '事件日历', icon: <CalendarOutlined /> },
  ];

  return (
    <div>
      {/* 页面标题 */}
      <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <CalendarOutlined style={{ color: '#1677ff' }} />
        市场事件与实时快讯
      </h1>
      <p style={{ marginBottom: 24, fontSize: 13, color: c.text2 }}>
        峰会、博览会、政策会议、业绩发布等重大事件日历 + 实时财经快讯与持仓关联提醒
      </p>

      {/* Hero 统计卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16, padding: '24px 32px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16,
      }}>
        {[
          { value: events.length, label: '全年事件' },
          { value: events.filter(e => e.impact === 'high').length, label: '高影响事件' },
          { value: events.filter(e => e.month === currentMonth).length, label: `${currentMonth}月事件` },
          { value: Object.keys(categoryConfig).length, label: '事件类别' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 标签切换 — 与项目统一的下划线风格 */}
      <div style={{
        background: c.bg, borderRadius: 12, padding: 0,
        marginBottom: 24, boxShadow: 'var(--shadow-sm)',
        border: `1px solid ${c.borderLight}`,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${c.border}` }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 24px', border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                color: activeTab === tab.key ? '#1677ff' : c.text2,
                fontWeight: activeTab === tab.key ? 600 : 400,
                fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 与我相关 */}
      <div style={{ display: activeTab === 'personal' ? 'block' : 'none' }}>
        <PersonalNewsPanel />
      </div>

      {/* 实时快讯 */}
      <div style={{ display: activeTab === 'news' ? 'block' : 'none' }}>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <div className="card">
              <NewsFeed showHeader={true} maxItems={50} />
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 className="card-title"><BarChartOutlined /> 新闻分类统计</h3>
              <NewsStatsPanel />
            </div>
            <div className="card">
              <h3 className="card-title"><ThunderboltOutlined /> 使用说明</h3>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: c.text2, lineHeight: 2.2 }}>
                <li>新闻每3分钟自动抓取，实时推送高影响事件</li>
                <li>自动关联您持仓和自选基金的相关新闻</li>
                <li>高影响事件会生成投资操作建议</li>
                <li>点击新闻标题可查看原文详情</li>
                <li>导航栏铃铛图标显示持仓相关提醒</li>
              </ul>
            </div>
          </Col>
        </Row>
      </div>

      {/* 事件日历 */}
      <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }}>
        {/* 筛选栏 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <Space wrap size={12} style={{ width: '100%' }}>
            <Space size={6}>
              <FilterOutlined style={{ color: c.text3 }} />
              <Text style={{ fontSize: 13, color: c.text2 }}>筛选：</Text>
            </Space>
            <Select
              placeholder="事件类型" allowClear style={{ width: 140 }}
              value={filterCategory || undefined}
              onChange={v => setFilterCategory(v || '')}
              options={Object.entries(categoryConfig).map(([k, v]: [string, any]) => ({
                value: k, label: <span><Tag color={v.color} style={{ marginRight: 4, fontSize: 11 }}>{v.label}</Tag></span>,
              }))}
            />
            <Select
              placeholder="影响等级" allowClear style={{ width: 130 }}
              value={filterImpact || undefined}
              onChange={v => setFilterImpact(v || '')}
              options={Object.entries(impactConfig).map(([k, v]: [string, any]) => ({
                value: k, label: statusTag(k === 'high' ? c.dangerBg : k === 'medium' ? c.warningBg : c.bg3, k === 'high' ? '#ff4d4f' : k === 'medium' ? '#faad14' : c.text3, v.label),
              }))}
            />
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: `1px solid ${c.border}` }}>
              {['timeline', 'month', 'table'].map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)} style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 13,
                  background: viewMode === mode ? '#1677ff' : c.btnBg,
                  color: viewMode === mode ? '#fff' : c.text2,
                  fontWeight: viewMode === mode ? 500 : 400,
                  borderRight: mode !== 'table' ? `1px solid ${c.border}` : 'none',
                }}>
                  {mode === 'timeline' ? '时间线' : mode === 'month' ? '按月' : '表格'}
                </button>
              ))}
            </div>
          </Space>
        </div>

        {/* 分类统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {Object.entries(categoryConfig).map(([key, cfg]: [string, any]) => {
            const count = events.filter(e => e.category === key).length;
            if (count === 0) return null;
            return (
              <div
                key={key}
                onClick={() => setFilterCategory(filterCategory === key ? '' : key)}
                style={{
                  padding: '14px 16px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
                  background: filterCategory === key ? c.primaryBg : c.bg2,
                  border: filterCategory === key ? `1px solid ${c.primaryBorder}` : `1px solid ${c.borderLight}`,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: cfg.color }}>{count}</div>
                <div style={{ fontSize: 12, color: c.text3, marginTop: 2 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>

        {/* 事件内容 */}
        {events.length === 0 ? (
          <div className="card"><Empty description="暂无事件数据" /></div>
        ) : viewMode === 'timeline' ? (
          months.map(month => (
            <div key={month} style={{ marginBottom: 32 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                paddingBottom: 8, borderBottom: '2px solid #1677ff',
              }}>
                <CalendarOutlined style={{ color: '#1677ff', fontSize: 18 }} />
                <span style={{ fontSize: 17, fontWeight: 600, color: c.text }}>{monthNames[month]}</span>
                {statusTag(c.primaryBg, '#1677ff', `${eventsByMonth[month].length} 个事件`)}
                {month === defaultMonth && statusTag(c.dangerBg, '#ff4d4f', '当前月')}
              </div>
              <div style={{ paddingLeft: 30, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: c.border }} />
                {eventsByMonth[month].map(event => (
                  <div key={event.id} style={{ position: 'relative', marginBottom: 16 }}>
                    {/* 圆点 */}
                    <div style={{
                      position: 'absolute', left: -21, top: 18, width: 12, height: 12, borderRadius: '50%',
                      background: impactConfig[event.impact]?.color || '#8c8c8c',
                      border: `2px solid ${c.bg}`, boxShadow: `0 0 0 2px ${impactConfig[event.impact]?.color || c.text3}`,
                    }} />
                    <div style={{
                      background: c.bg, padding: '16px 20px', borderRadius: 8,
                      border: `1px solid ${c.borderLight}`, boxShadow: 'var(--shadow-sm)',
                      transition: 'box-shadow 0.2s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>{event.title}</span>
                            {statusTag(
                              categoryConfig[event.category]?.color + '18' || c.bg3,
                              categoryConfig[event.category]?.color || c.text3,
                              categoryConfig[event.category]?.label || ''
                            )}
                            {statusTag(
                              event.impact === 'high' ? c.dangerBg : event.impact === 'medium' ? c.warningBg : c.bg3,
                              event.impact === 'high' ? '#ff4d4f' : event.impact === 'medium' ? '#faad14' : c.text3,
                              impactConfig[event.impact]?.label || ''
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <ClockCircleOutlined style={{ color: c.text3, fontSize: 12 }} />
                            <span style={{ fontSize: 12, color: c.text3 }}>{event.dateRange}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: c.text2, lineHeight: 1.8 }}>{event.description}</p>
                          {event.investmentHint && (
                            <div style={{
                              marginTop: 10, padding: '8px 12px', borderRadius: 6,
                              background: c.warningBg, border: `1px solid ${c.warningBorder}`, fontSize: 13, lineHeight: 1.8,
                            }}>
                              <strong style={{ color: '#fa8c16' }}>投资提示：</strong>
                              <span style={{ color: c.text2 }}>{event.investmentHint}</span>
                            </div>
                          )}
                          {event.relatedSectors && event.relatedSectors.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <span style={{ fontSize: 12, color: c.text3, marginRight: 6 }}>关联板块：</span>
                              {event.relatedSectors.map((s: string) => (
                                <Tag key={s} style={{ fontSize: 11, margin: '0 4px 2px 0', borderRadius: 4 }}>{s}</Tag>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : viewMode === 'month' ? (
          <Collapse
            defaultActiveKey={[String(defaultMonth)]}
            items={months.map(month => ({
              key: String(month),
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarOutlined style={{ color: '#1677ff' }} />
                  <strong>{monthNames[month]}</strong>
                  <Badge count={eventsByMonth[month].length} style={{ backgroundColor: '#1677ff' }} />
                  {month === defaultMonth && statusTag(c.dangerBg, '#ff4d4f', '当前月')}
                </span>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  {eventsByMonth[month].map(event => (
                    <Col key={event.id} xs={24} md={12}>
                      <div style={{
                        padding: '16px 20px', borderRadius: 8, background: c.bg,
                        border: `1px solid ${c.borderLight}`, transition: 'box-shadow 0.2s',
                        cursor: 'default',
                      }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                          {statusTag(categoryConfig[event.category]?.color + '18', categoryConfig[event.category]?.color, categoryConfig[event.category]?.label)}
                          {statusTag(event.impact === 'high' ? c.dangerBg : c.warningBg, event.impact === 'high' ? '#ff4d4f' : '#faad14', impactConfig[event.impact]?.label)}
                          <span style={{ fontSize: 12, color: c.text3 }}>{event.dateRange}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: c.text, marginBottom: 6 }}>{event.title}</div>
                        <p style={{ margin: 0, fontSize: 12, color: c.text2, lineHeight: 1.8 }}>{event.description}</p>
                        {event.relatedSectors && (
                          <div style={{ marginTop: 8 }}>
                            {event.relatedSectors.map((s: string) => (
                              <Tag key={s} style={{ fontSize: 10, margin: '0 2px 2px 0', borderRadius: 4 }}>{s}</Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    </Col>
                  ))}
                </Row>
              ),
            }))}
          />
        ) : (
          /* 表格视图 */
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr>
                  {['月份', '时间', '事件', '类型', '影响', '投资提示'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: c.text2,
                      background: c.bg2, borderBottom: `1px solid ${c.borderLight}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id} style={{ cursor: 'default' }}>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${c.borderLight}`, whiteSpace: 'nowrap' }}>{monthNames[event.month]}</td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${c.borderLight}`, whiteSpace: 'nowrap', color: c.text3 }}>{event.dateRange}</td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${c.borderLight}` }}>
                      <span style={{ fontWeight: 600, color: c.text }}>{event.title}</span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${c.borderLight}`, textAlign: 'center' }}>
                      {statusTag(categoryConfig[event.category]?.color + '18', categoryConfig[event.category]?.color, categoryConfig[event.category]?.label)}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${c.borderLight}`, textAlign: 'center' }}>
                      {statusTag(event.impact === 'high' ? c.dangerBg : c.warningBg, event.impact === 'high' ? '#ff4d4f' : '#faad14', impactConfig[event.impact]?.label)}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: `1px solid ${c.borderLight}`, maxWidth: 280 }}>
                      <Tooltip title={event.investmentHint}>
                        <span style={{ fontSize: 12, color: c.text2 }}>{event.investmentHint}</span>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 底部说明 */}
        <div style={{
          marginTop: 24, padding: '12px 16px', background: c.primaryBg,
          border: `1px solid ${c.primaryBorder}`, borderRadius: 6, fontSize: 13, lineHeight: 2,
        }}>
          <strong style={{ color: '#1677ff' }}>免责声明：</strong>
          <span style={{ color: c.text2 }}>
            以上事件时间基于历年惯例和已公布信息整理，具体日期以官方公告为准。投资提示仅供参考，不构成投资建议。
            建议关注
            <a href="https://www.gov.cn" target="_blank" rel="noopener" style={{ margin: '0 4px', color: '#1677ff' }}>中国政府网</a>、
            <a href="https://www.mofcom.gov.cn" target="_blank" rel="noopener" style={{ margin: '0 4px', color: '#1677ff' }}>商务部</a>、
            <a href="https://www.sse.com.cn" target="_blank" rel="noopener" style={{ margin: '0 4px', color: '#1677ff' }}>上交所</a>获取最新信息。
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================== 新闻统计面板 ====================
function NewsStatsPanel() {
  const { isDark } = useTheme();
  const [stats, setStats] = useState<any>(null);
  const c = isDark
    ? { bg: '#1a1a1a', bg2: '#262626', bg3: '#1f1f1f', border: '#333', borderLight: '#262626', text: '#e8e8e8', text2: '#a0a0a0', text3: '#6b6b6b', primaryBg: '#111a2c', dangerBg: '#2c1618', warningBg: '#2b2111' }
    : { bg: '#fff', bg2: '#fafafa', bg3: '#f5f5f5', border: '#d9d9d9', borderLight: '#f0f0f0', text: '#1f1f1f', text2: '#595959', text3: '#8c8c8c', primaryBg: '#e6f4ff', dangerBg: '#fff2f0', warningBg: '#fffbe6' };

  useEffect(() => {
    newsApi.getStats().then(setStats).catch(() => {});
    const interval = setInterval(() => { newsApi.getStats().then(setStats).catch(() => {}); }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>;

  const categoryLabels: Record<string, string> = {
    earnings: '财报业绩', orders: '重大订单', tech: '技术突破',
    accident: '事故风险', policy: '政策变动', mna: '并购重组', macro: '宏观经济', other: '其他',
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { value: stats.total, label: '总快讯', bg: c.primaryBg, color: '#1677ff' },
          { value: stats.byImpact?.high || 0, label: '高影响', bg: c.dangerBg, color: '#ff4d4f' },
          { value: stats.byImpact?.medium || 0, label: '中影响', bg: c.warningBg, color: '#faad14' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '12px 16px', borderRadius: 8, textAlign: 'center', background: s.bg }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: c.text3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {Object.entries(stats.byCategory || {}).map(([cat, count]) => (
        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
          <span style={{ color: c.text2 }}>{categoryLabels[cat] || cat}</span>
          <span style={{ fontWeight: 600, color: c.text }}>{count as number}</span>
        </div>
      ))}
      {stats.lastFetchTime && (
        <div style={{ marginTop: 10, fontSize: 11, color: c.text3, textAlign: 'center' }}>
          更新于 {new Date(stats.lastFetchTime).toLocaleTimeString('zh-CN')}
        </div>
      )}
    </div>
  );
}

// ==================== 与我相关面板 ====================
const actionConfig: Record<string, { label: string; color: string; bg: string; darkBg: string; icon: React.ReactNode }> = {
  buy: { label: '关注加仓', color: '#52c41a', bg: '#f6ffed', darkBg: '#162312', icon: <RiseOutlined /> },
  sell: { label: '评估减仓', color: '#ff4d4f', bg: '#fff2f0', darkBg: '#2c1618', icon: <FallOutlined /> },
  watch: { label: '密切关注', color: '#1677ff', bg: '#e6f4ff', darkBg: '#111a2c', icon: <EyeOutlined /> },
  hold: { label: '持有观望', color: '#8c8c8c', bg: '#f5f5f5', darkBg: '#262626', icon: <CheckCircleOutlined /> },
};

function PersonalNewsPanel() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const c = isDark
    ? { bg: '#1a1a1a', bg2: '#262626', bg3: '#1f1f1f', border: '#333', borderLight: '#262626', text: '#e8e8e8', text2: '#a0a0a0', text3: '#6b6b6b', primaryBg: '#111a2c', primaryBorder: '#15395b', dangerBg: '#2c1618', warningBg: '#2b2111', tagBg: '#262626', btnBg: '#1f1f1f' }
    : { bg: '#fff', bg2: '#fafafa', bg3: '#f5f5f5', border: '#d9d9d9', borderLight: '#f0f0f0', text: '#1f1f1f', text2: '#595959', text3: '#8c8c8c', primaryBg: '#e6f4ff', primaryBorder: '#91caff', dangerBg: '#fff2f0', warningBg: '#fffbe6', tagBg: '#f5f5f5', btnBg: '#fff' };
  const [personalNews, setPersonalNews] = useState<any[]>([]);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [matchedIndustries, setMatchedIndustries] = useState<string[]>([]);
  const [filterRelevance, setFilterRelevance] = useState<string>('all');

  const fetchPersonal = async () => {
    try {
      const data = await newsApi.getPersonalNews();
      setPersonalNews(data.items);
      setHoldings(data.holdings || []);
      setWatchlist(data.watchlist || []);
      setMatchedIndustries(data.matchedIndustries || []);
    } catch (e) { console.error('加载个性化资讯失败:', e); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchPersonal();
    const interval = setInterval(fetchPersonal, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filtered = (filterRelevance === 'all'
    ? personalNews
    : personalNews.filter(n => n.relevance === filterRelevance)
  ).filter(n => n.impact !== 'low');

  const highCount = personalNews.filter(n => n.relevance === 'high').length;
  const medCount = personalNews.filter(n => n.relevance === 'medium').length;

  const formatTime = (isoTime: string) => {
    const diff = Date.now() - new Date(isoTime).getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    const d = new Date(isoTime);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  if (holdings.length === 0 && watchlist.length === 0) {
    return (
      <div className="card">
        <Empty description={<span>暂无持仓或自选基金，请先<a href="/portfolio" style={{ margin: '0 4px', color: '#1677ff' }}>记录持仓</a>或<a href="/watchlist" style={{ margin: '0 4px', color: '#1677ff' }}>添加自选</a></span>} />
      </div>
    );
  }

  return (
    <Row gutter={24}>
      <Col xs={24} lg={16}>
        {/* 筛选栏 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <StarOutlined style={{ color: '#faad14' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>与我相关的市场资讯</span>
          {statusTag(c.primaryBg, '#1677ff', `${personalNews.length} 条`)}
          {highCount > 0 && statusTag(c.dangerBg, '#ff4d4f', `${highCount} 条高度相关`)}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: `1px solid ${c.border}` }}>
            {[
              { key: 'all', label: '全部' },
              { key: 'high', label: `高度相关(${highCount})` },
              { key: 'medium', label: `行业相关(${medCount})` },
            ].map(opt => (
              <button key={opt.key} onClick={() => setFilterRelevance(opt.key)} style={{
                padding: '4px 12px', border: 'none', cursor: 'pointer', fontSize: 12,
                background: filterRelevance === opt.key ? '#1677ff' : c.btnBg,
                color: filterRelevance === opt.key ? '#fff' : c.text2,
                fontWeight: filterRelevance === opt.key ? 500 : 400,
                borderRight: opt.key !== 'medium' ? `1px solid ${c.border}` : 'none',
              }}>
                {opt.label}
              </button>
            ))}
          </div>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchPersonal}>刷新</Button>
        </div>

        {/* 新闻列表 */}
        {filtered.length === 0 ? (
          <div className="card"><Empty description="暂无与您持仓相关的新闻" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
        ) : (
          <div className="card" style={{ padding: '0 20px' }}>
            <List
              size="small"
              dataSource={filtered}
              renderItem={(item: any) => {
                const ac = actionConfig[item.action] || actionConfig.hold;
                const acBg = isDark ? ac.darkBg : ac.bg;
                return (
                  <List.Item style={{ padding: '14px 0', alignItems: 'flex-start', borderBottom: `1px solid ${c.borderLight}` }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: c.text3 }}>{formatTime(item.time)}</span>
                        {statusTag(c.tagBg, c.text2, item.source)}
                        {item.relevance === 'high'
                          ? statusTag(c.dangerBg, '#ff4d4f', '高度相关')
                          : statusTag(c.warningBg, '#faad14', '行业相关')}
                        {item.impact === 'high' && statusTag(c.dangerBg, '#ff4d4f', '高影响')}
                      </div>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: c.text, lineHeight: 1.6 }}>{item.title}</span>
                      </a>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LinkOutlined style={{ color: '#1677ff', fontSize: 11 }} />
                        <span style={{ fontSize: 12, color: '#1677ff' }}>{item.matchReason}</span>
                      </div>
                      {item.content && item.content !== item.title && (
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: c.text2, lineHeight: 1.8 }}>
                          {item.content.length > 120 ? item.content.substring(0, 120) + '...' : item.content}
                        </p>
                      )}
                      {item.stocks && item.stocks.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          {item.stocks.slice(0, 5).map((s: any) => (
                            <Tag key={s.code} style={{ fontSize: 10, margin: '0 4px 2px 0', borderRadius: 4 }}>{s.name || s.code}</Tag>
                          ))}
                        </div>
                      )}
                      {item.advice && (
                        <div style={{
                          marginTop: 8, padding: '8px 12px', borderRadius: 6,
                          background: acBg, border: `1px solid ${ac.color}30`,
                          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                        }}>
                          <span style={{ color: ac.color }}>{ac.icon}</span>
                          <span style={{ color: c.text2, flex: 1 }}>{item.advice}</span>
                          {item.action && item.action !== 'hold' && statusTag(acBg, ac.color, ac.label)}
                        </div>
                      )}
                    </div>
                  </List.Item>
                );
              }}
            />
          </div>
        )}
      </Col>

      {/* 右侧面板 */}
      <Col xs={24} lg={8}>
        {holdings.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="card-title"><StockOutlined style={{ color: '#1677ff' }} /> 我的持仓</h3>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {holdings.map((h: any) => (
                <div key={h.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                  <Link to={`/funds/${h.code}`} style={{ color: '#1677ff', textDecoration: 'none', flex: 1 }}>{h.name || h.code}</Link>
                  {statusTag(c.primaryBg, '#1677ff', h.industry || '-')}
                </div>
              ))}
            </div>
            {matchedIndustries.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${c.borderLight}` }}>
                <span style={{ fontSize: 12, color: c.text3, marginRight: 6 }}>监控行业：</span>
                {matchedIndustries.slice(0, 8).map(ind => (
                  <Tag key={ind} style={{ fontSize: 10, margin: '2px 2px 0 0', borderRadius: 4 }}>{ind}</Tag>
                ))}
                {matchedIndustries.length > 8 && <span style={{ fontSize: 11, color: c.text3 }}>+{matchedIndustries.length - 8}</span>}
              </div>
            )}
          </div>
        )}

        {watchlist.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="card-title"><StarOutlined style={{ color: '#faad14' }} /> 自选基金</h3>
            <div style={{ maxHeight: 150, overflow: 'auto' }}>
              {watchlist.map((w: any) => (
                <div key={w.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${c.borderLight}`, fontSize: 13 }}>
                  <Link to={`/funds/${w.code}`} style={{ color: '#1677ff', textDecoration: 'none', flex: 1 }}>{w.name || w.code}</Link>
                  {statusTag(c.tagBg, c.text2, w.industry || '-')}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h3 className="card-title"><ThunderboltOutlined style={{ color: '#fa8c16' }} /> 功能说明</h3>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: c.text2, lineHeight: 2.2 }}>
            <li>自动从海量资讯中筛选与您持仓相关的新闻</li>
            <li><b style={{ color: '#ff4d4f' }}>高度相关</b>：直接提及持仓基金名称或行业</li>
            <li><b style={{ color: '#faad14' }}>行业相关</b>：持仓行业相关的宏观/政策新闻</li>
            <li>每3分钟自动更新，结合事件给出操作建议</li>
            <li>导航栏铃铛同步显示持仓相关提醒</li>
          </ul>
        </div>
      </Col>
    </Row>
  );
}
