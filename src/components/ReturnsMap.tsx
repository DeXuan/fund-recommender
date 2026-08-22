import { useState, useEffect } from 'react';
import { Card, Select, Row, Col, Statistic, Spin, Empty, Tag, Progress, Alert, Tooltip, Badge, Space, Modal, Table } from 'antd';
import {
  CalendarOutlined, FundOutlined,
  ExclamationCircleOutlined, CheckCircleOutlined, BulbOutlined,
  RiseOutlined, GlobalOutlined, SafetyOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { portfolioApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface CategoryData {
  name: string;
  value: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
  funds: { code: string; name: string; value: number; pnl: number; pnlPercent: number }[];
}

interface MarketIndex {
  code: string; name: string; price: number; changePercent: number;
  pe: number; pePercentile: number; valuation: string; suggestion: string;
}

interface Suggestion {
  type: string; level: string; title: string; detail: string;
}

interface InsightsData {
  holdings: any[];
  categories: CategoryData[];
  market: MarketIndex[];
  riskProfile: { riskType: string; riskLevel: string; expectedReturn: string; allocation: any[] } | null;
  suggestions: Suggestion[];
  totalValue: number;
}

interface ReturnsMapData {
  data: { date: string; return: number; value: number }[];
  year: number;
  summary: { totalDays: number; profitDays: number; lossDays: number; flatDays: number; totalReturn: number; maxProfit: number; maxLoss: number };
}

const CATEGORY_META: Record<string, { label: string; group: string; color: string; icon: React.ReactNode }> = {
  '海外股': { label: '海外股', group: '进阶理财', color: '#722ed1', icon: <GlobalOutlined /> },
  '国内股(进攻)': { label: '国内股(进攻)', group: '进阶理财', color: '#cf1322', icon: <RiseOutlined /> },
  '国内股(防御)': { label: '国内股(防御)', group: '稳健理财', color: '#1890ff', icon: <SafetyOutlined /> },
  '固收': { label: '固收', group: '稳健理财', color: '#52c41a', icon: <FundOutlined /> },
  '货币基金': { label: '货币基金', group: '稳健理财', color: '#8c8c8c', icon: <FundOutlined /> },
};

export default function ReturnsMap() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [mapData, setMapData] = useState<ReturnsMapData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [dailyModal, setDailyModal] = useState<{ open: boolean; date: string; data: any[]; total: number; loading: boolean }>({ open: false, date: '', data: [], total: 0, loading: false });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      portfolioApi.getInsights().catch(() => null),
      portfolioApi.getReturnsMap(year).catch(() => null),
    ]).then(([ins, ret]) => {
      if (!cancelled) {
        setInsights(ins);
        setMapData(ret);
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year]);

  const pnlColor = (v: number) => v >= 0 ? '#cf1322' : '#3f8600';
  const pnlSign = (v: number) => v >= 0 ? '+' : '';

  if (loading) {
    return <Card style={{ marginBottom: 24 }}><div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" /></div></Card>;
  }

  if (!insights || (insights.holdings.length === 0 && (!mapData || mapData.data.length === 0))) {
    return <Card title={<><CalendarOutlined style={{ marginRight: 8 }} />收益地图</>} style={{ marginBottom: 24 }}><Empty description="暂无持仓数据" /></Card>;
  }

  const { categories, market, riskProfile, suggestions } = insights;

  // 分组：进阶理财 / 稳健理财
  const advanced = categories.filter(c => CATEGORY_META[c.name]?.group === '进阶理财');
  const stable = categories.filter(c => CATEGORY_META[c.name]?.group === '稳健理财');
  const advancedWeight = advanced.reduce((s, c) => s + c.weight, 0);
  const stableWeight = stable.reduce((s, c) => s + c.weight, 0);
  const advancedPnl = advanced.reduce((s, c) => s + c.pnl, 0);
  const stablePnl = stable.reduce((s, c) => s + c.pnl, 0);

  // 日历热力图配置
  const getCalendarOption = () => {
    if (!mapData || mapData.data.length === 0) return null;
    const returns = mapData.data.map(d => d.return).filter(v => v !== 0);
    const maxAbs = Math.max(...returns.map(Math.abs), 1);
    const heatData: [string, number][] = mapData.data.map(d => [d.date, d.return]);
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return {
      tooltip: {
        formatter: (params: any) => {
          const [date, value] = params.data;
          const color = value >= 0 ? '#cf1322' : '#3f8600';
          return `<div style="font-size:13px"><div style="font-weight:600;margin-bottom:4px">${date}</div><div>当日收益: <span style="color:${color};font-weight:600">${value >= 0 ? '+' : ''}¥${value.toLocaleString()}</span></div><div style="margin-top:4px;color:#999;font-size:11px">点击查看明细</div></div>`;
        },
      },
      visualMap: { show: true, min: -maxAbs, max: maxAbs, orient: 'horizontal', left: 'center', bottom: 6, itemWidth: 14, itemHeight: 120, text: ['盈利', '亏损'], textStyle: { fontSize: 11, color: isDark ? '#a0a0a0' : '#666' }, inRange: { color: ['#237804', '#3f8600', '#52c41a', '#d9d9d9', '#ff7875', '#ff4d4f', '#cf1322'] } },
      calendar: { top: 30, left: 50, right: 30, bottom: 60, cellSize: ['auto', 15], range: String(year), itemStyle: { borderWidth: 2, borderColor: '#fff' }, splitLine: { show: true }, yearLabel: { show: false }, monthLabel: { nameMap: monthNames, fontSize: 11, color: isDark ? '#a0a0a0' : '#666' }, dayLabel: { nameMap: ['日', '一', '二', '三', '四', '五', '六'], fontSize: 10, color: isDark ? '#6b6b6b' : '#999' } },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: heatData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } } }],
    };
  };

  const handleCalendarClick = async (params: any) => {
    if (!params.data) return;
    const [date] = params.data;
    setDailyModal({ open: true, date, data: [], total: 0, loading: true });
    try {
      const detail = await portfolioApi.getDailyDetail(date);
      setDailyModal({ open: true, date, data: detail.funds || [], total: detail.total_pnl || 0, loading: false });
    } catch {
      setDailyModal({ open: true, date, data: [], total: 0, loading: false });
    }
  };

  // 资产分类饼图
  const getCategoryPieOption = () => {
    if (categories.length === 0) return null;
    return {
      tooltip: { formatter: (p: any) => `${p.name}<br/>市值: ¥${p.value.toLocaleString()}<br/>占比: ${p.percent}%` },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['35%', '60%'], center: ['50%', '42%'],
        label: { formatter: '{b}\n{d}%', fontSize: 10 },
        data: categories.map(c => ({ name: CATEGORY_META[c.name]?.label || c.name, value: c.value, itemStyle: { color: CATEGORY_META[c.name]?.color || (isDark ? '#6b6b6b' : '#999') } })),
      }],
    };
  };

  // 分类收益柱状图
  const getCategoryBarOption = () => {
    if (categories.length === 0) return null;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 80, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { formatter: '{value}%', fontSize: 10 } },
      yAxis: { type: 'category', data: categories.map(c => CATEGORY_META[c.name]?.label || c.name), axisLabel: { fontSize: 11 } },
      series: [{
        type: 'bar', barWidth: 18,
        data: categories.map(c => ({
          value: c.pnlPercent,
          itemStyle: { color: c.pnlPercent >= 0 ? '#cf1322' : '#3f8600', borderRadius: c.pnlPercent >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] },
        })),
        label: { show: true, position: 'right', formatter: (p: any) => `${p.value >= 0 ? '+' : ''}${p.value}%`, fontSize: 10 },
      }],
    };
  };

  const suggestionIcon = (type: string) => {
    switch (type) {
      case 'risk': return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'opportunity': return <BulbOutlined style={{ color: '#1890ff' }} />;
      case 'market': return <RiseOutlined style={{ color: '#722ed1' }} />;
      case 'rebalance': return <FundOutlined style={{ color: '#13c2c2' }} />;
      case 'action': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'balance': return <SafetyOutlined style={{ color: '#fa8c16' }} />;
      default: return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
  };

  const alertType = (level: string) => {
    switch (level) {
      case 'warning': return 'warning';
      case 'info': return 'info';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      {/* ============ 1. 收益地图（日历热力图） ============ */}
      <Card
        title={<><CalendarOutlined style={{ marginRight: 8 }} />收益地图</>}
        extra={
          <Space>
            {mapData && (
              <span style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
                胜率 <b style={{ color: '#1890ff' }}>{mapData.summary.totalDays > 0 ? ((mapData.summary.profitDays / mapData.summary.totalDays) * 100).toFixed(0) : 0}%</b>
                &nbsp;·&nbsp;
                盈利 <b style={{ color: '#cf1322' }}>{mapData.summary.profitDays}</b>天
                &nbsp;·&nbsp;
                亏损 <b style={{ color: '#3f8600' }}>{mapData.summary.lossDays}</b>天
              </span>
            )}
            <Select value={year} onChange={setYear} style={{ width: 90 }} size="small" options={yearOptions.map(y => ({ value: y, label: `${y}年` }))} />
          </Space>
        }
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        {mapData && mapData.data.length > 0 ? (
          <>
            <Row gutter={16} style={{ marginBottom: 8 }}>
              <Col span={6}><Statistic title="年度收益" value={mapData.summary.totalReturn} precision={2} prefix="¥" valueStyle={{ fontSize: 20, color: pnlColor(mapData.summary.totalReturn) }} /></Col>
              <Col span={6}><Statistic title="最大单日盈利" value={mapData.summary.maxProfit} precision={2} prefix="¥" valueStyle={{ fontSize: 16, color: '#cf1322' }} /></Col>
              <Col span={6}><Statistic title="最大单日亏损" value={mapData.summary.maxLoss} precision={2} prefix="¥" valueStyle={{ fontSize: 16, color: '#3f8600' }} /></Col>
              <Col span={6}><Statistic title="交易天数" value={mapData.summary.totalDays} suffix="天" valueStyle={{ fontSize: 16 }} /></Col>
            </Row>
            <ReactECharts option={getCalendarOption()} theme={getEchartsTheme(isDark)} style={{ height: 180, width: '100%' }} opts={{ renderer: 'svg' }} onEvents={{ click: handleCalendarClick }} />
          </>
        ) : (
          <Empty description={`${year}年暂无收益数据`} />
        )}
      </Card>

      {/* ============ 2. 收益分布区 ============ */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {/* 左：资产配置饼图 */}
        <Col xs={24} lg={10}>
          <Card title="资产配置分布" bodyStyle={{ padding: '12px 16px' }} style={{ height: '100%' }}>
            {categories.length > 0 ? (
              <>
                <ReactECharts option={getCategoryPieOption()} theme={getEchartsTheme(isDark)} style={{ height: 260 }} />
                <Row gutter={8} style={{ textAlign: 'center', borderTop: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`, paddingTop: 8 }}>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#888' }}>进阶理财</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: advancedPnl >= 0 ? '#cf1322' : '#3f8600' }}>{advancedWeight.toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>{pnlSign(advancedPnl)}¥{Math.abs(advancedPnl).toFixed(0)}</div>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 12, color: '#888' }}>稳健理财</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: stablePnl >= 0 ? '#cf1322' : '#3f8600' }}>{stableWeight.toFixed(0)}%</div>
                    <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>{pnlSign(stablePnl)}¥{Math.abs(stablePnl).toFixed(0)}</div>
                  </Col>
                </Row>
              </>
            ) : <Empty description="暂无配置数据" />}
          </Card>
        </Col>

        {/* 右：各资产类别明细 */}
        <Col xs={24} lg={14}>
          <Card title="收益分布" bodyStyle={{ padding: '8px 16px' }} style={{ height: '100%' }}>
            {/* 进阶理财 */}
            {advanced.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#722ed1' }}>
                  <RiseOutlined style={{ marginRight: 4 }} />进阶理财 <span style={{ fontWeight: 400, color: isDark ? '#6b6b6b' : '#999', fontSize: 11 }}>（高波动·高收益）</span>
                </div>
                {advanced.map(cat => (
                  <CategoryRow key={cat.name} cat={cat} />
                ))}
              </div>
            )}
            {/* 稳健理财 */}
            {stable.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#1890ff' }}>
                  <SafetyOutlined style={{ marginRight: 4 }} />稳健理财 <span style={{ fontWeight: 400, color: isDark ? '#6b6b6b' : '#999', fontSize: 11 }}>（低波动·稳健收益）</span>
                </div>
                {stable.map(cat => (
                  <CategoryRow key={cat.name} cat={cat} />
                ))}
              </div>
            )}
            {/* 收益率柱状图 */}
            {categories.length > 1 && (
              <div style={{ borderTop: `1px solid ${isDark ? '#262626' : '#f0f0f0'}`, paddingTop: 8, marginTop: 4 }}>
                <ReactECharts option={getCategoryBarOption()} theme={getEchartsTheme(isDark)} style={{ height: Math.max(categories.length * 36, 100) }} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ============ 3. 市场行情概览 ============ */}
      {market.length > 0 && (
        <Card title="市场估值概览" bodyStyle={{ padding: '8px 16px' }} style={{ marginBottom: 16 }}>
          <Row gutter={[12, 8]}>
            {market.map(m => (
              <Col xs={12} sm={8} md={4} key={m.code}>
                <div style={{ textAlign: 'center', padding: '6px 0', background: isDark ? '#262626' : '#fafafa', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>{m.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: m.changePercent >= 0 ? '#cf1322' : '#3f8600' }}>
                    {m.price > 0 ? m.price.toFixed(2) : '--'}
                    {m.changePercent !== 0 && (
                      <span style={{ fontSize: 11, marginLeft: 4 }}>
                        {m.changePercent >= 0 ? '+' : ''}{m.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  {m.pePercentile > 0 && (
                    <Tooltip title={`PE分位: ${m.pePercentile.toFixed(0)}% | ${m.valuation}`}>
                      <Progress
                        percent={m.pePercentile}
                        size="small"
                        showInfo={false}
                        strokeColor={m.pePercentile < 30 ? '#52c41a' : m.pePercentile < 70 ? '#1890ff' : '#ff4d4f'}
                        style={{ margin: '2px 8px 0' }}
                      />
                    </Tooltip>
                  )}
                  {m.valuation && <div style={{ fontSize: 10, color: m.valuation.includes('低') ? '#52c41a' : m.valuation.includes('高') ? '#ff4d4f' : '#1890ff' }}>{m.valuation}</div>}
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* ============ 4. 风险评估 + 智能建议 ============ */}
      <Row gutter={16}>
        {/* 风险画像 */}
        {riskProfile && (
          <Col xs={24} lg={8}>
            <Card
              title={<><SafetyOutlined style={{ marginRight: 8 }} />风险画像</>}
              bodyStyle={{ padding: '12px 16px' }}
              style={{ marginBottom: 16, height: '100%' }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <Badge
                  count={riskProfile.riskType}
                  style={{
                    backgroundColor: riskProfile.riskLevel === 'high' ? '#cf1322' : riskProfile.riskLevel === 'medium' ? '#1890ff' : '#52c41a',
                    fontSize: 16, padding: '0 12px', height: 28, lineHeight: '28px',
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
                  预期年化收益 <b>{riskProfile.expectedReturn}</b>
                </div>
              </div>
              {riskProfile.allocation && (
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: isDark ? '#e8e8e8' : '#333' }}>建议配置：</div>
                  {riskProfile.allocation.map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px dashed ${isDark ? '#262626' : '#f0f0f0'}` }}>
                      <span>{a.industry}</span>
                      <span style={{ fontWeight: 600 }}>{a.percentage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        )}

        {/* 智能建议 */}
        <Col xs={24} lg={riskProfile ? 16 : 24}>
          <Card
            title={<><BulbOutlined style={{ marginRight: 8 }} />投资建议</>}
            bodyStyle={{ padding: '8px 16px' }}
            style={{ marginBottom: 16 }}
          >
            {suggestions.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {suggestions.map((s, i) => (
                  <Alert
                    key={i}
                    type={alertType(s.level) as any}
                    icon={suggestionIcon(s.type)}
                    message={<span style={{ fontWeight: 600 }}>{s.title}</span>}
                    description={s.detail}
                    showIcon
                    style={{ borderRadius: 6 }}
                  />
                ))}
              </Space>
            ) : (
              <Empty description="暂无建议" />
            )}
            {!riskProfile && (
              <div style={{ textAlign: 'center', marginTop: 12, padding: '8px', background: isDark ? '#162312' : '#f6ffed', borderRadius: 6, fontSize: 12, color: '#389e0d' }}>
                完成 <a href="/web/risk-assessment" style={{ fontWeight: 600 }}>风险评估</a> 可获得个性化配置建议
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        open={dailyModal.open}
        onCancel={() => setDailyModal({ ...dailyModal, open: false })}
        footer={null}
        title={`${dailyModal.date} 收益明细`}
        width={600}
      >
        {dailyModal.loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : dailyModal.data.length === 0 ? (
          <Empty description="当日无收益数据" />
        ) : (
          <>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>当日总收益: </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: dailyModal.total >= 0 ? '#cf1322' : '#3f8600' }}>
                {dailyModal.total >= 0 ? '+' : ''}¥{dailyModal.total.toFixed(2)}
              </span>
            </div>
            <Table
              size="small"
              pagination={false}
              dataSource={dailyModal.data}
              rowKey="fund_code"
              columns={[
                { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true },
                { title: '份额', dataIndex: 'shares', key: 'shares', align: 'right' as const, render: (v: number) => v.toFixed(2) },
                { title: '前日净值', dataIndex: 'prev_nav', key: 'prev_nav', align: 'right' as const, render: (v: number) => v.toFixed(4) },
                { title: '当日净值', dataIndex: 'curr_nav', key: 'curr_nav', align: 'right' as const, render: (v: number) => v.toFixed(4) },
                { title: '盈亏', dataIndex: 'pnl', key: 'pnl', align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600', fontWeight: 600 }}>{v >= 0 ? '+' : ''}¥{v.toFixed(2)}</span> },
                { title: '涨跌幅', dataIndex: 'pnl_percent', key: 'pnl_percent', align: 'right' as const, render: (v: number) => <Tag color={v >= 0 ? 'red' : 'green'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</Tag> },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

// 资产类别行组件
function CategoryRow({ cat }: { cat: CategoryData }) {
  const { isDark } = useTheme();
  const meta = CATEGORY_META[cat.name] || { label: cat.name, color: isDark ? '#6b6b6b' : '#999', icon: null };
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={6}>
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{meta.label}</span>
          <Tag color={meta.color} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{cat.weight.toFixed(1)}%</Tag>
        </Space>
        <Space size={12}>
          <span style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>¥{cat.value.toLocaleString()}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: cat.pnl >= 0 ? '#cf1322' : '#3f8600' }}>
            {cat.pnl >= 0 ? '+' : ''}{cat.pnlPercent.toFixed(2)}%
          </span>
        </Space>
      </div>
      {/* 子基金明细 */}
      {cat.funds.length > 0 && (
        <div style={{ marginLeft: 22, marginTop: 2 }}>
          {cat.funds.map(f => (
            <div key={f.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', padding: '1px 0' }}>
              <span>{f.name.length > 12 ? f.name.slice(0, 12) + '...' : f.name}</span>
              <span style={{ color: f.pnl >= 0 ? '#cf1322' : '#3f8600' }}>{f.pnl >= 0 ? '+' : ''}{f.pnlPercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
      <Progress
        percent={cat.weight}
        showInfo={false}
        strokeColor={meta.color}
        size="small"
        style={{ margin: '2px 0 0' }}
      />
    </div>
  );
}
