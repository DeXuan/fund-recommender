import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Tag, Spin, Tooltip, Popconfirm, message, Drawer, Empty, Segmented,
} from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined, FundOutlined,
  BarChartOutlined, SearchOutlined, DeleteOutlined, HistoryOutlined,
  BulbOutlined, GlobalOutlined, LineChartOutlined, AppstoreOutlined,
  PlusOutlined, RiseOutlined, FallOutlined,
  ExperimentOutlined, SafetyOutlined, BankOutlined,
  StockOutlined, PercentageOutlined, RocketOutlined,
  StarOutlined, ThunderboltOutlined, CopyOutlined, CheckOutlined,
  QuestionCircleOutlined, RightOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fundApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: string;
}

interface Session {
  sessionId: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  firstMessage: string;
}

const PAGE_SIZE = 20;

const quickCategories = [
  {
    key: 'portfolio',
    label: '我的持仓',
    icon: <FundOutlined />,
    color: '#fa541c',
    gradient: 'linear-gradient(135deg, #fa541c 0%, #fa8c16 100%)',
    questions: [
      { icon: <RiseOutlined />, text: '我的收益怎么样？', desc: '查看个人持仓收益' },
      { icon: <FundOutlined />, text: '看看我的持仓情况', desc: '持仓明细与盈亏' },
      { icon: <BarChartOutlined />, text: '我赚了多少钱？', desc: '总收益与已实现收益' },
      { icon: <FallOutlined />, text: '哪些基金亏了？', desc: '亏损基金排行' },
    ],
  },
  {
    key: 'recommend',
    label: '智能推荐',
    icon: <BulbOutlined />,
    color: '#722ed1',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    questions: [
      { icon: <FundOutlined />, text: '推荐低费率的沪深300基金', desc: '费率低、跟踪误差小' },
      { icon: <GlobalOutlined />, text: '哪些QDII基金收益好？', desc: '布局海外市场' },
      { icon: <StarOutlined />, text: '有哪些金选基金？', desc: '平台精选优质基金' },
      { icon: <RiseOutlined />, text: '哪些基金收益最高？', desc: '近1年收益排行' },
    ],
  },
  {
    key: 'analysis',
    label: '市场分析',
    icon: <LineChartOutlined />,
    color: '#1677ff',
    gradient: 'linear-gradient(135deg, #667eea 0%, #1677ff 100%)',
    questions: [
      { icon: <StockOutlined />, text: '当前指数估值怎么样？', desc: 'PE分位实时查询' },
      { icon: <BarChartOutlined />, text: '查看指数行情', desc: '主要指数实时行情' },
      { icon: <AppstoreOutlined />, text: '有哪些行业分类？', desc: '全市场行业概览' },
      { icon: <BankOutlined />, text: '大规模基金有哪些？', desc: '规模>50亿的基金' },
    ],
  },
  {
    key: 'search',
    label: '精准搜索',
    icon: <SearchOutlined />,
    color: '#52c41a',
    gradient: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
    questions: [
      { icon: <SearchOutlined />, text: '搜索医药行业基金', desc: '按行业关键词搜索' },
      { icon: <PercentageOutlined />, text: '费率最低的基金', desc: '综合费率<0.8%' },
      { icon: <ExperimentOutlined />, text: '搜索半导体基金', desc: '科技赛道布局' },
      { icon: <SafetyOutlined />, text: '搜索债券基金', desc: '稳健收益之选' },
    ],
  },
];

function safeParseTime(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { console.error('解析时间戳失败:', e); return ''; }
}

