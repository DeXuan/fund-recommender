import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Breadcrumb, Row, Col, Tag, Spin, Alert, Button, Progress, Space } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  DollarOutlined,
  FundOutlined,
  UserOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { fundApi } from '../services/api';
import { formatReturn, getReturnColor } from '../utils/format';
import { useTheme } from '../contexts/ThemeContext';
import { getEchartsTheme } from '../utils/echarts-theme';

interface ScoreDetail {
  score: number;
  label: string;
  detail: string;
  percentile?: number;
}

interface DiagnosisData {
  fund: {
    code: string;
    name: string;
    type: string;
    industry: string;
    nav: number | null;
    return1y: number;
    return6m: number;
    return3m: number;
    return1m: number;
    totalFee: number;
    scale: number;
    rating: number;
    manager: string;
    buySuggestion: string;
  };
  scores: {
    profitability: ScoreDetail;
    riskResistance: ScoreDetail;
    costEfficiency: ScoreDetail;
    scaleStability: ScoreDetail;
    managerAbility: ScoreDetail;
  };
  totalScore: number;
  peerCount: number;
  diagnosis: {
    level: string;
    summary: string;
    advantages: string[];
    risks: string[];
    suggestion: string;
  };
  generatedAt: string;
}

const SCORE_DIMENSIONS = [
  { key: 'profitability', label: '盈利能力', max: 30, icon: <ThunderboltOutlined />, color: '#ff4d4f' },
  { key: 'riskResistance', label: '抗风险力', max: 25, icon: <SafetyOutlined />, color: '#1677ff' },
  { key: 'costEfficiency', label: '费率优势', max: 15, icon: <DollarOutlined />, color: '#52c41a' },
  { key: 'scaleStability', label: '规模稳定性', max: 15, icon: <FundOutlined />, color: '#722ed1' },
  { key: 'managerAbility', label: '经理能力', max: 15, icon: <UserOutlined />, color: '#fa8c16' },
];

const LEVEL_COLORS: Record<string, string> = {
  'A+': '#52c41a',
  'A': '#73d13d',
  'B+': '#1677ff',
  'B': '#4096ff',
  'C': '#faad14',
  'D': '#ff4d4f',
};

function getScoreColor(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.8) return '#52c41a';
  if (ratio >= 0.6) return '#1677ff';
  if (ratio >= 0.4) return '#faad14';
  return '#ff4d4f';
}

