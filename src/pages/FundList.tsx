import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Input, Select, Table, Tag, Button, Space, Spin, AutoComplete, Alert, Row, Col, Tooltip, message } from 'antd';
import { SearchOutlined, SwapOutlined, CloseCircleOutlined, StarOutlined, StarFilled, SyncOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi, watchlistApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';
import { formatReturn, getReturnColor, getValuationText } from '../utils/format';

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

  // 多因子筛选后的基金列表
  const filteredFunds = useMemo(() => {
    let list = goldOnly ? funds.filter(f => f.isGoldSelected) : funds;
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
  }, [funds, goldOnly, selectedManager, filterReturn1y, filterScaleMin, filterScaleMax, filterFeeMax]);

  // 对比功能状态
  const [selectedCodes, setSelectedCodes] = useState<string[]>(initialCodes);
  const [compareData, setCompareData] = useState<Fund[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [compareSearchCode, setCompareSearchCode] = useState('');
  const [allFunds, setAllFunds] = useState<Fund[]>([]);
  const [navHistory, setNavHistory] = useState<Record<string, any[]>>({});
  const [navHistoryLoading, setNavHistoryLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (showCompare && selectedCodes.length > 0) {
      loadCompareData();
      loadNavHistory();
    } else {
      setCompareData([]);
      setCompareError(null);
      setNavHistory({});
    }
  }, [selectedCodes, showCompare]);

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
        pageSize: 500,
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

  const loadCompareData = async () => {
    if (selectedCodes.length === 0) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const data = await fundApi.compareFunds(selectedCodes);
      setCompareData(Array.isArray(data) ? data.filter((f: Fund | null) => f && f.code) : []);
    } catch (error) {
      console.error('加载对比数据失败:', error);
      setCompareData([]);
      setCompareError('加载对比数据失败，请检查基金代码是否正确');
    } finally {
      setCompareLoading(false);
    }
  };

  const loadNavHistory = async () => {
    if (selectedCodes.length === 0) return;
    setNavHistoryLoading(true);
    try {
      const data = await fundApi.compareNavHistory(selectedCodes);
      setNavHistory(data);
    } catch {
      setNavHistory({});
    } finally {
      setNavHistoryLoading(false);
    }
  };

  // 对比功能方法
  const addFundToCompare = useCallback((code?: string) => {
    const fundCode = (code || compareSearchCode).trim();
    if (!fundCode) return;
    if (selectedCodes.includes(fundCode)) return;
    if (selectedCodes.length >= 5) return;
    const exists = allFunds.some(f => f.code === fundCode);
    if (!exists) return;
    setSelectedCodes(prev => [...prev, fundCode]);
    setCompareSearchCode('');
  }, [compareSearchCode, selectedCodes, allFunds]);

  const removeFundFromCompare = useCallback((code: string) => {
    setSelectedCodes(prev => prev.filter(c => c !== code));
  }, []);

  const handleCompareSearchChange = useCallback((value: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setCompareSearchCode(value);
    }, 150);
  }, []);

  const startCompare = useCallback(() => {
    if (selectedCodes.length >= 2) {
      setShowCompare(true);
    }
  }, [selectedCodes]);

  // 搜索选项
  const compareSearchOptions = useMemo(() => {
    const keyword = compareSearchCode.trim();
    if (!keyword || allFunds.length === 0) return [];
    return allFunds
      .filter(f => f.code.includes(keyword) || f.name.includes(keyword))
      .slice(0, 8)
      .map(f => ({
        value: f.code,
        label: `${f.code} - ${f.name} (${f.industry})`,
      }));
  }, [compareSearchCode, allFunds]);

  // 净值走势对比图
  const navChartOption = useMemo(() => {
    const codes = Object.keys(navHistory);
    if (codes.length === 0) return null;
    // Collect all dates
    const allDates = new Set<string>();
    codes.forEach(code => navHistory[code]?.forEach(d => allDates.add(d.date)));
    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length < 2) return null;
    const colors = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'];
    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: any) => {
          let html = `${params[0]?.axisValue}<br/>`;
          params.forEach((p: any) => {
            html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
          });
          return html;
        },
      },
      legend: {
        data: codes.map(c => {
          const fund = compareData.find(f => f.code === c) || allFunds.find(f => f.code === c);
          return fund?.name || c;
        }),
        bottom: 0,
        type: 'scroll' as const,
      },
      grid: { top: 20, right: 20, bottom: 40, left: 60 },
      xAxis: {
        type: 'category' as const,
        data: sortedDates,
        axisLabel: { fontSize: 10, interval: Math.floor(sortedDates.length / 8) },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { formatter: '{value}%', fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed' as const } },
      },
      series: codes.map((code, i) => {
        const fund = compareData.find(f => f.code === code) || allFunds.find(f => f.code === code);
        const dataMap = new Map(navHistory[code]?.map(d => [d.date, d.return_pct]));
        return {
          name: fund?.name || code,
          type: 'line' as const,
          data: sortedDates.map(d => dataMap.get(d) ?? null),
          connectNulls: true,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: colors[i % colors.length] },
          showSymbol: false,
        };
      }),
    };
  }, [navHistory, compareData, allFunds]);

  // 图表配置
  const compareChartOption = useMemo(() => {
    if (compareData.length < 2) return null;
    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: compareData.map(f => f.name) },
      xAxis: {
        type: 'category' as const,
        data: ['近1年', '近6月', '近3月', '近1月', '近1周'],
      },
      yAxis: { type: 'value' as const, axisLabel: { formatter: '{value}%' } },
      series: compareData.map((fund, i) => ({
        name: fund.name,
        type: 'bar' as const,
        data: [fund.return1y ?? 0, fund.return6m ?? 0, fund.return3m ?? 0, fund.return1m ?? 0, fund.return1w ?? 0],
        itemStyle: {
          color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'][i % 5],
        },
      })),
    };
  }, [compareData]);

  // 对比表格数据
  const tableData = useMemo(() => {
    if (compareData.length === 0) return [];
    const safeNum = (f: Fund, key: keyof Fund, decimals = 2) => {
      const v = f[key];
      if (v === undefined || v === null) return '-';
      const n = Number(v);
      return isNaN(n) ? '-' : n.toFixed(decimals);
    };
    const safeStr = (f: Fund, key: keyof Fund) => {
      const v = f[key];
      return v !== undefined && v !== null ? v : '-';
    };
    const entries = (key: string) => Object.fromEntries(compareData.map(f => [f.code, key]));

    return [
      { key: '_group_basic', label: '基本信息', ...entries('_group') },
      { key: 'index', label: '跟踪指数', ...Object.fromEntries(compareData.map(f => [f.code, f.index || '-'])) },
      { key: 'type', label: '基金类型', ...Object.fromEntries(compareData.map(f => [f.code, f.type || '-'])) },
      { key: 'nav', label: '最新净值', ...Object.fromEntries(compareData.map(f => [f.code, f.nav?.toFixed(4) ?? '-'])) },
      { key: 'fundManager', label: '基金经理', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'fundManager')])) },
      { key: 'company', label: '基金公司', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'company')])) },

      { key: '_group_return', label: '收益指标', ...entries('_group') },
      { key: 'return1y', label: '近1年收益', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'return1y')])) },
      { key: 'return6m', label: '近6月收益', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'return6m')])) },
      { key: 'return3m', label: '近3月收益', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'return3m')])) },
      { key: 'return1m', label: '近1月收益', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'return1m')])) },
      { key: 'return1w', label: '近1周收益', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'return1w')])) },

      { key: '_group_fee', label: '费率详情', ...entries('_group') },
      { key: 'managementFee', label: '管理费率/年', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'managementFee')])) },
      { key: 'custodyFee', label: '托管费率/年', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'custodyFee')])) },
      { key: 'serviceFee', label: '销售服务费/年', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'serviceFee')])) },
      { key: 'totalFee', label: '综合费率/年', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'totalFee')])) },
      { key: 'purchaseFee', label: '申购费率(原)', ...Object.fromEntries(compareData.map(f => [f.code, f.purchaseFee ? `${f.purchaseFee}%` : '-'])) },
      { key: 'purchaseFeeDiscount', label: '申购费率(支付宝1折)', ...Object.fromEntries(compareData.map(f => [f.code, f.purchaseFeeDiscount ? `${f.purchaseFeeDiscount}%` : '-'])) },
      { key: 'redeemFee', label: '赎回费率(>=1年)', ...Object.fromEntries(compareData.map(f => [f.code, f.redeemFee?.find(r => r.period.includes('1-2年') || r.period.includes('1年'))?.rate !== undefined ? `${f.redeemFee.find(r => r.period.includes('1-2年') || r.period.includes('1年'))!.rate}%` : '-'])) },

      { key: '_group_holder', label: '规模与持有人', ...entries('_group') },
      { key: 'scale', label: '基金规模(亿)', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'scale', 1)])) },
      { key: 'share', label: '份额(亿份)', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'share')])) },
      { key: 'shareChange', label: '份额变化(%)', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'shareChange')])) },
      { key: 'institutionHold', label: '机构持有(%)', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'institutionHold')])) },
      { key: 'individualHold', label: '个人持有(%)', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'individualHold')])) },

      { key: '_group_purchase', label: '申购与限额', ...entries('_group') },
      { key: 'purchaseStatus', label: '申购状态', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'purchaseStatus')])) },
      { key: 'dailyLimit', label: '每日限额', ...Object.fromEntries(compareData.map(f => [f.code, f.dailyLimit === 0 ? '暂停' : f.dailyLimit ? `${f.dailyLimit}万` : '-'])) },

      { key: '_group_valuation', label: '估值指标', ...entries('_group') },
      { key: 'pe', label: 'PE(TTM)', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'pe')])) },
      { key: 'pb', label: 'PB', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'pb')])) },
      { key: 'pePercentile', label: 'PE历史分位(%)', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'pePercentile')])) },
      { key: 'pbPercentile', label: 'PB历史分位(%)', ...Object.fromEntries(compareData.map(f => [f.code, safeNum(f, 'pbPercentile')])) },
      { key: 'valuation', label: '估值判断', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'valuation')])) },

      { key: '_group_summary', label: '综合评价', ...entries('_group') },
      { key: 'rating', label: '推荐评级', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'rating')])) },
      { key: 'riskLevel', label: '风险等级', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'riskLevel')])) },
      { key: 'suitableFor', label: '适合人群', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'suitableFor')])) },
      { key: 'recommendation', label: '推荐理由', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'recommendation')])) },
      { key: 'investmentAdvice', label: '投资建议', ...Object.fromEntries(compareData.map(f => [f.code, safeStr(f, 'investmentAdvice')])) },

      { key: '_group_holdings', label: '前十大重仓股', ...entries('_group') },
      ...Array.from({ length: 10 }, (_, i) => ({
        key: `holding_${i}`,
        label: `重仓${i + 1}`,
        ...Object.fromEntries(compareData.map(f => [f.code, f.topHoldings?.[i] ? `${f.topHoldings[i].name} (${f.topHoldings[i].percentage}%)` : '-'])),
      })),
    ];
  }, [compareData]);

  // 对比表格列
  const tableColumns = useMemo(() => [
    {
      title: '指标',
      dataIndex: 'label',
      key: 'label',
      width: 160,
      fixed: 'left' as const,
      render: (text: string, record: any) => {
        if (record.key.startsWith('_group')) {
          return <span style={{ fontWeight: 700, fontSize: 14, color: '#1677ff' }}>{text}</span>;
        }
        return <span style={{ fontWeight: 500 }}>{text}</span>;
      },
    },
    ...compareData.map(fund => ({
      title: <Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>{fund.name}<div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{fund.code}</div></Link>,
      dataIndex: fund.code,
      key: fund.code,
      render: (val: any, record: any) => {
        if (record.key.startsWith('_group')) return null;
        if (val === '-' || val === undefined || val === null) return <span style={{ color: '#ccc' }}>-</span>;

        if (['return1y', 'return6m', 'return3m', 'return1m', 'return1w'].includes(record.key)) {
          const num = Number(val);
          return <span style={{ color: getReturnColor(num), fontWeight: 600 }}>{formatReturn(num)}</span>;
        }

        if (record.key === 'valuation') return getValuationText(val);

        if (record.key === 'rating') return <span style={{ color: '#faad14' }}>{'★'.repeat(Number(val) || 0)}</span>;

        if (['managementFee', 'custodyFee', 'serviceFee', 'totalFee'].includes(record.key)) {
          const num = Number(val);
          if (isNaN(num)) return val;
          const isHigh = record.key === 'totalFee' && num > 0.8;
          return <span style={{ fontWeight: isHigh ? 700 : 500, color: isHigh ? '#ff4d4f' : undefined }}>{num.toFixed(2)}%</span>;
        }

        if (['pePercentile', 'pbPercentile'].includes(record.key)) {
          const num = Number(val);
          if (isNaN(num)) return val;
          const color = num < 30 ? '#52c41a' : num > 70 ? '#ff4d4f' : '#1677ff';
          return <span style={{ color, fontWeight: 600 }}>{num.toFixed(1)}%</span>;
        }

        if (record.key === 'purchaseStatus') {
          const statusMap: Record<string, { color: string; text: string }> = {
            open: { color: 'green', text: '开放申购' },
            limited: { color: 'orange', text: '限大额' },
            suspended: { color: 'red', text: '暂停申购' },
          };
          const s = statusMap[val] || { color: 'default', text: val };
          return <Tag color={s.color}>{s.text}</Tag>;
        }

        if (record.key === 'riskLevel') {
          const riskMap: Record<string, { color: string; text: string }> = {
            low: { color: 'green', text: '低风险' },
            medium: { color: 'blue', text: '中风险' },
            high: { color: 'red', text: '高风险' },
          };
          const r = riskMap[val] || { color: 'default', text: val };
          return <Tag color={r.color}>{r.text}</Tag>;
        }

        if (record.key === 'shareChange') {
          const num = Number(val);
          if (isNaN(num)) return val;
          return <span style={{ color: num > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{num > 0 ? '+' : ''}{num}%</span>;
        }

        if (record.key === 'institutionHold') {
          const num = Number(val);
          if (isNaN(num)) return val;
          return <span style={{ fontWeight: num >= 10 ? 700 : 400, color: num >= 10 ? '#faad14' : undefined }}>{num}%</span>;
        }

        if (record.key === 'dailyLimit') {
          return <span style={{ fontWeight: 600, color: val === '暂停' ? '#ff4d4f' : '#333' }}>{val}</span>;
        }

        if (['recommendation', 'investmentAdvice'].includes(record.key)) {
          const text = String(val);
          return <Tooltip title={text}><span style={{ fontSize: 12 }}>{text.length > 30 ? text.slice(0, 30) + '...' : text}</span></Tooltip>;
        }

        return val;
      },
    })),
  ], [compareData]);

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
                : <StarOutlined style={{ color: '#d9d9d9' }} />}
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

      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input.Search
            placeholder="搜索基金名称或代码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
            prefix={<SearchOutlined />}
          />
          <Select
            value={industry}
            onChange={setIndustry}
            style={{ width: 160 }}
            options={industries.map((ind) => ({ label: ind, value: ind }))}
          />
          <Select
            value={selectedManager || undefined}
            onChange={(v) => setSelectedManager(v || '')}
            style={{ width: 180 }}
            placeholder="按基金经理筛选"
            allowClear
            options={managers.map((m) => ({ label: `${m.name} (${m.fundCount}只)`, value: m.name }))}
          />
          <Button
            type={showStarManagers ? 'primary' : 'default'}
            style={showStarManagers ? { background: '#722ed1', borderColor: '#722ed1' } : {}}
            onClick={() => setShowStarManagers(!showStarManagers)}
          >
            {showStarManagers ? '★ 明星经理' : '☆ 明星经理'}
          </Button>
          <Button
            type={goldOnly ? 'primary' : 'default'}
            style={goldOnly ? { background: '#faad14', borderColor: '#faad14' } : {}}
            onClick={() => setGoldOnly(!goldOnly)}
          >
            {goldOnly ? '★ 仅看金选' : '☆ 金选基金'}
          </Button>
          <Button
            type={showGoldStats ? 'primary' : 'default'}
            style={showGoldStats ? { background: '#faad14', borderColor: '#faad14' } : {}}
            onClick={() => setShowGoldStats(!showGoldStats)}
          >
            金选统计
          </Button>
          <Button
            type={showFilters ? 'primary' : 'default'}
            onClick={() => setShowFilters(!showFilters)}
          >
            多因子筛选
          </Button>
          <Tooltip title="从支付宝抓取金选基金数据（经理、净值、收益率）">
            <Button
              icon={<SyncOutlined spin={fetchingGold} />}
              onClick={handleFetchGoldFunds}
              loading={fetchingGold}
              style={{ background: '#faad14', borderColor: '#faad14', color: 'white' }}
            >
              金选数据
            </Button>
          </Tooltip>
          <Tooltip title="从支付宝获取易方达基金的经理、净值等数据">
            <Button
              icon={<SyncOutlined spin={fetchingYfd} />}
              onClick={handleFetchYiFangDa}
              loading={fetchingYfd}
            >
              易方达数据
            </Button>
          </Tooltip>
          {(selectedManager || filterReturn1y || filterScaleMin || filterScaleMax || filterFeeMax) && (
            <Button
              type="link"
              size="small"
              onClick={() => { setSelectedManager(''); setFilterReturn1y(''); setFilterScaleMin(''); setFilterScaleMax(''); setFilterFeeMax(''); }}
            >
              清除筛选
            </Button>
          )}
          {selectedCodes.length >= 2 && !showCompare && (
            <Button type="primary" icon={<SwapOutlined />} onClick={startCompare}>
              开始对比 ({selectedCodes.length}只)
            </Button>
          )}
          {selectedCodes.length > 0 && selectedCodes.length < 2 && (
            <span style={{ color: '#999', fontSize: 13 }}>请至少选择2只基金进行对比</span>
          )}
        </Space>
      </Card>

      {/* 明星基金经理展示 */}
      {showStarManagers && starManagers.length > 0 && (
        <Card
          title={<span style={{ fontWeight: 600 }}>明星基金经理</span>}
          extra={<span style={{ fontSize: 12, color: '#8c8c8c' }}>点击经理筛选其管理的基金</span>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            {starManagers.map((mgr) => (
              <Col xs={24} sm={12} md={8} lg={6} key={mgr.name}>
                <Card
                  size="small"
                  hoverable
                  style={{
                    border: selectedManager === mgr.name ? '2px solid #722ed1' : '1px solid #f0f0f0',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setSelectedManager(selectedManager === mgr.name ? '' : mgr.name)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: 16, marginRight: 12,
                    }}>
                      {mgr.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{mgr.name}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>{mgr.company}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    <strong>职位：</strong>{mgr.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    <strong>经验：</strong>{mgr.experience} | <strong>擅长：</strong>{mgr.specialty}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 8, lineHeight: 1.5 }}>
                    {mgr.bio}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {mgr.tags.map((tag) => (
                      <Tag key={tag} color="purple" style={{ fontSize: 11 }}>{tag}</Tag>
                    ))}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 金选基金统计 */}
      {showGoldStats && goldStats && (
        <Card
          title={
            <Space>
              <span style={{ fontSize: 18, color: '#faad14' }}>★</span>
              <span style={{ fontWeight: 600 }}>金选基金统计概览</span>
            </Space>
          }
          extra={<span style={{ fontSize: 12, color: '#8c8c8c' }}>来自支付宝精选基金池</span>}
          style={{ marginBottom: 16, border: '1px solid #faad14' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <div style={{ textAlign: 'center', padding: 16, background: '#fffbe6', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#faad14' }}>{goldStats.total}</div>
                <div style={{ fontSize: 12, color: '#666' }}>金选基金总数</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ textAlign: 'center', padding: 16, background: '#f6ffed', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>{goldStats.returns?.avg1y || '-'}%</div>
                <div style={{ fontSize: 12, color: '#666' }}>平均近1年收益</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ textAlign: 'center', padding: 16, background: '#e6f4ff', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{goldStats.fees?.avg ? (goldStats.fees.avg * 100).toFixed(2) : '-'}%</div>
                <div style={{ fontSize: 12, color: '#666' }}>平均综合费率</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div style={{ textAlign: 'center', padding: 16, background: '#fff2f0', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>{goldStats.scale?.total || '-'}亿</div>
                <div style={{ fontSize: 12, color: '#666' }}>总规模</div>
              </div>
            </Col>
          </Row>
          {goldStats.categories && goldStats.categories.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>分类分布</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {goldStats.categories.slice(0, 10).map((cat: any) => (
                  <Tag key={cat.name} color="gold">
                    {cat.name}: {cat.count}只
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        {showFilters && (
          <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>筛选条件：</span>
            <div>
              <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>近1年收益 ≥</span>
              <Input
                size="small"
                style={{ width: 80 }}
                placeholder="如 20"
                value={filterReturn1y}
                onChange={e => setFilterReturn1y(e.target.value)}
                suffix="%"
              />
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>规模</span>
              <Input
                size="small"
                style={{ width: 70 }}
                placeholder="最小"
                value={filterScaleMin}
                onChange={e => setFilterScaleMin(e.target.value)}
              />
              <span style={{ margin: '0 4px', color: '#999' }}>-</span>
              <Input
                size="small"
                style={{ width: 70 }}
                placeholder="最大"
                value={filterScaleMax}
                onChange={e => setFilterScaleMax(e.target.value)}
                suffix="亿"
              />
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>综合费率 ≤</span>
              <Input
                size="small"
                style={{ width: 80 }}
                placeholder="如 0.6"
                value={filterFeeMax}
                onChange={e => setFilterFeeMax(e.target.value)}
                suffix="%"
              />
            </div>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              筛选结果 <strong style={{ color: '#1677ff' }}>{filteredFunds.length}</strong> 只
            </span>
          </div>
        )}
        {goldOnly && !showFilters && (
          <div style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
            ★ 金选基金 <span style={{ fontWeight: 600, color: '#faad14' }}>{funds.filter(f => f.isGoldSelected).length}</span> 只
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
      {showCompare && (
        <div style={{ marginTop: 24 }}>
          <Card
            title={
              <Space>
                <SwapOutlined style={{ color: '#1677ff' }} />
                <span style={{ fontWeight: 600, fontSize: 16 }}>基金对比</span>
              </Space>
            }
            extra={
              <Button
                type="text"
                icon={<CloseCircleOutlined />}
                onClick={() => { setShowCompare(false); setSelectedCodes([]); }}
              >
                关闭对比
              </Button>
            }
            style={{ marginBottom: 16 }}
          >
            <Space>
              <AutoComplete
                value={compareSearchCode}
                onChange={handleCompareSearchChange}
                options={compareSearchOptions}
                onSelect={(value) => {
                  setCompareSearchCode('');
                  addFundToCompare(value);
                }}
                style={{ width: 400 }}
                placeholder="输入基金代码或名称搜索添加..."
                allowClear
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => addFundToCompare()}
                disabled={!compareSearchCode.trim() || selectedCodes.length >= 5}
              >
                添加
              </Button>
            </Space>
            <div style={{ marginTop: 12 }}>
              <span style={{ color: '#666', fontSize: 13 }}>已添加 {selectedCodes.length}/5 只基金</span>
              {selectedCodes.length > 0 && (
                <Space size={8} wrap style={{ marginTop: 8 }}>
                  {selectedCodes.map((code) => {
                    const fund = allFunds.find(f => f.code === code);
                    return (
                      <Tag
                        key={code}
                        closable
                        onClose={() => removeFundFromCompare(code)}
                        color="blue"
                      >
                        {fund ? `${fund.name}(${code})` : code}
                      </Tag>
                    );
                  })}
                </Space>
              )}
            </div>
          </Card>

          {compareError && (
            <Alert type="error" message={compareError} style={{ marginBottom: 16 }} closable onClose={() => setCompareError(null)} />
          )}

          {compareLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
          ) : compareData.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              <p style={{ fontSize: 16 }}>请添加基金开始对比</p>
              <p style={{ marginTop: 8, fontSize: 13 }}>支持同时对比最多5只基金</p>
            </Card>
          ) : (
            <>
              {compareChartOption && (
                <Card title="收益对比" style={{ marginBottom: 16 }}>
                  <ReactECharts theme={getEchartsTheme(isDark)} option={compareChartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
                </Card>
              )}

              {navChartOption && (
                <Card
                  title="净值走势对比（近6月）"
                  style={{ marginBottom: 16 }}
                  extra={navHistoryLoading ? <Spin size="small" /> : null}
                >
                  <ReactECharts theme={getEchartsTheme(isDark)} option={navChartOption} style={{ height: 350 }} opts={{ renderer: 'svg' }} />
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#8c8c8c' }}>
                    起点归一化为0%，展示各基金相对收益走势
                  </div>
                </Card>
              )}

              <Card title="对比详情" style={{ marginBottom: 16 }}>
                <div className="compare-table-scroll">
                  <Table
                    dataSource={tableData}
                    columns={tableColumns}
                    pagination={false}
                    size="small"
                    rowKey="key"
                    rowClassName={(record) => record.key.startsWith('_group') ? 'compare-group-row' : ''}
                  />
                </div>

                {compareData.length >= 2 && (() => {
                  const validFunds = compareData.filter(f => f.return1y !== undefined && f.return1y !== null);
                  if (validFunds.length < 2) return null;
                  const bestReturn = validFunds.reduce((best, f) => f.return1y > best.return1y ? f : best);
                  const validFeeFunds = compareData.filter(f => f.totalFee !== undefined && f.totalFee !== null);
                  const bestFee = validFeeFunds.length > 0
                    ? validFeeFunds.reduce((best, f) => (f.totalFee || 999) < (best.totalFee || 999) ? f : best)
                    : null;
                  return (
                    <Alert
                      type="success"
                      message="对比结论"
                      description={
                        <span>
                          收益最高：<strong>{bestReturn.name}</strong>（近1年 {bestReturn.return1y?.toFixed(2)}%）
                          {bestFee && bestReturn.code !== bestFee.code && (
                            <>，费率最低：<strong>{bestFee.name}</strong>（{bestFee.totalFee?.toFixed(2)}%/年）</>
                          )}
                        </span>
                      }
                      style={{ marginTop: 16 }}
                      showIcon
                    />
                  );
                })()}
              </Card>
            </>
          )}

          <Card title="热门对比组合">
            <Row gutter={16}>
              {[
                { label: 'AI + 半导体 + 光伏', codes: ['013349', '008887', '011102'] },
                { label: '纳斯达克 + 沪深300 + 新能源', codes: ['040046', '110020', '012831'] },
                { label: '医药 + 消费 + AI', codes: ['012634', '000248', '013349'] },
                { label: '煤炭三巨头对比', codes: ['008279', '161724', '161032'] },
              ].map((combo) => (
                <Col xs={24} sm={8} key={combo.label}>
                  <Button block onClick={() => setSelectedCodes(combo.codes)} style={{ marginBottom: 8 }}>
                    {combo.label}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </div>
      )}
    </div>
  );
}