export default function AIAssistant() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const isLoadingMore = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const prevScrollHeightRef = useRef<number>(0);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsDrawerOpen, setSessionsDrawerOpen] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('portfolio');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [welcomeText, setWelcomeText] = useState('');

  // 欢迎页打字动画
  useEffect(() => {
    if (messages.length > 0) return;
    const text = '基于 Claude AI 驱动，实时数据分析，智能基金问答';
    let i = 0;
    const timer = setInterval(() => {
      if (i <= text.length) {
        setWelcomeText(text.slice(0, i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [messages.length]);

  // 追问建议（根据最后一条 AI 回复动态生成）
  const getFollowUpSuggestions = (): string[] => {
    if (messages.length < 2) return [];
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAiMsg) return [];
    const content = lastAiMsg.content;
    if (content.includes('收益') || content.includes('持仓')) return ['哪些基金表现最好？', '帮我分析持仓风险', '推荐类似的基金'];
    if (content.includes('推荐') || content.includes('基金')) return ['这些基金费率怎么样？', '对比一下这几只基金', '适合定投吗？'];
    if (content.includes('估值') || content.includes('指数')) return ['现在适合买入吗？', '历史估值趋势', '相关行业基金推荐'];
    if (content.includes('行业') || content.includes('板块')) return ['这个行业有哪些基金？', '行业估值怎么样？', '推荐行业配置方案'];
    return ['继续分析', '换个话题聊聊', '帮我推荐基金'];
  };

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && chatContainerRef.current) {
      const container = chatContainerRef.current;
      const diff = container.scrollHeight - prevScrollHeightRef.current;
      if (diff > 0) container.scrollTop += diff;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);

  useEffect(() => {
    const savedSessionId = localStorage.getItem('ai_chat_session_id');
    if (savedSessionId) {
      setSessionId(savedSessionId);
      loadHistory(savedSessionId);
    } else {
      const newSid = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      setSessionId(newSid);
      localStorage.setItem('ai_chat_session_id', newSid);
    }
    setTimeout(() => scrollToBottom(), 350);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  }, []);

  const loadHistory = useCallback(async (sid: string, before?: number) => {
    setLoadingHistory(true);
    if (before && chatContainerRef.current) {
      prevScrollHeightRef.current = chatContainerRef.current.scrollHeight;
    }
    try {
      const result = await fundApi.getAIHistory({ sessionId: sid, limit: PAGE_SIZE, before });
      const historyMessages = result.messages || [];
      setHasMore(result.hasMore || false);
      if (before) {
        setMessages(prev => [...historyMessages, ...prev]);
      } else {
        setMessages(historyMessages);
        if (historyMessages.length > 0) scrollToBottom();
      }
    } catch (e) { console.error('加载历史记录失败:', e); }
    finally { setLoadingHistory(false); }
  }, [scrollToBottom]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try { const result = await fundApi.getAISessions(); setSessions(result.sessions || []); }
    catch (e) { /* ignore */ console.error('加载AI会话列表失败:', e); }
    setLoadingSessions(false);
  }, []);

  const switchSession = useCallback((sid: string) => {
    if (sid === sessionId) return;
    setSessionId(sid);
    localStorage.setItem('ai_chat_session_id', sid);
    setMessages([]);
    loadHistory(sid);
    setSessionsDrawerOpen(false);
  }, [sessionId, loadHistory]);

  const newSession = useCallback(() => {
    const newSid = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    setSessionId(newSid);
    localStorage.setItem('ai_chat_session_id', newSid);
    setMessages([]);
    setSessionsDrawerOpen(false);
    message.success('已创建新会话');
  }, []);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBtn(dist > 200);
    if (isLoadingMore.current || !hasMore || loadingHistory) return;
    if (container.scrollTop < 50) {
      isLoadingMore.current = true;
      const msgs = messagesRef.current;
      const oldestId = msgs.length > 0 ? (typeof msgs[0].id === 'number' ? msgs[0].id : undefined) : undefined;
      loadHistory(sessionId, oldestId).finally(() => { isLoadingMore.current = false; });
    }
  }, [sessionId, hasMore, loadingHistory, loadHistory]);

  // 发送消息（流式）
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now(), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    const aiMsgId = Date.now() + 1;
    let streamedContent = '';
    try {
      await fundApi.aiChatStream(text.trim(), sessionId,
        (chunk) => {
          streamedContent += chunk;
          setMessages(prev => {
            const exists = prev.some(m => m.id === aiMsgId);
            if (exists) return prev.map(m => m.id === aiMsgId ? { ...m, content: streamedContent } : m);
            return [...prev, { id: aiMsgId, role: 'assistant' as const, content: streamedContent, timestamp: new Date().toISOString() }];
          });
          scrollToBottom();
        },
        (sid) => { if (sid && sid !== sessionId) { setSessionId(sid); localStorage.setItem('ai_chat_session_id', sid); } },
        (errMsg) => { if (!streamedContent) setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant' as const, content: errMsg || '网络错误，请稍后重试', timestamp: new Date().toISOString() }]); },
      );
    } catch (e) {
      console.error('发送AI消息失败:', e);
      if (!streamedContent) setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant' as const, content: '网络错误，请稍后重试', timestamp: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  const clearHistory = async () => {
    try {
      await fundApi.clearAIHistory(sessionId);
      setMessages([]);
      const newSid = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      setSessionId(newSid);
      localStorage.setItem('ai_chat_session_id', newSid);
      message.success('聊天记录已清空');
    } catch (e) { console.error('清空聊天记录失败:', e); message.error('清空失败'); }
  };

  const copyToClipboard = (text: string, id: string | number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // 渲染基金卡片
  const renderFundList = (funds: any[]) => {
    if (!funds?.length) return null;
    return (
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {funds.slice(0, 6).map((f: any) => (
          <Link key={f.code} to={`/funds/${f.code}`} style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(22,119,255,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(22,119,255,0.12)'}`,
              transition: 'all 0.2s', cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: isDark ? '#e8e8e8' : '#1f1f1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                    {f.isGoldSelected && <Tag color="gold" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px' }}>金选</Tag>}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999', fontFamily: 'monospace' }}>{f.code}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: (f.return1y || 0) >= 0 ? '#ff4d4f' : '#52c41a' }}>
                  {(f.return1y || 0) >= 0 ? '+' : ''}{f.return1y?.toFixed(2)}%
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: isDark ? '#6b6b6b' : '#888' }}>
                <span>费率 {f.totalFee?.toFixed(2)}%</span>
                <span>规模 {f.scale?.toFixed(1)}亿</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  const renderIndices = (data: any) => {
    if (!data?.indices) return null;
    return (
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {data.indices.map((idx: any) => (
          <div key={idx.code} style={{
            padding: '10px 12px', borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(22,119,255,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(22,119,255,0.1)'}`,
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{idx.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{idx.price?.toFixed(2)}</span>
              <span style={{ fontWeight: 600, color: idx.changePercent >= 0 ? '#ff4d4f' : '#52c41a' }}>
                {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent?.toFixed(2)}%
              </span>
            </div>
            {idx.pePercentile != null && (
              <Tag color={idx.pePercentile < 30 ? 'green' : idx.pePercentile < 70 ? 'blue' : 'red'} style={{ fontSize: 11, marginTop: 4 }}>
                PE分位 {idx.pePercentile}%
              </Tag>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderIndustries = (data: any) => {
    if (!data?.industries) return null;
    return (
      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.industries.map((ind: string) => (
          <Link key={ind} to={`/industry?name=${encodeURIComponent(ind)}`}>
            <Tag color="blue" style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 12px' }}>{ind}</Tag>
          </Link>
        ))}
      </div>
    );
  };

  const renderStructuredData = (data: any) => {
    if (!data) return null;
    if (Array.isArray(data)) return renderFundList(data);
    if (data.type === 'indices' || data.type === 'valuation') return renderIndices(data);
    if (data.type === 'industries') return renderIndustries(data);
    return null;
  };

  // 渲染消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    const time = safeParseTime(msg.timestamp);
    return (
      <div key={msg.id} style={{
        display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16, animation: 'fadeInUp 0.3s ease-out',
      }}>
        {!isUser && (
          <div style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 10, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(102,126,234,0.25)',
          }}>
            <RobotOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
        )}
        <div style={{ maxWidth: '78%', minWidth: 60, position: 'relative' }}>
          <div style={{
            padding: '12px 16px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: isUser
              ? 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)'
              : (isDark ? 'rgba(255,255,255,0.06)' : '#f7f8fa'),
            color: isUser ? '#fff' : (isDark ? '#e8e8e8' : '#1f1f1f'),
            whiteSpace: isUser ? 'pre-wrap' : 'normal',
            lineHeight: 1.7, fontSize: 14,
            boxShadow: isUser ? '0 2px 12px rgba(22,119,255,0.18)' : (isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)'),
          }}>
            {isUser ? msg.content : (
              <div className="markdown-body" style={{ color: 'inherit', fontSize: 14 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>
            )}
            {renderStructuredData(msg.data)}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 4, padding: '0 4px',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
          }}>
            {time && <span style={{ fontSize: 11, color: isDark ? '#555' : '#bbb' }}>{time}</span>}
            {!isUser && msg.content && (
              <Tooltip title={copiedId === msg.id ? '已复制' : '复制'}>
                <span
                  onClick={() => copyToClipboard(msg.content, msg.id)}
                  style={{ fontSize: 11, color: isDark ? '#555' : '#bbb', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#1677ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#555' : '#bbb'; }}
                >
                  {copiedId === msg.id ? <CheckOutlined /> : <CopyOutlined />}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        {isUser && (
          <div style={{
            width: 34, height: 34, borderRadius: 11,
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 10, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(22,119,255,0.25)',
          }}>
            <UserOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
        )}
      </div>
    );
  };

  const currentCategory = quickCategories.find(c => c.key === selectedCategory) || quickCategories[0];

  // 快捷操作 chips
  const quickChips = [
    { text: '我的收益怎么样？', icon: <FundOutlined /> },
    { text: '推荐几只优质基金', icon: <BulbOutlined /> },
    { text: '当前指数估值', icon: <LineChartOutlined /> },
    { text: '市场行情分析', icon: <BarChartOutlined /> },
  ];

  // 追问建议
  const followUps = getFollowUpSuggestions();

  // 会话侧边栏
  const renderSessionsDrawer = () => (
    <Drawer
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HistoryOutlined /><span>会话记录</span></div>}
      placement="right" onClose={() => setSessionsDrawerOpen(false)} open={sessionsDrawerOpen} width={360}
      extra={<Button type="primary" icon={<PlusOutlined />} size="small" onClick={newSession}>新会话</Button>}
    >
      {loadingSessions ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : sessions.length === 0 ? (
        <Empty description="暂无历史会话" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map(s => (
            <div key={s.sessionId} onClick={() => switchSession(s.sessionId)} style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              background: s.sessionId === sessionId ? (isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.08)') : (isDark ? 'rgba(255,255,255,0.04)' : '#fff'),
              border: `1px solid ${s.sessionId === sessionId ? '#1677ff' : (isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0')}`,
              transition: 'all 0.2s',
            }}>
              <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.firstMessage || '新会话'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>
                <span>{s.messageCount} 条消息</span>
                <span>{new Date(s.lastMessageAt).toLocaleDateString('zh-CN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(102,126,234,0.2); } 50% { box-shadow: 0 0 30px rgba(102,126,234,0.4); } }
        @keyframes typingDot { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .markdown-body { font-size: 14px; line-height: 1.7; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; border-radius: 8px; overflow: hidden; }
        .markdown-body th, .markdown-body td { border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}; padding: 8px 12px; text-align: left; }
        .markdown-body th { background: ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f5ff'}; font-weight: 600; color: ${isDark ? '#ccc' : '#333'}; }
        .markdown-body tr:hover td { background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(22,119,255,0.02)'}; }
        .markdown-body h2 { font-size: 16px; margin: 14px 0 8px; font-weight: 700; padding-bottom: 6px; border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}; }
        .markdown-body h3 { font-size: 14px; margin: 10px 0 4px; font-weight: 600; }
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 6px 0; }
        .markdown-body li { margin: 3px 0; }
        .markdown-body blockquote { border-left: 3px solid #1677ff; padding: 8px 12px; margin: 10px 0; background: ${isDark ? 'rgba(22,119,255,0.06)' : 'rgba(22,119,255,0.03)'}; border-radius: 0 8px 8px 0; }
        .markdown-body code { background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; }
        .markdown-body pre { background: ${isDark ? 'rgba(0,0,0,0.3)' : '#f6f8fa'}; padding: 14px; border-radius: 10px; overflow-x: auto; margin: 10px 0; position: relative; border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e8e8e8'}; }
        .markdown-body pre code { background: none; padding: 0; font-size: 13px; }
        .markdown-body strong { font-weight: 700; color: ${isDark ? '#e8e8e8' : '#1f1f1f'}; }
        .markdown-body p { margin: 6px 0; }
        .markdown-body hr { border: none; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}; margin: 12px 0; }
        .markdown-body a { color: #1677ff; text-decoration: none; }
        .markdown-body a:hover { text-decoration: underline; }
      `}</style>

      <Card
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' } }}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', boxShadow: 'none' }}
      >
        {/* 消息列表 */}
        <div ref={chatContainerRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minHeight: 0 }}>
          {/* 加载更多 */}
          {hasMore && messages.length > 0 && (
            <div style={{ textAlign: 'center', padding: '8px 0', marginBottom: 12 }}>
              {loadingHistory ? <Spin size="small" /> : (
                <Button type="link" size="small" onClick={() => {
                  const oldestId = typeof messages[0]?.id === 'number' ? messages[0].id : undefined;
                  loadHistory(sessionId, oldestId);
                }}>加载更早的记录</Button>
              )}
            </div>
          )}

          {/* 欢迎页 */}
          {messages.length === 0 && !loadingHistory && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '32px 16px', minHeight: 400,
            }}>
              {/* Logo */}
              <div style={{
                width: 72, height: 72, borderRadius: 22,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
                boxShadow: '0 8px 32px rgba(102,126,234,0.3)',
                animation: 'pulse-glow 3s ease-in-out infinite',
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 32 }} />
              </div>
              <h2 style={{
                fontSize: 22, fontWeight: 700, margin: '0 0 6px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                AI 投资助手
              </h2>
              <p style={{ fontSize: 13, color: isDark ? '#888' : '#999', margin: '0 0 24px', textAlign: 'center', maxWidth: 400, minHeight: 20 }}>
                {welcomeText}
                <span style={{
                  display: 'inline-block', width: 1, height: 14, background: '#1677ff',
                  marginLeft: 2, verticalAlign: 'text-bottom',
                  animation: 'typingDot 0.8s infinite',
                }} />
              </p>

              {/* 功能标签 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
                {[
                  { icon: <FundOutlined />, text: '持仓分析', color: '#fa541c' },
                  { icon: <BulbOutlined />, text: '智能推荐', color: '#722ed1' },
                  { icon: <LineChartOutlined />, text: '市场研判', color: '#1677ff' },
                  { icon: <ThunderboltOutlined />, text: '实时数据', color: '#faad14' },
                ].map(f => (
                  <div key={f.text} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 20,
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0'}`,
                    fontSize: 12, color: isDark ? '#ccc' : '#555',
                  }}>
                    <span style={{ color: f.color, fontSize: 14 }}>{f.icon}</span>
                    {f.text}
                  </div>
                ))}
              </div>

              {/* 快捷问题 */}
              <div style={{ width: '100%', maxWidth: 560 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <Segmented
                    value={selectedCategory}
                    onChange={v => setSelectedCategory(v as string)}
                    size="small"
                    options={quickCategories.map(c => ({
                      label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>{c.icon} {c.label}</span>,
                      value: c.key,
                    }))}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {currentCategory.questions.map((q, i) => (
                    <div
                      key={`${selectedCategory}-${i}`}
                      onClick={() => sendMessage(q.text)}
                      style={{
                        padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 10,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = currentCategory.color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 4px 16px ${currentCategory.color}20`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: currentCategory.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: 14, color: '#fff',
                      }}>
                        {q.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: isDark ? '#e8e8e8' : '#1f1f1f' }}>{q.text}</div>
                        <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999', marginTop: 1 }}>{q.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loadingHistory && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="加载聊天记录..." /></div>
          )}

          {/* 消息列表 */}
          {messages.map(renderMessage)}

          {/* 思考中指示器 */}
          {loading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 10, flexShrink: 0,
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 15 }} />
              </div>
              <div style={{
                padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f7f8fa',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: '#1677ff',
                      animation: `typingDot 1.4s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 13, color: isDark ? '#888' : '#999' }}>思考中</span>
              </div>
            </div>
          )}
          {/* 追问建议 */}
          {!loading && followUps.length > 0 && messages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: isDark ? '#666' : '#aaa', lineHeight: '26px' }}>
                <QuestionCircleOutlined style={{ marginRight: 4 }} />试试问问：
              </span>
              {followUps.map((q, i) => (
                <div
                  key={i}
                  onClick={() => sendMessage(q)}
                  style={{
                    padding: '3px 10px', borderRadius: 14, cursor: 'pointer',
                    background: isDark ? 'rgba(22,119,255,0.1)' : 'rgba(22,119,255,0.06)',
                    border: `1px solid ${isDark ? 'rgba(22,119,255,0.2)' : 'rgba(22,119,255,0.15)'}`,
                    fontSize: 12, color: '#1677ff',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(22,119,255,0.15)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isDark ? 'rgba(22,119,255,0.1)' : 'rgba(22,119,255,0.06)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {q} <RightOutlined style={{ fontSize: 10 }} />
                </div>
              ))}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* 回到底部 */}
        {showScrollBtn && (
          <div
            onClick={() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScrollBtn(false); }}
            style={{
              position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)',
              padding: '6px 16px', borderRadius: 20,
              background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
              backdropFilter: 'blur(8px)', cursor: 'pointer', fontSize: 12,
              color: isDark ? '#aaa' : '#666', display: 'flex', alignItems: 'center', gap: 4,
              zIndex: 10, transition: 'all 0.2s',
              boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <FallOutlined style={{ fontSize: 10 }} /> 回到底部
          </div>
        )}

        {/* 输入区域 */}
        <div style={{
          padding: '10px 16px 12px',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}`,
          background: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
        }}>
          {/* 快捷 chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {quickChips.map(chip => (
              <div
                key={chip.text}
                onClick={() => sendMessage(chip.text)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 12px', borderRadius: 16, cursor: 'pointer',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}`,
                  fontSize: 12, color: isDark ? '#aaa' : '#666',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#1677ff';
                  e.currentTarget.style.color = '#1677ff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8';
                  e.currentTarget.style.color = isDark ? '#aaa' : '#666';
                }}
              >
                {chip.icon} {chip.text}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <Input.TextArea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) { e.preventDefault(); sendMessage(input); }
              }}
              placeholder="问我任何投资问题... (Shift+Enter 换行)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={loading}
              style={{
                borderRadius: 12, resize: 'none',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f7f8fa',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
                padding: '8px 12px',
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="large"
              onClick={() => sendMessage(input)}
              loading={loading}
              disabled={!input.trim()}
              style={{
                borderRadius: 12, width: 44, height: 40, flexShrink: 0,
                background: input.trim() ? 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)' : undefined,
                border: 'none',
                boxShadow: input.trim() ? '0 2px 8px rgba(22,119,255,0.3)' : 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: isDark ? '#555' : '#ccc' }}>
            <span>Claude AI 驱动</span>
            <span>{input.length > 0 ? `${input.length} 字` : 'Enter 发送 · Shift+Enter 换行'}</span>
          </div>
        </div>
      </Card>

      {renderSessionsDrawer()}
    </div>
  );
}
