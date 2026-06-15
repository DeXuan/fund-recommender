import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Tabs, Input, Select, Space, Button, Spin, Progress, Tooltip, Badge, Switch, message, Modal, Form, Popconfirm, Empty } from 'antd';
import {
  DashboardOutlined, DatabaseOutlined, FileTextOutlined, ReloadOutlined,
  ThunderboltOutlined, HddOutlined, CloudServerOutlined, BugOutlined,
  ClockCircleOutlined, SearchOutlined, ApiOutlined, LineChartOutlined,
  PauseCircleOutlined, PlayCircleOutlined, LaptopOutlined, CloudOutlined,
  AlertOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, HeartOutlined, BellOutlined,
  SettingOutlined, ExclamationCircleOutlined, SafetyOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { adminApi } from '../../services/api';

const { Search } = Input;
const { TextArea } = Input;

// Gauge chart component
function GaugeChart({ value, title, color, max }: { value: number; title: string; color: string; max?: number }) {
  const option = {
    series: [{
      type: 'gauge',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: max || 100,
      splitNumber: 5,
      axisLine: { lineStyle: { width: 12, color: [[1, color]] } },
      pointer: { itemStyle: { color }, length: '60%', width: 4 },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { color: '#999', width: 1 } },
      axisLabel: { distance: 16, fontSize: 9, color: '#999' },
      detail: { valueAnimation: true, formatter: max ? '{value}' : '{value}%', fontSize: 18, fontWeight: 700, color, offsetCenter: [0, '70%'] },
      title: { offsetCenter: [0, '90%'], fontSize: 11, color: '#666' },
      data: [{ value, name: title }],
    }],
  };
  return <ReactECharts option={option} style={{ height: 160 }} />;
}

// Real-time metrics line chart
function MetricsChart({ data }: { data: { timestamp: number; qps: number; cacheHit: number; connections: number; slowQueries: number }[] }) {
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['QPS', '缓存命中率(%)', '活跃连接', '慢查询'], bottom: 0 },
    grid: { left: 50, right: 50, top: 10, bottom: 45 },
    xAxis: { type: 'category', data: data.map(d => new Date(d.timestamp).toLocaleTimeString('zh-CN', { hour12: false })), boundaryGap: false },
    yAxis: [
      { type: 'value', name: 'QPS / 连接', position: 'left' },
      { type: 'value', name: '%', position: 'right', min: 0, max: 100 },
    ],
    series: [
      { name: 'QPS', type: 'line', smooth: true, data: data.map(d => d.qps), lineStyle: { width: 2 }, areaStyle: { opacity: 0.15 }, color: '#1677ff' },
      { name: '活跃连接', type: 'line', smooth: true, data: data.map(d => d.connections), lineStyle: { width: 2 }, color: '#52c41a' },
      { name: '缓存命中率(%)', type: 'line', smooth: true, yAxisIndex: 1, data: data.map(d => d.cacheHit), lineStyle: { width: 2 }, color: '#faad14' },
      { name: '慢查询', type: 'line', smooth: true, data: data.map(d => d.slowQueries), lineStyle: { width: 2 }, color: '#ff4d4f' },
    ],
  };
  return <ReactECharts option={option} style={{ height: 280 }} />;
}

