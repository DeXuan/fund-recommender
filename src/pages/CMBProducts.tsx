import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Table, Card, Typography, Tag, Space, Button, message, Tooltip } from 'antd';
import {
  ReloadOutlined, BankOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PauseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { fundApi } from '../services/api';
import { getReturnColor } from '../utils/format';

const { Title, Text } = Typography;

// ========== 个人理财产品 ==========
interface CMBProduct {
  product_code: string;
  product_name: string;
  risk_level: string;
  product_status: string;
  investment_period: string;
  unit_nav: number | null;
  nav_date: string | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_ytd: number | null;
  return_since: number | null;
  updated_at: string;
}

const statusColor: Record<string, string> = {
  '存续': 'green', '正常': 'green', '封闭期': 'orange', '开放期': 'blue',
  '已到期': 'red', '募集中': 'cyan',
};

const riskColor: Record<string, string> = {
  'R1': 'green', 'R2': 'blue', 'R3': 'orange', 'R4': 'red', 'R5': 'magenta',
  '稳健型': 'blue', '平衡型': 'orange', '进取型': 'red', '保守型': 'green',
};

function formatReturnNode(val: number | null): React.ReactNode {
  if (val === null || val === undefined) return <Text type="secondary">-</Text>;
  const color = getReturnColor(val);
  const prefix = val >= 0 ? '+' : '';
  return <span style={{ color, fontWeight: 600 }}>{prefix}{val.toFixed(2)}%</span>;
}

const personalColumns: ColumnsType<CMBProduct> = [
  {
    title: '产品代码',
    dataIndex: 'product_code',
    key: 'product_code',
    width: 110,
    fixed: 'left',
    render: (code: string) => (
      <Link
        to={`/cmb-products/${code}`}
        style={{ fontFamily: 'monospace', fontWeight: 600 }}
      >
        {code}
      </Link>
    ),
  },
  {
    title: '产品名称',
    dataIndex: 'product_name',
    key: 'product_name',
    ellipsis: true,
    width: 300,
  },
  {
    title: '投资期限',
    dataIndex: 'investment_period',
    key: 'investment_period',
    width: 90,
    align: 'center',
    sorter: (a, b) => {
      const parseDays = (s: string) => {
        if (!s || s === '灵活') return 0;
        const m = s.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      };
      return parseDays(a.investment_period) - parseDays(b.investment_period);
    },
    render: (period: string) => (
      <Tag color="blue">{period || '灵活'}</Tag>
    ),
  },
  {
    title: '产品状态',
    dataIndex: 'product_status',
    key: 'product_status',
    width: 90,
    align: 'center',
    render: (status: string) => {
      const icon = status === '存续' || status === '正常'
        ? <CheckCircleOutlined />
        : status === '封闭期'
          ? <PauseCircleOutlined />
          : <ClockCircleOutlined />;
      return <Tag icon={icon} color={statusColor[status] || 'default'}>{status || '-'}</Tag>;
    },
  },
  {
    title: '最新净值',
    dataIndex: 'unit_nav',
    key: 'unit_nav',
    width: 100,
    align: 'right',
    sorter: (a, b) => (a.unit_nav || 0) - (b.unit_nav || 0),
    render: (nav: number | null, record) => nav ? (
      <Tooltip title={`净值日期: ${record.nav_date || '-'}`}>
        <Text strong style={{ color: '#1677ff' }}>{nav.toFixed(4)}</Text>
      </Tooltip>
    ) : <Text type="secondary">-</Text>,
  },
  {
    title: '近1月',
    dataIndex: 'return_1m',
    key: 'return_1m',
    width: 100,
    align: 'right',
    defaultSortOrder: 'descend' as const,
    sorter: (a, b) => (a.return_1m ?? -999) - (b.return_1m ?? -999),
    render: formatReturnNode,
  },
  {
    title: '近3月',
    dataIndex: 'return_3m',
    key: 'return_3m',
    width: 100,
    align: 'right',
    sorter: (a, b) => (a.return_3m ?? -999) - (b.return_3m ?? -999),
    render: formatReturnNode,
  },
  {
    title: '近6月',
    dataIndex: 'return_6m',
    key: 'return_6m',
    width: 100,
    align: 'right',
    sorter: (a, b) => (a.return_6m ?? -999) - (b.return_6m ?? -999),
    render: formatReturnNode,
  },
  {
    title: '今年以来',
    dataIndex: 'return_ytd',
    key: 'return_ytd',
    width: 100,
    align: 'right',
    sorter: (a, b) => (a.return_ytd ?? -999) - (b.return_ytd ?? -999),
    render: formatReturnNode,
  },
  {
    title: '成立以来',
    dataIndex: 'return_since',
    key: 'return_since',
    width: 100,
    align: 'right',
    sorter: (a, b) => (a.return_since ?? -999) - (b.return_since ?? -999),
    render: formatReturnNode,
  },
  {
    title: '净值日期',
    dataIndex: 'nav_date',
    key: 'nav_date',
    width: 110,
    align: 'center',
    render: (d: string) => d ? (
      <Tag color="geekblue" style={{ fontFamily: 'monospace' }}>
        {new Date(d).toLocaleDateString('zh-CN')}
      </Tag>
    ) : <Text type="secondary">-</Text>,
  },
];

// ========== 统计卡片组件 ==========
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card size="small" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </Card>
  );
}

