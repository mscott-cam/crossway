import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ baseURL: 'http://localhost:4322' });

const TEXT = 'Join us this Sunday as we continue the Entrusted series.';

const bar = (page: Page) => page.locator('[data-announcement]');

async function box(page: Page, selector: string) {
  return (await page.locator(selector).first().boundingBox())!;
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test.describe(`announcement on at ${width}px`, () => {
    test.use({ viewport: { width, height } });

    test('the bar sits at the very top with the text and a link', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(bar(page)).toContainText(TEXT);
      await expect(bar(page).getByRole('link')).toHaveAttribute(
        'href',
        '/entrusted',
      );
      const b = await box(page, '[data-announcement]');
      expect(b.y).toBe(0);
      expect(b.width).toBeGreaterThanOrEqual(width - 1);
      expect(b.height).toBeGreaterThan(20);
      expect(b.height).toBeLessThan(width > 800 ? 60 : 90);
    });

    test('home: the header pill and the hero start at the bar bottom edge', async ({
      page,
    }) => {
      await page.goto('/');
      const b = await box(page, '[data-announcement]');
      const hero = await box(page, '[data-hero]');
      const pill = await box(page, '.site-header__bar');
      expect(Math.abs(hero.y - (b.y + b.height))).toBeLessThanOrEqual(1);
      expect(pill.y).toBeGreaterThanOrEqual(b.y + b.height);
      expect(pill.y - (b.y + b.height)).toBeLessThan(24);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    });

    test('sermons: the sticky header sits under the bar, then at top 0 after scrolling', async ({
      page,
    }) => {
      await page.goto('/sermons');
      const b = await box(page, '[data-announcement]');
      const header = page.locator('[data-site-header]');
      await expect(header).toHaveCSS('position', 'sticky');
      expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(
        b.y + b.height - 1,
      );
      await page.evaluate(() => window.scrollTo(0, 700));
      await page.waitForTimeout(200);
      expect((await header.boundingBox())!.y).toBe(0);
    });
  });
}

test.describe('announcement on, mobile menu', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the menu covers the viewport even when the page is scrolled', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(300);
    await page.locator('[data-menu-toggle]').click();
    const menu = await box(page, '[data-mobile-menu]');
    expect(menu.y).toBe(0);
    expect(menu.height).toBeGreaterThanOrEqual(844 - 1);
    await expect(
      page.locator('[data-mobile-menu]').getByRole('link', { name: 'Connect' }),
    ).toBeVisible();
  });
});

test.describe('announcement on, accessibility', () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    test(`axe passes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.waitForTimeout(3200);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('has no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
