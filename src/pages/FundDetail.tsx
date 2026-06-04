import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Breadcrumb, Tag, Statistic, Row, Col, Tabs, Descriptions, Progress, Button, Spin, Space, Alert } from 'antd';
import {
  StarFilled,
  ArrowUpOutlined,
  ArrowDownOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor, getValuationText, getValuationColor } from '../utils/format';

interface FundDetailType {
  code: string;
  name: string;
  fullName: string;
  type: string;
  company: string;
  index: string;
  industry: string;
  nav: number;
  navDate: string;
  establishDate: string;
  fundManager: string;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  managementFee: number;
  custodyFee: number;
  serviceFee: number;
  purchaseFee: number;
  purchaseFeeDiscount: number;
  totalFee: number;
  scale: number;
  share: number;
  shareChange: number;
  institutionHold: number;
  individualHold: number;
  purchaseStatus: string;
  dailyLimit: number;
  rating: number;
  recommendation: string;
  riskLevel: string;
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  valuation: string;
  redeemFee: { period: string; rate: number }[];
  topHoldings: { name: string; percentage: number }[];
  performanceHistory: { date: string; nav: number; return: number }[];
  investmentAdvice: string;
  suitableFor: string;
}

export default function FundDetail() {
  const { code } = useParams<{ code: string }>();
  const [fund, setFund] = useState<FundDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFundDetail();
  }, [code]);

  const loadFundDetail = async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fundApi.getFundDetail(code);
      setFund(data);
    } catch (err: any) {
      console.error('加载基金详情失败:', err);
      setError(err?.message || '加载失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getRiskTag = (level: string) => {
    const map: Record<string, { color: string; text: string }> = {
      high: { color: 'red', text: '高风险' },
      medium: { color: 'orange', text: '中风险' },
      low: { color: 'green', text: '低风险' },
    };
    const item = map[level] || { color: 'default', text: '未知' };
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!fund) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Alert type="error" message={error || '基金不存在'} showIcon style={{ marginBottom: 16 }} />
        <Space>
          {error && <Button onClick={loadFundDetail}>重试</Button>}
          <Link to="/funds"><Button type="primary">返回基金列表</Button></Link>
        </Space>
      </div>
    );
  }

  const navChartOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        return `${p.axisValue}<br/>净值: ${p.value.toFixed(4)}`;
      },
    },
    xAxis: { type: 'category', data: fund.performanceHistory?.map(d => d.date) || [] },
    yAxis: { type: 'value', scale: true },
    series: [{
      data: fund.performanceHistory?.map(d => d.nav) || [],
      type: 'line',
      smooth: true,
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(22,119,255,0.3)' },
            { offset: 1, color: 'rgba(22,119,255,0.02)' },
          ],
        },
      },
      lineStyle: { color: '#1677ff', width: 2 },
      itemStyle: { color: '#1677ff' },
    }],
    grid: { top: 20, right: 20, bottom: 30, left: 60 },
  };

  const holdingsChartOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: fund.topHoldings?.map(h => ({ name: h.name, value: h.percentage })) || [],
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      label: { formatter: '{b}\n{d}%' },
    }],
  };

  const tabItems = [
    {
      key: 'overview',
      label: '基金概况',
      children: (
        <div>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="基金代码">{fund.code}</Descriptions.Item>
                <Descriptions.Item label="基金全称"><span style={{ fontSize: 13 }}>{fund.fullName}</span></Descriptions.Item>
                <Descriptions.Item label="基金类型">{fund.type}</Descriptions.Item>
                <Descriptions.Item label="基金公司">{fund.company}</Descriptions.Item>
                <Descriptions.Item label="基金经理">{fund.fundManager}</Descriptions.Item>
                <Descriptions.Item label="跟踪指数">{fund.index}</Descriptions.Item>
                <Descriptions.Item label="成立日期">{fund.establishDate}</Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={12}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="基金规模">{fund.scale?.toFixed(2)} 亿元</Descriptions.Item>
                <Descriptions.Item label="基金份额">{fund.share} 亿份</Descriptions.Item>
                <Descriptions.Item label="份额变化">
                  <span style={{ color: getReturnColor(Number(fund.shareChange)) }}>
                    {Number(fund.shareChange) >= 0 ? '+' : ''}{fund.shareChange}%
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="机构持有">{fund.institutionHold}%</Descriptions.Item>
                <Descriptions.Item label="个人持有">{fund.individualHold}%</Descriptions.Item>
                <Descriptions.Item label="推荐评级">
                  <span style={{ color: '#faad14' }}>{'★'.repeat(fund.rating)}</span>
                </Descriptions.Item>
                <Descriptions.Item label="风险等级">{getRiskTag(fund.riskLevel)}</Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>

          <Card size="small" style={{ marginTop: 16, background: '#f5f5f5' }}>
            <h4 style={{ marginBottom: 12 }}>持有人结构</h4>
            <Progress
              percent={Number(fund.individualHold)}
              success={{ percent: Number(fund.institutionHold) }}
              format={() => `个人 ${fund.individualHold}% / 机构 ${fund.institutionHold}%`}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'fee',
      label: '费率详情',
      children: (
        <div>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <h4 style={{ marginBottom: 16 }}>管理费率</h4>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="管理费">{fund.managementFee?.toFixed(2)}%/年</Descriptions.Item>
                <Descriptions.Item label="托管费">{fund.custodyFee?.toFixed(2)}%/年</Descriptions.Item>
                <Descriptions.Item label="销售服务费">{fund.serviceFee?.toFixed(2)}%/年</Descriptions.Item>
                <Descriptions.Item label={<span style={{ color: '#52c41a', fontWeight: 600 }}>综合费率</span>}>
                  <span style={{ color: '#52c41a', fontWeight: 700, fontSize: 16 }}>{fund.totalFee?.toFixed(2)}%/年</span>
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={12}>
              <h4 style={{ marginBottom: 16 }}>申购费率</h4>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="原申购费">{fund.purchaseFee?.toFixed(2)}%</Descriptions.Item>
                <Descriptions.Item label={<span style={{ color: '#52c41a', fontWeight: 600 }}>支付宝1折</span>}>
                  <span style={{ color: '#52c41a', fontWeight: 700, fontSize: 16 }}>{fund.purchaseFeeDiscount?.toFixed(2)}%</span>
                </Descriptions.Item>
              </Descriptions>

              <h4 style={{ marginBottom: 16, marginTop: 24 }}>赎回费率</h4>
              <Descriptions column={1} size="small" bordered>
                {fund.redeemFee?.map((fee, index) => (
                  <Descriptions.Item key={index} label={fee.period}>{fee.rate?.toFixed(2)}%</Descriptions.Item>
                ))}
              </Descriptions>
            </Col>
          </Row>

          <Alert
            type="info"
            message="费率说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                <li>综合费率 = 管理费 + 托管费 + 销售服务费</li>
                <li>支付宝购买可享受申购费1折优惠</li>
                <li>持有时间越长，赎回费越低，持有2年以上通常免赎回费</li>
                <li>C类基金免申购费，但有销售服务费</li>
              </ul>
            }
            style={{ marginTop: 16 }}
          />
        </div>
      ),
    },
    {
      key: 'valuation',
      label: '估值分析',
      children: (
        <div>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic title="PE(TTM)" value={fund.pe} valueStyle={{ fontSize: 28 }} />
                <div style={{ fontSize: 12, color: '#666' }}>市盈率</div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic title="PB" value={fund.pb} valueStyle={{ fontSize: 28 }} />
                <div style={{ fontSize: 12, color: '#666' }}>市净率</div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic title="PE历史分位" value={fund.pePercentile} suffix="%" valueStyle={{ fontSize: 28 }} />
                <Progress percent={Number(fund.pePercentile)} showInfo={false} size="small" />
                <div style={{ fontSize: 12, color: '#666' }}>比 {fund.pePercentile}% 的时间便宜</div>
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic title="PB历史分位" value={fund.pbPercentile} suffix="%" valueStyle={{ fontSize: 28 }} />
                <Progress percent={Number(fund.pbPercentile)} showInfo={false} size="small" />
                <div style={{ fontSize: 12, color: '#666' }}>比 {fund.pbPercentile}% 的时间便宜</div>
              </Card>
            </Col>
          </Row>

          <Card size="small" style={{ marginTop: 16, background: '#f5f5f5' }}>
            <h4 style={{ marginBottom: 12 }}>估值判断</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                fontSize: 24, fontWeight: 700,
                color: getValuationColor(fund.valuation),
                padding: '8px 20px', background: 'white', borderRadius: 8,
                border: `2px solid ${getValuationColor(fund.valuation)}`,
              }}>
                {getValuationText(fund.valuation)}
              </div>
              <p style={{ flex: 1, lineHeight: 1.6, color: '#333', margin: 0 }}>
                {fund.valuation === 'very_low' || fund.valuation === 'low'
                  ? '当前估值处于历史低位，具有较好的投资价值，适合逢低布局或定投配置。'
                  : fund.valuation === 'reasonable'
                  ? '当前估值处于合理区间，适合正常定投配置。'
                  : '当前估值偏高，建议谨慎投资，可等待回调后再买入。'}
              </p>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: 'holdings',
      label: '持仓分析',
      children: (
        <div>
          {fund.topHoldings && fund.topHoldings.length > 0 ? (
            <div>
              <ReactECharts option={holdingsChartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
              <h4 style={{ margin: '16px 0 12px' }}>前十大持仓明细</h4>
              {fund.topHoldings.map((holding, index) => (
                <div key={index} style={{
                  display: 'flex', alignItems: 'center', marginBottom: 8,
                  padding: '10px 16px', background: index % 2 === 0 ? '#fafafa' : 'white', borderRadius: 8,
                }}>
                  <Tag color={index < 3 ? 'blue' : 'default'} style={{ marginRight: 12 }}>{index + 1}</Tag>
                  <span style={{ flex: 1, fontWeight: 500 }}>{holding.name}</span>
                  <span style={{ width: 80, textAlign: 'right', fontWeight: 600, color: '#1677ff' }}>
                    {holding.percentage?.toFixed(2)}%
                  </span>
                  <Progress percent={holding.percentage * 5} showInfo={false} size="small" style={{ width: 120, marginLeft: 16 }} />
                </div>
              ))}
              <Alert type="info" message="持仓数据为历史披露，仅供参考，实际持仓可能已发生变化" style={{ marginTop: 16 }} />
            </div>
          ) : (
            <Alert type="info" message="暂无持仓数据" />
          )}
        </div>
      ),
    },
    {
      key: 'performance',
      label: '历史业绩',
      children: (
        <div>
          {fund.performanceHistory && fund.performanceHistory.length > 0 ? (
            <div>
              <ReactECharts option={navChartOption} style={{ height: 300 }} opts={{ renderer: 'svg' }} />
              <Alert type="info" message="历史业绩不代表未来表现，仅供参考。基金有风险，投资需谨慎。" style={{ marginTop: 16 }} />
            </div>
          ) : (
            <Alert type="info" message="暂无历史业绩数据" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { title: <Link to="/">首页</Link> },
          { title: <Link to="/funds">基金列表</Link> },
          { title: fund.name },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* 基金基本信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="top">
          <Col xs={24} md={16}>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>{fund.name}</h1>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              {fund.fullName} | 基金经理: {fund.fundManager}
            </div>
            <Space size={8} wrap>
              <Tag color="blue">{fund.industry || fund.type}</Tag>
              <Tag>{fund.company}</Tag>
              <Tag>{fund.index}</Tag>
              {getRiskTag(fund.riskLevel)}
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Statistic
              title={`最新净值 (${fund.navDate})`}
              value={fund.nav}
              precision={4}
              valueStyle={{ fontSize: 36, fontWeight: 700, color: '#1677ff' }}
            />
            <div style={{ marginTop: 4 }}>
              <span style={{ color: '#faad14', fontSize: 18 }}>{'★'.repeat(fund.rating)}</span>
            </div>
          </Col>
        </Row>

        {/* 收益率概览 */}
        <Row gutter={16} style={{ marginTop: 20 }}>
          {[
            { label: '近1年', value: fund.return1y },
            { label: '近6月', value: fund.return6m },
            { label: '近3月', value: fund.return3m },
            { label: '近1月', value: fund.return1m },
            { label: '近1周', value: fund.return1w },
          ].map((item) => (
            <Col xs={12} sm={8} md={4} key={item.label} style={{ marginBottom: 8 }}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: getReturnColor(item.value) }}>
                  {formatReturn(item.value)}
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* 核心指标 */}
        <Row gutter={16} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <Col xs={12} sm={6}>
            <div style={{ color: '#666', fontSize: 12 }}>综合费率</div>
            <div style={{ fontWeight: 600, color: '#1677ff' }}>{fund.totalFee?.toFixed(2)}%/年</div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ color: '#666', fontSize: 12 }}>基金规模</div>
            <div style={{ fontWeight: 600 }}>{fund.scale?.toFixed(2)}亿</div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ color: '#666', fontSize: 12 }}>申购状态</div>
            <Tag color={fund.purchaseStatus === 'open' ? 'green' : fund.purchaseStatus === 'limited' ? 'orange' : 'red'}>
              {fund.purchaseStatus === 'open' ? '开放申购' : fund.purchaseStatus === 'limited' ? '限大额' : '暂停申购'}
            </Tag>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{ color: '#666', fontSize: 12 }}>每日限额</div>
            <div style={{ fontWeight: 600, color: fund.dailyLimit > 0 ? '#ff4d4f' : '#666' }}>
              {fund.dailyLimit > 0 ? `${fund.dailyLimit}元` : '无限额'}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 投资建议 */}
      <Card style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', marginBottom: 16, border: 'none' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>投资建议</h3>
        <Row gutter={20}>
          <Col xs={24} md={12}>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>推荐理由</div>
            <p style={{ lineHeight: 1.6 }}>{fund.recommendation}</p>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>适合人群</div>
            <p style={{ lineHeight: 1.6 }}>{fund.suitableFor}</p>
          </Col>
        </Row>
        <Card size="small" style={{ marginTop: 12, background: 'rgba(255,255,255,0.7)' }}>
          <div style={{ color: '#666', fontSize: 13, marginBottom: 4 }}>操作建议</div>
          <p style={{ lineHeight: 1.6, margin: 0 }}>{fund.investmentAdvice}</p>
        </Card>
      </Card>

      {/* 标签页 */}
      <Card>
        <Tabs items={tabItems} />
      </Card>

      {/* 操作按钮 */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <Link to="/funds"><Button>返回列表</Button></Link>
          <Link to={`/funds?codes=${fund.code}`}><Button>加入对比</Button></Link>
          <a href={`https://fund.eastmoney.com/${fund.code}.html`} target="_blank" rel="noopener noreferrer">
            <Button type="primary" icon={<LinkOutlined />}>在东方财富查看</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
