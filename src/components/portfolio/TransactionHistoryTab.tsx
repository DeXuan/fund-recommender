import { Card, Table, Button, Space, Segmented, Row, Col, Statistic, Tag, message } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { portfolioApi } from '../../services/api';

interface Props {
  transactions: any[];
  txTotal: number;
  txPage: number;
  txStats: any;
  txFilter: string;
  txLoading: boolean;
  onFilterChange: (v: string) => void;
  onPageChange: (p: number) => void;
  onRefresh: () => void;
}

export function TransactionHistoryTab({
  transactions, txTotal, txPage, txStats, txFilter, txLoading,
  onFilterChange, onPageChange, onRefresh,
}: Props) {
  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Segmented
            options={[{ label: '全部', value: 'all' }, { label: '买入', value: 'buy' }, { label: '卖出', value: 'sell' }]}
            value={txFilter}
            onChange={v => onFilterChange(v as string)}
          />
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>刷新</Button>
          <Button icon={<DownloadOutlined />} onClick={async () => {
            try {
              await portfolioApi.exportTransactions({ type: txFilter !== 'all' ? txFilter : undefined });
              message.success('导出成功');
            } catch { message.error('导出失败'); }
          }}>导出流水</Button>
        </Space>
      </Card>
      {txStats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="买入笔数" value={txStats.buy_count} valueStyle={{ color: 'var(--danger)' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="卖出笔数" value={txStats.sell_count} valueStyle={{ color: 'var(--success)' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="总买入费" value={txStats.total_buy_fees} prefix="¥" precision={2} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="已实现盈亏" value={txStats.total_realized_pnl} prefix="¥" precision={2} valueStyle={{ color: txStats.total_realized_pnl >= 0 ? 'var(--danger)' : 'var(--success)' }} /></Card></Col>
        </Row>
      )}
      <Table
        dataSource={transactions}
        rowKey="id"
        size="small"
        loading={txLoading}
        pagination={{ current: txPage, total: txTotal, pageSize: 30, onChange: onPageChange }}
        columns={[
          { title: '日期', dataIndex: 'buy_date', width: 100, render: (v: string, r: any) => r.sell_date || v },
          { title: '类型', dataIndex: 'record_type', width: 60, render: (v: string) => <Tag color={v === 'sell' ? 'green' : 'red'}>{v === 'sell' ? '卖出' : '买入'}</Tag> },
          { title: '基金名称', dataIndex: 'fund_name', width: 160, ellipsis: true },
          { title: '基金代码', dataIndex: 'fund_code', width: 80 },
          { title: '份额', dataIndex: 'shares', width: 100, render: (v: number, r: any) => r.record_type === 'sell' ? <span style={{ color: 'var(--success)' }}>{Math.abs(Number(v)).toFixed(2)}</span> : <span style={{ color: 'var(--danger)' }}>{Number(v).toFixed(2)}</span> },
          { title: '价格', dataIndex: 'cost_price', width: 90, render: (v: number, r: any) => r.record_type === 'sell' ? (r.sell_price || v) : v },
          { title: '手续费', width: 80, render: (_: any, r: any) => r.record_type === 'sell' ? (r.sell_fee || 0) : (r.buy_fee || 0) },
          { title: '实现盈亏', dataIndex: 'realized_pnl', width: 100, render: (v: number, r: any) => r.record_type === 'sell' && v != null ? <span style={{ color: v >= 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 500 }}>{v >= 0 ? '+' : ''}¥{v.toFixed(2)}</span> : '-' },
          { title: '备注', dataIndex: 'notes', ellipsis: true },
        ]}
      />
    </>
  );
}
