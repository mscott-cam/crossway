import {
  chromium,
  expect,
  test,
  type Browser,
  type Page,
} from '@playwright/test';

const SCROLLBAR = 15;

let browser: Browser;

test.beforeAll(async () => {
  browser = await chromium.launch({
    ignoreDefaultArgs: ['--hide-scrollbars'],
    args: ['--disable-features=OverlayScrollbar,FluentOverlayScrollbar'],
  });
});

test.afterAll(async () => {
  await browser.close();
});

async function classicPage(baseURL: string | undefined, width: number) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: 800 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => window.innerWidth - document.documentElement.clientWidth,
        ),
      { message: 'emulated classic scrollbar' },
    )
    .toBe(SCROLLBAR);
  return { page, close: () => context.close() };
}

const frames = (page: Page, count: number) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const tick = (left: number) =>
          left === 0 ? resolve() : requestAnimationFrame(() => tick(left - 1));
        tick(n);
      }),
    count,
  );

test.describe('mobile menu with a classic scrollbar', () => {
  for (const width of [1100, 1107, 1114]) {
    test(`stays open at ${width}px`, async ({ baseURL }) => {
      const { page, close } = await classicPage(baseURL, width);
      try {
        const menu = page.getByRole('button', { name: 'Menu' });
        await expect(menu).toBeVisible();
        for (let round = 0; round < 3; round += 1) {
          await menu.click();
          await expect(menu).toHaveAttribute('aria-expanded', 'true');
          await frames(page, 10);
          await expect(menu).toHaveAttribute('aria-expanded', 'true');
          await expect(page.locator('html')).toHaveClass(/menu-open/);
          await page.keyboard.press('Escape');
          await expect(menu).toHaveAttribute('aria-expanded', 'false');
        }
      } finally {
        await close();
      }
    });
  }

  test('keeps the layout width unchanged while the menu is open', async ({
    baseURL,
  }) => {
    const { page, close } = await classicPage(baseURL, 1107);
    try {
      const widths = () =>
        page.evaluate(() => ({
          body: document.body.getBoundingClientRect().width,
          bar: document.querySelector('.site-header__bar')!.clientWidth,
        }));
      const before = await widths();
      const menu = page.getByRole('button', { name: 'Menu' });
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await frames(page, 5);
      expect(await widths()).toEqual(before);
    } finally {
      await close();
    }
  });
});
