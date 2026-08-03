/**
 * 定投执行日期计算 — 纯函数，从 portfolio.cjs 抽取以便单元测试
 */

/**
 * 计算定投计划的执行日期列表
 * @param {object} plan - 定投计划 { frequency: 'weekly'|'biweekly'|'monthly'|'quarterly', day_of_week?, day_of_month? }
 * @param {string|Date} fromDate - 起始日期（不含当天）
 * @param {string|Date} toDate - 结束日期（含）
 * @returns {Date[]} 执行日期数组
 */
function getDcaExecutionDates(plan, fromDate, toDate) {
  const dates = [];
  const start = new Date(fromDate);
  start.setDate(start.getDate() + 1);
  const end = new Date(toDate);

  const current = new Date(start);
  current.setDate(1);

  while (current <= end) {
    let execDate;

    switch (plan.frequency) {
      case 'weekly': {
        const targetDay = plan.day_of_week || 1;
        const firstOfWeek = new Date(current);
        const dayDiff = (targetDay - firstOfWeek.getDay() + 7) % 7;
        firstOfWeek.setDate(firstOfWeek.getDate() + dayDiff);
        execDate = firstOfWeek;
        current.setDate(current.getDate() + 7);
        break;
      }
      case 'biweekly': {
        const targetDay = plan.day_of_week || 1;
        const firstOfWeek = new Date(current);
        const dayDiff = (targetDay - firstOfWeek.getDay() + 7) % 7;
        firstOfWeek.setDate(firstOfWeek.getDate() + dayDiff);
        execDate = firstOfWeek;
        current.setDate(current.getDate() + 14);
        break;
      }
      case 'monthly': {
        execDate = new Date(current.getFullYear(), current.getMonth(), plan.day_of_month || 1);
        current.setMonth(current.getMonth() + 1);
        break;
      }
      case 'quarterly': {
        execDate = new Date(current.getFullYear(), current.getMonth(), plan.day_of_month || 1);
        current.setMonth(current.getMonth() + 3);
        break;
      }
      default:
        return dates;
    }

    if (execDate >= start && execDate <= end) {
      dates.push(new Date(execDate));
    }
  }

  return dates;
}

module.exports = { getDcaExecutionDates };
