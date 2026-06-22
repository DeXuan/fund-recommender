import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, Input, AutoComplete, Table, Tag, Button, Space, Spin, Alert, Row, Col, Tooltip, message } from 'antd';
import { SearchOutlined, SwapOutlined, CloseCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi, fundCompareApi } from '../../services/api';
import { getEchartsTheme } from '../../utils/echarts-theme';
import { formatReturn, getReturnColor, getValuationText } from '../../utils/format';

interface Fund {
  code: string;
  name: string;
  type: string;
  company: string;
  index: string;
  industry: string;
  managementStyle?: string;
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

interface FundComparePanelProps {
  selectedCodes: string[];
  setSelectedCodes: React.Dispatch<React.SetStateAction<string[]>>;
  showCompare: boolean;
  setShowCompare: (v: boolean) => void;
  allFunds: Fund[];
  isDark: boolean;
}

export function FundComparePanel({
  selectedCodes, setSelectedCodes,
  showCompare, setShowCompare,
  allFunds, isDark,
}: FundComparePanelProps) {
  const [compareData, setCompareData] = useState<Fund[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareSearchCode, setCompareSearchCode] = useState('');
  const [navHistory, setNavHistory] = useState<Record<string, any[]>>({});
  const [premiumData, setPremiumData] = useState<any>(null);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [navHistoryLoading, setNavHistoryLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

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

  useEffect(() => {
    if (showCompare && selectedCodes.length > 0) {
      loadCompareData();
      loadNavHistory();
    } else {
      setCompareData([]);
      setCompareError(null);
      setNavHistory({});
    }
    setPremiumData(null);
  }, [selectedCodes, showCompare]);

  const addFundToCompare = useCallback((code?: string) => {
    const fundCode = (code || compareSearchCode).trim();
    if (!fundCode) return;
    if (selectedCodes.includes(fundCode)) return;
    if (selectedCodes.length >= 5) return;
    const exists = allFunds.some(f => f.code === fundCode);
    if (!exists) return;
    setSelectedCodes(prev => [...prev, fundCode]);
    setCompareSearchCode('');
  }, [compareSearchCode, selectedCodes, allFunds, setSelectedCodes]);

  const removeFundFromCompare = useCallback((code: string) => {
    setSelectedCodes(prev => prev.filter(c => c !== code));
  }, [setSelectedCodes]);

  const handleCompareSearchChange = useCallback((value: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setCompareSearchCode(value);
    }, 150);
  }, []);

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

