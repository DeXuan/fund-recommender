import { Card, Table, Button, Space, Empty, Badge, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ScheduleOutlined, SyncOutlined, LinkOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

interface Props {
  dcaPlans: any[];
  loading: boolean;
  syncing: boolean;
  isDark: boolean;
  onSyncDca: () => void;
  onAddDca: () => void;
  onEditDca: (plan: any) => void;
  onDeleteDca: (id: number) => void;
}

export function DCAPlansPanel({ dcaPlans, loading, syncing, isDark, onSyncDca, onAddDca, onEditDca, onDeleteDca }: Props) {
  const frequencyLabel = (f: string) => ({
    weekly: '每周', biweekly: '每两周', monthly: '每月', quarterly: '每季度',
  }[f] || f);

  const dcaColumns = [
    {
      title: '基金名称', dataIndex: 'fund_name', key: 'fund_name', width: 180,
      render: (name: string, record: any) => (
        <Link to={`/funds/${record.fund_code}`} style={{ fontWeight: 500, color: 'var(--primary)' }}>
          {name} <LinkOutlined style={{ fontSize: 11, color: 'var(--primary)' }} />
        </Link>
      ),
    },
    {
      title: '基金代码', dataIndex: 'fund_code', key: 'fund_code', width: 100,
      render: (code: string) => (
        <Link to={`/funds/${code}`} style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontFamily: 'monospace' }}>{code}</Link>
      ),
    },
    {
      title: '定投金额', dataIndex: 'amount', key: 'amount', width: 110,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '频率', dataIndex: 'frequency', key: 'frequency', width: 90,
      render: (v: string) => frequencyLabel(v),
    },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date', width: 110 },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date', width: 110, render: (v: string) => v || '长期' },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: string) => v === 'active'
        ? <Badge status="processing" text="执行中" />
        : <Badge status="default" text={v === 'completed' ? '已到期' : '已暂停'} />,
    },
    {
      title: '上次执行', dataIndex: 'last_executed', key: 'last_executed', width: 110,
      render: (v: string) => v || '未执行',
    },
    {
      title: '操作', key: 'action', width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEditDca(record)}>编辑</Button>
          <Popconfirm title="确认删除此定投计划？" onConfirm={() => onDeleteDca(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<><ScheduleOutlined style={{ marginRight: 8 }} />定投计划</>}
      extra={
        <Space>
          <Tooltip title="同步定投：根据计划自动生成最近的持仓记录">
            <Button icon={<SyncOutlined spin={syncing} />} onClick={onSyncDca} loading={syncing}>
              同步定投
            </Button>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddDca}>新建定投</Button>
        </Space>
      }
      style={{ marginBottom: 24 }}
    >
      {dcaPlans.length === 0 && !loading ? (
        <Empty description="暂无定投计划，点击右上角新建" />
      ) : (
        <Table
          columns={dcaColumns}
          dataSource={dcaPlans.map(p => ({ ...p, key: p.id }))}
          pagination={false}
          size="middle"
          scroll={{ x: 900 }}
        />
      )}
    </Card>
  );
}
