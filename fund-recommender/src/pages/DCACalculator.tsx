import { useState } from 'react';
import { fundApi } from '../services/api';

interface DCAResult {
  totalInvestment: number;
  totalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  monthlyDetails: {
    month: number;
    investment: number;
    cumulativeInvestment: number;
    value: number;
    return: number;
  }[];
}

export default function DCACalculator() {
  const [monthlyAmount, setMonthlyAmount] = useState(1000);
  const [period, setPeriod] = useState(36);
  const [expectedReturn, setExpectedReturn] = useState(10);
  const [result, setResult] = useState<DCAResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const data = await fundApi.calculateDCA({
        monthlyAmount,
        period,
        expectedReturn,
      });
      setResult(data);
    } catch (error) {
      console.error('计算失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>定投计算器</h1>

      {/* 输入参数 */}
      <div className="card">
        <h3 className="card-title">定投参数</h3>
        <div className="grid grid-3">
          <div className="form-group">
            <label>每月定投金额（元）</label>
            <input
              type="number"
              className="input"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(Number(e.target.value))}
              min={100}
              step={100}
            />
          </div>
          <div className="form-group">
            <label>定投期限（月）</label>
            <input
              type="number"
              className="input"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              min={1}
              max={120}
            />
          </div>
          <div className="form-group">
            <label>预期年化收益率（%）</label>
            <input
              type="number"
              className="input"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(Number(e.target.value))}
              min={0}
              max={50}
              step={0.5}
            />
          </div>
        </div>

        {/* 快捷设置 */}
        <div style={{ marginTop: 16 }}>
          <span className="text-muted" style={{ marginRight: 12 }}>快捷设置：</span>
          <button
            className="tag"
            onClick={() => { setMonthlyAmount(500); setPeriod(12); setExpectedReturn(8); }}
          >
            保守型
          </button>
          <button
            className="tag"
            onClick={() => { setMonthlyAmount(1000); setPeriod(36); setExpectedReturn(10); }}
          >
            稳健型
          </button>
          <button
            className="tag"
            onClick={() => { setMonthlyAmount(2000); setPeriod(60); setExpectedReturn(15); }}
          >
            激进型
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={handleCalculate} disabled={loading}>
            {loading ? '计算中...' : '开始计算'}
          </button>
        </div>
      </div>

      {/* 计算结果 */}
      {result && (
        <>
          <div className="card">
            <h3 className="card-title">计算结果</h3>
            <div className="stat-grid">
              <div className="stat-item">
                <div className="stat-label">总投入</div>
                <div className="stat-value">{formatCurrency(result.totalInvestment)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">总资产</div>
                <div className="stat-value">{formatCurrency(result.totalValue)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">总收益</div>
                <div className="stat-value" style={{ color: result.totalReturn >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {formatCurrency(result.totalValue - result.totalInvestment)}
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">总收益率</div>
                <div className="stat-value" style={{ color: result.totalReturn >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">年化收益率</div>
                <div className="stat-value" style={{ color: result.annualizedReturn >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {result.annualizedReturn >= 0 ? '+' : ''}{result.annualizedReturn.toFixed(2)}%
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-label">定投期数</div>
                <div className="stat-value">{period} 个月</div>
              </div>
            </div>
          </div>

          {/* 收益曲线说明 */}
          <div className="card">
            <h3 className="card-title">定投说明</h3>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <p>假设每月投入 <strong>{formatCurrency(monthlyAmount)}</strong>，持续 <strong>{period}</strong> 个月：</p>
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>总投入本金：{formatCurrency(result.totalInvestment)}</li>
                <li>预期总资产：{formatCurrency(result.totalValue)}</li>
                <li>预期总收益：{formatCurrency(result.totalValue - result.totalInvestment)}</li>
                <li>年化收益率：{result.annualizedReturn.toFixed(2)}%</li>
              </ul>
            </div>
          </div>

          {/* 月度明细 */}
          <div className="card">
            <h3 className="card-title">月度明细</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>当月投入</th>
                    <th>累计投入</th>
                    <th>资产市值</th>
                    <th>收益率</th>
                  </tr>
                </thead>
                <tbody>
                  {result.monthlyDetails.slice(0, 12).map((month) => (
                    <tr key={month.month}>
                      <td>第 {month.month} 个月</td>
                      <td>{formatCurrency(month.investment)}</td>
                      <td>{formatCurrency(month.cumulativeInvestment)}</td>
                      <td>{formatCurrency(month.value)}</td>
                      <td style={{ color: month.return >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {month.return >= 0 ? '+' : ''}{month.return.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  {result.monthlyDetails.length > 12 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>
                        ... 共 {result.monthlyDetails.length} 个月
                      </td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: 600, background: '#f5f5f5' }}>
                    <td>最终</td>
                    <td>{formatCurrency(result.totalInvestment)}</td>
                    <td>{formatCurrency(result.totalInvestment)}</td>
                    <td>{formatCurrency(result.totalValue)}</td>
                    <td style={{ color: result.totalReturn >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 投资建议 */}
          <div className="card">
            <h3 className="card-title">定投建议</h3>
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <h4 style={{ marginBottom: 8 }}>适合定投的基金类型</h4>
              <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
                <li><strong>指数基金</strong>：沪深300、中证500等宽基指数，费率低、透明度高</li>
                <li><strong>行业ETF</strong>：看好长期趋势的行业，如AI、半导体、医药等</li>
                <li><strong>QDII基金</strong>：分散地域风险，如纳斯达克100、标普500</li>
              </ul>

              <h4 style={{ marginBottom: 8 }}>定投技巧</h4>
              <ul style={{ paddingLeft: 20 }}>
                <li>坚持长期投资，至少3年以上</li>
                <li>市场下跌时不要停止定投，反而是低成本买入的机会</li>
                <li>设置止盈点，达到目标收益后可分批止盈</li>
                <li>选择C类基金适合短期持有，A类基金适合长期持有</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* 预设方案 */}
      <div className="card">
        <h3 className="card-title">热门定投方案</h3>
        <div className="grid grid-3">
          <div className="stat-item" style={{ cursor: 'pointer' }} onClick={() => { setMonthlyAmount(500); setPeriod(60); setExpectedReturn(8); handleCalculate(); }}>
            <div className="stat-label">沪深300定投</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>每月500元 × 5年</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>预期年化8%</div>
          </div>
          <div className="stat-item" style={{ cursor: 'pointer' }} onClick={() => { setMonthlyAmount(1000); setPeriod(36); setExpectedReturn(12); handleCalculate(); }}>
            <div className="stat-label">科技主题定投</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>每月1000元 × 3年</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>预期年化12%</div>
          </div>
          <div className="stat-item" style={{ cursor: 'pointer' }} onClick={() => { setMonthlyAmount(2000); setPeriod(24); setExpectedReturn(15); handleCalculate(); }}>
            <div className="stat-label">成长股定投</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>每月2000元 × 2年</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>预期年化15%</div>
          </div>
        </div>
      </div>
    </div>
  );
}
