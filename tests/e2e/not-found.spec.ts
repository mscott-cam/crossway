import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const MISSING = '/definitely/not/a/page';

test.describe('404 page', () => {
  test('answers unknown URLs with a 404 and the branded page', async ({
    page,
  }) => {
    const response = await page.goto(MISSING);
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle('Page not found | Crossway Bible Church');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('We couldn’t find that page');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex',
    );
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
    await expect(page.locator('#questions')).toHaveCount(0);
  });

  test('links to the main places', async ({ page }) => {
    await page.goto(MISSING);
    const links = page.locator('main .not-found__links a');
    await expect(links).toHaveText([
      /Home/,
      /Plan your visit/,
      /Sermons/,
      /Events/,
    ]);
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href')),
    );
    expect(hrefs).toEqual(['/', '/visit', '/sermons', '/events']);
  });

  test('has no accessibility violations or horizontal overflow', async ({
    page,
  }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(MISSING);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('is not listed in the sitemap', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap-0.xml')).text();
    expect(sitemap).not.toContain('/404');
  });
});

test('the bare archive path lands on the first archive page', async ({
  page,
}) => {
  await page.goto('/sermons/archive');
  await expect(page).toHaveURL(/\/sermons\/archive\/1$/);
  await expect(page.locator('h1')).toHaveText('All messages');
});
