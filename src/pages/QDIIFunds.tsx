import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Tabs, Table, Tag, Button, Spin, Row, Col, Alert } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';

interface Fund {
  code: string;
  name: string;
  type: string;
  industry: string;
  index: string;
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
  rating: number;
  buySuggestion: string;
  valuation: string;
  trend: string;
  logic: string;
  dailyLimit?: number;
}

export default function QDIIFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQDIIFunds();
    const interval = setInterval(loadQDIIFunds, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQDIIFunds = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getQDIIFunds();
      setFunds(data);
    } catch (error) {
      console.error('加载QDII基金失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const nasdaqFunds = useMemo(() => funds.filter(f => f.industry === '纳斯达克100'), [funds]);
  const sp500Funds = useMemo(() => funds.filter(f => f.industry === '标普500'), [funds]);

  const renderReturn = (val: number) => (
    <span style={{ color: getReturnColor(val), fontWeight: 600 }}>{formatReturn(val)}</span>
  );

  const columns = [
    {
      title: '基金代码',
      dataIndex: 'code',
      key: 'code',
      width: 90,
      render: (code: string) => <Link to={`/funds/${code}`} style={{ color: '#1677ff' }}>{code}</Link>,
    },
    {
      title: '基金名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Fund) => (
        <Link to={`/funds/${record.code}`} style={{ color: '#333', fontWeight: 500 }}>{name}</Link>
      ),
    },
    { title: 'A/C类', key: 'type', width: 70, render: (_: any, record: Fund) => record.name.includes('C') ? 'C' : 'A' },
    { title: '近1年', dataIndex: 'return1y', key: 'return1y', sorter: (a: Fund, b: Fund) => a.return1y - b.return1y, render: renderReturn },
    { title: '近3月', dataIndex: 'return3m', key: 'return3m', sorter: (a: Fund, b: Fund) => a.return3m - b.return3m, render: renderReturn },
    { title: '近1月', dataIndex: 'return1m', key: 'return1m', sorter: (a: Fund, b: Fund) => a.return1m - b.return1m, render: renderReturn },
    { title: '管理费', dataIndex: 'managementFee', key: 'managementFee', sorter: (a: Fund, b: Fund) => a.managementFee - b.managementFee, render: (v: number) => `${v?.toFixed(2)}%` },
    { title: '综合费率', dataIndex: 'totalFee', key: 'totalFee', sorter: (a: Fund, b: Fund) => a.totalFee - b.totalFee, render: (v: number) => <strong>{v?.toFixed(2)}%</strong> },
    { title: '规模(亿)', dataIndex: 'scale', key: 'scale', sorter: (a: Fund, b: Fund) => a.scale - b.scale, render: (v: number) => v?.toFixed(1) },
    {
      title: '每日限额',
      dataIndex: 'dailyLimit',
      key: 'dailyLimit',
      defaultSortOrder: 'descend' as const,
      sorter: (a: Fund, b: Fund) => (a.dailyLimit ?? 0) - (b.dailyLimit ?? 0),
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: v === 0 ? '#999' : v <= 10 ? '#ff4d4f' : '#faad14' }}>
          {v === 0 ? '暂停' : `${v}元`}
        </span>
      ),
    },
    {
      title: '申购状态',
      dataIndex: 'buySuggestion',
      key: 'buySuggestion',
      render: (text: string) => (
        <Tag color={text === '暂停申购' ? 'red' : text === '限大额' ? 'orange' : 'green'}>{text}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_: any, record: Fund) => <Link to={`/funds/${record.code}`}><Button type="link" size="small">详情</Button></Link>,
    },
  ];

  const tabItems = [
    {
      key: 'nasdaq100',
      label: `纳斯达克100 (${nasdaqFunds.length})`,
      children: (
        <div>
          <Alert
            type="success"
            message="首选推荐"
            description={
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <strong>华安纳斯达克100ETF联接A (040046)</strong>
                  <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>费率适中0.6%，规模大47亿，跟踪误差小</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+33.42%</span></p>
                </Col>
                <Col xs={24} sm={12}>
                  <strong>天弘纳斯达克100指数A (018043)</strong>
                  <p style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>费率最低0.5%，规模22亿</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+32.11%</span></p>
                </Col>
              </Row>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table columns={columns} dataSource={nasdaqFunds} rowKey="code" pagination={false} size="small" scroll={{ x: 1000 }} />
        </div>
      ),
    },
    {
      key: 'sp500',
      label: `标普500 (${sp500Funds.length})`,
      children: (
        <div>
          <p style={{ color: '#666', marginBottom: 16 }}>标普500指数包含美国500家大型上市公司，覆盖科技、金融、医疗、消费等多个行业。</p>
          <Table columns={columns} dataSource={sp500Funds} rowKey="code" pagination={false} size="small" scroll={{ x: 1000 }} />
        </div>
      ),
    },
    {
      key: 'all',
      label: `全部QDII (${funds.length})`,
      children: <Table columns={columns} dataSource={funds} rowKey="code" pagination={{ pageSize: 20 }} size="small" scroll={{ x: 1000 }} />,
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>
        <GlobalOutlined style={{ marginRight: 8 }} />QDII基金专栏
      </h1>

      <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', marginBottom: 16 }}>
        <h3 style={{ color: 'white', marginBottom: 12 }}>什么是QDII基金？</h3>
        <p style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.8 }}>
          QDII基金是指经批准从事境外证券市场投资的基金。简单来说，就是用人民币买海外市场的基金。
        </p>
        <Row gutter={16} style={{ marginTop: 16 }}>
          {[
            { title: '分散风险', desc: '投资海外市场，降低单一市场风险' },
            { title: '全球配置', desc: '分享全球科技成长红利' },
            { title: '人民币购买', desc: '无需换汇，直接人民币申购' },
          ].map((item) => (
            <Col xs={24} sm={8} key={item.title}>
              <Card size="small" style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <strong style={{ color: 'white' }}>{item.title}</strong>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>{item.desc}</p>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card>
        {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> : <Tabs items={tabItems} />}
      </Card>

      <Card title="QDII额度说明" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fff2f0', border: '1px solid #ffccc7' }}>
              <h4 style={{ color: '#ff4d4f', marginBottom: 8 }}>暂停申购</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>QDII额度紧张，基金公司暂停申购，无法买入</p>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#fffbe6', border: '1px solid #ffe58f' }}>
              <h4 style={{ color: '#faad14', marginBottom: 8 }}>限大额</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>每日限购10-100元，需要每天抢购</p>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <h4 style={{ color: '#52c41a', marginBottom: 8 }}>开放申购</h4>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>正常申购，无限额限制</p>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
