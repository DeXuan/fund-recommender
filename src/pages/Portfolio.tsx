import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, DatePicker, message,
  Popconfirm, Space, Statistic, Row, Col, Upload, Tag, Empty, Spin, Select, Badge, Tooltip,
  Tabs, Steps, Radio, Progress, Alert, Segmented, Grid,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, ArrowUpOutlined, ArrowDownOutlined, FundOutlined,
  ScheduleOutlined, SyncOutlined, CheckCircleOutlined, PauseCircleOutlined,
  LinkOutlined, SafetyOutlined, CalculatorOutlined, CrownOutlined,
  SwapOutlined, LineChartOutlined, TrophyOutlined, ExperimentOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { portfolioApi, fundApi } from '../services/api';
import type { PortfolioHolding, PortfolioSummary, FundRecord } from '../types';
import { ProBadge } from '../components/stock-picker';
import ReturnsMap from '../components/ReturnsMap';
import VIPInsights from '../components/VIPInsights';
import { SellModal } from '../components/portfolio/SellModal';
import { TransactionHistoryTab } from '../components/portfolio/TransactionHistoryTab';
import { DeepAnalysisTab } from '../components/portfolio/DeepAnalysisTab';
import { GoalPlanningTab } from '../components/portfolio/GoalPlanningTab';
import { SmartDCATab } from '../components/portfolio/SmartDCATab';
import { HoldingsDiagnosis } from '../components/portfolio/HoldingsDiagnosis';
import { TransactionBehaviorAnalysis } from '../components/portfolio/TransactionBehaviorAnalysis';
import { AssetAccountsPanel } from '../components/portfolio/AssetAccountsPanel';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getEchartsTheme } from '../utils/echarts-theme';
import { formatCurrency } from '../utils/format';

