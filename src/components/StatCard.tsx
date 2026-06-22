import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getReturnColor } from '../utils/format';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  colorize?: boolean;
  style?: React.CSSProperties;
}

export function StatCard({ label, value, suffix, colorize, style }: StatCardProps) {
  const { isDark } = useTheme();
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const color = colorize && !isNaN(numValue) ? getReturnColor(numValue) : undefined;

  return (
    <div style={{
      background: isDark ? 'var(--bg-secondary)' : '#fafafa',
      borderRadius: 8,
      padding: '12px 16px',
      textAlign: 'center',
      ...style,
    }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>
        {value}{suffix && <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{suffix}</span>}
      </div>
    </div>
  );
}
