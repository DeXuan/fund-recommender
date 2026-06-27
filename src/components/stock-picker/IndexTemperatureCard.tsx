import React from 'react';
import { Card, Tooltip } from 'antd';

interface TemperatureData {
  code: string;
  name: string;
  temperature: number;
  signal: string;
  pe_percentile: number;
  pb_percentile: number;
  suggestion: string;
  color: string;
}

const signalLabels: Record<string, string> = {
  frozen: '极寒', cold: '偏冷', neutral: '适中', warm: '偏热', hot: '极热',
};

const IndexTemperatureCard: React.FC<{ data: TemperatureData; isDark: boolean }> = ({ data, isDark }) => {
  const temp = data.temperature;
  const fillPercent = Math.min(100, Math.max(0, temp));

  const gradientColors = [
    { stop: 0, color: '#1890ff' },
    { stop: 25, color: '#52c41a' },
    { stop: 50, color: '#faad14' },
    { stop: 75, color: '#fa8c16' },
    { stop: 100, color: '#f5222d' },
  ];

  return (
    <Card
      size="small"
      style={{
        background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
        border: `1px solid ${data.color}30`,
        borderRadius: 12,
      }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#fff' : '#262626' }}>{data.name}</div>
          <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : '#8c8c8c', marginTop: 2 }}>
            PE分位: {(data.pe_percentile * 100).toFixed(0)}% | PB分位: {(data.pb_percentile * 100).toFixed(0)}%
          </div>
        </div>
        <div style={{
          fontSize: 28, fontWeight: 800, color: data.color,
          fontFamily: 'DIN Alternate, monospace',
        }}>
          {temp.toFixed(0)}
        </div>
      </div>

      {/* 温度条 */}
      <div style={{
        height: 8, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0',
        overflow: 'hidden', marginBottom: 10,
      }}>
        <div style={{
          width: `${fillPercent}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, #1890ff, #52c41a, #faad14, #fa8c16, #f5222d)`,
          transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tooltip title={data.suggestion}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: data.color,
            padding: '2px 10px', borderRadius: 10,
            background: `${data.color}15`,
          }}>
            {signalLabels[data.signal] || data.signal}
          </span>
        </Tooltip>
        <span style={{
          fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c',
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.suggestion}
        </span>
      </div>
    </Card>
  );
};

export default IndexTemperatureCard;
