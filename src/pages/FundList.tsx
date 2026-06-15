import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Tooltip, message } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import { fundApi, watchlistApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatReturn, getReturnColor } from '../utils/format';
import { FundListFilters } from '../components/fundlist/FundListFilters';
import { StarManagersPanel } from '../components/fundlist/StarManagersPanel';
import { GoldStatsPanel } from '../components/fundlist/GoldStatsPanel';
import { FundComparePanel } from '../components/fundlist/FundComparePanel';
import { MultiFactorFilterBar } from '../components/fundlist/MultiFactorFilterBar';

interface Fund {
  code: string;
  name: string;
  type: string;
  company: string;
  index: string;
  industry: string;
  nav: number;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  managementFee: number;
  custodyFee: number;
  serviceFee: number;
  totalFee: number;
  scale: number;
  institutionHold: number;
  individualHold: number;
  rating: number;
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  valuation: string;
  dailyLimit?: number;
  purchaseFee?: number;
  purchaseFeeDiscount?: number;
  redeemFee?: { period: string; rate: number }[];
  purchaseStatus?: string;
  riskLevel?: string;
  fundManager?: string;
  share?: string;
  shareChange?: string;
  suitableFor?: string;
  investmentAdvice?: string;
  recommendation?: string;
  topHoldings?: { name: string; percentage: number }[];
  isGoldSelected?: boolean;
  manager?: string;
}

