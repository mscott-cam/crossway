import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MAPS = 'https://maps.app.goo.gl/o7uWJUWy6KxYDraX7';
const LIVE = 'https://live.crosswaysa.org/';
const AGE_GROUPS = [
  'Infants',
  'Walkers',
  '2’s–3’s',
  'Pre-K/Kinder',
  '1st–2nd Grade',
  '3rd–5th Grade',
];

async function noOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 300) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2200);
}

test.describe('plan a visit page', () => {
  test('responds with the address, times and one h1', async ({ page }) => {
    const response = await page.goto('/visit');
    expect(response?.status()).toBe(200);
    const main = page.locator('main');
    await expect(main).toContainText(
      '15759 San Pedro Ave, San Antonio, TX 78232',
    );
    await expect(main.locator('[data-visit-times]')).toHaveText(
      '9:00 & 10:45 AM',
    );
    await expect(page.locator('h1')).toHaveCount(1);
    expect(
      (await page.locator('h1').evaluate((el) => el.textContent))
        ?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Plan your visit');
  });

  test('has a unique title and description', async ({ page }) => {
    await page.goto('/visit');
    const title = await page.title();
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(title).toBe('Plan your visit | Crossway Bible Church');
    expect(description?.length).toBeGreaterThan(40);
    await page.goto('/');
    expect(await page.title()).not.toBe(title);
    expect(
      await page.locator('meta[name="description"]').getAttribute('content'),
    ).not.toBe(description);
  });

  test('directions and watch live links open in a new tab', async ({
    page,
  }) => {
    await page.goto('/visit');
    const main = page.locator('main');
    const directions = main.getByRole('link', { name: /Get directions/ });
    await expect(directions).toHaveAttribute('href', MAPS);
    await expect(directions).toHaveAttribute('target', '_blank');
    await expect(directions).toHaveAttribute('rel', /noopener/);
    await expect(directions).toContainText('opens in a new tab');
    const live = main.getByRole('link', { name: /Watch live/ });
    await expect(live).toHaveAttribute('href', LIVE);
    await expect(live).toHaveAttribute('target', '_blank');
    await expect(live).toContainText('opens in a new tab');
  });

  test('describes a Sunday only in the owner’s words', async ({ page }) => {
    await page.goto('/visit');
    const sunday = page.locator('[data-visit-sunday]');
    await expect(
      sunday.getByRole('heading', { level: 2, name: 'What a Sunday is like' }),
    ).toBeVisible();
    await expect(sunday).toContainText('bright and busy');
    await expect(sunday).toContainText('respectful');
    await expect(sunday).toContainText('peaceful');
    await expect(sunday).toContainText('inspiring');
    await expect(sunday).toContainText(/hard questions/i);
    await expect(page.locator('main')).not.toContainText(/why we gather/i);
    await expect(page.locator('main')).not.toContainText(/come as you are/i);
    await expect(page.locator('main')).not.toContainText(/what to wear/i);
  });

  test('lists the six kids age groups and links to Crossway Kids', async ({
    page,
  }) => {
    await page.goto('/visit');
    const kids = page.locator('[data-visit-kids]');
    const items = kids.locator('[data-age-group]');
    await expect(items).toHaveText(AGE_GROUPS);
    await expect(kids).toContainText('Crossway Kids serves these age groups.');
    await expect(kids).not.toContainText(/cared for/i);
    await expect(
      kids.getByRole('link', { name: /Learn more about Crossway Kids/ }),
    ).toHaveAttribute('href', '/crossway-kids');
  });

  test('links to students', async ({ page }) => {
    await page.goto('/visit');
    const students = page.locator('[data-visit-students]');
    await expect(
      students.getByRole('heading', { level: 2, name: 'Students' }),
    ).toBeVisible();
    await expect(students).toContainText(
      'Learn about Crossway’s ministry for students.',
    );
    await expect(
      students.getByRole('link', { name: /Learn more about Students/ }),
    ).toHaveAttribute('href', '/students');
  });

  test('keeps the unsupplied facts as exactly three visible placeholders', async ({
    page,
  }) => {
    await page.goto('/visit');
    const placeholders = page.locator('main [data-placeholder]');
    await expect(placeholders).toHaveCount(3);
    await expect(placeholders.nth(0)).toContainText('how long a service lasts');
    await expect(placeholders.nth(1)).toContainText('kids check-in process');
    await expect(placeholders.nth(2)).toContainText(
      'parking and arrival details',
    );
    for (let i = 0; i < 3; i++) await expect(placeholders.nth(i)).toBeVisible();
    await expect(
      page.locator('[data-visit-kids] [data-placeholder]'),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-visit-parking] [data-placeholder]'),
    ).toHaveCount(1);
  });

  test('uses the layout’s questions form and links to it', async ({ page }) => {
    await page.goto('/visit');
    await expect(page.locator('#questions')).toHaveCount(1);
    await expect(page.locator('main form')).toHaveCount(0);
    const ask = page
      .locator('[data-visit-questions]')
      .getByRole('link', { name: 'Questions? We’d love to hear from you.' });
    await expect(ask).toHaveAttribute('href', '#questions');
    expect((await ask.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('[data-visit-questions] a')).toHaveCount(1);
    await ask.click();
    await expect(page).toHaveURL(/#questions$/);
    await expect(page.locator('#questions')).toBeInViewport();
  });

  test('does not repeat the home page steps', async ({ page }) => {
    await page.goto('/visit');
    await expect(page.locator('[data-steps]')).toHaveCount(0);
  });

  test('the header pill reaches /visit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/events');
    await page.locator('.site-header .plan-visit').click();
    await expect(page).toHaveURL(/\/visit$/);
  });

  test('uses the normal in-flow header, not the over-hero one', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visit');
    await expect(page.locator('[data-site-header]')).not.toHaveCSS(
      'position',
      'absolute',
    );
  });

  test('reveals reach full opacity after scrolling to the bottom', async ({
    page,
  }) => {
    await page.goto('/visit');
    await scrollThrough(page);
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reveal]'))
        .filter((el) => {
          const style = getComputedStyle(el);
          return style.opacity !== '1' || style.transform !== 'none';
        })
        .map((el) => el.className),
    );
    expect(hidden).toEqual([]);
  });
});

