import { useState, useEffect, useCallback } from 'react';
import { Card, InputNumber, Row, Col, Slider, Button, Statistic, Alert, Modal, Form, Input, message, Popconfirm, Tag, Tooltip, Badge } from 'antd';
import { CalculatorOutlined, CheckCircleOutlined, WarningOutlined, TrophyOutlined, ClockCircleOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, BellOutlined, AimOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../../services/api';
import { getEchartsTheme } from '../../utils/echarts-theme';
import type { PortfolioSummary } from '../../types';

interface GoalItem {
  id: string;
  label: string;
  icon: string;
  target: number;
  current: number;
  monthly: number;
  returnRate: number;
  years: number;
  createdAt: number;
  reminder?: string; // ISO date string for reminder
}

const GOAL_PRESETS: Omit<GoalItem, 'id' | 'current' | 'monthly' | 'createdAt'>[] = [
  { label: '子女教育', icon: '🎓', target: 500000, years: 15, returnRate: 8 },
  { label: '买房首付', icon: '🏠', target: 1000000, years: 10, returnRate: 10 },
  { label: '退休养老', icon: '🏖️', target: 3000000, years: 30, returnRate: 8 },
  { label: '应急储备', icon: '💰', target: 200000, years: 5, returnRate: 5 },
  { label: '旅行基金', icon: '✈️', target: 100000, years: 3, returnRate: 6 },
];

const GOALS_STORAGE_KEY = 'fund-recommender-goals';
const SELECTED_GOAL_KEY = 'fund-recommender-selected-goal';

function loadGoals(): GoalItem[] {
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveGoals(goals: GoalItem[]) {
  localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

function loadSelectedGoalId(): string | null {
  return localStorage.getItem(SELECTED_GOAL_KEY);
}

function saveSelectedGoalId(id: string | null) {
  if (id) localStorage.setItem(SELECTED_GOAL_KEY, id);
  else localStorage.removeItem(SELECTED_GOAL_KEY);
}

interface Props {
  isDark: boolean;
  summary: PortfolioSummary | null;
}

export function GoalPlanningTab({ isDark, summary }: Props) {
  const [goals, setGoals] = useState<GoalItem[]>(loadGoals);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(loadSelectedGoalId);
  const [goalResult, setGoalResult] = useState<any>(null);
  const [goalCalculating, setGoalCalculating] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [form] = Form.useForm();

  // Persist goals to localStorage whenever they change
  useEffect(() => { saveGoals(goals); }, [goals]);
  useEffect(() => { saveSelectedGoalId(selectedGoalId); }, [selectedGoalId]);

  const selectedGoal = goals.find(g => g.id === selectedGoalId) || null;

  // Sync form fields when selected goal changes
  useEffect(() => {
    if (selectedGoal) {
      setGoalResult(null); // clear stale result when switching goals
    }
  }, [selectedGoalId]);

  const handleSelectGoal = (id: string) => {
    setSelectedGoalId(id);
    setGoalResult(null);
  };

  const handleAddPreset = (preset: Omit<GoalItem, 'id' | 'current' | 'monthly' | 'createdAt'>) => {
    const newGoal: GoalItem = {
      ...preset,
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      current: 0,
      monthly: 5000,
      createdAt: Date.now(),
    };
    setGoals(prev => [...prev, newGoal]);
    setSelectedGoalId(newGoal.id);
    setGoalResult(null);
    message.success(`已添加目标：${preset.label}`);
  };

  const handleOpenEdit = (goal: GoalItem | null) => {
    setEditingGoal(goal);
    if (goal) {
      form.setFieldsValue(goal);
    } else {
      form.resetFields();
      form.setFieldsValue({ target: 1000000, current: 0, monthly: 5000, returnRate: 8, years: 10, icon: '🎯', label: '' });
    }
    setEditModalOpen(true);
  };

  const handleSaveGoal = async () => {
    try {
      const values = await form.validateFields();
      if (editingGoal) {
        // Update existing
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...values } : g));
        message.success('目标已更新');
      } else {
        // Create new
        const newGoal: GoalItem = {
          ...values,
          id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          createdAt: Date.now(),
        };
        setGoals(prev => [...prev, newGoal]);
        setSelectedGoalId(newGoal.id);
        setGoalResult(null);
        message.success('目标已创建');
      }
      setEditModalOpen(false);
    } catch { /* validation error */ }
  };

  const handleDeleteGoal = (id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
    if (selectedGoalId === id) {
      const remaining = goals.filter(g => g.id !== id);
      setSelectedGoalId(remaining.length > 0 ? remaining[0].id : null);
    }
    setGoalResult(null);
    message.success('目标已删除');
  };

  const handleDuplicateGoal = (goal: GoalItem) => {
    const newGoal: GoalItem = {
      ...goal,
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: `${goal.label} (副本)`,
      createdAt: Date.now(),
    };
    setGoals(prev => [...prev, newGoal]);
    setSelectedGoalId(newGoal.id);
    setGoalResult(null);
    message.success('目标已复制');
  };

  const handleGoalCalculate = async () => {
    if (!selectedGoal) return;
    setGoalCalculating(true);
    try {
      const res = await fundApi.calculateGoal({
        targetAmount: selectedGoal.target,
        currentAmount: selectedGoal.current,
        monthlyContribution: selectedGoal.monthly,
        expectedReturn: selectedGoal.returnRate,
        years: selectedGoal.years,
      });
      setGoalResult(res);
    } catch {
      message.error('测算失败');
    } finally {
      setGoalCalculating(false);
    }
  };

  const handleUseCurrentHoldings = () => {
    if (selectedGoal && summary?.totalValue && summary.totalValue > 0) {
      const updated = { ...selectedGoal, current: Math.round(summary.totalValue) };
      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? updated : g));
      setGoalResult(null);
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

  // Color scheme for selected state
  const selectedBg = isDark ? 'rgba(22,119,255,0.15)' : 'rgba(22,119,255,0.08)';
  const selectedBorder = '#1677ff';
  const selectedTextColor = '#1677ff';

  return (
    <>
      {/* Floating current goal banner */}
      {selectedGoal && goalResult && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          padding: '8px 16px', marginBottom: 12,
          background: isDark ? 'linear-gradient(135deg, #0d1b3e, #1a2744)' : 'linear-gradient(135deg, #e8f4ff, #f0f7ff)',
          border: `1px solid ${isDark ? 'rgba(22,119,255,0.3)' : '#91caff'}`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500,
        }}>
          <AimOutlined style={{ color: selectedTextColor }} />
          <span>当前目标：</span>
          <Tag color="blue" style={{ margin: 0 }}>{selectedGoal.icon} {selectedGoal.label}</Tag>
          <span style={{ color: isDark ? '#8cb4ff' : '#1677ff' }}>
            ¥{selectedGoal.target.toLocaleString()} / {selectedGoal.years}年
          </span>
          {goalResult.canReach !== undefined && (
            <Tag color={goalResult.canReach ? 'success' : 'warning'} style={{ marginLeft: 'auto' }}>
              {goalResult.canReach ? '可达成' : '需调整'}
            </Tag>
          )}
        </div>
      )}

      {/* Goal presets quick add */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>快捷目标</span>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => handleOpenEdit(null)}>
            自定义目标
          </Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {GOAL_PRESETS.map(p => (
            <Button
              key={p.label}
              onClick={() => handleAddPreset(p)}
              style={{ borderRadius: 20 }}
            >
              {p.icon} {p.label} ({p.target >= 10000 ? `${(p.target / 10000).toFixed(0)}万` : p.target.toLocaleString()})
            </Button>
          ))}
        </div>
      </Card>

      {/* Goal list with selection */}
      {goals.length > 0 && (
        <Card title={<span style={{ fontWeight: 600 }}>我的目标 ({goals.length})</span>} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {goals.map(g => {
              const isSelected = g.id === selectedGoalId;
              return (
                <Card
                  key={g.id}
                  hoverable
                  size="small"
                  onClick={() => handleSelectGoal(g.id)}
                  style={{
                    width: 220,
                    cursor: 'pointer',
                    border: isSelected ? `2px solid ${selectedBorder}` : `1px solid ${isDark ? '#333' : '#e8e8e8'}`,
                    background: isSelected ? selectedBg : undefined,
                    borderRadius: 10,
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  styles={{
                    body: { padding: '12px 14px' },
                  }}
                >
                  {/* Selection badge */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: 0, right: 0,
                      background: selectedBorder,
                      color: '#fff', fontSize: 9, padding: '2px 8px',
                      borderBottomLeftRadius: 8,
                      fontWeight: 700,
                    }}>
                      当前选中
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{g.icon}</span>
                    <span style={{
                      fontWeight: 600, fontSize: 14,
                      color: isSelected ? selectedTextColor : undefined,
                    }}>
                      {g.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: isSelected ? selectedTextColor : (isDark ? '#e0e0e0' : '#333'), marginBottom: 4 }}>
                    ¥{g.target.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999', marginBottom: 8 }}>
                    {g.years}年 · 预期{g.returnRate}% · 月投¥{g.monthly.toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <Tooltip title="编辑"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleOpenEdit(g)} /></Tooltip>
                    <Tooltip title="复制"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleDuplicateGoal(g)} /></Tooltip>
                    <Popconfirm title="确认删除此目标？" onConfirm={() => handleDeleteGoal(g.id)}>
                      <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                    </Popconfirm>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      <Row gutter={24}>
        <Col xs={24} lg={10}>
          <Card title={<span style={{ fontWeight: 600 }}>目标参数</span>} style={{ marginBottom: 16 }}>
            {selectedGoal ? (
              <>
                <div style={{
                  marginBottom: 16, padding: '8px 12px', borderRadius: 8,
                  background: selectedBg,
                  border: `1px solid ${isDark ? 'rgba(22,119,255,0.3)' : '#91caff'}`,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{selectedGoal.icon}</span>
                  <span style={{ fontWeight: 600, color: selectedTextColor }}>{selectedGoal.label}</span>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>目标金额</span>
                    <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 600 }}>¥{selectedGoal.target.toLocaleString()}</span>
                  </div>
                  <InputNumber value={selectedGoal.target} onChange={v => {
                    if (v && selectedGoal) {
                      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, target: v } : g));
                      setGoalResult(null);
                    }
                  }} min={10000} max={100000000} step={10000} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>现有资金</span>
                    <div>
                      <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>¥{selectedGoal.current.toLocaleString()}</span>
                      {summary?.totalValue && summary.totalValue > 0 && (
                        <Button size="small" type="link" style={{ padding: 0, fontSize: 12, marginLeft: 8 }}
                          onClick={handleUseCurrentHoldings}>
                          使用当前持仓 ¥{Math.round(summary.totalValue).toLocaleString()}
                        </Button>
                      )}
                    </div>
                  </div>
                  <InputNumber value={selectedGoal.current} onChange={v => {
                    if (v !== null && selectedGoal) {
                      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, current: v } : g));
                      setGoalResult(null);
                    }
                  }} min={0} max={selectedGoal.target} step={10000} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>每月定投</span>
                    <span style={{ fontSize: 13, color: '#722ed1', fontWeight: 600 }}>¥{selectedGoal.monthly.toLocaleString()}</span>
                  </div>
                  <InputNumber value={selectedGoal.monthly} onChange={v => {
                    if (v !== null && selectedGoal) {
                      setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, monthly: v } : g));
                      setGoalResult(null);
                    }
                  }} min={0} max={100000} step={500} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>预期年化收益</span>
                    <span style={{ fontSize: 13, color: '#faad14', fontWeight: 600 }}>{selectedGoal.returnRate}%</span>
                  </div>
                  <Slider value={selectedGoal.returnRate} onChange={v => {
                    setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, returnRate: v } : g));
                    setGoalResult(null);
                  }} min={1} max={20} marks={{ 3: '保守', 8: '稳健', 12: '积极', 20: '激进' }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>投资年限</span>
                    <span style={{ fontSize: 13, color: '#1677ff', fontWeight: 600 }}>{selectedGoal.years}年</span>
                  </div>
                  <Slider value={selectedGoal.years} onChange={v => {
                    setGoals(prev => prev.map(g => g.id === selectedGoal.id ? { ...g, years: v } : g));
                    setGoalResult(null);
                  }} min={1} max={30} marks={{ 1: '1年', 5: '5年', 10: '10年', 20: '20年', 30: '30年' }} />
                </div>
                <Button type="primary" block size="large" onClick={handleGoalCalculate} loading={goalCalculating} icon={<CalculatorOutlined />}>
                  开始测算
                </Button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <TrophyOutlined style={{ fontSize: 48, color: isDark ? '#555' : '#d9d9d9', marginBottom: 16 }} />
                <p style={{ fontSize: 16, color: isDark ? '#6b6b6b' : '#999' }}>
                  {goals.length === 0 ? '点击上方快捷目标或自定义目标开始规划' : '请从上方选择一个目标'}
                </p>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          {goalResult && selectedGoal ? (
            <>
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
                  <ReactECharts option={goalChartOption} theme={getEchartsTheme(isDark)} style={{ height: 350 }} />
                </Card>
              )}
            </>
          ) : (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <TrophyOutlined style={{ fontSize: 48, color: isDark ? '#555' : '#d9d9d9', marginBottom: 16 }} />
              <p style={{ fontSize: 16, color: isDark ? '#6b6b6b' : '#999' }}>
                {selectedGoal ? '点击"开始测算"查看结果' : '选择一个目标后开始测算'}
              </p>
            </Card>
          )}
        </Col>
      </Row>

      {/* Edit/Create Goal Modal */}
      <Modal
        title={editingGoal ? '编辑目标' : '新建目标'}
        open={editModalOpen}
        onOk={handleSaveGoal}
        onCancel={() => setEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="label" label="目标名称" rules={[{ required: true, message: '请输入目标名称' }]}>
            <Input placeholder="例如：子女教育" />
          </Form.Item>
          <Form.Item name="icon" label="图标" initialValue="🎯">
            <Input placeholder="输入 emoji 图标" maxLength={4} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="target" label="目标金额" rules={[{ required: true }]}>
                <InputNumber min={10000} max={100000000} step={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="current" label="现有资金" initialValue={0}>
                <InputNumber min={0} max={100000000} step={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="monthly" label="每月定投" initialValue={5000}>
                <InputNumber min={0} max={100000} step={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="returnRate" label="预期年化收益(%)" initialValue={8}>
                <InputNumber min={1} max={30} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="years" label="投资年限" initialValue={10}>
            <InputNumber min={1} max={50} step={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
