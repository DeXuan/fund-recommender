import { Card, Row, Col } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { PortfolioHolding, PortfolioSummary } from '../../types';

interface Props {
  summary: PortfolioSummary | null;
  holdings: PortfolioHolding[];
  txStats: any;
  isDark: boolean;
  getHoldingDays: (h: PortfolioHolding) => number;
}

export function PortfolioSummaryCards({ summary, holdings, txStats, isDark, getHoldingDays }: Props) {
  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>总投入</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>¥{(summary?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>当前市值</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>¥{(summary?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: (summary?.totalPnl || 0) >= 0 ? 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>总盈亏</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>
              {(summary?.totalPnl || 0) >= 0 ? '+' : '-'}¥{Math.abs(summary?.totalPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span style={{ fontSize: 14, marginLeft: 4 }}>{(summary?.totalPnl || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}</span>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card style={{ background: (summary?.totalReturn || 0) >= 0 ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)' : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 }}>总收益率</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>
              {(summary?.totalReturn || 0) >= 0 ? '+' : ''}{(summary?.totalReturn || 0).toFixed(2)}%
            </div>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1677ff' }}>{holdings.length}</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>持仓数量</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#722ed1' }}>
              {txStats?.total_realized_pnl != null ? (txStats.total_realized_pnl >= 0 ? '+' : '') + txStats.total_realized_pnl.toFixed(0) : '-'}
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>已实现盈亏</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fa8c16' }}>
              {holdings.length > 0 ? (() => {
                const days = holdings.map(h => getHoldingDays(h));
                return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
              })() : '-'}
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>平均持仓天数</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: holdings.filter(h => h.pnl > 0).length >= holdings.filter(h => h.pnl < 0).length ? '#52c41a' : '#ff4d4f' }}>
              {holdings.length > 0 ? (holdings.filter(h => h.pnl > 0).length / holdings.length * 100).toFixed(0) + '%' : '-'}
            </div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>持仓胜率</div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
