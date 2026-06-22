import React from 'react';
import { Spin, Alert, Empty } from 'antd';

interface DataStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}

export function DataState({ loading, error, empty, emptyText = '暂无数据', children }: DataStateProps) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }
  if (empty) {
    return <Empty description={emptyText} />;
  }
  return <>{children}</>;
}
