import { useRef } from 'react';
import { Card, Table, Button, Space, Tag, Tooltip, Empty, Popconfirm, message } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, SyncOutlined, LinkOutlined, SwapOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { PortfolioHolding } from '../../types';
import { portfolioApi } from '../../services/api';

interface Props {
  holdings: PortfolioHolding[];
  loading: boolean;
  isDark: boolean;
  refreshing: boolean;
  lastRefreshTime: string | null;
  onRefreshNav: () => void;
  onAdd: () => void;
  onEdit: (record: any) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAlipayImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownloadTemplate: () => void;
  onExportHoldings: () => void;
  onSell: (holding: PortfolioHolding) => void;
  onReload: () => void;
  getHoldingDays: (h: PortfolioHolding) => number;
  getFeeTier: (days: number) => { label: string; color: string; icon?: React.ReactNode };
}

export function HoldingsTable({
  holdings, loading, isDark, refreshing, lastRefreshTime,
  onRefreshNav, onAdd, onEdit, onImport, onAlipayImport,
  onDownloadTemplate, onExportHoldings, onSell, onReload,
  getHoldingDays, getFeeTier,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const alipayFileInputRef = useRef<HTMLInputElement>(null);

  const pnlColor = (v: number) => v >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600');
  const pnlSign = (v: number) => v >= 0 ? '+' : '-';

  const columns = [
    {
      title: '基金名称', dataIndex: 'fund_name', key: 'fund_name', width: 180,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.fund_name.localeCompare(b.fund_name, 'zh-CN'),
      render: (name: string, record: PortfolioHolding) => (
        <Link to={`/funds/${record.fund_code}`} style={{ fontWeight: 500, color: '#1677ff' }}>
          {name} <LinkOutlined style={{ fontSize: 11, color: '#1677ff' }} />
        </Link>
      ),
    },
    {
      title: '基金代码', dataIndex: 'fund_code', key: 'fund_code', width: 100,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.fund_code.localeCompare(b.fund_code),
      render: (code: string) => (
        <Link to={`/funds/${code}`} style={{ color: isDark ? '#6b6b6b' : '#8c8c8c', fontFamily: 'monospace' }}>{code}</Link>
      ),
    },
    {
      title: '持有份额', dataIndex: 'total_shares', key: 'total_shares', width: 100,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.total_shares - b.total_shares,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '成本价', dataIndex: 'avg_cost_price', key: 'avg_cost_price', width: 90,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.avg_cost_price - b.avg_cost_price,
      render: (v: any) => v != null ? Number(v).toFixed(4) : '-',
    },
    {
      title: '当前净值', dataIndex: 'current_nav', key: 'current_nav', width: 90,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.current_nav - b.current_nav,
      render: (v: any, record: PortfolioHolding) => (
        <Tooltip title={record.nav_updated_at ? `更新: ${new Date(record.nav_updated_at).toLocaleString('zh-CN')}` : '未更新'}>
          <span>{v != null ? Number(v).toFixed(4) : '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '市值', dataIndex: 'market_value', key: 'market_value', width: 110,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.market_value - b.market_value,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '盈亏', dataIndex: 'pnl', key: 'pnl', width: 110,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.pnl - b.pnl,
      render: (v: number) => (
        <span style={{ color: pnlColor(v), fontWeight: 600 }}>
          {pnlSign(v)}¥{Math.abs(v).toLocaleString()}
        </span>
      ),
    },
    {
      title: '收益率', dataIndex: 'pnl_percent', key: 'pnl_percent', width: 90,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => a.pnl_percent - b.pnl_percent,
      defaultSortOrder: 'ascend' as const,
      render: (v: number) => (
        <Tag color={v >= 0 ? 'red' : 'green'}>{pnlSign(v)}{Math.abs(v).toFixed(2)}%</Tag>
      ),
    },
    {
      title: '持有天数', key: 'holding_days', width: 100,
      sorter: (a: PortfolioHolding, b: PortfolioHolding) => getHoldingDays(a) - getHoldingDays(b),
      render: (_: any, record: PortfolioHolding) => {
        const days = getHoldingDays(record);
        const tier = getFeeTier(days);
        return (
          <Tooltip title={tier.label}>
            <span style={{ color: tier.color, fontWeight: 500 }}>
              {days}天 {tier.icon}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right' as const,
      render: (_: any, holding: PortfolioHolding) => (
        <Space>
          <Button type="link" size="small" icon={<SwapOutlined />} style={{ color: '#faad14' }}
            onClick={() => onSell(holding)}>
            赎回
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />}
            onClick={() => onEdit(holding.records[0])}>
            编辑
          </Button>
          <Popconfirm title="确认删除此基金的所有持仓记录？" onConfirm={async () => {
            try {
              await Promise.all(holding.records.map(r => portfolioApi.deleteRecord(r.id)));
              message.success('删除成功');
              onReload();
            } catch {
              message.error('删除失败');
            }
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tableData = holdings.map((h, i) => ({ ...h, key: h.fund_code || i }));

  return (
    <Card
      title={
        <span>
          持仓明细
          {lastRefreshTime && (
            <span style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#8c8c8c', fontWeight: 'normal', marginLeft: 12 }}>
              净值更新于 {lastRefreshTime}
            </span>
          )}
        </span>
      }
      extra={
        <Space>
          <Button
            icon={<SyncOutlined spin={refreshing} />}
            onClick={onRefreshNav}
            loading={refreshing}
          >
            刷新净值
          </Button>
          <Button icon={<DownloadOutlined />} onClick={onDownloadTemplate}>下载模板</Button>
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>导入CSV</Button>
          <Button icon={<DownloadOutlined />} onClick={onExportHoldings}>导出持仓</Button>
          <Button icon={<UploadOutlined />} onClick={() => alipayFileInputRef.current?.click()}>支付宝导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>添加持仓</Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={onImport}
          />
          <input
            ref={alipayFileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={onAlipayImport}
          />
        </Space>
      }
      style={{ marginBottom: 24 }}
    >
      {holdings.length === 0 && !loading ? (
        <Empty description="暂无持仓记录，点击上方按钮添加" />
      ) : (
        <Table
          columns={columns}
          dataSource={tableData}
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={false}
          size="middle"
        />
      )}
    </Card>
  );
}
