import { useState, useEffect, useRef } from 'react';
import { Drawer, Badge, Button } from 'antd';
import { RobotOutlined, CloseOutlined, CustomerServiceOutlined, ExpandOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import AIAssistant from '../pages/AIAssistant';
import { useTheme } from '../contexts/ThemeContext';

export default function FloatingChat() {
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const prevOverflow = useRef('');

  // Close chat panel on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (open) {
      prevOverflow.current = document.body.style.overflow;
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = prevOverflow.current; };
  }, [open]);

  // Don't show floating chat on the AI assistant page itself
  if (location.pathname === '/ai-assistant') return null;

  return (
    <>
      <style>{`
        @keyframes chatBubblePulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(102,126,234,0.3); }
          50% { box-shadow: 0 6px 30px rgba(102,126,234,0.5); }
        }
        @keyframes chatBubbleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes chatRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes gradientBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .floating-chat-bubble {
          position: fixed;
          bottom: 25vh;
          right: 24px;
          z-index: 1000;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .floating-chat-bubble:hover {
          transform: scale(1.12);
        }
      `}</style>

      {/* Floating bubble */}
      {!open && (
        <div
          className="floating-chat-bubble"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {/* Pulse ring */}
          <div style={{
            position: 'absolute', inset: -6,
            borderRadius: '50%',
            border: '2px solid rgba(102,126,234,0.3)',
            animation: 'chatRing 2s ease-out infinite',
          }} />

          {/* Bubble body */}
          <div style={{
            width: 58, height: 58, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: hover
              ? '0 8px 32px rgba(102,126,234,0.5)'
              : '0 4px 20px rgba(102,126,234,0.35)',
            animation: 'chatBubblePulse 3s ease-in-out infinite, chatBubbleFloat 4s ease-in-out infinite',
            position: 'relative',
          }}>
            <CustomerServiceOutlined style={{ color: '#fff', fontSize: 28 }} />

            {/* Online indicator */}
            <div style={{
              position: 'absolute', top: 2, right: 2,
              width: 12, height: 12, borderRadius: '50%',
              background: '#52c41a',
              border: `2px solid ${isDark ? '#1a1a2e' : '#fff'}`,
              animation: 'chatRing 3s ease-in-out infinite',
            }} />
          </div>

          {/* Tooltip */}
          <div style={{
            position: 'absolute', right: 68, top: '50%', transform: 'translateY(-50%)',
            background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.75)',
            color: '#fff', fontSize: 12, fontWeight: 500,
            padding: '6px 12px', borderRadius: 8,
            whiteSpace: 'nowrap',
            opacity: hover ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
              AI 投资助手
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>Claude AI 驱动 · 点击开启</div>
          </div>
        </div>
      )}

      {/* Chat panel */}
      <Drawer
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        width={480}
        closable={false}
        mask={false}
        push={false}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
          header: { display: 'none' },
          wrapper: {
            boxShadow: '-6px 0 30px rgba(0,0,0,0.1)',
            animation: open ? 'slideInRight 0.3s ease-out' : undefined,
          },
        }}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          top: 16,
          height: 'calc(100vh - 32px)',
        }}
      >
        {/* Custom header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          background: isDark
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)',
            }}>
              <RobotOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.2 }}>FinPilot AI 投资助手</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52c41a', display: 'inline-block' }} />
                在线 · Claude AI 驱动 · 七层能力体系
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              onClick={() => { setOpen(false); navigate('/ai-assistant'); }}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: 'rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <ExpandOutlined style={{ fontSize: 14, color: '#fff' }} />
            </div>
            <div
              onClick={() => setOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', background: 'rgba(255,255,255,0.15)',
                transition: 'all 0.2s',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,87,87,0.6)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              <CloseOutlined style={{ fontSize: 14, color: '#fff' }} />
            </div>
          </div>
        </div>

        <AIAssistant />
      </Drawer>
    </>
  );
}
