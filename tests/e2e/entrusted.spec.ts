import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FAQ_COUNT = 13;

async function noOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1600);
}

test.describe('/entrusted', () => {
  test('responds with one h1 and a unique title', async ({ page }) => {
    const response = await page.goto('/entrusted');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Entrusted');
    await expect(page).toHaveTitle('Entrusted | Crossway Bible Church');
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description).toContain('2-year, church-wide initiative');
  });

  test('carries the church’s key facts', async ({ page }) => {
    await page.goto('/entrusted');
    const main = page.locator('main');
    await expect(main).toContainText('$6,500,000');
    await expect(main).toContainText('December 13, 2026');
    await expect(main).toContainText('One Fund. Two Years. Three Aims.');
    await expect(main).toContainText('from December 2026 to December 2028');
    for (const heading of [
      'Understanding ENTRUSTED',
      'Making a Commitment',
      'The Gift Chart',
      'The Worksheet',
      'Existing ministry',
      'Expanding ministry',
      'Extending ministry',
      'One Fund?',
      'Two Years?',
    ]) {
      await expect(
        main.getByRole('heading', { name: heading, exact: true }),
      ).toBeVisible();
    }
  });

  test('has the live FAQ count of details with accessible summaries', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    await expect(page.locator('[data-faq-item] > summary')).toHaveCount(
      FAQ_COUNT,
    );
    await expect(page.locator('[data-faq-item]')).toHaveCount(FAQ_COUNT);
    await expect(page.locator('details')).toHaveCount(FAQ_COUNT + 1);
    const names = await page
      .locator('[data-faq-item] > summary')
      .evaluateAll((els) => els.map((el) => el.textContent?.trim()));
    expect(names[0]).toBe('In brief, what exactly is it that we’re doing?');
    expect(names.at(-1)).toBe('How long is my commitment?');
    for (const name of names) expect(name?.length).toBeGreaterThan(5);
  });

  test('keeps every FAQ item closed on load, with ids for deep links', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    expect(
      await page
        .locator('details')
        .evaluateAll(
          (els) => els.filter((el) => (el as HTMLDetailsElement).open).length,
        ),
    ).toBe(0);
    await expect(page.locator('details#commitment-length')).toHaveCount(1);
  });

  test('the first FAQ item toggles open and closed on click', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    const first = page.locator('[data-faq-item]').first();
    await expect(first).not.toHaveAttribute('open', '');
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first).toContainText('two-year initiative');
    await first.locator('summary').click();
    await expect(first).not.toHaveAttribute('open', '');
  });

  test('FAQ summaries are keyboard operable', async ({ page }) => {
    await page.goto('/entrusted');
    const second = page.locator('[data-faq-item]').nth(1);
    await second.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(second).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(second).not.toHaveAttribute('open', '');
  });

  test('FAQ summaries have a visible focus ring and a 44px target', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    const summary = page.locator('[data-faq-item] > summary').first();
    await summary.focus();
    const outline = await summary.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
        height: el.getBoundingClientRect().height,
      };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.height).toBeGreaterThanOrEqual(44);
  });

  test('the FAQ answers carry the giving comparison, the commitment dates and the stock-gift contact', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    const compare = page.locator('details#compared-to-current-giving');
    await compare.locator('summary').click();
    await expect(compare).toContainText('$1.7 million');
    await expect(compare).toContainText('$3.4 million');
    await expect(compare).toContainText('$3.1 million');
    const cash = page.locator('details#ways-besides-cash');
    await cash.locator('summary').click();
    await expect(cash).toContainText('Scott Barns');
    await expect(cash.getByRole('link')).toHaveAttribute(
      'href',
      'mailto:Scott@CrosswaySA.org?subject=Questions%20about%20ENTRUSTED',
    );
    await expect(cash.getByRole('link')).toHaveText('Scott@CrosswaySA.org');
  });

  test('links on the page are the live page’s links', async ({ page }) => {
    await page.goto('/entrusted');
    const hrefs = await page
      .locator('main a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual([
      '#understanding-entrusted',
      '#aim-1',
      '#making-a-commitment',
      '#faqs',
      '/documents/entrusted-gift-chart.svg',
      'mailto:Scott@CrosswaySA.org?subject=Questions%20about%20ENTRUSTED',
    ]);
    await expect(
      page.locator('header').getByRole('link', { name: /^Give/ }).first(),
    ).toHaveAttribute('href', 'https://pushpay.com/g/crosswaysa?src=hpp');
  });

  test('the Gift Chart and Worksheet are bundled locally, not hotlinked', async ({
    page,
    request,
  }) => {
    await page.goto('/entrusted');
    const srcs = await page
      .locator('main img')
      .evaluateAll((els) => els.map((el) => el.getAttribute('src')));
    expect(srcs).toEqual([
      '/documents/entrusted-gift-chart.svg',
      '/documents/entrusted-giving-split.svg',
      '/documents/entrusted-worksheet.svg',
    ]);
    for (const src of srcs) {
      const response = await request.get(src!);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/svg+xml');
    }
    const alts = await page
      .locator('main img')
      .evaluateAll((els) => els.map((el) => el.getAttribute('alt') ?? ''));
    expect(alts[0]).toContain('$6,500,000');
    for (const alt of alts) expect(alt.length).toBeGreaterThan(40);
    await expect(
      page.locator('main iframe, main form, main input'),
    ).toHaveCount(0);
  });

  test('the gift chart is also available as a real table in a closed details', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    const details = page.locator('details.chart-text');
    await expect(details).toHaveCount(1);
    await expect(details).not.toHaveAttribute('open', '');
    const summary = details.locator('summary');
    expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(details).toHaveAttribute('open', '');
    const table = details.getByRole('table', { name: /Gift Chart/ });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText([
      'Gifts needed',
      '2-year gift',
      'Monthly gift',
      'Totals',
    ]);
    await expect(table.getByRole('row')).toHaveCount(15);
    await expect(
      table.getByRole('row', { name: /Total target/ }),
    ).toContainText('$6,500,000');
    await expect(
      table.getByRole('row', { name: /^4 \$144,000/ }),
    ).toContainText('$576,000');
    await page.keyboard.press('Space');
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('the full-size chart link opens the bundled SVG in a new tab', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    const link = page.getByRole('link', { name: /View full-size chart/ });
    await expect(link).toHaveAttribute(
      'href',
      '/documents/entrusted-gift-chart.svg',
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAccessibleName(
      'View full-size chart (opens in a new tab)',
    );
  });

  test('the gift chart table stays inside the viewport at 320px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/entrusted');
    await page.locator('details.chart-text summary').click();
    expect(await noOverflow(page)).toBe(true);
    const right = await page
      .locator('details.chart-text [role="region"]')
      .evaluate((el) => el.getBoundingClientRect().right);
    expect(right).toBeLessThanOrEqual(320);
  });

  test('gift chart amounts never break across lines at 390px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/entrusted');
    await page.locator('details.chart-text summary').click();
    const tall = await page
      .locator('details.chart-text tbody td')
      .evaluateAll((cells) =>
        cells
          .filter((cell) => cell.getBoundingClientRect().height > 48)
          .map((cell) => cell.textContent),
      );
    expect(tall).toEqual([]);
    const scrolls = await page
      .locator('details.chart-text [role="region"]')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrolls).toBe(false);
  });

  test('the home page Entrusted link reaches the page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Learn about Entrusted/ }).click();
    await expect(page).toHaveURL(/\/entrusted$/);
    await expect(page.locator('h1')).toHaveText('Entrusted');
  });

  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    test(`passes axe at ${width}px, closed and with items open`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/entrusted');
      await scrollThrough(page);
      const wcag = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
      let results = await new AxeBuilder({ page }).withTags(wcag).analyze();
      expect(results.violations).toEqual([]);
      await page.locator('details.chart-text summary').click();
      await page.locator('[data-faq-item]').nth(1).locator('summary').click();
      await page
        .locator('details#ways-besides-cash')
        .locator('summary')
        .click();
      results = await new AxeBuilder({ page }).withTags(wcag).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('has no horizontal overflow at 320px, even with every item open', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/entrusted');
    expect(await noOverflow(page)).toBe(true);
    await page.evaluate(() =>
      document
        .querySelectorAll('details')
        .forEach((el) => ((el as HTMLDetailsElement).open = true)),
    );
    expect(await noOverflow(page)).toBe(true);
    await scrollThrough(page);
    expect(await noOverflow(page)).toBe(true);
  });

  test('keeps the page content inside the viewport at 200% root font size', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/entrusted');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
      document
        .querySelectorAll('details')
        .forEach((el) => ((el as HTMLDetailsElement).open = true));
    });
    await page.waitForTimeout(300);
    const outside = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return Array.from(document.querySelectorAll('main *, footer *'))
        .filter(
          (el) =>
            !el.closest('[role="region"]') &&
            el.getBoundingClientRect().right > width + 1,
        )
        .map((el) => `${el.tagName}.${el.className}`);
    });
    expect(outside).toEqual([]);
  });

  test('every reveal reaches full opacity after scrolling to the bottom', async ({
    page,
  }) => {
    await page.goto('/entrusted');
    expect(await page.locator('[data-reveal]').count()).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2200);
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reveal]'))
        .filter((el) => getComputedStyle(el).opacity !== '1')
        .map((el) => el.className || el.tagName),
    );
    expect(hidden).toEqual([]);
  });

  test('content is visible with JavaScript disabled', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/entrusted');
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reveal]'))
        .filter((el) => getComputedStyle(el).opacity !== '1')
        .map((el) => el.className),
    );
    expect(hidden).toEqual([]);
    await page.locator('[data-faq-item]').first().locator('summary').click();
    await expect(page.locator('[data-faq-item]').first()).toHaveAttribute(
      'open',
      '',
    );
    await context.close();
  });
});