export default function FundDiagnosis() {
  const { code } = useParams<{ code: string }>();
  const { isDark } = useTheme();
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    fundApi.getFundDiagnosis(code)
      .then(setData)
      .catch((err: any) => setError(err?.message || '诊断失败'))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="正在生成诊断报告..." /></div>;
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Alert type="error" message={error || '诊断数据不存在'} showIcon style={{ marginBottom: 16 }} />
        <Space>
          {error && <Button onClick={() => { setLoading(true); setError(null); fundApi.getFundDiagnosis(code!).then(setData).catch(e => setError(e?.message || '诊断失败')).finally(() => setLoading(false)); }}>重试</Button>}
          <Link to={code ? `/funds/${code}` : '/funds'}><Button type="primary">返回基金详情</Button></Link>
        </Space>
      </div>
    );
  }

  const { fund, scores, totalScore, peerCount, diagnosis } = data;

  const radarOption = {
    tooltip: {},
    radar: {
      indicator: SCORE_DIMENSIONS.map(d => ({ name: d.label, max: d.max })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: isDark ? '#ccc' : '#666', fontSize: 13 },
      splitLine: { lineStyle: { color: isDark ? '#444' : '#e8e8e8' } },
      splitArea: { show: true, areaStyle: { color: isDark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] : ['rgba(0,0,0,0.01)', 'rgba(0,0,0,0.03)'] } },
      axisLine: { lineStyle: { color: isDark ? '#444' : '#d9d9d9' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: SCORE_DIMENSIONS.map(d => scores[d.key as keyof typeof scores].score),
        name: fund.name,
        areaStyle: { color: 'rgba(22,119,255,0.2)' },
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' },
        symbol: 'circle',
        symbolSize: 6,
      }],
    }],
  };

  const barOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 100, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value', max: 100, show: false },
    yAxis: {
      type: 'category',
      data: SCORE_DIMENSIONS.map(d => d.label).reverse(),
      axisLabel: { color: isDark ? '#ccc' : '#666', fontSize: 13 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: SCORE_DIMENSIONS.map(d => {
        const s = scores[d.key as keyof typeof scores];
        const ratio = s.score / d.max;
        return {
          value: Math.round(ratio * 100),
          itemStyle: {
            color: getScoreColor(s.score, d.max),
            borderRadius: [0, 4, 4, 0],
          },
        };
      }).reverse(),
      barWidth: 20,
      label: {
        show: true,
        position: 'right',
        formatter: (p: any) => {
          const dim = SCORE_DIMENSIONS[SCORE_DIMENSIONS.length - 1 - p.dataIndex];
          const s = scores[dim.key as keyof typeof scores];
          return `${s.score}/${dim.max} ${s.label}`;
        },
        color: isDark ? '#ccc' : '#666',
        fontSize: 12,
      },
    }],
  };

  return (
    <div className="fade-in">
      <Breadcrumb
        items={[
          { title: <Link to="/">首页</Link> },
          { title: <Link to="/funds">基金列表</Link> },
          { title: <Link to={`/funds/${fund.code}`}>{fund.name}</Link> },
          { title: '诊断报告' },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* 总评分卡片 */}
      <Card style={{
        marginBottom: 16,
        background: `linear-gradient(135deg, ${LEVEL_COLORS[diagnosis.level] || '#1677ff'}22 0%, ${LEVEL_COLORS[diagnosis.level] || '#1677ff'}08 100%)`,
        border: `1px solid ${LEVEL_COLORS[diagnosis.level] || '#1677ff'}33`,
        borderRadius: 16,
      }}>
        <Row align="middle" gutter={24}>
          <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
              width: 140, height: 140, borderRadius: '50%',
              background: `linear-gradient(135deg, ${LEVEL_COLORS[diagnosis.level] || '#1677ff'}, ${LEVEL_COLORS[diagnosis.level] || '#1677ff'}aa)`,
              justifyContent: 'center', boxShadow: `0 8px 24px ${LEVEL_COLORS[diagnosis.level] || '#1677ff'}44`,
            }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{totalScore}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>/ 100 分</div>
            </div>
            <div style={{
              marginTop: 12, fontSize: 28, fontWeight: 700,
              color: LEVEL_COLORS[diagnosis.level] || '#1677ff',
            }}>
              {diagnosis.level}
            </div>
          </Col>
          <Col xs={24} sm={16}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>{fund.name} ({fund.code})</h2>
            <p style={{ fontSize: 16, color: isDark ? '#e8e8e8' : '#333', marginBottom: 16 }}>{diagnosis.summary}</p>
            <Space size={16} wrap>
              <Tag color="blue">{fund.industry || fund.type}</Tag>
              {fund.nav != null && <span>净值: <strong>{Number(fund.nav).toFixed(4)}</strong></span>}
              <span style={{ color: getReturnColor(fund.return1y) }}>
                近1年: {formatReturn(fund.return1y)}
              </span>
              <span>同类基金: {peerCount} 只</span>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 五维评分 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="五维雷达图" style={{ height: '100%' }}>
            <ReactECharts theme={getEchartsTheme(isDark)} option={radarOption} style={{ height: 320 }} opts={{ renderer: 'svg' }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="评分明细" style={{ height: '100%' }}>
            <ReactECharts theme={getEchartsTheme(isDark)} option={barOption} style={{ height: 320 }} opts={{ renderer: 'svg' }} />
          </Card>
        </Col>
      </Row>

      {/* 各维度详情 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {SCORE_DIMENSIONS.map(dim => {
          const s = scores[dim.key as keyof typeof scores];
          const ratio = Math.round((s.score / dim.max) * 100);
          return (
            <Col xs={24} sm={12} lg={8} xl={4} key={dim.key} style={{ minWidth: 200 }}>
              <Card size="small" style={{ height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 20, color: dim.color }}>{dim.icon}</span>
                  <span style={{ fontWeight: 600 }}>{dim.label}</span>
                  <Tag color={getScoreColor(s.score, dim.max)} style={{ marginLeft: 'auto' }}>{s.label}</Tag>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: getScoreColor(s.score, dim.max), marginBottom: 8 }}>
                  {s.score}<span style={{ fontSize: 14, fontWeight: 400, color: isDark ? '#aaa' : '#999' }}> / {dim.max}</span>
                </div>
                <Progress
                  percent={ratio}
                  showInfo={false}
                  strokeColor={getScoreColor(s.score, dim.max)}
                  size="small"
                />
                <div style={{ fontSize: 12, color: isDark ? '#aaa' : '#888', marginTop: 8 }}>{s.detail}</div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* 诊断建议 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <Card title={<span><CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />优势分析</span>}>
            {diagnosis.advantages.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {diagnosis.advantages.map((a, i) => (
                  <li key={i} style={{ padding: '6px 0', color: isDark ? '#d9d9d9' : '#333' }}>{a}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: isDark ? '#aaa' : '#999' }}>暂无明显优势</div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={<span><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />风险提示</span>}>
            {diagnosis.risks.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {diagnosis.risks.map((r, i) => (
                  <li key={i} style={{ padding: '6px 0', color: isDark ? '#d9d9d9' : '#333' }}>{r}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: isDark ? '#aaa' : '#999' }}>暂无明显风险</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 综合建议 */}
      <Card style={{ marginBottom: 16, background: isDark ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #f5f7fa 0%, #e8f4f8 100%)', border: 'none' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>综合建议</h3>
        <p style={{ lineHeight: 1.8, fontSize: 15, margin: 0 }}>{diagnosis.suggestion}</p>
      </Card>

      {/* 收益率对比 */}
      <Card title="收益率一览" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {[
            { label: '近1年', value: fund.return1y },
            { label: '近6月', value: fund.return6m },
            { label: '近3月', value: fund.return3m },
            { label: '近1月', value: fund.return1m },
          ].map(item => (
            <Col xs={12} sm={6} key={item.label}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ color: isDark ? '#aaa' : '#888', fontSize: 12, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: getReturnColor(item.value) }}>
                  {item.value >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatReturn(item.value)}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 基金基本信息 */}
      <Card title="基金基本信息" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>基金代码：</span>{fund.code}</Col>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>基金类型：</span>{fund.type}</Col>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>行业板块：</span>{fund.industry || '-'}</Col>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>基金经理：</span>{fund.manager || '-'}</Col>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>综合费率：</span>{fund.totalFee != null ? Number(fund.totalFee).toFixed(2) : '-'}%/年</Col>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>基金规模：</span>{fund.scale != null ? Number(fund.scale).toFixed(2) : '-'} 亿</Col>
          <Col xs={12} sm={8}><span style={{ color: isDark ? '#aaa' : '#888' }}>评级：</span><span style={{ color: '#faad14' }}>{'★'.repeat(fund.rating)}</span></Col>
          {fund.buySuggestion && (
            <Col span={24}><span style={{ color: isDark ? '#aaa' : '#888' }}>买入建议：</span>{fund.buySuggestion}</Col>
          )}
        </Row>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link to={`/funds/${fund.code}`}><Button type="primary">返回基金详情</Button></Link>
          <Link to="/funds"><Button>基金列表</Button></Link>
        </div>
      </Card>
    </div>
  );
}
