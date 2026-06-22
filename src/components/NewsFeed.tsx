import { useState, useEffect, useRef } from 'react';
import { Card, Tag, List, Space, Typography, Badge, Spin, Empty, Button, Tooltip, Input, Segmented, message } from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  BellOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  StockOutlined,
  BankOutlined,
  FileProtectOutlined,
  WarningOutlined,
  GlobalOutlined,
  ShopOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { newsApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const { Text, Paragraph } = Typography;

const categoryIcons: Record<string, React.ReactNode> = {
  earnings: <StockOutlined />,
  orders: <FileProtectOutlined />,
  tech: <ThunderboltOutlined />,
  accident: <WarningOutlined />,
  policy: <BankOutlined />,
  mna: <GlobalOutlined />,
  macro: <ShopOutlined />,
  other: <ExclamationCircleOutlined />,
};

const actionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  buy: { label: '关注加仓', color: 'var(--success)', icon: <RiseOutlined /> },
  sell: { label: '评估减仓', color: 'var(--danger)', icon: <FallOutlined /> },
  watch: { label: '密切关注', color: 'var(--primary)', icon: <EyeOutlined /> },
  hold: { label: '持有观望', color: 'var(--text-tertiary)', icon: <EyeOutlined /> },
};

interface NewsFeedProps {
  compact?: boolean; // 紧凑模式（嵌入其他页面）
  maxItems?: number;
  showHeader?: boolean;
}

