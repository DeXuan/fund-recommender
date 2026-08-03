'use strict';

/**
 * 输入校验工具 — 消除路由文件中重复的校验逻辑
 */

// 6 位数字基金代码（消除 9 个文件中的 /\\d{6}/ 重复）
const FUND_CODE_RE = /^[0-9]{6}$/;
function isFundCode(code) {
  return typeof code === 'string' && FUND_CODE_RE.test(code);
}

// 正整数 ID
function isPositiveInt(val) {
  return Number.isInteger(val) && val > 0;
}

// 分页参数规范化（防止恶意大查询）
function normalizePagination(query, { maxPageSize = 100, defaultPageSize = 20 } = {}) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(query.pageSize) || defaultPageSize));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

module.exports = { isFundCode, isPositiveInt, normalizePagination, FUND_CODE_RE };
