import { useState, useEffect } from 'react';
import { Tag, Button, Space, Tooltip, Spin } from 'antd';
import { SyncOutlined, CheckCircleOutlined, StockOutlined, PauseCircleOutlined, RestOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { fundApi } from '../services/api';

const MARKET_STATE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  trading: { label: '交易中', color: 'success', icon: <StockOutlined /> },
  closed: { label: '已收盘', color: 'warning', icon: <PauseCircleOutlined /> },
  holiday: { label: '休市', color: 'default', icon: <RestOutlined /> },
};

export default function DataStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState('');

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
    setLoading(true);
    try {
      await fundApi.triggerUpdate();
      setTimeout(() => {
        loadStatus();
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('触发更新失败:', error);
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

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      borderRadius: 12,
      fontSize: 12,
      border: '1px solid rgba(0, 0, 0, 0.06)',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
    }}>
      <Space size={12} split={<span style={{ color: '#e8e8e8' }}>|</span>}>
        {status?.isUpdating ? (
          <Tag icon={<SyncOutlined spin />} color="processing" style={{ margin: 0, borderRadius: 6 }}>
            数据更新中
          </Tag>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0, borderRadius: 6 }}>
            数据正常
          </Tag>
        )}

        <Tag icon={stateConfig.icon as React.ReactElement} color={stateConfig.color} style={{ margin: 0, borderRadius: 6 }}>
          {stateConfig.label}
        </Tag>

        {status?.lastUpdateTime && (
          <Tooltip title={new Date(status.lastUpdateTime).toLocaleString('zh-CN')}>
            <span style={{ color: '#595959', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
              数据截至 {formatDateTime(status.lastUpdateTime)}
            </span>
          </Tooltip>
        )}

        {countdown && (
          <span style={{ color: '#1677ff', fontWeight: 500 }}>
            {nextLabel}: {countdown}
          </span>
        )}
      </Space>

      <Button
        size="small"
        icon={<SyncOutlined />}
        loading={loading || status?.isUpdating}
        onClick={handleRefresh}
        style={{ marginLeft: 'auto', borderRadius: 6 }}
      >
        刷新
      </Button>
    </div>
  );
}
