import { Input } from 'antd';

interface MultiFactorFilterBarProps {
  visible: boolean;
  isDark: boolean;
  filterReturn1y: string;
  onFilterReturn1yChange: (v: string) => void;
  filterScaleMin: string;
  onFilterScaleMinChange: (v: string) => void;
  filterScaleMax: string;
  onFilterScaleMaxChange: (v: string) => void;
  filterFeeMax: string;
  onFilterFeeMaxChange: (v: string) => void;
  filteredCount: number;
}

export function MultiFactorFilterBar({
  visible, isDark,
  filterReturn1y, onFilterReturn1yChange,
  filterScaleMin, onFilterScaleMinChange,
  filterScaleMax, onFilterScaleMaxChange,
  filterFeeMax, onFilterFeeMaxChange,
  filteredCount,
}: MultiFactorFilterBarProps) {
  if (!visible) return null;

  return (
    <div style={{ marginBottom: 16, padding: '12px 16px', background: isDark ? '#1f1f1f' : '#f5f5f5', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
      <span style={{ fontWeight: 600, fontSize: 13, color: isDark ? '#e8e8e8' : '#333' }}>筛选条件：</span>
      <div>
        <span style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginRight: 4 }}>近1年收益 ≥</span>
        <Input
          size="small"
          style={{ width: 80 }}
          placeholder="如 20"
          value={filterReturn1y}
          onChange={e => onFilterReturn1yChange(e.target.value)}
          suffix="%"
        />
      </div>
      <div>
        <span style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginRight: 4 }}>规模</span>
        <Input
          size="small"
          style={{ width: 70 }}
          placeholder="最小"
          value={filterScaleMin}
          onChange={e => onFilterScaleMinChange(e.target.value)}
        />
        <span style={{ margin: '0 4px', color: isDark ? '#6b6b6b' : '#999' }}>-</span>
        <Input
          size="small"
          style={{ width: 70 }}
          placeholder="最大"
          value={filterScaleMax}
          onChange={e => onFilterScaleMaxChange(e.target.value)}
          suffix="亿"
        />
      </div>
      <div>
        <span style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginRight: 4 }}>综合费率 ≤</span>
        <Input
          size="small"
          style={{ width: 80 }}
          placeholder="如 0.6"
          value={filterFeeMax}
          onChange={e => onFilterFeeMaxChange(e.target.value)}
          suffix="%"
        />
      </div>
      <span style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c' }}>
        筛选结果 <strong style={{ color: '#1677ff' }}>{filteredCount}</strong> 只
      </span>
    </div>
  );
}
