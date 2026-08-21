import React, { useState } from 'react';
import { Slider, Card, Button, Tooltip } from 'antd';
import { CrownOutlined, LockOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';

const factorLabels: Record<string, { label: string; desc: string; color: string }> = {
  return1y: { label: '收益因子', desc: '近1年收益率，越高越好', color: '#52c41a' },
  fee: { label: '费率因子', desc: '综合费率，越低越好', color: '#1890ff' },
  scale: { label: '规模因子', desc: '基金规模，越大越稳', color: '#722ed1' },
  momentum: { label: '动量因子', desc: '近期涨幅趋势', color: '#fa8c16' },
  valuation: { label: '估值因子', desc: '低估加分，高估减分', color: '#f5222d' },
};

const CustomFactorPanel: React.FC<{
  isSVIP: boolean;
  isDark: boolean;
  onApply: (factors: Record<string, { weight: number }>) => void;
  onUpgrade: () => void;
}> = ({ isSVIP, isDark, onApply, onUpgrade }) => {
  const [weights, setWeights] = useState<Record<string, number>>({
    return1y: 30, fee: 15, scale: 15, momentum: 20, valuation: 20,
  });

  const total = Object.values(weights).reduce((s, v) => s + v, 0);

  const handleChange = (key: string, val: number) => {
    setWeights(prev => ({ ...prev, [key]: val }));
  };

  // 归一化到1.0
  const normalizedFactors: Record<string, { weight: number }> = {};
  Object.entries(weights).forEach(([k, v]) => {
    normalizedFactors[k] = { weight: total > 0 ? v / total : 0.2 };
  });

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'],
      data: Object.entries(weights).map(([k, v]) => ({
        name: factorLabels[k]?.label || k,
        value: v,
        itemStyle: { color: factorLabels[k]?.color },
      })),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
    }],
  };

  if (!isSVIP) {
    return (
      <Card
        size="small"
        style={{
          background: isDark ? 'rgba(250,173,20,0.06)' : 'linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%)',
          border: `1px solid ${isDark ? 'rgba(250,173,20,0.15)' : '#ffe58f'}`,
          borderRadius: 12, textAlign: 'center', padding: '20px 0',
        }}
      >
        <LockOutlined style={{ fontSize: 28, color: '#faad14', marginBottom: 8 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#faad14' : '#ad6800', marginBottom: 4 }}>
          自定义因子权重 - SVIP专属
        </div>
        <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c', marginBottom: 12 }}>
          自由调整5大因子权重，打造个性化选股模型
        </div>
        <Button
          type="primary"
          icon={<CrownOutlined />}
          onClick={onUpgrade}
          style={{ background: 'linear-gradient(135deg, #faad14, #fa8c16)', border: 'none' }}
        >
          开通SVIP
        </Button>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={<span style={{ color: isDark ? '#fff' : undefined, fontSize: 14 }}>自定义因子权重</span>}
      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderRadius: 12 }}
      extra={
        <Button type="primary" size="small" onClick={() => onApply(normalizedFactors)}>
          应用权重
        </Button>
      }
    >
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          {Object.entries(factorLabels).map(([key, config]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Tooltip title={config.desc}>
                  <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.65)' : '#595959' }}>
                    {config.label}
                  </span>
                </Tooltip>
                <span style={{ fontSize: 12, fontWeight: 600, color: config.color }}>
                  {total > 0 ? ((weights[key] / total) * 100).toFixed(0) : 20}%
                </span>
              </div>
              <Slider
                min={0} max={50} value={weights[key]}
                onChange={v => handleChange(key, v)}
                trackStyle={{ background: config.color }}
                handleStyle={{ borderColor: config.color }}
                styles={{ rail: { background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0' } }}
              />
            </div>
          ))}
        </div>
        <div style={{ width: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ReactECharts option={pieOption} style={{ width: 120, height: 120 }} />
        </div>
      </div>
    </Card>
  );
};

export default CustomFactorPanel;
