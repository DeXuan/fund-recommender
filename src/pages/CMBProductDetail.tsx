import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Breadcrumb, Tag, Spin, Typography, Row, Col, Statistic, Space, Button } from 'antd';
import { BankOutlined, ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

const { Title, Text } = Typography;

interface NavItem {
  unit_nav: number;
  cumulative_nav: number | null;
  nav_date: string;
  cumulative_return: number;
}

interface ProductData {
  product_code: string;
  product_name: string;
  risk_level: string;
  product_status: string;
  nav_history: NavItem[];
}

const riskColor: Record<string, string> = {
  'R1': 'green', 'R2': 'blue', 'R3': 'orange', 'R4': 'red', 'R5': 'magenta',
  '稳健型': 'blue', '平衡型': 'orange', '进取型': 'red', '保守型': 'green',
};

const statusColor: Record<string, string> = {
  '存续': 'green', '正常': 'green', '封闭期': 'orange', '开放期': 'blue',
  '已到期': 'red', '募集中': 'cyan',
};

export default function CMBProductDetail() {
  const { code } = useParams<{ code: string }>();
  const { isDark } = useTheme();
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!code) return;
    try {
      setLoading(true);
      setError(null);
      const result = await fundApi.getCmbProductNavHistory(code);
      setData(result);
    } catch (err: any) {
      setError(err.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [code]);

  // 统计数据
  const stats = useMemo(() => {
    if (!data || data.nav_history.length === 0) return null;
    const history = data.nav_history;
    const latest = history[history.length - 1];
    const first = history[0];
    const latestNav = latest.unit_nav;
    const latestReturn = latest.cumulative_return;
    const latestDate = latest.nav_date;
    const startDate = first.nav_date;
    const maxNav = Math.max(...history.map(h => h.unit_nav));
    const minNav = Math.min(...history.map(h => h.unit_nav));
    return { latestNav, latestReturn, latestDate, startDate, maxNav, minNav };
  }, [data]);

  // 图表配置
  const chartOption = useMemo(() => {
    if (!data || data.nav_history.length === 0) return null;
    const history = data.nav_history;
    const dates = history.map(h => h.nav_date);
    const returns = history.map(h => h.cumulative_return);
    const navs = history.map(h => h.unit_nav);

    const positiveColor = '#f5222d';
    const negativeColor = '#52c41a';

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          const idx = p.dataIndex;
          const date = dates[idx];
          const ret = returns[idx];
          const nav = navs[idx];
          const retColor = ret >= 0 ? positiveColor : negativeColor;
          const sign = ret >= 0 ? '+' : '';
          return `<div style="font-size:13px">
            <div style="margin-bottom:4px;font-weight:600">${date}</div>
            <div>单位净值: <b>${nav.toFixed(4)}</b></div>
            <div>累计收益率: <span style="color:${retColor};font-weight:600">${sign}${ret.toFixed(2)}%</span></div>
          </div>`;
        },
        axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
      },
      grid: { left: 60, right: 30, top: 30, bottom: 60 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          rotate: 0,
          formatter: (val: string) => {
            const d = new Date(val);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          },
        },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: '累计收益率(%)',
        nameTextStyle: { fontSize: 12 },
        axisLabel: {
          formatter: '{value}%',
        },
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: '累计收益率',
          type: 'line',
          data: returns,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
              ],
            },
          },
          itemStyle: { color: '#1890ff' },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#999', type: 'dashed' },
            data: [{ yAxis: 0 }],
          },
        },
      ],
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
          borderColor: '#ccc',
          fillerColor: 'rgba(24, 144, 255, 0.15)',
        },
      ],
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Title level={4} type="danger">{error || '产品不存在'}</Title>
        <Link to="/cmb-products">
          <Button type="primary" style={{ marginTop: 16 }}>返回产品列表</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* 面包屑 */}
      <Breadcrumb
        items={[
          { title: <Link to="/"><BankOutlined /> 首页</Link> },
          { title: <Link to="/cmb-products">招行持仓理财</Link> },
          { title: data.product_code },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* 产品信息头部 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Space align="center" style={{ marginBottom: 8 }}>
              <Title level={4} style={{ margin: 0 }}>{data.product_name}</Title>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Space>
                <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600 }}>
                  {data.product_code}
                </Text>
                <Tag color={riskColor[data.risk_level] || 'default'}>{data.risk_level}</Tag>
                <Tag color={statusColor[data.product_status] || 'default'}>{data.product_status}</Tag>
              </Space>
            </div>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </div>
      </Card>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="最新净值"
                value={stats.latestNav}
                precision={4}
                valueStyle={{ color: '#1890ff', fontWeight: 700 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>{stats.latestDate}</Text>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="累计收益率"
                value={stats.latestReturn}
                precision={2}
                suffix="%"
                prefix={stats.latestReturn >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: stats.latestReturn >= 0 ? '#f5222d' : '#52c41a', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="最高净值"
                value={stats.maxNav}
                precision={4}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic
                title="最低净值"
                value={stats.minNav}
                precision={4}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 业绩走势图 */}
      <Card title="业绩走势（累计收益率）" extra={<Text type="secondary">数据区间: {stats?.startDate} ~ {stats?.latestDate}</Text>}>
        {chartOption ? (
          <ReactECharts
            option={chartOption}
            theme={getEchartsTheme(isDark)}
            style={{ height: 420 }}
            opts={{ renderer: 'canvas' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无净值数据</div>
        )}
      </Card>
    </div>
  );
}
