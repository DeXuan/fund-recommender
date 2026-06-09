import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, message, Card, Statistic, Row, Col, Avatar,
  Modal, Select, Input, Drawer, Descriptions, Tabs, Typography, Tooltip, Badge, Dropdown, Progress, Empty,
} from 'antd';
import {
  UserOutlined, DeleteOutlined, CrownOutlined, TeamOutlined, SafetyOutlined,
  SearchOutlined, ReloadOutlined, KeyOutlined, StopOutlined, CheckCircleOutlined,
  ExportOutlined, LockOutlined, UnlockOutlined, EyeOutlined, MoreOutlined,
  RiseOutlined, FallOutlined, AuditOutlined, BarChartOutlined, LinkOutlined,
  CopyOutlined, ExclamationCircleOutlined, FundOutlined, StarOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { Search } = Input;
const { Text, Title } = Typography;

interface UserRecord {
  id: number;
  username: string;
  nickname: string;
  avatar_url: string;
  role: string;
  status: string;
  created_at: string;
  last_login_at: string;
  oauth_count: number;
  record_count: number;
  total_invested: number;
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
          <Statistic title="管理员" value={parseInt(stats.admin_count) || 0} prefix={<CrownOutlined />} valueStyle={{ color: '#722ed1' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="已禁用" value={parseInt(stats.disabled_count) || 0} prefix={<StopOutlined />} valueStyle={{ color: '#ff4d4f' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="7日活跃" value={parseInt(stats.active_7d) || 0} prefix={<RiseOutlined />} valueStyle={{ color: '#52c41a' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="30日活跃" value={parseInt(stats.active_30d) || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={4}>
        <Card size="small" hoverable>
          <Statistic title="本月新增" value={parseInt(stats.new_30d) || 0} prefix={<RiseOutlined />} valueStyle={{ color: '#faad14' }} />
        </Card>
      </Col>
    </Row>
  );
}

// Registration trend chart
function TrendChart({ stats }: { stats: any }) {
  if (!stats?.registrationTrend?.length && !stats?.loginTrend?.length) return null;
  const regDates = stats.registrationTrend?.map((d: any) => d.date) || [];
  const regCounts = stats.registrationTrend?.map((d: any) => parseInt(d.count)) || [];
  const loginDates = stats.loginTrend?.map((d: any) => d.date) || [];
  const loginCounts = stats.loginTrend?.map((d: any) => parseInt(d.count)) || [];

  // Merge dates
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
      <ReactECharts option={option} style={{ height: 200 }} />
    </Card>
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
      width={520}
      destroyOnClose
    >
      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><ReloadOutlined spin size={24} /></div> :
       !data ? <Empty /> : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <Avatar size={64} icon={<UserOutlined />} src={data.user.avatar_url} style={{ background: data.user.role === 'admin' ? '#722ed1' : '#1677ff' }} />
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
            <Descriptions.Item label="关联账户">{data.oauthAccounts?.length > 0 ? data.oauthAccounts.map((o: any) => <Tag key={o.provider} color="green">{o.provider}</Tag>) : '-'}</Descriptions.Item>
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
                  valueStyle={{ fontSize: 16, color: parseFloat(data.portfolio.total_pnl) >= 0 ? '#cf1322' : '#3f8600' }} /></Col>
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
        </div>
      )}
    </Drawer>
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
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resetPwdModal, setResetPwdModal] = useState<{ open: boolean; userId: number; username: string; newPassword: string }>({ open: false, userId: 0, username: '', newPassword: '' });
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async (pg = page, size = pageSize, s = search, r = roleFilter, st = statusFilter, sort = sortField, order = sortOrder) => {
    try {
      setLoading(true);
      const data = await adminApi.getUsers({ page: pg, pageSize: size, search: s || undefined, role: r || undefined, status: st || undefined, sort, order });
      setUsers(data.users);
      setTotal(data.total);
    } catch { message.error('获取用户列表失败'); }
    finally { setLoading(false); }
  }, [page, pageSize, search, roleFilter, statusFilter, sortField, sortOrder]);

  const fetchStats = async () => {
    try { setStats(await adminApi.getUserStats()); } catch { /* silent */ }
  };

  useEffect(() => { fetchUsers(1); fetchStats(); }, []);

  const handleSearch = (value: string) => { setSearch(value); fetchUsers(1, pageSize, value, roleFilter, statusFilter); };
  const handleRoleFilter = (value: string) => { setRoleFilter(value); fetchUsers(1, pageSize, search, value, statusFilter); };
  const handleStatusFilter = (value: string) => { setStatusFilter(value); fetchUsers(1, pageSize, search, roleFilter, value); };

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
          <Avatar size="small" icon={<UserOutlined />} src={record.avatar_url} style={{ background: record.role === 'admin' ? '#722ed1' : '#1677ff' }} />
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
      render: (status: string) => (
        <Badge status={status === 'active' ? 'success' : 'error'} text={status === 'active' ? '正常' : '禁用'} />
      ),
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
      render: (count: number) => count > 0 ? <Tooltip title={`${count} 个第三方账户`}><LinkOutlined style={{ color: '#52c41a' }} /></Tooltip> : '-',
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
        const items = [
          { key: 'detail', icon: <EyeOutlined />, label: '查看详情', onClick: () => { setDetailUserId(record.id); setDetailOpen(true); } },
          { key: 'role', icon: <CrownOutlined />, label: record.role === 'admin' ? '设为普通用户' : '设为管理员', onClick: () => handleRoleChange(record.id, record.role === 'admin' ? 'user' : 'admin') },
          { key: 'status', icon: record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />, label: record.status === 'active' ? '禁用账户' : '启用账户', onClick: () => handleStatusToggle(record.id, record.status) },
          { key: 'password', icon: <KeyOutlined />, label: '重置密码', onClick: () => handleResetPassword(record.id, record.username) },
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
              <Button icon={<ReloadOutlined />} onClick={() => { fetchUsers(); fetchStats(); }}>刷新</Button>
            </Space>
          </Col>
          <Col>
            {selectedRowKeys.length > 0 && (
              <Space>
                <Tag color="blue">已选 {selectedRowKeys.length} 项</Tag>
                <Dropdown menu={{
                  items: [
                    { key: 'disable', icon: <LockOutlined />, label: '批量禁用', onClick: () => handleBatchAction('disable') },
                    { key: 'enable', icon: <UnlockOutlined />, label: '批量启用', onClick: () => handleBatchAction('enable') },
                    { key: 'set_user', icon: <UserOutlined />, label: '设为普通用户', onClick: () => handleBatchAction('change_role', 'user') },
                    { type: 'divider' as const },
                    { key: 'delete', icon: <DeleteOutlined />, label: '批量删除', danger: true, onClick: () => handleBatchAction('delete') },
                  ]
                }}>
                  <Button type="primary" danger>批量操作</Button>
                </Dropdown>
              </Space>
            )}
          </Col>
        </Row>
      </Card>

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

      <UserDetailDrawer userId={detailUserId} open={detailOpen} onClose={() => setDetailOpen(false)} />

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
