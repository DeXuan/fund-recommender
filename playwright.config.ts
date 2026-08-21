import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:8866',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'iphone-16-pro-max', use: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'redmi-k60', use: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true } },
    { name: 'xiaomi-11', use: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true } },
    { name: 'honor-magic-v6-folded', use: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'honor-magic-v6-unfolded', use: { viewport: { width: 852, height: 1816 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'huawei-mate70', use: { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3.13, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node start-e2e-servers.cjs',
    port: 8866,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
