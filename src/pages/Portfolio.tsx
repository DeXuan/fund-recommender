import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, DatePicker, message,
  Popconfirm, Space, Statistic, Row, Col, Upload, Tag, Empty, Spin, Select, Badge, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, ArrowUpOutlined, ArrowDownOutlined, FundOutlined,
  ScheduleOutlined, SyncOutlined, CheckCircleOutlined, PauseCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { portfolioApi, fundApi } from '../services/api';
import type { PortfolioHolding, PortfolioSummary, FundRecord } from '../types';

export default function Portfolio() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FundRecord | null>(null);
  const [form] = Form.useForm();
  const [lookupLoading, setLookupLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 定投计划状态
  const [dcaPlans, setDcaPlans] = useState<any[]>([]);
  const [dcaModalOpen, setDcaModalOpen] = useState(false);
  const [editingDca, setEditingDca] = useState<any | null>(null);
  const [dcaForm] = Form.useForm();
  const [syncing, setSyncing] = useState(false);

  const handleFundCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.trim();
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (code.length === 6 && /^\d{6}$/.test(code)) {
      lookupTimerRef.current = setTimeout(async () => {
        setLookupLoading(true);
        try {
          const fund = await fundApi.getFundDetail(code);
          form.setFieldsValue({ fund_name: fund.name });
        } catch {
          // fund not found, leave name empty for manual input
        } finally {
          setLookupLoading(false);
        }
      }, 300);
    }
  }, [form]);

  const loadData = async () => {
    try {
      const [data, plans] = await Promise.all([
        portfolioApi.getSummary(),
        portfolioApi.getDcaPlans().catch(() => []),
      ]);
      setSummary(data);
      setDcaPlans(plans);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: FundRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      buy_date: dayjs(record.buy_date),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await portfolioApi.deleteRecord(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        buy_date: values.buy_date.format('YYYY-MM-DD'),
      };

      if (editingRecord) {
        await portfolioApi.updateRecord(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await portfolioApi.addRecord(payload);
        message.success('添加成功');
      }
      setModalOpen(false);
      loadData();
    } catch {
      // validation error
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await portfolioApi.importCSV(file);
      message.success(`成功导入 ${result.imported} 条记录`);
      if (result.errors?.length > 0) {
        message.warning(`${result.errors.length} 条记录导入失败`);
      }
      loadData();
    } catch {
      message.error('导入失败');
    }
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const csv = 'fund_code,fund_name,shares,cost_price,buy_date,buy_fee,notes\n013349,人工智能ETF联接A,1000,1.2345,2024-01-15,0,示例记录\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '基金持仓导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 定投计划操作
  const handleAddDca = () => {
    setEditingDca(null);
    dcaForm.resetFields();
    setDcaModalOpen(true);
  };

  const handleEditDca = (plan: any) => {
    setEditingDca(plan);
    dcaForm.setFieldsValue({
      ...plan,
      start_date: dayjs(plan.start_date),
      end_date: plan.end_date ? dayjs(plan.end_date) : undefined,
    });
    setDcaModalOpen(true);
  };

  const handleDeleteDca = async (id: number) => {
    try {
      await portfolioApi.deleteDcaPlan(id);
      message.success('删除定投计划成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmitDca = async () => {
    try {
      const values = await dcaForm.validateFields();
      const payload = {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : '',
      };

      if (editingDca) {
        await portfolioApi.updateDcaPlan(editingDca.id, payload);
        message.success('更新成功');
      } else {
        await portfolioApi.addDcaPlan(payload);
        message.success('定投计划创建成功');
      }
      setDcaModalOpen(false);
      loadData();
    } catch {
      // validation error
    }
  };

  const handleSyncDca = async () => {
    setSyncing(true);
    try {
      const result = await portfolioApi.syncDcaPlans();
      if (result.synced > 0) {
        message.success(result.message);
        loadData();
      } else {
        message.info(result.message);
      }
    } catch {
      message.error('同步定投失败');
    } finally {
      setSyncing(false);
    }
  };

  const frequencyLabel = (f: string) => ({
    weekly: '每周', biweekly: '每两周', monthly: '每月', quarterly: '每季度',
  }[f] || f);

  const dcaColumns = [
    { title: '基金名称', dataIndex: 'fund_name', key: 'fund_name', width: 180 },
    { title: '基金代码', dataIndex: 'fund_code', key: 'fund_code', width: 100 },
    {
      title: '定投金额', dataIndex: 'amount', key: 'amount', width: 110,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '频率', dataIndex: 'frequency', key: 'frequency', width: 90,
      render: (v: string) => frequencyLabel(v),
    },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 110 },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 110, render: (v: string) => v || '长期' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => v === 'active'
        ? <Badge status="processing" text="执行中" />
        : <Badge status="default" text={v === 'completed' ? '已到期' : '已暂停'} />,
    },
    {
      title: '上次执行', dataIndex: 'last_executed', key: 'last_executed', width: 110,
      render: (v: string) => v || '未执行',
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDca(record)}>编辑</Button>
          <Popconfirm title="确认删除此定投计划？" onConfirm={() => handleDeleteDca(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const holdings = summary?.holdings || [];
  const pnlColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';
  const pnlSign = (v: number) => v >= 0 ? '+' : '-';

  // Pie chart config
  const pieOption = holdings.length > 0 ? {
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      label: { formatter: '{b}\n{d}%' },
      data: holdings.map(h => ({
        name: h.fund_name,
        value: h.market_value,
      })),
    }],
  } : null;

  // P&L bar chart
  const barOption = holdings.length > 0 ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: holdings.map(h => h.fund_name.slice(0, 6)),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value', name: '盈亏(元)' },
    series: [{
      type: 'bar',
      data: holdings.map(h => ({
        value: h.pnl,
        itemStyle: { color: h.pnl >= 0 ? '#cf1322' : '#3f8600' },
      })),
    }],
  } : null;

  const columns = [
    { title: '基金名称', dataIndex: 'fund_name', key: 'fund_name', width: 180 },
    { title: '基金代码', dataIndex: 'fund_code', key: 'fund_code', width: 100 },
    {
      title: '持有份额', dataIndex: 'total_shares', key: 'total_shares', width: 100,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '成本价', dataIndex: 'avg_cost_price', key: 'avg_cost_price', width: 90,
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '当前净值', dataIndex: 'current_nav', key: 'current_nav', width: 90,
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '市值', dataIndex: 'market_value', key: 'market_value', width: 110,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '盈亏', dataIndex: 'pnl', key: 'pnl', width: 110,
      render: (v: number) => (
        <span style={{ color: pnlColor(v), fontWeight: 600 }}>
          {pnlSign(v)}¥{Math.abs(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: '收益率', dataIndex: 'pnl_percent', key: 'pnl_percent', width: 90,
      render: (v: number) => (
        <Tag color={v >= 0 ? 'red' : 'green'}>{pnlSign(v)}{Math.abs(v).toFixed(2)}%</Tag>
      ),
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right' as const,
      render: (_: any, holding: PortfolioHolding) => (
        <Space>
          <Button
            type="link" size="small" icon={<EditOutlined />}
            onClick={() => handleEdit(holding.records[0])}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除此基金的所有持仓记录？" onConfirm={() => {
            holding.records.forEach(r => portfolioApi.deleteRecord(r.id));
            message.success('删除成功');
            setTimeout(loadData, 300);
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Flatten records for the table (grouped view)
  const tableData = holdings.map((h, i) => ({ ...h, key: h.fund_code || i }));

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <FundOutlined style={{ marginRight: 8 }} />
        理财记账
      </h2>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总投入" value={summary?.totalCost || 0} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="当前市值" value={summary?.totalValue || 0} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总盈亏"
              value={summary?.totalPnl || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: pnlColor(summary?.totalPnl || 0) }}
              suffix={
                (summary?.totalPnl || 0) >= 0
                  ? <ArrowUpOutlined />
                  : <ArrowDownOutlined />
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收益率"
              value={summary?.totalReturn || 0}
              precision={2}
              suffix="%"
              valueStyle={{ color: pnlColor(summary?.totalReturn || 0) }}
              prefix={(summary?.totalReturn || 0) >= 0 ? '+' : ''}
            />
          </Card>
        </Col>
      </Row>

      {/* Action Buttons */}
      <Card
        title="持仓明细"
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
            <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>导入CSV</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加持仓</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {holdings.length === 0 && !loading ? (
          <Empty description="暂无持仓记录，点击上方按钮添加" />
        ) : (
          <Table
            columns={columns}
            dataSource={tableData}
            loading={loading}
            scroll={{ x: 1000 }}
            pagination={false}
            size="middle"
          />
        )}
      </Card>

      {/* Charts */}
      {holdings.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="持仓分布">
              <ReactECharts option={pieOption} style={{ height: 300 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="各基金盈亏">
              <ReactECharts option={barOption} style={{ height: 300 }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* DCA Plans */}
      <Card
        title={<><ScheduleOutlined style={{ marginRight: 8 }} />定投计划</>}
        extra={
          <Space>
            <Tooltip title="同步定投：根据计划自动生成最近的持仓记录">
              <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSyncDca} loading={syncing}>
                同步定投
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDca}>新建定投</Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {dcaPlans.length === 0 && !loading ? (
          <Empty description="暂无定投计划，点击右上角新建" />
        ) : (
          <Table
            columns={dcaColumns}
            dataSource={dcaPlans.map(p => ({ ...p, key: p.id }))}
            pagination={false}
            size="middle"
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      {/* Add/Edit Fund Record Modal */}
      <Modal
        title={editingRecord ? '编辑持仓' : '添加持仓'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="fund_code"
            label="基金代码"
            rules={[{ required: true, message: '请输入基金代码' }]}
          >
            <Input placeholder="例如: 013349" maxLength={6} onChange={handleFundCodeChange} />
          </Form.Item>
          <Form.Item
            name="fund_name"
            label="基金名称"
            rules={[{ required: true, message: '请输入基金名称' }]}
          >
            <Input
              placeholder="例如: 人工智能ETF联接A"
              suffix={lookupLoading ? <Spin size="small" /> : undefined}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="shares"
                label="持有份额"
                rules={[{ required: true, message: '请输入份额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} step={100} placeholder="1000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cost_price"
                label="成本价(元)"
                rules={[{ required: true, message: '请输入成本价' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.0001} step={0.01} placeholder="1.2345" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buy_date"
                label="买入日期"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buy_fee" label="手续费(元)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>

      {/* DCA Plan Modal */}
      <Modal
        title={editingDca ? '编辑定投计划' : '新建定投计划'}
        open={dcaModalOpen}
        onOk={handleSubmitDca}
        onCancel={() => setDcaModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={520}
      >
        <Form form={dcaForm} layout="vertical" preserve={false}>
          <Form.Item
            name="fund_code"
            label="基金代码"
            rules={[{ required: true, message: '请输入基金代码' }]}
          >
            <Input placeholder="例如: 000961" maxLength={6} onChange={handleFundCodeChange} />
          </Form.Item>
          <Form.Item
            name="fund_name"
            label="基金名称"
            rules={[{ required: true, message: '请输入基金名称' }]}
          >
            <Input
              placeholder="例如: 天弘沪深300ETF联接A"
              suffix={lookupLoading ? <Spin size="small" /> : undefined}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="每期定投金额(元)"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={10} step={100} placeholder="1000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="frequency"
                label="定投频率"
                rules={[{ required: true, message: '请选择频率' }]}
                initialValue="monthly"
              >
                <Select options={[
                  { value: 'weekly', label: '每周' },
                  { value: 'biweekly', label: '每两周' },
                  { value: 'monthly', label: '每月' },
                  { value: 'quarterly', label: '每季度' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.frequency !== cur.frequency}>
            {({ getFieldValue }) => {
              const freq = getFieldValue('frequency');
              return freq === 'weekly' || freq === 'biweekly' ? (
                <Form.Item name="day_of_week" label="每周几执行" initialValue={1}>
                  <Select options={[
                    { value: 1, label: '周一' }, { value: 2, label: '周二' },
                    { value: 3, label: '周三' }, { value: 4, label: '周四' },
                    { value: 5, label: '周五' },
                  ]} />
                </Form.Item>
              ) : (
                <Form.Item name="day_of_month" label="每月几号执行" initialValue={1}>
                  <InputNumber style={{ width: '100%' }} min={1} max={28} placeholder="1" />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="结束日期（选填）">
                <DatePicker style={{ width: '100%' }} placeholder="留空为长期" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="选填，例如：支付宝定投" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
