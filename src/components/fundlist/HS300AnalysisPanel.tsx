import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Spin, Alert, Button } from 'antd';
import { fundApi } from '../../services/api';
import type { HS300Analysis } from '../../types';

interface HS300AnalysisPanelProps {
  visible: boolean;
  isDark: boolean;
}

export function HS300AnalysisPanel({ visible, isDark }: HS300AnalysisPanelProps) {
  const [hs300Data, setHs300Data] = useState<HS300Analysis | null>(null);
  const [hs300Loading, setHs300Loading] = useState(false);
  const [hs300Tab, setHs300Tab] = useState('funds');
  const [hs300SortField, setHs300SortField] = useState<string>('return1y');
  const [hs300SortOrder, setHs300SortOrder] = useState<'asc' | 'desc'>('desc');
  const [hs300FundFilter, setHs300FundFilter] = useState<'all' | 'etf' | 'link' | 'enhanced'>('all');

  const loadHS300 = async () => {
    setHs300Loading(true);
    try {
      const result = await fundApi.getHS300Analysis();
      setHs300Data(result);
    } catch (error) {
      console.error('加载沪深300分析数据失败:', error);
    } finally {
      setHs300Loading(false);
    }
  };

  useEffect(() => {
    if (visible && !hs300Data && !hs300Loading) {
      loadHS300();
    }
  }, [visible]);

  const hs300SortIcon = (field: string) => {
    if (hs300SortField !== field) return '↕';
    return hs300SortOrder === 'asc' ? '↑' : '↓';
  };

  const hs300HandleSort = (field: string) => {
    if (hs300SortField === field) {
      setHs300SortOrder(hs300SortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setHs300SortField(field);
      setHs300SortOrder('desc');
    }
  };

  const hs300FilteredFunds = useMemo(() => {
    if (!hs300Data) return [];
    let funds = [...hs300Data.funds];
    if (hs300FundFilter === 'etf') funds = funds.filter(f => f.isETF);
    else if (hs300FundFilter === 'link') funds = funds.filter(f => !f.isETF && !f.isEnhanced);
    else if (hs300FundFilter === 'enhanced') funds = funds.filter(f => f.isEnhanced);
    return funds.sort((a, b) => {
      let valA = 0, valB = 0;
      switch (hs300SortField) {
        case 'return1y': valA = a.return1y ?? 0; valB = b.return1y ?? 0; break;
        case 'return6m': valA = a.return6m ?? 0; valB = b.return6m ?? 0; break;
        case 'return3m': valA = a.return3m ?? 0; valB = b.return3m ?? 0; break;
        case 'return1m': valA = a.return1m ?? 0; valB = b.return1m ?? 0; break;
        case 'totalFee': valA = a.totalFee ?? 0; valB = b.totalFee ?? 0; break;
        case 'scale': valA = a.scale ?? 0; valB = b.scale ?? 0; break;
        default: valA = a.return1y ?? 0; valB = b.return1y ?? 0;
      }
      return hs300SortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [hs300Data, hs300SortField, hs300SortOrder, hs300FundFilter]);

  const hs300GetValuationColor = (v: string) => {
    if (v.includes('极低') || v.includes('低估')) return 'var(--success)';
    if (v.includes('偏低')) return '#73d13d';
    if (v.includes('合理')) return 'var(--primary)';
    if (v.includes('偏高') || v.includes('高')) return 'var(--danger)';
    return isDark ? '#a0a0a0' : '#666';
  };

  if (!visible) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      {hs300Loading ? (
        <Card style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" tip="加载沪深300分析数据..." />
        </Card>
      ) : !hs300Data ? (
        <Card>
          <Alert type="error" message="加载失败" description="沪深300分析数据加载失败，请稍后重试" showIcon style={{ marginBottom: 16 }} />
          <div style={{ textAlign: 'center' }}>
            <Button type="primary" onClick={loadHS300}>重新加载</Button>
          </div>
        </Card>
      ) : (
        <>
          {/* 估值概览 */}
          <Card style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)', border: 'none', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <h3 style={{ color: 'var(--color-text-on-dark)', marginBottom: 8 }}>沪深300指数估值</h3>
                <p style={{ opacity: 0.85, fontSize: 14, color: 'var(--color-text-on-dark)' }}>{hs300Data.recommendation.summary}</p>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'PE(TTM)', value: `${hs300Data.valuation.pe ?? '--'}x` },
                  { label: 'PB', value: `${hs300Data.valuation.pb ?? '--'}x` },
                  { label: 'PE历史分位', value: `${hs300Data.valuation.pePercentile ?? '--'}%` },
                  { label: '股息率', value: `${hs300Data.valuation.dividendYield ?? '--'}%` },
                ].map(item => (
                  <div key={item.label} style={{ background: 'rgba(255,255,255,0.15)', padding: '10px 16px', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-on-dark)' }}>{item.value}</div>
                    <div style={{ fontSize: 11, opacity: 0.8, color: 'var(--color-text-on-dark)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 标签页 */}
          <Card style={{ padding: 0, marginBottom: 16 }}>
            <div style={{ display: 'flex', borderBottom: isDark ? '1px solid #333' : '1px solid #e8e8e8', overflowX: 'auto' }}>
              {[
                { key: 'funds', label: `基金对比 (${hs300Data.funds.length})` },
                { key: 'holdings', label: `权重股分析 (${hs300Data.topHoldings.length})` },
                { key: 'strategy', label: '投资策略' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setHs300Tab(tab.key)}
                  style={{
                    padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                    borderBottom: hs300Tab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                    color: hs300Tab === tab.key ? 'var(--primary)' : (isDark ? '#a0a0a0' : '#666'),
                    fontWeight: hs300Tab === tab.key ? 600 : 400, whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </Card>

          {/* 基金对比 */}
          {hs300Tab === 'funds' && (
            <>
              <Card style={{ padding: '12px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginRight: 8 }}>筛选：</span>
                  {[
                    { key: 'all', label: '全部' },
                    { key: 'etf', label: 'ETF' },
                    { key: 'link', label: 'ETF联接' },
                    { key: 'enhanced', label: '指数增强' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setHs300FundFilter(f.key as any)}
                      style={{
                        padding: '4px 12px',
                        border: hs300FundFilter === f.key ? '1px solid var(--primary)' : (isDark ? '1px solid #444' : '1px solid #d9d9d9'),
                        borderRadius: 4,
                        background: hs300FundFilter === f.key ? (isDark ? '#111a2c' : '#e6f4ff') : (isDark ? '#1a1a1a' : 'white'),
                        color: hs300FundFilter === f.key ? 'var(--primary)' : (isDark ? '#a0a0a0' : '#666'),
                        cursor: 'pointer', fontSize: 13,
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card style={{ background: isDark ? '#162312' : '#f6ffed', border: '1px solid #b7eb8f', marginBottom: 16 }}>
                <h4 style={{ color: 'var(--success)', marginBottom: 12 }}>首选推荐</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {hs300Data.recommendation.bestPicks.map(pick => (
                    <div key={pick.code} style={{ background: isDark ? '#1a1a1a' : 'white', padding: 12, borderRadius: 8 }}>
                      <Link to={`/funds/${pick.code}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>{pick.name} ({pick.code})</Link>
                      <p style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', marginTop: 4 }}>{pick.reason}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="card-title">沪深300指数基金完整对比</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>代码</th>
                        <th>基金名称</th>
                        <th>类型</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => hs300HandleSort('return1y')}>近1年 {hs300SortIcon('return1y')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => hs300HandleSort('return6m')}>近6月 {hs300SortIcon('return6m')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => hs300HandleSort('return3m')}>近3月 {hs300SortIcon('return3m')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => hs300HandleSort('return1m')}>近1月 {hs300SortIcon('return1m')}</th>
                        <th>近1周</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => hs300HandleSort('totalFee')}>综合费率 {hs300SortIcon('totalFee')}</th>
                        <th>申购费</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => hs300HandleSort('scale')}>规模(亿) {hs300SortIcon('scale')}</th>
                        <th>超额收益</th>
                        <th>评级</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hs300FilteredFunds.map(fund => (
                        <tr key={fund.code}>
                          <td><Link to={`/funds/${fund.code}`} style={{ color: 'var(--primary)' }}>{fund.code}</Link></td>
                          <td style={{ maxWidth: 200 }}>
                            <Link to={`/funds/${fund.code}`} style={{ textDecoration: 'none', color: 'var(--primary)' }}>{fund.name}</Link>
                            {fund.isEnhanced && <span className="badge badge-warning" style={{ marginLeft: 4, fontSize: 10 }}>增强</span>}
                          </td>
                          <td style={{ fontSize: 12 }}>{fund.type}</td>
                          <td><span className={(fund.return1y ?? 0) > 0 ? 'rise' : (fund.return1y ?? 0) < 0 ? 'fall' : ''}>{(fund.return1y ?? 0) >= 0 ? '+' : ''}{(fund.return1y ?? 0).toFixed(2)}%</span></td>
                          <td><span className={(fund.return6m ?? 0) > 0 ? 'rise' : (fund.return6m ?? 0) < 0 ? 'fall' : ''}>{(fund.return6m ?? 0) >= 0 ? '+' : ''}{(fund.return6m ?? 0).toFixed(2)}%</span></td>
                          <td><span className={(fund.return3m ?? 0) > 0 ? 'rise' : (fund.return3m ?? 0) < 0 ? 'fall' : ''}>{(fund.return3m ?? 0) >= 0 ? '+' : ''}{(fund.return3m ?? 0).toFixed(2)}%</span></td>
                          <td><span className={(fund.return1m ?? 0) > 0 ? 'rise' : (fund.return1m ?? 0) < 0 ? 'fall' : ''}>{(fund.return1m ?? 0) >= 0 ? '+' : ''}{(fund.return1m ?? 0).toFixed(2)}%</span></td>
                          <td><span className={(fund.return1w ?? 0) > 0 ? 'rise' : (fund.return1w ?? 0) < 0 ? 'fall' : ''}>{(fund.return1w ?? 0) >= 0 ? '+' : ''}{(fund.return1w ?? 0).toFixed(2)}%</span></td>
                          <td style={{ fontWeight: 600 }}>{(fund.totalFee ?? 0).toFixed(2)}%</td>
                          <td style={{ fontSize: 12 }}>
                            {fund.purchaseFee !== undefined ? (
                              fund.purchaseFee === 0 ? <span style={{ color: 'var(--success)' }}>免申购费</span> :
                              <span>{fund.purchaseFee}% <span style={{ color: isDark ? '#6b6b6b' : '#999', textDecoration: 'line-through' }}>{fund.purchaseFeeOriginal}%</span></span>
                            ) : '-'}
                          </td>
                          <td>{(fund.scale ?? 0).toFixed(1)}</td>
                          <td>
                            {fund.isEnhanced && fund.alpha ? (
                              <span className="rise" style={{ fontWeight: 600 }}>+{Number(fund.alpha).toFixed(2)}%</span>
                            ) : <span style={{ color: isDark ? '#6b6b6b' : '#999' }}>-</span>}
                          </td>
                          <td><span className="rating">{'★'.repeat(fund.rating)}</span></td>
                          <td><Link to={`/funds/${fund.code}`} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }}>详情</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {/* 权重股分析 */}
          {hs300Tab === 'holdings' && (
            <Card>
              <h3 className="card-title">沪深300前10大权重股财报分析</h3>
              <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>权重股的基本面决定了指数的走势方向</p>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>股票</th><th>代码</th><th>行业</th><th>权重%</th><th>PE</th><th>ROE%</th><th>营收增长%</th><th>EPS增长%</th><th>分析师共识</th><th>前景判断</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hs300Data.topHoldings.map(h => (
                      <tr key={h.code}>
                        <td style={{ fontWeight: 600 }}>{h.name}</td>
                        <td style={{ fontSize: 12, color: isDark ? '#6b6b6b' : '#999' }}>{h.code}</td>
                        <td style={{ fontSize: 12 }}>{h.industry}</td>
                        <td style={{ fontWeight: 600 }}>{h.weight}%</td>
                        <td>{h.pe ?? '--'}x</td>
                        <td style={{ fontWeight: 600, color: (h.roe ?? 0) > 20 ? 'var(--success)' : (h.roe ?? 0) > 10 ? 'var(--primary)' : 'var(--warning)' }}>{h.roe ?? '--'}%</td>
                        <td className={(h.revenueGrowth ?? 0) > 0 ? 'rise' : 'fall'}>{(h.revenueGrowth ?? 0) > 0 ? '+' : ''}{h.revenueGrowth ?? 0}%</td>
                        <td className={(h.epsGrowth ?? 0) > 0 ? 'rise' : 'fall'}>{(h.epsGrowth ?? 0) > 0 ? '+' : ''}{h.epsGrowth ?? 0}%</td>
                        <td><span className={`badge ${h.analystConsensus === '强烈买入' ? 'badge-success' : 'badge-warning'}`}>{h.analystConsensus}</span></td>
                        <td style={{ fontSize: 12, maxWidth: 200 }}>{h.outlook}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 20, padding: 16, background: isDark ? '#1f1f1f' : '#f5f5f5', borderRadius: 8 }}>
                <h4 style={{ marginBottom: 8 }}>权重股基本面小结</h4>
                <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                  <p><strong>强势股：</strong>宁德时代(EPS+30%)、比亚迪(EPS+43%)、紫金矿业(EPS+36%)、中芯国际(EPS+45%) — 新能源/半导体/资源品景气度高</p>
                  <p><strong>稳健股：</strong>贵州茅台(EPS+17%)、美的集团(EPS+15%)、恒瑞医药(EPS+22%) — 消费/医药龙头业绩稳健</p>
                  <p><strong>低估股：</strong>中国平安(PE 9.8x)、招商银行(PE 6.5x) — 金融股估值极低，高股息防守</p>
                </div>
              </div>
            </Card>
          )}

          {/* 投资策略 */}
          {hs300Tab === 'strategy' && (
            <>
              <Card style={{ marginBottom: 16 }}>
                <h3 className="card-title">投资策略建议</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                  <div style={{ padding: 16, background: isDark ? '#162312' : '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                    <h4 style={{ color: 'var(--success)', marginBottom: 8 }}>短期（3个月）</h4>
                    <p style={{ fontSize: 13 }}>{hs300Data.recommendation.strategy.shortTerm}</p>
                  </div>
                  <div style={{ padding: 16, background: isDark ? '#111a2c' : '#e6f4ff', borderRadius: 8, border: '1px solid #91caff' }}>
                    <h4 style={{ color: 'var(--primary)', marginBottom: 8 }}>中期（6个月）</h4>
                    <p style={{ fontSize: 13 }}>{hs300Data.recommendation.strategy.mediumTerm}</p>
                  </div>
                  <div style={{ padding: 16, background: isDark ? '#2b2111' : '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
                    <h4 style={{ color: 'var(--warning)', marginBottom: 8 }}>长期（1年）</h4>
                    <p style={{ fontSize: 13 }}>{hs300Data.recommendation.strategy.longTerm}</p>
                  </div>
                </div>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <h3 className="card-title">看多因素</h3>
                <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
                  {hs300Data.recommendation.bullFactors.map((f, i) => <li key={i} style={{ color: 'var(--success)' }}>{f}</li>)}
                </ul>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <h3 className="card-title">风险因素</h3>
                <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
                  {hs300Data.recommendation.bearFactors.map((f, i) => <li key={i} style={{ color: 'var(--danger)' }}>{f}</li>)}
                </ul>
              </Card>

              <Card style={{ marginBottom: 16 }}>
                <h3 className="card-title">分批建仓方案</h3>
                <div style={{ position: 'relative', paddingLeft: 30 }}>
                  <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: isDark ? '#333' : '#e8e8e8' }}></div>
                  {[
                    { batch: 1, time: '本周', pct: 20, action: '首批建仓20%，优选低费率ETF联接基金', reason: 'PE分位87.8%偏高，先建小仓位试探' },
                    { batch: 2, time: '2-3周后', pct: 25, action: '第二批25%，定投方式买入增强型基金', reason: '观察回调幅度，逢低加仓' },
                    { batch: 3, time: '1个月后', pct: 30, action: '第三批30%，搭配增强型+低费率联接', reason: '若回调到位加大仓位' },
                    { batch: 4, time: '2-3个月后', pct: 25, action: '最后25%，机动资金', reason: '预留资金应对持续下跌或追加定投' },
                  ].map((plan, idx) => (
                    <div key={idx} style={{ marginBottom: 24, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: -22, top: 4, width: 12, height: 12, borderRadius: '50%', background: 'var(--primary)', border: `2px solid ${isDark ? '#1a1a1a' : 'var(--color-text-on-dark)'}`, boxShadow: '0 0 0 2px var(--primary)' }}></div>
                      <div style={{ background: isDark ? '#1a1a1a' : 'white', padding: 16, borderRadius: 8, border: isDark ? '1px solid #333' : '1px solid #e8e8e8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <h4>第 {plan.batch} 批</h4>
                          <span className="badge badge-success">{plan.pct}%</span>
                        </div>
                        <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginBottom: 4 }}><strong>时间：</strong>{plan.time}</div>
                        <div style={{ fontSize: 13, marginBottom: 4 }}><strong>操作：</strong>{plan.action}</div>
                        <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}><strong>理由：</strong>{plan.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="card-title">估值分位投资指南</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr><th>PE分位区间</th><th>估值判断</th><th>操作建议</th><th>仓位建议</th></tr>
                    </thead>
                    <tbody>
                      {[
                        { range: '0-20%', val: '极度低估', action: '重仓买入', pos: '80-100%' },
                        { range: '20-40%', val: '偏低估', action: '定投加仓', pos: '60-80%' },
                        { range: '40-60%', val: '合理区间', action: '正常定投', pos: '40-60%' },
                        { range: '60-80%', val: '偏高估', action: '小额定投', pos: '20-40%' },
                        { range: '80-100%', val: '极度高估', action: '观望/减仓', pos: '0-20%' },
                      ].map(row => (
                        <tr key={row.range}>
                          <td style={{ fontWeight: 600 }}>{row.range}</td>
                          <td style={{ color: hs300GetValuationColor(row.val) }}>{row.val}</td>
                          <td>{row.action}</td>
                          <td style={{ fontWeight: 600 }}>{row.pos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ marginTop: 12, fontSize: 13, color: isDark ? '#a0a0a0' : '#666' }}>
                  当前沪深300 PE分位约 <strong style={{ color: 'var(--danger)' }}>{hs300Data.valuation.pePercentile ?? '--'}%</strong>，
                  处于<strong style={{ color: 'var(--danger)' }}>{hs300Data.valuation.valuation ?? '--'}</strong>区间，
                  {hs300Data.valuation.suggestion ?? ''}。
                </p>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
