import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Input, Button, Tabs, message, Divider, Space, Modal, Spin, Result } from 'antd';
import { UserOutlined, LockOutlined, AlipayOutlined, CheckCircleOutlined, ScanOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { authApi, portfolioApi } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login, register, setUser } = useAuth();
  const { isDark: isDarkTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [alipayLoading, setAlipayLoading] = useState(false);

  // 支付宝登录状态
  const [alipayModalOpen, setAlipayModalOpen] = useState(false);
  const [alipayStatus, setAlipayStatus] = useState<'loading' | 'ready' | 'success'>('loading');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authWindowRef = useRef<Window | null>(null);

  // 模拟扫码弹窗状态
  const [mockModalOpen, setMockModalOpen] = useState(false);
  const [mockScanning, setMockScanning] = useState(false);
  const [mockSuccess, setMockSuccess] = useState(false);

  // Handle Alipay callback token (real OAuth redirect)
  useEffect(() => {
    const token = searchParams.get('token');
    if (token && token.length > 20 && token.length < 2000 && !token.includes(' ')) {
      // 先验证 token 有效性再存储，防止恶意注入
      // 临时设置以供 getMe 使用，验证失败即清除
      localStorage.setItem('token', token);
      authApi.getMe()
        .then(data => {
          if (!data.user || !data.user.id) {
            localStorage.removeItem('token');
            message.error('登录验证失败：无效的用户信息');
            return;
          }
          setUser(data.user);
          message.success('支付宝登录成功');
          initDemoAndRedirect();
        })
        .catch(() => {
          localStorage.removeItem('token');
          message.error('登录验证失败');
        });
    }
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user]);

  // 清理轮询和窗口
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (authWindowRef.current && !authWindowRef.current.closed) {
        authWindowRef.current.close();
      }
    };
  }, []);

  const initDemoAndRedirect = async () => {
    try {
      await portfolioApi.initDemo();
    } catch {
      // ignore - user may already have data
    }
    navigate('/portfolio', { replace: true });
  };

  // 处理支付宝授权成功
  const handleAlipayAuthSuccess = (token: string, user: any) => {
    localStorage.setItem('token', token);
    setUser(user);
    setAlipayStatus('success');
    message.success('支付宝登录成功');

    // 清理轮询
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // 关闭授权窗口
    if (authWindowRef.current && !authWindowRef.current.closed) {
      authWindowRef.current.close();
    }

    // 跳转
    setTimeout(async () => {
      setAlipayModalOpen(false);
      await initDemoAndRedirect();
    }, 1500);
  };

  // 开始轮询后端检查授权状态
  const startPolling = (state: string) => {
    // 5分钟后超时
    const expireTimer = setTimeout(() => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setAlipayStatus('ready');
        message.warning('授权超时，请重试');
      }
    }, 5 * 60 * 1000);

    pollingRef.current = setInterval(async () => {
      try {
        const data = await authApi.alipayCheck(state);
        if (data.status === 'success' && data.token && data.user) {
          clearTimeout(expireTimer);
          handleAlipayAuthSuccess(data.token, data.user);
        }
      } catch {
        // 忽略轮询错误，继续轮询
      }
    }, 2000);
  };

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/', { replace: true });
    } catch (e: any) {
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { username: string; password: string; nickname: string }) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.nickname);
      message.success('注册成功');
      navigate('/', { replace: true });
    } catch (e: any) {
      message.error(e.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 点击支付宝登录按钮
  const handleAlipayLogin = async () => {
    setAlipayLoading(true);
    setAlipayStatus('loading');

    try {
      const res = await fetch('/api/auth/alipay/qrcode');
      const data = await res.json();

      if (data.mock) {
        // 模拟模式：弹出模拟扫码弹窗
        setMockModalOpen(true);
        setMockScanning(false);
        setMockSuccess(false);
      } else {
        // 真实模式：打开支付宝授权窗口
        setAlipayModalOpen(true);
        setAlipayStatus('ready');

        // 打开新窗口进行授权
        authWindowRef.current = window.open(
          data.url,
          'alipay_auth',
          'width=500,height=700,scrollbars=yes,resizable=yes,centerscreen=yes'
        );

        // 开始轮询检查授权状态
        startPolling(data.state);
      }
    } catch {
      // 网络错误也走模拟模式
      setMockModalOpen(true);
      setMockScanning(false);
      setMockSuccess(false);
    } finally {
      setAlipayLoading(false);
    }
  };

  // 模拟扫码确认
  const handleMockScan = async () => {
    setMockScanning(true);
    try {
      // 模拟扫码延迟
      await new Promise(resolve => setTimeout(resolve, 1500));

      const data = await authApi.alipayMockLogin();
      localStorage.setItem('token', data.token);
      setUser(data.user);

      setMockSuccess(true);
      message.success('支付宝登录成功');

      // 导入示例数据后跳转
      setTimeout(async () => {
        setMockModalOpen(false);
        await initDemoAndRedirect();
      }, 1000);
    } catch (e: any) {
      message.error(e.message || '登录失败');
      setMockScanning(false);
    }
  };

  const loginTab = (
    <Form onFinish={handleLogin} size="large" autoComplete="off">
      <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input prefix={<UserOutlined />} placeholder="用户名" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>
    </Form>
  );

  const registerTab = (
    <Form onFinish={handleRegister} size="large" autoComplete="off">
      <Form.Item name="username" rules={[
        { required: true, message: '请输入用户名' },
        { min: 3, max: 20, message: '用户名长度为3-20个字符' },
      ]}>
        <Input prefix={<UserOutlined />} placeholder="用户名" />
      </Form.Item>
      <Form.Item name="nickname">
        <Input prefix={<UserOutlined />} placeholder="昵称（选填）" />
      </Form.Item>
      <Form.Item name="password" rules={[
        { required: true, message: '请输入密码' },
        { min: 8, message: '密码长度不能少于8个字符' },
      ]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
      </Form.Item>
      <Form.Item
        name="confirmPassword"
        dependencies={['password']}
        rules={[
          { required: true, message: '请确认密码' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve();
              return Promise.reject(new Error('两次输入的密码不一致'));
            },
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          注册
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 'calc(100vh - 120px)',
    }}>
      <Card style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#1677ff' }}>基金推荐助手</h2>
          <p style={{ color: isDarkTheme ? '#a0a0a0' : '#666', margin: '8px 0 0' }}>登录后使用理财记账功能</p>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            { key: 'login', label: '登录', children: loginTab },
            { key: 'register', label: '注册', children: registerTab },
          ]}
        />

        <Divider plain style={{ color: isDarkTheme ? '#6b6b6b' : '#999' }}>其他登录方式</Divider>

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            size="large"
            icon={<AlipayOutlined />}
            loading={alipayLoading}
            onClick={handleAlipayLogin}
            style={{
              background: '#1677ff',
              borderColor: '#1677ff',
              color: '#fff',
            }}
          >
            支付宝扫码登录
          </Button>
        </Space>
      </Card>

      {/* 支付宝授权弹窗 */}
      <Modal
        open={alipayModalOpen}
        onCancel={() => {
          setAlipayModalOpen(false);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (authWindowRef.current && !authWindowRef.current.closed) {
            authWindowRef.current.close();
          }
        }}
        footer={null}
        width={400}
        centered
        destroyOnClose
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          {/* 支付宝风格头部 */}
          <div style={{
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            margin: '-24px -24px 24px',
            padding: '24px 20px 20px',
            borderRadius: '8px 8px 0 0',
          }}>
            <AlipayOutlined style={{ fontSize: 32, color: '#fff' }} />
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginTop: 8 }}>支付宝授权登录</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>
              基金推荐助手 · 安全登录
            </div>
          </div>

          {alipayStatus === 'success' ? (
            <Result
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              title="登录成功"
              subTitle="正在跳转..."
              style={{ padding: '24px 0' }}
            />
          ) : (
            <div style={{ padding: '32px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 20, color: isDarkTheme ? '#a0a0a0' : '#666', fontSize: 14 }}>
                请在弹出的支付宝窗口中完成授权
              </div>
              <div style={{ marginTop: 8, color: isDarkTheme ? '#6b6b6b' : '#999', fontSize: 12 }}>
                授权完成后将自动登录
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 模拟支付宝扫码弹窗（开发模式） */}
      <Modal
        open={mockModalOpen}
        onCancel={() => { setMockModalOpen(false); setMockScanning(false); setMockSuccess(false); }}
        footer={null}
        width={360}
        centered
        destroyOnClose
      >
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          {/* 支付宝风格头部 */}
          <div style={{
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            margin: '-24px -24px 24px',
            padding: '24px 20px 20px',
            borderRadius: '8px 8px 0 0',
          }}>
            <AlipayOutlined style={{ fontSize: 32, color: '#fff' }} />
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginTop: 8 }}>支付宝扫码登录</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>
              基金推荐助手 · 演示模式
            </div>
          </div>

          {mockSuccess ? (
            <Result
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              title="登录成功"
              subTitle="正在跳转..."
              style={{ padding: '24px 0' }}
            />
          ) : mockScanning ? (
            <div style={{ padding: '24px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: isDarkTheme ? '#a0a0a0' : '#666' }}>正在验证登录...</div>
            </div>
          ) : (
            <>
              {/* 模拟二维码 */}
              <div style={{
                width: 200,
                height: 200,
                margin: '0 auto 16px',
                background: '#fff',
                border: isDarkTheme ? '1px solid #333' : '1px solid #e8e8e8',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {/* 二维码图案（用CSS模拟） */}
                <div style={{
                  width: 160,
                  height: 160,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gridTemplateRows: 'repeat(8, 1fr)',
                  gap: 2,
                }}>
                  {Array.from({ length: 64 }, (_, i) => {
                    const row = Math.floor(i / 8);
                    const col = i % 8;
                    const isCorner = (row < 3 && col < 3) || (row < 3 && col > 4) || (row > 4 && col < 3);
                    const isDark = isCorner || [5,10,13,18,21,26,29,34,37,42,45,50,53,58].includes(i);
                    return (
                      <div key={i} style={{
                        background: isDark ? '#000' : '#fff',
                        borderRadius: 1,
                      }} />
                    );
                  })}
                </div>
                {/* 中间支付宝logo */}
                <div style={{
                  position: 'absolute',
                  width: 36,
                  height: 36,
                  background: '#1677ff',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(22,119,255,0.3)',
                }}>
                  <AlipayOutlined style={{ fontSize: 20, color: '#fff' }} />
                </div>
              </div>

              <div style={{ color: isDarkTheme ? '#6b6b6b' : '#999', fontSize: 12, marginBottom: 16 }}>
                <ScanOutlined style={{ marginRight: 4 }} />
                演示模式 · 点击下方按钮模拟扫码
              </div>

              <Button
                type="primary"
                size="large"
                block
                icon={<ScanOutlined />}
                onClick={handleMockScan}
              >
                模拟扫码确认登录
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
