import { useState, useEffect, useRef } from 'react';
import { Card, Button, Typography, Space, Tag, Table, Modal, message, Spin, Result } from 'antd';
import { CrownOutlined, CheckCircleOutlined, ShoppingOutlined, LockOutlined } from '@ant-design/icons';
import { subscriptionApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;

export default function Subscription() {
  const { user, setUser } = useAuth();
  const { isDark } = useTheme();
  const [plans, setPlans] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState(false);
  const [qrBase64, setQrBase64] = useState('');
  const [outTradeNo, setOutTradeNo] = useState('');
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, statusRes, ordersRes] = await Promise.all([
        subscriptionApi.getPlans(),
        subscriptionApi.getStatus(),
        subscriptionApi.getOrders(),
      ]);
      setPlans(plansRes.plans);
      setStatus(statusRes);
      setOrders(ordersRes.orders);
    } catch (e: any) {
      message.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: number) => {
    try {
      setPaying(true);
      const res = await subscriptionApi.createOrder(planId);
      setOutTradeNo(res.outTradeNo);
      setQrBase64(res.qrCodeBase64);
      setQrModal(true);
      setPaySuccess(false);
      // 轮询支付结果（最多5分钟）
      let pollCount = 0;
      const maxPolls = 100; // 100 * 3s = 300s = 5min
      pollRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollRef.current!);
          message.warning('支付查询超时，请在订单记录中查看支付状态');
          return;
        }
        try {
          const check = await subscriptionApi.checkOrder(res.outTradeNo);
          if (check.paid) {
            clearInterval(pollRef.current!);
            setPaySuccess(true);
            message.success('开通成功！');
            loadData();
            // 更新AuthContext中的user
            if (user && setUser) {
              setUser({ ...user, subscription_status: 'premium' });
            }
          }
        } catch (e) {
          console.error('查询订单状态失败:', e);
        }
      }, 3000);
    } catch (e: any) {
      message.error(e.message || '创建订单失败');
    } finally {
      setPaying(false);
    }
  };

  const handleCloseModal = () => {
    setQrModal(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  const isPremium = status?.isPremium;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 当前状态 */}
      <Card style={{ marginBottom: 24, textAlign: 'center', background: isPremium ? (isDark ? 'linear-gradient(135deg, #b8860b 0%, #daa520 100%)' : 'linear-gradient(135deg, #ffd700 0%, #ffed4a 100%)') : undefined }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {isPremium ? (
            <>
              <CrownOutlined style={{ fontSize: 48, color: isDark ? '#faad14' : '#d48806' }} />
              <Title level={3} style={{ margin: 0, color: isDark ? '#ffd700' : '#614700' }}>尊享会员</Title>
              <Text style={{ color: isDark ? '#ffc53d' : '#876800' }}>到期时间：{new Date(status.expiresAt).toLocaleDateString('zh-CN')}（剩余{status.daysRemaining}天）</Text>
              <Tag color="gold">{status.planName}</Tag>
            </>
          ) : (
            <>
              <LockOutlined style={{ fontSize: 48, color: 'var(--color-text-muted)' }} />
              <Title level={3} style={{ margin: 0 }}>免费用户</Title>
              <Text type="secondary">开通会员解锁全部功能</Text>
            </>
          )}
        </Space>
      </Card>

      {/* 套餐卡片 */}
      {plans.map(plan => (
        <Card key={plan.id} style={{ marginBottom: 24 }} hoverable>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <Title level={4} style={{ margin: 0 }}>{plan.name}</Title>
              <Title level={2} style={{ margin: '8px 0', color: 'var(--primary)' }}>
                ¥{plan.price}<Text type="secondary" style={{ fontSize: 14 }}> / {plan.duration_days}天</Text>
              </Title>
              <Space wrap>
                {(plan.features || []).map((f: string, i: number) => (
                  <Tag key={i} icon={<CheckCircleOutlined />} color="success">{f}</Tag>
                ))}
              </Space>
            </div>
            <Button type="primary" size="large" icon={<ShoppingOutlined />} loading={paying}
              onClick={() => handleSubscribe(plan.id)} disabled={isPremium}>
              {isPremium ? '已开通' : '立即开通'}
            </Button>
          </div>
        </Card>
      ))}

      {/* 订单历史 */}
      {orders.length > 0 && (
        <Card title="订单记录">
          <Table dataSource={orders} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '套餐', dataIndex: 'plan_name' },
              { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${v}` },
              { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'paid' ? 'green' : 'orange'}>{v === 'paid' ? '已支付' : '待支付'}</Tag> },
              { title: '时间', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
            ]}
          />
        </Card>
      )}

      {/* 支付二维码弹窗 */}
      <Modal open={qrModal} onCancel={handleCloseModal} footer={null} width={360} title="支付宝扫码支付">
        {paySuccess ? (
          <Result status="success" title="开通成功" subTitle="会员权益已生效" />
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            {qrBase64 ? (
              <img src={qrBase64} alt="支付宝二维码" style={{ width: 260, height: 260 }} />
            ) : (
              <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#1f1f1f' : '#f5f5f5', margin: '0 auto' }}>
                <Text type="secondary">二维码生成中...</Text>
              </div>
            )}
            <Paragraph style={{ marginTop: 16 }} type="secondary">请使用支付宝扫描二维码完成支付</Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>支付完成后页面将自动刷新</Text>
          </div>
        )}
      </Modal>
    </div>
  );
}
