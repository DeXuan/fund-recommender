import { useState, useRef, useCallback, ReactNode } from 'react';
import { Spin } from 'antd';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
}

export default function PullToRefresh({ onRefresh, children, threshold = 60 }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const distance = e.touches[0].clientY - startY.current;
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance * 0.5, threshold * 1.5));
    }
  }, [refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-busy={refreshing}
    >
      <div
        style={{
          height: pullDistance,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: refreshing ? 'none' : 'height 0.2s ease',
        }}
      >
        {refreshing ? (
          <Spin size="small" />
        ) : pullDistance > 10 ? (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {pullDistance >= threshold ? '松开刷新' : '下拉刷新'}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