test.describe('plan a visit accessibility and layout', () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    test(`passes axe at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/visit');
      await scrollThrough(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('has no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/visit');
    expect(await noOverflow(page)).toBe(true);
    await scrollThrough(page);
    expect(await noOverflow(page)).toBe(true);
  });

  for (const [width, scale] of [
    [1440, '200%'],
    [1280, '150%'],
  ] as const) {
    test(`has no overflow at ${width}px with ${scale} text`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/visit');
      await scrollThrough(page);
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, scale);
      await page.waitForTimeout(300);
      expect(await noOverflow(page)).toBe(true);
    });
  }

  for (const scale of ['125%', '150%', '200%']) {
    test(`keeps the page content inside the viewport at 390px with ${scale} text`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/visit');
      await scrollThrough(page);
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, scale);
      await page.waitForTimeout(300);
      const outside = await page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return Array.from(document.querySelectorAll('main *, footer *'))
          .filter((el) => el.getBoundingClientRect().right > width + 1)
          .map((el) => `${el.tagName}.${el.className}`);
      });
      expect(outside).toEqual([]);
    });
  }

  test('keeps every sibling text block from overlapping at 200% on 1440px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/visit');
    await scrollThrough(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.waitForTimeout(300);
    const overlaps = await page.evaluate(() => {
      const found: string[] = [];
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>(
          'main section :is(h1,h2,h3,p,li,address,a)',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];
          if (a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w > 2 && h > 2)
            found.push(
              `${a.textContent?.trim().slice(0, 30)} / ${b.textContent?.trim().slice(0, 30)}`,
            );
        }
      }
      return found;
    });
    expect(overlaps).toEqual([]);
  });

  test('links and buttons are at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/visit');
    const small = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'main [data-visit-actions] a, main a.visit-link',
        ),
      )
        .map((el) => el.getBoundingClientRect().height)
        .filter((h) => h < 44),
    );
    expect(small).toEqual([]);
  });
});
