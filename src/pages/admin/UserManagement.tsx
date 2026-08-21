import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, message, Card, Statistic, Row, Col, Avatar,
  Modal, Select, Input, Drawer, Descriptions, Tabs, Typography, Tooltip, Badge, Dropdown, Empty, Form,
} from 'antd';
import {
  UserOutlined, DeleteOutlined, CrownOutlined, TeamOutlined,
  SearchOutlined, ReloadOutlined, KeyOutlined, StopOutlined, CheckCircleOutlined,
  ExportOutlined, LockOutlined, UnlockOutlined, EyeOutlined, MoreOutlined,
  RiseOutlined, AuditOutlined, LinkOutlined,
  CopyOutlined, ExclamationCircleOutlined, FundOutlined, StarOutlined,
  EditOutlined, LoginOutlined, GlobalOutlined, PlusOutlined,
  DesktopOutlined, MobileOutlined, TabletOutlined, GiftOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getEchartsTheme } from '../../utils/echarts-theme';

const { Search } = Input;
const { Text } = Typography;
const { TextArea } = Input;

interface UserRecord {
  id: number;
  username: string;
  nickname: string;
  avatar_url: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at: string;
  last_login_ip: string;
  oauth_count: number;
  record_count: number;
  total_invested: number;
  login_fail_count: number;
  locked_until: string;
  subscription_status: string;
  subscription_end: string;
}

