import '@testing-library/jest-dom/vitest';

// Node 22+ 内置了一个 localStorage 全局 getter：不带 --localstorage-file 启动时它返回
// undefined，且优先级高于 jsdom 的实现，导致 `localStorage.setItem(...)` 抛
// "Cannot read properties of undefined"。这里替换成内存实现，保证测试在任意 Node
// 版本下行为一致。必须放在 import '../i18n' 之前（i18n 在模块顶层就会读 localStorage）。
{
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
  for (const target of [globalThis, globalThis.window].filter(Boolean) as any[]) {
    Object.defineProperty(target, 'localStorage', {
      configurable: true,
      writable: true,
      value: memoryStorage,
    });
  }
}

import '../i18n';

// Mock window.matchMedia for antd
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock window.getComputedStyle for antd
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(elt, pseudoElt);
  return style;
};

// Mock ResizeObserver for antd
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver for antd
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;
