import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, Tag, Progress } from 'antd';

interface CorrelationData {
  correlationMatrix: number[][];
  fundCodes: string[];
  fundNames: string[];
  diversificationScore: number;
  highCorrelationPairs: Array<{ a: string; b: string; aName: string; bName: string; correlation: number }>;
  suggestion: string;
}

const CorrelationHeatmap: React.FC<{ data: CorrelationData; isDark: boolean }> = ({ data, isDark }) => {
  const { correlationMatrix, fundNames, diversificationScore, highCorrelationPairs, suggestion } = data;
  const n = fundNames.length;

  // 构建热力图数据
  const heatData: number[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      heatData.push([j, i, correlationMatrix[i][j]]);
    }
  }

  const option = {
    tooltip: {
      formatter: (params: any) => {
        const [x, y, val] = params.data;
        return `${fundNames[y]} vs ${fundNames[x]}<br/>相关系数: <b>${val.toFixed(3)}</b>`;
      },
    },
    grid: { top: 10, right: 80, bottom: 60, left: 120 },
    xAxis: {
      type: 'category',
      data: fundNames.map(n => n.length > 6 ? n.slice(0, 6) + '...' : n),
      axisLabel: { rotate: 45, color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c', fontSize: 11 },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: fundNames.map(n => n.length > 8 ? n.slice(0, 8) + '...' : n),
      axisLabel: { color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c', fontSize: 11 },
      splitArea: { show: true },
    },
    visualMap: {
      min: -1, max: 1, calculable: true, orient: 'vertical', right: 10, top: 'center',
      inRange: { color: ['#1890ff', '#ffffff', '#f5222d'] },
      textStyle: { color: isDark ? 'rgba(255,255,255,0.65)' : '#595959' },
    },
    series: [{
      type: 'heatmap',
      data: heatData,
      label: { show: n <= 8, fontSize: 10, formatter: (p: any) => p.data[2].toFixed(2) },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  };

  const scoreColor = diversificationScore >= 0.6 ? '#52c41a' : diversificationScore >= 0.3 ? '#faad14' : '#f5222d';

  return (
    <Card
      title={<span style={{ color: isDark ? '#fff' : undefined }}>相关性分析 & 分散化评分</span>}
      style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', borderRadius: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.45)' : '#8c8c8c', marginBottom: 4 }}>
            分散化得分
          </div>
          <Progress
            type="dashboard"
            percent={Math.round(diversificationScore * 100)}
            size={80}
            strokeColor={scoreColor}
            format={p => <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>{p}%</span>}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.65)' : '#595959', marginBottom: 8 }}>
            {suggestion}
          </div>
          {highCorrelationPairs.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#f5222d', marginBottom: 4 }}>
                高度相关组合（相关系数 {'>'} 0.8）：
              </div>
              {highCorrelationPairs.map((p, i) => (
                <Tag key={i} color="red" style={{ marginBottom: 4 }}>
                  {p.aName.slice(0, 6)} ↔ {p.bName.slice(0, 6)} ({p.correlation.toFixed(2)})
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReactECharts option={option} style={{ height: Math.max(280, n * 45 + 80) }} />
    </Card>
  );
};

export default CorrelationHeatmap;
