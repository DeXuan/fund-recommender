import { Card, Button } from 'antd';
import { CrownOutlined, RocketOutlined, BulbOutlined } from '@ant-design/icons';
import { STRATEGIES } from './chartOptions';

interface Props {
  isDark: boolean;
  isSVIP: boolean;
  isMobile: boolean;
  strategy: string;
  onStrategyChange: (val: string) => void;
  total: number;
  stats: { avgScore: string; maxReturn: string; industries: number } | null;
  marketSentiment: { label: string; color: string };
  onUpgrade: () => void;
}

export function StockPickerHeader({ isDark, isSVIP, isMobile, strategy, onStrategyChange, total, stats, marketSentiment, onUpgrade }: Props) {
  return (
    <Card bordered={false} style={{
      marginBottom: 16,
      background: isDark
        ? 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: -60, right: -60, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: '20%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
      <div style={{ position: 'absolute', top: '50%', right: '10%', width: 100, height: 100, borderRadius: '50%', background: 'rgba(250,173,20,0.06)' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: isSVIP
                ? 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)'
                : 'rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isSVIP ? '0 4px 16px rgba(250,173,20,0.4)' : 'none',
            }}>
              {isSVIP
                ? <CrownOutlined style={{ fontSize: 22, color: '#fff' }} />
                : <RocketOutlined style={{ fontSize: 22, color: '#fff' }} />
              }
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 22, fontWeight: 800, color: '#fff',
                  letterSpacing: '0.5px',
                  textShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  AI 智能选股引擎
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 6,
                  background: isSVIP
                    ? 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)'
                    : 'rgba(255,255,255,0.15)',
                  color: isSVIP ? '#fff' : 'rgba(255,255,255,0.8)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '1px',
                  border: isSVIP ? 'none' : '1px solid rgba(255,255,255,0.2)',
                }}>
                  {isSVIP ? <><CrownOutlined style={{ marginRight: 3, fontSize: 9 }} />SVIP</> : 'PRO'}
                </span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, fontWeight: 500, letterSpacing: '0.3px' }}>
                七因子量化模型 · 风险调整收益评估 · 行业轮动洞察 · 智能分批建仓 · 回测验证系统
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STRATEGIES.map(s => (
            <Button key={s.value} size="small" ghost={strategy !== s.value}
              type={strategy === s.value ? 'primary' : 'default'}
              icon={s.icon}
              onClick={() => onStrategyChange(s.value)}
              style={{
                borderColor: strategy === s.value ? '#fff' : 'rgba(255,255,255,0.25)',
                color: strategy === s.value ? '#fff' : 'rgba(255,255,255,0.7)',
                background: strategy === s.value ? 'rgba(255,255,255,0.12)' : 'transparent',
                borderRadius: 8, fontSize: 12, height: 28,
              }}>
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, padding: isMobile ? '8px 12px' : '10px 16px',
        background: 'rgba(0,0,0,0.15)', borderRadius: 10, backdropFilter: 'blur(10px)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: marketSentiment.color,
            boxShadow: `0 0 8px ${marketSentiment.color}`,
          }} />
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500 }}>
            市场<span style={{ color: marketSentiment.color, fontWeight: 700, marginLeft: 3 }}>{marketSentiment.label}</span>
          </span>
        </div>

        {!isMobile && <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <BulbOutlined style={{ color: '#ffd666', fontSize: 13 }} />
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500 }}>
            推荐：<span style={{ color: '#ffd666', fontWeight: 700 }}>{STRATEGIES.find(s => s.value === strategy)?.label}</span>
          </span>
        </div>

        {!isMobile && <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />}

        {[
          { label: '扫描基金', value: total, suffix: '只', color: '#69c0ff' },
          { label: 'Top10均分', value: stats?.avgScore || '--', suffix: '分', color: '#95de64' },
          { label: '最高收益', value: stats?.maxReturn || '--', suffix: '%', color: '#ffd666' },
          { label: '覆盖行业', value: stats?.industries || '--', suffix: '个', color: '#d3adf7' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', minWidth: isMobile ? 50 : 70 }}>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
              <span style={{
                color: s.color, fontSize: 20, fontWeight: 800,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                textShadow: `0 0 20px ${s.color}40`,
                letterSpacing: '-0.5px',
              }}>{s.value}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 500 }}>{s.suffix}</span>
            </div>
          </div>
        ))}

        {!isSVIP && (
          <>
            <div style={{ flex: 1 }} />
            <div
              onClick={onUpgrade}
              style={{
                padding: '4px 12px', borderRadius: 16,
                background: 'linear-gradient(135deg, #faad14 0%, #fa8c16 100%)',
                color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(250,173,20,0.3)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <CrownOutlined style={{ fontSize: 10 }} />
              开通SVIP
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
