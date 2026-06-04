/**
 * A股交易时间判断工具（含中国法定节假日支持）
 */

// 2025-2026 年中国法定节假日（股市休市日）
// 每年需更新此列表
const HOLIDAYS = [
  // 2025 年
  '2025-01-01', // 元旦
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
  '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04', // 春节
  '2025-04-04', '2025-04-05', '2025-04-06', // 清明
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05', // 劳动节
  '2025-05-31', '2025-06-01', '2025-06-02', // 端午
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04',
  '2025-10-05', '2025-10-06', '2025-10-07', // 国庆
  // 2026 年
  '2026-01-01', '2026-01-02', '2026-01-03', // 元旦
  '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-02-21', '2026-02-22', '2026-02-23', // 春节
  '2026-04-05', '2026-04-06', '2026-04-07', // 清明
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', // 劳动节
  '2026-06-19', '2026-06-20', '2026-06-21', // 端午
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07', // 国庆
];

// 调休工作日（周末补班，股市正常开市）
const WORKDAYS = [
  '2025-01-26', // 春节调休
  '2025-02-08', // 春节调休
  '2025-04-27', // 劳动节调休
  '2025-09-28', // 国庆调休
  '2025-10-11', // 国庆调休
  '2026-02-15', // 春节调休
  '2026-02-28', // 春节调休
  '2026-10-10', // 国庆调休
];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 判断是否为交易日（考虑周末和法定节假日）
 */
function isTradingDay(date = new Date()) {
  const dateStr = formatDate(date);
  const day = date.getDay();

  // 调休工作日优先（周末补班）
  if (WORKDAYS.includes(dateStr)) return true;

  // 周末不交易
  if (day === 0 || day === 6) return false;

  // 法定节假日不交易
  if (HOLIDAYS.includes(dateStr)) return false;

  return true;
}

/**
 * 判断当前是否为A股交易时间（上午9:30-11:30，下午13:00-15:00）
 */
function isTradingHours() {
  const now = new Date();
  if (!isTradingDay(now)) return false;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 60 + minutes;

  const morningSession = time >= 9 * 60 + 30 && time <= 11 * 60 + 30;
  const afternoonSession = time >= 13 * 60 && time <= 15 * 60;

  return morningSession || afternoonSession;
}

/**
 * 获取下一个交易时间点
 */
function getNextTradingTimePoint(now) {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 60 + minutes;

  if (time < 9 * 60 + 30) {
    const target = new Date(now);
    target.setHours(9, 30, 0, 0);
    return target;
  }
  if (time >= 11 * 60 + 30 && time < 13 * 60) {
    const target = new Date(now);
    target.setHours(13, 0, 0, 0);
    return target;
  }
  return null;
}

/**
 * 计算下次数据更新时间
 */
function getNextUpdateTime() {
  const now = new Date();
  const TRADING_INTERVAL = 15 * 60 * 1000;

  if (isTradingHours()) {
    return new Date(now.getTime() + TRADING_INTERVAL);
  }

  if (isTradingDay(now)) {
    const nextPoint = getNextTradingTimePoint(now);
    if (nextPoint) return nextPoint;
  }

  // 找下一个交易日 9:30
  let targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + 1);
  targetDate.setHours(9, 30, 0, 0);

  // 最多往前找 10 天（避免无限循环）
  for (let i = 0; i < 10; i++) {
    if (isTradingDay(targetDate)) break;
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate;
}

/**
 * 获取市场状态
 */
function getMarketState() {
  const trading = isTradingHours();
  const tradingDay = isTradingDay();

  if (trading) return 'trading';
  if (tradingDay) return 'closed';
  return 'holiday';
}

module.exports = {
  isTradingDay,
  isTradingHours,
  getNextTradingTimePoint,
  getNextUpdateTime,
  getMarketState,
  HOLIDAYS,
  WORKDAYS,
};
