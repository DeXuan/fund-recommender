/**
 * 共享主题常量 — 消除跨文件硬编码颜色值
 */

// Ant Design 主题色（与 main.tsx token 一致）
export const COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',

  // 中国市场惯例：红涨绿跌
  profit: '#ff4d4f',
  loss: '#52c41a',
  flat: '#8c8c8c',

  // 通用
  textPrimary: 'rgba(0, 0, 0, 0.85)',
  textSecondary: 'rgba(0, 0, 0, 0.45)',
  bgPrimary: '#ffffff',
  bgSecondary: '#fafafa',
  border: '#d9d9d9',

  // 图表色板
  chart: ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'],
} as const;

// 深色模式颜色
export const DARK_COLORS = {
  textPrimary: 'rgba(255, 255, 255, 0.85)',
  textSecondary: 'rgba(255, 255, 255, 0.45)',
  bgPrimary: '#141414',
  bgSecondary: '#1f1f1f',
  border: '#424242',
} as const;

// 估值等级配色
export const VALUATION_COLORS: Record<string, string> = {
  very_low: '#52c41a',
  low: '#73d13d',
  reasonable: '#faad14',
  high: '#ff7a45',
  very_high: '#ff4d4f',
  '极低': '#52c41a',
  '很低': '#52c41a',
  '低估': '#73d13d',
  '偏低': '#95de64',
  '合理': '#faad14',
  '合理偏低': '#ffc53d',
  '合理偏高': '#ff7a45',
  '偏高': '#ff7a45',
  '高估': '#ff4d4f',
  '极高': '#ff4d4f',
} as const;

// 因子配色（AI选股）
export const FACTOR_COLORS: Record<string, string> = {
  return1y: '#1677ff',
  fee: '#52c41a',
  scale: '#faad14',
  valuation: '#eb2f96',
  momentum: '#722ed1',
} as const;

// Ant Design ConfigProvider 主题 token（基础）
export const ANTD_THEME_TOKEN = {
  token: {
    colorPrimary: COLORS.primary,
    borderRadius: 6,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.error,
  },
} as const;

// 暗色模式感知 token（在 ConfigProvider 中根据 isDark 合并）
export function getDarkAwareTokens(isDark: boolean) {
  return {
    colorBgContainer: isDark ? '#1a1a1a' : '#ffffff',
    colorBgElevated: isDark ? '#262626' : '#ffffff',
    colorBorderSecondary: isDark ? '#333' : '#f0f0f0',
    colorText: isDark ? '#e8e8e8' : '#1f1f1f',
    colorTextSecondary: isDark ? '#a0a0a0' : '#595959',
    colorBgLayout: isDark ? '#141414' : '#f5f5f5',
  };
}
