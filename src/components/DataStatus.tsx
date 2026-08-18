import { useState, useEffect } from 'react';
import { Tag, Button, Space, Tooltip, Spin, message, Grid } from 'antd';
import { SyncOutlined, CheckCircleOutlined, StockOutlined, PauseCircleOutlined, RestOutlined, ClockCircleOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { fundApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MARKET_STATE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  trading: { label: '交易中', color: 'success', icon: <StockOutlined /> },
  closed: { label: '已收盘', color: 'warning', icon: <PauseCircleOutlined /> },
  holiday: { label: '休市', color: 'default', icon: <RestOutlined /> },
};

export default function DataStatus() {
  const { user } = useAuth();
  const isMobile = Grid.useBreakpoint().sm === false;
  const [collapsed, setCollapsed] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState('');
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!status?.nextUpdateTime) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const next = new Date(status.nextUpdateTime).getTime();
      const diff = next - now;

      if (diff <= 0) {
        setCountdown('即将更新');
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}小时${minutes}分`);
      } else {
        setCountdown(`${minutes}分${seconds.toString().padStart(2, '0')}秒`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const loadStatus = async () => {
    try {
      const data = await fundApi.getStatus();
      setStatus(data);
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  };

  const handleRefresh = async () => {
    if (!isAdmin) {
      message.warning('仅管理员可手动触发数据更新');
      return;
    }
    setLoading(true);
    try {
      await fundApi.triggerUpdate();
      message.success('数据更新已启动');
      setTimeout(() => {
        loadStatus();
        setLoading(false);
      }, 2000);
    } catch (error: any) {
      message.error(error?.message || '触发更新失败');
      setLoading(false);
    }
  };

  const getTimeAgo = (isoString: string) => {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const stateConfig = MARKET_STATE_CONFIG[status?.marketState] || MARKET_STATE_CONFIG.holiday;
  const nextLabel = status?.isTrading ? '距收盘' : '距开盘';

  const showFull = !isMobile || !collapsed;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: isMobile && collapsed ? '6px 16px' : '8px 16px',
      background: 'var(--bg-container)',
      backdropFilter: 'blur(10px)',
      borderRadius: 12,
      fontSize: 12,
      border: '1px solid var(--border-color-light)',
      boxShadow: 'var(--shadow-sm)',
      cursor: isMobile ? 'pointer' : 'default',
    }} onClick={isMobile ? () => setCollapsed(c => !c) : undefined}>
      <Space size={12} split={<span style={{ color: 'var(--border-color)' }}>|</span>}>
        {status?.isUpdating ? (
          <Tag icon={<SyncOutlined spin />} color="processing" style={{ margin: 0, borderRadius: 6 }}>
            数据更新中
          </Tag>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0, borderRadius: 6 }}>
            数据正常
          </Tag>
        )}

        {showFull && (
          <Tag icon={stateConfig.icon as React.ReactElement} color={stateConfig.color} style={{ margin: 0, borderRadius: 6 }}>
            {stateConfig.label}
          </Tag>
        )}

        {showFull && status?.lastUpdateTime && (
          <Tooltip title={new Date(status.lastUpdateTime).toLocaleString('zh-CN')}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined style={{ color: 'var(--text-tertiary)' }} />
              数据截至 {formatDateTime(status.lastUpdateTime)}
            </span>
          </Tooltip>
        )}

        {showFull && countdown && (
          <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
            {nextLabel}: {countdown}
          </span>
        )}
      </Space>

      {isMobile && (
        <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          {collapsed ? '查看' : '收起'}{collapsed ? <DownOutlined /> : <UpOutlined />}
        </span>
      )}

      {isAdmin && (showFull || !isMobile) && (
        <Button
          size="small"
          icon={<SyncOutlined />}
          loading={loading || status?.isUpdating}
          onClick={handleRefresh}
          style={{ marginLeft: 'auto', borderRadius: 6 }}
        >
          刷新
        </Button>
      )}
    </div>
  );
}
