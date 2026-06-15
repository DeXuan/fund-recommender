import { useState } from 'react';
import { Card, Steps, Radio, Space, Row, Col, Button, Alert, Statistic, Progress } from 'antd';
import { fundApi, portfolioApi } from '../../services/api';

interface Props {
  isDark: boolean;
}

export function RiskAssessmentTab({ isDark }: Props) {
  const [riskStep, setRiskStep] = useState(0);
  const [riskProfile, setRiskProfile] = useState({
    age: '', investmentAmount: '', investmentPeriod: '', riskTolerance: 'balanced' as 'conservative' | 'balanced' | 'aggressive', lossTolerance: '',
  });
  const [riskRecommendation, setRiskRecommendation] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const canNextRisk = () => {
    if (riskStep === 0) return !!riskProfile.age;
    if (riskStep === 1) return !!riskProfile.investmentAmount;
    if (riskStep === 2) return !!riskProfile.investmentPeriod;
    if (riskStep === 3) return !!riskProfile.riskTolerance && !!riskProfile.lossTolerance;
    return false;
  };

  const handleRiskSubmit = async () => {
    setRiskLoading(true);
    try {
      const data = await fundApi.getRiskProfile(riskProfile);
      setRiskRecommendation(data);
      setRiskStep(4);
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await portfolioApi.saveRiskProfile({
            ...riskProfile,
            score: data.score || 0,
            riskType: data.type,
            riskLevel: data.riskLevel,
            expectedReturn: data.expectedReturn,
            allocation: data.allocation,
          });
        } catch { /* 非登录用户忽略 */ }
      }
    } catch (error) {
      console.error('风险评估失败:', error);
    } finally {
      setRiskLoading(false);
    }
  };

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Steps current={riskStep} items={[
          { title: '年龄' }, { title: '投资金额' }, { title: '投资期限' }, { title: '风险偏好' }, { title: '评估结果' },
        ]} size="small" />
      </Card>

      <Card style={{ marginBottom: 16, minHeight: 300 }}>
        {riskStep === 0 && (
          <div>
            <h3 style={{ marginBottom: 16 }}>1. 您的年龄段</h3>
            <Radio.Group value={riskProfile.age} onChange={(e) => setRiskProfile({ ...riskProfile, age: e.target.value })}>
              <Space direction="vertical" size={12}>
                {['18-25岁', '26-35岁', '36-45岁', '46-55岁', '55岁以上'].map((age) => (
                  <Radio.Button key={age} value={age} style={{ width: 200, textAlign: 'center' }}>{age}</Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </div>
        )}

        {riskStep === 1 && (
          <div>
            <h3 style={{ marginBottom: 16 }}>2. 计划投资金额</h3>
            <Radio.Group value={riskProfile.investmentAmount} onChange={(e) => setRiskProfile({ ...riskProfile, investmentAmount: e.target.value })}>
              <Space direction="vertical" size={12}>
                {['1万以下', '1-5万', '5-20万', '20-50万', '50万以上'].map((amount) => (
                  <Radio.Button key={amount} value={amount} style={{ width: 200, textAlign: 'center' }}>{amount}</Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </div>
        )}

        {riskStep === 2 && (
          <div>
            <h3 style={{ marginBottom: 16 }}>3. 计划投资期限</h3>
            <Radio.Group value={riskProfile.investmentPeriod} onChange={(e) => setRiskProfile({ ...riskProfile, investmentPeriod: e.target.value })}>
              <Space direction="vertical" size={12}>
                {['3个月以内', '3-6个月', '6-12个月', '1-3年', '3年以上'].map((period) => (
                  <Radio.Button key={period} value={period} style={{ width: 200, textAlign: 'center' }}>{period}</Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </div>
        )}

        {riskStep === 3 && (
          <div>
            <h3 style={{ marginBottom: 16 }}>4. 风险承受能力</h3>
            <Radio.Group value={riskProfile.riskTolerance} onChange={(e) => setRiskProfile({ ...riskProfile, riskTolerance: e.target.value })}>
              <Row gutter={[16, 16]}>
                {[
                  { value: 'conservative', label: '保守型', desc: '无法接受本金损失，追求稳定收益' },
                  { value: 'balanced', label: '稳健型', desc: '能接受小幅波动，追求长期增值' },
                  { value: 'aggressive', label: '激进型', desc: '能承受较大波动，追求高收益' },
                ].map((option) => (
                  <Col xs={24} sm={8} key={option.value}>
                    <Card
                      hoverable
                      style={{ border: riskProfile.riskTolerance === option.value ? '2px solid #1677ff' : `1px solid ${isDark ? '#333' : '#e8e8e8'}`, cursor: 'pointer' }}
                      onClick={() => setRiskProfile({ ...riskProfile, riskTolerance: option.value as any })}
                    >
                      <strong>{option.label}</strong>
                      <p style={{ fontSize: 12, color: isDark ? '#a0a0a0' : '#666', margin: '8px 0 0' }}>{option.desc}</p>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Radio.Group>

            <h3 style={{ marginBottom: 16, marginTop: 24 }}>5. 能承受的最大亏损</h3>
            <Radio.Group value={riskProfile.lossTolerance} onChange={(e) => setRiskProfile({ ...riskProfile, lossTolerance: e.target.value })}>
              <Space direction="vertical" size={12}>
                {['5%以内', '5-10%', '10-20%', '20-30%', '30%以上'].map((loss) => (
                  <Radio.Button key={loss} value={loss} style={{ width: 200, textAlign: 'center' }}>{loss}</Radio.Button>
                ))}
              </Space>
            </Radio.Group>
          </div>
        )}

        {riskStep === 4 && riskRecommendation && (
          <div>
            <Alert
              type="success"
              message={`您的风险类型：${riskRecommendation.type}`}
              description={riskRecommendation.description}
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic title="预期年化收益" value={riskRecommendation.expectedReturn} valueStyle={{ color: '#1677ff' }} />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: 'center' }}>
                  <Statistic title="风险等级" value={riskRecommendation.riskLevel} valueStyle={{ color: '#ff4d4f' }} />
                </Card>
              </Col>
            </Row>

            <Card title="推荐资产配置" style={{ marginBottom: 16 }}>
              {riskRecommendation.allocation.map((item: any, index: number) => (
                <div key={index} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>{item.industry}</strong>
                    <span style={{ color: '#1677ff', fontWeight: 600 }}>{item.percentage}%</span>
                  </div>
                  <Progress percent={item.percentage} showInfo={false} />
                  <div style={{ fontSize: 13, color: isDark ? '#a0a0a0' : '#666', marginTop: 4 }}>推荐基金：{item.funds.join('、')}</div>
                </div>
              ))}
            </Card>

            <Card title="操作建议">
              <ul style={{ fontSize: 14, lineHeight: 2, margin: 0, paddingLeft: 20 }}>
                {riskProfile.riskTolerance === 'conservative' && (
                  <>
                    <li>建议以债券基金和货币基金为主，占比80%</li>
                    <li>可配置少量沪深300指数基金，占比20%</li>
                    <li>适合长期持有，不建议频繁操作</li>
                  </>
                )}
                {riskProfile.riskTolerance === 'balanced' && (
                  <>
                    <li>建议均衡配置，股票型基金和债券型基金各占50%</li>
                    <li>股票型基金可选择沪深300、消费、医药等</li>
                    <li>建议采用定投方式，分散买入成本</li>
                  </>
                )}
                {riskProfile.riskTolerance === 'aggressive' && (
                  <>
                    <li>建议以股票型基金为主，占比80-90%</li>
                    <li>可配置AI、半导体、纳斯达克等高弹性品种</li>
                    <li>建议分批建仓，不要一次性投入</li>
                  </>
                )}
              </ul>
            </Card>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Button type="primary" onClick={() => { setRiskStep(0); setRiskRecommendation(null); }}>重新评估</Button>
            </div>
          </div>
        )}
      </Card>

      {riskStep < 4 && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => setRiskStep(Math.max(0, riskStep - 1))} disabled={riskStep === 0}>上一步</Button>
            {riskStep < 3 ? (
              <Button type="primary" onClick={() => setRiskStep(riskStep + 1)} disabled={!canNextRisk()}>下一步</Button>
            ) : (
              <Button type="primary" onClick={handleRiskSubmit} loading={riskLoading} disabled={!canNextRisk()}>获取推荐</Button>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
