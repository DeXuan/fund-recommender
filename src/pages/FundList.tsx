import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Input, Select, Table, Tag, Button, Space, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';

interface Fund {
  code: string;
  name: string;
  type: string;
  nav: number;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  scale: number;
  industry: string;
  isGoldSelected?: boolean;
}

export default function FundList() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('全部');
  const [industries, setIndustries] = useState<string[]>([]);

  useEffect(() => {
    loadIndustries();
    loadFunds();
  }, []);

  useEffect(() => {
    loadFunds();
  }, [industry, search]);

  const loadIndustries = async () => {
    try {
      const data = await fundApi.getIndustries();
      setIndustries(['全部', ...data]);
    } catch (error) {
      console.error('加载行业列表失败:', error);
    }
  };

  const loadFunds = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getFunds({
        industry: industry !== '全部' ? industry : undefined,
        search: search || undefined,
      });
      setFunds(data);
    } catch (error) {
      console.error('加载基金列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderReturn = (val: number) => (
    <span style={{ color: getReturnColor(val), fontWeight: 600 }}>
      {formatReturn(val)}
    </span>
  );

  const columns = [
    {
      title: '基金代码',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code: string) => <Link to={`/funds/${code}`} style={{ color: '#1677ff' }}>{code}</Link>,
    },
    {
      title: '基金名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Fund) => (
        <Space>
          <Link to={`/funds/${record.code}`} style={{ color: '#333', fontWeight: 500 }}>{name}</Link>
          {record.isGoldSelected && <Tag color="gold" style={{ fontSize: 11 }}>金选</Tag>}
        </Space>
      ),
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 100,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '最新净值',
      dataIndex: 'nav',
      key: 'nav',
      width: 100,
      render: (nav: number) => nav?.toFixed(4) || '-',
    },
    {
      title: '近1年',
      dataIndex: 'return1y',
      key: 'return1y',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return1y - b.return1y,
      render: renderReturn,
    },
    {
      title: '近6月',
      dataIndex: 'return6m',
      key: 'return6m',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return6m - b.return6m,
      render: renderReturn,
    },
    {
      title: '近3月',
      dataIndex: 'return3m',
      key: 'return3m',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return3m - b.return3m,
      render: renderReturn,
    },
    {
      title: '近1月',
      dataIndex: 'return1m',
      key: 'return1m',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.return1m - b.return1m,
      defaultSortOrder: 'descend' as const,
      render: renderReturn,
    },
    {
      title: '规模(亿)',
      dataIndex: 'scale',
      key: 'scale',
      width: 100,
      sorter: (a: Fund, b: Fund) => a.scale - b.scale,
      render: (val: number) => val?.toFixed(2) || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Fund) => (
        <Link to={`/funds/${record.code}`}>
          <Button type="link" size="small">详情</Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>基金列表</h1>

      <Card style={{ marginBottom: 16 }}>
        <Space size={16} wrap>
          <Input.Search
            placeholder="搜索基金名称或代码..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
            prefix={<SearchOutlined />}
          />
          <Select
            value={industry}
            onChange={setIndustry}
            style={{ width: 160 }}
            options={industries.map((ind) => ({ label: ind, value: ind }))}
          />
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={funds}
          rowKey="code"
          loading={loading}
          size="middle"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 只基金` }}
        />
      </Card>
    </div>
  );
}