  const navChartOption = useMemo(() => {
    const codes = Object.keys(navHistory);
    if (codes.length === 0) return null;
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

  const handlePremium = async () => {
    if (selectedCodes.length < 2) return;
    setPremiumLoading(true);
    try {
      const data = await fundCompareApi.premiumAnalyze(selectedCodes);
      setPremiumData(data);
    } catch (e: any) {
      if (e.message?.includes('会员')) {
        message.warning('深度分析需要开通会员');
      } else {
        message.error(e.message || '深度分析失败');
      }
    } finally {
      setPremiumLoading(false);
    }
  };

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

  const tableColumns = useMemo(() => [
    {
      title: '指标',
      dataIndex: 'label',
      key: 'label',
      width: 160,
      fixed: 'left' as const,
      render: (text: string, record: any) => {
        if (record.key.startsWith('_group')) {
          return <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>{text}</span>;
        }
        return <span style={{ fontWeight: 500 }}>{text}</span>;
      },
    },
    ...compareData.map(fund => ({
      title: <Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)' }}>{fund.name}<div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>{fund.code}</div></Link>,
      dataIndex: fund.code,
      key: fund.code,
      render: (val: any, record: any) => {
        if (record.key.startsWith('_group')) return null;
        if (val === '-' || val === undefined || val === null) return <span style={{ color: isDark ? '#555' : '#ccc' }}>-</span>;

        if (['return1y', 'return6m', 'return3m', 'return1m', 'return1w'].includes(record.key)) {
          const num = Number(val);
          return <span style={{ color: getReturnColor(num), fontWeight: 600 }}>{formatReturn(num)}</span>;
        }

        if (record.key === 'valuation') return getValuationText(val);

        if (record.key === 'rating') return <span style={{ color: 'var(--warning)' }}>{'★'.repeat(Number(val) || 0)}</span>;

        if (['managementFee', 'custodyFee', 'serviceFee', 'totalFee'].includes(record.key)) {
          const num = Number(val);
          if (isNaN(num)) return val;
          const isHigh = record.key === 'totalFee' && num > 0.8;
          return <span style={{ fontWeight: isHigh ? 700 : 500, color: isHigh ? 'var(--danger)' : undefined }}>{num.toFixed(2)}%</span>;
        }

        if (['pePercentile', 'pbPercentile'].includes(record.key)) {
          const num = Number(val);
          if (isNaN(num)) return val;
          const color = num < 30 ? '#52c41a' : num > 70 ? 'var(--danger)' : 'var(--primary)';
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
          return <span style={{ color: num > 0 ? '#52c41a' : 'var(--danger)', fontWeight: 600 }}>{num > 0 ? '+' : ''}{num}%</span>;
        }

        if (record.key === 'institutionHold') {
          const num = Number(val);
          if (isNaN(num)) return val;
          return <span style={{ fontWeight: num >= 10 ? 700 : 400, color: num >= 10 ? 'var(--warning)' : undefined }}>{num}%</span>;
        }

        if (record.key === 'dailyLimit') {
          return <span style={{ fontWeight: 600, color: val === '暂停' ? 'var(--danger)' : isDark ? '#e8e8e8' : '#333' }}>{val}</span>;
        }

        if (['recommendation', 'investmentAdvice'].includes(record.key)) {
          const text = String(val);
          return <Tooltip title={text}><span style={{ fontSize: 12 }}>{text.length > 30 ? text.slice(0, 30) + '...' : text}</span></Tooltip>;
        }

        return val;
      },
    })),
  ], [compareData, isDark]);

  if (!showCompare) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <Card
        title={
          <Space>
            <SwapOutlined style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 600, fontSize: 16 }}>基金对比</span>
          </Space>
        }
        extra={
          <Button
            type="text"
            icon={<CloseCircleOutlined />}
            onClick={() => { setShowCompare(false); setSelectedCodes([]); setPremiumData(null); }}
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
          <span style={{ color: isDark ? '#a0a0a0' : '#666', fontSize: 13 }}>已添加 {selectedCodes.length}/5 只基金</span>
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
        <Card style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
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
              <div style={{ textAlign: 'center', fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c' }}>
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

          {/* 深度分析按钮 */}
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <Button type="primary" loading={premiumLoading} onClick={handlePremium}
              disabled={selectedCodes.length < 2}>
              深度分析（会员）
            </Button>
          </div>

          {/* 深度分析结果 */}
          {premiumData && (
            <>
              <Card title="风险指标" style={{ marginBottom: 16 }}>
                <Table dataSource={premiumData.results} rowKey="code" size="small" pagination={false}
                  columns={[
                    { title: '基金', dataIndex: 'name' },
                    { title: '年化波动率', render: (_: any, r: any) => `${r.riskMetrics.volatility}%` },
                    { title: '最大回撤', render: (_: any, r: any) => <span style={{ color: 'var(--danger)' }}>{r.riskMetrics.maxDrawdown}%</span> },
                    { title: '夏普比率', render: (_: any, r: any) => <span style={{ color: r.riskMetrics.sharpeRatio > 0 ? '#52c41a' : 'var(--danger)' }}>{r.riskMetrics.sharpeRatio}</span> },
                    { title: '卡玛比率', render: (_: any, r: any) => r.riskMetrics.calmarRatio },
                    { title: '3年持有成本', render: (_: any, r: any) => `${r.feeComparison.cost3y}%` },
                  ]}
                />
              </Card>
              <Card title="投资建议" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><Tag color="blue">短期</Tag> {premiumData.recommendation.shortTerm}</div>
                  <div><Tag color="green">中期</Tag> {premiumData.recommendation.mediumTerm}</div>
                  <div><Tag color="purple">长期</Tag> {premiumData.recommendation.longTerm}</div>
                  <div><Tag color="orange">低费率</Tag> {premiumData.recommendation.lowestFee}</div>
                </Space>
              </Card>
            </>
          )}
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
  );
}
