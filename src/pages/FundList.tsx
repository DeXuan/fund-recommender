import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fundApi } from '../services/api';

interface Fund {
  code: string;
  name: string;
  type: string;
  nav: number;
  return1y: number;
  return6m: number;
  return3m: number;
  return1m: number;
  return1w: number;
  scale: number;
  industry: string;
  isGoldSelected?: boolean;
}

export default function FundList() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('全部');
  const [sortField, setSortField] = useState('return1m');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [industries, setIndustries] = useState<string[]>([]);

  useEffect(() => {
    loadIndustries();
    loadFunds();
  }, []);

  useEffect(() => {
    loadFunds();
  }, [industry, sortField, sortOrder, search]);

  const loadIndustries = async () => {
    try {
      const data = await fundApi.getIndustries();
      setIndustries(['全部', ...data]);
    } catch (error) {
      console.error('加载行业列表失败:', error);
    }
  };

  const loadFunds = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getFunds({
        industry: industry !== '全部' ? industry : undefined,
        sort: sortField,
        order: sortOrder,
        search: search || undefined,
      });
      setFunds(data);
    } catch (error) {
      console.error('加载基金列表失败:', error);
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

  const formatReturn = (value: number) => {
    if (value === undefined || value === null) return '-';
    const colorClass = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={colorClass}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>基金列表</h1>

      {/* 搜索和筛选 */}
      <div className="card">
        <div className="flex" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              className="input"
              placeholder="搜索基金名称或代码..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 150 }}>
            <select
              className="select"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 基金列表 */}
      <div className="card">
        {loading ? (
          <div className="text-center" style={{ padding: 40 }}>加载中...</div>
        ) : funds.length === 0 ? (
          <div className="text-center" style={{ padding: 40, color: '#999' }}>
            没有找到匹配的基金
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>基金代码</th>
                  <th>基金名称</th>
                  <th>行业</th>
                  <th>最新净值</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1y')}>
                    近1年 {getSortIcon('return1y')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return6m')}>
                    近6月 {getSortIcon('return6m')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return3m')}>
                    近3月 {getSortIcon('return3m')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1m')}>
                    近1月 {getSortIcon('return1m')}
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('scale')}>
                    规模(亿) {getSortIcon('scale')}
                  </th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {funds.map((fund) => (
                  <tr key={fund.code}>
                    <td>
                      <Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>
                        {fund.code}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/funds/${fund.code}`} style={{ textDecoration: 'none', color: '#333' }}>
                        {fund.name}
                      </Link>
                      {fund.isGoldSelected && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 20,
                          height: 20,
                          marginLeft: 6,
                          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                          borderRadius: '50%',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#fff',
                          verticalAlign: 'middle',
                          boxShadow: '0 1px 2px rgba(255,165,0,0.3)',
                        }}>
                          金
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="tag">{fund.industry}</span>
                    </td>
                    <td>{fund.nav?.toFixed(4) || '-'}</td>
                    <td>{formatReturn(fund.return1y)}</td>
                    <td>{formatReturn(fund.return6m)}</td>
                    <td>{formatReturn(fund.return3m)}</td>
                    <td>{formatReturn(fund.return1m)}</td>
                    <td>{fund.scale?.toFixed(2) || '-'}</td>
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
        )}
      </div>

      {/* 统计信息 */}
      <div className="card">
        <div className="flex-between">
          <span className="text-muted">共 {funds.length} 只基金</span>
          <span className="text-muted">
            数据来源：东方财富
          </span>
        </div>
      </div>
    </div>
  );
}