export default function NewsFeed({ compact = false, maxItems = 50, showHeader = true }: NewsFeedProps) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<any[]>([]);
  const [categories, setCategories] = useState<Record<string, any>>({});
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterImpact, setFilterImpact] = useState<string>('medium');
  const [keyword, setKeyword] = useState('');
  const [total, setTotal] = useState(0);
  const [lastFetch, setLastFetch] = useState<string>('');
  const [sseConnected, setSseConnected] = useState(false);
  const [breakingNews, setBreakingNews] = useState<any[]>([]);
  const esRef = useRef<AbortController | null>(null);

  // 获取新闻列表
  const fetchNews = async () => {
    try {
      // impact: 'medium' 表示"中影响以上"，发送 high,medium 给后端
      const impactParam = filterImpact === 'all' ? undefined
        : filterImpact === 'medium' ? 'high,medium'
        : filterImpact;
      const data = await newsApi.getNews({
        category: filterCategory !== 'all' ? filterCategory : undefined,
        impact: impactParam,
        keyword: keyword || undefined,
        pageSize: maxItems,
      });
      setNews(data.items);
      setTotal(data.total);
      setLastFetch(data.lastFetchTime);
      if (data.categories) setCategories(data.categories);
    } catch (err) {
      // 静默失败
    } finally {
      setLoading(false);
    }
  };

  // SSE 实时连接（自动重连）
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 1000;
    const maxDelay = 30000;
    let unmounted = false;

    const handleMessage = (data: any) => {
      if (data.type === 'init') {
        setNews(prev => {
          const existing = new Set(prev.map(n => n.id));
          const newItems = data.items.filter((n: any) => !existing.has(n.id));
          return [...newItems, ...prev].slice(0, maxItems);
        });
      } else if (data.type === 'news') {
        setBreakingNews(prev => [...data.items, ...prev].slice(0, 10));
        setNews(prev => {
          const existing = new Set(prev.map(n => n.id));
          const newItems = data.items.filter((n: any) => !existing.has(n.id));
          return [...newItems, ...prev].slice(0, maxItems);
        });
        data.items.forEach((item: any) => {
          if (item.impact === 'high') {
            message.warning({ content: `突发: ${item.title.substring(0, 40)}...`, duration: 5 });
          }
        });
      }
    };

    const connect = () => {
      if (unmounted) return;
      const es = newsApi.connectSSE(handleMessage);
      esRef.current = es;
      setSseConnected(true);

      // 监听连接关闭以触发重连
      const origSignal = es.signal;
      origSignal.addEventListener('abort', () => {
        if (unmounted) return;
        setSseConnected(false);
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
          connect();
        }, reconnectDelay);
      });
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      esRef.current?.abort();
      setSseConnected(false);
    };
  }, [maxItems]);

  // 首次加载和筛选变化
  useEffect(() => {
    fetchNews();
  }, [filterCategory, filterImpact, keyword]);

  const formatTime = (isoTime: string) => {
    const date = new Date(isoTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div>
      {showHeader && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Space size={8}>
              <BellOutlined style={{ color: 'var(--primary)', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16 }}>实时财经快讯</Text>
              <Badge status={sseConnected ? 'success' : 'default'} text={
                <Text type="secondary" style={{ fontSize: 11 }}>{sseConnected ? '实时连接中' : '已断开'}</Text>
              } />
              {total > 0 && <Tag color="blue">{total} 条</Tag>}
            </Space>
            <Button size="small" icon={<ReloadOutlined />} onClick={fetchNews}>刷新</Button>
          </div>

          {/* 筛选栏 */}
          {!compact && (
            <Space wrap size={8} style={{ marginBottom: 12 }}>
              <Segmented
                size="small"
                value={filterImpact}
                onChange={v => setFilterImpact(v as string)}
                options={[
                  { value: 'all', label: '全部' },
                  { value: 'high', label: '🔴 高影响' },
                  { value: 'medium', label: '🟠 中影响' },
                ]}
              />
              <Input
                size="small"
                placeholder="搜索关键词"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                style={{ width: 160 }}
                allowClear
              />
            </Space>
          )}
        </div>
      )}

      {/* 突发新闻高亮 */}
      {breakingNews.length > 0 && !compact && (
        <Card
          size="small"
          style={{ marginBottom: 12, borderColor: 'var(--danger)', background: 'rgba(245, 34, 45, 0.04)' }}
          styles={{ body: { padding: '8px 12px' } }}
        >
          <Space size={6}>
            <ThunderboltOutlined style={{ color: 'var(--danger)' }} />
            <Text strong style={{ color: 'var(--danger)', fontSize: 13 }}>突发快讯</Text>
          </Space>
          {breakingNews.slice(0, 3).map(item => (
            <div key={item.id} style={{ marginTop: 4 }}>
              <Text style={{ fontSize: 12 }}>{item.title}</Text>
            </div>
          ))}
        </Card>
      )}

      {/* 新闻列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : news.length === 0 ? (
        <Empty description="暂无新闻" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={news}
          renderItem={(item: any) => {
            const catCfg = categories[item.category] || { label: '其他', color: isDark ? '#6b6b6b' : '#8c8c8c' };
            const impactTag = item.impact === 'high'
              ? { color: 'var(--danger)', text: '高影响' }
              : item.impact === 'medium'
              ? { color: 'var(--warning)', text: '中影响' }
              : { color: 'default', text: '低影响' };

            return (
              <List.Item style={{ padding: compact ? '6px 0' : '10px 0', alignItems: 'flex-start' }}>
                <div style={{ width: '100%' }}>
                  {/* 头部：时间 + 来源 + 标签 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>{formatTime(item.time)}</Text>
                    <Tag style={{ fontSize: 10, margin: 0 }}>{item.source}</Tag>
                    <Tag color={catCfg.color} style={{ fontSize: 10, margin: 0 }}>
                      {categoryIcons[item.category]} {catCfg.label}
                    </Tag>
                    <Tag color={impactTag.color} style={{ fontSize: 10, margin: 0 }}>{impactTag.text}</Tag>
                  </div>

                  {/* 标题 */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                  >
                    <Text strong style={{ fontSize: compact ? 13 : 14, lineHeight: 1.5 }}>
                      {item.title}
                    </Text>
                  </a>

                  {/* 内容摘要 */}
                  {!compact && item.content && item.content !== item.title && (
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}
                    >
                      {item.content}
                    </Paragraph>
                  )}

                  {/* 关联股票 */}
                  {item.stocks && item.stocks.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {item.stocks.slice(0, 5).map((s: any) => (
                        <Tag key={s.code} style={{ fontSize: 10, margin: '0 4px 2px 0' }}>
                          {s.name || s.code}
                        </Tag>
                      ))}
                    </div>
                  )}

                  {/* 投资建议操作标签 */}
                  {item.advice && (
                    <div style={{
                      marginTop: 6, padding: '4px 8px', borderRadius: 4,
                      background: 'var(--bg-secondary)', fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {actionConfig[item.action]?.icon}
                      <Text style={{ fontSize: 12 }}>{item.advice}</Text>
                    </div>
                  )}
                </div>
              </List.Item>
            );
          }}
        />
      )}

      {lastFetch && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            最后更新: {new Date(lastFetch).toLocaleString('zh-CN')}
          </Text>
        </div>
      )}
    </div>
  );
}
