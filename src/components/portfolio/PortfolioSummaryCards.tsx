import { Card, Row, Col } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import TiltCard from '../TiltCard';
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
          <TiltCard>
            <Card style={{ background: 'var(--gradient-card-purple)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
              <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>总投入</div>
              <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>¥{(summary?.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </Card>
          </TiltCard>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <TiltCard>
            <Card style={{ background: 'var(--gradient-card-pink)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
              <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>当前市值</div>
              <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>¥{(summary?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </Card>
          </TiltCard>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <TiltCard>
            <Card style={{ background: (summary?.totalPnl || 0) >= 0 ? 'var(--gradient-card-red)' : 'var(--gradient-card-green)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
              <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>总盈亏</div>
              <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>
                {(summary?.totalPnl || 0) >= 0 ? '+' : '-'}¥{Math.abs(summary?.totalPnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span style={{ fontSize: 14, marginLeft: 4 }}>{(summary?.totalPnl || 0) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}</span>
              </div>
            </Card>
          </TiltCard>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <TiltCard>
            <Card style={{ background: (summary?.totalReturn || 0) >= 0 ? 'var(--gradient-card-gold)' : 'var(--gradient-card-green)', border: 'none', borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
              <div style={{ color: 'var(--color-text-on-dark-secondary)', fontSize: 13, marginBottom: 4 }}>总收益率</div>
              <div style={{ color: 'var(--color-text-on-dark)', fontSize: 24, fontWeight: 700 }}>
                {(summary?.totalReturn || 0) >= 0 ? '+' : ''}{(summary?.totalReturn || 0).toFixed(2)}%
              </div>
            </Card>
          </TiltCard>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{holdings.length}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>持仓数量</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-purple)' }}>
              {txStats?.total_realized_pnl != null ? (txStats.total_realized_pnl >= 0 ? '+' : '') + txStats.total_realized_pnl.toFixed(0) : '-'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>已实现盈亏</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--warning)' }}>
              {holdings.length > 0 ? (() => {
                const days = holdings.map(h => getHoldingDays(h));
                return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
              })() : '-'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>平均持仓天数</div>
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={3}>
          <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: holdings.filter(h => h.pnl > 0).length >= holdings.filter(h => h.pnl < 0).length ? 'var(--success)' : 'var(--danger)' }}>
              {holdings.length > 0 ? (holdings.filter(h => h.pnl > 0).length / holdings.length * 100).toFixed(0) + '%' : '-'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>持仓胜率</div>
          </Card>
        </Col>
      </Row>
    </>
  );
}
