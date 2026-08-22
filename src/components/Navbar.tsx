import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Drawer, Grid, Dropdown, Avatar, Space, Badge, List, Tag, Empty, Modal, Input, Form, message, Tooltip } from 'antd';
import {
  HomeOutlined,
  FundOutlined,
  GlobalOutlined,
  MenuOutlined,
  StockOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  AccountBookOutlined,
  IdcardOutlined,
  StarOutlined,
  BellOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  BankOutlined,
  DashboardOutlined,
  TeamOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  CrownOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { alertsApi, authApi } from '../services/api';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

const { useBreakpoint } = Grid;

const navItems = (t: (key: string) => string) => [
  { key: '/', label: t('nav.home'), icon: <HomeOutlined /> },
  { key: '/funds', label: t('nav.fundList'), icon: <FundOutlined /> },
  { key: '/industry', label: t('nav.industry'), icon: <BarChartOutlined /> },
  { key: '/qdii', label: t('nav.qdii'), icon: <GlobalOutlined /> },
  { key: '/cmb-products', label: t('nav.cmbProducts'), icon: <BankOutlined /> },
  { key: '/events', label: t('nav.events'), icon: <CalendarOutlined /> },
  { key: '/ai-assistant', label: t('nav.aiAssistant'), icon: <RobotOutlined /> },
];

const DISMISSED_KEY = 'dismissed_alerts';

function getDismissedAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function dismissAlert(key: string) {
  const dismissed = getDismissedAlerts();
  dismissed.add(key);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

function alertKey(item: any): string {
  return `${item.type}_${item.fund_code || 'global'}`;
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.xl;
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm] = Form.useForm();

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      setPwdLoading(true);
      await authApi.changePassword(values.oldPassword, values.newPassword);
      message.success('密码修改成功');
      setPwdModalOpen(false);
      pwdForm.resetFields();
    } catch (err: any) {
      if (err.errorFields) return; // form validation error
      message.error(err.message || '修改密码失败');
    } finally {
      setPwdLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const fetchAlerts = () => {
        alertsApi.getAlerts().then((data: any[]) => {
          const dismissed = getDismissedAlerts();
          setAlerts(data.filter(a => !dismissed.has(alertKey(a))));
        }).catch(() => {});
      };
      fetchAlerts();
      // 每3分钟刷新提醒（与新闻抓取同步），页面不可见时暂停
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') fetchAlerts();
      }, 3 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleDismissAlert = (item: any) => {
    const key = alertKey(item);
    dismissAlert(key);
    setAlerts(prev => prev.filter(a => alertKey(a) !== key));
    if (item.type?.startsWith('news_')) navigate('/events');
    else if (item.fund_code) navigate(`/funds/${item.fund_code}`);
    else navigate('/industry');
  };

  const allNavItems = [
    ...navItems(t),
    ...(user ? [
      { key: '/portfolio', label: t('nav.portfolio'), icon: <AccountBookOutlined /> },
      { key: '/stock-picker', label: t('nav.stockPicker'), icon: <FundOutlined /> },
    ] : []),
    ...(user?.role === 'admin' ? [
      { key: '/admin/users', label: t('nav.adminUsers'), icon: <TeamOutlined /> },
      { key: '/admin/monitor', label: t('nav.adminMonitor'), icon: <DashboardOutlined /> },
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
      role="banner"
      aria-label="主导航栏"
      style={{
        background: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        boxShadow: 'var(--shadow-sm)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: isMobile ? '0 12px' : '0 24px',
        height: 64,
        lineHeight: '64px',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
      }}
    >
      <div style={{ maxWidth: 1800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', minWidth: 0, flexShrink: 1 }}>
          <div style={{
            width: isMobile ? 32 : 36,
            height: isMobile ? 32 : 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(22, 119, 255, 0.3)',
            flexShrink: 0,
          }}>
            <StockOutlined style={{ fontSize: isMobile ? 17 : 20, color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: isMobile ? 15 : 17, color: 'var(--primary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>个人基金数据看板</span>
            {!isMobile && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.2 }}>智能投资分析平台</span>}
          </div>
        </Link>

        {isMobile ? (
          <Space size={12}>
            {user ? (
              <>
              <Dropdown
                trigger={['click']}
                dropdownRender={() => (
                  <div style={{ background: 'var(--bg-container)', borderRadius: 8, boxShadow: 'var(--shadow-md)', padding: 12, width: 'calc(100vw - 24px)', maxWidth: 300, maxHeight: 360, overflow: 'auto' }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, padding: '0 4px' }}>消息提醒</div>
                    {alerts.length === 0 ? (
                      <Empty description="暂无提醒" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <List
                        size="small"
                        dataSource={alerts.slice(0, 10)}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ padding: '8px 4px', alignItems: 'flex-start', cursor: 'pointer' }}
                            onClick={() => handleDismissAlert(item)}
                          >
                            <div style={{ marginRight: 8, marginTop: 2 }}>
                              {item.type?.startsWith('news_accident') ? <WarningOutlined style={{ color: '#f5222d' }} /> :
                               item.type?.startsWith('news_') ? <ThunderboltOutlined style={{ color: '#722ed1' }} /> :
                               item.level === 'warning' ? <WarningOutlined style={{ color: '#faad14' }} /> :
                               item.level === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                               <InfoCircleOutlined style={{ color: '#1677ff' }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{item.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.message}</div>
                              {item.actionText && (
                                <Tag
                                  color={item.action === 'buy' ? 'green' : item.action === 'sell' ? 'red' : 'blue'}
                                  style={{ marginTop: 4, fontSize: 11 }}
                                >
                                  {item.actionText}
                                </Tag>
                              )}
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                )}
              >
                <Badge count={alerts.length} size="small" offset={[-2, 2]}>
                  <Button type="text" icon={<BellOutlined />} aria-label={`通知 (${alerts.length}条)`} style={{ color: 'var(--text-secondary)', fontSize: 16 }} />
                </Badge>
              </Dropdown>
              <Dropdown menu={{
                items: [
                  { key: 'profile', label: '个人中心', icon: <IdcardOutlined /> },
                  { key: 'subscription', label: '会员中心', icon: <StarOutlined /> },
                  { key: 'portfolio', label: '理财记账', icon: <AccountBookOutlined /> },
                  ...(user?.role === 'admin' ? [
                    { type: 'divider' as const },
                    { key: '/admin/users', label: '用户管理', icon: <TeamOutlined /> },
                    { key: '/admin/monitor', label: '系统监控', icon: <DashboardOutlined /> },
                  ] : []),
                  { type: 'divider' as const },
                  { key: 'changePassword', label: '修改密码', icon: <KeyOutlined /> },
                  { key: 'about', label: '关于', icon: <InfoCircleOutlined /> },
                  { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') { logout(); navigate('/'); }
                  if (key === 'profile') navigate('/profile');
                  if (key === 'portfolio') navigate('/portfolio');
                  if (key === 'subscription') navigate('/subscription');
                  if (key === '/admin/users' || key === '/admin/monitor') navigate(key);
                  if (key === 'changePassword') setPwdModalOpen(true);
                  if (key === 'about') navigate('/about');
                },
              }}>
                <Space size={4}>
                  <Avatar size="small" icon={<UserOutlined />} src={user.avatar_url} style={{ cursor: 'pointer', background: user?.role === 'admin' ? '#722ed1' : '#1677ff' }} />
                  {user?.subscription_status === 'premium' && <CrownOutlined style={{ color: '#ffd700', fontSize: 12 }} />}
                </Space>
              </Dropdown>
              </>
            ) : (
              <Link to="/login"><Button type="primary" size="small" icon={<UserOutlined />}>登录</Button></Link>
            )}
            <Tooltip title={isDark ? '浅色模式' : '深色模式'}>
              <Button
                type="text"
                onClick={toggleTheme}
                style={{ fontSize: 18, color: 'var(--text-secondary)' }}
              >
                {isDark ? '☀️' : '🌙'}
              </Button>
            </Tooltip>
            <LanguageSwitcher />
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
              aria-label="打开导航菜单"
              aria-expanded={drawerOpen}
              style={{ fontSize: 18, color: 'var(--text-secondary)' }}
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
              <Tooltip title="命令面板 (Ctrl+K)">
                <Button
                  type="text"
                  onClick={() => document.dispatchEvent(new Event('command-palette-open'))}
                  style={{
                    fontSize: 12, color: 'var(--text-tertiary)',
                    padding: '2px 8px', borderRadius: 6,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}`,
                    display: 'flex', alignItems: 'center', gap: 4,
                    lineHeight: 1,
                  }}
                >
                  <SearchOutlined style={{ fontSize: 12 }} />
                  <span style={{ fontSize: 11 }}>⌘K</span>
                </Button>
              </Tooltip>
              <Tooltip title={isDark ? '浅色模式' : '深色模式'}>
                <Button
                  type="text"
                  onClick={toggleTheme}
                  style={{ fontSize: 18, color: 'var(--text-secondary)' }}
                >
                  {isDark ? '☀️' : '🌙'}
                </Button>
              </Tooltip>
              <LanguageSwitcher />
              {user ? (
                <>
                <Dropdown
                  trigger={['click']}
                  dropdownRender={() => (
                    <div style={{ background: 'var(--bg-container)', borderRadius: 8, boxShadow: 'var(--shadow-md)', padding: 12, width: 320, maxHeight: 400, overflow: 'auto' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>消息提醒</span>
                        {alerts.length > 0 && <Tag color="red" style={{ margin: 0 }}>{alerts.length} 条</Tag>}
                      </div>
                      {alerts.length === 0 ? (
                        <Empty description="暂无提醒" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        <List
                          size="small"
                          dataSource={alerts.slice(0, 10)}
                          renderItem={(item: any) => (
                            <List.Item
                              style={{ padding: '8px 4px', alignItems: 'flex-start', cursor: 'pointer' }}
                              onClick={() => handleDismissAlert(item)}
                            >
                              <div style={{ marginRight: 8, marginTop: 2 }}>
                                {item.type?.includes('drop') || item.type === 'holding_loss' ? <FallOutlined style={{ color: '#ff4d4f' }} /> :
                                 item.type?.includes('surge') ? <RiseOutlined style={{ color: '#52c41a' }} /> :
                                 item.type === 'valuation_low' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                                 item.type === 'valuation_high' ? <WarningOutlined style={{ color: '#faad14' }} /> :
                                 item.type === 'qdii_limit' ? <InfoCircleOutlined style={{ color: '#1890ff' }} /> :
                                 item.type?.startsWith('news_accident') ? <WarningOutlined style={{ color: '#f5222d' }} /> :
                                 item.type?.startsWith('news_') ? <ThunderboltOutlined style={{ color: '#722ed1' }} /> :
                                 item.level === 'warning' ? <ExclamationCircleOutlined style={{ color: '#faad14' }} /> :
                                 <InfoCircleOutlined style={{ color: '#1677ff' }} />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.message}</div>
                                {item.actionText && (
                                  <Tag
                                    color={item.action === 'buy' ? 'green' : item.action === 'sell' ? 'red' : item.action === 'watch' ? 'blue' : 'default'}
                                    style={{ marginTop: 4, fontSize: 11 }}
                                  >
                                    {item.actionText}
                                  </Tag>
                                )}
                                {item.relatedIndustries && item.relatedIndustries.length > 0 && (
                                  <div style={{ marginTop: 3 }}>
                                    {item.relatedIndustries.slice(0, 3).map((ind: string) => (
                                      <Tag key={ind} style={{ fontSize: 10, margin: '0 2px 0 0' }}>{ind}</Tag>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </List.Item>
                          )}
                        />
                      )}
                    </div>
                  )}
                >
                  <Badge count={alerts.length} size="small" offset={[-2, 2]}>
                    <Button type="text" icon={<BellOutlined />} style={{ color: 'var(--text-secondary)', fontSize: 16 }} />
                  </Badge>
                </Dropdown>
                <Dropdown menu={{
                  items: [
                    { key: 'profile', label: '个人中心', icon: <IdcardOutlined /> },
                    { key: 'portfolio', label: '理财记账', icon: <AccountBookOutlined /> },
                    ...(user?.role === 'admin' ? [
                      { type: 'divider' as const },
                      { key: '/admin/users', label: '用户管理', icon: <TeamOutlined /> },
                      { key: '/admin/monitor', label: '系统监控', icon: <DashboardOutlined /> },
                    ] : []),
                    { type: 'divider' as const },
                    { key: 'changePassword', label: '修改密码', icon: <KeyOutlined /> },
                    { key: 'about', label: '关于', icon: <InfoCircleOutlined /> },
                    { key: 'logout', label: '退出登录', icon: <LogoutOutlined /> },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'logout') { logout(); navigate('/'); }
                    if (key === 'profile') navigate('/profile');
                    if (key === 'portfolio') navigate('/portfolio');
                    if (key === '/admin/users' || key === '/admin/monitor') navigate(key);
                    if (key === 'changePassword') setPwdModalOpen(true);
                    if (key === 'about') navigate('/about');
                  },
                }}>
                  <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 8, transition: 'background 0.2s' }}>
                    <Avatar size="small" icon={<UserOutlined />} src={user.avatar_url} style={{ background: user?.role === 'admin' ? '#722ed1' : '#1677ff' }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 14 }}>{user.nickname || user.username}</span>
                    {user?.subscription_status === 'premium' && (
                      <Tag icon={<CrownOutlined />} color="gold" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>VIP</Tag>
                    )}
                    {user?.role === 'admin' && <Tag color="purple" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>管理员</Tag>}
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
          header: { borderBottom: '1px solid var(--border-color-light)' },
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
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)' }}>
            <Button block icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/'); setDrawerOpen(false); }} danger>
              退出登录
            </Button>
          </div>
        )}
        <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border-color)' }}>
          <Button block icon={<InfoCircleOutlined />} onClick={() => { navigate('/about'); setDrawerOpen(false); }}>
            关于
          </Button>
        </div>
        <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border-color)' }}>
          <Button block onClick={() => { toggleTheme(); setDrawerOpen(false); }}>
            {isDark ? '☀️ 切换浅色模式' : '🌙 切换深色模式'}
          </Button>
        </div>
      </Drawer>

      <Modal
        title="修改密码"
        open={pwdModalOpen}
        onOk={handleChangePassword}
        onCancel={() => { setPwdModalOpen(false); pwdForm.resetFields(); }}
        confirmLoading={pwdLoading}
        okText="确认修改"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="oldPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度不能少于8个字符' },
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少8位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout.Header>
  );
}
