import { Card, Row, Col, Alert } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import type { PortfolioHolding } from '../../types';

interface Props {
  holdings: PortfolioHolding[];
  txStats: any;
  isDark: boolean;
  getHoldingDays: (h: PortfolioHolding) => number;
}

export function TransactionBehaviorAnalysis({ holdings, txStats, isDark, getHoldingDays }: Props) {
  if (holdings.length === 0) return null;

  const totalMV = holdings.reduce((s, h) => s + h.market_value, 0);
  const totalUnrealizedPnl = holdings.reduce((s, h) => s + h.pnl, 0);
  const realizedPnl = txStats?.total_realized_pnl || 0;
  const totalFees = txStats?.total_buy_fees || 0;
  const buyCount = txStats?.buy_count || 0;
  const sellCount = txStats?.sell_count || 0;
  const avgHoldDays = holdings.length > 0
    ? Math.round(holdings.map(h => getHoldingDays(h)).reduce((a, b) => a + b, 0) / holdings.length)
    : 0;
  const feeImpact = totalMV > 0 ? (totalFees / totalMV * 100) : 0;

  return (
    <Card title={<span style={{ fontWeight: 600 }}><BarChartOutlined style={{ marginRight: 8 }} />交易行为分析</span>} style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{buyCount + sellCount}</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>总交易笔数</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>买{buyCount} / 卖{sellCount}</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: realizedPnl >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600') }}>
              {realizedPnl >= 0 ? '+' : ''}¥{Number(realizedPnl).toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>已实现盈亏</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>已卖出基金的盈亏</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: totalUnrealizedPnl >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600') }}>
              {totalUnrealizedPnl >= 0 ? '+' : ''}¥{Number(totalUnrealizedPnl).toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>未实现盈亏</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>持有中基金的浮盈浮亏</div>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fa8c16' }}>
              ¥{totalFees.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>累计手续费</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>占总投入 {feeImpact.toFixed(2)}%</div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#722ed1' }}>{avgHoldDays}天</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>平均持仓天数</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>
              {avgHoldDays >= 730 ? '长期持有型' : avgHoldDays >= 365 ? '中期持有型' : '短期交易型'}
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }}>
              {(realizedPnl + totalUnrealizedPnl) >= 0 ? '+' : ''}¥{(realizedPnl + totalUnrealizedPnl).toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>总收益合计</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>已实现 + 未实现</div>
          </Card>
        </Col>
      </Row>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {feeImpact > 1 && (
          <Alert type="warning" showIcon message="手续费占比偏高"
            description={`累计手续费 ¥${totalFees.toFixed(0)} 占总投入 ${feeImpact.toFixed(2)}%，建议减少频繁交易，长期持有可显著降低费用。`} />
        )}
        {avgHoldDays < 90 && holdings.length > 0 && (
          <Alert type="info" showIcon message="持仓周期较短"
            description={`平均持仓仅 ${avgHoldDays} 天，短期交易容易受市场波动影响且手续费较高。基金投资建议至少持有1年以上。`} />
        )}
        {sellCount === 0 && buyCount > 3 && (
          <Alert type="info" showIcon message="尚未卖出任何基金"
            description="您已有多笔买入但从未卖出，建议定期审视持仓，对盈利丰厚的基金适当止盈。" />
        )}
      </div>
    </Card>
  );
}
