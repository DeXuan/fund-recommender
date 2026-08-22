import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Segmented, Row, Col, Statistic, Empty, Spin, Tag, Space, Typography, Grid, Tabs } from 'antd';
const { useBreakpoint } = Grid;
const { Title, Text } = Typography;
import { ArrowUpOutlined, ArrowDownOutlined, FileTextOutlined, ReloadOutlined, TrophyOutlined, FireOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { portfolioApi } from '../services/api';

interface ReportData {
  period: string;
  start_date: string;
  end_date: string;
  summary: {
    total_cost: number;
    total_value: number;
    total_pnl: number;
    total_return: number;
    holding_count: number;
  };
  winners: Array<{ fund_code: string; fund_name: string; pnl: number; pnl_percent: number }>;
  losers: Array<{ fund_code: string; fund_name: string; pnl: number; pnl_percent: number }>;
  nav_changes: Array<{ fund_code: string; start_nav: number; end_nav: number; change: number; change_percent: number; nav_dates: string[] }>;
  transactions: {
    buys: Array<{ fund_code: string; fund_name: string; shares: number; cost_price: number; buy_date: string; amount: number }>;
    sells: Array<{ fund_code: string; fund_name: string; shares: number; sell_price: number; sell_date: string | null; realized_pnl: number }>;
    buy_amount: number;
    sell_amount: number;
    realized_pnl: number;
    buy_count: number;
    sell_count: number;
  };
}

interface RankingData {
  period: string;
  start_date: string;
  end_date: string;
  buy_ranking: Array<{ fund_code: string; fund_name: string; buy_count: number; buy_amount: number; buyer_count: number }>;
  sell_ranking: Array<{ fund_code: string; fund_name: string; sell_count: number; sell_amount: number; total_realized_pnl: number; seller_count: number }>;
}

const periodLabels: Record<string, string> = {
  weekly: '周报',
  monthly: '月报',
  quarterly: '季报',
  yearly: '年报',
};

export default function Reports() {
  const screens = useBreakpoint();
  const isMobile = !screens.sm;
  const [period, setPeriod] = useState<string>('weekly');
  const [activeTab, setActiveTab] = useState('personal');
  const [report, setReport] = useState<ReportData | null>(null);
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'personal') {
        const data = await portfolioApi.getReport(period);
        setReport(data);
      } else {
        const data = await portfolioApi.getPositionRanking(period);
        setRanking(data);
      }
    } catch {
      if (activeTab === 'personal') setReport(null);
      else setRanking(null);
    } finally {
      setLoading(false);
    }
  }, [period, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const colSpan = isMobile ? 24 : 12;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '0' : '0 24px' }}>
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>投资报告</span>
          </Space>
        }
        extra={
          <Space>
            <Segmented
              value={period}
              onChange={(v) => setPeriod(v as string)}
              options={[
                { label: '周报', value: 'weekly' },
                { label: '月报', value: 'monthly' },
                { label: '季报', value: 'quarterly' },
                { label: '年报', value: 'yearly' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'personal', label: <span><FileTextOutlined /> 个人报告</span> },
            { key: 'ranking', label: <span><TrophyOutlined /> 加减仓榜单</span> },
          ]}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : activeTab === 'personal' ? (
          !report ? (
            <Empty description="暂无报告数据，请先添加持仓" />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Title level={4}>
                  {periodLabels[report.period] || report.period}
                  <Text type="secondary" style={{ fontSize: 14, marginLeft: 12 }}>
                    {report.start_date} ~ {report.end_date}
                  </Text>
                </Title>
              </div>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={colSpan}>
                  <Card size="small">
                    <Statistic title="总市值" value={report.summary.total_value} precision={2} prefix="¥" />
                  </Card>
                </Col>
                <Col span={colSpan}>
                  <Card size="small">
                    <Statistic title="总成本" value={report.summary.total_cost} precision={2} prefix="¥" />
                  </Card>
                </Col>
                <Col span={colSpan}>
                  <Card size="small">
                    <Statistic
                      title="总盈亏"
                      value={report.summary.total_pnl}
                      precision={2}
                      valueStyle={{ color: report.summary.total_pnl >= 0 ? '#cf1322' : '#3f8600' }}
                      prefix={report.summary.total_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={colSpan}>
                  <Card size="small">
                    <Statistic
                      title="收益率"
                      value={report.summary.total_return}
                      precision={2}
                      suffix="%"
                      valueStyle={{ color: report.summary.total_return >= 0 ? '#cf1322' : '#3f8600' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={colSpan}>
                  <Card title="期间买入" size="small">
                    <Statistic
                      value={report.transactions.buy_amount}
                      precision={2}
                      prefix="¥"
                      suffix={<Tag color="blue">{report.transactions.buy_count} 笔</Tag>}
                    />
                    {report.transactions.buys.length > 0 && (
                      <Table
                        size="small"
                        style={{ marginTop: 12 }}
                        pagination={false}
                        dataSource={report.transactions.buys}
                        rowKey={(r) => r.fund_code + r.buy_date}
                        columns={[
                          { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true,
                            render: (name, r) => <Link to={`/funds/${r.fund_code}`}>{name}</Link> },
                          { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right' as const,
                            render: (v: number) => `¥${v.toFixed(2)}` },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
                <Col span={colSpan}>
                  <Card title="期间卖出" size="small">
                    <Statistic
                      value={report.transactions.sell_amount}
                      precision={2}
                      prefix="¥"
                      suffix={<Tag color="orange">{report.transactions.sell_count} 笔</Tag>}
                    />
                    {report.transactions.sells.length > 0 && (
                      <Table
                        size="small"
                        style={{ marginTop: 12 }}
                        pagination={false}
                        dataSource={report.transactions.sells}
                        rowKey={(r) => r.fund_code + (r.sell_date || '')}
                        columns={[
                          { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true,
                            render: (name, r) => <Link to={`/funds/${r.fund_code}`}>{name}</Link> },
                          { title: '已实现盈亏', dataIndex: 'realized_pnl', key: 'realized_pnl', align: 'right' as const,
                            render: (v: number) => <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600' }}>¥{v.toFixed(2)}</span> },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={colSpan}>
                  <Card title="盈利TOP5" size="small">
                    {report.winners.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={report.winners}
                        rowKey="fund_code"
                        columns={[
                          { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true,
                            render: (name, r) => <Link to={`/funds/${r.fund_code}`}>{name}</Link> },
                          { title: '盈亏', dataIndex: 'pnl', key: 'pnl', align: 'right' as const,
                            render: (v: number) => <span style={{ color: '#cf1322' }}>¥{v.toFixed(2)}</span> },
                          { title: '收益率', dataIndex: 'pnl_percent', key: 'pnl_percent', align: 'right' as const,
                            render: (v: number) => <Tag color="red">+{v.toFixed(2)}%</Tag> },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
                <Col span={colSpan}>
                  <Card title="亏损TOP5" size="small">
                    {report.losers.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={report.losers}
                        rowKey="fund_code"
                        columns={[
                          { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true,
                            render: (name, r) => <Link to={`/funds/${r.fund_code}`}>{name}</Link> },
                          { title: '盈亏', dataIndex: 'pnl', key: 'pnl', align: 'right' as const,
                            render: (v: number) => <span style={{ color: '#3f8600' }}>¥{v.toFixed(2)}</span> },
                          { title: '收益率', dataIndex: 'pnl_percent', key: 'pnl_percent', align: 'right' as const,
                            render: (v: number) => <Tag color="green">{v.toFixed(2)}%</Tag> },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
              </Row>

              {report.nav_changes.length > 0 && (
                <Card title="期间净值变化" size="small">
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={report.nav_changes}
                    rowKey="fund_code"
                    columns={[
                      { title: '基金代码', dataIndex: 'fund_code', key: 'fund_code',
                        render: (code) => <Link to={`/funds/${code}`}>{code}</Link> },
                      { title: '期初净值', dataIndex: 'start_nav', key: 'start_nav', align: 'right' as const,
                        render: (v: number) => v.toFixed(4) },
                      { title: '期末净值', dataIndex: 'end_nav', key: 'end_nav', align: 'right' as const,
                        render: (v: number) => v.toFixed(4) },
                      { title: '涨跌额', dataIndex: 'change', key: 'change', align: 'right' as const,
                        render: (v: number) => <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600' }}>{v.toFixed(4)}</span> },
                      { title: '涨跌幅', dataIndex: 'change_percent', key: 'change_percent', align: 'right' as const,
                        render: (v: number) => <Tag color={v >= 0 ? 'red' : 'green'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</Tag> },
                    ]}
                  />
                </Card>
              )}
            </>
          )
        ) : (
          !ranking ? (
            <Empty description="暂无榜单数据" />
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <Title level={4}>
                  <FireOutlined style={{ color: '#cf1322' }} /> 加减仓榜单
                  <Text type="secondary" style={{ fontSize: 14, marginLeft: 12 }}>
                    {ranking.start_date} ~ {ranking.end_date}
                  </Text>
                </Title>
              </div>
              <Row gutter={[16, 16]}>
                <Col span={colSpan}>
                  <Card title={<span><ArrowUpOutlined style={{ color: '#cf1322' }} /> 加仓榜单 TOP20</span>} size="small">
                    {ranking.buy_ranking.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={ranking.buy_ranking}
                        rowKey="fund_code"
                        columns={[
                          { title: '排名', key: 'rank', width: 60,
                            render: (_, __, idx) => <Tag color={idx < 3 ? 'gold' : 'default'}>{idx + 1}</Tag> },
                          { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true,
                            render: (name, r) => <Link to={`/funds/${r.fund_code}`}>{name}</Link> },
                          { title: '买入金额', dataIndex: 'buy_amount', key: 'buy_amount', align: 'right' as const,
                            render: (v: number) => `¥${(v / 10000).toFixed(2)}万` },
                          { title: '人数', dataIndex: 'buyer_count', key: 'buyer_count', align: 'right' as const,
                            render: (v: number) => <Tag color="blue">{v}人</Tag> },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
                <Col span={colSpan}>
                  <Card title={<span><ArrowDownOutlined style={{ color: '#3f8600' }} /> 减仓榜单 TOP20</span>} size="small">
                    {ranking.sell_ranking.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        dataSource={ranking.sell_ranking}
                        rowKey="fund_code"
                        columns={[
                          { title: '排名', key: 'rank', width: 60,
                            render: (_, __, idx) => <Tag color={idx < 3 ? 'gold' : 'default'}>{idx + 1}</Tag> },
                          { title: '基金', dataIndex: 'fund_name', key: 'fund_name', ellipsis: true,
                            render: (name, r) => <Link to={`/funds/${r.fund_code}`}>{name}</Link> },
                          { title: '卖出金额', dataIndex: 'sell_amount', key: 'sell_amount', align: 'right' as const,
                            render: (v: number) => `¥${(v / 10000).toFixed(2)}万` },
                          { title: '已实现盈亏', dataIndex: 'total_realized_pnl', key: 'total_realized_pnl', align: 'right' as const,
                            render: (v: number) => <span style={{ color: v >= 0 ? '#cf1322' : '#3f8600' }}>¥{v.toFixed(0)}</span> },
                        ]}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            </>
          )
        )}
      </Card>
    </div>
  );
}