export default function FundList() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [searchParams] = useSearchParams();
  const initialCodes = (searchParams.get('codes')?.split(',') || [])
    .filter(code => /^\d{6}$/.test(code));

  // 基金列表状态
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('全部');
  const [goldOnly, setGoldOnly] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [goldStats, setGoldStats] = useState<any>(null);
  const [showGoldStats, setShowGoldStats] = useState(false);
  const [fetchingGold, setFetchingGold] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);

  // 多因子筛选状态
  const [showFilters, setShowFilters] = useState(false);
  const [filterReturn1y, setFilterReturn1y] = useState<string>('');
  const [filterScaleMin, setFilterScaleMin] = useState<string>('');
  const [filterScaleMax, setFilterScaleMax] = useState<string>('');
  const [filterFeeMax, setFilterFeeMax] = useState<string>('');

  // 基金经理筛选状态
  const [managers, setManagers] = useState<Array<{ name: string; fundCount: number }>>([]);
  const [selectedManager, setSelectedManager] = useState<string>('');

  // 易方达数据刷新状态
  const [fetchingYfd, setFetchingYfd] = useState(false);
  const [showStarManagers, setShowStarManagers] = useState(false);
  const [starManagers, setStarManagers] = useState<Array<{ name: string; company: string; title: string; experience: string; specialty: string; bio: string; tags: string[] }>>([]);

  // 自选基金状态
  const [watchedCodes, setWatchedCodes] = useState<Set<string>>(new Set());

  // 对比功能状态
  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialCodes);
  const [showCompare, setShowCompare] = useState(false);
  const [allFunds, setAllFunds] = useState<Fund[]>([]);

  // 多因子筛选后的基金列表
  const filteredFunds = useMemo(() => {
    let list = goldOnly ? funds.filter(f => f.isGoldSelected) : funds;
    if (watchlistOnly) {
      list = list.filter(f => watchedCodes.has(f.code));
    }
    if (selectedManager) {
      list = list.filter(f => f.manager === selectedManager);
    }
    if (filterReturn1y) {
      const minReturn = parseFloat(filterReturn1y);
      if (!isNaN(minReturn)) list = list.filter(f => (f.return1y ?? 0) >= minReturn);
    }
    if (filterScaleMin) {
      const min = parseFloat(filterScaleMin);
      if (!isNaN(min)) list = list.filter(f => (f.scale ?? 0) >= min);
    }
    if (filterScaleMax) {
      const max = parseFloat(filterScaleMax);
      if (!isNaN(max)) list = list.filter(f => (f.scale ?? 0) <= max);
    }
    if (filterFeeMax) {
      const max = parseFloat(filterFeeMax);
      if (!isNaN(max)) list = list.filter(f => (f.totalFee ?? 0) <= max);
    }
    return list;
  }, [funds, goldOnly, watchlistOnly, watchedCodes, selectedManager, filterReturn1y, filterScaleMin, filterScaleMax, filterFeeMax]);

  useEffect(() => {
    loadIndustries();
    loadAllFunds();
    loadManagers();
    loadGoldStats();
    if (user) loadWatchlist();
  }, [user]);

  useEffect(() => {
    loadFunds();
  }, [industry, search]);

  // 当有初始 codes 时自动加载对比
  useEffect(() => {
    if (initialCodes.length >= 2) {
      setShowCompare(true);
    }
  }, []);

  const loadIndustries = async () => {
    try {
      const data = await fundApi.getIndustries();
      setIndustries(['全部', ...data]);
    } catch (error) {
      console.error('加载行业列表失败:', error);
    }
  };

  const loadManagers = async () => {
    try {
      const [managerList, starList] = await Promise.all([
        fundApi.getManagers(),
        fundApi.getStarManagers(),
      ]);
      setManagers(managerList);
      setStarManagers(starList);
    } catch (error) {
      console.error('加载基金经理列表失败:', error);
    }
  };

  // 加载金选基金统计
  const loadGoldStats = async () => {
    try {
      const stats = await fundApi.getGoldFundStats();
      setGoldStats(stats);
    } catch (error) {
      console.error('加载金选基金统计失败:', error);
    }
  };

  // 从支付宝抓取金选基金数据
  const handleFetchGoldFunds = async () => {
    setFetchingGold(true);
    try {
      const result = await fundApi.fetchGoldFundData();
      message.success(`金选基金数据已更新: 成功${result.success}只, 净值${result.navUpdated}只`);
      if (result.errors?.length > 0) {
        message.warning(`${result.errors.length} 只基金更新失败`);
      }
      loadFunds();
      loadGoldStats();
    } catch {
      message.error('抓取金选基金数据失败，请确认管理员权限');
    } finally {
      setFetchingGold(false);
    }
  };

  // 从支付宝刷新易方达基金数据
  const handleFetchYiFangDa = async () => {
    setFetchingYfd(true);
    try {
      const result = await fundApi.fetchYiFangDaData();
      message.success(`易方达数据已更新: 净值${result.navUpdated}只, 经理${result.detailUpdated}只`);
      if (result.errors?.length > 0) {
        message.warning(`${result.errors.length} 只基金更新失败`);
      }
      loadFunds();
    } catch {
      message.error('获取易方达数据失败，请确认管理员权限');
    } finally {
      setFetchingYfd(false);
    }
  };

  const loadFunds = async () => {
    setLoading(true);
    try {
      const res = await fundApi.getFunds({
        industry: industry !== '全部' ? industry : undefined,
        search: search || undefined,
        pageSize: 2000,
      });
      setFunds(Array.isArray(res) ? res : (res as any).data || []);
    } catch (error) {
      console.error('加载基金列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllFunds = async () => {
    try {
      const res = await fundApi.getFunds();
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setAllFunds(list);
    } catch (error) {
      console.error('加载基金列表失败:', error);
      setAllFunds([]);
    }
  };

  const loadWatchlist = async () => {
    try {
      const data = await watchlistApi.getList();
      setWatchedCodes(new Set(data.map((d: any) => d.fund_code)));
    } catch { /* ignore */ }
  };

  const toggleWatch = async (fund: Fund) => {
    if (!user) { message.warning('请先登录'); return; }
    const isWatched = watchedCodes.has(fund.code);
    try {
      if (isWatched) {
        await watchlistApi.remove(fund.code);
        setWatchedCodes(prev => { const s = new Set(prev); s.delete(fund.code); return s; });
        message.success('已移除自选');
      } else {
        await watchlistApi.add(fund.code, fund.name);
        setWatchedCodes(prev => new Set(prev).add(fund.code));
        message.success('已添加自选');
      }
    } catch {
      message.error('操作失败');
    }
  };

  const handleStartCompare = useCallback(() => {
    if (selectedCodes.length >= 2) {
      setShowCompare(true);
    }
  }, [selectedCodes]);

  const handleClearFilters = useCallback(() => {
    setSelectedManager('');
    setFilterReturn1y('');
    setFilterScaleMin('');
    setFilterScaleMax('');
    setFilterFeeMax('');
  }, []);

  const hasActiveFilters = !!(selectedManager || filterReturn1y || filterScaleMin || filterScaleMax || filterFeeMax);

  const renderReturn = (val: number) => (
    <span style={{ color: getReturnColor(val), fontWeight: 600 }}>
      {formatReturn(val)}
    </span>
  );

  const columns = [
    {
      title: '基金代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string) => <Link to={`/funds/${code}`} style={{ color: '#1677ff' }}>{code}</Link>,
    },
    {
      title: '基金名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Fund) => (
        <Space>
          {user && (
            <span
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatch(record); }}
              style={{ cursor: 'pointer', fontSize: 15 }}
            >
              {watchedCodes.has(record.code)
                ? <StarFilled style={{ color: '#faad14' }} />
                : <StarOutlined style={{ color: isDark ? '#444' : '#d9d9d9' }} />}
            </span>
          )}
          <Link to={`/funds/${record.code}`} style={{ color: '#1677ff', fontWeight: 500 }}>{name}</Link>
          {record.isGoldSelected && <Tag color="gold" style={{ fontSize: 11 }}>金选</Tag>}
        </Space>
      ),
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 100,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '基金经理',
      dataIndex: 'manager',
      key: 'manager',
      width: 100,
      render: (manager: string) => manager ? (
        <span
          style={{ color: '#722ed1', cursor: 'pointer', fontWeight: 500 }}
          onClick={(e) => { e.stopPropagation(); setSelectedManager(manager); }}
        >
          {manager}
        </span>
      ) : '-',
    },
    {
      title: '最新净值',
      dataIndex: 'nav',
      key: 'nav',
      width: 100,
      render: (nav: number) => nav?.toFixed(4) || '-',
    },
    {
      title: '近1年',
      dataIndex: 'return1y',
      key: 'return1y',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return1y - b.return1y,
      render: renderReturn,
    },
    {
      title: '近6月',
      dataIndex: 'return6m',
      key: 'return6m',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return6m - b.return6m,
      render: renderReturn,
    },
    {
      title: '近3月',
      dataIndex: 'return3m',
      key: 'return3m',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return3m - b.return3m,
      render: renderReturn,
    },
    {
      title: '近1月',
      dataIndex: 'return1m',
      key: 'return1m',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return1m - b.return1m,
      defaultSortOrder: 'descend' as const,
      render: renderReturn,
    },
    {
      title: '规模(亿)',
      dataIndex: 'scale',
      key: 'scale',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.scale - b.scale,
      render: (val: number) => val?.toFixed(2) || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Fund) => (
        <Link to={`/funds/${record.code}`}>
          <Button type="link" size="small">详情</Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>基金列表</h1>

      <FundListFilters
        search={search}
        onSearchChange={setSearch}
        industry={industry}
        onIndustryChange={setIndustry}
        industries={industries}
        selectedManager={selectedManager}
        onSelectedManagerChange={setSelectedManager}
        managers={managers}
        showStarManagers={showStarManagers}
        onToggleStarManagers={() => setShowStarManagers(!showStarManagers)}
        goldOnly={goldOnly}
        onToggleGoldOnly={() => setGoldOnly(!goldOnly)}
        user={user}
        watchlistOnly={watchlistOnly}
        onToggleWatchlistOnly={() => setWatchlistOnly(!watchlistOnly)}
        showGoldStats={showGoldStats}
        onToggleGoldStats={() => setShowGoldStats(!showGoldStats)}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        fetchingGold={fetchingGold}
        onFetchGold={handleFetchGoldFunds}
        fetchingYfd={fetchingYfd}
        onFetchYfd={handleFetchYiFangDa}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        selectedCodes={selectedCodes}
        showCompare={showCompare}
        onStartCompare={handleStartCompare}
      />

      {/* 明星基金经理展示 */}
      <StarManagersPanel
        visible={showStarManagers}
        isDark={isDark}
        starManagers={starManagers}
        selectedManager={selectedManager}
        onSelectManager={setSelectedManager}
      />

      {/* 金选基金统计 */}
      <GoldStatsPanel
        visible={showGoldStats}
        isDark={isDark}
        goldStats={goldStats}
      />

      <Card>
        <MultiFactorFilterBar
          visible={showFilters}
          isDark={isDark}
          filterReturn1y={filterReturn1y}
          onFilterReturn1yChange={setFilterReturn1y}
          filterScaleMin={filterScaleMin}
          onFilterScaleMinChange={setFilterScaleMin}
          filterScaleMax={filterScaleMax}
          onFilterScaleMaxChange={setFilterScaleMax}
          filterFeeMax={filterFeeMax}
          onFilterFeeMaxChange={setFilterFeeMax}
          filteredCount={filteredFunds.length}
        />
        {goldOnly && !showFilters && (
          <div style={{ marginBottom: 12, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
            ★ 金选基金 <span style={{ fontWeight: 600, color: '#faad14' }}>{funds.filter(f => f.isGoldSelected).length}</span> 只
            （共 {funds.length} 只基金）
          </div>
        )}
        {watchlistOnly && !showFilters && (
          <div style={{ marginBottom: 12, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
            ★ 自选基金 <span style={{ fontWeight: 600, color: '#faad14' }}>{funds.filter(f => watchedCodes.has(f.code)).length}</span> 只
            （共 {funds.length} 只基金）
          </div>
        )}
        <Table
          columns={columns}
          dataSource={filteredFunds}
          rowKey="code"
          loading={loading}
          size="middle"
          scroll={{ x: 1000 }}
          rowSelection={{
            selectedRowKeys: selectedCodes,
            onChange: (keys) => setSelectedCodes(keys as string[]),
            getCheckboxProps: (record: Fund) => ({
              disabled: !selectedCodes.includes(record.code) && selectedCodes.length >= 5,
            }),
          }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (total) => `共 ${total} 只基金` }}
        />
      </Card>

      {/* 对比区域 */}
      <FundComparePanel
        selectedCodes={selectedCodes}
        setSelectedCodes={setSelectedCodes}
        showCompare={showCompare}
        setShowCompare={setShowCompare}
        allFunds={allFunds}
        isDark={isDark}
      />
    </div>
  );
}