// ========== 主组件 ==========
export default function CMBProducts() {
  // 个人产品状态
  const [personalData, setPersonalData] = useState<CMBProduct[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // 加载个人产品
  const fetchPersonalData = async () => {
    try {
      setPersonalLoading(true);
      const result = await fundApi.getCMBProducts();
      setPersonalData(result);
    } catch (err: any) {
      message.error(err.message || '获取数据失败');
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setUpdating(true);
      await fundApi.triggerCMBUpdate();
      message.success('数据更新已启动，请稍后刷新查看');
    } catch (err: any) {
      message.error(err.message || '触发更新失败');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => { fetchPersonalData(); }, []);

  // 个人产品统计
  const personalStats = useMemo(() => {
    const calc = (key: keyof CMBProduct) => {
      const valid = personalData.filter(d => d[key] !== null);
      if (valid.length === 0) return 0;
      return valid.reduce((s, d) => s + ((d[key] as number) || 0), 0) / valid.length;
    };
    return {
      count: personalData.length,
      avg1m: calc('return_1m'),
      avg3m: calc('return_3m'),
      avg6m: calc('return_6m'),
      avgYtd: calc('return_ytd'),
      avgSince: calc('return_since'),
    };
  }, [personalData]);

  const latestUpdate = personalData.reduce((latest, d) => {
    if (!d.updated_at) return latest;
    return !latest || new Date(d.updated_at) > new Date(latest) ? d.updated_at : latest;
  }, '' as string);

  const renderReturnCard = (label: string, val: number) => (
    <StatCard
      label={label}
      value={`${val >= 0 ? '+' : ''}${val.toFixed(2)}%`}
      color={getReturnColor(val)}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space align="center">
          <BankOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Title level={3} style={{ margin: 0 }}>招商银行持仓理财</Title>
        </Space>
        <Space>
          {latestUpdate && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              最后更新: {new Date(latestUpdate).toLocaleString('zh-CN')}
            </Text>
          )}
          <Button
            icon={<ReloadOutlined spin={updating} />}
            onClick={handleUpdate}
            loading={updating}
          >
            更新数据
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="产品数量" value={String(personalStats.count)} color="#1677ff" />
        {renderReturnCard('平均近1月', personalStats.avg1m)}
        {renderReturnCard('平均近3月', personalStats.avg3m)}
        {renderReturnCard('平均近6月', personalStats.avg6m)}
        {renderReturnCard('平均今年以来', personalStats.avgYtd)}
        {renderReturnCard('平均成立以来', personalStats.avgSince)}
      </div>

      <Card>
        <Table
          columns={personalColumns}
          dataSource={personalData}
          rowKey="product_code"
          loading={personalLoading}
          pagination={false}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>
    </div>
  );
}
