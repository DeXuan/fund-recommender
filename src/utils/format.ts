// 中国A股习惯：涨红跌绿
export function getReturnColor(value: number): string {
  if (value > 0) return '#ff4d4f';
  if (value < 0) return '#52c41a';
  return '#666';
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

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

export function getValuationText(valuation: string): string {
  const map: Record<string, string> = {
    very_low: '极低',
    low: '低估',
    reasonable: '合理',
    high: '偏高',
    very_high: '极高',
  };
  return map[valuation] || valuation;
}

export function getValuationColor(valuation: string | null | undefined): string {
  if (!valuation) return '#1677ff';
  if (valuation === 'very_low' || valuation === 'low' || valuation.includes('低')) return '#52c41a';
  if (valuation === 'high' || valuation === 'very_high' || valuation.includes('高')) return '#ff4d4f';
  return '#1677ff';
}

// 通用收益率着色样式（用于行内 span）
export function getReturnStyle(value: number): { color: string } {
  return { color: getReturnColor(value) };
}
