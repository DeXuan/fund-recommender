import { useState } from 'react';
import { Card, Select, Button, Table, Tag, Typography, Space, Divider, message } from 'antd';
import { BarChartOutlined, LockOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { fundCompareApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatReturn, getReturnColor } from '../utils/format';

const { Title, Text, Paragraph } = Typography;

export default function FundCompare() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [codes, setCodes] = useState<string[]>([]);
  const [basicData, setBasicData] = useState<any>(null);
  const [premiumData, setPremiumData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);

  const handleCompare = async () => {
    if (codes.length < 2) return message.warning('请输入至少2只基金代码');
    setLoading(true);
    try {
      const data = await fundCompareApi.analyze(codes);
      setBasicData(data);
    } catch (e: unknown) {
      message.error((e as Error).message || '对比失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePremium = async () => {
    if (!user) return navigate('/login');
    setPremiumLoading(true);
    try {
      const data = await fundCompareApi.premiumAnalyze(codes);
      setPremiumData(data);
    } catch (e: unknown) {
      if ((e as Error).message?.includes('会员')) {
        message.warning('此功能需要开通会员');
      } else {
        message.error((e as Error).message || '深度对比失败');
      }
    } finally {
      setPremiumLoading(false);
    }
  };

  const navChartOption = basicData ? {
    tooltip: { trigger: 'axis' },
    legend: { data: basicData.funds.map((f: any) => f.name), top: 0 },
    grid: { left: 60, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: (Object.values(basicData.navHistories)[0] as any[])?.map((n: any) => n.nav_date) || [] },
    yAxis: { type: 'value', name: '净值' },
    series: basicData.funds.map((f: any) => ({
      name: f.name,
      type: 'line',
      data: (basicData.navHistories[f.code] || []).map((n: any) => parseFloat(n.nav)),
      smooth: true,
    })),
  } : null;

  const returnChartOption = basicData ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['近1月', '近3月', '近6月', '近1年'] },
    grid: { left: 80, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: basicData.funds.map((f: any) => f.name) },
    yAxis: { type: 'value', name: '收益率(%)' },
    series: [
      { name: '近1月', type: 'bar', data: basicData.funds.map((f: any) => parseFloat(f.return_1m) || 0) },
      { name: '近3月', type: 'bar', data: basicData.funds.map((f: any) => parseFloat(f.return_3m) || 0) },
      { name: '近6月', type: 'bar', data: basicData.funds.map((f: any) => parseFloat(f.return_6m) || 0) },
      { name: '近1年', type: 'bar', data: basicData.funds.map((f: any) => parseFloat(f.return_1y) || 0) },
    ],
  } : null;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}><BarChartOutlined /> 基金对比工具</Title>
        <Space wrap style={{ marginTop: 16 }}>
          <Select mode="tags" placeholder="输入基金代码（2-5只）" style={{ minWidth: 300, maxWidth: 500 }}
            value={codes} onChange={setCodes} maxCount={5} tokenSeparators={[',', ' ', '\n']} />
          <Button type="primary" loading={loading} onClick={handleCompare} disabled={codes.length < 2}>开始对比</Button>
          {basicData && (
            <Button loading={premiumLoading} onClick={handlePremium} icon={<LockOutlined />}>
              深度分析{!user ? '（需登录）' : ''}
            </Button>
          )}
        </Space>
      </Card>

      {basicData && (
        <>
          {/* 基础对比表 */}
          <Card title="基础对比" style={{ marginBottom: 16 }}>
            <Table dataSource={basicData.funds} rowKey="code" size="small" pagination={false} scroll={{ x: 800 }}
              columns={[
                { title: '基金名称', dataIndex: 'name', fixed: 'left', width: 200 },
                { title: '代码', dataIndex: 'code', width: 80 },
                { title: '类型', dataIndex: 'type', width: 50, render: (v: string) => <Tag>{v}</Tag> },
                { title: '最新净值', dataIndex: 'nav', width: 90, render: (v: any) => parseFloat(v).toFixed(4) },
                { title: '近1周', dataIndex: 'return_1w', width: 80, render: (v: any) => <span style={{ color: getReturnColor(parseFloat(v)) }}>{formatReturn(parseFloat(v))}</span> },
                { title: '近1月', dataIndex: 'return_1m', width: 80, render: (v: any) => <span style={{ color: getReturnColor(parseFloat(v)) }}>{formatReturn(parseFloat(v))}</span> },
                { title: '近3月', dataIndex: 'return_3m', width: 80, render: (v: any) => <span style={{ color: getReturnColor(parseFloat(v)) }}>{formatReturn(parseFloat(v))}</span> },
                { title: '近6月', dataIndex: 'return_6m', width: 80, render: (v: any) => <span style={{ color: getReturnColor(parseFloat(v)) }}>{formatReturn(parseFloat(v))}</span> },
                { title: '近1年', dataIndex: 'return_1y', width: 80, render: (v: any) => <span style={{ color: getReturnColor(parseFloat(v)) }}>{formatReturn(parseFloat(v))}</span> },
                { title: '综合费率', dataIndex: 'total_fee', width: 90, render: (v: any) => `${v}%` },
                { title: '规模(亿)', dataIndex: 'scale', width: 80, render: (v: any) => parseFloat(v).toFixed(1) },
              ]}
            />
          </Card>

          {/* 净值走势 */}
          <Card title="净值走势对比" style={{ marginBottom: 16 }}>
            <ReactECharts option={navChartOption} style={{ height: 400 }} theme={isDark ? 'dark' : undefined} />
          </Card>

          {/* 收益对比 */}
          <Card title="收益率对比" style={{ marginBottom: 16 }}>
            <ReactECharts option={returnChartOption} style={{ height: 350 }} theme={isDark ? 'dark' : undefined} />
          </Card>
        </>
      )}

      {/* 付费深度分析 */}
      {premiumData && (
        <>
          <Divider>深度分析</Divider>

          {/* 风险指标 */}
          <Card title="风险指标" style={{ marginBottom: 16 }}>
            <Table dataSource={premiumData.results} rowKey="code" size="small" pagination={false}
              columns={[
                { title: '基金', dataIndex: 'name' },
                { title: '年化波动率(%)', render: (_: any, r: any) => r.riskMetrics.volatility },
                { title: '最大回撤(%)', render: (_: any, r: any) => <span style={{ color: 'var(--danger)' }}>{r.riskMetrics.maxDrawdown}%</span> },
                { title: '夏普比率', render: (_: any, r: any) => <span style={{ color: r.riskMetrics.sharpeRatio > 0 ? 'var(--success)' : 'var(--danger)' }}>{r.riskMetrics.sharpeRatio}</span> },
                { title: '卡玛比率', render: (_: any, r: any) => r.riskMetrics.calmarRatio },
                { title: '3年持有成本(%)', render: (_: any, r: any) => `${r.feeComparison.cost3y}%` },
              ]}
            />
          </Card>

          {/* 投资建议 */}
          <Card title="投资建议" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Paragraph><Tag color="blue">短期（1月内）</Tag> {premiumData.recommendation.shortTerm}</Paragraph>
              <Paragraph><Tag color="green">中期（3-6月）</Tag> {premiumData.recommendation.mediumTerm}</Paragraph>
              <Paragraph><Tag color="purple">长期（1年+）</Tag> {premiumData.recommendation.longTerm}</Paragraph>
              <Paragraph><Tag color="orange">最低费率</Tag> {premiumData.recommendation.lowestFee}</Paragraph>
            </Space>
          </Card>

          {/* 业绩归因 */}
          <Card title="各时段表现最优" style={{ marginBottom: 16 }}>
            <Space wrap>
              {Object.entries(premiumData.attribution).map(([key, val]: any) => (
                <Tag key={key} color={val.winner === premiumData.results[0]?.code ? 'green' : 'default'}>
                  {val.label}：{val.winner}（{formatReturn(val.value)}）
                </Tag>
              ))}
            </Space>
          </Card>
        </>
      )}

      {!basicData && !loading && (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <BarChartOutlined style={{ fontSize: 64, color: isDark ? '#444' : '#d9d9d9' }} />
          <Title level={4} type="secondary">输入基金代码开始对比</Title>
          <Text type="secondary">支持2-5只基金同时对比，基础功能免费使用</Text>
        </Card>
      )}
    </div>
  );
}
