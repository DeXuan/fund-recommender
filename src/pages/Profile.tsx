import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Avatar, Typography, Button, Form, Input, message, Tabs, Table, Tag, Space, Descriptions, Spin, Modal, Row, Col, Statistic, Divider, Upload,
} from 'antd';
import {
  UserOutlined, EditOutlined, SafetyOutlined, CrownOutlined, KeyOutlined, HistoryOutlined, CameraOutlined, CheckCircleOutlined, CloseCircleOutlined, LockOutlined, MobileOutlined, MailOutlined, CalendarOutlined, StarOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { authApi, profileApi, subscriptionApi } from '../services/api';

const { Title, Text } = Typography;

export default function Profile() {
  const { user, setUser } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [subStatus, setSubStatus] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm] = Form.useForm();
  const [editForm] = Form.useForm();

  useEffect(() => {
    if (user) {
      editForm.setFieldsValue({ nickname: user.nickname });
    }
  }, [user]);

  const handleUpdateProfile = async (values: { nickname: string }) => {
    setProfileLoading(true);
    try {
      const res = await profileApi.updateProfile({ nickname: values.nickname });
      if (res.user) {
        setUser(res.user);
        message.success('个人信息更新成功');
      }
      setEditing(false);
    } catch (err: any) {
      message.error(err.message || '更新失败');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const values = await pwdForm.validateFields();
      setPwdLoading(true);
      await authApi.changePassword(values.oldPassword, values.newPassword);
      message.success('密码修改成功');
      setPwdModalOpen(false);
      pwdForm.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '修改密码失败');
    } finally {
      setPwdLoading(false);
    }
  };

  const loadLoginHistory = async () => {
    setLogsLoading(true);
    try {
      const res = await profileApi.getLoginHistory();
      setLoginLogs(res.logs || []);
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  };

  const loadSubStatus = async () => {
    setSubLoading(true);
    try {
      const res = await subscriptionApi.getStatus();
      setSubStatus(res);
    } catch {
      // silent
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadLoginHistory();
      loadSubStatus();
    }
  }, [user]);

  if (!user) return null;

  const isPremium = user.subscription_status === 'premium';
  const isAdmin = user.role === 'admin';

  const loginLogColumns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => v === 'success' ? <Tag color="green">成功</Tag> : v === 'failed' ? <Tag color="red">失败</Tag> : <Tag color="orange">锁定</Tag> },
    { title: '浏览器', dataIndex: 'browser', key: 'browser', width: 120, render: (v: string) => v || '-' },
    { title: '系统', dataIndex: 'os', key: 'os', width: 120, render: (v: string) => v || '-' },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 140, render: (v: string) => v || '-' },
  ];

  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Banner */}
      <Card
        bordered={false}
        style={{
          ...cardStyle,
          marginBottom: 24,
          background: isDark
            ? 'linear-gradient(135deg, rgba(22,119,255,0.15) 0%, rgba(114,46,209,0.15) 100%)'
            : 'linear-gradient(135deg, #e6f4ff 0%, #f9f0ff 100%)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={96}
              icon={<UserOutlined />}
              src={user.avatar_url}
              style={{
                background: isAdmin ? '#722ed1' : '#1677ff',
                border: `4px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#fff'}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Title level={3} style={{ margin: 0 }}>{user.nickname || user.username}</Title>
              {isPremium && <Tag icon={<CrownOutlined />} color="gold" style={{ fontSize: 12 }}>VIP会员</Tag>}
              {isAdmin && <Tag color="purple" style={{ fontSize: 12 }}>管理员</Tag>}
            </div>
            <Text type="secondary" style={{ fontSize: 14 }}>账号：{user.username}</Text>
            {user.created_at && (
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </Text>
              </div>
            )}
          </div>
          <Space>
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>编辑资料</Button>
            <Button icon={<KeyOutlined />} onClick={() => setPwdModalOpen(true)}>修改密码</Button>
          </Space>
        </div>
      </Card>

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={8} sm={8} md={8}>
          <Card bordered={false} style={{ ...cardStyle, textAlign: 'center' }}>
            <Statistic
              title="会员状态"
              value={isPremium ? 'VIP会员' : '普通用户'}
              valueStyle={{ color: isPremium ? '#faad14' : 'var(--text-secondary)', fontSize: 18 }}
              prefix={isPremium ? <CrownOutlined /> : <UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8} sm={8} md={8}>
          <Card bordered={false} style={{ ...cardStyle, textAlign: 'center' }}>
            <Statistic
              title="账户类型"
              value={isAdmin ? '管理员' : '普通用户'}
              valueStyle={{ color: isAdmin ? '#722ed1' : 'var(--text-secondary)', fontSize: 18 }}
              prefix={isAdmin ? <StarOutlined /> : <SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={8} sm={8} md={8}>
          <Card bordered={false} style={{ ...cardStyle, textAlign: 'center' }}>
            <Statistic
              title="登录设备"
              value="Web端"
              valueStyle={{ fontSize: 18 }}
              prefix={<MobileOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Card bordered={false} style={cardStyle}>
        <Tabs
          defaultActiveKey="info"
          items={[
            {
              key: 'info',
              label: <span><UserOutlined /> 基本信息</span>,
              children: (
                <div style={{ maxWidth: 600, padding: '16px 0' }}>
                  {editing ? (
                    <Form form={editForm} layout="vertical" onFinish={handleUpdateProfile}>
                      <Form.Item label="头像">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <Avatar
                            size={64}
                            icon={<UserOutlined />}
                            src={user.avatar_url}
                            style={{ background: isAdmin ? '#722ed1' : '#1677ff' }}
                          />
                          <div>
                            <Text type="secondary" style={{ fontSize: 13 }}>头像可通过支付宝登录自动同步</Text>
                          </div>
                        </div>
                      </Form.Item>
                      <Form.Item
                        name="nickname"
                        label="昵称"
                        rules={[
                          { required: true, message: '请输入昵称' },
                          { max: 30, message: '昵称不能超过30个字符' },
                        ]}
                      >
                        <Input placeholder="请输入昵称" showCount maxLength={30} />
                      </Form.Item>
                      <Form.Item label="用户名">
                        <Input value={user.username} disabled />
                      </Form.Item>
                      <Form.Item>
                        <Space>
                          <Button type="primary" htmlType="submit" loading={profileLoading}>保存</Button>
                          <Button onClick={() => { setEditing(false); editForm.setFieldsValue({ nickname: user.nickname }); }}>取消</Button>
                        </Space>
                      </Form.Item>
                    </Form>
                  ) : (
                    <Descriptions column={1} labelStyle={{ width: 120, fontWeight: 500 }}>
                      <Descriptions.Item label="头像">
                        <Avatar
                          size={48}
                          icon={<UserOutlined />}
                          src={user.avatar_url}
                          style={{ background: isAdmin ? '#722ed1' : '#1677ff' }}
                        />
                      </Descriptions.Item>
                      <Descriptions.Item label="昵称">{user.nickname || '-'}</Descriptions.Item>
                      <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
                      <Descriptions.Item label="用户ID">{user.id}</Descriptions.Item>
                      <Descriptions.Item label="注册时间">
                        {user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  )}
                </div>
              ),
            },
            {
              key: 'security',
              label: <span><SafetyOutlined /> 账户安全</span>,
              children: (
                <div style={{ padding: '16px 0' }}>
                  <Title level={5} style={{ marginBottom: 16 }}>安全设置</Title>
                  <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <LockOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>登录密码</div>
                          <Text type="secondary" style={{ fontSize: 13 }}>已设置，建议定期更换密码</Text>
                        </div>
                      </div>
                      <Button size="small" onClick={() => setPwdModalOpen(true)}>修改</Button>
                    </div>
                  </Card>
                  <Card size="small" style={{ ...cardStyle, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <MobileOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>支付宝绑定</div>
                          <Text type="secondary" style={{ fontSize: 13 }}>可通过支付宝扫码快速登录</Text>
                        </div>
                      </div>
                      <Tag color="green">已支持</Tag>
                    </div>
                  </Card>

                  <Divider />
                  <Title level={5} style={{ marginBottom: 16 }}>登录历史</Title>
                  <Table
                    dataSource={loginLogs}
                    columns={loginLogColumns}
                    rowKey="id"
                    loading={logsLoading}
                    size="small"
                    pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
                    locale={{ emptyText: '暂无登录记录' }}
                  />
                </div>
              ),
            },
            {
              key: 'subscription',
              label: <span><CrownOutlined /> 会员中心</span>,
              children: (
                <div style={{ padding: '16px 0' }}>
                  {subLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                  ) : (
                    <>
                      <Card
                        style={{
                          ...cardStyle,
                          marginBottom: 24,
                          background: isPremium
                            ? (isDark ? 'linear-gradient(135deg, rgba(250,173,20,0.12) 0%, rgba(255,215,0,0.08) 100%)' : 'linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%)')
                            : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                              width: 56, height: 56, borderRadius: 12,
                              background: isPremium ? 'linear-gradient(135deg, #faad14, #ffd700)' : isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <CrownOutlined style={{ fontSize: 28, color: isPremium ? '#fff' : 'var(--text-tertiary)' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 600 }}>
                                {isPremium ? 'VIP会员' : '普通用户'}
                              </div>
                              {isPremium && subStatus?.expiresAt && (
                                <Text type="secondary">
                                  有效期至 {new Date(subStatus.expiresAt).toLocaleDateString('zh-CN')}
                                  {subStatus.daysRemaining !== undefined && ` (剩余${subStatus.daysRemaining}天)`}
                                </Text>
                              )}
                              {!isPremium && (
                                <Text type="secondary">升级VIP解锁更多高级功能</Text>
                              )}
                            </div>
                          </div>
                          {!isPremium && (
                            <Button type="primary" icon={<CrownOutlined />} onClick={() => navigate('/subscription')}>
                              立即开通
                            </Button>
                          )}
                          {isPremium && subStatus?.daysRemaining !== undefined && subStatus.daysRemaining < 30 && (
                            <Button type="primary" icon={<CrownOutlined />} onClick={() => navigate('/subscription')}>
                              续费会员
                            </Button>
                          )}
                        </div>
                      </Card>

                      <Title level={5} style={{ marginBottom: 16 }}>会员权益</Title>
                      <Row gutter={[16, 16]}>
                        {[
                          { icon: <StarOutlined />, title: 'AI智能选股', desc: '多因子量化选股模型', free: false },
                          { icon: <EditOutlined />, title: '高级分析报告', desc: '深度基金对比与归因分析', free: false },
                          { icon: <HistoryOutlined />, title: '实时提醒', desc: '净值/估值变动即时推送', free: true },
                          { icon: <SafetyOutlined />, title: '理财记账', desc: '持仓管理与收益分析', free: true },
                        ].map((item, i) => (
                          <Col xs={12} sm={12} md={6} key={i}>
                            <Card size="small" style={{ ...cardStyle, textAlign: 'center', height: '100%' }}>
                              <div style={{ fontSize: 24, color: item.free || isPremium ? '#52c41a' : '#faad14', marginBottom: 8 }}>
                                {item.icon}
                              </div>
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
                              <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                              <div style={{ marginTop: 8 }}>
                                {item.free ? (
                                  <Tag color="green">免费</Tag>
                                ) : isPremium ? (
                                  <Tag color="gold">已解锁</Tag>
                                ) : (
                                  <Tag color="orange">VIP专属</Tag>
                                )}
                              </div>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Change Password Modal */}
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
          <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 8, message: '密码长度不能少于8个字符' }]}
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
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
