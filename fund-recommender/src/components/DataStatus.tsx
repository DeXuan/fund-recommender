import { useState, useEffect } from 'react';
import { fundApi } from '../services/api';

export default function DataStatus() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60000); // 每分钟检查状态
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
          setCountdown(`${minutes}分${seconds.toString().padStart(2, '0')}秒后更新`);
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
      // 等待一下再刷新状态
      setTimeout(() => {
        loadStatus();
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('触发更新失败:', error);
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeAgo = (isoString: string) => {
    if (!isoString) return '';
    const now = new Date().getTime();
    const past = new Date(isoString).getTime();
    const diff = now - past;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    return `${hours}小时前`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      background: '#f5f5f5',
      borderRadius: 8,
      fontSize: 12,
      color: '#666',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: status?.isUpdating ? '#faad14' : '#52c41a',
          animation: status?.isUpdating ? 'pulse 1s infinite' : 'none',
        }}></span>
        <span>数据状态:</span>
      </div>

      {status?.lastUpdateTime && (
        <span>
          更新于 {formatTime(status.lastUpdateTime)} ({getTimeAgo(status.lastUpdateTime)})
        </span>
      )}

      {countdown && (
        <span style={{ color: '#1677ff' }}>
          {countdown}
        </span>
      )}

      <button
        onClick={handleRefresh}
        disabled={loading || status?.isUpdating}
        style={{
          marginLeft: 'auto',
          padding: '4px 12px',
          background: 'white',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          cursor: loading || status?.isUpdating ? 'not-allowed' : 'pointer',
          fontSize: 12,
          opacity: loading || status?.isUpdating ? 0.5 : 1,
        }}
      >
        {loading || status?.isUpdating ? '更新中...' : '立即刷新'}
      </button>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
