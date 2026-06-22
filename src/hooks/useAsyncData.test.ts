import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncData } from './useAsyncData';

describe('useAsyncData', () => {
  it('starts with null data and no loading', () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve(42)));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loads data on execute()', async () => {
    const fetcher = vi.fn().mockResolvedValue({ name: 'test' });
    const { result } = renderHook(() => useAsyncData(fetcher));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toEqual({ name: 'test' });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('captures errors', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('网络错误'));
    const { result } = renderHook(() => useAsyncData(fetcher));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('网络错误');
  });

  it('sets loading during fetch', async () => {
    let resolve: (v: number) => void;
    const fetcher = vi.fn().mockImplementation(() => new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useAsyncData(fetcher));

    act(() => {
      result.current.execute();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolve!(42);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(42);
  });

  it('setData updates data directly', () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.resolve(0)));

    act(() => {
      result.current.setData(99);
    });

    expect(result.current.data).toBe(99);
  });

  it('reset clears all state', async () => {
    const fetcher = vi.fn().mockResolvedValue('hello');
    const { result } = renderHook(() => useAsyncData(fetcher));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.data).toBe('hello');

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls onError callback on failure', async () => {
    const onError = vi.fn();
    const fetcher = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAsyncData(fetcher, { onError }));

    await act(async () => {
      await result.current.execute();
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'fail' }));
  });
});