// Health check component
function HealthCheck() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try { setData(await adminApi.getHealthCheck()); }
    catch (e) { console.error('健康检查失败:', e); message.error('健康检查失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!data) return null;

  const statusIcon = (s: string) => {
    if (s === 'healthy') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    if (s === 'warning') return <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />;
    if (s === 'critical' || s === 'unhealthy') return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    return <ExclamationCircleOutlined style={{ color: '#999', fontSize: 18 }} />;
  };

  const overallColor = data.status === 'healthy' ? '#52c41a' : data.status === 'warning' ? '#faad14' : '#ff4d4f';
  const overallLabel = data.status === 'healthy' ? '健康' : data.status === 'warning' ? '警告' : '异常';

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <HeartOutlined style={{ fontSize: 28, color: overallColor }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: overallColor }}>系统{overallLabel}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>检查耗时 {data.totalLatency}ms</div>
              </div>
            </Space>
          </Col>
          <Col flex="auto" />
          <Col><Button icon={<ReloadOutlined />} onClick={fetchData}>重新检查</Button></Col>
        </Row>
      </Card>

      <Row gutter={[12, 12]}>
        {data.checks?.map((check: any, idx: number) => (
          <Col xs={24} sm={12} md={8} key={idx}>
            <Card size="small" hoverable style={{ borderLeft: `3px solid ${check.status === 'healthy' ? '#52c41a' : check.status === 'warning' ? '#faad14' : '#ff4d4f'}` }}>
              <Space>
                {statusIcon(check.status)}
                <div>
                  <div style={{ fontWeight: 500 }}>{check.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{check.detail}</div>
                </div>
              </Space>
              {check.value !== undefined && (
                <Progress percent={check.value} size="small" showInfo={false}
                  strokeColor={check.value > 90 ? '#ff4d4f' : check.value > 70 ? '#faad14' : '#52c41a'}
                  style={{ marginTop: 8 }} />
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

// API statistics component
function ApiStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const fetchData = useCallback(async () => {
    try { setLoading(true); setData(await adminApi.getApiStats(hours)); }
    catch (e) { console.error('获取API统计失败:', e); message.error('获取API统计失败'); }
    finally { setLoading(false); }
  }, [hours]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!data) return null;

  const trendOption = data.trend?.length > 0 ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['请求数', '错误数', '平均响应(ms)'], bottom: 0 },
    grid: { left: 50, right: 50, top: 10, bottom: 40 },
    xAxis: { type: 'category', data: data.trend.map((t: any) => new Date(t.hour_start).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })) },
    yAxis: [
      { type: 'value', name: '请求数', position: 'left' },
      { type: 'value', name: 'ms', position: 'right' },
    ],
    series: [
      { name: '请求数', type: 'bar', data: data.trend.map((t: any) => parseInt(t.requests)), itemStyle: { color: '#1677ff' } },
      { name: '错误数', type: 'bar', data: data.trend.map((t: any) => parseInt(t.errors)), itemStyle: { color: '#ff4d4f' } },
      { name: '平均响应(ms)', type: 'line', yAxisIndex: 1, data: data.trend.map((t: any) => parseFloat(t.avg_ms)), smooth: true, color: '#faad14' },
    ],
  } : null;

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="24h总请求" value={parseInt(data.errorRate?.total) || 0} prefix={<ApiOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="24h错误" value={parseInt(data.errorRate?.errors) || 0} valueStyle={{ color: parseInt(data.errorRate?.errors) > 0 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="错误率" value={parseFloat(data.errorRate?.error_rate) || 0} suffix="%" valueStyle={{ color: parseFloat(data.errorRate?.error_rate) > 5 ? '#ff4d4f' : '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Select value={hours} onChange={setHours} style={{ width: '100%' }}
            options={[{ label: '最近6小时', value: 6 }, { label: '最近24小时', value: 24 }, { label: '最近7天', value: 168 }]} />
        </Col>
      </Row>

      {trendOption && (
        <Card size="small" title="请求趋势" style={{ marginBottom: 16 }}>
          <ReactECharts option={trendOption} style={{ height: 240 }} />
        </Card>
      )}

      <Card size="small" title="接口详情 (按请求量排序)">
        <Table dataSource={data.endpoints} rowKey={(r: any) => `${r.method}_${r.endpoint}`} size="small" pagination={{ pageSize: 15 }}
          columns={[
            { title: '接口', dataIndex: 'endpoint', ellipsis: true, render: (v: string, r: any) => (
              <Space>
                <Tag color={r.method === 'GET' ? 'blue' : r.method === 'POST' ? 'green' : 'orange'} style={{ margin: 0, fontSize: 10 }}>{r.method}</Tag>
                <span style={{ fontSize: 12 }}>{v}</span>
                {r.live && <Tag color="processing" style={{ fontSize: 9 }}>实时</Tag>}
              </Space>
            )},
            { title: '请求数', dataIndex: 'total_requests', width: 90, sorter: (a: any, b: any) => a.total_requests - b.total_requests, render: (v: number) => (parseInt(String(v)) || 0).toLocaleString() },
            { title: '错误数', dataIndex: 'total_errors', width: 80, render: (v: number) => <span style={{ color: parseInt(String(v)) > 0 ? '#ff4d4f' : undefined }}>{parseInt(String(v)) || 0}</span> },
            { title: '平均响应', dataIndex: 'avg_ms', width: 100, render: (v: number) => <span style={{ color: parseFloat(String(v)) > 1000 ? '#ff4d4f' : parseFloat(String(v)) > 500 ? '#faad14' : undefined }}>{parseFloat(String(v)) || 0}ms</span> },
            { title: 'P95', dataIndex: 'p95_ms', width: 100, render: (v: number) => `${parseFloat(String(v)) || 0}ms` },
            { title: '最大响应', dataIndex: 'max_ms', width: 100, render: (v: number) => `${parseFloat(String(v)) || 0}ms` },
          ]}
        />
      </Card>
    </div>
  );
}

// Alert rules component
function AlertManagement() {
  const [rules, setRules] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchRules = useCallback(async () => {
    try { setLoading(true); const res = await adminApi.getAlertRules(); setRules(res.rules); }
    catch (e) { console.error('获取告警规则失败:', e); message.error('获取告警规则失败'); }
    finally { setLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    try { setHistoryLoading(true); const res = await adminApi.getAlertHistory({ pageSize: 100 }); setHistory(res.history); setHistoryStats(res.stats); }
    catch (e) { console.error('获取告警历史失败:', e); message.error('获取告警历史失败'); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); fetchHistory(); }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingRule) {
        await adminApi.updateAlertRule(editingRule.id, values);
        message.success('规则已更新');
      } else {
        await adminApi.createAlertRule(values);
        message.success('规则已创建');
      }
      setModalOpen(false);
      setEditingRule(null);
      form.resetFields();
      fetchRules();
    } catch (err: any) { if (err.message) message.error(err.message); }
  };

  const handleDelete = async (id: number) => {
    try { await adminApi.deleteAlertRule(id); message.success('规则已删除'); fetchRules(); }
    catch (e) { console.error('删除告警规则失败:', e); message.error('删除失败'); }
  };

  const handleResolve = async (id: number) => {
    try { await adminApi.resolveAlert(id); message.success('告警已解决'); fetchHistory(); }
    catch (e) { console.error('解决告警失败:', e); message.error('操作失败'); }
  };

  const metricLabels: Record<string, string> = {
    cpu_usage: 'CPU使用率', memory_usage: '内存使用率', disk_usage: '磁盘使用率',
    db_connections: '数据库连接数', cache_hit_ratio: '缓存命中率', error_rate: '错误率',
    response_time: '响应时间', qps: 'QPS',
  };
  const severityColors: Record<string, string> = { info: 'blue', warning: 'orange', critical: 'red' };

  return (
    <div>
      {historyStats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="触发中" value={parseInt(historyStats.firing_count) || 0} valueStyle={{ color: '#ff4d4f' }} prefix={<AlertOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="已解决" value={parseInt(historyStats.resolved_count) || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="严重" value={parseInt(historyStats.critical_count) || 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="24h告警" value={parseInt(historyStats.last_24h) || 0} /></Card></Col>
        </Row>
      )}

      <Tabs defaultActiveKey="rules" items={[
        {
          key: 'rules',
          label: <><SettingOutlined /> 告警规则</>,
          children: (
            <div>
              <div style={{ marginBottom: 12 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRule(null); form.resetFields(); setModalOpen(true); }}>新建规则</Button>
              </div>
              <Table dataSource={rules} rowKey="id" loading={loading} size="small" pagination={false}
                columns={[
                  { title: '规则名称', dataIndex: 'name', ellipsis: true },
                  { title: '指标', dataIndex: 'metric', width: 120, render: (v: string) => metricLabels[v] || v },
                  { title: '条件', key: 'condition', width: 150, render: (_: any, r: any) => `${metricLabels[r.metric] || r.metric} ${r.operator} ${r.threshold}` },
                  { title: '严重级别', dataIndex: 'severity', width: 90, render: (v: string) => <Tag color={severityColors[v] || 'default'}>{v}</Tag> },
                  { title: '状态', dataIndex: 'enabled', width: 80, render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? '启用' : '禁用'} /> },
                  { title: '操作', width: 120, render: (_: any, r: any) => (
                    <Space>
                      <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingRule(r); form.setFieldsValue(r); setModalOpen(true); }} />
                      <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )},
                ]}
              />
            </div>
          ),
        },
        {
          key: 'history',
          label: <><BellOutlined /> 告警历史</>,
          children: (
            <div>
              <div style={{ marginBottom: 12 }}>
                <Button icon={<ReloadOutlined />} onClick={fetchHistory}>刷新</Button>
              </div>
              <Table dataSource={history} rowKey="id" loading={historyLoading} size="small"
                pagination={{ pageSize: 20 }}
                columns={[
                  { title: '时间', dataIndex: 'created_at', width: 170, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
                  { title: '规则', dataIndex: 'rule_name', ellipsis: true },
                  { title: '指标', dataIndex: 'metric', width: 120, render: (v: string) => metricLabels[v] || v },
                  { title: '当前值', dataIndex: 'current_value', width: 100, render: (v: number) => parseFloat(String(v)) || 0 },
                  { title: '阈值', dataIndex: 'threshold', width: 80, render: (v: number) => parseFloat(String(v)) || 0 },
                  { title: '级别', dataIndex: 'severity', width: 80, render: (v: string) => <Tag color={severityColors[v] || 'default'}>{v}</Tag> },
                  { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Badge status={v === 'firing' ? 'error' : 'success'} text={v === 'firing' ? '触发中' : '已解决'} /> },
                  { title: '操作', width: 100, render: (_: any, r: any) => r.status === 'firing' ?
                    <Button size="small" type="primary" onClick={() => handleResolve(r.id)}>解决</Button> : '-' },
                ]}
              />
            </div>
          ),
        },
      ]} />

      <Modal title={editingRule ? '编辑告警规则' : '新建告警规则'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditingRule(null); }} onOk={handleSave} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ severity: 'warning', enabled: true, operator: '>', threshold: 0 }}>
          <Form.Item label="规则名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="如：CPU使用率过高" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="监控指标" name="metric" rules={[{ required: true }]}>
                <Select options={Object.entries(metricLabels).map(([k, v]) => ({ label: v, value: k }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="运算符" name="operator" rules={[{ required: true }]}>
                <Select options={[{ label: '>', value: '>' }, { label: '>=', value: '>=' }, { label: '<', value: '<' }, { label: '<=', value: '<=' }, { label: '=', value: '=' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="阈值" name="threshold" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="严重级别" name="severity">
                <Select options={[{ label: 'Info', value: 'info' }, { label: 'Warning', value: 'warning' }, { label: 'Critical', value: 'critical' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="启用" name="enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// Database details component
function DBDetails() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try { setLoading(true); setData(await adminApi.getDbDetails()); }
    catch (e) { console.error('获取数据库详情失败:', e); message.error('获取数据库详情失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!data) return null;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="死锁次数" value={data.deadlocks} valueStyle={{ color: data.deadlocks > 0 ? '#ff4d4f' : '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="磁盘临时文件" value={data.temp.files} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="临时文件大小" value={data.temp.bytesFormatted} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="共享缓冲区" value={data.sharedBuffers} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="运行中查询" value={data.longRunningQueries?.length || 0} /></Card></Col>
          <Col xs={12} sm={8} md={4}><Card size="small"><Statistic title="表数量" value={data.tableSizes?.length || 0} /></Card></Col>
        </Row>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={<><DashboardOutlined /> 缓冲池命中率 (Table Cache)</>} size="small">
          <Table dataSource={data.tableCache} rowKey="table_name" size="small" pagination={{ pageSize: 8 }}
            columns={[
              { title: '表名', dataIndex: 'table_name', ellipsis: true },
              { title: '命中率', dataIndex: 'cache_hit_ratio', width: 100, render: (v: number) => <Progress percent={v || 0} size="small" status={v > 95 ? 'success' : v > 80 ? 'normal' : 'exception'} /> },
              { title: '命中', dataIndex: 'heap_blks_hit', width: 80, render: (v: number) => (v || 0).toLocaleString() },
              { title: '读取', dataIndex: 'heap_blks_read', width: 80, render: (v: number) => (v || 0).toLocaleString() },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={<><HddOutlined /> 全表扫描 vs 索引扫描</>} size="small">
          <Table dataSource={data.fullTableScans} rowKey="table_name" size="small" pagination={{ pageSize: 8 }}
            columns={[
              { title: '表名', dataIndex: 'table_name', ellipsis: true },
              { title: '顺序扫描', dataIndex: 'seq_scan', width: 90, render: (v: number) => (v || 0).toLocaleString() },
              { title: '索引扫描', dataIndex: 'idx_scan', width: 90, render: (v: number) => (v || 0).toLocaleString() },
              { title: '索引使用率', dataIndex: 'idx_usage_ratio', width: 100, render: (v: number) => <Progress percent={v || 0} size="small" status={v > 80 ? 'success' : v > 50 ? 'normal' : 'exception'} /> },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={<><DatabaseOutlined /> 数据大小</>} size="small">
          <Table dataSource={data.tableSizes} rowKey="table_name" size="small" pagination={{ pageSize: 10 }}
            columns={[
              { title: '表名', dataIndex: 'table_name', ellipsis: true },
              { title: '总大小', dataIndex: 'total_size', width: 90 },
              { title: '数据', dataIndex: 'data_size', width: 90 },
              { title: '行数', dataIndex: 'row_count', width: 80, render: (v: number) => (v || 0).toLocaleString() },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={<><HddOutlined /> 索引大小</>} size="small">
          <Table dataSource={data.indexSizes} rowKey={(r: any) => `${r.table_name}_${r.index_name}`} size="small" pagination={{ pageSize: 10 }}
            columns={[
              { title: '索引名', dataIndex: 'index_name', ellipsis: true },
              { title: '表名', dataIndex: 'table_name', ellipsis: true },
              { title: '大小', dataIndex: 'index_size', width: 90 },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24}>
        <Card title={<><BugOutlined /> 运行中查询</>} size="small">
          <Table dataSource={data.longRunningQueries} rowKey="pid" size="small" pagination={false}
            columns={[
              { title: 'PID', dataIndex: 'pid', width: 70 },
              { title: '持续时间', dataIndex: 'duration', width: 120 },
              { title: '查询', dataIndex: 'query', ellipsis: true },
              { title: '状态', dataIndex: 'state', width: 80, render: (v: string) => <Tag color="green">{v}</Tag> },
            ]}
          />
        </Card>
      </Col>

      <Col xs={24}>
        <Card title="关键配置参数" size="small">
          <Row gutter={[16, 8]}>
            {data.config?.map((item: any) => (
              <Col xs={12} sm={8} md={6} key={item.name}>
                <Statistic title={item.name} value={item.unit ? `${item.setting} ${item.unit}` : item.setting} valueStyle={{ fontSize: 14 }} />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
    </Row>
  );
}

// Table space component
function TableSpace() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getTableSpace().then(setData).catch(() => message.error('获取表空间失败')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!data) return null;

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'],
      data: data.tables?.slice(0, 10).map((t: any) => ({ name: t.table_name, value: t.total_bytes })),
      label: { formatter: '{b}\n{d}%', fontSize: 10 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
    }],
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="数据库总大小" value={data.totalDatabaseSizeFormatted} prefix={<HddOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="表数量" value={data.tables?.length || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="总行数" value={data.tables?.reduce((s: number, t: any) => s + (t.row_count || 0), 0).toLocaleString()} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="总死行" value={data.tables?.reduce((s: number, t: any) => s + (t.dead_rows || 0), 0).toLocaleString()}
          valueStyle={{ color: data.tables?.reduce((s: number, t: any) => s + (t.dead_rows || 0), 0) > 10000 ? '#ff4d4f' : undefined }} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="表空间分布" size="small"><ReactECharts option={pieOption} style={{ height: 320 }} /></Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="数据表空间详情" size="small">
            <Table dataSource={data.tables} rowKey="table_name" size="small" pagination={{ pageSize: 15 }}
              columns={[
                { title: '表名', dataIndex: 'table_name', ellipsis: true },
                { title: '总大小', dataIndex: 'total_size', width: 90 },
                { title: '数据', dataIndex: 'data_size', width: 90 },
                { title: '索引', dataIndex: 'index_size', width: 90 },
                { title: '行数', dataIndex: 'row_count', width: 80, render: (v: number) => (v || 0).toLocaleString() },
                { title: '死行', dataIndex: 'dead_rows', width: 70, render: (v: number) => <span style={{ color: v > 1000 ? '#ff4d4f' : undefined }}>{(v || 0).toLocaleString()}</span> },
                { title: '上次清理', dataIndex: 'last_autovacuum', width: 140, render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

// Log viewer component
function LogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchLogs = useCallback(async (pg = 1, lvl = level, kw = keyword) => {
    try {
      setLoading(true);
      const res = await adminApi.getLogs({ level: lvl, keyword: kw, page: pg, pageSize: 50 });
      setLogs(res.logs); setTotal(res.total); setTotalPages(res.totalPages); setPage(pg);
    } catch (e) { console.error('获取日志失败:', e); message.error('获取日志失败'); }
    finally { setLoading(false); }
  }, [level, keyword]);

  useEffect(() => { fetchLogs(1); }, []);

  const handleSearch = (value: string) => { setKeyword(value); fetchLogs(1, level, value); };
  const handleLevelChange = (value: string) => { setLevel(value); fetchLogs(1, value, keyword); };

  const levelColors: Record<string, string> = { error: 'red', warn: 'orange', warning: 'orange', info: 'blue' };
  const levelBg: Record<string, string> = { error: 'rgba(255,77,79,0.06)', warn: 'rgba(250,173,20,0.06)', warning: 'rgba(250,173,20,0.06)', info: 'transparent' };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn' || l.level === 'warning').length;

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }} align="middle">
        <Col>
          <Select value={level} onChange={handleLevelChange} style={{ width: 150 }}
            options={[
              { label: '全部级别', value: '' },
              { label: <><Badge status="error" /> ERROR</>, value: 'error' },
              { label: <><Badge status="warning" /> WARNING</>, value: 'warn' },
              { label: <><Badge status="processing" /> INFO</>, value: 'info' },
            ]}
          />
        </Col>
        <Col flex="auto">
          <Search placeholder="搜索日志关键词" value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={handleSearch} style={{ maxWidth: 360 }} allowClear enterButton={<><SearchOutlined /> 搜索</>} />
        </Col>
        <Col><Button icon={<ReloadOutlined />} onClick={() => fetchLogs(page)}>刷新</Button></Col>
        <Col>
          <Space size={12}>
            <Tag>共 {total} 条</Tag>
            {errorCount > 0 && <Tag color="red">{errorCount} 错误</Tag>}
            {warnCount > 0 && <Tag color="orange">{warnCount} 警告</Tag>}
          </Space>
        </Col>
      </Row>

      <Card size="small" style={{ maxHeight: 520, overflow: 'auto', fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
        <Spin spinning={loading}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>暂无日志</div>
          ) : (
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              {logs.map((log, idx) => (
                <div key={idx} style={{ padding: '2px 8px', borderBottom: '1px solid var(--border-color-light)', background: levelBg[log.level] || 'transparent', borderRadius: 2 }}>
                  <span style={{ color: 'var(--text-tertiary)', marginRight: 10, fontSize: 11 }}>{log.timestamp}</span>
                  <Tag color={levelColors[log.level] || 'default'} style={{ marginRight: 8, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>
                    {log.level.toUpperCase()}
                  </Tag>
                  <span style={{ color: log.level === 'error' ? '#ff4d4f' : log.level === 'warn' || log.level === 'warning' ? '#d48806' : 'var(--text-primary)' }}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Spin>
      </Card>

      {totalPages > 1 && (
        <Space style={{ marginTop: 12, justifyContent: 'center', width: '100%' }}>
          <Button size="small" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>上一页</Button>
          <Tag>{page} / {totalPages}</Tag>
          <Button size="small" disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)}>下一页</Button>
        </Space>
      )}
    </div>
  );
}

// System settings component
function SystemSettings() {
  const [config, setConfig] = useState<Record<string, { value: string; description: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.getSettings().then(res => setConfig(res.config)).catch(() => message.error('获取配置失败')).finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    try {
      setSaving(true);
      await adminApi.updateSettings({ [key]: value });
      setConfig(prev => ({ ...prev, [key]: { ...prev[key], value } }));
      message.success('配置已更新');
    } catch (e) { console.error('更新配置失败:', e); message.error('更新失败'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  const configLabels: Record<string, string> = {
    registration_enabled: '开放注册',
    max_login_attempts: '最大登录失败次数',
    lockout_duration_minutes: '锁定时长(分钟)',
    password_min_length: '密码最小长度',
    session_timeout_hours: '会话超时(小时)',
  };

  return (
    <Card size="small" title="系统配置">
      <Table dataSource={Object.entries(config).map(([key, val]) => ({ key, ...val }))} rowKey="key" size="small" pagination={false}
        columns={[
          { title: '配置项', dataIndex: 'key', width: 200, render: (v: string) => configLabels[v] || v },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          { title: '当前值', dataIndex: 'value', width: 200, render: (v: string, r: any) => {
            if (r.key === 'registration_enabled') {
              return <Switch checked={v === 'true'} onChange={(checked) => handleUpdate(r.key, String(checked))} loading={saving} />;
            }
            return <Input size="small" defaultValue={v} onPressEnter={(e) => handleUpdate(r.key, (e.target as HTMLInputElement).value)} onBlur={(e) => { if (e.target.value !== v) handleUpdate(r.key, e.target.value); }} />;
          }},
        ]}
      />
    </Card>
  );
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天${hours}小时${mins}分`;
  if (hours > 0) return `${hours}小时${mins}分`;
  return `${mins}分钟`;
}

// Server resources component
function ServerResources() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try { setData(await adminApi.getServerResources()); }
    catch (e) { console.error('获取服务器资源失败:', e); message.error('获取服务器资源失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;
  if (!data) return null;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Card size="small">
          <Row gutter={[16, 8]}>
            <Col xs={12} sm={6}><Statistic title="主机名" value={data.system.hostname} valueStyle={{ fontSize: 14 }} /></Col>
            <Col xs={12} sm={6}><Statistic title="操作系统" value={data.osName || data.system.platform} valueStyle={{ fontSize: 14 }} /></Col>
            <Col xs={12} sm={6}><Statistic title="架构" value={data.system.arch} /></Col>
            <Col xs={12} sm={6}><Statistic title="运行时长" value={formatDuration(data.system.uptime)} prefix={<ClockCircleOutlined />} /></Col>
          </Row>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="CPU" size="small">
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={data.cpu.usage} size={100}
                  strokeColor={data.cpu.usage > 90 ? '#ff4d4f' : data.cpu.usage > 70 ? '#faad14' : '#52c41a'} />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>CPU 使用率</div>
              </div>
            </Col>
            <Col span={16}>
              <Row gutter={[8, 8]}>
                <Col span={12}><Statistic title="核心数" value={data.cpu.cores} /></Col>
                {data.cpu.loadAvg[0] > 0 ? (
                  <>
                    <Col span={12}><Statistic title="1分钟负载" value={data.cpu.loadAvg[0]?.toFixed(2)} valueStyle={{ color: data.cpu.loadAvg[0] > data.cpu.cores ? '#ff4d4f' : undefined }} /></Col>
                    <Col span={12}><Statistic title="5分钟负载" value={data.cpu.loadAvg[1]?.toFixed(2)} /></Col>
                    <Col span={12}><Statistic title="15分钟负载" value={data.cpu.loadAvg[2]?.toFixed(2)} /></Col>
                  </>
                ) : (
                  <Col span={12}><Statistic title="CPU 型号" value={data.cpu.model?.split(' ').slice(0, 3).join(' ')} valueStyle={{ fontSize: 13 }} /></Col>
                )}
              </Row>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>{data.cpu.model}</div>
            </Col>
          </Row>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="内存" size="small">
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <div style={{ textAlign: 'center' }}>
                <Progress type="dashboard" percent={data.memory.usagePercent} size={100}
                  strokeColor={data.memory.usagePercent > 90 ? '#ff4d4f' : data.memory.usagePercent > 70 ? '#faad14' : '#52c41a'} />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>内存使用率</div>
              </div>
            </Col>
            <Col span={16}>
              <Row gutter={[8, 8]}>
                <Col span={12}><Statistic title="总内存" value={data.memory.totalFormatted} /></Col>
                <Col span={12}><Statistic title="已使用" value={data.memory.usedFormatted} valueStyle={{ color: data.memory.usagePercent > 90 ? '#ff4d4f' : undefined }} /></Col>
                <Col span={12}><Statistic title="可用" value={data.memory.freeFormatted} /></Col>
                <Col span={12}><Statistic title="缓存" value={data.memory.cachedFormatted} /></Col>
                <Col span={12}><Statistic title="缓冲" value={data.memory.buffersFormatted} /></Col>
                <Col span={12}><Statistic title="Swap" value={`${data.memory.swapUsedFormatted} / ${data.memory.swapTotalFormatted}`} valueStyle={{ fontSize: 14 }} /></Col>
              </Row>
            </Col>
          </Row>
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="磁盘使用" size="small">
          {data.disks?.map((disk: any, idx: number) => {
            const percent = parseInt(disk.usePercent) || 0;
            return (
              <div key={idx} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span><strong>{disk.mount}</strong> ({disk.filesystem})</span>
                  <span>{disk.used} / {disk.size} ({disk.avail} 可用)</span>
                </div>
                <Progress percent={percent} size="small" strokeColor={percent > 90 ? '#ff4d4f' : percent > 80 ? '#faad14' : '#52c41a'} />
              </div>
            );
          })}
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="网络" size="small">
          <Row gutter={[16, 12]}>
            <Col span={12}><Statistic title="总接收" value={data.network.rxFormatted} prefix={<CloudOutlined />} /></Col>
            <Col span={12}><Statistic title="总发送" value={data.network.txFormatted} prefix={<CloudOutlined />} /></Col>
            <Col span={8}><Statistic title="TCP 已建立" value={data.tcp.established} valueStyle={{ color: '#52c41a' }} /></Col>
            <Col span={8}><Statistic title="TIME_WAIT" value={data.tcp.timeWait} valueStyle={{ color: data.tcp.timeWait > 1000 ? '#faad14' : undefined }} /></Col>
            <Col span={8}><Statistic title="打开文件" value={data.openFiles} /></Col>
          </Row>
          {data.network.interfaces?.length > 0 && (
            <Table dataSource={data.network.interfaces} rowKey="name" size="small" pagination={false} style={{ marginTop: 12 }}
              columns={[
                { title: '接口', dataIndex: 'name', width: 100 },
                { title: '接收', dataIndex: 'rxFormatted', width: 100 },
                { title: '发送', dataIndex: 'txFormatted', width: 100 },
              ]}
            />
          )}
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="磁盘 I/O" size="small">
          <Row gutter={[16, 12]}>
            <Col span={12}><Statistic title="总读取" value={data.diskIO.readFormatted} prefix={<HddOutlined />} /></Col>
            <Col span={12}><Statistic title="总写入" value={data.diskIO.writeFormatted} prefix={<HddOutlined />} /></Col>
          </Row>
        </Card>
      </Col>

      <Col xs={24}>
        <Card title="Top 进程 (按 CPU 排序)" size="small">
          <Table dataSource={data.topProcesses} rowKey="pid" size="small" pagination={false}
            columns={[
              { title: 'PID', dataIndex: 'pid', width: 70 },
              { title: '用户', dataIndex: 'user', width: 80 },
              { title: 'CPU%', dataIndex: 'cpu', width: 70, sorter: (a: any, b: any) => a.cpu - b.cpu, render: (v: number) => <span style={{ color: v > 50 ? '#ff4d4f' : v > 20 ? '#faad14' : undefined }}>{v}%</span> },
              { title: '内存%', dataIndex: 'mem', width: 70, render: (v: number) => `${v}%` },
              { title: 'RSS', dataIndex: 'rss', width: 80 },
              { title: '命令', dataIndex: 'command', ellipsis: true },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

// Main SystemMonitor page
export default function SystemMonitor() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ timestamp: number; qps: number; cacheHit: number; connections: number; slowQueries: number }[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef<any>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await adminApi.getMetrics();
      setMetrics(res);
      setChartData(prev => {
        const next = [...prev, { timestamp: res.timestamp, qps: res.qps, cacheHit: res.database.cacheHitRatio, connections: res.connections.active, slowQueries: res.database.activeSlowQueries }];
        return next.slice(-30);
      });
    } catch (e) { /* silent */ console.error('获取监控指标失败:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchMetrics();
    if (autoRefresh) {
      timerRef.current = setInterval(fetchMetrics, 5000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchMetrics, autoRefresh]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (!metrics) return <div style={{ textAlign: 'center', padding: 80 }}>加载失败</div>;

  const memPercent = parseFloat(metrics.system.memoryUsagePercent);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Top metrics gauges */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" bodyStyle={{ padding: '8px 4px' }}>
            <GaugeChart value={metrics.qps} title="QPS" color="#1677ff" max={Math.max(metrics.qps * 2, 10)} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" bodyStyle={{ padding: '8px 4px' }}>
            <GaugeChart value={metrics.database.cacheHitRatio} title="缓存命中率" color={metrics.database.cacheHitRatio > 95 ? '#52c41a' : metrics.database.cacheHitRatio > 80 ? '#faad14' : '#ff4d4f'} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" bodyStyle={{ padding: '8px 4px' }}>
            <GaugeChart value={metrics.connections.active} title="活跃连接" color="#52c41a" max={metrics.connections.max} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" bodyStyle={{ padding: '8px 4px' }}>
            <GaugeChart value={metrics.database.activeSlowQueries} title="慢查询" color={metrics.database.activeSlowQueries > 0 ? '#ff4d4f' : '#52c41a'} max={Math.max(metrics.database.activeSlowQueries * 3, 5)} />
          </Card>
        </Col>
      </Row>

      {/* Real-time chart */}
      <Card size="small" style={{ marginBottom: 16 }}
        title={<><LineChartOutlined /> 实时监控</>}
        extra={<Space>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} checkedChildren={<PlayCircleOutlined />} unCheckedChildren={<PauseCircleOutlined />} />
          <Button icon={<ReloadOutlined />} size="small" onClick={fetchMetrics}>刷新</Button>
          <Tag color="processing">{autoRefresh ? '每5秒刷新' : '已暂停'}</Tag>
        </Space>}
      >
        <MetricsChart data={chartData} />
      </Card>

      {/* Detail tabs */}
      <Tabs defaultActiveKey="health"
        items={[
          { key: 'health', label: <><HeartOutlined /> 健康检查</>, children: <HealthCheck /> },
          {
            key: 'overview',
            label: <><CloudServerOutlined /> 系统概览</>,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card title="数据库状态" size="small">
                    <Row gutter={[16, 12]}>
                      <Col span={12}><Statistic title="运行时长" value={metrics.database.uptimeFormatted} prefix={<ClockCircleOutlined />} /></Col>
                      <Col span={12}><Statistic title="数据库大小" value={metrics.database.sizeFormatted} prefix={<HddOutlined />} /></Col>
                      <Col span={12}><Statistic title="活跃连接 / 最大连接" value={metrics.connections.active} suffix={`/ ${metrics.connections.max}`} prefix={<ApiOutlined />} /></Col>
                      <Col span={12}><Statistic title="空闲连接" value={metrics.connections.idle} /></Col>
                      <Col span={12}><Statistic title="死锁次数" value={metrics.database.deadlocks} valueStyle={{ color: metrics.database.deadlocks > 0 ? '#ff4d4f' : '#52c41a' }} /></Col>
                      <Col span={12}><Statistic title="请求总数" value={metrics.requestCount} /></Col>
                    </Row>
                  </Card>
                </Col>
                <Col xs={24} lg={12}>
                  <Card title="服务器状态" size="small">
                    <Row gutter={[16, 12]}>
                      <Col span={24}>
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                            <span>内存使用</span><span>{(metrics.system.usedMemory / 1073741824).toFixed(1)} / {(metrics.system.totalMemory / 1073741824).toFixed(1)} GB</span>
                          </div>
                          <Progress percent={memPercent} status={memPercent > 90 ? 'exception' : 'normal'} strokeColor={memPercent > 90 ? '#ff4d4f' : memPercent > 70 ? '#faad14' : '#52c41a'} />
                        </div>
                      </Col>
                      <Col span={8}><Statistic title="CPU核心" value={metrics.system.cpuCount} /></Col>
                      <Col span={8}><Statistic title="系统运行" value={Math.floor(metrics.uptime / 3600)} suffix="小时" /></Col>
                      <Col span={8}><Statistic title="主机名" value={metrics.system.hostname} valueStyle={{ fontSize: 13 }} /></Col>
                      <Col span={8}><Statistic title="进程RSS" value={metrics.process.rssFormatted} /></Col>
                      <Col span={8}><Statistic title="堆内存" value={metrics.process.heapUsedFormatted} /></Col>
                      <Col span={8}><Statistic title="平台" value={metrics.system.platform} valueStyle={{ fontSize: 13 }} /></Col>
                    </Row>
                  </Card>
                </Col>
              </Row>
            ),
          },
          { key: 'api', label: <><ApiOutlined /> API统计</>, children: <ApiStats /> },
          { key: 'alerts', label: <><AlertOutlined /> 告警管理</>, children: <AlertManagement /> },
          { key: 'server', label: <><LaptopOutlined /> 服务器资源</>, children: <ServerResources /> },
          { key: 'db', label: <><DatabaseOutlined /> 数据库详情</>, children: <DBDetails /> },
          { key: 'space', label: <><HddOutlined /> 数据表空间</>, children: <TableSpace /> },
          { key: 'settings', label: <><SettingOutlined /> 系统配置</>, children: <SystemSettings /> },
          { key: 'logs', label: <><FileTextOutlined /> 运行日志</>, children: <LogViewer /> },
        ]}
      />
    </div>
  );
}
