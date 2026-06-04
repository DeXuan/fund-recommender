/**
 * 共享调度器 — 在指定时间执行任务，自动跳过周末
 */

/**
 * 调度每日任务（在指定小时:分钟执行，跳过周末）
 * @param {Function} task - 异步任务函数
 * @param {number} hour - 小时（24小时制）
 * @param {number} minute - 分钟
 * @param {string} label - 日志标签
 * @returns {Object} 控制对象 { stop(), nextRun }
 */
function scheduleDaily(task, hour, minute, label = '任务') {
  let timer = null;

  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);

    // 如果今天目标时间已过，设为明天
    if (now >= target) {
      target.setDate(target.getDate() + 1);
    }

    // 跳过周末
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();
    const hours = Math.round(delay / 3600000);
    console.log(`[${label}] 下次执行: ${target.toLocaleString()} (${hours}小时后)`);

    timer = setTimeout(async () => {
      try {
        await task();
      } catch (err) {
        console.error(`[${label}] 执行失败:`, err.message);
      }
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  return {
    stop: () => { if (timer) clearTimeout(timer); },
    getNextRun: () => null, // 可扩展
  };
}

/**
 * 调度交易时间内的周期任务（开盘时间每 N 分钟执行一次）
 * @param {Function} task - 异步任务函数
 * @param {number} intervalMinutes - 间隔分钟数
 * @param {string} label - 日志标签
 * @returns {Object} 控制对象 { stop() }
 */
function scheduleTradingHours(task, intervalMinutes, label = '任务') {
  let timer = null;
  const intervalMs = intervalMinutes * 60 * 1000;

  const TRADING_HOURS = [
    { start: 9 * 60 + 30, end: 11 * 60 + 30 },  // 09:30 - 11:30
    { start: 13 * 60, end: 15 * 60 },            // 13:00 - 15:00
  ];

  const isTradingHours = () => {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const time = now.getHours() * 60 + now.getMinutes();
    return TRADING_HOURS.some(h => time >= h.start && time <= h.end);
  };

  const isTradingDay = () => {
    const day = new Date().getDay();
    return day >= 1 && day <= 5;
  };

  const getNextTradingTimePoint = (now) => {
    const time = now.getHours() * 60 + now.getMinutes();
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
  };

  const getNextUpdateTime = () => {
    const now = new Date();
    if (isTradingHours()) {
      return new Date(now.getTime() + intervalMs);
    }
    if (isTradingDay()) {
      const nextPoint = getNextTradingTimePoint(now);
      if (nextPoint) return nextPoint;
    }
    const day = now.getDay();
    let daysToAdd = 1;
    if (day === 5) daysToAdd = 3;
    else if (day === 6) daysToAdd = 2;
    const target = new Date(now);
    target.setDate(target.getDate() + daysToAdd);
    target.setHours(9, 30, 0, 0);
    return target;
  };

  const scheduleNext = () => {
    const nextTime = getNextUpdateTime();
    const delay = Math.max(nextTime.getTime() - Date.now(), 60 * 1000);
    const label2 = isTradingHours() ? `${intervalMinutes}分钟` : nextTime.toLocaleString('zh-CN');

    console.log(`[${label}] 下次执行: ${label2}`);

    timer = setTimeout(async () => {
      try {
        await task();
      } catch (err) {
        console.error(`[${label}] 执行失败:`, err.message);
      }
      scheduleNext();
    }, delay);
  };

  scheduleNext();

  return {
    stop: () => { if (timer) clearTimeout(timer); },
  };
}

module.exports = { scheduleDaily, scheduleTradingHours };
