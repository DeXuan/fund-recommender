import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  HomeOutlined, FundOutlined, GlobalOutlined, CloudOutlined,
  CalendarOutlined, BankOutlined, RobotOutlined, LineChartOutlined,
  UserOutlined, CrownOutlined, TeamOutlined, DashboardOutlined,
  BulbOutlined, SwapOutlined, ThunderboltOutlined, SafetyOutlined,
  SearchOutlined, SunOutlined, MoonOutlined,
} from '@ant-design/icons';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  category: string;
  shortcut?: string;
  action: () => void;
  keywords: string[];
}

function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return q.length / t.length + 0.5;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? qi / t.length : 0;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const commands: Command[] = [
    { id: 'home', label: '首页', icon: <HomeOutlined />, category: '导航', action: () => navigate('/'), keywords: ['首页', 'home', 'shouye'] },
    { id: 'funds', label: '基金列表', icon: <FundOutlined />, category: '导航', action: () => navigate('/funds'), keywords: ['基金', 'funds', 'jijin'] },
    { id: 'industry', label: '行业分析', icon: <GlobalOutlined />, category: '导航', action: () => navigate('/industry'), keywords: ['行业', 'industry', 'hangye'] },
    { id: 'qdii', label: 'QDII基金', icon: <CloudOutlined />, category: '导航', action: () => navigate('/qdii'), keywords: ['qdii', '海外'] },
    { id: 'events', label: '市场事件', icon: <CalendarOutlined />, category: '导航', action: () => navigate('/events'), keywords: ['事件', 'events', 'shijian'] },
    { id: 'cmb', label: '招行理财', icon: <BankOutlined />, category: '导航', action: () => navigate('/cmb-products'), keywords: ['招行', 'cmb', '理财'] },
    { id: 'compare', label: '基金对比', icon: <SwapOutlined />, category: '导航', action: () => navigate('/fund-compare'), keywords: ['对比', 'compare', 'duibi'] },
    { id: 'ai', label: 'AI 助手', icon: <RobotOutlined />, category: '导航', action: () => navigate('/ai-assistant'), keywords: ['ai', '助手', 'zhushou', 'chat'] },
    { id: 'portfolio', label: '我的持仓', icon: <LineChartOutlined />, category: '导航', action: () => navigate('/portfolio'), keywords: ['持仓', 'portfolio', 'chicang'] },
    { id: 'stock-picker', label: 'AI选股', icon: <ThunderboltOutlined />, category: '导航', action: () => navigate('/stock-picker'), keywords: ['选股', 'stock', 'xuangu'] },
    { id: 'profile', label: '个人中心', icon: <UserOutlined />, category: '导航', action: () => navigate('/profile'), keywords: ['个人', 'profile', 'geren'] },
    { id: 'subscription', label: '订阅会员', icon: <CrownOutlined />, category: '导航', action: () => navigate('/subscription'), keywords: ['订阅', 'vip', '会员'] },
    { id: 'admin-users', label: '用户管理', icon: <TeamOutlined />, category: '管理', action: () => navigate('/admin/users'), keywords: ['用户', 'admin', 'yonghu'] },
    { id: 'admin-monitor', label: '系统监控', icon: <DashboardOutlined />, category: '管理', action: () => navigate('/admin/monitor'), keywords: ['监控', 'monitor', 'jiankong'] },
    { id: 'theme', label: isDark ? '切换亮色主题' : '切换暗色主题', icon: isDark ? <SunOutlined /> : <MoonOutlined />, category: '操作', action: () => toggleTheme(), keywords: ['主题', 'theme', '暗色', '亮色', 'dark', 'light'] },
    { id: 'search-fund', label: '搜索基金...', icon: <SearchOutlined />, category: '操作', action: () => { navigate('/funds'); setTimeout(() => document.querySelector<HTMLInputElement>('input[placeholder*="搜索"]')?.focus(), 300); }, keywords: ['搜索', 'search', 'sousuo'] },
    { id: 'ai-diagnose', label: 'AI 基金诊断', icon: <BulbOutlined />, category: 'AI', action: () => navigate('/ai-assistant'), keywords: ['诊断', 'diagnose', 'zhenduan'] },
  ];

  const filtered = query.trim()
    ? commands
        .map(cmd => ({ cmd, score: Math.max(...cmd.keywords.map(k => fuzzyMatch(query, k)), fuzzyMatch(query, cmd.label)) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(x => x.cmd)
    : commands;

  const categories = [...new Set(filtered.map(c => c.category))];

  const handleSelect = useCallback((cmd: Command) => {
    setOpen(false);
    setQuery('');
    cmd.action();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const handler = () => setOpen(true);
    document.addEventListener('command-palette-open', handler);
    return () => document.removeEventListener('command-palette-open', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selected]) {
      handleSelect(filtered[selected]);
    }
  };

  useEffect(() => {
    if (listRef.current) {
      const item = listRef.current.children[selected] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selected]);

  if (!open) return null;

  const bg = isDark ? 'rgba(20, 20, 20, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#e8e8e8' : '#1f1f1f';
  const textSecondary = isDark ? '#a0a0a0' : '#595959';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(4px)', display: 'flex',
        justifyContent: 'center', paddingTop: '15vh',
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: '100%', maxWidth: 560, maxHeight: 480,
          background: bg, backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${border}`,
          borderRadius: 16, boxShadow: isDark
            ? '0 16px 48px rgba(0,0,0,0.5)'
            : '0 16px 48px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${border}`,
          }}>
            <SearchOutlined style={{ color: textSecondary, fontSize: 16 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索页面、功能、操作..."
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', color: textPrimary,
                fontSize: 14, fontFamily: 'inherit',
              }}
            />
            <span style={{
              fontSize: 11, color: textSecondary,
              padding: '2px 6px', borderRadius: 4,
              border: `1px solid ${border}`,
              lineHeight: 1,
            }}>ESC</span>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: textSecondary, fontSize: 13 }}>
              没有匹配的结果
            </div>
          )}
          {categories.map(cat => (
            <div key={cat}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: textSecondary,
                padding: '8px 12px 4px', textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {cat}
              </div>
              {filtered.filter(c => c.category === cat).map(cmd => {
                const idx = filtered.indexOf(cmd);
                return (
                  <div
                    key={cmd.id}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelected(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                      background: idx === selected
                        ? (isDark ? 'rgba(64,150,255,0.12)' : 'rgba(22,119,255,0.08)')
                        : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{cmd.icon}</span>
                    <span style={{ flex: 1, fontSize: 13, color: textPrimary }}>{cmd.label}</span>
                    {cmd.shortcut && (
                      <span style={{
                        fontSize: 11, color: textSecondary,
                        padding: '1px 5px', borderRadius: 3,
                        border: `1px solid ${border}`,
                      }}>{cmd.shortcut}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${border}`,
          display: 'flex', gap: 16, fontSize: 11, color: textSecondary,
        }}>
          <span>↑↓ 导航</span>
          <span>↵ 选择</span>
          <span>ESC 关闭</span>
        </div>
      </div>
    </div>
  );
}
