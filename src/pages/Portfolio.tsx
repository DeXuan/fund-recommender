import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Table, Button, Form, message,
  Popconfirm, Space, Row, Col, Empty, Segmented, Tag, Tooltip,
  Tabs, Grid,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SyncOutlined, LinkOutlined, FundOutlined, SafetyOutlined,
  CalculatorOutlined, CrownOutlined, SwapOutlined, LineChartOutlined,
  TrophyOutlined, ExperimentOutlined, WalletOutlined,
  ArrowUpOutlined, ArrowDownOutlined, PieChartOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { portfolioApi, fundApi } from '../services/api';
import type { PortfolioHolding, PortfolioSummary, FundRecord } from '../types';
import { ProBadge } from '../components/stock-picker';
import ReturnsMap from '../components/ReturnsMap';
import VIPInsights from '../components/VIPInsights';
import { TransactionHistoryTab } from '../components/portfolio/TransactionHistoryTab';
import { DeepAnalysisTab } from '../components/portfolio/DeepAnalysisTab';
import { BacktestTab } from '../components/portfolio/BacktestTab';
import { AllocationAdviceTab } from '../components/portfolio/AllocationAdviceTab';
import { ReportTab } from '../components/portfolio/ReportTab';
import { GoalPlanningTab } from '../components/portfolio/GoalPlanningTab';
import { SmartDCATab } from '../components/portfolio/SmartDCATab';
import { HoldingsDiagnosis } from '../components/portfolio/HoldingsDiagnosis';
import { TransactionBehaviorAnalysis } from '../components/portfolio/TransactionBehaviorAnalysis';
import { AssetAccountsPanel } from '../components/portfolio/AssetAccountsPanel';
import { RiskAssessmentTab } from '../components/portfolio/RiskAssessmentTab';
import { DCACalculatorTab } from '../components/portfolio/DCACalculatorTab';
import { AddEditRecordModal } from '../components/portfolio/AddEditRecordModal';
import { DCAModal } from '../components/portfolio/DCAModal';
import { DCAPlansPanel } from '../components/portfolio/DCAPlansPanel';
import { HoldingsCharts } from '../components/portfolio/HoldingsCharts';
import HealthScore from '../components/HealthScore';
import AlertLinesPanel from '../components/AlertLinesPanel';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

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

  const [activeTab, setActiveTab] = useState('portfolio');

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dcaPlans, setDcaPlans] = useState<any[]>([]);
  const [dcaModalOpen, setDcaModalOpen] = useState(false);
  const [editingDca, setEditingDca] = useState<any | null>(null);
  const [dcaForm] = Form.useForm();
  const [syncing, setSyncing] = useState(false);

  const [benchmarkData, setBenchmarkData] = useState<any[]>([]);
  const [portfolioDailyReturns, setPortfolioDailyReturns] = useState<any[]>([]);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txStats, setTxStats] = useState<any>({});
  const [txFilter, setTxFilter] = useState('all');
  const [txLoading, setTxLoading] = useState(false);

  const [assetFilter, setAssetFilter] = useState<'all' | 'fund' | 'cmb'>('all');

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

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  useEffect(() => { loadDataRef.current(); loadTransactions(); }, []);

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

  const holdings = summary?.holdings || [];
  const pnlColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';
  const pnlSign = (v: number) => v >= 0 ? '+' : '-';

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

  const displayColumns = isMobile
    ? columns.filter((c) => !['total_shares', 'avg_cost_price', 'current_nav'].includes(c.key as string))
    : columns;

  const filteredHoldings = assetFilter === 'all'
    ? holdings
    : holdings.filter(h => assetFilter === 'cmb' ? !/^\d+$/.test(h.fund_code) : /^\d+$/.test(h.fund_code));

  const tableData = filteredHoldings.map((h, i) => ({ ...h, key: h.fund_code || i }));

  const tabItems = [
    {
      key: 'portfolio',
      label: <span><FundOutlined style={{ marginRight: 6 }} />理财记账</span>,
      children: (
        <>
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
                <Segmented
                  value={assetFilter}
                  onChange={(v) => setAssetFilter(v as 'all' | 'fund' | 'cmb')}
                  options={[
                    { label: '全部', value: 'all' },
                    { label: '公募基金', value: 'fund' },
                    { label: '招行理财', value: 'cmb' },
                  ]}
                  size={isMobile ? 'small' : 'middle'}
                />
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

          {holdings.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} lg={12}>
                <HealthScore />
              </Col>
              <Col xs={24} lg={12}>
                <AlertLinesPanel holdings={holdings.map(h => ({ fund_code: h.fund_code, fund_name: h.fund_name }))} />
              </Col>
            </Row>
          )}

          {holdings.length > 0 && <ReturnsMap />}

          {holdings.length > 0 && (
            <HoldingsCharts
              holdings={holdings}
              summary={summary}
              benchmarkData={benchmarkData}
              portfolioDailyReturns={portfolioDailyReturns}
              isDark={isDark}
            />
          )}

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

          <DCAPlansPanel
            dcaPlans={dcaPlans}
            loading={loading}
            syncing={syncing}
            isDark={isDark}
            onSyncDca={handleSyncDca}
            onAddDca={handleAddDca}
            onEditDca={handleEditDca}
            onDeleteDca={handleDeleteDca}
          />

          <AddEditRecordModal
            modalOpen={modalOpen}
            editingRecord={editingRecord}
            form={form}
            productType={productType}
            lookupLoading={lookupLoading}
            onFundCodeChange={handleFundCodeChange}
            onSubmit={handleSubmit}
            onCancel={() => setModalOpen(false)}
            setProductType={setProductType}
          />

          <DCAModal
            dcaModalOpen={dcaModalOpen}
            editingDca={editingDca}
            dcaForm={dcaForm}
            lookupLoading={lookupLoading}
            onFundCodeChange={handleFundCodeChange}
            onSubmit={handleSubmitDca}
            onCancel={() => setDcaModalOpen(false)}
          />
        </>
      ),
    },
    {
      key: 'risk',
      label: <span><SafetyOutlined style={{ marginRight: 6 }} />风险评估</span>,
      children: <RiskAssessmentTab isDark={isDark} />,
    },
    {
      key: 'dca',
      label: <span><CalculatorOutlined style={{ marginRight: 6 }} />定投计算器</span>,
      children: <DCACalculatorTab isDark={isDark} />,
    },
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
    {
      key: 'goal',
      label: <span><TrophyOutlined style={{ marginRight: 6 }} />目标规划</span>,
      children: <GoalPlanningTab isDark={isDark} summary={summary} />,
    },
    {
      key: 'report',
      label: <span><FileTextOutlined style={{ marginRight: 6 }} />投资报告</span>,
      children: <ReportTab />,
    },
    {
      key: 'backtest',
      label: <span><LineChartOutlined style={{ marginRight: 6 }} />组合回测</span>,
      children: <BacktestTab holdings={holdings.map(h => ({ fund_code: h.fund_code, fund_name: h.fund_name }))} />,
    },
    {
      key: 'allocation',
      label: <span><PieChartOutlined style={{ marginRight: 6 }} />资产配置建议</span>,
      children: <AllocationAdviceTab />,
    },
    {
      key: 'assets',
      label: <span><WalletOutlined style={{ marginRight: 6 }} />资产台账</span>,
      children: <AssetAccountsPanel isDark={isDark} />,
    },
    {
      key: 'smart-dca',
      label: <span><ExperimentOutlined style={{ marginRight: 6 }} />智能定投</span>,
      children: <SmartDCATab isDark={isDark} />,
    },
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

    </div>
  );
}
