import { useState, useCallback, useEffect, useRef } from 'react';

interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncDataReturn<T> extends AsyncDataState<T> {
  execute: () => Promise<void>;
  setData: (data: T | null) => void;
  reset: () => void;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  options?: { immediate?: boolean; onError?: (e: Error) => void }
): UseAsyncDataReturn<T> {
  const [state, setState] = useState<AsyncDataState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      if (mountedRef.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (e: any) {
      if (mountedRef.current) {
        const msg = e?.message || '请求失败';
        setState(prev => ({ ...prev, loading: false, error: msg }));
        options?.onError?.(e instanceof Error ? e : new Error(msg));
      }
    }
  }, [fetcher]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    if (options?.immediate) {
      execute();
    }
    return () => { mountedRef.current = false; };
  }, []);

  return { ...state, execute, setData, reset };
}
