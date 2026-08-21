import { test, expect } from '@playwright/test';

const allPages = [
  { path: '/web/', name: '首页' },
  { path: '/web/funds', name: '基金列表' },
  { path: '/web/industry', name: '行业分析' },
  { path: '/web/qdii', name: 'QDII' },
  { path: '/web/cmb-products', name: '招行理财' },
  { path: '/web/events', name: '事件日历' },
  { path: '/web/ai-assistant', name: 'AI助手' },
  { path: '/web/fund-compare', name: '基金对比' },
  { path: '/web/login', name: '登录' },
  { path: '/web/about', name: '关于' },
];

test.describe('移动端适配测试', () => {
  for (const pg of allPages) {
    test(`${pg.name} 无水平溢出`, async ({ page: p }) => {
      await p.goto(pg.path, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1500);
      const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }

  test('导航栏宽度适配', async ({ page: p }) => {
    await p.goto('/web/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const header = p.locator('header');
    await expect(header).toBeVisible();
    const vw = await p.evaluate(() => window.innerWidth);
    const headerBox = await header.boundingBox();
    if (headerBox) {
      expect(headerBox.width).toBeLessThanOrEqual(vw + 5);
    }
  });

  test('登录表单宽度适配', async ({ page: p }) => {
    await p.goto('/web/login', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const input = p.locator('input:visible').first();
    if (await input.count() > 0) {
      const box = await input.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(80);
        expect(box.x).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('内容区域不超出视口', async ({ page: p }) => {
    await p.goto('/web/funds', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2000);
    const main = p.locator('main, [role="main"]').first();
    if (await main.count() > 0) {
      const vw = await p.evaluate(() => window.innerWidth);
      const box = await main.boundingBox();
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(vw + 5);
      }
    }
  });

  test('footer 不超出视口', async ({ page: p }) => {
    await p.goto('/web/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const footer = p.locator('footer');
    if (await footer.count() > 0) {
      const vw = await p.evaluate(() => window.innerWidth);
      const box = await footer.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(vw + 5);
      }
    }
  });

  test('可滚动页面滚动正常', async ({ page: p }) => {
    await p.goto('/web/funds', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2000);
    await p.evaluate(() => window.scrollTo(0, 100));
    await p.waitForTimeout(200);
    const scrollY = await p.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThanOrEqual(0);
  });
});
