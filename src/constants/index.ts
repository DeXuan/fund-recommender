/**
 * 共享应用常量
 */

export { COLORS, DARK_COLORS, VALUATION_COLORS, FACTOR_COLORS, ANTD_THEME_TOKEN } from './theme';

// 分页默认值
export const PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// 自动刷新间隔
export const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5分钟

// 交易日相关
export const TRADING_DAYS_PER_MONTH = 22;
export const WEEKS_PER_MONTH = 4.33;

// API 请求超时
export const API_TIMEOUT = 30000;

// 评分因子权重默认值
export const DEFAULT_FACTOR_WEIGHTS = {
  return1y: { weight: 0.3, label: '近1年收益', color: '#1677ff' },
  fee: { weight: 0.15, label: '费率', color: '#52c41a' },
  scale: { weight: 0.15, label: '规模', color: '#faad14' },
  valuation: { weight: 0.2, label: '估值', color: '#eb2f96' },
  momentum: { weight: 0.2, label: '动量', color: '#722ed1' },
} as const;

// 行业列表（带图标和标签）
export const INDUSTRIES = [
  { name: '人工智能/AI', emoji: '🤖', tag: '年度主线' },
  { name: '半导体/芯片', emoji: '🔬', tag: '国产替代' },
  { name: '纳斯达克100', emoji: '🇺🇸', tag: 'QDII额度紧张' },
  { name: '医药', emoji: '💊', tag: '估值极低' },
  { name: '新能源', emoji: '⚡', tag: '底部反弹' },
  { name: '消费', emoji: '🛒', tag: '等待企稳' },
  { name: '军工', emoji: '🚀', tag: '政策催化' },
  { name: '金融', emoji: '🏦', tag: '高股息' },
  { name: '煤炭', emoji: '⛏️', tag: '高股息+低估值' },
  { name: '证券', emoji: '📈', tag: '底部反弹' },
  { name: '陶瓷/建材', emoji: '🏗️', tag: '逢低布局' },
  { name: '电力', emoji: '🔋', tag: '夏季首选' },
  { name: '家电', emoji: '🏠', tag: '高温驱动' },
  { name: '酒店旅游', emoji: '✈️', tag: '暑期旺季' },
] as const;

// 市场事件分类配置
export const CATEGORY_CONFIG = {
  monetary: { label: '货币政策', color: '#1677ff', icon: '🏦' },
  fiscal: { label: '财政政策', color: '#52c41a', icon: '📋' },
  industry: { label: '行业政策', color: '#722ed1', icon: '🏭' },
  market: { label: '市场事件', color: '#faad14', icon: '📊' },
  macro: { label: '宏观数据', color: '#eb2f96', icon: '📈' },
  international: { label: '国际事件', color: '#13c2c2', icon: '🌍' },
} as const;

// 影响等级配置
export const IMPACT_CONFIG = {
  high: { label: '高影响', color: '#ff4d4f' },
  medium: { label: '中影响', color: '#faad14' },
  low: { label: '低影响', color: '#52c41a' },
} as const;
