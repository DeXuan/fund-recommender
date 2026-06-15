import { Card, Table, Row, Col, Tag, Alert, Progress, Tooltip, Space } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { PortfolioHolding } from '../../types';

interface Props {
  holdings: PortfolioHolding[];
  isDark: boolean;
  getHoldingDays: (h: PortfolioHolding) => number;
  getFeeTier: (days: number) => { label: string; color: string; icon?: React.ReactNode };
}

export function HoldingsDiagnosis({ holdings, isDark, getHoldingDays, getFeeTier }: Props) {
  if (holdings.length === 0) return null;

  const winners = holdings.filter(h => h.pnl > 0).sort((a, b) => b.pnl - a.pnl);
  const losers = holdings.filter(h => h.pnl < 0).sort((a, b) => a.pnl - b.pnl);
  const totalWinPnl = winners.reduce((s, h) => s + h.pnl, 0);
  const totalLossPnl = losers.reduce((s, h) => s + h.pnl, 0);
  const winRate = holdings.length > 0 ? (winners.length / holdings.length * 100) : 0;
  const topWinner = winners[0];
  const topLoser = losers[0];
  const totalMV = holdings.reduce((s, h) => s + h.market_value, 0);
  const sortedByMV = [...holdings].sort((a, b) => b.market_value - a.market_value);
  const top1Weight = sortedByMV.length > 0 ? sortedByMV[0].market_value / (totalMV || 1) * 100 : 0;
  const top3Weight = sortedByMV.slice(0, 3).reduce((s, h) => s + h.market_value, 0) / (totalMV || 1) * 100;
  const nearFreeFee = holdings.filter(h => { const d = getHoldingDays(h); return d >= 365 && d < 730; });

  let healthScore = 50;
  if (holdings.length >= 5) healthScore += 15;
  else if (holdings.length >= 3) healthScore += 10;
  else if (holdings.length >= 2) healthScore += 5;
  if (top1Weight < 30) healthScore += 15;
  else if (top1Weight < 50) healthScore += 8;
  healthScore += Math.round(winRate * 0.25);
  const plRatio = totalLossPnl !== 0 ? Math.abs(totalWinPnl / totalLossPnl) : 2;
  healthScore += Math.min(20, Math.round(plRatio * 10));
  const longTermCount = holdings.filter(h => getHoldingDays(h) >= 730).length;
  healthScore += Math.round((longTermCount / holdings.length) * 15);
  healthScore = Math.min(100, Math.max(0, healthScore));
  const healthColor = healthScore >= 80 ? '#52c41a' : healthScore >= 60 ? '#faad14' : healthScore >= 40 ? '#fa8c16' : '#ff4d4f';
  const healthLabel = healthScore >= 80 ? '优秀' : healthScore >= 60 ? '良好' : healthScore >= 40 ? '一般' : '需改善';

  return (
    <Card title={<span style={{ fontWeight: 600 }}><SafetyOutlined style={{ marginRight: 8 }} />持仓诊断 & 调整建议</span>} style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ textAlign: 'center', background: isDark ? 'rgba(255,255,255,0.03)' : '#fafafa' }}>
            <Progress type="circle" percent={healthScore} size={100} strokeColor={healthColor}
              format={() => <span style={{ fontSize: 24, fontWeight: 700, color: healthColor }}>{healthScore}</span>} />
            <div style={{ marginTop: 8, fontWeight: 600, color: healthColor }}>组合健康 {healthLabel}</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999', marginTop: 4 }}>综合分散度、胜率、盈亏比、费用</div>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: winRate >= 50 ? '#52c41a' : '#ff4d4f' }}>{winRate.toFixed(0)}%</div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>持仓胜率</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>{winners.length}盈 / {losers.length}亏</div>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>
              {totalLossPnl !== 0 ? Math.abs(totalWinPnl / totalLossPnl).toFixed(2) : '-'}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>盈亏比</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>盈¥{totalWinPnl.toFixed(0)}</div>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: isDark ? '#ff4d4f' : '#cf1322' }}>
              {topWinner ? `+¥${topWinner.pnl.toFixed(0)}` : '-'}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>最大盈利</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>{topWinner?.fund_name?.slice(0, 6) || '-'}</div>
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: isDark ? '#52c41a' : '#3f8600' }}>
              {topLoser ? `-¥${Math.abs(topLoser.pnl).toFixed(0)}` : '-'}
            </div>
            <div style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666' }}>最大亏损</div>
            <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999' }}>{topLoser?.fund_name?.slice(0, 6) || '-'}</div>
          </Card>
        </Col>
      </Row>

      <Card title="逐只基金诊断" size="small" style={{ marginBottom: 16 }}>
        <Table dataSource={holdings.map(h => ({ ...h, key: h.fund_code }))} size="small" pagination={false}
          scroll={{ x: 700 }}
          columns={[
            { title: '基金', dataIndex: 'fund_name', width: 140, ellipsis: true,
              render: (n: string, r: any) => <Link to={`/funds/${r.fund_code}`}>{n}</Link> },
            { title: '收益率', dataIndex: 'pnl_percent', width: 90, sorter: (a: any, b: any) => a.pnl_percent - b.pnl_percent,
              render: (v: number) => <Tag color={v >= 0 ? 'red' : 'green'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</Tag> },
            { title: '盈亏', dataIndex: 'pnl', width: 100, sorter: (a: any, b: any) => a.pnl - b.pnl,
              render: (v: number) => <span style={{ color: v >= 0 ? (isDark ? '#ff4d4f' : '#cf1322') : (isDark ? '#52c41a' : '#3f8600'), fontWeight: 600 }}>{v >= 0 ? '+' : ''}¥{Number(v).toFixed(0)}</span> },
            { title: '持仓占比', key: 'weight', width: 100,
              render: (_: any, r: any) => {
                const w = totalMV > 0 ? (r.market_value / totalMV * 100) : 0;
                return <Progress percent={w} size="small" strokeColor={w > 30 ? '#ff4d4f' : '#1677ff'} format={() => `${w.toFixed(1)}%`} />;
              } },
            { title: '持有天数', key: 'days', width: 90, sorter: (a: any, b: any) => getHoldingDays(a) - getHoldingDays(b),
              render: (_: any, r: any) => {
                const d = getHoldingDays(r);
                const tier = getFeeTier(d);
                return <Tooltip title={tier.label}><span style={{ color: tier.color }}>{d}天</span></Tooltip>;
              } },
            { title: '诊断', key: 'diagnosis', width: 160,
              render: (_: any, r: any) => {
                const tags = [];
                const w = totalMV > 0 ? (r.market_value / totalMV * 100) : 0;
                if (w > 30) tags.push(<Tag key="con" color="warning">占比过高</Tag>);
                if (r.pnl_percent < -15) tags.push(<Tag key="loss" color="error">深度亏损</Tag>);
                else if (r.pnl_percent < -5) tags.push(<Tag key="loss" color="orange">小幅亏损</Tag>);
                if (r.pnl_percent > 20) tags.push(<Tag key="win" color="success">盈利丰厚</Tag>);
                const d = getHoldingDays(r);
                if (d >= 730) tags.push(<Tag key="fee" color="green">免赎回费</Tag>);
                else if (d >= 365) tags.push(<Tag key="fee" color="blue">费率降档中</Tag>);
                if (tags.length === 0) tags.push(<Tag key="ok" color="default">正常</Tag>);
                return <Space size={2} wrap>{tags}</Space>;
              } },
          ]} />
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top1Weight > 40 && (
          <Alert type="warning" showIcon message="单只基金占比过高"
            description={`最大持仓 "${sortedByMV[0]?.fund_name?.slice(0, 8)}" 占比 ${top1Weight.toFixed(1)}%，建议降至30%以下以分散风险。`} />
        )}
        {top3Weight > 70 && (
          <Alert type="warning" showIcon message="持仓集中度过高"
            description={`前3大持仓占比 ${top3Weight.toFixed(1)}%，建议增加不同行业/类型的基金，降低单一行业系统性风险。`} />
        )}
        {losers.length > 0 && topLoser && (
          <Alert type={Math.abs(topLoser.pnl_percent) > 20 ? 'error' : 'warning'} showIcon
            message={`${losers.length} 只基金处于亏损状态`}
            description={
              <span>
                亏损最大：<strong>{topLoser.fund_name?.slice(0, 8)}</strong>（{topLoser.pnl_percent?.toFixed(2)}%，亏损¥{Math.abs(topLoser.pnl).toFixed(0)}）。
                {Math.abs(topLoser.pnl_percent) > 20 && ' 深度亏损建议评估基本面是否变化，若行业逻辑未变可考虑补仓摊低成本，否则及时止损。'}
                {Math.abs(topLoser.pnl_percent) > 10 && Math.abs(topLoser.pnl_percent) <= 20 && ' 中度亏损建议观望，避免恐慌性卖出。'}
                {Math.abs(topLoser.pnl_percent) <= 10 && ' 小幅亏损属正常波动，可继续持有观察。'}
              </span>
            } />
        )}
        {nearFreeFee.length > 0 && (
          <Alert type="info" showIcon message="赎回费即将降档"
            description={
              <span>
                {nearFreeFee.map(h => h.fund_name?.slice(0, 6)).join('、')}
                等 {nearFreeFee.length} 只基金持有已超1年，再持有一段时间可享受更低赎回费率。
              </span>
            } />
        )}
        {winners.length > 0 && topWinner && topWinner.pnl_percent > 30 && (
          <Alert type="success" showIcon message="止盈提醒"
            description={`"${topWinner.fund_name?.slice(0, 6)}" 已盈利 ${topWinner.pnl_percent.toFixed(2)}%，可考虑分批止盈锁定收益，避免回吐利润。`} />
        )}
        {losers.length === 0 && winners.length > 0 && (
          <Alert type="success" showIcon message="持仓全部盈利" description="当前所有持仓均处于盈利状态，可考虑分批止盈锁定收益。" />
        )}
        {holdings.length < 3 && (
          <Alert type="info" showIcon message="持仓过于集中"
            description={`当前仅持有 ${holdings.length} 只基金，建议增加到 3-5 只不同行业/类型的基金以分散风险。`} />
        )}
        {holdings.length === 0 && (
          <Alert type="info" showIcon message="暂无持仓" description="点击上方「添加持仓」开始记录您的投资。" />
        )}
      </div>
    </Card>
  );
}
