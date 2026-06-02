import { useState } from 'react';
import { fundApi } from '../services/api';

interface RiskProfile {
  age: string;
  investmentAmount: string;
  investmentPeriod: string;
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  lossTolerance: string;
}

interface Recommendation {
  type: string;
  description: string;
  allocation: {
    industry: string;
    percentage: number;
    funds: string[];
  }[];
  expectedReturn: string;
  riskLevel: string;
}

export default function RiskAssessment() {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<RiskProfile>({
    age: '',
    investmentAmount: '',
    investmentPeriod: '',
    riskTolerance: 'balanced',
    lossTolerance: '',
  });
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = await fundApi.getRiskProfile(profile);
      setRecommendation(data);
      setStep(5);
    } catch (error) {
      console.error('风险评估失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h3 className="card-title">1. 您的年龄段</h3>
            <div className="radio-group">
              {['18-25岁', '26-35岁', '36-45岁', '46-55岁', '55岁以上'].map((age) => (
                <label
                  key={age}
                  className={`radio-option ${profile.age === age ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="age"
                    value={age}
                    checked={profile.age === age}
                    onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                  />
                  {age}
                </label>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <h3 className="card-title">2. 计划投资金额</h3>
            <div className="radio-group">
              {['1万以下', '1-5万', '5-20万', '20-50万', '50万以上'].map((amount) => (
                <label
                  key={amount}
                  className={`radio-option ${profile.investmentAmount === amount ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="amount"
                    value={amount}
                    checked={profile.investmentAmount === amount}
                    onChange={(e) => setProfile({ ...profile, investmentAmount: e.target.value })}
                  />
                  {amount}
                </label>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div>
            <h3 className="card-title">3. 计划投资期限</h3>
            <div className="radio-group">
              {['3个月以内', '3-6个月', '6-12个月', '1-3年', '3年以上'].map((period) => (
                <label
                  key={period}
                  className={`radio-option ${profile.investmentPeriod === period ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="period"
                    value={period}
                    checked={profile.investmentPeriod === period}
                    onChange={(e) => setProfile({ ...profile, investmentPeriod: e.target.value })}
                  />
                  {period}
                </label>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div>
            <h3 className="card-title">4. 风险承受能力</h3>
            <div className="radio-group">
              {[
                { value: 'conservative', label: '保守型', desc: '无法接受本金损失，追求稳定收益' },
                { value: 'balanced', label: '稳健型', desc: '能接受小幅波动，追求长期增值' },
                { value: 'aggressive', label: '激进型', desc: '能承受较大波动，追求高收益' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`radio-option ${profile.riskTolerance === option.value ? 'selected' : ''}`}
                  style={{ flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <input
                    type="radio"
                    name="risk"
                    value={option.value}
                    checked={profile.riskTolerance === option.value}
                    onChange={(e) => setProfile({ ...profile, riskTolerance: e.target.value as any })}
                  />
                  <strong>{option.label}</strong>
                  <span style={{ fontSize: 12, color: '#666' }}>{option.desc}</span>
                </label>
              ))}
            </div>

            <h3 className="card-title" style={{ marginTop: 24 }}>5. 能承受的最大亏损</h3>
            <div className="radio-group">
              {['5%以内', '5-10%', '10-20%', '20-30%', '30%以上'].map((loss) => (
                <label
                  key={loss}
                  className={`radio-option ${profile.lossTolerance === loss ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="loss"
                    value={loss}
                    checked={profile.lossTolerance === loss}
                    onChange={(e) => setProfile({ ...profile, lossTolerance: e.target.value })}
                  />
                  {loss}
                </label>
              ))}
            </div>
          </div>
        );

      case 5:
        return recommendation ? (
          <div>
            <div className="result-card">
              <h3>您的风险类型：{recommendation.type}</h3>
              <p style={{ marginTop: 8, color: '#666' }}>{recommendation.description}</p>

              <div className="stat-grid" style={{ marginTop: 20 }}>
                <div className="stat-item">
                  <div className="stat-label">预期年化收益</div>
                  <div className="stat-value">{recommendation.expectedReturn}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-label">风险等级</div>
                  <div className="stat-value">{recommendation.riskLevel}</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title">推荐资产配置</h3>
              {recommendation.allocation.map((item, index) => (
                <div key={index} style={{ marginBottom: 20 }}>
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{item.industry}</span>
                    <span style={{ fontWeight: 600, color: '#1677ff' }}>{item.percentage}%</span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 8 }}>
                    <div className="progress-fill" style={{ width: `${item.percentage}%` }}></div>
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    推荐基金：{item.funds.join('、')}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="card-title">操作建议</h3>
              <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                {profile.riskTolerance === 'conservative' && (
                  <ul>
                    <li>建议以债券基金和货币基金为主，占比80%</li>
                    <li>可配置少量沪深300指数基金，占比20%</li>
                    <li>适合长期持有，不建议频繁操作</li>
                    <li>定投周期建议：每月固定日期</li>
                  </ul>
                )}
                {profile.riskTolerance === 'balanced' && (
                  <ul>
                    <li>建议均衡配置，股票型基金和债券型基金各占50%</li>
                    <li>股票型基金可选择沪深300、消费、医药等</li>
                    <li>建议采用定投方式，分散买入成本</li>
                    <li>定投周期建议：每周或每两周</li>
                  </ul>
                )}
                {profile.riskTolerance === 'aggressive' && (
                  <ul>
                    <li>建议以股票型基金为主，占比80-90%</li>
                    <li>可配置AI、半导体、纳斯达克等高弹性品种</li>
                    <li>建议分批建仓，不要一次性投入</li>
                    <li>定投周期建议：每周</li>
                  </ul>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => { setStep(1); setRecommendation(null); }}>
                重新评估
              </button>
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>风险评估</h1>

      {/* 进度条 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: s <= step ? '#1677ff' : '#e8e8e8',
                color: s <= step ? 'white' : '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
              }}
            >
              {s}
            </div>
          ))}
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }}></div>
        </div>
      </div>

      {/* 问题内容 */}
      <div className="card">
        {renderStep()}
      </div>

      {/* 导航按钮 */}
      {step < 5 && (
        <div className="card">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn btn-outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              上一步
            </button>
            {step < 4 ? (
              <button
                className="btn btn-primary"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !profile.age) ||
                  (step === 2 && !profile.investmentAmount) ||
                  (step === 3 && !profile.investmentPeriod)
                }
              >
                下一步
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || !profile.riskTolerance || !profile.lossTolerance}
              >
                {loading ? '评估中...' : '获取推荐'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
