import React, { useState } from 'react';
import { Input, Tag, Spin, Empty, message } from 'antd';
import { SearchOutlined, CrownOutlined } from '@ant-design/icons';
import { stockPickerApi } from '../../services/api';

const exampleQueries = [
  '近1年收益>20%的低费率基金',
  '规模>50亿的沪深300基金',
  '收益率高的半导体基金',
  '低费率的债券型基金',
  '高评级的新能源基金',
];

const NLScreenerInput: React.FC<{
  isSVIP: boolean;
  isDark: boolean;
  onUpgrade: () => void;
}> = ({ isSVIP, isDark, onUpgrade }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [total, setTotal] = useState(0);

  const handleSearch = async (q?: string) => {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    if (!isSVIP) { onUpgrade(); return; }

    setLoading(true);
    try {
      const res = await stockPickerApi.nlScreen(searchQuery.trim());
      setResults(res.results);
      setParsed(res.parsed);
      setTotal(res.total);
      if (res.total === 0 && res.suggestion) {
        message.info(res.suggestion);
      }
    } catch (e: any) {
      message.error(e.message || '筛选失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!isSVIP && (
        <div style={{
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          background: isDark ? 'rgba(250,173,20,0.08)' : 'linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%)',
          border: `1px solid ${isDark ? 'rgba(250,173,20,0.2)' : '#ffe58f'}`,
          padding: '24px 20px', marginBottom: 16, textAlign: 'center',
        }}>
          <CrownOutlined style={{ fontSize: 32, color: '#faad14', marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#faad14' : '#ad6800', marginBottom: 8 }}>
            自然语言筛选 - 至尊SVIP专属
          </div>
          <div style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.65)' : '#8c8c8c', marginBottom: 16 }}>
            用中文描述你想要的基金，AI智能理解并筛选
          </div>
          <div
            onClick={onUpgrade}
            style={{
              display: 'inline-block', padding: '8px 24px', borderRadius: 20,
              background: 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
            }}
          >
            开通至尊SVIP
          </div>
        </div>
      )}

      <Input.Search
        placeholder="用自然语言描述你想要的基金，如：近1年收益>20%的低费率沪深300基金"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onSearch={() => handleSearch()}
        loading={loading}
        size="large"
        prefix={<SearchOutlined style={{ color: isDark ? 'rgba(255,255,255,0.3)' : '#bfbfbf' }} />}
        style={{ marginBottom: 12 }}
        disabled={!isSVIP}
      />

      <div style={{ marginBottom: 16 }}>
        {exampleQueries.map((q, i) => (
          <Tag
            key={i}
            onClick={() => { setQuery(q); handleSearch(q); }}
            style={{
              cursor: 'pointer', marginBottom: 6, borderRadius: 12,
              background: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
              color: isDark ? 'rgba(255,255,255,0.65)' : '#595959',
            }}
          >
            {q}
          </Tag>
        ))}
      </div>

      {loading && <Spin style={{ display: 'block', margin: '40px auto' }} />}

      {results && !loading && (
        <div>
          {parsed?.conditions?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c' }}>
                识别条件：
              </span>
              {parsed.conditions.map((c: any, i: number) => (
                <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{c.label}</Tag>
              ))}
              <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c', marginLeft: 8 }}>
                共 {total} 只基金
              </span>
            </div>
          )}

          {results.length === 0 ? (
            <Empty description="未找到符合条件的基金" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {results.map((f) => (
                <div key={f.code} style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: isDark ? '#fff' : '#262626' }}>{f.name}</span>
                    <Tag>{f.code}</Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: isDark ? 'rgba(255,255,255,0.5)' : '#8c8c8c' }}>
                    <span>收益: <b style={{ color: (f.return1y || 0) >= 0 ? '#52c41a' : '#f5222d' }}>{f.return1y?.toFixed(2)}%</b></span>
                    <span>费率: {f.totalFee?.toFixed(2)}%</span>
                    <span>规模: {f.scale?.toFixed(1)}亿</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NLScreenerInput;
