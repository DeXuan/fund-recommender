import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Drawer, Grid, Dropdown, Avatar, Space, Badge, List, Tag, Empty } from 'antd';
import {
  HomeOutlined,
  FundOutlined,
  GlobalOutlined,
  SafetyOutlined,
  CalculatorOutlined,
  LineChartOutlined,
  MenuOutlined,
  StockOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  AccountBookOutlined,
  StarOutlined,
  BellOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { alertsApi } from '../services/api';

const { useBreakpoint } = Grid;

const navItems = [
  { key: '/', label: '首页', icon: <HomeOutlined /> },
  { key: '/funds', label: '基金列表', icon: <FundOutlined /> },
  { key: '/industry', label: '行业分析', icon: <BarChartOutlined /> },
  { key: '/market', label: '市场分析', icon: <LineChartOutlined /> },
  { key: '/hs300', label: '沪深300', icon: <StockOutlined /> },
  { key: '/qdii', label: 'QDII基金', icon: <GlobalOutlined /> },
  { key: '/risk-assessment', label: '风险评估', icon: <SafetyOutlined /> },
  { key: '/dca-calculator', label: '定投计算器', icon: <CalculatorOutlined /> },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, logout } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      alertsApi.getAlerts().then(setAlerts).catch(() => {});
    }
  }, [user]);

  const allNavItems = [
    ...navItems,
    ...(user ? [
      { key: '/watchlist', label: '自选基金', icon: <StarOutlined /> },
      { key: '/portfolio', label: '理财记账', icon: <AccountBookOutlined /> },
    ] : []),
  ];

  const menuItems = allNavItems.map((item) => ({
    ...item,
    label: <Link to={item.key}>{item.label}</Link>,
  }));

  const selectedKey = allNavItems.find(
    (item) => item.key === '/' ? location.pathname === '/' : location.pathname.startsWith(item.key)
  )?.key || '/';

  return (
    <Layout.Header
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: '0 24px',
        height: 64,
        lineHeight: '64px',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      <div style={{ maxWidth: 1800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(22, 119, 255, 0.3)',
          }}>
            <StockOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, fontSize: 17, color: '#1677ff', lineHeight: 1.2, whiteSpace: 'nowrap' }}>基金推荐助手</span>
            <span style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.2 }}>智能投资分析平台</span>
          </div>
        </Link>

        {isMobile ? (
          <Space size={12}>
            {user ? (
              <>
              <Badge count={alerts.length} size="small" offset={[-2, 2]}>
                <Button type="text" icon={<BellOutlined />} style={{ color: '#595959', fontSize: 16 }} onClick={() => navigate('/portfolio')} />
              </Badge>
              <Dropdown menu={{
                items: [
                  { key: 'portfolio', label: '理财记账', icon: <AccountBookOutlined /> },
                  { key: 'watchlist', label: '自选基金', icon: <StarOutlined /> },
                  { type: 'divider' as const },
                  { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') { logout(); navigate('/'); }
                  if (key === 'portfolio') navigate('/portfolio');
                  if (key === 'watchlist') navigate('/watchlist');
                },
              }}>
                <Avatar size="small" icon={<UserOutlined />} src={user.avatar_url} style={{ cursor: 'pointer', background: '#1677ff' }} />
              </Dropdown>
              </>
            ) : (
              <Link to="/login"><Button type="primary" size="small" icon={<UserOutlined />}>登录</Button></Link>
            )}
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ fontSize: 18, color: '#595959' }}
            />
          </Space>
        ) : (
          <>
            <Menu
              mode="horizontal"
              selectedKeys={[selectedKey]}
              items={menuItems}
              style={{
                border: 'none',
                flex: 1,
                justifyContent: 'flex-end',
                background: 'transparent',
                fontSize: 14,
              }}
            />
            <Space size={16} style={{ marginLeft: 16 }}>
              {user ? (
                <>
                <Badge count={alerts.length} size="small" offset={[-2, 2]}>
                  <Button type="text" icon={<BellOutlined />} style={{ color: '#595959', fontSize: 16 }} onClick={() => navigate('/portfolio')} />
                </Badge>
                <Dropdown menu={{
                  items: [
                    { key: 'portfolio', label: '理财记账', icon: <AccountBookOutlined /> },
                    { key: 'watchlist', label: '自选基金', icon: <StarOutlined /> },
                    { type: 'divider' as const },
                    { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'logout') { logout(); navigate('/'); }
                    if (key === 'portfolio') navigate('/portfolio');
                    if (key === 'watchlist') navigate('/watchlist');
                  },
                }}>
                  <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}>
                    <Avatar size="small" icon={<UserOutlined />} src={user.avatar_url} style={{ background: '#1677ff' }} />
                    <span style={{ color: '#1f1f1f', fontWeight: 500, fontSize: 14 }}>{user.nickname || user.username}</span>
                  </Space>
                </Dropdown>
                </>
              ) : (
                <Link to="/login">
                  <Button type="primary" icon={<UserOutlined />} style={{ borderRadius: 8 }}>
                    登录
                  </Button>
                </Link>
              )}
            </Space>
          </>
        )}
      </div>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StockOutlined style={{ color: '#1677ff' }} />
            <span>导航菜单</span>
          </div>
        }
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={280}
        styles={{
          header: { borderBottom: '1px solid #f0f0f0' },
          body: { padding: 0 },
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={allNavItems.map((item) => ({
            ...item,
            label: <Link to={item.key} onClick={() => setDrawerOpen(false)}>{item.label}</Link>,
          }))}
          style={{ border: 'none' }}
        />
        {user && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0' }}>
            <Button block icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/'); setDrawerOpen(false); }} danger>
              退出登录
            </Button>
          </div>
        )}
      </Drawer>
    </Layout.Header>
  );
}
