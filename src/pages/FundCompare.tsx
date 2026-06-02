import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, Input, Table, Tag, Button, Space, Spin, AutoComplete, Alert, Row, Col, Tooltip } from 'antd';
import { SearchOutlined, CloseCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
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
}

export default function FundCompare() {
  const [searchParams] = useSearchParams();
  const initialCodes = (searchParams.get('codes')?.split(',') || [])
    .filter(code => /^\d{6}$/.test(code));

  const [compareList, setCompareList] = useState<string[]>(initialCodes);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [allFunds, setAllFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAllFunds();
  }, []);

  useEffect(() => {
    if (compareList.length > 0) {
      loadCompareFunds();
    } else {
      setFunds([]);
      setError(null);
    }
  }, [compareList]);

  const loadAllFunds = async () => {
    try {
      const data = await fundApi.getFunds();
      setAllFunds(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('加载基金列表失败:', error);
      setAllFunds([]);
    }
  };

  const loadCompareFunds = async () => {
    if (compareList.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fundApi.compareFunds(compareList);
      setFunds(Array.isArray(data) ? data.filter((f: Fund | null) => f && f.code) : []);
    } catch (error) {
      console.error('加载对比数据失败:', error);
      setFunds([]);
      setError('加载对比数据失败，请检查基金代码是否正确');
    } finally {
      setLoading(false);
    }
  };

  const addFund = useCallback((code?: string) => {
    const fundCode = (code || searchCode).trim();
    if (!fundCode) return;
    if (compareList.includes(fundCode)) return;
    if (compareList.length >= 5) return;
    // 验证基金代码是否存在
    const exists = allFunds.some(f => f.code === fundCode);
    if (!exists) return;
    setCompareList(prev => [...prev, fundCode]);
    setSearchCode('');
  }, [searchCode, compareList, allFunds]);

  const removeFund = useCallback((code: string) => {
    setCompareList(prev => prev.filter(c => c !== code));
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setSearchCode(value);
    }, 150);
  }, []);

  // 搜索选项 - 使用 useMemo 缓存，只返回 value 字符串数组避免 JSX 开销
  const searchOptions = useMemo(() => {
    const keyword = searchCode.trim();
    if (!keyword || allFunds.length === 0) return [];
    return allFunds
      .filter(f => f.code.includes(keyword) || f.name.includes(keyword))
      .slice(0, 8)
      .map(f => ({
        value: f.code,
        label: `${f.code} - ${f.name} (${f.industry})`,
      }));
  }, [searchCode, allFunds]);

  // 图表配置
  const compareChartOption = useMemo(() => {
    if (funds.length < 2) return null;
    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: funds.map(f => f.name) },
      xAxis: {
        type: 'category' as const,
        data: ['近1年', '近6月', '近3月', '近1月', '近1周'],
      },
      yAxis: { type: 'value' as const, axisLabel: { formatter: '{value}%' } },
      series: funds.map((fund, i) => ({
        name: fund.name,
        type: 'bar' as const,
        data: [fund.return1y ?? 0, fund.return6m ?? 0, fund.return3m ?? 0, fund.return1m ?? 0, fund.return1w ?? 0],
        itemStyle: {
          color: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1'][i % 5],
        },
      })),
    };
  }, [funds]);

  // 对比表格数据 - 全量字段
  const tableData = useMemo(() => {
    if (funds.length === 0) return [];
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
    const entries = (key: string) => Object.fromEntries(funds.map(f => [f.code, key]));

    return [
      // === 基本信息 ===
      { key: '_group_basic', label: '📋 基本信息', ...entries('_group') },
      { key: 'index', label: '跟踪指数', ...Object.fromEntries(funds.map(f => [f.code, f.index || '-'])) },
      { key: 'type', label: '基金类型', ...Object.fromEntries(funds.map(f => [f.code, f.type || '-'])) },
      { key: 'nav', label: '最新净值', ...Object.fromEntries(funds.map(f => [f.code, f.nav?.toFixed(4) ?? '-'])) },
      { key: 'fundManager', label: '基金经理', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'fundManager')])) },
      { key: 'company', label: '基金公司', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'company')])) },

      // === 收益指标 ===
      { key: '_group_return', label: '📈 收益指标', ...entries('_group') },
      { key: 'return1y', label: '近1年收益', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'return1y')])) },
      { key: 'return6m', label: '近6月收益', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'return6m')])) },
      { key: 'return3m', label: '近3月收益', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'return3m')])) },
      { key: 'return1m', label: '近1月收益', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'return1m')])) },
      { key: 'return1w', label: '近1周收益', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'return1w')])) },

      // === 费率详情 ===
      { key: '_group_fee', label: '💰 费率详情', ...entries('_group') },
      { key: 'managementFee', label: '管理费率/年', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'managementFee')])) },
      { key: 'custodyFee', label: '托管费率/年', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'custodyFee')])) },
      { key: 'serviceFee', label: '销售服务费/年', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'serviceFee')])) },
      { key: 'totalFee', label: '综合费率/年', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'totalFee')])) },
      { key: 'purchaseFee', label: '申购费率(原)', ...Object.fromEntries(funds.map(f => [f.code, f.purchaseFee ? `${f.purchaseFee}%` : '-'])) },
      { key: 'purchaseFeeDiscount', label: '申购费率(支付宝1折)', ...Object.fromEntries(funds.map(f => [f.code, f.purchaseFeeDiscount ? `${f.purchaseFeeDiscount}%` : '-'])) },
      { key: 'redeemFee', label: '赎回费率(≥1年)', ...Object.fromEntries(funds.map(f => [f.code, f.redeemFee?.find(r => r.period.includes('1-2年') || r.period.includes('1年'))?.rate !== undefined ? `${f.redeemFee.find(r => r.period.includes('1-2年') || r.period.includes('1年'))!.rate}%` : '-'])) },

      // === 规模与持有人 ===
      { key: '_group_holder', label: '📊 规模与持有人', ...entries('_group') },
      { key: 'scale', label: '基金规模(亿)', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'scale', 1)])) },
      { key: 'share', label: '份额(亿份)', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'share')])) },
      { key: 'shareChange', label: '份额变化(%)', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'shareChange')])) },
      { key: 'institutionHold', label: '机构持有(%)', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'institutionHold')])) },
      { key: 'individualHold', label: '个人持有(%)', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'individualHold')])) },

      // === 申购与限额 ===
      { key: '_group_purchase', label: '🔑 申购与限额', ...entries('_group') },
      { key: 'purchaseStatus', label: '申购状态', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'purchaseStatus')])) },
      { key: 'dailyLimit', label: '每日限额', ...Object.fromEntries(funds.map(f => [f.code, f.dailyLimit === 0 ? '暂停' : f.dailyLimit ? `${f.dailyLimit}万` : '-'])) },

      // === 估值指标 ===
      { key: '_group_valuation', label: '📉 估值指标', ...entries('_group') },
      { key: 'pe', label: 'PE(TTM)', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'pe')])) },
      { key: 'pb', label: 'PB', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'pb')])) },
      { key: 'pePercentile', label: 'PE历史分位(%)', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'pePercentile')])) },
      { key: 'pbPercentile', label: 'PB历史分位(%)', ...Object.fromEntries(funds.map(f => [f.code, safeNum(f, 'pbPercentile')])) },
      { key: 'valuation', label: '估值判断', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'valuation')])) },

      // === 综合评价 ===
      { key: '_group_summary', label: '⭐ 综合评价', ...entries('_group') },
      { key: 'rating', label: '推荐评级', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'rating')])) },
      { key: 'riskLevel', label: '风险等级', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'riskLevel')])) },
      { key: 'suitableFor', label: '适合人群', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'suitableFor')])) },
      { key: 'recommendation', label: '推荐理由', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'recommendation')])) },
      { key: 'investmentAdvice', label: '投资建议', ...Object.fromEntries(funds.map(f => [f.code, safeStr(f, 'investmentAdvice')])) },

      // === 前十大重仓股 ===
      { key: '_group_holdings', label: '🏢 前十大重仓股', ...entries('_group') },
      ...Array.from({ length: 10 }, (_, i) => ({
        key: `holding_${i}`,
        label: `重仓${i + 1}`,
        ...Object.fromEntries(funds.map(f => [f.code, f.topHoldings?.[i] ? `${f.topHoldings[i].name} (${f.topHoldings[i].percentage}%)` : '-'])),
      })),
    ];
  }, [funds]);

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
    ...funds.map(fund => ({
      title: <Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>{fund.name}<div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{fund.code}</div></Link>,
      dataIndex: fund.code,
      key: fund.code,
      render: (val: any, record: any) => {
        // 分组行不渲染数据
        if (record.key.startsWith('_group')) return null;
        if (val === '-' || val === undefined || val === null) return <span style={{ color: '#ccc' }}>-</span>;

        // 收益率 - 红涨绿跌
        if (['return1y', 'return6m', 'return3m', 'return1m', 'return1w'].includes(record.key)) {
          const num = Number(val);
          return <span style={{ color: getReturnColor(num), fontWeight: 600 }}>{formatReturn(num)}</span>;
        }

        // 估值判断
        if (record.key === 'valuation') return getValuationText(val);

        // 评级
        if (record.key === 'rating') return <span style={{ color: '#faad14' }}>{'★'.repeat(Number(val) || 0)}</span>;

        // 费率 - 高费率标红
        if (['managementFee', 'custodyFee', 'serviceFee', 'totalFee'].includes(record.key)) {
          const num = Number(val);
          if (isNaN(num)) return val;
          const isHigh = record.key === 'totalFee' && num > 0.8;
          return <span style={{ fontWeight: isHigh ? 700 : 500, color: isHigh ? '#ff4d4f' : undefined }}>{num.toFixed(2)}%</span>;
        }

        // PE/PB分位
        if (['pePercentile', 'pbPercentile'].includes(record.key)) {
          const num = Number(val);
          if (isNaN(num)) return val;
          const color = num < 30 ? '#52c41a' : num > 70 ? '#ff4d4f' : '#1677ff';
          return <span style={{ color, fontWeight: 600 }}>{num.toFixed(1)}%</span>;
        }

        // 申购状态
        if (record.key === 'purchaseStatus') {
          const statusMap: Record<string, { color: string; text: string }> = {
            open: { color: 'green', text: '开放申购' },
            limited: { color: 'orange', text: '限大额' },
            suspended: { color: 'red', text: '暂停申购' },
          };
          const s = statusMap[val] || { color: 'default', text: val };
          return <Tag color={s.color}>{s.text}</Tag>;
        }

        // 风险等级
        if (record.key === 'riskLevel') {
          const riskMap: Record<string, { color: string; text: string }> = {
            low: { color: 'green', text: '低风险' },
            medium: { color: 'blue', text: '中风险' },
            high: { color: 'red', text: '高风险' },
          };
          const r = riskMap[val] || { color: 'default', text: val };
          return <Tag color={r.color}>{r.text}</Tag>;
        }

        // 份额变化 - 增长标绿，缩减标红
        if (record.key === 'shareChange') {
          const num = Number(val);
          if (isNaN(num)) return val;
          return <span style={{ color: num > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>{num > 0 ? '+' : ''}{num}%</span>;
        }

        // 机构持有 - 高比例高亮
        if (record.key === 'institutionHold') {
          const num = Number(val);
          if (isNaN(num)) return val;
          return <span style={{ fontWeight: num >= 10 ? 700 : 400, color: num >= 10 ? '#faad14' : undefined }}>{num}%</span>;
        }

        // 每日限额
        if (record.key === 'dailyLimit') {
          return <span style={{ fontWeight: 600, color: val === '暂停' ? '#ff4d4f' : '#333' }}>{val}</span>;
        }

        // 推荐理由/投资建议 - 缩短显示
        if (['recommendation', 'investmentAdvice'].includes(record.key)) {
          const text = String(val);
          return <Tooltip title={text}><span style={{ fontSize: 12 }}>{text.length > 30 ? text.slice(0, 30) + '...' : text}</span></Tooltip>;
        }

        return val;
      },
    })),
  ], [funds]);

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>基金对比</h1>

      <Card title="添加基金到对比" style={{ marginBottom: 16 }}>
        <Space>
          <AutoComplete
            value={searchCode}
            onChange={handleSearchChange}
            options={searchOptions}
            onSelect={(value) => {
              setSearchCode('');
              addFund(value);
            }}
            style={{ width: 400 }}
            placeholder="输入基金代码或名称搜索..."
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => addFund()}
            disabled={!searchCode.trim() || compareList.length >= 5}
          >
            添加
          </Button>
        </Space>
        <div style={{ marginTop: 12 }}>
          <span style={{ color: '#666', fontSize: 13 }}>已添加 {compareList.length}/5 只基金</span>
          {compareList.length > 0 && (
            <Space size={8} wrap style={{ marginTop: 8 }}>
              {compareList.map((code) => {
                const fund = allFunds.find(f => f.code === code);
                return (
                  <Tag
                    key={code}
                    closable
                    onClose={() => removeFund(code)}
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

      {error && (
        <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : funds.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <p style={{ fontSize: 16 }}>请添加基金开始对比</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>支持同时对比最多5只基金</p>
        </Card>
      ) : (
        <>
          {/* 对比柱状图 */}
          {compareChartOption && (
            <Card title="收益对比" style={{ marginBottom: 16 }}>
              <ReactECharts option={compareChartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
            </Card>
          )}

          <Card title="对比详情" style={{ marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <Table
                dataSource={tableData}
                columns={tableColumns}
                pagination={false}
                size="small"
                scroll={{ x: 600 }}
                rowKey="key"
                rowClassName={(record) => record.key.startsWith('_group') ? 'compare-group-row' : ''}
              />
            </div>

            {funds.length >= 2 && (() => {
              const validFunds = funds.filter(f => f.return1y !== undefined && f.return1y !== null);
              if (validFunds.length < 2) return null;
              const bestReturn = validFunds.reduce((best, f) => f.return1y > best.return1y ? f : best);
              const validFeeFunds = funds.filter(f => f.totalFee !== undefined && f.totalFee !== null);
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
          ].map((combo) => (
            <Col xs={24} sm={8} key={combo.label}>
              <Button block onClick={() => setCompareList(combo.codes)} style={{ marginBottom: 8 }}>
                {combo.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
