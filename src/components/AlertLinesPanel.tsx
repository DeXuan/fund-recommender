import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Form, InputNumber, Tag, Space, Empty, message, Popconfirm } from 'antd';
import { BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { portfolioApi } from '../services/api';

interface AlertLine {
  fund_code: string;
  fund_name: string | null;
  take_profit: number | null;
  stop_loss: number | null;
  current_pnl_percent: number | null;
  market_value: number | null;
}

export default function AlertLinesPanel({ holdings }: { holdings: Array<{ fund_code: string; fund_name?: string }> }) {
  const [alertLines, setAlertLines] = useState<AlertLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AlertLine | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await portfolioApi.getAlertLines();
      setAlertLines(data);
    } catch {
      setAlertLines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await portfolioApi.setAlertLine({
        fund_code: editing!.fund_code,
        fund_name: editing!.fund_name || undefined,
        take_profit: values.take_profit ?? null,
        stop_loss: values.stop_loss ?? null,
      });
      message.success('预警线已保存');
      setModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      if (msg !== 'Validation failed') message.error(msg);
    }
  };

  const handleDelete = async (fund_code: string) => {
    try {
      await portfolioApi.deleteAlertLine(fund_code);
      message.success('已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const openAddModal = (fund_code: string, fund_name?: string) => {
    const existing = alertLines.find(a => a.fund_code === fund_code);
    setEditing(existing || { fund_code, fund_name: fund_name || null, take_profit: null, stop_loss: null, current_pnl_percent: null, market_value: null });
    form.setFieldsValue({
      take_profit: existing?.take_profit ?? null,
      stop_loss: existing?.stop_loss ?? null,
    });
    setModalOpen(true);
  };

  const getAlertStatus = (record: AlertLine): 'triggered' | 'near' | 'safe' | 'none' => {
    if (record.current_pnl_percent === null) return 'none';
    if (record.take_profit !== null && record.current_pnl_percent >= record.take_profit) return 'triggered';
    if (record.stop_loss !== null && record.current_pnl_percent <= record.stop_loss) return 'triggered';
    if (record.take_profit !== null && record.current_pnl_percent >= record.take_profit * 0.8) return 'near';
    if (record.stop_loss !== null && record.current_pnl_percent <= record.stop_loss * 0.8) return 'near';
    return 'safe';
  };

  const statusTagMap = {
    triggered: { color: 'red', text: '已触发' },
    near: { color: 'orange', text: '接近' },
    safe: { color: 'green', text: '安全' },
    none: { color: 'default', text: '无数据' },
  };

  const fundsWithoutAlert = holdings.filter(h => !alertLines.some(a => a.fund_code === h.fund_code));

  return (
    <Card
      title={<span><BellOutlined /> 持仓预警线</span>}
      size="small"
      style={{ marginBottom: 16 }}
      extra={fundsWithoutAlert.length > 0 && (
        <Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => openAddModal(fundsWithoutAlert[0].fund_code, fundsWithoutAlert[0].fund_name)}>
          添加
        </Button>
      )}
    >
      {alertLines.length === 0 && !loading ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无预警线设置" />
      ) : (
        <Table
          dataSource={alertLines}
          rowKey="fund_code"
          loading={loading}
          size="small"
          pagination={false}
          columns={[
            {
              title: '基金',
              dataIndex: 'fund_name',
              key: 'fund_name',
              render: (name, r) => name || r.fund_code,
            },
            {
              title: '止盈线',
              dataIndex: 'take_profit',
              key: 'take_profit',
              width: 90,
              render: (v: number | null) => v !== null ? <Tag color="green">+{v}%</Tag> : '-',
            },
            {
              title: '止损线',
              dataIndex: 'stop_loss',
              key: 'stop_loss',
              width: 90,
              render: (v: number | null) => v !== null ? <Tag color="red">{v}%</Tag> : '-',
            },
            {
              title: '当前收益',
              dataIndex: 'current_pnl_percent',
              key: 'current_pnl_percent',
              width: 90,
              render: (v: number | null) => v !== null ? <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span> : '-',
            },
            {
              title: '状态',
              key: 'status',
              width: 80,
              render: (_: unknown, r: AlertLine) => {
                const status = getAlertStatus(r);
                const tag = statusTagMap[status];
                return <Tag color={tag.color} icon={status === 'triggered' ? <ExclamationCircleOutlined /> : undefined}>{tag.text}</Tag>;
              },
            },
            {
              title: '操作',
              key: 'action',
              width: 80,
              render: (_: unknown, r: AlertLine) => (
                <Space size={0}>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openAddModal(r.fund_code, r.fund_name || undefined)} />
                  <Popconfirm title="确认删除?" onConfirm={() => handleDelete(r.fund_code)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal
        title={editing ? `设置预警线 - ${editing.fund_name || editing.fund_code}` : '设置预警线'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="take_profit" label="止盈线 (%)">
            <InputNumber placeholder="如 20 表示收益达20%提醒" style={{ width: '100%' }} min={0} max={500} step={1} addonAfter="%" />
          </Form.Item>
          <Form.Item name="stop_loss" label="止损线 (%)">
            <InputNumber placeholder="如 -10 表示亏损达10%提醒" style={{ width: '100%' }} min={-100} max={0} step={1} addonAfter="%" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
