import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, Tag, Statistic, message, Popconfirm, Space, Tooltip, Empty, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WalletOutlined, BankOutlined, FundOutlined, StockOutlined, HomeOutlined, GlobalOutlined, DollarOutlined } from '@ant-design/icons';
import { portfolioApi } from '../../services/api';

const ACCOUNT_TYPES = [
  { value: 'fund', label: '基金', icon: '📈', color: '#1677ff' },
  { value: 'stock', label: '股票', icon: '📊', color: '#cf1322' },
  { value: 'cash', label: '现金', icon: '💵', color: '#52c41a' },
  { value: 'deposit', label: '存款', icon: '🏦', color: '#faad14' },
  { value: 'bond', label: '债权', icon: '📜', color: '#722ed1' },
  { value: 'crypto', label: '加密资产', icon: '₿', color: '#eb2f96' },
  { value: 'realestate', label: '不动产', icon: '🏠', color: '#13c2c2' },
  { value: 'other', label: '其他', icon: '💰', color: '#666' },
];

interface Props {
  isDark: boolean;
}

export function AssetAccountsPanel({ isDark }: Props) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ byType: any[]; total: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    try {
      const [accs, sum] = await Promise.all([
        portfolioApi.getAssetAccounts(),
        portfolioApi.getAssetAccountsSummary(),
      ]);
      setAccounts(accs);
      setSummary(sum);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ account_type: 'fund', balance: 0, cost_basis: 0, icon: '💰', color: '#1677ff' });
    setModalOpen(true);
  };

  const handleEdit = (account: any) => {
    setEditing(account);
    form.setFieldsValue(account);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await portfolioApi.updateAssetAccount(editing.id, values);
        message.success('账户已更新');
      } else {
        await portfolioApi.addAssetAccount(values);
        message.success('账户已创建');
      }
      setModalOpen(false);
      loadData();
    } catch { /* validation error */ }
  };

  const handleDelete = async (id: number) => {
    try {
      await portfolioApi.deleteAssetAccount(id);
      message.success('账户已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const getTypeConfig = (type: string) => ACCOUNT_TYPES.find(t => t.value === type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
  const pnlColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';

  if (loading) return <Card><Spin /></Card>;

  const totalAssets = Number(summary?.total?.total_assets || 0);
  const totalCost = Number(summary?.total?.total_cost || 0);
  const totalPnl = Number(summary?.total?.total_pnl || 0);

  return (
    <>
      {/* Summary cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: 10 }} styles={{ body: { padding: 14 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 2 }}>总资产</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>¥{totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', border: 'none', borderRadius: 10 }} styles={{ body: { padding: 14 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 2 }}>总成本</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>¥{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ background: totalPnl >= 0 ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', border: 'none', borderRadius: 10 }} styles={{ body: { padding: 14 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 2 }}>总盈亏</div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
              {totalPnl >= 0 ? '+' : '-'}¥{Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* By type breakdown */}
      {summary?.byType && summary.byType.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>资产分布</div>
          <Row gutter={[8, 8]}>
            {summary.byType.map((item: any) => {
              const cfg = getTypeConfig(item.account_type);
              return (
                <Col xs={12} sm={8} md={6} key={item.account_type}>
                  <div style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                    border: `1px solid ${isDark ? '#333' : '#f0f0f0'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <span style={{ fontSize: 12, color: '#999' }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: cfg.color }}>¥{Number(item.total_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{item.count}个账户</div>
                    {Number(item.total_pnl) !== 0 && (
                      <div style={{ fontSize: 11, color: pnlColor(Number(item.total_pnl)), fontWeight: 600 }}>
                        {Number(item.total_pnl) >= 0 ? '+' : '-'}¥{Math.abs(Number(item.total_pnl)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                </Col>
              );
            })}
          </Row>
        </Card>
      )}

      {/* Account list */}
      <Card
        title={<><WalletOutlined style={{ marginRight: 8 }} />资产账户</>}
        extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>添加账户</Button>}
      >
        {accounts.length === 0 ? (
          <Empty description="暂无资产账户，点击上方按钮添加" />
        ) : (
          <Row gutter={[12, 12]}>
            {accounts.map(acc => {
              const cfg = getTypeConfig(acc.account_type);
              const pnl = Number(acc.balance) - Number(acc.cost_basis);
              return (
                <Col xs={24} sm={12} lg={8} key={acc.id}>
                  <Card
                    size="small"
                    hoverable
                    style={{ borderRadius: 10, border: `1px solid ${isDark ? '#333' : '#f0f0f0'}` }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{acc.icon || cfg.icon}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{acc.account_name}</div>
                          <Tag color={cfg.color} style={{ fontSize: 10, margin: 0 }}>{cfg.label}</Tag>
                        </div>
                      </div>
                      <Space size={4}>
                        <Tooltip title="编辑"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(acc)} /></Tooltip>
                        <Popconfirm title="确认删除此账户？" onConfirm={() => handleDelete(acc.id)}>
                          <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: cfg.color }}>
                      ¥{Number(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {acc.cost_basis > 0 && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                        成本 ¥{Number(acc.cost_basis).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {pnl !== 0 && (
                          <span style={{ marginLeft: 8, color: pnlColor(pnl), fontWeight: 600 }}>
                            {pnl >= 0 ? '+' : '-'}¥{Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    )}
                    {acc.notes && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{acc.notes}</div>}
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editing ? '编辑账户' : '添加账户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="account_type" label="账户类型" rules={[{ required: true }]}>
            <Select>
              {ACCOUNT_TYPES.map(t => (
                <Select.Option key={t.value} value={t.value}>{t.icon} {t.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="account_name" label="账户名称" rules={[{ required: true, message: '请输入账户名称' }]}>
            <Input placeholder="例如：招商银行活期" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="balance" label="当前余额/市值" initialValue={0}>
                <InputNumber min={0} step={1000} style={{ width: '100%' }} formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cost_basis" label="成本/本金" initialValue={0}>
                <InputNumber min={0} step={1000} style={{ width: '100%' }} formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="icon" label="图标" initialValue="💰">
                <Input placeholder="emoji" maxLength={4} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="color" label="颜色" initialValue="#1677ff">
                <Input type="color" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="币种" initialValue="CNY">
                <Select>
                  <Select.Option value="CNY">人民币</Select.Option>
                  <Select.Option value="USD">美元</Select.Option>
                  <Select.Option value="HKD">港币</Select.Option>
                  <Select.Option value="BTC">BTC</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
