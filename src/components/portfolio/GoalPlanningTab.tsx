import { useState } from 'react';
import { Card, InputNumber, Row, Col, Slider, Button, Statistic, Alert } from 'antd';
import { CalculatorOutlined, CheckCircleOutlined, WarningOutlined, TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../../services/api';
import type { PortfolioSummary } from '../../types';

const GOAL_PRESETS = [
  { label: '子女教育', icon: '🎓', target: 500000, years: 15, returnRate: 8 },
  { label: '买房首付', icon: '🏠', target: 1000000, years: 10, returnRate: 10 },
  { label: '退休养老', icon: '🏖️', target: 3000000, years: 30, returnRate: 8 },
  { label: '应急储备', icon: '💰', target: 200000, years: 5, returnRate: 5 },
  { label: '旅行基金', icon: '✈️', target: 100000, years: 3, returnRate: 6 },
];

interface Props {
  isDark: boolean;
  summary: PortfolioSummary | null;
}

export function GoalPlanningTab({ isDark, summary }: Props) {
  const [goalTarget, setGoalTarget] = useState(1000000);
  const [goalCurrent, setGoalCurrent] = useState(100000);
  const [goalMonthly, setGoalMonthly] = useState(5000);
  const [goalReturn, setGoalReturn] = useState(8);
  const [goalYears, setGoalYears] = useState(10);
  const [goalResult, setGoalResult] = useState<any>(null);
  const [goalCalculating, setGoalCalculating] = useState(false);
  const [selectedGoalPreset, setSelectedGoalPreset] = useState<string | null>(null);

  const handleGoalCalculate = async () => {
    setGoalCalculating(true);
    try {
      const res = await fundApi.calculateGoal({
        targetAmount: goalTarget,
        currentAmount: goalCurrent,
        monthlyContribution: goalMonthly,
        expectedReturn: goalReturn,
        years: goalYears,
      });
      setGoalResult(res);
    } catch {
      // error handled silently
    } finally {
      setGoalCalculating(false);
    }
  };

  const goalChartOption = goalResult?.yearlyData?.length ? {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const d = goalResult.yearlyData[params[0]?.dataIndex];
        if (!d) return '';
        return `<div style="font-weight:600">第${d.year}年</div><div>累计投入: ¥${d.invested.toLocaleString()}</div><div>账户市值: ¥${d.value.toLocaleString()}</div><div>累计收益: ¥${d.profit.toLocaleString()}</div>`;
      },
    },
    legend: { data: ['累计投入', '账户市值'], top: 0, textStyle: { color: isDark ? '#a0a0a0' : '#666' } },
    grid: { top: 40, left: 80, right: 30, bottom: 30 },
    xAxis: { type: 'category', data: goalResult.yearlyData.map((d: any) => `第${d.year}年`), axisLabel: { color: isDark ? '#6b6b6b' : '#999' } },
    yAxis: { type: 'value', name: '金额(元)', axisLabel: { color: isDark ? '#6b6b6b' : '#999', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : String(v) } },
    series: [
      { name: '累计投入', type: 'bar', data: goalResult.yearlyData.map((d: any) => d.invested), itemStyle: { color: '#1677ff' }, barWidth: 20 },
      { name: '账户市值', type: 'line', data: goalResult.yearlyData.map((d: any) => d.value), lineStyle: { color: '#52c41a', width: 3 }, itemStyle: { color: '#52c41a' }, smooth: true },
    ],
  } : null;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, marginBottom: 12, fontWeight: 500 }}>快捷目标</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_PRESETS.map(p => {
            const isSelected = selectedGoalPreset === p.label;
            return (
              <Button
                key={p.label}
                onClick={() => {
                  setSelectedGoalPreset(p.label);
                  setGoalTarget(p.target);
                  setGoalYears(p.years);
                  setGoalReturn(p.returnRate);
                  setGoalResult(null);
                }}
                style={{
                  borderRadius: 20,
                  border: isSelected ? '2px solid #1677ff' : undefined,
                  background: isSelected ? (isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.06)') : undefined,
                  fontWeight: isSelected ? 600 : undefined,
                  boxShadow: isSelected ? '0 2px 8px rgba(22,119,255,0.2)' : undefined,
                }}
              >
                {p.icon} {p.label} ({p.target >= 10000 ? `${(p.target / 10000).toFixed(0)}万` : p.target.toLocaleString()})
              </Button>
            );
          })}
        </div>
      </Card>

      <Row gutter={24}>
        <Col xs={24} lg={10}>
          <Card title={<span style={{ fontWeight: 600 }}>目标参数</span>} style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>目标金额</span>
                <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 600 }}>¥{goalTarget.toLocaleString()}</span>
              </div>
              <InputNumber value={goalTarget} onChange={v => setGoalTarget(v || 1000000)} min={10000} max={100000000} step={10000} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>现有资金</span>
                <div>
                  <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>¥{goalCurrent.toLocaleString()}</span>
                  {summary?.totalValue && summary.totalValue > 0 && (
                    <Button size="small" type="link" style={{ padding: 0, fontSize: 12, marginLeft: 8 }}
                      onClick={() => { setGoalCurrent(Math.round(summary.totalValue)); setGoalResult(null); setSelectedGoalPreset(null); }}>
                      使用当前持仓 ¥{Math.round(summary.totalValue).toLocaleString()}
                    </Button>
                  )}
                </div>
              </div>
              <InputNumber value={goalCurrent} onChange={v => { setGoalCurrent(v || 0); setSelectedGoalPreset(null); }} min={0} max={goalTarget} step={10000} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>每月定投</span>
                <span style={{ fontSize: 13, color: '#722ed1', fontWeight: 600 }}>¥{goalMonthly.toLocaleString()}</span>
              </div>
              <InputNumber value={goalMonthly} onChange={v => setGoalMonthly(v || 5000)} min={0} max={100000} step={500} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>预期年化收益</span>
                <span style={{ fontSize: 13, color: '#faad14', fontWeight: 600 }}>{goalReturn}%</span>
              </div>
              <Slider value={goalReturn} onChange={setGoalReturn} min={1} max={20} marks={{ 3: '保守', 8: '稳健', 12: '积极', 20: '激进' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>投资年限</span>
                <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 600 }}>{goalYears}年</span>
              </div>
              <Slider value={goalYears} onChange={setGoalYears} min={1} max={30} marks={{ 1: '1年', 5: '5年', 10: '10年', 20: '20年', 30: '30年' }} />
            </div>
            <Button type="primary" block size="large" onClick={handleGoalCalculate} loading={goalCalculating} icon={<CalculatorOutlined />}>
              开始测算
            </Button>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          {goalResult ? (
            <>
              {selectedGoalPreset && (
                <div style={{
                  marginBottom: 12,
                  padding: '8px 14px',
                  borderRadius: 8,
                  background: isDark ? 'rgba(22,119,255,0.1)' : 'rgba(22,119,255,0.04)',
                  border: `1px solid ${isDark ? 'rgba(22,119,255,0.2)' : 'rgba(22,119,255,0.12)'}`,
                  fontSize: 13,
                  color: isDark ? '#8cb4ff' : '#1677ff',
                  fontWeight: 500,
                }}>
                  {GOAL_PRESETS.find(p => p.label === selectedGoalPreset)?.icon} 当前方案：{selectedGoalPreset}
                </div>
              )}
              <Alert
                type={goalResult.canReach ? 'success' : 'warning'}
                icon={goalResult.canReach ? <CheckCircleOutlined /> : <WarningOutlined />}
                message={goalResult.canReach ? '目标可达成！' : '目标较难达成'}
                description={goalResult.canReach ? `按照当前方案，预计${goalResult.yearsToGoal}年可达成目标` : `建议每月投入¥${goalResult.requiredMonthly?.toLocaleString()}，或延长投资年限`}
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                    <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>预计市值</span>} value={goalResult.projection.futureValue} prefix="¥" valueStyle={{ color: '#fff', fontSize: 22 }} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', border: 'none' }}>
                    <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>累计收益</span>} value={goalResult.projection.totalProfit} prefix="¥" valueStyle={{ color: '#fff', fontSize: 22 }} />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', border: 'none' }}>
                    <Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>总收益率</span>} value={goalResult.projection.returnRate} suffix="%" valueStyle={{ color: '#fff', fontSize: 22 }} />
                  </Card>
                </Col>
              </Row>
              <Card style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={8}><Statistic title="目标金额" value={goalResult.targetAmount} prefix="¥" /></Col>
                  <Col span={8}><Statistic title="累计投入" value={goalResult.projection.totalInvested} prefix="¥" /></Col>
                  <Col span={8}><Statistic title="达成时间" value={goalResult.yearsToGoal || '-'} suffix="年" prefix={<ClockCircleOutlined />} /></Col>
                </Row>
              </Card>
              {goalChartOption && (
                <Card title={<span style={{ fontWeight: 600 }}>资产增长预测</span>}>
                  <ReactECharts option={goalChartOption} style={{ height: 350 }} />
                </Card>
              )}
            </>
          ) : (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <TrophyOutlined style={{ fontSize: 48, color: isDark ? '#555' : '#d9d9d9', marginBottom: 16 }} />
              <p style={{ fontSize: 16, color: isDark ? '#6b6b6b' : '#999' }}>设定目标参数，点击"开始测算"查看结果</p>
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