// Stats cards component
function UserStats({ stats }: { stats: any }) {
  if (!stats) return null;
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="总用户" value={parseInt(stats.total) || 0} prefix={<TeamOutlined />} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="管理员" value={parseInt(stats.admin_count) || 0} prefix={<CrownOutlined />} valueStyle={{ color: 'var(--color-purple)' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="已禁用" value={parseInt(stats.disabled_count) || 0} prefix={<StopOutlined />} valueStyle={{ color: 'var(--danger)' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="7日活跃" value={parseInt(stats.active_7d) || 0} prefix={<RiseOutlined />} valueStyle={{ color: 'var(--success)' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="30日活跃" value={parseInt(stats.active_30d) || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: 'var(--primary)' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="本月新增" value={parseInt(stats.new_30d) || 0} prefix={<RiseOutlined />} valueStyle={{ color: 'var(--warning)' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="VIP会员" value={parseInt(stats.vip_count) || 0} prefix={<GiftOutlined />} valueStyle={{ color: 'var(--warning)' }} />
        </Card>
      </Col>
    </Row>
  );
}

// Registration trend chart
function TrendChart({ stats }: { stats: any }) {
  const { isDark } = useTheme();
  if (!stats?.registrationTrend?.length && !stats?.loginTrend?.length) return null;
  const regDates = stats.registrationTrend?.map((d: any) => d.date) || [];
  const regCounts = stats.registrationTrend?.map((d: any) => parseInt(d.count)) || [];
  const loginDates = stats.loginTrend?.map((d: any) => d.date) || [];
  const loginCounts = stats.loginTrend?.map((d: any) => parseInt(d.count)) || [];

  const allDates = [...new Set([...regDates, ...loginDates])].sort();
  const regMap = Object.fromEntries(regDates.map((d: string, i: number) => [d, regCounts[i]]));
  const loginMap = Object.fromEntries(loginDates.map((d: string, i: number) => [d, loginCounts[i]]));

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['注册', '登录'], bottom: 0 },
    grid: { left: 50, right: 20, top: 10, bottom: 40 },
    xAxis: { type: 'category', data: allDates.map(d => d.slice(5)), boundaryGap: false },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '注册', type: 'bar', data: allDates.map(d => regMap[d] || 0), itemStyle: { color: '#1677ff' }, barMaxWidth: 20 },
      { name: '登录', type: 'line', smooth: true, data: allDates.map(d => loginMap[d] || 0), lineStyle: { width: 2 }, areaStyle: { opacity: 0.08 }, color: '#52c41a' },
    ],
  };
  return (
    <Card size="small" title="近30日用户活跃趋势" style={{ marginBottom: 20 }}>
      <ReactECharts option={option} style={{ height: 200 }} theme={getEchartsTheme(isDark)} />
    </Card>
  );
}

// Edit user modal
function EditUserModal({ user, open, onClose, onSuccess }: { user: UserRecord | null; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      form.setFieldsValue({ nickname: user.nickname, avatar_url: user.avatar_url });
    }
  }, [user, open]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await adminApi.editUser(user!.id, values);
      message.success('用户信息已更新');
      onClose();
      onSuccess();
    } catch (err: any) {
      if (err.message) message.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <Modal title="编辑用户信息" open={open} onCancel={onClose} onOk={handleSave} confirmLoading={loading} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item label="昵称" name="nickname">
          <Input prefix={<UserOutlined />} placeholder="用户昵称" />
        </Form.Item>
        <Form.Item label="头像URL" name="avatar_url">
          <Input prefix={<LinkOutlined />} placeholder="https://example.com/avatar.png" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// User notes component
function UserNotes({ userId }: { userId: number }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUserNotes(userId);
      setNotes(res.notes);
    } catch { message.error('获取备注失败'); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    try {
      setSubmitting(true);
      await adminApi.addUserNote(userId, newNote.trim());
      setNewNote('');
      fetchNotes();
    } catch { message.error('添加备注失败'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number) => {
    try { await adminApi.deleteNote(id); fetchNotes(); }
    catch { message.error('删除备注失败'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <TextArea rows={2} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="添加管理员备注..." style={{ marginBottom: 8 }} />
        <Button type="primary" size="small" icon={<PlusOutlined />} loading={submitting} onClick={handleAdd} disabled={!newNote.trim()}>添加备注</Button>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 20 }}><ReloadOutlined spin /></div> :
        notes.length === 0 ? <Empty description="暂无备注" /> :
          notes.map(note => (
            <Card key={note.id} size="small" style={{ marginBottom: 8 }}
              extra={<Popconfirm title="确定删除？" onConfirm={() => handleDelete(note.id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}>
              <div style={{ fontSize: 13 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                <Tag color="purple" style={{ fontSize: 10 }}>{note.admin_username}</Tag>
                {new Date(note.created_at).toLocaleString('zh-CN')}
              </div>
            </Card>
          ))
      }
    </div>
  );
}

// User detail drawer
function UserDetailDrawer({ userId, open, onClose }: { userId: number | null; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId && open) {
      setLoading(true);
      adminApi.getUserDetail(userId).then(setData).catch(() => message.error('获取用户详情失败')).finally(() => setLoading(false));
    }
  }, [userId, open]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('已复制'));
  };

  return (
    <Drawer
      title="用户详情"
      open={open}
      onClose={onClose}
      width={580}
      destroyOnClose
    >
      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><ReloadOutlined spin size={24} /></div> :
       !data ? <Empty /> : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <Avatar size={64} icon={<UserOutlined />} src={data.user.avatar_url} style={{ background: data.user.role === 'admin' ? 'var(--color-purple)' : 'var(--primary)' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{data.user.nickname || data.user.username}</div>
              <Space size={8}>
                <Text type="secondary">@{data.user.username}</Text>
                <Tooltip title="复制用户名"><CopyOutlined style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => copyToClipboard(data.user.username)} /></Tooltip>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Tag color={data.user.role === 'admin' ? 'purple' : 'blue'}>{data.user.role === 'admin' ? '管理员' : '普通用户'}</Tag>
                <Tag color={data.user.status === 'active' ? 'green' : 'red'}>{data.user.status === 'active' ? '正常' : '已禁用'}</Tag>
              </div>
            </div>
          </div>

          <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="用户 ID">{data.user.id}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{new Date(data.user.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="最后登录">{data.user.last_login_at ? new Date(data.user.last_login_at).toLocaleString('zh-CN') : '从未登录'}</Descriptions.Item>
            <Descriptions.Item label="最后登录IP">{data.user.last_login_ip || '-'}</Descriptions.Item>
            <Descriptions.Item label="关联账户">{data.oauthAccounts?.length > 0 ? data.oauthAccounts.map((o: any) => <Tag key={o.provider} color="green">{o.provider}</Tag>) : '-'}</Descriptions.Item>
            <Descriptions.Item label="登录失败">{data.user.login_fail_count || 0} 次</Descriptions.Item>
            <Descriptions.Item label="VIP状态" span={2}>
              {(() => {
                const isVip = data.user.subscription_status === 'premium' && data.user.subscription_end && new Date(data.user.subscription_end) > new Date();
                if (isVip) {
                  const daysLeft = Math.ceil((new Date(data.user.subscription_end).getTime() - Date.now()) / 86400000);
                  return <Tag color="gold" icon={<GiftOutlined />}>VIP会员 剩余{daysLeft}天 (到期: {new Date(data.user.subscription_end).toLocaleDateString('zh-CN')})</Tag>;
                }
                return <Tag>普通用户</Tag>;
              })()}
            </Descriptions.Item>
          </Descriptions>

          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col span={8}><Card size="small"><Statistic title="持仓记录" value={parseInt(data.portfolio?.record_count) || 0} prefix={<FundOutlined />} valueStyle={{ fontSize: 20 }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="总投入" value={parseFloat(data.portfolio?.total_invested) || 0} prefix="¥" precision={0} valueStyle={{ fontSize: 20 }} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="自选基金" value={data.watchlistCount || 0} prefix={<StarOutlined />} valueStyle={{ fontSize: 20 }} /></Card></Col>
          </Row>

          {data.portfolio && parseFloat(data.portfolio.total_pnl) !== 0 && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}><Statistic title="总市值" value={parseFloat(data.portfolio.total_value) || 0} prefix="¥" precision={2} valueStyle={{ fontSize: 16 }} /></Col>
                <Col span={8}><Statistic title="总盈亏" value={parseFloat(data.portfolio.total_pnl) || 0} prefix="¥" precision={2}
                  valueStyle={{ fontSize: 16, color: parseFloat(data.portfolio.total_pnl) >= 0 ? 'var(--danger)' : 'var(--success)' }} /></Col>
                <Col span={8}><Statistic title="定投计划" value={parseInt(data.dcaPlans?.total) || 0} suffix={`/ ${parseInt(data.dcaPlans?.active) || 0} 活跃`} valueStyle={{ fontSize: 16 }} /></Col>
              </Row>
            </Card>
          )}

          {data.riskProfile && (
            <Card size="small" title="风险评估" style={{ marginBottom: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="类型">{data.riskProfile.risk_type}</Descriptions.Item>
                <Descriptions.Item label="等级">{data.riskProfile.risk_level}</Descriptions.Item>
                <Descriptions.Item label="评分">{data.riskProfile.score}</Descriptions.Item>
                <Descriptions.Item label="评估时间">{new Date(data.riskProfile.created_at).toLocaleDateString('zh-CN')}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Card size="small" title="管理员备注" style={{ marginTop: 16 }}>
            <UserNotes userId={userId!} />
          </Card>
        </div>
      )}
    </Drawer>
  );
}

// Login logs tab
function LoginLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<any>(null);

  const fetchLogs = useCallback(async (pg = 1, status = statusFilter) => {
    try {
      setLoading(true);
      const res = await adminApi.getLoginLogs({ page: pg, pageSize: 30, status: status || undefined });
      setLogs(res.logs);
      setTotal(res.total);
      setStats(res.stats);
      setPage(pg);
    } catch { message.error('获取登录日志失败'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchLogs(1); }, []);

  const statusLabels: Record<string, { label: string; color: string }> = {
    success: { label: '成功', color: 'green' },
    failed: { label: '失败', color: 'red' },
    locked: { label: '锁定', color: 'orange' },
  };

  return (
    <div>
      {stats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="总记录" value={parseInt(stats.total) || 0} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="成功" value={parseInt(stats.success_count) || 0} valueStyle={{ color: 'var(--success)' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="失败" value={parseInt(stats.failed_count) || 0} valueStyle={{ color: 'var(--danger)' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="24h登录" value={parseInt(stats.last_24h) || 0} prefix={<LoginOutlined />} /></Card></Col>
        </Row>
      )}
      <Space style={{ marginBottom: 12 }}>
        <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); fetchLogs(1, v); }} style={{ width: 140 }}
          options={[{ label: '全部状态', value: '' }, ...Object.entries(statusLabels).map(([k, v]) => ({ label: v.label, value: k }))]} />
        <Button icon={<ReloadOutlined />} onClick={() => fetchLogs(page)}>刷新</Button>
        <Tag>共 {total} 条记录</Tag>
      </Space>
      <Table
        dataSource={logs}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ current: page, total, pageSize: 30, onChange: (p) => fetchLogs(p) }}
        columns={[
          { title: '时间', dataIndex: 'created_at', width: 170, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
          { title: '用户', key: 'user', width: 140, render: (_: any, r: any) => (
            <Space size={4}>
              <span>{r.nickname || r.username}</span>
              <Text type="secondary" style={{ fontSize: 11 }}>@{r.username}</Text>
            </Space>
          )},
          { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => {
            const info = statusLabels[s] || { label: s, color: 'default' };
            return <Tag color={info.color}>{info.label}</Tag>;
          }},
          { title: '浏览器', dataIndex: 'browser', width: 90 },
          { title: '系统', dataIndex: 'os', width: 90 },
          { title: '设备', dataIndex: 'device', width: 80, render: (d: string) => {
            const icon = d === 'Mobile' ? <MobileOutlined /> : d === 'Tablet' ? <TabletOutlined /> : <DesktopOutlined />;
            return <Space size={4}>{icon}<span>{d}</span></Space>;
          }},
          { title: 'IP', dataIndex: 'login_ip', width: 130 },
          { title: '失败原因', dataIndex: 'fail_reason', ellipsis: true, render: (r: string) => r || '-' },
        ]}
      />
    </div>
  );
}

// Online users component
function OnlineUsersTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setData(await adminApi.getOnlineUsers());
    } catch { message.error('获取在线用户失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const timer = setInterval(fetchData, 30000); return () => clearInterval(timer); }, [fetchData]);

  if (loading && !data) return <div style={{ textAlign: 'center', padding: 40 }}><ReloadOutlined spin size={24} /></div>;

  return (
    <div>
      {data?.sessionStats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="当前在线" value={data.total || 0} prefix={<GlobalOutlined />} valueStyle={{ color: 'var(--success)' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="5分钟内" value={parseInt(data.sessionStats.last_5min) || 0} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="1小时内" value={parseInt(data.sessionStats.last_1hour) || 0} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="24小时内" value={parseInt(data.sessionStats.last_24hour) || 0} /></Card></Col>
        </Row>
      )}
      <div style={{ marginBottom: 12 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
      </div>
      <Table
        dataSource={data?.users || []}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: '用户', key: 'user', render: (_: any, r: any) => (
            <Space>
              <Avatar size="small" icon={<UserOutlined />} src={r.avatar_url} style={{ background: r.role === 'admin' ? 'var(--color-purple)' : 'var(--primary)' }} />
              <div>
                <div style={{ fontWeight: 500 }}>{r.nickname || r.username}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{r.username}</div>
              </div>
            </Space>
          )},
          { title: '角色', dataIndex: 'role', width: 90, render: (r: string) => <Tag color={r === 'admin' ? 'purple' : 'blue'}>{r === 'admin' ? '管理员' : '用户'}</Tag> },
          { title: '浏览器', dataIndex: 'browser', width: 90 },
          { title: '系统', dataIndex: 'os', width: 90 },
          { title: '设备', dataIndex: 'device', width: 80, render: (d: string) => {
            const icon = d === 'Mobile' ? <MobileOutlined /> : <DesktopOutlined />;
            return <Space size={4}>{icon}<span>{d}</span></Space>;
          }},
          { title: 'IP', dataIndex: 'last_login_ip', width: 130 },
          { title: '最后活跃', dataIndex: 'last_login_at', width: 140, render: (t: string) => t ? <Tooltip title={new Date(t).toLocaleString('zh-CN')}>{formatRelativeTime(t)}</Tooltip> : '-' },
        ]}
      />
    </div>
  );
}

// Audit log tab
function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('');

  const fetchLogs = useCallback(async (pg = 1, action = actionFilter) => {
    try {
      setLoading(true);
      const res = await adminApi.getAuditLogs({ page: pg, pageSize: 30, action: action || undefined });
      setLogs(res.logs);
      setTotal(res.total);
      setPage(pg);
    } catch { message.error('获取审计日志失败'); }
    finally { setLoading(false); }
  }, [actionFilter]);

  useEffect(() => { fetchLogs(1); }, []);

  const actionLabels: Record<string, { label: string; color: string }> = {
    change_role: { label: '修改角色', color: 'blue' },
    disable_user: { label: '禁用用户', color: 'red' },
    enable_user: { label: '启用用户', color: 'green' },
    reset_password: { label: '重置密码', color: 'orange' },
    delete_user: { label: '删除用户', color: 'red' },
    edit_user: { label: '编辑用户', color: 'cyan' },
    add_note: { label: '添加备注', color: 'geekblue' },
    update_settings: { label: '更新配置', color: 'purple' },
    create_alert_rule: { label: '创建告警', color: 'magenta' },
    batch_delete: { label: '批量删除', color: 'red' },
    batch_disable: { label: '批量禁用', color: 'red' },
    batch_enable: { label: '批量启用', color: 'green' },
    batch_change_role: { label: '批量改角色', color: 'blue' },
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Select value={actionFilter} onChange={(v) => { setActionFilter(v); fetchLogs(1, v); }} style={{ width: 160 }}
          options={[{ label: '全部操作', value: '' }, ...Object.entries(actionLabels).map(([k, v]) => ({ label: v.label, value: k }))]} />
        <Button icon={<ReloadOutlined />} onClick={() => fetchLogs(page)}>刷新</Button>
        <Tag>共 {total} 条记录</Tag>
      </Space>
      <Table
        dataSource={logs}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ current: page, total, pageSize: 30, onChange: (p) => fetchLogs(p) }}
        columns={[
          { title: '时间', dataIndex: 'created_at', width: 170, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
          { title: '操作', dataIndex: 'action', width: 120, render: (a: string) => {
            const info = actionLabels[a] || { label: a, color: 'default' };
            return <Tag color={info.color}>{info.label}</Tag>;
          }},
          { title: '管理员', dataIndex: 'admin_username', width: 120, render: (v: string) => <Tag color="purple">{v}</Tag> },
          { title: '目标用户', dataIndex: 'target_username', width: 120, render: (v: string) => v || '-' },
          { title: '详情', dataIndex: 'detail', ellipsis: true },
          { title: 'IP', dataIndex: 'ip_address', width: 130 },
        ]}
      />
    </div>
  );
}

// Main component
export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [resetPwdModal, setResetPwdModal] = useState<{ open: boolean; userId: number; username: string; newPassword: string }>({ open: false, userId: 0, username: '', newPassword: '' });
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [vipUser, setVipUser] = useState<UserRecord | null>(null);
  const [vipAction, setVipAction] = useState<'grant' | 'extend'>('grant');
  const [vipDays, setVipDays] = useState(30);
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async (pg = page, size = pageSize, s = search, r = roleFilter, st = statusFilter, v = vipFilter, sort = sortField, order = sortOrder) => {
    try {
      setLoading(true);
      const params: any = { page: pg, pageSize: size, search: s || undefined, role: r || undefined, status: st || undefined, sort, order };
      if (v === 'true') params.vip = 'true';
      else if (v === 'false') params.vip = 'false';
      const data = await adminApi.getUsers(params);
      setUsers(data.users);
      setTotal(data.total);
    } catch { message.error('获取用户列表失败'); }
    finally { setLoading(false); }
  }, [page, pageSize, search, roleFilter, statusFilter, vipFilter, sortField, sortOrder]);

  const fetchStats = async () => {
    try { setStats(await adminApi.getUserStats()); } catch { /* silent */ }
  };

  useEffect(() => { fetchUsers(1); fetchStats(); }, []);

  const handleSearch = (value: string) => { setSearch(value); fetchUsers(1, pageSize, value, roleFilter, statusFilter); };
  const handleRoleFilter = (value: string) => { setRoleFilter(value); fetchUsers(1, pageSize, search, value, statusFilter); };
  const handleStatusFilter = (value: string) => { setStatusFilter(value); fetchUsers(1, pageSize, search, roleFilter, value); };
  const handleVipFilter = (value: string) => { setVipFilter(value); fetchUsers(1, pageSize, search, roleFilter, statusFilter, value); };

  const handleRoleChange = async (id: number, role: string) => {
    try { await adminApi.updateUserRole(id, role); message.success('角色修改成功'); fetchUsers(); fetchStats(); }
    catch (err: any) { message.error(err.message || '修改失败'); }
  };

  const handleStatusToggle = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try { await adminApi.updateUserStatus(id, newStatus); message.success(newStatus === 'disabled' ? '已禁用' : '已启用'); fetchUsers(); fetchStats(); }
    catch (err: any) { message.error(err.message || '操作失败'); }
  };

  const handleResetPassword = async (id: number, username: string) => {
    try {
      const res = await adminApi.resetPassword(id);
      setResetPwdModal({ open: true, userId: id, username, newPassword: res.newPassword });
      message.success('密码已重置');
    } catch (err: any) { message.error(err.message || '重置失败'); }
  };

  const handleDelete = async (id: number) => {
    try { await adminApi.deleteUser(id); message.success('用户已删除'); fetchUsers(); fetchStats(); setSelectedRowKeys(prev => prev.filter(k => k !== id)); }
    catch (err: any) { message.error(err.message || '删除失败'); }
  };

  const handleGrantVip = async () => {
    if (!vipUser) return;
    try {
      const res = await adminApi.grantVip(vipUser.id, vipDays);
      message.success(res.message);
      setVipModalOpen(false);
      fetchUsers(); fetchStats();
    } catch (err: any) { message.error(err.message || '操作失败'); }
  };

  const handleExtendVip = async () => {
    if (!vipUser) return;
    try {
      const res = await adminApi.extendVip(vipUser.id, vipDays);
      message.success(res.message);
      setVipModalOpen(false);
      fetchUsers(); fetchStats();
    } catch (err: any) { message.error(err.message || '操作失败'); }
  };

  const handleRevokeVip = async (id: number) => {
    try {
      await adminApi.revokeVip(id);
      message.success('VIP已撤销');
      fetchUsers(); fetchStats();
    } catch (err: any) { message.error(err.message || '操作失败'); }
  };

  const handleBatchAction = async (action: string, role?: string) => {
    if (selectedRowKeys.length === 0) return message.warning('请先选择用户');
    const confirmMsg = action === 'delete' ? `确定删除选中的 ${selectedRowKeys.length} 个用户？` :
                       action === 'disable' ? `确定禁用选中的 ${selectedRowKeys.length} 个用户？` :
                       `确定对选中的 ${selectedRowKeys.length} 个用户执行此操作？`;
    Modal.confirm({
      title: '批量操作确认',
      content: confirmMsg,
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: action === 'delete' },
      onOk: async () => {
        try {
          await adminApi.batchOperation(selectedRowKeys, action, role);
          message.success('批量操作成功');
          setSelectedRowKeys([]);
          fetchUsers(); fetchStats();
        } catch (err: any) { message.error(err.message || '批量操作失败'); }
      },
    });
  };

  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    const newPage = pagination.current || 1;
    const newSize = pagination.pageSize || 20;
    const newSort = sorter.field || 'created_at';
    const newOrder = sorter.order === 'ascend' ? 'asc' : 'desc';
    setPage(newPage); setPageSize(newSize); setSortField(newSort); setSortOrder(newOrder);
    fetchUsers(newPage, newSize, search, roleFilter, statusFilter, newSort, newOrder);
  };

  const columns = [
    {
      title: '用户',
      key: 'user',
      sorter: true,
      render: (_: any, record: UserRecord) => (
        <Space style={{ cursor: 'pointer' }} onClick={() => { setDetailUserId(record.id); setDetailOpen(true); }}>
          <Avatar size="small" icon={<UserOutlined />} src={record.avatar_url} style={{ background: record.role === 'admin' ? 'var(--color-purple)' : 'var(--primary)' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.nickname || record.username}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>@{record.username}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      filters: [{ text: '管理员', value: 'admin' }, { text: '普通用户', value: 'user' }],
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'purple' : 'blue'} icon={role === 'admin' ? <CrownOutlined /> : <UserOutlined />} style={{ margin: 0 }}>
          {role === 'admin' ? '管理员' : '用户'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string, record: UserRecord) => {
        if (record.locked_until && new Date(record.locked_until) > new Date()) {
          return <Badge status="warning" text="锁定" />;
        }
        return <Badge status={status === 'active' ? 'success' : 'error'} text={status === 'active' ? '正常' : '禁用'} />;
      },
    },
    {
      title: 'VIP',
      key: 'vip',
      width: 110,
      render: (_: any, record: UserRecord) => {
        const isVip = record.subscription_status === 'premium' && record.subscription_end && new Date(record.subscription_end) > new Date();
        if (!isVip) return <Text type="secondary">-</Text>;
        const daysLeft = Math.ceil((new Date(record.subscription_end).getTime() - Date.now()) / 86400000);
        return (
          <Tooltip title={`到期: ${new Date(record.subscription_end).toLocaleDateString('zh-CN')} (剩余${daysLeft}天)`}>
            <Tag color="gold" icon={<GiftOutlined />} style={{ margin: 0 }}>
              VIP {daysLeft > 0 ? `${daysLeft}天` : '已过期'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '持仓',
      key: 'portfolio',
      width: 120,
      render: (_: any, record: UserRecord) => (
        <div>
          <div style={{ fontSize: 13 }}>{record.record_count} 条</div>
          {record.total_invested > 0 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>¥{parseFloat(String(record.total_invested)).toLocaleString()}</div>}
        </div>
      ),
    },
    {
      title: '关联',
      dataIndex: 'oauth_count',
      key: 'oauth_count',
      width: 60,
      render: (count: number) => count > 0 ? <Tooltip title={`${count} 个第三方账户`}><LinkOutlined style={{ color: 'var(--success)' }} /></Tooltip> : '-',
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      sorter: true,
      width: 150,
      render: (t: string) => t ? <Tooltip title={new Date(t).toLocaleString('zh-CN')}>{formatRelativeTime(t)}</Tooltip> : <Text type="secondary">从未</Text>,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      width: 150,
      render: (t: string) => new Date(t).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: UserRecord) => {
        if (record.id === currentUser?.id) return <Tag color="blue">当前用户</Tag>;
        const isVip = record.subscription_status === 'premium' && record.subscription_end && new Date(record.subscription_end) > new Date();
        const items = [
          { key: 'detail', icon: <EyeOutlined />, label: '查看详情', onClick: () => { setDetailUserId(record.id); setDetailOpen(true); } },
          { key: 'edit', icon: <EditOutlined />, label: '编辑用户', onClick: () => { setEditUser(record); setEditOpen(true); } },
          { type: 'divider' as const },
          { key: 'role', icon: <CrownOutlined />, label: record.role === 'admin' ? '设为普通用户' : '设为管理员', onClick: () => handleRoleChange(record.id, record.role === 'admin' ? 'user' : 'admin') },
          { key: 'status', icon: record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />, label: record.status === 'active' ? '禁用账户' : '启用账户', onClick: () => handleStatusToggle(record.id, record.status) },
          { key: 'password', icon: <KeyOutlined />, label: '重置密码', onClick: () => handleResetPassword(record.id, record.username) },
          { type: 'divider' as const },
          ...(isVip ? [
            { key: 'vip_extend', icon: <FieldTimeOutlined />, label: '延长VIP', onClick: () => { setVipUser(record); setVipAction('extend'); setVipModalOpen(true); } },
            { key: 'vip_revoke', icon: <StopOutlined />, label: '撤销VIP', danger: true, onClick: () => {
              Modal.confirm({ title: '撤销VIP', content: `确定撤销用户 "${record.username}" 的VIP会员？`, okText: '撤销', okButtonProps: { danger: true }, cancelText: '取消', onOk: () => handleRevokeVip(record.id) });
            }},
          ] : [
            { key: 'vip_grant', icon: <GiftOutlined />, label: '授予VIP', onClick: () => { setVipUser(record); setVipAction('grant'); setVipModalOpen(true); } },
          ]),
          { type: 'divider' as const },
          { key: 'delete', icon: <DeleteOutlined />, label: '删除用户', danger: true, onClick: () => {
            Modal.confirm({ title: '确认删除', content: `确定删除用户 "${record.username}"？所有数据将被清除且不可恢复。`, okText: '删除', okButtonProps: { danger: true }, cancelText: '取消', onOk: () => handleDelete(record.id) });
          }},
        ];
        return <Dropdown menu={{ items }} trigger={['click']}><Button type="text" icon={<MoreOutlined />} /></Dropdown>;
      },
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <UserStats stats={stats} />
      <TrendChart stats={stats} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Search placeholder="搜索用户名/昵称" value={search} onChange={(e) => setSearch(e.target.value)} onSearch={handleSearch} style={{ width: 240 }} allowClear enterButton={<><SearchOutlined /> 搜索</>} />
              <Select value={roleFilter} onChange={handleRoleFilter} style={{ width: 120 }} options={[{ label: '全部角色', value: '' }, { label: '管理员', value: 'admin' }, { label: '普通用户', value: 'user' }]} />
              <Select value={statusFilter} onChange={handleStatusFilter} style={{ width: 120 }} options={[{ label: '全部状态', value: '' }, { label: '正常', value: 'active' }, { label: '已禁用', value: 'disabled' }]} />
              <Select value={vipFilter} onChange={handleVipFilter} style={{ width: 120 }} options={[{ label: '全部用户', value: '' }, { label: 'VIP会员', value: 'true' }, { label: '普通用户', value: 'false' }]} />
              <Button icon={<ReloadOutlined />} onClick={() => { fetchUsers(); fetchStats(); }}>刷新</Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ExportOutlined />} onClick={() => { adminApi.exportUsers(); message.success('正在导出...'); }}>导出CSV</Button>
              {selectedRowKeys.length > 0 && (
                <Dropdown menu={{
                  items: [
                    { key: 'disable', icon: <LockOutlined />, label: '批量禁用', onClick: () => handleBatchAction('disable') },
                    { key: 'enable', icon: <UnlockOutlined />, label: '批量启用', onClick: () => handleBatchAction('enable') },
                    { key: 'set_user', icon: <UserOutlined />, label: '设为普通用户', onClick: () => handleBatchAction('change_role', 'user') },
                    { type: 'divider' as const },
                    { key: 'delete', icon: <DeleteOutlined />, label: '批量删除', danger: true, onClick: () => handleBatchAction('delete') },
                  ]
                }}>
                  <Button type="primary" danger>批量操作 <Tag color="red" style={{ marginLeft: 4 }}>{selectedRowKeys.length}</Tag></Button>
                </Dropdown>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Tabs defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: <><TeamOutlined /> 用户列表</>,
            children: (
              <Card size="small">
                <Table
                  dataSource={users}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  onChange={handleTableChange}
                  rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]), getCheckboxProps: (record) => ({ disabled: record.id === currentUser?.id }) }}
                  pagination={{ current: page, pageSize, total, showSizeChanger: true, showQuickJumper: true, showTotal: (t) => `共 ${t} 个用户` }}
                  size="small"
                  scroll={{ x: 1100 }}
                />
              </Card>
            ),
          },
          { key: 'online', label: <><GlobalOutlined /> 在线用户</>, children: <OnlineUsersTab /> },
          { key: 'login-logs', label: <><LoginOutlined /> 登录日志</>, children: <LoginLogsTab /> },
          { key: 'audit', label: <><AuditOutlined /> 审计日志</>, children: <AuditLogTab /> },
        ]}
      />

      <UserDetailDrawer userId={detailUserId} open={detailOpen} onClose={() => setDetailOpen(false)} />
      <EditUserModal user={editUser} open={editOpen} onClose={() => setEditOpen(false)} onSuccess={() => { fetchUsers(); fetchStats(); }} />

      {/* VIP管理弹窗 */}
      <Modal
        title={vipAction === 'grant' ? '授予VIP会员' : '延长VIP期限'}
        open={vipModalOpen}
        onCancel={() => setVipModalOpen(false)}
        onOk={vipAction === 'grant' ? handleGrantVip : handleExtendVip}
        okText={vipAction === 'grant' ? '授予' : '延长'}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>用户: <Text strong>{vipUser?.nickname || vipUser?.username}</Text></div>
          {vipAction === 'extend' && vipUser?.subscription_end && (
            <div style={{ marginBottom: 8, color: 'var(--text-tertiary)' }}>
              当前到期: {new Date(vipUser.subscription_end).toLocaleDateString('zh-CN')}
            </div>
          )}
          <div style={{ marginBottom: 8 }}>选择时长:</div>
          <Space wrap>
            {[7, 30, 90, 180, 365].map(d => (
              <Button key={d} type={vipDays === d ? 'primary' : 'default'} onClick={() => setVipDays(d)}>
                {d}天{d === 30 ? '(1个月)' : d === 90 ? '(3个月)' : d === 180 ? '(半年)' : d === 365 ? '(1年)' : ''}
              </Button>
            ))}
          </Space>
          <div style={{ marginTop: 12 }}>
            <Input type="number" value={vipDays} onChange={e => setVipDays(parseInt(e.target.value) || 30)} suffix="天" style={{ width: 120 }} />
          </div>
        </div>
      </Modal>

      <Modal title="密码重置成功" open={resetPwdModal.open} onCancel={() => setResetPwdModal({ ...resetPwdModal, open: false })} footer={<Button onClick={() => setResetPwdModal({ ...resetPwdModal, open: false })}>关闭</Button>}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ marginBottom: 12 }}>用户 <Text strong>{resetPwdModal.username}</Text> 的新密码：</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', background: 'var(--bg-secondary)', padding: '12px 24px', borderRadius: 8, letterSpacing: 2 }}>
            {resetPwdModal.newPassword}
          </div>
          <div style={{ marginTop: 12 }}><Text type="warning"><ExclamationCircleOutlined /> 请妥善保管，此密码仅显示一次</Text></div>
        </div>
      </Modal>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
}
