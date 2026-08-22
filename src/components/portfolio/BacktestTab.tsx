import { useState, useMemo } from 'react';
import { Card, Button, DatePicker, InputNumber, Table, Tag, Space, Empty, Spin, message, Row, Col, Statistic } from 'antd';
import { PlayCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { portfolioApi } from '../../services/api';
import { getEchartsTheme } from '../../utils/echarts-theme';
import { useTheme } from '../../contexts/ThemeContext';

const { RangePicker } = DatePicker;

interface Holding {
  fund_code: string;
  fund_name?: string;
}

interface BacktestFund {
  fund_code: string;
  fund_name: string;
  weight: number;
}

interface BacktestStats {
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  volatility: number;
  sharpe: number;
  calmar: number;
  final_value: number;
  initial_capital: number;
  days: number;
}

interface BacktestResult {
  dailyValues: Array<{ date: string; portfolio_value: number }>;
  stats: BacktestStats | null;
  message?: string;
}

export function BacktestTab({ holdings }: { holdings: Holding[] }) {
  const { isDark } = useTheme();
  const [selectedFunds, setSelectedFunds] = useState<BacktestFund[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(1, 'year'),
    dayjs(),
  ]);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const addFund = (fund_code: string, fund_name: string) => {
    if (selectedFunds.some(f => f.fund_code === fund_code)) {
      message.warning('该基金已添加');
      return;
    }
    const remainingWeight = 100 - selectedFunds.reduce((s, f) => s + f.weight, 0);
    setSelectedFunds([...selectedFunds, { fund_code, fund_name, weight: Math.max(0, Math.round(remainingWeight)) }]);
  };

  const removeFund = (fund_code: string) => {
    setSelectedFunds(selectedFunds.filter(f => f.fund_code !== fund_code));
  };

  const updateWeight = (fund_code: string, weight: number) => {
    setSelectedFunds(selectedFunds.map(f => f.fund_code === fund_code ? { ...f, weight } : f));
  };

  const totalWeight = selectedFunds.reduce((s, f) => s + f.weight, 0);

  const runBacktest = async () => {
    if (selectedFunds.length === 0) {
      message.warning('请至少选择一只基金');
      return;
    }
    if (totalWeight === 0) {
      message.warning('权重总和不能为0');
      return;
    }
    setLoading(true);
    try {
      const data = await portfolioApi.backtest({
        funds: selectedFunds.map(f => ({ fund_code: f.fund_code, weight: f.weight })),
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        initial_capital: initialCapital,
      });
      setResult(data);
      if (data.message) message.info(data.message);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '回测失败');
    } finally {
      setLoading(false);
    }
  };

  const chartOption = useMemo(() => {
    if (!result || !result.dailyValues.length) return {};
    const dates = result.dailyValues.map(d => d.date);
    const values = result.dailyValues.map(d => d.portfolio_value);
    return {
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', name: '组合市值' },
      series: [{
        name: '组合市值',
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.1 },
      }],
      grid: { left: 60, right: 20, top: 30, bottom: 30 },
    };
  }, [result]);

  const availableFunds = holdings.filter(h => !selectedFunds.some(f => f.fund_code === h.fund_code));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card title="组合回测设置" size="small">
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Row gutter={12} align="middle">
            <Col>
              <span>时间范围：</span>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                }}
              />
            </Col>
            <Col>
              <span>初始资金：</span>
              <InputNumber
                value={initialCapital}
                onChange={v => setInitialCapital(v || 10000)}
                min={1000}
                max={10000000}
                step={1000}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={v => Number((v || '').replace(/[^0-9]/g, '')) as unknown as 10000}
              />
            </Col>
          </Row>

          <div>
            <div style={{ marginBottom: 8 }}>
              <span>选择基金与权重：</span>
              {availableFunds.length > 0 && (
                <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => addFund(availableFunds[0].fund_code, availableFunds[0].fund_name || availableFunds[0].fund_code)}>
                  添加持仓基金
                </Button>
              )}
            </div>
            <Table
              dataSource={selectedFunds}
              rowKey="fund_code"
              size="small"
              pagination={false}
              columns={[
                { title: '基金代码', dataIndex: 'fund_code', width: 100 },
                { title: '基金名称', dataIndex: 'fund_name' },
                {
                  title: '权重(%)',
                  dataIndex: 'weight',
                  width: 120,
                  render: (val: number, record: BacktestFund) => (
                    <InputNumber value={val} onChange={v => updateWeight(record.fund_code, v || 0)} min={0} max={100} step={5} size="small" />
                  ),
                },
                {
                  title: '操作',
                  width: 60,
                  render: (_: unknown, record: BacktestFund) => (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => removeFund(record.fund_code)} />
                  ),
                },
              ]}
            />
            {selectedFunds.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Tag color={totalWeight === 100 ? 'green' : 'orange'}>
                  权重总和：{totalWeight}% {totalWeight !== 100 && '（将自动归一化）'}
                </Tag>
              </div>
            )}
          </div>

          <Button type="primary" icon={<PlayCircleOutlined />} loading={loading} onClick={runBacktest} disabled={selectedFunds.length === 0}>
            开始回测
          </Button>
        </Space>
      </Card>

      {loading && <Card size="small"><div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div></Card>}

      {result && !loading && (
        <>
          {result.stats ? (
            <>
              <Row gutter={16}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="总收益" value={result.stats.total_return} precision={2} suffix="%" valueStyle={{ color: result.stats.total_return >= 0 ? '#52c41a' : '#ff4d4f' }} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="年化收益" value={result.stats.annualized_return} precision={2} suffix="%" valueStyle={{ color: result.stats.annualized_return >= 0 ? '#52c41a' : '#ff4d4f' }} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="最大回撤" value={result.stats.max_drawdown} precision={2} suffix="%" valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="夏普比率" value={result.stats.sharpe} precision={2} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="卡玛比率" value={result.stats.calmar} precision={2} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="年化波动率" value={result.stats.volatility} precision={2} suffix="%" /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="最终市值" value={result.stats.final_value} precision={2} prefix="¥" /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="回测天数" value={result.stats.days} suffix="天" /></Card></Col>
              </Row>
              <Card title="组合市值走势" size="small">
                <ReactECharts option={chartOption} theme={getEchartsTheme(isDark)} style={{ height: 400 }} />
              </Card>
            </>
          ) : (
            <Card size="small"><Empty description={result.message || '无回测结果'} /></Card>
          )}
        </>
      )}
    </Space>
  );
}
