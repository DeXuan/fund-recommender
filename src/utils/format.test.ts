import { describe, it, expect } from 'vitest';
import { getReturnColor, formatReturn, getReturnClass, formatCurrency, getValuationText, getValuationColor, getReturnStyle } from './format';

describe('getReturnColor', () => {
  it('returns red for positive values (China convention)', () => {
    expect(getReturnColor(5.5)).toBe('#ff4d4f');
    expect(getReturnColor(0.01)).toBe('#ff4d4f');
  });

  it('returns green for negative values', () => {
    expect(getReturnColor(-3.2)).toBe('#52c41a');
    expect(getReturnColor(-0.01)).toBe('#52c41a');
  });

  it('returns gray for zero', () => {
    expect(getReturnColor(0)).toBe('#666');
  });
});

describe('formatReturn', () => {
  it('formats positive values with + sign', () => {
    expect(formatReturn(12.34)).toBe('+12.34%');
    expect(formatReturn(0.01)).toBe('+0.01%');
  });

  it('formats negative values with - sign', () => {
    expect(formatReturn(-5.67)).toBe('-5.67%');
  });

  it('formats zero without sign', () => {
    expect(formatReturn(0)).toBe('+0.00%');
  });

  it('returns - for null/undefined', () => {
    expect(formatReturn(null as any)).toBe('-');
    expect(formatReturn(undefined as any)).toBe('-');
  });
});

describe('getReturnClass', () => {
  it('returns rise for positive', () => {
    expect(getReturnClass(1)).toBe('rise');
  });

  it('returns fall for negative', () => {
    expect(getReturnClass(-1)).toBe('fall');
  });

  it('returns empty string for zero', () => {
    expect(getReturnClass(0)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats CNY currency', () => {
    const result = formatCurrency(12345.67);
    expect(result).toContain('12,345.67');
    expect(result).toContain('¥');
  });

  it('formats zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
});

describe('getValuationText', () => {
  it('maps English codes to Chinese text', () => {
    expect(getValuationText('very_low')).toBe('极低');
    expect(getValuationText('low')).toBe('低估');
    expect(getValuationText('reasonable')).toBe('合理');
    expect(getValuationText('high')).toBe('偏高');
    expect(getValuationText('very_high')).toBe('极高');
  });

  it('returns original text for unknown codes', () => {
    expect(getValuationText('unknown')).toBe('unknown');
  });
});

describe('getValuationColor', () => {
  it('returns green for low valuation (undervalued = good)', () => {
    expect(getValuationColor('low')).toBe('#52c41a');
    expect(getValuationColor('very_low')).toBe('#52c41a');
  });

  it('returns red for high valuation (overvalued = bad)', () => {
    expect(getValuationColor('high')).toBe('#ff4d4f');
    expect(getValuationColor('very_high')).toBe('#ff4d4f');
  });

  it('returns blue for reasonable/null', () => {
    expect(getValuationColor('reasonable')).toBe('#1677ff');
    expect(getValuationColor(null)).toBe('#1677ff');
    expect(getValuationColor(undefined)).toBe('#1677ff');
  });
});

describe('getReturnStyle', () => {
  it('returns red color for positive', () => {
    expect(getReturnStyle(5)).toEqual({ color: '#ff4d4f' });
  });

  it('returns green color for negative', () => {
    expect(getReturnStyle(-5)).toEqual({ color: '#52c41a' });
  });
});
