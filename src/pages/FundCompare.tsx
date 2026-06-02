import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { fundApi } from '../services/api';

interface Fund {
  code: string;
  name: string;
  type: string;
  company: string;
  index: string;
  industry: string;
  nav: number;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  managementFee: number;
  custodyFee: number;
  serviceFee: number;
  totalFee: number;
  scale: number;
  institutionHold: number;
  individualHold: number;
  rating: number;
  pe: number;
  pb: number;
  pePercentile: number;
  pbPercentile: number;
  valuation: string;
  dailyLimit?: number;
}

export default function FundCompare() {
  const [searchParams] = useSearchParams();
  const initialCodes = searchParams.get('codes')?.split(',') || [];

  const [compareList, setCompareList] = useState<string[]>(initialCodes);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [allFunds, setAllFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [searchResults, setSearchResults] = useState<Fund[]>([]);

  useEffect(() => {
    loadAllFunds();
  }, []);

  useEffect(() => {
    if (compareList.length > 0) {
      loadCompareFunds();
    } else {
      setFunds([]);
    }
  }, [compareList]);

  const loadAllFunds = async () => {
    try {
      const data = await fundApi.getFunds();
      setAllFunds(data);
    } catch (error) {
      console.error('加载基金列表失败:', error);
    }
  };

  const loadCompareFunds = async () => {
    if (compareList.length === 0) return;
    setLoading(true);
    try {
      const data = await fundApi.compareFunds(compareList);
      setFunds(data);
    } catch (error) {
      console.error('加载对比数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchCode(value);
    if (value.trim()) {
      const results = allFunds.filter(f =>
        f.code.includes(value) || f.name.includes(value)
      ).slice(0, 10);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addFund = (code?: string) => {
    const fundCode = code || searchCode.trim();
    if (!fundCode) return;
    if (compareList.includes(fundCode)) {
      alert('该基金已在对比列表中');
      return;
    }
    if (compareList.length >= 5) {
      alert('最多支持5只基金对比');
      return;
    }
    setCompareList([...compareList, fundCode]);
    setSearchCode('');
    setSearchResults([]);
  };

  const removeFund = (code: string) => {
    setCompareList(compareList.filter(c => c !== code));
    setFunds(funds.filter(f => f.code !== code));
  };

  const formatReturn = (value: number) => {
    if (value === undefined || value === null) return '-';
    const colorClass = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={colorClass}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  const getValuationText = (valuation: string) => {
    switch (valuation) {
      case 'very_low': return '极低';
      case 'low': return '偏低';
      case 'reasonable': return '合理';
      case 'high': return '偏高';
      case 'very_high': return '极高';
      default: return '-';
    }
  };

  const getBestValue = (field: keyof Fund, type: 'max' | 'min' = 'max') => {
    if (funds.length === 0) return null;
    const values = funds.map(f => f[field] as number).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return null;
    return type === 'max' ? Math.max(...values) : Math.min(...values);
  };

  const highlightCell = (value: number, field: keyof Fund, type: 'max' | 'min' = 'max') => {
    const best = getBestValue(field, type);
    if (best === null || value === undefined) return {};
    if (value === best) {
      return { background: '#f6ffed', fontWeight: 600 };
    }
    return {};
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>基金对比</h1>

      {/* 添加基金 */}
      <div className="card">
        <h3 className="card-title">添加基金到对比</h3>
        <div style={{ position: 'relative' }}>
          <div className="flex">
            <input
              type="text"
              className="input"
              placeholder="输入基金代码或名称搜索..."
              value={searchCode}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addFund()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={() => addFund()}>
              添加
            </button>
          </div>
          {/* 搜索结果下拉 */}
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'white',
              border: '1px solid #e8e8e8',
              borderRadius: '0 0 8px 8px',
              maxHeight: 300,
              overflowY: 'auto',
              zIndex: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              {searchResults.map((fund) => (
                <div
                  key={fund.code}
                  onClick={() => addFund(fund.code)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#1677ff', marginRight: 8 }}>{fund.code}</span>
                    <span>{fund.name}</span>
                  </div>
                  <span className="tag" style={{ fontSize: 11 }}>{fund.industry}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <span className="text-muted">已添加 {compareList.length}/5 只基金</span>
          {compareList.length > 0 && (
            <div className="flex" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {compareList.map((code) => {
                const fund = allFunds.find(f => f.code === code);
                return (
                <span key={code} className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {fund ? `${fund.name}(${code})` : code}
                  <button
                    onClick={() => removeFund(code)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 对比结果 */}
      {loading ? (
        <div className="text-center" style={{ padding: 40 }}>加载中...</div>
      ) : funds.length === 0 ? (
        <div className="card text-center" style={{ padding: 40, color: '#999' }}>
          <p>请添加基金开始对比</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>支持同时对比最多5只基金</p>
        </div>
      ) : (
        <div className="card">
          <h3 className="card-title">对比结果</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>指标</th>
                  {funds.map((fund) => (
                    <th key={fund.code}>
                      <Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>
                        {fund.name}
                      </Link>
                      <div style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>{fund.code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>最新净值</td>
                  {funds.map((fund) => (
                    <td key={fund.code}>{fund.nav?.toFixed(4)}</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>近1年收益</td>
                  {funds.map((fund) => (
                    <td key={fund.code} style={highlightCell(fund.return1y, 'return1y')}>
                      {formatReturn(fund.return1y)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>近6月收益</td>
                  {funds.map((fund) => (
                    <td key={fund.code} style={highlightCell(fund.return6m, 'return6m')}>
                      {formatReturn(fund.return6m)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>近3月收益</td>
                  {funds.map((fund) => (
                    <td key={fund.code} style={highlightCell(fund.return3m, 'return3m')}>
                      {formatReturn(fund.return3m)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>近1月收益</td>
                  {funds.map((fund) => (
                    <td key={fund.code} style={highlightCell(fund.return1m, 'return1m')}>
                      {formatReturn(fund.return1m)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>综合费率</td>
                  {funds.map((fund) => (
                    <td key={fund.code} style={highlightCell(fund.totalFee, 'totalFee', 'min')}>
                      {fund.totalFee?.toFixed(2)}%/年
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>基金规模</td>
                  {funds.map((fund) => (
                    <td key={fund.code}>{fund.scale?.toFixed(2)} 亿</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>机构持有</td>
                  {funds.map((fund) => (
                    <td key={fund.code}>{fund.institutionHold?.toFixed(2)}%</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>推荐评级</td>
                  {funds.map((fund) => (
                    <td key={fund.code}>
                      <span className="rating">{'★'.repeat(fund.rating)}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>PE历史分位</td>
                  {funds.map((fund) => (
                    <td key={fund.code}>{fund.pePercentile?.toFixed(2)}%</td>
                  ))}
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>估值判断</td>
                  {funds.map((fund) => (
                    <td key={fund.code}>{getValuationText(fund.valuation)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 最优推荐 */}
          {funds.length >= 2 && (
            <div style={{ marginTop: 24, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
              <h4 style={{ color: '#52c41a', marginBottom: 8 }}>对比结论</h4>
              <p>
                {(() => {
                  const bestReturn = funds.reduce((best, f) => f.return1y > best.return1y ? f : best);
                  const bestFee = funds.reduce((best, f) => (f.totalFee || 999) < (best.totalFee || 999) ? f : best);
                  return (
                    <>
                      收益最高：<strong>{bestReturn.name}</strong>（近1年 {bestReturn.return1y?.toFixed(2)}%）
                      {bestReturn.code !== bestFee.code && (
                        <>，费率最低：<strong>{bestFee.name}</strong>（{bestFee.totalFee?.toFixed(2)}%/年）</>
                      )}
                    </>
                  );
                })()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 快捷对比 */}
      <div className="card">
        <h3 className="card-title">热门对比组合</h3>
        <div className="grid grid-3">
          <button
            className="btn btn-outline"
            onClick={() => setCompareList(['013349', '008887', '011102'])}
          >
            AI + 半导体 + 光伏
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setCompareList(['040046', '110020', '012831'])}
          >
            纳斯达克 + 沪深300 + 新能源
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setCompareList(['012634', '000248', '013349'])}
          >
            医药 + 消费 + AI
          </button>
        </div>
      </div>
    </div>
  );
}
