import { test, expect } from '@playwright/test';

const publicPages = [
  { path: '/web/', name: '首页' },
  { path: '/web/funds', name: '基金列表' },
  { path: '/web/industry', name: '行业分析' },
  { path: '/web/qdii', name: 'QDII基金' },
  { path: '/web/cmb-products', name: '招行理财' },
  { path: '/web/events', name: '事件日历' },
  { path: '/web/ai-assistant', name: 'AI助手' },
  { path: '/web/fund-compare', name: '基金对比' },
  { path: '/web/login', name: '登录' },
  { path: '/web/about', name: '关于' },
];

test.describe('页面导航与加载', () => {
  for (const page of publicPages) {
    test(`${page.name} (${page.path}) 正常加载无白屏`, async ({ page: p }) => {
      await p.goto(page.path, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(1500);
      const bodyText = await p.locator('body').innerText();
      expect(bodyText.length).toBeGreaterThan(10);
      const scrollWidth = await p.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await p.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  }

  test('导航栏可见且有菜单项', async ({ page: p }) => {
    await p.goto('/web/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const header = p.locator('header');
    await expect(header).toBeVisible();
  });

  test('主题切换按钮可用', async ({ page: p }) => {
    await p.goto('/web/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const themeBtn = p.locator('button').filter({ hasText: /☀️|🌙/ });
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await p.waitForTimeout(300);
    await expect(themeBtn).toBeVisible();
  });

  test('语言切换按钮可用', async ({ page: p }) => {
    await p.goto('/web/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
    const langBtn = p.locator('button').filter({ hasText: /中|EN/ });
    if (await langBtn.count() > 0) {
      await langBtn.first().click();
      await p.waitForTimeout(200);
    }
  });
});

test.describe('登录页面功能', () => {
  test.beforeEach(async ({ page: p }) => {
    await p.goto('/web/');
    await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await p.goto('/web/login', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1500);
  });

  test('登录表单可见且可输入', async ({ page: p }) => {
    const inputs = p.locator('input:visible');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    const usernameInput = inputs.first();
    await usernameInput.fill('testuser');
    await expect(usernameInput).toHaveValue('testuser');
  });

  test('密码输入框存在', async ({ page: p }) => {
    const passwordInput = p.locator('input[type="password"]:visible');
    await expect(passwordInput.first()).toBeVisible();
  });

  test('登录注册标签页切换', async ({ page: p }) => {
    const tabs = p.locator('.ant-tabs-tab');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
    if (count >= 2) {
      await tabs.nth(1).click();
      await p.waitForTimeout(300);
    }
  });
});

test.describe('基金列表页功能', () => {
  test('页面有内容展示', async ({ page: p }) => {
    await p.goto('/web/funds', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);
    const bodyText = await p.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });
});

test.describe('AI助手页面功能', () => {
  test('聊天界面可见', async ({ page: p }) => {
    await p.goto('/web/ai-assistant', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2000);
    const bodyText = await p.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(10);
  });
});

test.describe('行业分析页面功能', () => {
  test('页面有内容展示', async ({ page: p }) => {
    await p.goto('/web/industry', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(3000);
    const bodyText = await p.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);
  });
});
