import { useState, useEffect } from 'react';
import { Tag, Button, Space, Tooltip } from 'antd';
import { SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { fundApi } from '../services/api';

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
    if (status?.nextUpdateTime) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const next = new Date(status.nextUpdateTime).getTime();
        const diff = next - now;

        if (diff <= 0) {
          setCountdown('即将更新');
        } else {
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setCountdown(`${minutes}分${seconds.toString().padStart(2, '0')}秒`);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
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
    const now = new Date().getTime();
    const past = new Date(isoString).getTime();
    const diff = now - past;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    return `${Math.floor(diff / 3600000)}小时前`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '6px 16px',
      background: '#fafafa',
      borderRadius: 8,
      fontSize: 12,
    }}>
      <Space size={12}>
        {status?.isUpdating ? (
          <Tag icon={<SyncOutlined spin />} color="processing">数据更新中</Tag>
        ) : (
          <Tag icon={<CheckCircleOutlined />} color="success">数据正常</Tag>
        )}

        {status?.lastUpdateTime && (
          <Tooltip title={new Date(status.lastUpdateTime).toLocaleString('zh-CN')}>
            <span style={{ color: '#666' }}>
              更新于 {getTimeAgo(status.lastUpdateTime)}
            </span>
          </Tooltip>
        )}

        {countdown && (
          <span style={{ color: '#1677ff' }}>
            下次更新: {countdown}
          </span>
        )}
      </Space>

      <Button
        size="small"
        icon={<SyncOutlined />}
        loading={loading || status?.isUpdating}
        onClick={handleRefresh}
        style={{ marginLeft: 'auto' }}
      >
        刷新
      </Button>
    </div>
  );
}
