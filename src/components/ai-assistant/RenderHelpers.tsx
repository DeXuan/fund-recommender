import { Tag } from 'antd';
import { Link } from 'react-router-dom';

export function renderFundList(funds: any[], isDark: boolean) {
  if (!funds?.length) return null;
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
      {funds.slice(0, 6).map((f: any) => (
        <Link key={f.code} to={`/funds/${f.code}`} style={{ textDecoration: 'none' }}>
          <div className="ai-fund-card" style={{
            padding: '10px 14px', borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(22,119,255,0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(22,119,255,0.12)'}`,
            transition: 'all 0.2s', cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: isDark ? '#e8e8e8' : '#1f1f1f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                  {f.isGoldSelected && <Tag color="gold" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px' }}>金选</Tag>}
                </div>
                <div style={{ fontSize: 11, color: isDark ? '#6b6b6b' : '#999', fontFamily: 'monospace' }}>{f.code}</div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: (f.return1y || 0) >= 0 ? '#ff4d4f' : '#52c41a' }}>
                {(f.return1y || 0) >= 0 ? '+' : ''}{f.return1y?.toFixed(2)}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: isDark ? '#6b6b6b' : '#888' }}>
              <span>费率 {f.totalFee?.toFixed(2)}%</span>
              <span>规模 {f.scale?.toFixed(1)}亿</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function renderIndices(data: any, isDark: boolean) {
  if (!data?.indices) return null;
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
      {data.indices.map((idx: any) => (
        <div key={idx.code} style={{
          padding: '10px 12px', borderRadius: 10,
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(22,119,255,0.04)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(22,119,255,0.1)'}`,
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{idx.name}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{idx.price?.toFixed(2)}</span>
            <span style={{ fontWeight: 600, color: idx.changePercent >= 0 ? '#ff4d4f' : '#52c41a' }}>
              {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent?.toFixed(2)}%
            </span>
          </div>
          {idx.pePercentile != null && (
            <Tag color={idx.pePercentile < 30 ? 'green' : idx.pePercentile < 70 ? 'blue' : 'red'} style={{ fontSize: 11, marginTop: 4 }}>
              PE分位 {idx.pePercentile}%
            </Tag>
          )}
        </div>
      ))}
    </div>
  );
}

export function renderIndustries(data: any) {
  if (!data?.industries) return null;
  return (
    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {data.industries.map((ind: string) => (
        <Link key={ind} to={`/industry?name=${encodeURIComponent(ind)}`}>
          <Tag color="blue" style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 12px' }}>{ind}</Tag>
        </Link>
      ))}
    </div>
  );
}

export function renderStructuredData(data: any, isDark: boolean) {
  if (!data) return null;
  if (Array.isArray(data)) return renderFundList(data, isDark);
  if (data.type === 'indices' || data.type === 'valuation') return renderIndices(data, isDark);
  if (data.type === 'industries') return renderIndustries(data);
  return null;
}
