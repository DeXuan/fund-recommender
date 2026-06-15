import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Tabs, Form, message } from 'antd';
import {
  FundOutlined, CrownOutlined, CheckCircleOutlined, WarningOutlined,
  SafetyOutlined, CalculatorOutlined, SwapOutlined, BarChartOutlined,
  TrophyOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { portfolioApi, fundApi } from '../services/api';
import type { PortfolioHolding, PortfolioSummary, FundRecord } from '../types';
import ReturnsMap from '../components/ReturnsMap';
import VIPInsights from '../components/VIPInsights';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  PortfolioSummaryCards,
  HoldingsTable,
  HoldingsCharts,
  HoldingsDiagnosis,
  TransactionBehaviorAnalysis,
  DCAPlansPanel,
  RiskAssessmentTab,
  DCACalculatorTab,
  TransactionHistoryTab,
  DeepAnalysisTab,
  GoalPlanningTab,
  SmartDCATab,
  AddEditRecordModal,
  DCAModal,
  SellModal,
} from '../components/portfolio';

export default function Portfolio() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isVIP = user?.subscription_status === 'premium';
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FundRecord | null>(null);
  const [form] = Form.useForm();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [productType, setProductType] = useState<'fund' | 'cmb'>('fund');
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'portfolio');

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);
  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dcaPlans, setDcaPlans] = useState<any[]>([]);
  const [dcaModalOpen, setDcaModalOpen] = useState(false);
  const [editingDca, setEditingDca] = useState<any | null>(null);
  const [dcaForm] = Form.useForm();
  const [syncing, setSyncing] = useState(false);

  const [benchmarkData, setBenchmarkData] = useState<any[]>([]);

  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellTarget, setSellTarget] = useState<PortfolioHolding | null>(null);
  const [sellForm] = Form.useForm();
  const [sellLoading, setSellLoading] = useState(false);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txStats, setTxStats] = useState<any>(null);
  const [txFilter, setTxFilter] = useState<string>('all');
  const [txLoading, setTxLoading] = useState(false);

  const [feeData, setFeeData] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  const [industryData, setIndustryData] = useState<any>(null);
  const [industryLoading, setIndustryLoading] = useState(false);

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
            // product not found
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
            // fund not found
          } finally {
            setLookupLoading(false);
          }
        }, 300);
      }
    }
  }, [form, productType]);

  const loadData = async () => {
    try {
      const [data, plans, benchmark] = await Promise.all([
        portfolioApi.getSummary(),
        portfolioApi.getDcaPlans().catch(() => []),
        fundApi.getHS300Benchmark().catch(() => []),
      ]);
      setSummary(data);
      setDcaPlans(plans);
      setBenchmarkData(benchmark);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'transactions' && transactions.length === 0) loadTransactions(); }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'analysis' && holdings.length > 0) {
      if (!industryData && !industryLoading) loadIndustryAllocation();
      if (!feeData && !feeLoading) loadFeeAnalysis();
      if (holdingsRisk.length === 0 && !holdingsRiskLoading) loadHoldingsRisk();
      if (!attributionData && !attributionLoading) loadAttribution();
      if (!overlapData && !overlapLoading) loadOverlap();
    }
  }, [activeTab]);

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
      loadData();
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await portfolioApi.importCSV(file);
      message.success(`成功导入 ${result.imported} 条记录`);
      if (result.errors?.length > 0) {
        message.warning(`${result.errors.length} 条记录导入失败`);
      }
      loadData();
    } catch {
      message.error('导入失败');
    }
    e.target.value = '';
  };

  const handleAlipayImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await portfolioApi.importAlipay(file);
      let msg = `成功导入 ${result.imported} 条记录`;
      if (result.skipped > 0) msg += `，跳过 ${result.skipped} 条非申购记录`;
      message.success(msg);
      if (result.errors?.length > 0) {
        message.warning(`${result.errors.length} 条记录导入失败`);
      }
      loadData();
    } catch (err: any) {
      message.error(err.message || '导入失败');
    }
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const csv = `fund_code,fund_name,shares,cost_price,buy_date,buy_fee,notes
013349,人工智能ETF联接A,1000,1.2345,2024-01-15,0,示例-完整信息
008887,,2000,,2026-03-15,,示例-根据名称自动查询代码和净值
,招商中证白酒指数A,1500,,2026-04-20,,示例-根据名称自动查询代码和净值
`;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '基金持仓导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHoldings = () => {
    if (!summary?.holdings?.length) {
      message.warning('暂无持仓数据可导出');
      return;
    }
    const escCsv = (v: string | number | null | undefined) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = '基金代码,基金名称,持有份额,成本价,总成本,当前净值,市值,盈亏,盈亏比例,净值更新时间';
    const rows = summary.holdings.map((h: PortfolioHolding) =>
      [h.fund_code, h.fund_name, h.total_shares, h.avg_cost_price, h.total_cost, h.current_nav, h.market_value, h.pnl, h.pnl_percent + '%', h.nav_updated_at || ''].map(escCsv).join(',')
    );
    const csv = header + '\n' + rows.join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `持仓明细_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
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

  const handleSell = async () => {
    if (!sellTarget) return;
    try {
      const values = await sellForm.validateFields();
      setSellLoading(true);
      const result = await portfolioApi.sellFund({
        fund_code: sellTarget.fund_code,
        shares: values.shares,
        sell_price: values.sell_price,
        sell_date: values.sell_date.format('YYYY-MM-DD'),
        sell_fee: values.sell_fee || 0,
        notes: values.notes,
      });
      message.success(`赎回成功！实现盈亏：${result.summary.realizedPnl >= 0 ? '+' : ''}¥${result.summary.realizedPnl}`);
      setSellModalOpen(false);
      loadData();
    } catch (e: any) {
      message.error(e.message || '赎回失败');
    } finally {
      setSellLoading(false);
    }
  };

  const loadTransactions = async (page = 1, type = 'all') => {
    setTxLoading(true);
    try {
      const data = await portfolioApi.getTransactions({ page, pageSize: 30, type: type === 'all' ? undefined : type });
      setTransactions(data.transactions);
      setTxTotal(data.total);
      setTxPage(data.page);
      setTxStats(data.stats);
    } catch (e) { console.error('加载交易记录失败:', e); }
    setTxLoading(false);
  };

  const loadFeeAnalysis = async () => {
    setFeeLoading(true);
    try {
      const data = await portfolioApi.getFeeAnalysis();
      setFeeData(data);
    } catch (e) { console.error('加载费用分析失败:', e); }
    setFeeLoading(false);
  };

  const loadIndustryAllocation = async () => {
    setIndustryLoading(true);
    try {
      const data = await portfolioApi.getIndustryAllocation();
      setIndustryData(data);
    } catch (e) { console.error('加载行业配置失败:', e); }
    setIndustryLoading(false);
  };

  const loadHoldingsRisk = async () => {
    setHoldingsRiskLoading(true);
    try {
      const data = await portfolioApi.getHoldingsRisk();
      setHoldingsRisk(data.holdings);
    } catch { /* ignore */ }
    setHoldingsRiskLoading(false);
  };

  const loadAttribution = async () => {
    setAttributionLoading(true);
    try {
      const data = await portfolioApi.getPerformanceAttribution();
      setAttributionData(data);
    } catch { /* ignore */ }
    setAttributionLoading(false);
  };

  const loadOverlap = async () => {
    setOverlapLoading(true);
    try {
      const data = await fundApi.getPortfolioOverlap();
      setOverlapData(data.error ? null : data);
    } catch { /* ignore */ }
    setOverlapLoading(false);
  };

  const getHoldingDays = (h: PortfolioHolding) => {
    const dates = h.records.filter(r => r.record_type !== 'sell').map(r => new Date(r.buy_date).getTime());
    if (dates.length === 0) return 0;
    return Math.floor((Date.now() - Math.min(...dates)) / 86400000);
  };

  const getFeeTier = (days: number) => {
    if (days >= 730) return { label: '免赎回费', color: '#52c41a', icon: <CheckCircleOutlined /> };
    if (days >= 365) return { label: '赎回费0.5%', color: '#faad14' };
    if (days >= 30) return { label: '赎回费0.5%', color: '#faad14' };
    return { label: '赎回费1.5%', color: '#ff4d4f', icon: <WarningOutlined /> };
  };

  const holdings = summary?.holdings || [];

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'portfolio') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: key }, { replace: true });
    }
  };

  useEffect(() => {
    const VALID_TABS = ['portfolio', 'risk', 'dca', 'transactions', 'analysis', 'goal', 'smart-dca', 'vip'];
    const urlTab = searchParams.get('tab');
    if (urlTab && VALID_TABS.includes(urlTab)) {
      if (urlTab === 'vip' && !isVIP) {
        setActiveTab('portfolio');
        setSearchParams({}, { replace: true });
      } else {
        setActiveTab(urlTab);
      }
    } else if (urlTab) {
      setActiveTab('portfolio');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, isVIP]);

  const tabItems = [
    {
      key: 'portfolio',
      label: <span><FundOutlined style={{ marginRight: 6 }} />理财记账</span>,
      children: (
        <>
          <PortfolioSummaryCards summary={summary} holdings={holdings} txStats={txStats} isDark={isDark} getHoldingDays={getHoldingDays} />
          {holdings.length > 0 && <ReturnsMap />}
          <HoldingsTable
            holdings={holdings}
            loading={loading}
            isDark={isDark}
            refreshing={refreshing}
            lastRefreshTime={lastRefreshTime}
            onRefreshNav={handleRefreshNav}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onImport={handleImport}
            onAlipayImport={handleAlipayImport}
            onDownloadTemplate={handleDownloadTemplate}
            onExportHoldings={handleExportHoldings}
            onSell={(h) => { setSellTarget(h); setSellModalOpen(true); sellForm.resetFields(); }}
            onReload={loadData}
            getHoldingDays={getHoldingDays}
            getFeeTier={getFeeTier}
          />
          <HoldingsCharts holdings={holdings} summary={summary} benchmarkData={benchmarkData} isDark={isDark} />
          <HoldingsDiagnosis holdings={holdings} isDark={isDark} getHoldingDays={getHoldingDays} getFeeTier={getFeeTier} />
          <TransactionBehaviorAnalysis holdings={holdings} txStats={txStats} isDark={isDark} getHoldingDays={getHoldingDays} />
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
      label: <span><SwapOutlined style={{ marginRight: 6 }} />交易流水</span>,
      children: (
        <TransactionHistoryTab
          transactions={transactions}
          txTotal={txTotal}
          txPage={txPage}
          txStats={txStats}
          txFilter={txFilter}
          txLoading={txLoading}
          onFilterChange={(v) => { setTxFilter(v); loadTransactions(1, v); }}
          onPageChange={(p) => { setTxPage(p); loadTransactions(p, txFilter); }}
          onRefresh={() => loadTransactions(txPage, txFilter)}
        />
      ),
    },
    {
      key: 'analysis',
      label: <span><BarChartOutlined style={{ marginRight: 6 }} />深度分析</span>,
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
          onRefreshIndustry={loadIndustryAllocation}
          onRefreshOverlap={loadOverlap}
          onRefreshFee={loadFeeAnalysis}
          onRefreshRisk={loadHoldingsRisk}
          onRefreshAttribution={loadAttribution}
        />
      ),
    },
    {
      key: 'goal',
      label: <span><TrophyOutlined style={{ marginRight: 6 }} />目标规划</span>,
      children: <GoalPlanningTab isDark={isDark} summary={summary} />,
    },
    {
      key: 'smart-dca',
      label: <span><ThunderboltOutlined style={{ marginRight: 6 }} />智慧定投</span>,
      children: <SmartDCATab isDark={isDark} />,
    },
    ...(isVIP ? [{
      key: 'vip',
      label: (
        <span style={{ position: 'relative' }}>
          <CrownOutlined style={{ marginRight: 6, color: '#ffd700' }} />
          VIP分析
          <span style={{
            position: 'absolute', top: -8, right: -16,
            background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
            color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 4,
            fontWeight: 700, lineHeight: '14px',
          }}>PRO</span>
        </span>
      ),
      children: <VIPInsights />,
    }] : []),
  ];

  return (
    <div className="fade-in">
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

      <SellModal
        sellModalOpen={sellModalOpen}
        sellTarget={sellTarget}
        sellForm={sellForm}
        sellLoading={sellLoading}
        onSubmit={handleSell}
        onCancel={() => setSellModalOpen(false)}
      />
    </div>
  );
}
