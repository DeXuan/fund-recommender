import { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Spin, Alert, Empty, Progress } from 'antd';
import { WarningOutlined, PieChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { portfolioApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';
import { Link } from 'react-router-dom';

interface OverlapPair {
  industry: string;
  funds: { code: string; name: string; shares: number }[];
  fundCount: number;
  weight: number;
  riskLevel: string;
}

interface IndustryAllocation {
  industry: string;
  funds: { code: string; name: string; shares: number }[];
  fundCount: number;
  weight: number;
}

interface TypeDistribution {
  type: string;
  weight: number;
}

interface OverlapData {
  overlapPairs: OverlapPair[];
  industryAllocation: IndustryAllocation[];
  typeDistribution: TypeDistribution[];
  summary: {
    totalFunds: number;
    industryCount: number;
    typeCount: number;
    hhi: number;
    concentrationLevel: string;
    concentrationAdvice: string;
    topIndustry: string;
    topIndustryWeight: string;
  };
}

export default function PortfolioOverlap() {
  const { isDark } = useTheme();
  const [data, setData] = useState<OverlapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await portfolioApi.getOverlap();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch (e: unknown) {
      setError((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const getConcentrationColor = (level: string) => {
    if (level.includes('高度')) return '#ff4d4f';
    if (level.includes('中度')) return '#faad14';
    return '#52c41a';
  };

  const getRiskColor = (level: string) => {
    if (level === 'high') return '#ff4d4f';
    if (level === 'medium') return '#faad14';
    return '#52c41a';
  };

  const getPieOption = () => {
    if (!data?.industryAllocation) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
      legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: isDark ? '#a0a0a0' : '#666', fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        data: data.industryAllocation.slice(0, 10).map(ia => ({
          name: ia.industry,
          value: parseFloat(ia.weight.toFixed(1)),
        })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
        label: { show: false },
      }],
    };
  };

  const getTypePieOption = () => {
    if (!data?.typeDistribution) return {};
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: data.typeDistribution.map(td => ({
          name: td.type,
          value: parseFloat(td.weight.toFixed(1)),
        })),
        label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
      }],
    };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="分析持仓重叠..." /></div>;
  }

  if (error) {
    return (
      <div>
        <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
          <PieChartOutlined style={{ marginRight: 8 }} />持仓重叠分析
        </h1>
        <Empty description={error} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <PieChartOutlined style={{ color: 'var(--primary)' }} />
        持仓重叠分析
      </h1>
      <p style={{ marginBottom: 24, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
        分析您的持仓基金在行业和类型上的重叠情况，帮助优化资产配置
      </p>

      {/* 概览卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--primary)' }}>{data.summary.totalFunds}</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>持仓基金数</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-purple)' }}>{data.summary.industryCount}</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>覆盖行业数</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: getConcentrationColor(data.summary.concentrationLevel) }}>{data.summary.concentrationLevel}</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>集中度评估</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--warning)' }}>{data.summary.hhi}</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>HHI指数</div>
          </Card>
        </Col>
      </Row>

      {/* 集中度建议 */}
      <Alert
        type={data.summary.concentrationLevel.includes('高度') ? 'warning' : data.summary.concentrationLevel.includes('中度') ? 'info' : 'success'}
        message={data.summary.concentrationLevel}
        description={data.summary.concentrationAdvice}
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={24}>
        {/* 行业分布饼图 */}
        <Col xs={24} lg={12}>
          <Card title={<span style={{ fontWeight: 600 }}>行业分布</span>} style={{ marginBottom: 16 }}>
            {data.industryAllocation.length > 0 ? (
              <ReactECharts option={getPieOption()} theme={getEchartsTheme(isDark)} style={{ height: 300 }} />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>

        {/* 基金类型分布 */}
        <Col xs={24} lg={12}>
          <Card title={<span style={{ fontWeight: 600 }}>基金类型分布</span>} style={{ marginBottom: 16 }}>
            {data.typeDistribution.length > 0 ? (
              <ReactECharts option={getTypePieOption()} theme={getEchartsTheme(isDark)} style={{ height: 300 }} />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 重叠行业警告 */}
      {data.overlapPairs.length > 0 && (
        <Card
          title={
            <span style={{ fontWeight: 600 }}>
              <WarningOutlined style={{ color: 'var(--warning)', marginRight: 8 }} />
              重叠行业（{data.overlapPairs.length}个）
            </span>
          }
          style={{ marginBottom: 16 }}
        >
          <p style={{ marginBottom: 16, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
            以下行业有多只基金重叠，可能导致风险集中
          </p>
          {data.overlapPairs.map(pair => (
            <Card
              key={pair.industry}
              size="small"
              style={{
                marginBottom: 12,
                border: `1px solid ${getRiskColor(pair.riskLevel)}40`,
                background: `${getRiskColor(pair.riskLevel)}08`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{pair.industry}</span>
                  <Tag color={getRiskColor(pair.riskLevel)} style={{ marginLeft: 8 }}>
                    {pair.riskLevel === 'high' ? '高风险' : pair.riskLevel === 'medium' ? '中风险' : '低风险'}
                  </Tag>
                </div>
                <span style={{ fontWeight: 600, color: getRiskColor(pair.riskLevel) }}>
                  占比 {pair.weight.toFixed(1)}%
                </span>
              </div>
              <Progress percent={pair.weight} showInfo={false} strokeColor={getRiskColor(pair.riskLevel)} style={{ marginBottom: 8 }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pair.funds.map(f => (
                  <Link key={f.code} to={`/funds/${f.code}`}>
                    <Tag color="blue" style={{ cursor: 'pointer' }}>{f.name} ({f.code})</Tag>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </Card>
      )}

      {/* 行业明细表 */}
      <Card title={<span style={{ fontWeight: 600 }}>行业配置明细</span>}>
        <Table
          dataSource={data.industryAllocation}
          rowKey="industry"
          pagination={false}
          size="small"
          columns={[
            { title: '行业', dataIndex: 'industry', key: 'industry', render: (t: string) => <Tag>{t}</Tag> },
            { title: '基金数', dataIndex: 'fundCount', key: 'fundCount', width: 80 },
            { title: '占比', dataIndex: 'weight', key: 'weight', width: 100, render: (v: number) => <span style={{ fontWeight: 600 }}>{v.toFixed(1)}%</span> },
            {
              title: '持仓基金', key: 'funds', render: (_: any, record: IndustryAllocation) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {record.funds.map(f => (
                    <Link key={f.code} to={`/funds/${f.code}`}>
                      <Tag style={{ cursor: 'pointer', fontSize: 11 }}>{f.code}</Tag>
                    </Link>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
