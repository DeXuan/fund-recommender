import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabLazyLoad } from './useTabLazyLoad';

describe('useTabLazyLoad', () => {
  it('initializes with the given tab', () => {
    const { result } = renderHook(() => useTabLazyLoad('rank'));
    expect(result.current.activeTab).toBe('rank');
    expect(result.current.loadedTabs.has('rank')).toBe(true);
  });

  it('marks tab as loaded on first change', () => {
    const { result } = renderHook(() => useTabLazyLoad('rank'));
    act(() => {
      result.current.handleTabChange('industry');
    });
    expect(result.current.activeTab).toBe('industry');
    expect(result.current.loadedTabs.has('industry')).toBe(true);
    expect(result.current.loadedTabs.has('rank')).toBe(true);
  });

  it('calls onFirstLoad only once per tab', () => {
    const { result } = renderHook(() => useTabLazyLoad('rank'));
    let callCount = 0;
    const onLoad = () => { callCount++; };

    act(() => {
      result.current.handleTabChange('industry', onLoad);
    });
    expect(callCount).toBe(1);

    act(() => {
      result.current.handleTabChange('industry', onLoad);
    });
    expect(callCount).toBe(1); // Not called again
  });

  it('calls onFirstLoad for each new tab', () => {
    const { result } = renderHook(() => useTabLazyLoad('rank'));
    let callCount = 0;
    const onLoad = () => { callCount++; };

    act(() => {
      result.current.handleTabChange('industry', onLoad);
    });
    act(() => {
      result.current.handleTabChange('market', onLoad);
    });
    expect(callCount).toBe(2);
  });
});
