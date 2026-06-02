// 中国A股习惯：涨红跌绿
export function getReturnColor(value: number): string {
  if (value > 0) return '#ff4d4f';  // 红色 - 涨
  if (value < 0) return '#52c41a';  // 绿色 - 跌
  return '#666';                     // 灰色 - 平
}

export function formatReturn(value: number): string {
  if (value === undefined || value === null) return '-';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function getReturnClass(value: number): string {
  if (value > 0) return 'rise';
  if (value < 0) return 'fall';
  return '';
}
