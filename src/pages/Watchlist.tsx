import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Table, Tag, Button, Space, Empty, Spin, message, Popconfirm, Tooltip } from 'antd';
import { StarFilled, DeleteOutlined, LinkOutlined, FundOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { watchlistApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';

interface WatchlistItem {
  id: number;
  fund_code: string;
  fund_name: string;
  group_name: string;
  type: string;
  industry: string;
  total_fee: number | null;
  scale: number | null;
  rating: number | null;
  nav: number | null;
  return1y: number | null;
  return6m: number | null;
  return3m: number | null;
  return1m: number | null;
  return1w: number | null;
  created_at: string;
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWatchlist = async () => {
    try {
      const data = await watchlistApi.getList();
      setItems(data);
    } catch {
      message.error('加载自选列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWatchlist(); }, []);

  const handleRemove = async (fundCode: string) => {
    try {
      await watchlistApi.remove(fundCode);
      message.success('已移除自选');
      setItems(prev => prev.filter(i => i.fund_code !== fundCode));
    } catch {
      message.error('移除失败');
    }
  };

  const renderReturn = (val: number | null) => {
    if (val === null || val === undefined) return <span style={{ color: '#ccc' }}>-</span>;
    return <span style={{ color: getReturnColor(val), fontWeight: 600 }}>{formatReturn(val)}</span>;
  };

  const columns = [
    {
      title: '',
      key: 'star',
      width: 36,
      render: () => <StarFilled style={{ color: '#faad14', fontSize: 16 }} />,
    },
    {
      title: '基金名称',
      dataIndex: 'fund_name',
      key: 'fund_name',
      width: 200,
      render: (name: string, record: WatchlistItem) => (
        <Link to={`/funds/${record.fund_code}`} style={{ fontWeight: 500 }}>
          {name || record.fund_code} <LinkOutlined style={{ fontSize: 11, color: '#1677ff' }} />
        </Link>
      ),
    },
    {
      title: '代码',
      dataIndex: 'fund_code',
      key: 'fund_code',
      width: 90,
      render: (code: string) => (
        <Link to={`/funds/${code}`} style={{ color: '#8c8c8c', fontFamily: 'monospace' }}>{code}</Link>
      ),
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 100,
      render: (text: string) => text ? <Tag>{text}</Tag> : '-',
    },
    {
      title: '最新净值',
      dataIndex: 'nav',
      key: 'nav',
      width: 100,
      render: (nav: number | null) => nav ? nav.toFixed(4) : '-',
    },
    {
      title: '近1年',
      dataIndex: 'return1y',
      key: 'return1y',
      width: 100,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.return1y ?? 0) - (b.return1y ?? 0),
      render: renderReturn,
    },
    {
      title: '近6月',
      dataIndex: 'return6m',
      key: 'return6m',
      width: 100,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.return6m ?? 0) - (b.return6m ?? 0),
      render: renderReturn,
    },
    {
      title: '近3月',
      dataIndex: 'return3m',
      key: 'return3m',
      width: 100,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.return3m ?? 0) - (b.return3m ?? 0),
      render: renderReturn,
    },
    {
      title: '近1月',
      dataIndex: 'return1m',
      key: 'return1m',
      width: 100,
      defaultSortOrder: 'descend' as const,
      sorter: (a: WatchlistItem, b: WatchlistItem) => (a.return1m ?? 0) - (b.return1m ?? 0),
      render: renderReturn,
    },
    {
      title: '费率',
      dataIndex: 'total_fee',
      key: 'total_fee',
      width: 80,
      render: (v: number | null) => v ? `${v.toFixed(2)}%` : '-',
    },
    {
      title: '规模(亿)',
      dataIndex: 'scale',
      key: 'scale',
      width: 90,
      render: (v: number | null) => v ? v.toFixed(1) : '-',
    },
    {
      title: '评级',
      dataIndex: 'rating',
      key: 'rating',
      width: 80,
      render: (v: number | null) => v ? <span style={{ color: '#faad14' }}>{'★'.repeat(v)}</span> : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: WatchlistItem) => (
        <Space>
          <Popconfirm title="确认移除此基金？" onConfirm={() => handleRemove(record.fund_code)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>移除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <StarFilled style={{ color: '#faad14', marginRight: 8 }} />
          自选基金
          <span style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>{items.length} 只</span>
        </h2>
        <Link to="/funds"><Button type="primary">去添加更多</Button></Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : items.length === 0 ? (
        <Card>
          <Empty
            description="还没有自选基金"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Link to="/funds"><Button type="primary">去基金列表添加</Button></Link>
          </Empty>
        </Card>
      ) : (
        <Card>
          <Table
            columns={columns}
            dataSource={items}
            rowKey="fund_code"
            scroll={{ x: 1200 }}
            size="middle"
            pagination={false}
          />
        </Card>
      )}
    </div>
  );
}
