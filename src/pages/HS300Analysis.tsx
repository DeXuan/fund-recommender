import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fundApi } from '../services/api';
import type { HS300Analysis as HS300AnalysisType, HS300Fund, HS300Holding } from '../types';

export default function HS300Analysis() {
  const [data, setData] = useState<HS300AnalysisType | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('funds');
  const [sortField, setSortField] = useState<string>('return1y');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [fundFilter, setFundFilter] = useState<'all' | 'etf' | 'link' | 'enhanced'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fundApi.getHS300Analysis();
      setData(result);
    } catch (error) {
      console.error('加载沪深300分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const filteredFunds = useMemo(() => {
    if (!data) return [];
    let funds = [...data.funds];
    if (fundFilter === 'etf') funds = funds.filter(f => f.isETF);
    else if (fundFilter === 'link') funds = funds.filter(f => !f.isETF && !f.isEnhanced);
    else if (fundFilter === 'enhanced') funds = funds.filter(f => f.isEnhanced);

    return funds.sort((a, b) => {
      let valA = 0, valB = 0;
      switch (sortField) {
        case 'return1y': valA = a.return1y; valB = b.return1y; break;
        case 'return6m': valA = a.return6m; valB = b.return6m; break;
        case 'return3m': valA = a.return3m; valB = b.return3m; break;
        case 'return1m': valA = a.return1m; valB = b.return1m; break;
        case 'totalFee': valA = a.totalFee; valB = b.totalFee; break;
        case 'scale': valA = a.scale; valB = b.scale; break;
        default: valA = a.return1y; valB = b.return1y;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [data, sortField, sortOrder, fundFilter]);

  const formatReturn = (value: number) => {
    if (value === undefined || value === null) return '-';
    const cls = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={cls}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  const getValuationColor = (v: string) => {
    if (v.includes('极低') || v.includes('低估')) return '#52c41a';
    if (v.includes('偏低')) return '#73d13d';
    if (v.includes('合理')) return '#1677ff';
    if (v.includes('偏高') || v.includes('高')) return '#ff4d4f';
    return '#666';
  };

  if (loading) {
    return <div className="text-center" style={{ padding: 40 }}>加载中...</div>;
  }

  if (!data) {
    return <div className="text-center" style={{ padding: 40 }}>加载失败</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>📊 沪深300指数基金深度分析</h1>

      {/* 估值概览卡片 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)', color: 'white', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h3 style={{ color: 'white', marginBottom: 8 }}>沪深300指数估值</h3>
            <p style={{ opacity: 0.85, fontSize: 14 }}>{data.recommendation.summary}</p>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.valuation.pe}x</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>PE(TTM)</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.valuation.pb}x</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>PB</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.valuation.pePercentile}%</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>PE历史分位</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{data.valuation.dividendYield}%</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>股息率</div>
            </div>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', overflowX: 'auto' }}>
          {[
            { key: 'funds', label: `基金对比 (${data.funds.length})` },
            { key: 'holdings', label: `权重股分析 (${data.topHoldings.length})` },
            { key: 'strategy', label: '投资策略' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                borderBottom: activeTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                color: activeTab === tab.key ? '#1677ff' : '#666',
                fontWeight: activeTab === tab.key ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 基金对比 */}
      {activeTab === 'funds' && (
        <div>
          {/* 筛选按钮 */}
          <div className="card" style={{ padding: '12px 20px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#666', marginRight: 8 }}>筛选：</span>
              {[
                { key: 'all', label: '全部' },
                { key: 'etf', label: 'ETF' },
                { key: 'link', label: 'ETF联接' },
                { key: 'enhanced', label: '指数增强' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFundFilter(f.key as any)}
                  style={{
                    padding: '4px 12px',
                    border: fundFilter === f.key ? '1px solid #1677ff' : '1px solid #d9d9d9',
                    borderRadius: 4,
                    background: fundFilter === f.key ? '#e6f4ff' : 'white',
                    color: fundFilter === f.key ? '#1677ff' : '#666',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* 首选推荐 */}
          <div className="card" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <h4 style={{ color: '#52c41a', marginBottom: 12 }}>首选推荐</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {data.recommendation.bestPicks.map(pick => (
                <div key={pick.code} style={{ background: 'white', padding: 12, borderRadius: 8 }}>
                  <Link to={`/funds/${pick.code}`} style={{ fontWeight: 600, color: '#1677ff' }}>
                    {pick.name} ({pick.code})
                  </Link>
                  <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{pick.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 基金列表 */}
          <div className="card">
            <h3 className="card-title">沪深300指数基金完整对比</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>基金名称</th>
                    <th>类型</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1y')}>近1年 {getSortIcon('return1y')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return6m')}>近6月 {getSortIcon('return6m')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return3m')}>近3月 {getSortIcon('return3m')}</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1m')}>近1月 {getSortIcon('return1m')}</th>
                    <th>近1周</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalFee')}>综合费率 {getSortIcon('totalFee')}</th>
                    <th>申购费</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('scale')}>规模(亿) {getSortIcon('scale')}</th>
                    <th>超额收益</th>
                    <th>评级</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunds.map(fund => (
                    <tr key={fund.code}>
                      <td><Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>{fund.code}</Link></td>
                      <td style={{ maxWidth: 200 }}>
                        <Link to={`/funds/${fund.code}`} style={{ textDecoration: 'none', color: '#333' }}>
                          {fund.name}
                        </Link>
                        {fund.isEnhanced && <span className="badge badge-warning" style={{ marginLeft: 4, fontSize: 10 }}>增强</span>}
                      </td>
                      <td style={{ fontSize: 12 }}>{fund.type}</td>
                      <td>{formatReturn(fund.return1y)}</td>
                      <td>{formatReturn(fund.return6m)}</td>
                      <td>{formatReturn(fund.return3m)}</td>
                      <td>{formatReturn(fund.return1m)}</td>
                      <td>{formatReturn(fund.return1w)}</td>
                      <td style={{ fontWeight: 600 }}>{fund.totalFee.toFixed(2)}%</td>
                      <td style={{ fontSize: 12 }}>
                        {fund.purchaseFee !== undefined ? (
                          fund.purchaseFee === 0 ? <span style={{ color: '#52c41a' }}>免申购费</span> :
                          <span>{fund.purchaseFee}% <span style={{ color: '#999', textDecoration: 'line-through' }}>{fund.purchaseFeeOriginal}%</span></span>
                        ) : '-'}
                      </td>
                      <td>{fund.scale.toFixed(1)}</td>
                      <td>
                        {fund.isEnhanced && fund.alpha ? (
                          <span className="rise" style={{ fontWeight: 600 }}>+{fund.alpha.toFixed(2)}%</span>
                        ) : <span style={{ color: '#999' }}>-</span>}
                      </td>
                      <td><span className="rating">{'★'.repeat(fund.rating)}</span></td>
                      <td>
                        <Link to={`/funds/${fund.code}`} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }}>
                          详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 权重股分析 */}
      {activeTab === 'holdings' && (
        <div className="card">
          <h3 className="card-title">沪深300前10大权重股财报分析</h3>
          <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
            权重股的基本面决定了指数的走势方向
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>股票</th>
                  <th>代码</th>
                  <th>行业</th>
                  <th>权重%</th>
                  <th>PE</th>
                  <th>ROE%</th>
                  <th>营收增长%</th>
                  <th>EPS增长%</th>
                  <th>分析师共识</th>
                  <th>前景判断</th>
                </tr>
              </thead>
              <tbody>
                {data.topHoldings.map(h => (
                  <tr key={h.code}>
                    <td style={{ fontWeight: 600 }}>{h.name}</td>
                    <td style={{ fontSize: 12, color: '#999' }}>{h.code}</td>
                    <td><span className="tag tag-active">{h.industry}</span></td>
                    <td style={{ fontWeight: 600 }}>{h.weight}%</td>
                    <td>{h.pe}x</td>
                    <td style={{ fontWeight: 600, color: h.roe > 20 ? '#52c41a' : h.roe > 10 ? '#1677ff' : '#faad14' }}>
                      {h.roe}%
                    </td>
                    <td className={h.revenueGrowth > 0 ? 'rise' : 'fall'}>
                      {h.revenueGrowth > 0 ? '+' : ''}{h.revenueGrowth}%
                    </td>
                    <td className={h.epsGrowth > 0 ? 'rise' : 'fall'}>
                      {h.epsGrowth > 0 ? '+' : ''}{h.epsGrowth}%
                    </td>
                    <td>
                      <span className={`badge ${h.analystConsensus === '强烈买入' ? 'badge-success' : 'badge-warning'}`}>
                        {h.analystConsensus}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 200 }}>{h.outlook}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 权重股小结 */}
          <div style={{ marginTop: 20, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            <h4 style={{ marginBottom: 8 }}>权重股基本面小结</h4>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <p><strong>强势股：</strong>宁德时代(EPS+30%)、比亚迪(EPS+43%)、紫金矿业(EPS+36%)、中芯国际(EPS+45%) — 新能源/半导体/资源品景气度高</p>
              <p><strong>稳健股：</strong>贵州茅台(EPS+17%)、美的集团(EPS+15%)、恒瑞医药(EPS+22%) — 消费/医药龙头业绩稳健</p>
              <p><strong>低估股：</strong>中国平安(PE 9.8x)、招商银行(PE 6.5x) — 金融股估值极低，高股息防守</p>
            </div>
          </div>
        </div>
      )}

      {/* 投资策略 */}
      {activeTab === 'strategy' && (
        <div>
          {/* 策略建议 */}
          <div className="card">
            <h3 className="card-title">投资策略建议</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                <h4 style={{ color: '#52c41a', marginBottom: 8 }}>短期（3个月）</h4>
                <p style={{ fontSize: 13 }}>{data.recommendation.strategy.shortTerm}</p>
              </div>
              <div style={{ padding: 16, background: '#e6f4ff', borderRadius: 8, border: '1px solid #91caff' }}>
                <h4 style={{ color: '#1677ff', marginBottom: 8 }}>中期（6个月）</h4>
                <p style={{ fontSize: 13 }}>{data.recommendation.strategy.mediumTerm}</p>
              </div>
              <div style={{ padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
                <h4 style={{ color: '#fa8c16', marginBottom: 8 }}>长期（1年）</h4>
                <p style={{ fontSize: 13 }}>{data.recommendation.strategy.longTerm}</p>
              </div>
            </div>
          </div>

          {/* 看多因素 */}
          <div className="card">
            <h3 className="card-title">看多因素</h3>
            <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
              {data.recommendation.bullFactors.map((f, i) => (
                <li key={i} style={{ color: '#52c41a' }}>{f}</li>
              ))}
            </ul>
          </div>

          {/* 看空因素 */}
          <div className="card">
            <h3 className="card-title">风险因素</h3>
            <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 2 }}>
              {data.recommendation.bearFactors.map((f, i) => (
                <li key={i} style={{ color: '#ff4d4f' }}>{f}</li>
              ))}
            </ul>
          </div>

          {/* 分批建仓方案 */}
          <div className="card">
            <h3 className="card-title">分批建仓方案</h3>
            <div style={{ position: 'relative', paddingLeft: 30 }}>
              <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: '#e8e8e8' }}></div>
              {[
                { batch: 1, time: '本周', pct: 30, action: '首批建仓30%，优选增强型基金', reason: '当前估值偏低，先建底仓' },
                { batch: 2, time: '2-3周后', pct: 30, action: '第二批30%，搭配低费率联接基金', reason: '观察市场走势，逢低加仓' },
                { batch: 3, time: '1个月后', pct: 25, action: '第三批25%，定投方式', reason: '持续摊薄成本' },
                { batch: 4, time: '2个月后', pct: 15, action: '最后15%，机动资金', reason: '预留资金应对意外下跌' },
              ].map((plan, idx) => (
                <div key={idx} style={{ marginBottom: 24, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -22, top: 4, width: 12, height: 12,
                    borderRadius: '50%', background: '#1677ff', border: '2px solid white',
                    boxShadow: '0 0 0 2px #1677ff',
                  }}></div>
                  <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e8e8e8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h4>第 {plan.batch} 批</h4>
                      <span className="badge badge-success">{plan.pct}%</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}><strong>时间：</strong>{plan.time}</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}><strong>操作：</strong>{plan.action}</div>
                    <div style={{ fontSize: 13, color: '#666' }}><strong>理由：</strong>{plan.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 估值分位说明 */}
          <div className="card">
            <h3 className="card-title">估值分位投资指南</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>PE分位区间</th>
                    <th>估值判断</th>
                    <th>操作建议</th>
                    <th>仓位建议</th>
                  </tr>
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
                      <td style={{ color: getValuationColor(row.val) }}>{row.val}</td>
                      <td>{row.action}</td>
                      <td style={{ fontWeight: 600 }}>{row.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12, fontSize: 13, color: '#666' }}>
              当前沪深300 PE分位约 <strong style={{ color: '#1677ff' }}>{data.valuation.pePercentile}%</strong>，
              处于<strong style={{ color: '#1677ff' }}>{data.valuation.valuation}</strong>区间，
              {data.valuation.suggestion}。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
