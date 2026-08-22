import { useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, FundOutlined, AccountBookOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const tabs = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/funds', label: '基金', icon: <FundOutlined /> },
  { key: '/portfolio', label: '持仓', icon: <AccountBookOutlined />, authRequired: true },
  { key: '/profile', label: '我的', icon: <UserOutlined />, authRequired: true },
];

export default function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const visibleTabs = tabs.filter(t => !t.authRequired || user);

  const activeKey = visibleTabs.find(
    t => t.key === '/' ? location.pathname === '/' : location.pathname.startsWith(t.key)
  )?.key || '/';

  return (
    <nav
      aria-label="底部导航"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-color-light)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {visibleTabs.map(tab => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.key)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              color: isActive ? 'var(--primary)' : 'var(--text-tertiary)',
              fontSize: 11,
              transition: 'color 0.2s',
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
