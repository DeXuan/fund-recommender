import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Tag, Spin, Tooltip, Popconfirm, message, Drawer, Empty, Segmented,
} from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined, FundOutlined,
  BarChartOutlined, SearchOutlined, DeleteOutlined, HistoryOutlined,
  BulbOutlined, GlobalOutlined, LineChartOutlined, AppstoreOutlined,
  PlusOutlined, RiseOutlined, FallOutlined,
  SafetyOutlined,
  StockOutlined, PercentageOutlined, RocketOutlined,
  CopyOutlined, CheckOutlined,
  QuestionCircleOutlined, RightOutlined,
  CrownOutlined, HeartOutlined,
  TrophyOutlined, WarningOutlined, DashboardOutlined,
  SolutionOutlined, AuditOutlined, FileSearchOutlined,
  CalendarOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aiApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { parseSlashCommand, SLASH_COMMANDS } from '../utils/slash-commands';

interface Message {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  data?: any;
  timestamp: string;
  saved?: boolean;
}

interface Session {
  sessionId: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  firstMessage: string;
}

const PAGE_SIZE = 20;

// Layered capability categories
const capabilityCategories = [
  {
    key: 'basic',
    label: '通用问答',
    icon: <QuestionCircleOutlined />,
    color: '#1677ff',
    gradient: 'linear-gradient(135deg, #667eea 0%, #1677ff 100%)',
    questions: [
      { icon: <BulbOutlined />, text: '什么是基金定投？', desc: '投资入门知识' },
      { icon: <FundOutlined />, text: 'ETF和普通基金有什么区别？', desc: '基金类型科普' },
      { icon: <SafetyOutlined />, text: '基金风险等级怎么看？', desc: '风险评估基础' },
      { icon: <PercentageOutlined />, text: '基金费率怎么计算？', desc: '费率知识' },
    ],
  },
  {
    key: 'diagnosis',
    label: '基金诊断',
    icon: <FileSearchOutlined />,
    color: '#722ed1',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    questions: [
      { icon: <FundOutlined />, text: '帮我诊断一下持仓基金', desc: '全面诊断分析' },
      { icon: <BarChartOutlined />, text: '哪些基金回撤控制得好？', desc: '回撤分析' },
      { icon: <RiseOutlined />, text: '夏普比率最高的基金', desc: '风险调整收益' },
      { icon: <StockOutlined />, text: '基金经理能力怎么评估？', desc: '经理能力分析' },
    ],
  },
  {
    key: 'strategy',
    label: '投资策略',
    icon: <RocketOutlined />,
    color: '#fa541c',
    gradient: 'linear-gradient(135deg, #fa541c 0%, #fa8c16 100%)',
    questions: [
      { icon: <LineChartOutlined />, text: '帮我制定定投计划', desc: '定投策略定制' },
      { icon: <BarChartOutlined />, text: '现在适合止盈吗？', desc: '止盈时机判断' },
      { icon: <GlobalOutlined />, text: '行业轮动策略怎么操作？', desc: '行业轮动建议' },
      { icon: <AppstoreOutlined />, text: '资产配置方案推荐', desc: '配置策略' },
    ],
  },
  {
    key: 'portfolio',
    label: '持仓分析',
    icon: <AuditOutlined />,
    color: '#52c41a',
    gradient: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
    questions: [
      { icon: <FundOutlined />, text: '我的收益怎么样？', desc: '查看个人持仓收益' },
      { icon: <BarChartOutlined />, text: '帮我分析持仓风险', desc: '风险敞口分析' },
      { icon: <WarningOutlined />, text: '哪些基金亏了？', desc: '亏损基金排行' },
      { icon: <TrophyOutlined />, text: '持仓集中度分析', desc: '分散度评估' },
    ],
  },
  {
    key: 'vip',
    label: 'VIP专属',
    icon: <CrownOutlined />,
    color: '#faad14',
    gradient: 'linear-gradient(135deg, #ffd700 0%, #faad14 100%)',
    isVip: true,
    questions: [
      { icon: <SolutionOutlined />, text: '定制资产配置方案', desc: '个性化配置建议' },
      { icon: <CalendarOutlined />, text: '制定月度投资规划', desc: '定期投资计划' },
      { icon: <FileSearchOutlined />, text: '亏损专项分析报告', desc: '深度亏损诊断' },
      { icon: <DashboardOutlined />, text: '月度理财复盘', desc: '收益回顾分析' },
    ],
  },
  {
    key: 'market',
    label: '市场解读',
    icon: <GlobalOutlined />,
    color: '#13c2c2',
    gradient: 'linear-gradient(135deg, #13c2c2 0%, #096dd9 100%)',
    questions: [
      { icon: <StockOutlined />, text: '当前指数估值怎么样？', desc: 'PE分位实时查询' },
      { icon: <BarChartOutlined />, text: '查看指数行情', desc: '主要指数实时行情' },
      { icon: <LineChartOutlined />, text: '大盘走势怎么看？', desc: '市场趋势研判' },
      { icon: <AppstoreOutlined />, text: '有哪些行业分类？', desc: '全市场行业概览' },
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
  const [showSlashMenu, setShowSlashMenu] = useState(false);
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
  const [welcomeText, setWelcomeText] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [savedMessages, setSavedMessages] = useState<Set<string | number>>(new Set());
  const [favoritesDrawerOpen, setFavoritesDrawerOpen] = useState(false);

  const isVip = user?.subscription_status === 'premium';

  // Welcome screen typing animation
  useEffect(() => {
    if (messages.length > 0) return;
    const text = '基于 Claude AI 驱动，七层能力体系，智能投资分析';
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

  // Dynamic follow-up suggestions
  const getFollowUpSuggestions = (): string[] => {
    if (messages.length < 2) return [];
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAiMsg) return [];
    const content = lastAiMsg.content;
    if (content.includes('收益') || content.includes('持仓')) return ['哪些基金表现最好？', '帮我分析持仓风险', '推荐类似的基金'];
    if (content.includes('推荐') || content.includes('基金')) return ['这些基金费率怎么样？', '对比一下这几只基金', '适合定投吗？'];
    if (content.includes('估值') || content.includes('指数')) return ['现在适合买入吗？', '历史估值趋势', '相关行业基金推荐'];
    if (content.includes('行业') || content.includes('板块')) return ['这个行业有哪些基金？', '行业估值怎么样？', '推荐行业配置方案'];
    if (content.includes('亏损') || content.includes('亏了')) return ['帮我分析亏损原因', '制定解套策略', '止损还是补仓？'];
    if (content.includes('定投')) return ['定投多少合适？', '定投频率怎么选？', '设置止盈点'];
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
    } else {
      const newSid = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      setSessionId(newSid);
      localStorage.setItem('ai_chat_session_id', newSid);
    }
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
      const result = await aiApi.getHistory({ sessionId: sid, limit: PAGE_SIZE, before });
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
    try { const result = await aiApi.getSessions(); setSessions(result.sessions || []); }
    catch (e) { console.error('加载AI会话列表失败:', e); }
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

  // Send message (streaming)
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const { command, args } = parseSlashCommand(text);
    const userMsg: Message = { id: Date.now(), role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setShowSlashMenu(false);
    setLoading(true);
    scrollToBottom();

    const aiMsgId = Date.now() + 1;
    let streamedContent = '';
    try {
      await aiApi.chatStream(text.trim(), sessionId,
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
        command?.name,
        args,
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
      await aiApi.clearHistory(sessionId);
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

  const toggleSaveMessage = (msg: Message) => {
    setSavedMessages(prev => {
      const next = new Set(prev);
      if (next.has(msg.id)) {
        next.delete(msg.id);
        message.info('已取消收藏');
      } else {
        next.add(msg.id);
        message.success('已收藏分析内容');
      }
      return next;
    });
  };

  // Render fund cards
  const renderFundList = (funds: any[]) => {
    if (!funds?.length) return null;
    return (
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {funds.slice(0, 6).map((f: any) => (
          <Link key={f.code} to={`/funds/${f.code}`} style={{ textDecoration: 'none' }}>
            <div className="ai-fund-card" style={{
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

  // Render message
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    const time = safeParseTime(msg.timestamp);
    const isSaved = savedMessages.has(msg.id);
    return (
      <div key={msg.id} className="ai-message-enter" style={{
        display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}>
        {!isUser && (
          <div className="ai-avatar-bot" style={{
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
          <div className={isUser ? 'ai-bubble-user' : 'ai-bubble-bot'} style={{
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
              <>
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
                <Tooltip title={isSaved ? '取消收藏' : '收藏'}>
                  <span
                    onClick={() => toggleSaveMessage(msg)}
                    style={{ fontSize: 11, color: isSaved ? '#faad14' : (isDark ? '#555' : '#bbb'), cursor: 'pointer', transition: 'color 0.2s' }}
                  >
                    <HeartOutlined />
                  </span>
                </Tooltip>
              </>
            )}
          </div>
        </div>
        {isUser && (
          <div className="ai-avatar-user" style={{
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

  const currentCategory = capabilityCategories.find(c => c.key === selectedCategory) || capabilityCategories[0];

  // Quick action chips
  const quickChips = [
    { text: '我的收益怎么样？', icon: <FundOutlined /> },
    { text: '推荐几只优质基金', icon: <BulbOutlined /> },
    { text: '当前指数估值', icon: <LineChartOutlined /> },
    { text: '帮我分析持仓风险', icon: <SafetyOutlined /> },
  ];

  const followUps = getFollowUpSuggestions();

  // Sidebar quick functions
  const sidebarFunctions = [
    { key: 'new', icon: <PlusOutlined />, label: '新会话', color: '#1677ff', action: newSession },
    { key: 'history', icon: <HistoryOutlined />, label: '历史记录', color: '#722ed1', action: () => { loadSessions(); setSessionsDrawerOpen(true); } },
    { key: 'favorites', icon: <HeartOutlined />, label: '我的收藏', color: '#fa541c', action: () => setFavoritesDrawerOpen(true) },
    { key: 'clear', icon: <DeleteOutlined />, label: '清空对话', color: '#ff4d4f', action: clearHistory, needConfirm: true },
  ];

  // Sessions drawer
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

  // Favorites drawer
  const renderFavoritesDrawer = () => {
    const savedMsgs = messages.filter(m => m.role === 'assistant' && savedMessages.has(m.id));
    return (
      <Drawer
        title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><HeartOutlined style={{ color: '#fa541c' }} /><span>收藏的分析</span></div>}
        placement="right" onClose={() => setFavoritesDrawerOpen(false)} open={favoritesDrawerOpen} width={400}
      >
        {savedMsgs.length === 0 ? (
          <Empty description="暂无收藏内容" image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <p style={{ fontSize: 12, color: isDark ? '#666' : '#999' }}>在对话中点击 <HeartOutlined /> 收藏优质分析内容</p>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {savedMsgs.map(msg => (
              <Card key={msg.id} size="small" style={{ borderRadius: 10 }}>
                <div className="markdown-body" style={{ fontSize: 13, maxHeight: 200, overflow: 'auto' }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content.slice(0, 500)}</ReactMarkdown>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}` }}>
                  <span style={{ fontSize: 11, color: isDark ? '#666' : '#999' }}>{safeParseTime(msg.timestamp)}</span>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(msg.content, msg.id)}>
                    {copiedId === msg.id ? '已复制' : '复制'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Drawer>
    );
  };

  return (
    <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(102,126,234,0.2); } 50% { box-shadow: 0 0 30px rgba(102,126,234,0.4); } }
        @keyframes typingDot { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes aiMsgEnter { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ai-message-enter { animation: aiMsgEnter 0.3s ease-out; }
        .ai-bubble-user { position: relative; overflow: hidden; }
        .ai-bubble-user::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
          pointer-events: none;
        }
        .ai-bubble-bot { transition: background 0.2s; }
        .ai-bubble-bot:hover { background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.02)'} !important; }
        .ai-fund-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .ai-sidebar-btn {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px;
          cursor: pointer; transition: all 0.2s; font-size: 13px;
          color: ${isDark ? '#aaa' : '#666'};
        }
        .ai-sidebar-btn:hover {
          background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
          color: ${isDark ? '#e8e8e8' : '#1f1f1f'};
        }
        .ai-category-card {
          padding: 12px 14px; border-radius: 12px; cursor: pointer;
          background: ${isDark ? 'rgba(255,255,255,0.04)' : '#fff'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'};
          transition: all 0.2s; display: flex; align-items: center; gap: 10;
        }
        .ai-category-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .ai-quick-chip {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 12px; border-radius: 16px; cursor: pointer;
          background: ${isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'};
          font-size: 12px; color: ${isDark ? '#aaa' : '#666'};
          transition: all 0.2s;
        }
        .ai-quick-chip:hover { border-color: #1677ff; color: #1677ff; }
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{
          width: sidebarCollapsed ? 56 : 220, flexShrink: 0,
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}`,
          background: isDark ? 'rgba(0,0,0,0.15)' : '#fafafa',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}` }}>
            {!sidebarCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: isDark ? '#e8e8e8' : '#1f1f1f' }}>FinPilot</span>
                {isVip && <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px' }}>VIP</Tag>}
              </div>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              block={!sidebarCollapsed}
              size="small"
              onClick={newSession}
              style={{ borderRadius: 8 }}
            >
              {!sidebarCollapsed && '新会话'}
            </Button>
          </div>

          {/* Quick functions */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
            {sidebarFunctions.map(fn => {
              const btn = (
                <div
                  key={fn.key}
                  className="ai-sidebar-btn"
                  onClick={() => fn.needConfirm ? undefined : fn.action()}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
                >
                  <span style={{ color: fn.color, fontSize: 16 }}>{fn.icon}</span>
                  {!sidebarCollapsed && <span>{fn.label}</span>}
                </div>
              );
              if (fn.needConfirm) {
                return (
                  <Popconfirm key={fn.key} title="确定清空所有对话？" onConfirm={fn.action} okText="确定" cancelText="取消">
                    {btn}
                  </Popconfirm>
                );
              }
              return btn;
            })}

          </div>

          {/* Collapse toggle */}
          <div
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              padding: '12px', textAlign: 'center', cursor: 'pointer',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}`,
              color: isDark ? '#666' : '#999', fontSize: 14,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#1677ff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#666' : '#999'; }}
          >
            {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>
        </div>

        {/* Main Chat Area */}
        <Card
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' } }}
          style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', boxShadow: 'none' }}
        >
          {/* Messages */}
          <div ref={chatContainerRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto', padding: '16px 20px', minHeight: 0 }}>
            {/* Load more */}
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

            {/* Welcome screen */}
            {messages.length === 0 && !loadingHistory && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '32px 16px', minHeight: 400,
              }}>
                {/* Logo */}
                <div className="ai-welcome-logo" style={{
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
                  FinPilot AI 投资助手
                </h2>
                <p style={{ fontSize: 13, color: isDark ? '#888' : '#999', margin: '0 0 8px', textAlign: 'center', maxWidth: 400, minHeight: 20 }}>
                  {welcomeText}
                  <span style={{
                    display: 'inline-block', width: 1, height: 14, background: '#1677ff',
                    marginLeft: 2, verticalAlign: 'text-bottom',
                    animation: 'typingDot 0.8s infinite',
                  }} />
                </p>
                <p style={{ fontSize: 12, color: isDark ? '#555' : '#bbb', margin: '0 0 28px' }}>Claude AI 驱动 · 实时数据分析 · 智能投资问答</p>

                {/* Quick questions by category */}
                <div style={{ width: '100%', maxWidth: 560 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <Segmented
                      value={selectedCategory}
                      onChange={v => setSelectedCategory(v as string)}
                      size="small"
                      options={capabilityCategories.filter(c => !c.isVip || isVip).map(c => ({
                        label: <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>{c.icon} {c.label}</span>,
                        value: c.key,
                      }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {currentCategory.questions.map((q, i) => (
                      <div
                        key={`${selectedCategory}-${i}`}
                        className="ai-category-card"
                        onClick={() => sendMessage(q.text)}
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = currentCategory.color;
                          e.currentTarget.style.boxShadow = `0 4px 16px ${currentCategory.color}20`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0';
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

            {/* Messages */}
            {messages.map(renderMessage)}

            {/* Thinking indicator */}
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

            {/* Follow-up suggestions */}
            {!loading && followUps.length > 0 && messages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: isDark ? '#666' : '#aaa', lineHeight: '26px' }}>
                  <QuestionCircleOutlined style={{ marginRight: 4 }} />试试问问：
                </span>
                {followUps.map((q, i) => (
                  <div
                    key={i}
                    className="ai-quick-chip"
                    onClick={() => sendMessage(q)}
                  >
                    {q} <RightOutlined style={{ fontSize: 10 }} />
                  </div>
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Scroll to bottom */}
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

          {/* Input area */}
          <div style={{
            padding: '10px 16px 12px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}`,
            background: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
          }}>
            {/* Quick chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none' }}>
              {quickChips.map(chip => (
                <div
                  key={chip.text}
                  className="ai-quick-chip"
                  onClick={() => sendMessage(chip.text)}
                  style={{ flexShrink: 0 }}
                >
                  {chip.icon} {chip.text}
                </div>
              ))}
              {SLASH_COMMANDS.slice(0, 3).map(cmd => (
                <div
                  key={cmd.name}
                  className="ai-quick-chip"
                  onClick={() => { setInput(cmd.name + ' '); setShowSlashMenu(false); setTimeout(() => inputRef.current?.focus(), 100); }}
                  style={{ flexShrink: 0, fontSize: 11 }}
                >
                  {cmd.icon} {cmd.name}
                </div>
              ))}
            </div>

            {/* Slash command autocomplete */}
            {showSlashMenu && (
              <div style={{
                marginBottom: 8, borderRadius: 10, overflow: 'hidden',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}`,
                background: isDark ? '#1a1a1a' : '#fff',
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.08)',
              }}>
                {SLASH_COMMANDS.filter(cmd => {
                  const q = input.trim().toLowerCase();
                  return !q || cmd.name.includes(q) || cmd.description.includes(q);
                }).map(cmd => (
                  <div
                    key={cmd.name}
                    onClick={() => { setInput(cmd.name + ' '); setShowSlashMenu(false); setTimeout(() => inputRef.current?.focus(), 100); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', cursor: 'pointer',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5'}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(64,150,255,0.08)' : 'rgba(22,119,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: 16 }}>{cmd.icon}</span>
                    <span style={{ fontWeight: 500, fontSize: 13, color: isDark ? '#e8e8e8' : '#1f1f1f' }}>{cmd.name}</span>
                    <span style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#999', flex: 1 }}>{cmd.description}</span>
                    <span style={{ fontSize: 11, color: isDark ? '#555' : '#bbb' }}>{cmd.argPlaceholder || ''}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <Input.TextArea
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); setShowSlashMenu(e.target.value.startsWith('/')); }}
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
              <span>Claude AI 驱动 · 七层能力体系</span>
              <span>{input.length > 0 ? `${input.length} 字` : 'Enter 发送 · Shift+Enter 换行'}</span>
            </div>
          </div>
        </Card>
      </div>

      {renderSessionsDrawer()}
      {renderFavoritesDrawer()}
    </div>
 );
}
