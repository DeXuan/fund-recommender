import { Spin, Result, Button } from 'antd';
import { Component, type ReactNode } from 'react';

// 共享 Loading 组件
export function PageLoader({ tip = '加载中...' }: { tip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
      <Spin size="large" tip={tip} />
    </div>
  );
}

// 页面级 ErrorBoundary — 单个页面崩溃不影响其他页面
interface PageErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PageErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={this.props.fallbackTitle || '页面加载失败'}
          subTitle={this.state.error?.message}
          extra={
            <Button type="primary" onClick={() => this.setState({ hasError: false, error: null })}>
              重试
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
