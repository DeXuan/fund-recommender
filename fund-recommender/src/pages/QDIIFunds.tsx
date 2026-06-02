import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fundApi } from '../services/api';

interface Fund {
  code: string;
  name: string;
  type: string;
  industry: string;
  index: string;
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
  rating: number;
  buySuggestion: string;
  valuation: string;
  trend: string;
  logic: string;
  dailyLimit?: number;
}

export default function QDIIFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('nasdaq100');
  const [sortField, setSortField] = useState<string>('return1y');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadQDIIFunds();
  }, []);

  const loadQDIIFunds = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getFunds();
      const qdiiFunds = data.filter((f: Fund) =>
        f.industry === '纳斯达克100' ||
        f.industry === '标普500' ||
        f.type === 'QDII'
      );
      setFunds(qdiiFunds);
    } catch (error) {
      console.error('加载QDII基金失败:', error);
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

  const sortFunds = (fundList: Fund[]) => {
    return [...fundList].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      switch (sortField) {
        case 'return1y': valA = a.return1y || 0; valB = b.return1y || 0; break;
        case 'return3m': valA = a.return3m || 0; valB = b.return3m || 0; break;
        case 'return1m': valA = a.return1m || 0; valB = b.return1m || 0; break;
        case 'managementFee': valA = a.managementFee || 0; valB = b.managementFee || 0; break;
        case 'totalFee': valA = a.totalFee || 0; valB = b.totalFee || 0; break;
        case 'scale': valA = a.scale || 0; valB = b.scale || 0; break;
        case 'dailyLimit': valA = a.dailyLimit || 0; valB = b.dailyLimit || 0; break;
        default: valA = a.return1y || 0; valB = b.return1y || 0;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  };

  const formatReturn = (value: number) => {
    if (value === undefined || value === null) return '-';
    const colorClass = value > 0 ? 'rise' : value < 0 ? 'fall' : '';
    return <span className={colorClass}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>;
  };

  const nasdaqFunds = useMemo(() => sortFunds(funds.filter(f => f.industry === '纳斯达克100')), [funds, sortField, sortOrder]);
  const sp500Funds = useMemo(() => sortFunds(funds.filter(f => f.industry === '标普500')), [funds, sortField, sortOrder]);
  const allSortedFunds = useMemo(() => sortFunds(funds), [funds, sortField, sortOrder]);

  if (loading) {
    return <div className="text-center" style={{ padding: 40 }}>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>🌍 QDII基金专栏</h1>

      {/* 介绍卡片 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <h3 style={{ color: 'white', marginBottom: 12 }}>什么是QDII基金？</h3>
        <p style={{ opacity: 0.9, lineHeight: 1.8 }}>
          QDII（Qualified Domestic Institutional Investor）基金是指在一国境内设立，
          经该国有关部门批准从事境外证券市场的股票、债券等有价证券业务的证券投资基金。
          简单来说，就是用人民币买海外市场的基金。
        </p>
        <div className="grid grid-3" style={{ marginTop: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 8 }}>
            <h4 style={{ color: 'white', marginBottom: 4 }}>分散风险</h4>
            <p style={{ fontSize: 12, opacity: 0.8 }}>投资海外市场，降低单一市场风险</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 8 }}>
            <h4 style={{ color: 'white', marginBottom: 4 }}>全球配置</h4>
            <p style={{ fontSize: 12, opacity: 0.8 }}>分享全球科技成长红利</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 8 }}>
            <h4 style={{ color: 'white', marginBottom: 4 }}>人民币购买</h4>
            <p style={{ fontSize: 12, opacity: 0.8 }}>无需换汇，直接人民币申购</p>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8' }}>
          {[
            { key: 'nasdaq100', label: `纳斯达克100 (${nasdaqFunds.length})` },
            { key: 'sp500', label: `标普500 (${sp500Funds.length})` },
            { key: 'all', label: `全部QDII (${funds.length})` },
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
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 纳斯达克100 */}
      {activeTab === 'nasdaq100' && (
        <div>
          <div className="card">
            <h3 className="card-title">纳斯达克100指数基金</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              纳斯达克100指数包含纳斯达克上市的100家最大非金融公司，以科技股为主，
              包括苹果、微软、英伟达、亚马逊、Meta等全球科技龙头。
            </p>

            {/* 推荐基金 */}
            <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f', marginBottom: 20 }}>
              <h4 style={{ color: '#52c41a', marginBottom: 8 }}>首选推荐</h4>
              <div className="grid grid-2">
                <div>
                  <p><strong>华安纳斯达克100ETF联接A (040046)</strong></p>
                  <p style={{ fontSize: 13, color: '#666' }}>费率适中0.6%，规模大47亿，跟踪误差小</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+33.42%</span></p>
                </div>
                <div>
                  <p><strong>天弘纳斯达克100指数A (018043)</strong></p>
                  <p style={{ fontSize: 13, color: '#666' }}>费率最低0.5%，规模22亿</p>
                  <p style={{ fontSize: 13 }}>近1年收益：<span className="rise">+32.11%</span></p>
                </div>
              </div>
            </div>

            {/* 基金列表 */}
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>基金代码</th>
                    <th>基金名称</th>
                    <th>A/C类</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1y')}>
                      近1年 {getSortIcon('return1y')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return3m')}>
                      近3月 {getSortIcon('return3m')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1m')}>
                      近1月 {getSortIcon('return1m')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('managementFee')}>
                      管理费 {getSortIcon('managementFee')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalFee')}>
                      综合费率 {getSortIcon('totalFee')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('scale')}>
                      规模(亿) {getSortIcon('scale')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dailyLimit')}>
                      每日限额 {getSortIcon('dailyLimit')}
                    </th>
                    <th>申购状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {nasdaqFunds.map((fund) => (
                    <tr key={fund.code}>
                      <td>
                        <Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>
                          {fund.code}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <Link to={`/funds/${fund.code}`} style={{ textDecoration: 'none', color: '#333' }}>
                          {fund.name}
                        </Link>
                      </td>
                      <td>{fund.name.includes('C') ? 'C' : 'A'}</td>
                      <td>{formatReturn(fund.return1y)}</td>
                      <td>{formatReturn(fund.return3m)}</td>
                      <td>{formatReturn(fund.return1m)}</td>
                      <td>{fund.managementFee?.toFixed(2)}%</td>
                      <td style={{ fontWeight: 600 }}>{fund.totalFee?.toFixed(2)}%</td>
                      <td>{fund.scale?.toFixed(1)}</td>
                      <td style={{ fontWeight: 600, color: fund.dailyLimit === 0 ? '#999' : fund.dailyLimit! <= 10 ? '#ff4d4f' : '#faad14' }}>
                        {fund.dailyLimit === 0 ? '暂停' : `${fund.dailyLimit}元`}
                      </td>
                      <td>
                        <span className={`badge ${fund.buySuggestion === '暂停申购' ? 'badge-danger' : fund.buySuggestion === '限大额' ? 'badge-warning' : 'badge-success'}`}>
                          {fund.buySuggestion}
                        </span>
                      </td>
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

      {/* 标普500 */}
      {activeTab === 'sp500' && (
        <div>
          <div className="card">
            <h3 className="card-title">标普500指数基金</h3>
            <p className="text-muted" style={{ marginBottom: 16 }}>
              标普500指数包含美国500家大型上市公司，覆盖科技、金融、医疗、消费等多个行业，
              是衡量美国股市整体表现的重要指标。
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>基金代码</th>
                    <th>基金名称</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1y')}>
                      近1年 {getSortIcon('return1y')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return3m')}>
                      近3月 {getSortIcon('return3m')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1m')}>
                      近1月 {getSortIcon('return1m')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('managementFee')}>
                      管理费 {getSortIcon('managementFee')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalFee')}>
                      综合费率 {getSortIcon('totalFee')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('scale')}>
                      规模(亿) {getSortIcon('scale')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dailyLimit')}>
                      每日限额 {getSortIcon('dailyLimit')}
                    </th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sp500Funds.map((fund) => (
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
                      </td>
                      <td>{formatReturn(fund.return1y)}</td>
                      <td>{formatReturn(fund.return3m)}</td>
                      <td>{formatReturn(fund.return1m)}</td>
                      <td>{fund.managementFee?.toFixed(2)}%</td>
                      <td style={{ fontWeight: 600 }}>{fund.totalFee?.toFixed(2)}%</td>
                      <td>{fund.scale?.toFixed(1)}</td>
                      <td style={{ fontWeight: 600, color: fund.dailyLimit === 0 ? '#999' : fund.dailyLimit! <= 10 ? '#ff4d4f' : '#faad14' }}>
                        {fund.dailyLimit === 0 ? '暂停' : `${fund.dailyLimit}元`}
                      </td>
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

      {/* 全部QDII */}
      {activeTab === 'all' && (
        <div>
          <div className="card">
            <h3 className="card-title">全部QDII基金</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>基金代码</th>
                    <th>基金名称</th>
                    <th>跟踪指数</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return1y')}>
                      近1年 {getSortIcon('return1y')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('return3m')}>
                      近3月 {getSortIcon('return3m')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('managementFee')}>
                      管理费 {getSortIcon('managementFee')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalFee')}>
                      综合费率 {getSortIcon('totalFee')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('scale')}>
                      规模(亿) {getSortIcon('scale')}
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dailyLimit')}>
                      每日限额 {getSortIcon('dailyLimit')}
                    </th>
                    <th>申购状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {allSortedFunds.map((fund) => (
                    <tr key={fund.code}>
                      <td>
                        <Link to={`/funds/${fund.code}`} style={{ color: '#1677ff' }}>
                          {fund.code}
                        </Link>
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <Link to={`/funds/${fund.code}`} style={{ textDecoration: 'none', color: '#333' }}>
                          {fund.name}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12 }}>{fund.index}</td>
                      <td>{formatReturn(fund.return1y)}</td>
                      <td>{formatReturn(fund.return3m)}</td>
                      <td>{fund.managementFee?.toFixed(2)}%</td>
                      <td style={{ fontWeight: 600 }}>{fund.totalFee?.toFixed(2)}%</td>
                      <td>{fund.scale?.toFixed(1)}</td>
                      <td style={{ fontWeight: 600, color: fund.dailyLimit === 0 ? '#999' : fund.dailyLimit! <= 10 ? '#ff4d4f' : '#faad14' }}>
                        {fund.dailyLimit === 0 ? '暂停' : `${fund.dailyLimit}元`}
                      </td>
                      <td>
                        <span className={`badge ${fund.buySuggestion === '暂停申购' ? 'badge-danger' : fund.buySuggestion === '限大额' ? 'badge-warning' : 'badge-success'}`}>
                          {fund.buySuggestion}
                        </span>
                      </td>
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

      {/* QDII额度说明 */}
      <div className="card">
        <h3 className="card-title">QDII额度说明</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ padding: 16, background: '#fff2f0', borderRadius: 8, border: '1px solid #ffccc7' }}>
            <h4 style={{ color: '#ff4d4f', marginBottom: 8 }}>暂停申购</h4>
            <p style={{ fontSize: 13, color: '#666' }}>QDII额度紧张，基金公司暂停申购，无法买入</p>
          </div>
          <div style={{ padding: 16, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
            <h4 style={{ color: '#faad14', marginBottom: 8 }}>限大额</h4>
            <p style={{ fontSize: 13, color: '#666' }}>每日限购10-100元，需要每天抢购</p>
          </div>
          <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <h4 style={{ color: '#52c41a', marginBottom: 8 }}>开放申购</h4>
            <p style={{ fontSize: 13, color: '#666' }}>正常申购，无限额限制</p>
          </div>
        </div>
      </div>
    </div>
  );
}
