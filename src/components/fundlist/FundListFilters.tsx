import { Card, Input, Select, Button, Space, Tooltip } from 'antd';
import { SearchOutlined, SwapOutlined, SyncOutlined } from '@ant-design/icons';

interface FundListFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  industry: string;
  onIndustryChange: (v: string) => void;
  industries: string[];
  selectedManager: string;
  onSelectedManagerChange: (v: string) => void;
  managers: Array<{ name: string; fundCount: number }>;
  showStarManagers: boolean;
  onToggleStarManagers: () => void;
  goldOnly: boolean;
  onToggleGoldOnly: () => void;
  user: any;
  watchlistOnly: boolean;
  onToggleWatchlistOnly: () => void;
  showGoldStats: boolean;
  onToggleGoldStats: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  fetchingGold: boolean;
  onFetchGold: () => void;
  fetchingYfd: boolean;
  onFetchYfd: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  selectedCodes: string[];
  showCompare: boolean;
  onStartCompare: () => void;
}

export function FundListFilters({
  search, onSearchChange,
  industry, onIndustryChange, industries,
  selectedManager, onSelectedManagerChange, managers,
  showStarManagers, onToggleStarManagers,
  goldOnly, onToggleGoldOnly,
  user,
  watchlistOnly, onToggleWatchlistOnly,
  showGoldStats, onToggleGoldStats,
  showFilters, onToggleFilters,
  fetchingGold, onFetchGold,
  fetchingYfd, onFetchYfd,
  hasActiveFilters, onClearFilters,
  selectedCodes, showCompare, onStartCompare,
}: FundListFiltersProps) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Space size={16} wrap>
        <Input.Search
          placeholder="搜索基金名称或代码..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 300 }}
          allowClear
          prefix={<SearchOutlined />}
        />
        <Select
          value={industry}
          onChange={onIndustryChange}
          style={{ width: 160 }}
          options={industries.map((ind) => ({ label: ind, value: ind }))}
        />
        <Select
          value={selectedManager || undefined}
          onChange={(v) => onSelectedManagerChange(v || '')}
          style={{ width: 180 }}
          placeholder="按基金经理筛选"
          allowClear
          options={managers.map((m) => ({ label: `${m.name} (${m.fundCount}只)`, value: m.name }))}
        />
        <Button
          type={showStarManagers ? 'primary' : 'default'}
          style={showStarManagers ? { background: '#722ed1', borderColor: '#722ed1' } : {}}
          onClick={onToggleStarManagers}
        >
          {showStarManagers ? '★ 明星经理' : '☆ 明星经理'}
        </Button>
        <Button
          type={goldOnly ? 'primary' : 'default'}
          style={goldOnly ? { background: '#faad14', borderColor: '#faad14' } : {}}
          onClick={onToggleGoldOnly}
        >
          {goldOnly ? '★ 仅看金选' : '☆ 金选基金'}
        </Button>
        {user && (
          <Button
            type={watchlistOnly ? 'primary' : 'default'}
            style={watchlistOnly ? { background: '#faad14', borderColor: '#faad14' } : {}}
            onClick={onToggleWatchlistOnly}
          >
            {watchlistOnly ? '★ 仅看自选' : '☆ 自选基金'}
          </Button>
        )}
        <Button
          type={showGoldStats ? 'primary' : 'default'}
          style={showGoldStats ? { background: '#faad14', borderColor: '#faad14' } : {}}
          onClick={onToggleGoldStats}
        >
          金选统计
        </Button>
        <Button
          type={showFilters ? 'primary' : 'default'}
          onClick={onToggleFilters}
        >
          多因子筛选
        </Button>
        <Tooltip title="从支付宝抓取金选基金数据（经理、净值、收益率）">
          <Button
            icon={<SyncOutlined spin={fetchingGold} />}
            onClick={onFetchGold}
            loading={fetchingGold}
            style={{ background: '#faad14', borderColor: '#faad14', color: 'white' }}
          >
            金选数据
          </Button>
        </Tooltip>
        <Tooltip title="从支付宝获取易方达基金的经理、净值等数据">
          <Button
            icon={<SyncOutlined spin={fetchingYfd} />}
            onClick={onFetchYfd}
            loading={fetchingYfd}
          >
            易方达数据
          </Button>
        </Tooltip>
        {hasActiveFilters && (
          <Button
            type="link"
            size="small"
            onClick={onClearFilters}
          >
            清除筛选
          </Button>
        )}
        {selectedCodes.length >= 2 && !showCompare && (
          <Button type="primary" icon={<SwapOutlined />} onClick={onStartCompare}>
            开始对比 ({selectedCodes.length}只)
          </Button>
        )}
        {selectedCodes.length > 0 && selectedCodes.length < 2 && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>请至少选择2只基金进行对比</span>
        )}
      </Space>
    </Card>
  );
}