export default function Portfolio() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const isVIP = user?.subscription_status === 'premium' || user?.subscription_tier === 'premium' || user?.subscription_tier === 'svip' || user?.role === 'admin';
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FundRecord | null>(null);
  const [form] = Form.useForm();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [productType, setProductType] = useState<'fund' | 'cmb'>('fund');
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab 状态管理
  const [activeTab, setActiveTab] = useState('portfolio');

  // 净值刷新状态
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 定投计划状态
  const [dcaPlans, setDcaPlans] = useState<any[]>([]);
  const [dcaModalOpen, setDcaModalOpen] = useState(false);
  const [editingDca, setEditingDca] = useState<any | null>(null);
  const [dcaForm] = Form.useForm();
  const [syncing, setSyncing] = useState(false);

  // 基准对比数据
  const [benchmarkData, setBenchmarkData] = useState<any[]>([]);
  const [portfolioDailyReturns, setPortfolioDailyReturns] = useState<any[]>([]);

  // 风险评估状态
  const [riskStep, setRiskStep] = useState(0);
  const [riskProfile, setRiskProfile] = useState({
    age: '', investmentAmount: '', investmentPeriod: '', riskTolerance: 'balanced' as 'conservative' | 'balanced' | 'aggressive', lossTolerance: '',
  });
  const [riskRecommendation, setRiskRecommendation] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  // 定投计算器状态
  const [dcaFrequency, setDcaFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [dcaAmount, setDcaAmount] = useState(1000);
  const [dcaPeriod, setDcaPeriod] = useState(36);
  const [dcaExpectedReturn, setDcaExpectedReturn] = useState(10);
  const [dcaResult, setDcaResult] = useState<any>(null);

  // 卖出弹窗状态
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellTarget, setSellTarget] = useState<PortfolioHolding | null>(null);
  const [sellForm] = Form.useForm();
  const [sellLoading, setSellLoading] = useState(false);

  // 交易历史状态
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txStats, setTxStats] = useState<any>({});
  const [txFilter, setTxFilter] = useState('all');
  const [txLoading, setTxLoading] = useState(false);

  // 深度分析状态
  const [industryData, setIndustryData] = useState<any>(null);
  const [industryLoading, setIndustryLoading] = useState(false);
  const [feeData, setFeeData] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [holdingsRisk, setHoldingsRisk] = useState<any[]>([]);
  const [holdingsRiskLoading, setHoldingsRiskLoading] = useState(false);
  const [attributionData, setAttributionData] = useState<any>(null);
  const [attributionLoading, setAttributionLoading] = useState(false);
  const [overlapData, setOverlapData] = useState<any>(null);
  const [overlapLoading, setOverlapLoading] = useState(false);

  const handleFundCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value.trim();
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    if (productType === 'cmb') {
      // 招行理财产品代码：输入后自动查询产品名称
      if (code.length >= 4) {
        lookupTimerRef.current = setTimeout(async () => {
          setLookupLoading(true);
          try {
            const product = await fundApi.lookupCMBProduct(code);
            form.setFieldsValue({ fund_name: product.product_name });
          } catch {
            // product not found, leave name empty for manual input
          } finally {
            setLookupLoading(false);
          }
        }, 300);
      }
    } else {
      // 基金代码：6位数字自动查询
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        lookupTimerRef.current = setTimeout(async () => {
          setLookupLoading(true);
          try {
            const fund = await fundApi.getFundDetail(code);
            form.setFieldsValue({ fund_name: fund.name });
          } catch {
            // fund not found, leave name empty for manual input
          } finally {
            setLookupLoading(false);
          }
        }, 300);
      }
    }
  }, [form, productType]);

  const loadData = useCallback(async () => {
    try {
      const [data, plans, benchmark, returnsMapData] = await Promise.all([
        portfolioApi.getSummary(),
        portfolioApi.getDcaPlans().catch(() => []),
        fundApi.getHS300Benchmark().catch(() => []),
        portfolioApi.getReturnsMap(new Date().getFullYear()).catch(() => null),
      ]);
      setSummary(data);
      setDcaPlans(plans);
      setBenchmarkData(benchmark);
      setPortfolioDailyReturns(returnsMapData?.data || []);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 使用ref确保setInterval始终调用最新的loadData
  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => { loadDataRef.current(); loadTransactions(); }, []);

  // 手动刷新净值
  const handleRefreshNav = async () => {
    setRefreshing(true);
    try {
      const result = await portfolioApi.refreshNav();
      if (result.updated > 0) {
        message.success(`净值已更新: ${result.message}`);
      } else {
        message.info(result.message || '暂无需要更新的记录');
      }
      if (result.warnings?.length > 0) {
        message.warning(`${result.warnings.length} 条校验警告，请检查控制台`);
      }
      setLastRefreshTime(new Date().toLocaleTimeString('zh-CN'));
      loadData();
    } catch {
      message.error('刷新净值失败');
    } finally {
      setRefreshing(false);
    }
  };

  // 自动刷新: 每5分钟刷新一次持仓数据
  useEffect(() => {
    autoRefreshTimerRef.current = setInterval(() => {
      loadDataRef.current();
    }, 5 * 60 * 1000);
    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, []);

  const handleAdd = () => {
    setEditingRecord(null);
    setProductType('fund');
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: FundRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      buy_date: dayjs(record.buy_date),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await portfolioApi.deleteRecord(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        buy_date: values.buy_date.format('YYYY-MM-DD'),
      };

      if (editingRecord) {
        await portfolioApi.updateRecord(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await portfolioApi.addRecord(payload);
        message.success('添加成功');
      }
      setModalOpen(false);
      loadData();
    } catch {
      // validation error
    }
  };

  // 定投计划操作
  const handleAddDca = () => {
    setEditingDca(null);
    dcaForm.resetFields();
    setDcaModalOpen(true);
  };

  const handleEditDca = (plan: any) => {
    setEditingDca(plan);
    dcaForm.setFieldsValue({
      ...plan,
      start_date: dayjs(plan.start_date),
      end_date: plan.end_date ? dayjs(plan.end_date) : undefined,
    });
    setDcaModalOpen(true);
  };

  const handleDeleteDca = async (id: number) => {
    try {
      await portfolioApi.deleteDcaPlan(id);
      message.success('删除定投计划成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmitDca = async () => {
    try {
      const values = await dcaForm.validateFields();
      const payload = {
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : '',
      };

      if (editingDca) {
        await portfolioApi.updateDcaPlan(editingDca.id, payload);
        message.success('更新成功');
      } else {
        await portfolioApi.addDcaPlan(payload);
        message.success('定投计划创建成功');
      }
      setDcaModalOpen(false);
      loadData();
    } catch {
      // validation error
    }
  };

  const handleSyncDca = async () => {
    setSyncing(true);
    try {
      const result = await portfolioApi.syncDcaPlans();
      if (result.synced > 0) {
        message.success(result.message);
        loadData();
      } else {
        message.info(result.message);
      }
    } catch {
      message.error('同步定投失败');
    } finally {
      setSyncing(false);
    }
  };

  const frequencyLabel = (f: string) => ({
    weekly: '每周', biweekly: '每两周', monthly: '每月', quarterly: '每季度',
  }[f] || f);

  // 风险评估相关函数
  const handleRiskSubmit = async () => {
    setRiskLoading(true);
    try {
      const data = await fundApi.getRiskProfile(riskProfile);
      setRiskRecommendation(data);
      setRiskStep(4);
      // 持久化到数据库（如果用户已登录）
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await portfolioApi.saveRiskProfile({
            ...riskProfile,
            score: data.score || 0,
            riskType: data.type,
            riskLevel: data.riskLevel,
            expectedReturn: data.expectedReturn,
            allocation: data.allocation,
          });
        } catch { /* 非登录用户忽略 */ }
      }
    } catch (error) {
      console.error('风险评估失败:', error);
      message.error('风险评估失败，请重试');
    } finally {
      setRiskLoading(false);
    }
  };

  const canNextRisk = () => {
    if (riskStep === 0) return !!riskProfile.age;
    if (riskStep === 1) return !!riskProfile.investmentAmount;
    if (riskStep === 2) return !!riskProfile.investmentPeriod;
    if (riskStep === 3) return !!riskProfile.riskTolerance && !!riskProfile.lossTolerance;
    return false;
  };

  // 定投计算器相关函数
  const DCA_FREQ_CONFIG: Record<string, { label: string; amountLabel: string; periodLabel: string; periodsPerYear: number; defaultAmount: number }> = {
    daily:   { label: '每日',  amountLabel: '每日定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 252, defaultAmount: 100 },
    weekly:  { label: '每周',  amountLabel: '每周定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 52,  defaultAmount: 500 },
    monthly: { label: '每月',  amountLabel: '每月定投金额（元）',  periodLabel: '定投期限（月）', periodsPerYear: 12,  defaultAmount: 1000 },
  };

  const TRADING_DAYS_PER_MONTH = 22;
  const WEEKS_PER_MONTH = 4.33;

  const handleDcaFrequencyChange = (val: string) => {
    setDcaFrequency(val as any);
    setDcaAmount(DCA_FREQ_CONFIG[val].defaultAmount);
    setDcaResult(null);
  };

  const handleDcaCalculate = () => {
    const cfg = DCA_FREQ_CONFIG[dcaFrequency];
    const periodRate = dcaExpectedReturn / 100 / cfg.periodsPerYear;

    let totalPeriods: number;
    if (dcaFrequency === 'daily') totalPeriods = Math.round(dcaPeriod * TRADING_DAYS_PER_MONTH);
    else if (dcaFrequency === 'weekly') totalPeriods = Math.round(dcaPeriod * WEEKS_PER_MONTH);
    else totalPeriods = dcaPeriod;

    let totalValue = 0;
    const details: any[] = [];

    for (let i = 0; i < totalPeriods; i++) {
      totalValue = (totalValue + dcaAmount) * (1 + periodRate);
      const cumulativeInvestment = dcaAmount * (i + 1);
      details.push({
        index: i + 1,
        investment: dcaAmount,
        cumulativeInvestment,
        value: parseFloat(totalValue.toFixed(2)),
        returnRate: parseFloat((((totalValue - cumulativeInvestment) / cumulativeInvestment) * 100).toFixed(2)),
      });
    }

    const totalInvestment = dcaAmount * totalPeriods;
    const totalReturn = totalInvestment > 0 ? ((totalValue - totalInvestment) / totalInvestment) * 100 : 0;
    const years = dcaPeriod / 12;
    const annualizedReturn = years > 0 ? (Math.pow(totalValue / totalInvestment, 1 / years) - 1) * 100 : 0;

    setDcaResult({
      totalInvestment,
      totalValue: parseFloat(totalValue.toFixed(2)),
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      details,
      totalPeriods,
    });
  };

  // 卖出操作
  const handleSell = (holding: PortfolioHolding) => {
    setSellTarget(holding);
    sellForm.resetFields();
    sellForm.setFieldsValue({
      sell_price: holding.current_nav || undefined,
      sell_date: undefined,
      sell_fee: 0,
      notes: '',
    });
    setSellModalOpen(true);
  };

  const handleSellSubmit = async () => {
    if (!sellTarget) return;
    try {
      const values = await sellForm.validateFields();
      setSellLoading(true);
      const result = await portfolioApi.sell({
        fund_code: sellTarget.fund_code,
        shares: values.shares,
        sell_price: values.sell_price,
        sell_date: values.sell_date.format('YYYY-MM-DD'),
        sell_fee: values.sell_fee || 0,
        notes: values.notes || '',
      });
      message.success(`赎回成功！实现盈亏 ¥${result.summary.realizedPnl}`);
      setSellModalOpen(false);
      loadData();
      loadTransactions();
    } catch (err: any) {
      message.error(err.message || '卖出失败');
    } finally {
      setSellLoading(false);
    }
  };

  // 交易历史
  const loadTransactions = useCallback(async (page = 1, filter = txFilter) => {
    setTxLoading(true);
    try {
      const params: any = { page, pageSize: 20 };
      if (filter !== 'all') params.type = filter;
      const data = await portfolioApi.getTransactions(params);
      setTransactions(data.transactions || []);
      setTxTotal(data.total || 0);
      setTxPage(data.page || 1);
      setTxStats(data.stats || {});
    } catch {
      // silently fail
    } finally {
      setTxLoading(false);
    }
  }, [txFilter]);

  const handleTxFilterChange = (v: string) => {
    setTxFilter(v);
    loadTransactions(1, v);
  };

  // 深度分析数据加载
  const loadIndustryData = useCallback(async () => {
    setIndustryLoading(true);
    try {
      const data = await portfolioApi.getIndustryAllocation();
      setIndustryData(data);
    } catch { /* silently */ } finally { setIndustryLoading(false); }
  }, []);

  const loadFeeData = useCallback(async () => {
    setFeeLoading(true);
    try {
      const data = await portfolioApi.getFeeAnalysis();
      setFeeData(data);
    } catch { /* silently */ } finally { setFeeLoading(false); }
  }, []);

  const loadHoldingsRisk = useCallback(async () => {
    setHoldingsRiskLoading(true);
    try {
      const data = await portfolioApi.getHoldingsRisk();
      setHoldingsRisk(data.holdings || []);
    } catch { /* silently */ } finally { setHoldingsRiskLoading(false); }
  }, []);

  const loadAttributionData = useCallback(async () => {
    setAttributionLoading(true);
    try {
      const data = await portfolioApi.getPerformanceAttribution();
      setAttributionData(data);
    } catch { /* silently */ } finally { setAttributionLoading(false); }
  }, []);

  const loadOverlapData = useCallback(async () => {
    setOverlapLoading(true);
    try {
      const data = await portfolioApi.getOverlap();
      setOverlapData(data);
    } catch { /* silently */ } finally { setOverlapLoading(false); }
  }, []);

  // 深度分析Tab激活时加载数据
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'transactions' && transactions.length === 0) {
      loadTransactions();
    }
    if (key === 'analysis') {
      if (!industryData) loadIndustryData();
      if (!feeData) loadFeeData();
      if (holdingsRisk.length === 0) loadHoldingsRisk();
      if (!attributionData) loadAttributionData();
      if (!overlapData) loadOverlapData();
    }
  };

  // 持仓诊断辅助函数
  const getHoldingDays = (h: PortfolioHolding) => {
    if (!h.records?.[0]?.buy_date) return 0;
    const buyDate = new Date(h.records[0].buy_date);
    return Math.floor((Date.now() - buyDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getFeeTier = (days: number) => {
    if (days >= 730) return { label: '长期', color: 'var(--success)' };
    if (days >= 365) return { label: '中期', color: 'var(--primary)' };
    if (days >= 30) return { label: '短期', color: 'var(--warning)' };
    return { label: '超短期', color: 'var(--danger)' };
  };

  const dcaColumns = [
    {
      title: '基金名称', dataIndex: 'fund_name', key: 'fund_name', width: 180,
      render: (name: string, record: any) => (
        <Link to={`/funds/${record.fund_code}`} style={{ fontWeight: 500, color: 'var(--primary)' }}>
          {name} <LinkOutlined style={{ fontSize: 11, color: 'var(--primary)' }} />
        </Link>
      ),
    },
    {
      title: '基金代码', dataIndex: 'fund_code', key: 'fund_code', width: 100,
      render: (code: string) => (
        <Link to={`/funds/${code}`} style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontFamily: 'monospace' }}>{code}</Link>
      ),
    },
    {
      title: '定投金额', dataIndex: 'amount', key: 'amount', width: 110,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '频率', dataIndex: 'frequency', key: 'frequency', width: 90,
      render: (v: string) => frequencyLabel(v),
    },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 110 },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 110, render: (v: string) => v || '长期' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => v === 'active'
        ? <Badge status="processing" text="执行中" />
        : <Badge status="default" text={v === 'completed' ? '已到期' : '已暂停'} />,
    },
    {
      title: '上次执行', dataIndex: 'last_executed', key: 'last_executed', width: 110,
      render: (v: string) => v || '未执行',
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDca(record)}>编辑</Button>
          <Popconfirm title="确认删除此定投计划？" onConfirm={() => handleDeleteDca(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const holdings = summary?.holdings || [];
  const pnlColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';
  const pnlSign = (v: number) => v >= 0 ? '+' : '-';

  // Pie chart config
  const pieOption = holdings.length > 0 ? {
    tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      label: { formatter: '{b}\n{d}%' },
      data: holdings.map(h => ({
        name: h.fund_name,
        value: h.market_value,
      })),
    }],
  } : null;

  // P&L bar chart
  const barOption = holdings.length > 0 ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: holdings.map(h => h.fund_name.slice(0, 6)),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value', name: '盈亏(元)' },
    series: [{
      type: 'bar',
      data: holdings.map(h => ({
        value: h.pnl,
        itemStyle: { color: h.pnl >= 0 ? '#cf1322' : '#3f8600' },
      })),
    }],
  } : null;

  const columns = [
    {
      title: '基金名称', dataIndex: 'fund_name', key: 'fund_name', width: 180, fixed: 'left' as const,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.fund_name.localeCompare(b.fund_name, 'zh-CN'),
      render: (name: string, record: PortfolioHolding) => (
        <Link to={`/funds/${record.fund_code}`} style={{ fontWeight: 500, color: 'var(--primary)' }}>
          {name} <LinkOutlined style={{ fontSize: 11, color: 'var(--primary)' }} />
        </Link>
      ),
    },
    {
      title: '基金代码', dataIndex: 'fund_code', key: 'fund_code', width: 100,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.fund_code.localeCompare(b.fund_code),
      render: (code: string) => (
        <Link to={`/funds/${code}`} style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontFamily: 'monospace' }}>{code}</Link>
      ),
    },
    {
      title: '持有份额', dataIndex: 'total_shares', key: 'total_shares', width: 100,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.total_shares - b.total_shares,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '成本价', dataIndex: 'avg_cost_price', key: 'avg_cost_price', width: 90,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.avg_cost_price - b.avg_cost_price,
      render: (v: number) => v.toFixed(4),
    },
    {
      title: '当前净值', dataIndex: 'current_nav', key: 'current_nav', width: 90,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.current_nav - b.current_nav,
      render: (v: number, record: PortfolioHolding) => (
        <Tooltip title={record.nav_updated_at ? `更新: ${new Date(record.nav_updated_at).toLocaleString('zh-CN')}` : '未更新'}>
          <span>{v.toFixed(4)}</span>
        </Tooltip>
      ),
    },
    {
      title: '市值', dataIndex: 'market_value', key: 'market_value', width: 110,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.market_value - b.market_value,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '盈亏', dataIndex: 'pnl', key: 'pnl', width: 110,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.pnl - b.pnl,
      render: (v: number) => (
        <span style={{ color: pnlColor(v), fontWeight: 600 }}>
          {pnlSign(v)}¥{Math.abs(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: '收益率', dataIndex: 'pnl_percent', key: 'pnl_percent', width: 90,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.pnl_percent - b.pnl_percent,
      defaultSortOrder: 'ascend' as const,
      render: (v: number) => (
        <Tag color={v >= 0 ? 'red' : 'green'}>{pnlSign(v)}{Math.abs(v).toFixed(2)}%</Tag>
      ),
    },
    {
      title: '操作', key: 'action', width: 160, fixed: 'right' as const,
      render: (_: any, holding: PortfolioHolding) => (
        <Space>
          <Button
            type="link" size="small" icon={<EditOutlined />}
            disabled={!holding.records?.length}
            onClick={() => holding.records?.[0] && handleEdit(holding.records[0])}
          >
            编辑
          </Button>
          <Button
            type="link" size="small" icon={<SwapOutlined />}
            style={{ color: 'var(--warning)' }}
            onClick={() => handleSell(holding)}
          >
            赎回
          </Button>
          <Popconfirm title="确认删除此基金的所有持仓记录？" onConfirm={async () => {
            try {
              await Promise.all(holding.records.map(r => portfolioApi.deleteRecord(r.id)));
              message.success('删除成功');
              loadData();
            } catch {
              message.error('删除失败');
            }
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 手机端精简列（隐藏次要列，减少横向滚动）
  const displayColumns = isMobile
    ? columns.filter((c) => !['total_shares', 'avg_cost_price', 'current_nav'].includes(c.key as string))
    : columns;

  // Flatten records for the table (grouped view)
  const tableData = holdings.map((h, i) => ({ ...h, key: h.fund_code || i }));

  const tabItems = [
    {
      key: 'portfolio',
      label: <span><FundOutlined style={{ marginRight: 6 }} />理财记账</span>,
      children: (
        <>
          {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: 'var(--gradient-card-purple)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>总投入</div>
            <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>¥{(summary?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: 'var(--gradient-card-pink)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>当前市值</div>
            <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>¥{(summary?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: (summary?.totalPnl || 0) >= 0 ? 'var(--gradient-card-red)' : 'var(--gradient-card-green)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>总盈亏</div>
            <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>
              {(summary?.totalPnl || 0) >= 0 ? '+' : '-'}¥{Math.abs(summary?.totalPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: 14, marginLeft: 4 }}>{(summary?.totalPnl || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}</span>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: (summary?.totalReturn || 0) >= 0 ? 'var(--gradient-card-gold)' : 'var(--gradient-card-green)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>总收益率</div>
            <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>
              {(summary?.totalReturn || 0) >= 0 ? '+' : ''}{(summary?.totalReturn || 0).toFixed(2)}%
            </div>
          </Card>
        </Col>
      </Row>

      {/* 持仓明细 */}
      <Card
        title={
          <span>
            持仓明细
            {lastRefreshTime && (
              <span style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c', fontWeight: 'normal', marginLeft: 12 }}>
                净值更新于 {lastRefreshTime}
              </span>
            )}
          </span>
        }
        extra={
          <Space wrap>
            <Button
              icon={<SyncOutlined spin={refreshing} />}
              onClick={handleRefreshNav}
              loading={refreshing}
              style={isMobile ? { fontSize: 12, paddingInline: 8 } : undefined}
            >
              刷新净值
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={isMobile ? { fontSize: 12, paddingInline: 8 } : undefined}>添加持仓</Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {holdings.length === 0 && !loading ? (
          <Empty description="暂无持仓记录，点击上方按钮添加" />
        ) : (
          <Table
            columns={displayColumns}
            dataSource={tableData}
            loading={loading}
            scroll={{ x: isMobile ? 560 : 1000 }}
            pagination={false}
            size={isMobile ? 'small' : 'middle'}
          />
        )}
      </Card>

      {/* 收益地图 */}
      {holdings.length > 0 && <ReturnsMap />}

      {/* Charts */}
      {holdings.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="持仓分布">
              <ReactECharts theme={getEchartsTheme(isDark)} option={pieOption} style={{ height: 300 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="各基金盈亏">
              <ReactECharts theme={getEchartsTheme(isDark)} option={barOption} style={{ height: 300 }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 基准对比 */}
      {holdings.length > 0 && benchmarkData.length > 0 && (
        <Card
          title="持仓 vs 沪深300 基准对比"
          style={{ marginBottom: 24 }}
        >
          <ReactECharts
            theme={getEchartsTheme(isDark)}
            option={{
              tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                  let html = `${params[0]?.axisValue}<br/>`;
                  params.forEach((p: any) => {
                    html += `${p.marker} ${p.seriesName}: ${p.value}%<br/>`;
                  });
                  return html;
                },
              },
              legend: { data: ['我的持仓', '沪深300基准'], bottom: 0 },
              grid: { top: 20, right: 20, bottom: 40, left: 60 },
              xAxis: {
                type: 'category',
                data: benchmarkData.map(d => d.date),
                axisLabel: { fontSize: 10, interval: Math.floor(benchmarkData.length / 8) },
              },
              yAxis: {
                type: 'value',
                axisLabel: { formatter: '{value}%', fontSize: 10 },
                splitLine: { lineStyle: { type: 'dashed' } },
              },
              series: [
                {
                  name: '沪深300基准',
                  type: 'line',
                  data: benchmarkData.map(d => parseFloat(d.return_pct)),
                  lineStyle: { width: 2, color: '#999', type: 'dashed' },
                  itemStyle: { color: '#999' },
                  showSymbol: false,
                },
                {
                  name: '我的持仓',
                  type: 'line',
                  data: (() => {
                    if (portfolioDailyReturns.length < 2) return benchmarkData.map(() => summary?.totalReturn || 0);
                    const initialValue = portfolioDailyReturns[0].value;
                    const returnMap: Record<string, number> = {};
                    let cumReturn = 0;
                    for (const d of portfolioDailyReturns) {
                      cumReturn = initialValue > 0 ? ((d.value - initialValue) / initialValue) * 100 : 0;
                      returnMap[d.date] = parseFloat(cumReturn.toFixed(2));
                    }
                    let lastVal = 0;
                    return benchmarkData.map(d => {
                      if (returnMap[d.date] !== undefined) lastVal = returnMap[d.date];
                      return lastVal;
                    });
                  })(),
                  lineStyle: { width: 2, color: '#1677ff' },
                  itemStyle: { color: '#1677ff' },
                  showSymbol: false,
                  areaStyle: {
                    color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                      colorStops: [
                        { offset: 0, color: 'rgba(22,119,255,0.15)' },
                        { offset: 1, color: 'rgba(22,119,255,0.02)' },
                      ],
                    },
                  },
                },
              ],
            }}
            style={{ height: 300 }}
            opts={{ renderer: 'svg' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontSize: 12 }}>我的持仓收益</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: (summary?.totalReturn || 0) >= 0 ? '#cf1322' : '#3f8600' }}>
                {(summary?.totalReturn || 0) >= 0 ? '+' : ''}{(summary?.totalReturn || 0).toFixed(2)}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontSize: 12 }}>沪深300同期</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: parseFloat(benchmarkData[benchmarkData.length - 1]?.return_pct || 0) >= 0 ? '#cf1322' : '#3f8600' }}>
                {benchmarkData.length > 0 ? `${parseFloat(benchmarkData[benchmarkData.length - 1].return_pct) >= 0 ? '+' : ''}${benchmarkData[benchmarkData.length - 1].return_pct}%` : '-'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontSize: 12 }}>超额收益</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-purple)' }}>
                {benchmarkData.length > 0
                  ? `${((summary?.totalReturn || 0) - parseFloat(benchmarkData[benchmarkData.length - 1].return_pct || 0)) >= 0 ? '+' : ''}${((summary?.totalReturn || 0) - parseFloat(benchmarkData[benchmarkData.length - 1].return_pct || 0)).toFixed(2)}%`
                  : '-'}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 持仓诊断 & 交易行为分析 */}
      {holdings.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <HoldingsDiagnosis holdings={holdings} isDark={isDark} getHoldingDays={getHoldingDays} getFeeTier={getFeeTier} />
          </Col>
          <Col xs={24} lg={12}>
            <TransactionBehaviorAnalysis holdings={holdings} txStats={txStats} isDark={isDark} getHoldingDays={getHoldingDays} />
          </Col>
        </Row>
      )}

      {/* DCA Plans */}
      <Card
        title={<><ScheduleOutlined style={{ marginRight: 8 }} />定投计划</>}
        extra={
          <Space>
            <Tooltip title="同步定投：根据计划自动生成最近的持仓记录">
              <Button icon={<SyncOutlined spin={syncing} />} onClick={handleSyncDca} loading={syncing}>
                同步定投
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDca}>新建定投</Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {dcaPlans.length === 0 && !loading ? (
          <Empty description="暂无定投计划，点击右上角新建" />
        ) : (
          <Table
            columns={dcaColumns}
            dataSource={dcaPlans.map(p => ({ ...p, key: p.id }))}
            pagination={false}
            size="middle"
            scroll={{ x: 900 }}
          />
        )}
      </Card>

      {/* Add/Edit Fund Record Modal */}
      <Modal
        title={editingRecord ? '编辑持仓' : '添加持仓'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="产品类型">
            <Segmented
              options={[
                { label: '基金', value: 'fund' },
                { label: '招行理财', value: 'cmb' },
              ]}
              value={productType}
              onChange={(val) => {
                setProductType(val as 'fund' | 'cmb');
                form.setFieldsValue({ fund_code: '', fund_name: '' });
              }}
            />
          </Form.Item>
          <Form.Item
            name="fund_code"
            label={productType === 'cmb' ? '产品代码' : '基金代码'}
            rules={[{ required: true, message: productType === 'cmb' ? '请输入产品代码' : '请输入基金代码' }]}
          >
            <Input
              placeholder={productType === 'cmb' ? '例如: PY040217' : '例如: 013349'}
              maxLength={productType === 'cmb' ? 20 : 6}
              onChange={handleFundCodeChange}
            />
          </Form.Item>
          <Form.Item
            name="fund_name"
            label={productType === 'cmb' ? '产品名称' : '基金名称'}
            rules={[{ required: true, message: productType === 'cmb' ? '请输入产品名称' : '请输入基金名称' }]}
          >
            <Input
              placeholder={productType === 'cmb' ? '输入代码后自动填充' : '例如: 人工智能ETF联接A'}
              suffix={lookupLoading ? <Spin size="small" /> : undefined}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="shares"
                label="持有份额"
                rules={[{ required: true, message: '请输入份额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} step={100} placeholder="1000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cost_price"
                label="成本价(元)"
                rules={[{ required: true, message: '请输入成本价' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.0001} step={0.01} placeholder="1.2345" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buy_date"
                label="买入日期"
                rules={[{ required: true, message: '请选择日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="buy_fee" label="手续费(元)" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>

      {/* DCA Plan Modal */}
      <Modal
        title={editingDca ? '编辑定投计划' : '新建定投计划'}
        open={dcaModalOpen}
        onOk={handleSubmitDca}
        onCancel={() => setDcaModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
        width={520}
      >
        <Form form={dcaForm} layout="vertical" preserve={false}>
          <Form.Item
            name="fund_code"
            label="基金代码"
            rules={[{ required: true, message: '请输入基金代码' }]}
          >
            <Input placeholder="例如: 000961" maxLength={6} onChange={handleFundCodeChange} />
          </Form.Item>
          <Form.Item
            name="fund_name"
            label="基金名称"
            rules={[{ required: true, message: '请输入基金名称' }]}
          >
            <Input
              placeholder="例如: 天弘沪深300ETF联接A"
              suffix={lookupLoading ? <Spin size="small" /> : undefined}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="每期定投金额(元)"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={10} step={100} placeholder="1000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="frequency"
                label="定投频率"
                rules={[{ required: true, message: '请选择频率' }]}
                initialValue="monthly"
              >
                <Select options={[
                  { value: 'weekly', label: '每周' },
                  { value: 'biweekly', label: '每两周' },
                  { value: 'monthly', label: '每月' },
                  { value: 'quarterly', label: '每季度' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.frequency !== cur.frequency}>
            {({ getFieldValue }) => {
              const freq = getFieldValue('frequency');
              return freq === 'weekly' || freq === 'biweekly' ? (
                <Form.Item name="day_of_week" label="每周几执行" initialValue={1}>
                  <Select options={[
                    { value: 1, label: '周一' }, { value: 2, label: '周二' },
                    { value: 3, label: '周三' }, { value: 4, label: '周四' },
                    { value: 5, label: '周五' },
                  ]} />
                </Form.Item>
              ) : (
                <Form.Item name="day_of_month" label="每月几号执行" initialValue={1}>
                  <InputNumber style={{ width: '100%' }} min={1} max={28} placeholder="1" />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="start_date"
                label="开始日期"
                rules={[{ required: true, message: '请选择开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="end_date" label="结束日期（选填）">
                <DatePicker style={{ width: '100%' }} placeholder="留空为长期" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="选填，例如：支付宝定投" />
          </Form.Item>
        </Form>
      </Modal>
        </>
      ),
    },
    {
      key: 'risk',
      label: <span><SafetyOutlined style={{ marginRight: 6 }} />风险评估</span>,
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Steps current={riskStep} items={[
              { title: '年龄' }, { title: '投资金额' }, { title: '投资期限' }, { title: '风险偏好' }, { title: '评估结果' },
            ]} size="small" />
          </Card>

          <Card style={{ marginBottom: 16, minHeight: 300 }}>
            {riskStep === 0 && (
              <div>
                <h3 style={{ marginBottom: 16 }}>1. 您的年龄段</h3>
                <Radio.Group value={riskProfile.age} onChange={(e) => setRiskProfile({ ...riskProfile, age: e.target.value })}>
                  <Space direction="vertical" size={12}>
                    {['18-25岁', '26-35岁', '36-45岁', '46-55岁', '55岁以上'].map((age) => (
                      <Radio.Button key={age} value={age} style={{ width: 200, textAlign: 'center' }}>{age}</Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            )}

            {riskStep === 1 && (
              <div>
                <h3 style={{ marginBottom: 16 }}>2. 计划投资金额</h3>
                <Radio.Group value={riskProfile.investmentAmount} onChange={(e) => setRiskProfile({ ...riskProfile, investmentAmount: e.target.value })}>
                  <Space direction="vertical" size={12}>
                    {['1万以下', '1-5万', '5-20万', '20-50万', '50万以上'].map((amount) => (
                      <Radio.Button key={amount} value={amount} style={{ width: 200, textAlign: 'center' }}>{amount}</Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            )}

            {riskStep === 2 && (
              <div>
                <h3 style={{ marginBottom: 16 }}>3. 计划投资期限</h3>
                <Radio.Group value={riskProfile.investmentPeriod} onChange={(e) => setRiskProfile({ ...riskProfile, investmentPeriod: e.target.value })}>
                  <Space direction="vertical" size={12}>
                    {['3个月以内', '3-6个月', '6-12个月', '1-3年', '3年以上'].map((period) => (
                      <Radio.Button key={period} value={period} style={{ width: 200, textAlign: 'center' }}>{period}</Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            )}

            {riskStep === 3 && (
              <div>
                <h3 style={{ marginBottom: 16 }}>4. 风险承受能力</h3>
                <Radio.Group value={riskProfile.riskTolerance} onChange={(e) => setRiskProfile({ ...riskProfile, riskTolerance: e.target.value })}>
                  <Row gutter={[16, 16]}>
                    {[
                      { value: 'conservative', label: '保守型', desc: '无法接受本金损失，追求稳定收益' },
                      { value: 'balanced', label: '稳健型', desc: '能接受小幅波动，追求长期增值' },
                      { value: 'aggressive', label: '激进型', desc: '能承受较大波动，追求高收益' },
                    ].map((option) => (
                      <Col xs={24} sm={8} key={option.value}>
                        <Card
                          hoverable
                          style={{ border: riskProfile.riskTolerance === option.value ? '2px solid var(--primary)' : `1px solid ${isDark ? '#333' : '#e8e8e8'}`, cursor: 'pointer' }}
                          onClick={() => setRiskProfile({ ...riskProfile, riskTolerance: option.value as any })}
                        >
                          <strong>{option.label}</strong>
                          <p style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', margin: '8px 0 0' }}>{option.desc}</p>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Radio.Group>

                <h3 style={{ marginBottom: 16, marginTop: 24 }}>5. 能承受的最大亏损</h3>
                <Radio.Group value={riskProfile.lossTolerance} onChange={(e) => setRiskProfile({ ...riskProfile, lossTolerance: e.target.value })}>
                  <Space direction="vertical" size={12}>
                    {['5%以内', '5-10%', '10-20%', '20-30%', '30%以上'].map((loss) => (
                      <Radio.Button key={loss} value={loss} style={{ width: 200, textAlign: 'center' }}>{loss}</Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            )}

            {riskStep === 4 && riskRecommendation && (
              <div>
                <Alert
                  type="success"
                  message={`您的风险类型：${riskRecommendation.type}`}
                  description={riskRecommendation.description}
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col xs={12} sm={6}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                      <Statistic title="预期年化收益" value={riskRecommendation.expectedReturn} valueStyle={{ color: 'var(--primary)' }} />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small" style={{ textAlign: 'center' }}>
                      <Statistic title="风险等级" value={riskRecommendation.riskLevel} valueStyle={{ color: 'var(--danger)' }} />
                    </Card>
                  </Col>
                </Row>

                <Card title="推荐资产配置" style={{ marginBottom: 16 }}>
                  {riskRecommendation.allocation.map((item: any, index: number) => (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong>{item.industry}</strong>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.percentage}%</span>
                      </div>
                      <Progress percent={item.percentage} showInfo={false} />
                      <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginTop: 4 }}>推荐基金：{item.funds.join('、')}</div>
                    </div>
                  ))}
                </Card>

                <Card title="操作建议">
                  <ul style={{ fontSize: 14, lineHeight: 2, margin: 0, paddingLeft: 20 }}>
                    {riskProfile.riskTolerance === 'conservative' && (
                      <>
                        <li>建议以债券基金和货币基金为主，占比80%</li>
                        <li>可配置少量沪深300指数基金，占比20%</li>
                        <li>适合长期持有，不建议频繁操作</li>
                      </>
                    )}
                    {riskProfile.riskTolerance === 'balanced' && (
                      <>
                        <li>建议均衡配置，股票型基金和债券型基金各占50%</li>
                        <li>股票型基金可选择沪深300、消费、医药等</li>
                        <li>建议采用定投方式，分散买入成本</li>
                      </>
                    )}
                    {riskProfile.riskTolerance === 'aggressive' && (
                      <>
                        <li>建议以股票型基金为主，占比80-90%</li>
                        <li>可配置AI、半导体、纳斯达克等高弹性品种</li>
                        <li>建议分批建仓，不要一次性投入</li>
                      </>
                    )}
                  </ul>
                </Card>

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                  <Button type="primary" onClick={() => { setRiskStep(0); setRiskRecommendation(null); }}>重新评估</Button>
                </div>
              </div>
            )}
          </Card>

          {riskStep < 4 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => setRiskStep(Math.max(0, riskStep - 1))} disabled={riskStep === 0}>上一步</Button>
                {riskStep < 3 ? (
                  <Button type="primary" onClick={() => setRiskStep(riskStep + 1)} disabled={!canNextRisk()}>下一步</Button>
                ) : (
                  <Button type="primary" onClick={handleRiskSubmit} loading={riskLoading} disabled={!canNextRisk()}>获取推荐</Button>
                )}
              </div>
            </Card>
          )}
        </>
      ),
    },
    {
      key: 'dca',
      label: <span><CalculatorOutlined style={{ marginRight: 6 }} />定投计算器</span>,
      children: (
        <>
          <Card title="定投参数" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontWeight: 500, marginRight: 12 }}>定投频率：</span>
              <Segmented
                value={dcaFrequency}
                onChange={(val: string | number) => handleDcaFrequencyChange(val as string)}
                options={[
                  { label: '每日', value: 'daily' },
                  { label: '每周', value: 'weekly' },
                  { label: '每月', value: 'monthly' },
                ]}
              />
            </div>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{DCA_FREQ_CONFIG[dcaFrequency].amountLabel}</div>
                <InputNumber
                  value={dcaAmount}
                  onChange={(v) => setDcaAmount(v || DCA_FREQ_CONFIG[dcaFrequency].defaultAmount)}
                  min={1}
                  step={dcaFrequency === 'daily' ? 10 : dcaFrequency === 'weekly' ? 50 : 100}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{DCA_FREQ_CONFIG[dcaFrequency].periodLabel}</div>
                <InputNumber value={dcaPeriod} onChange={(v) => setDcaPeriod(v || 36)} min={1} max={120} style={{ width: '100%' }} />
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>预期年化收益率（%）</div>
                <InputNumber value={dcaExpectedReturn} onChange={(v) => setDcaExpectedReturn(v || 10)} min={-50} max={100} step={0.5} style={{ width: '100%' }} />
              </Col>
            </Row>

            <div style={{ marginTop: 16 }}>
              <span style={{ color: isDark ? '#a0a0a0' : '#666', marginRight: 12 }}>快捷设置：</span>
              <Space>
                <Tag style={{ cursor: 'pointer' }} onClick={() => { setDcaFrequency('monthly'); setDcaAmount(500); setDcaPeriod(12); setDcaExpectedReturn(8); setDcaResult(null); }}>保守型</Tag>
                <Tag style={{ cursor: 'pointer' }} onClick={() => { setDcaFrequency('monthly'); setDcaAmount(1000); setDcaPeriod(36); setDcaExpectedReturn(10); setDcaResult(null); }}>稳健型</Tag>
                <Tag style={{ cursor: 'pointer' }} onClick={() => { setDcaFrequency('monthly'); setDcaAmount(2000); setDcaPeriod(60); setDcaExpectedReturn(15); setDcaResult(null); }}>激进型</Tag>
              </Space>
            </div>

            <Button type="primary" onClick={handleDcaCalculate} style={{ marginTop: 16 }} size="large">开始计算</Button>
          </Card>

          {dcaResult && (
            <>
              <Card title="计算结果" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col xs={12} sm={6}>
                    <Statistic title="总投入" value={dcaResult.totalInvestment} precision={2} prefix="¥" />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="总资产" value={dcaResult.totalValue} precision={2} prefix="¥" valueStyle={{ color: 'var(--primary)' }} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="总收益" value={dcaResult.totalValue - dcaResult.totalInvestment} precision={2} prefix="¥" valueStyle={{ color: 'var(--danger)' }} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="总收益率" value={dcaResult.totalReturn} precision={2} suffix="%" valueStyle={{ color: 'var(--danger)' }} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="年化收益率" value={dcaResult.annualizedReturn} precision={2} suffix="%" valueStyle={{ color: 'var(--danger)' }} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="定投期数" value={dcaResult.totalPeriods} suffix={dcaFrequency === 'daily' ? '天' : dcaFrequency === 'weekly' ? '周' : '个月'} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="定投频率" value={DCA_FREQ_CONFIG[dcaFrequency].label} />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic title="每期金额" value={dcaAmount} precision={0} prefix="¥" />
                  </Col>
                </Row>
              </Card>

              <Card title="月度明细" style={{ marginBottom: 16 }}>
                <Table
                  columns={[
                    { title: '月份', dataIndex: 'index', key: 'index', render: (v: number) => `第 ${v} 个月` },
                    { title: '当月投入', dataIndex: 'investment', key: 'investment', render: (v: number) => formatCurrency(v) },
                    { title: '累计投入', dataIndex: 'cumulativeInvestment', key: 'cumulativeInvestment', render: (v: number) => formatCurrency(v) },
                    { title: '资产市值', dataIndex: 'value', key: 'value', render: (v: number) => formatCurrency(v) },
                    {
                      title: '收益率', dataIndex: 'returnRate', key: 'returnRate',
                      render: (v: number) => <span style={{ color: v >= 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</span>,
                    },
                  ]}
                  dataSource={dcaFrequency === 'monthly' ? dcaResult.details : (() => {
                    const daysPerPeriod = dcaFrequency === 'daily' ? TRADING_DAYS_PER_MONTH : Math.round(WEEKS_PER_MONTH);
                    const months: any[] = [];
                    for (let m = 0; m < dcaPeriod; m++) {
                      const startIdx = m * daysPerPeriod;
                      const endIdx = Math.min(startIdx + daysPerPeriod, dcaResult.details.length);
                      if (startIdx >= dcaResult.details.length) break;
                      const lastInMonth = dcaResult.details[endIdx - 1];
                      months.push({
                        index: m + 1,
                        investment: lastInMonth.investment * (endIdx - startIdx),
                        cumulativeInvestment: lastInMonth.cumulativeInvestment,
                        value: lastInMonth.value,
                        returnRate: lastInMonth.returnRate,
                      });
                    }
                    return months;
                  })()}
                  rowKey="index"
                  pagination={{ pageSize: 12 }}
                  size="small"
                  summary={() => (
                    <Table.Summary.Row style={{ fontWeight: 600, background: isDark ? '#1f1f1f' : '#f5f5f5' }}>
                      <Table.Summary.Cell index={0}>最终</Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>{formatCurrency(dcaResult.totalInvestment)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>{formatCurrency(dcaResult.totalInvestment)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>{formatCurrency(dcaResult.totalValue)}</Table.Summary.Cell>
                      <Table.Summary.Cell index={4}>
                        <span style={{ color: dcaResult.totalReturn >= 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {dcaResult.totalReturn >= 0 ? '+' : ''}{dcaResult.totalReturn.toFixed(2)}%
                        </span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              </Card>

              <Alert
                type="info"
                message="定投建议"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 2 }}>
                    <li>坚持长期投资，至少3年以上</li>
                    <li>市场下跌时不要停止定投，反而是低成本买入的机会</li>
                    <li>设置止盈点，达到目标收益后可分批止盈</li>
                    <li>选择C类基金适合短期持有，A类基金适合长期持有</li>
                    {dcaFrequency === 'daily' && <li>每日定投适合资金充裕、希望平滑波动的投资者</li>}
                    {dcaFrequency === 'weekly' && <li>每周定投兼顾平滑波动和操作便利，适合工薪族</li>}
                  </ul>
                }
              />
            </>
          )}

          <Card title="热门定投方案" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              {[
                { label: '每日定投（沪深300）', desc: '每天50元 × 3年，预期年化8%', freq: 'daily', amount: 50, p: 36, r: 8 },
                { label: '每周定投（科技主题）', desc: '每周200元 × 3年，预期年化12%', freq: 'weekly', amount: 200, p: 36, r: 12 },
                { label: '每月定投（成长股）', desc: '每月2000元 × 2年，预期年化15%', freq: 'monthly', amount: 2000, p: 24, r: 15 },
              ].map((plan) => (
                <Col xs={24} sm={8} key={plan.label}>
                  <Card
                    hoverable
                    size="small"
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => { setDcaFrequency(plan.freq as any); setDcaAmount(plan.amount); setDcaPeriod(plan.p); setDcaExpectedReturn(plan.r); setDcaResult(null); }}
                  >
                    <strong>{plan.label}</strong>
                    <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginTop: 8 }}>{plan.desc}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </>
      ),
    },
    // 交易历史 Tab
    {
      key: 'transactions',
      label: <span><SwapOutlined style={{ marginRight: 6 }} />交易历史</span>,
      children: (
        <TransactionHistoryTab
          transactions={transactions}
          txTotal={txTotal}
          txPage={txPage}
          txStats={txStats}
          txFilter={txFilter}
          txLoading={txLoading}
          onFilterChange={handleTxFilterChange}
          onPageChange={(p) => loadTransactions(p)}
          onRefresh={() => loadTransactions(txPage)}
        />
      ),
    },
    // 深度分析 Tab
    {
      key: 'analysis',
      label: <span><LineChartOutlined style={{ marginRight: 6 }} />深度分析</span>,
      children: (
        <DeepAnalysisTab
          industryData={industryData}
          industryLoading={industryLoading}
          feeData={feeData}
          feeLoading={feeLoading}
          holdingsRisk={holdingsRisk}
          holdingsRiskLoading={holdingsRiskLoading}
          attributionData={attributionData}
          attributionLoading={attributionLoading}
          overlapData={overlapData}
          overlapLoading={overlapLoading}
          isDark={isDark}
          onRefreshIndustry={loadIndustryData}
          onRefreshOverlap={loadOverlapData}
          onRefreshFee={loadFeeData}
          onRefreshRisk={loadHoldingsRisk}
          onRefreshAttribution={loadAttributionData}
        />
      ),
    },
    // 目标规划 Tab
    {
      key: 'goal',
      label: <span><TrophyOutlined style={{ marginRight: 6 }} />目标规划</span>,
      children: <GoalPlanningTab isDark={isDark} summary={summary} />,
    },
    // 资产台账 Tab
    {
      key: 'assets',
      label: <span><WalletOutlined style={{ marginRight: 6 }} />资产台账</span>,
      children: <AssetAccountsPanel isDark={isDark} />,
    },
    // 智能定投 Tab
    {
      key: 'smart-dca',
      label: <span><ExperimentOutlined style={{ marginRight: 6 }} />智能定投</span>,
      children: <SmartDCATab isDark={isDark} />,
    },
    // VIP 智能分析 Tab
    ...(isVIP ? [{
      key: 'vip',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CrownOutlined style={{ color: 'var(--color-gold)' }} />
          VIP分析
          <ProBadge isSVIP={user?.subscription_tier === 'svip' || user?.role === 'admin'} size="small" />
        </span>
      ),
      children: <VIPInsights />,
    }] : []),
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <FundOutlined style={{ marginRight: 8 }} />
        理财记账
        {!isVIP && (
          <a
            href="/subscription"
            style={{
              marginLeft: 12, fontSize: 12, color: '#ffd700',
              background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
              padding: '4px 12px', borderRadius: 16, textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <CrownOutlined style={{ marginRight: 4 }} />开通VIP解锁智能分析
          </a>
        )}
      </h2>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        style={{ marginBottom: 0 }}
      />

      {/* 卖出弹窗 */}
      <SellModal
        sellModalOpen={sellModalOpen}
        sellTarget={sellTarget}
        sellForm={sellForm}
        sellLoading={sellLoading}
        onSubmit={handleSellSubmit}
        onCancel={() => setSellModalOpen(false)}
      />
    </div>
  );
}
