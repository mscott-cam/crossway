import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = [
  { path: '/culture', h1: 'Culture' },
  { path: '/who-we-are', h1: 'Who We Are' },
  { path: '/what-we-believe', h1: 'What We Believe' },
  { path: '/child-safety', h1: 'Child Safety' },
  { path: '/networks', h1: 'Networks' },
  { path: '/small-groups', h1: 'Small Groups' },
  { path: '/students', h1: 'Crossway Students' },
  { path: '/crossway-kids', h1: 'Crossway Kids' },
  { path: '/biblical-counseling', h1: 'Biblical Counseling' },
  { path: '/christian-stewardship', h1: 'Give to Crossway' },
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
  for (let y = 0; y <= height; y += 400) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1600);
}

test.describe('content pages', () => {
  for (const { path, h1 } of PAGES) {
    test.describe(path, () => {
      test('responds with one h1 and a unique title', async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveText(h1);
        await expect(page).toHaveTitle(`${h1} | Crossway Bible Church`);
        const description = await page
          .locator('meta[name="description"]')
          .getAttribute('content');
        expect(description?.length).toBeGreaterThan(40);
        const text = await page.locator('main').innerText();
        expect(text).not.toMatch(/\b(undefined|null)\b/);
      });

      for (const [width, height] of [
        [1440, 900],
        [390, 844],
      ]) {
        test(`passes axe at ${width}px`, async ({ page }) => {
          await page.setViewportSize({ width, height });
          await page.goto(path);
          await scrollThrough(page);
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(results.violations).toEqual([]);
        });
      }

      test('has no horizontal overflow at 320px', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto(path);
        expect(await noOverflow(page)).toBe(true);
        await scrollThrough(page);
        expect(await noOverflow(page)).toBe(true);
      });

      test('keeps the page content inside the viewport at 200% root font size', async ({
        page,
      }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(path);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await page.waitForTimeout(300);
        const outside = await page.evaluate(() => {
          const width = document.documentElement.clientWidth;
          return Array.from(document.querySelectorAll('main *, footer *'))
            .filter((el) => el.getBoundingClientRect().right > width + 1)
            .map((el) => `${el.tagName}.${el.className}`);
        });
        expect(outside).toEqual([]);
      });

      test('has no horizontal overflow at 1440px with 200% text', async ({
        page,
      }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(path);
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
        await page.waitForTimeout(300);
        expect(await noOverflow(page)).toBe(true);
      });

      test('every reveal reaches full opacity after scrolling to the bottom', async ({
        page,
      }) => {
        await page.goto(path);
        const count = await page.locator('[data-reveal]').count();
        expect(count).toBeGreaterThan(0);
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight),
        );
        await page.waitForTimeout(2200);
        const hidden = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-reveal]'))
            .filter((el) => getComputedStyle(el).opacity !== '1')
            .map((el) => el.className || el.tagName),
        );
        expect(hidden).toEqual([]);
      });

      test('content is visible with JavaScript disabled', async ({
        browser,
      }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto(path);
        const hidden = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-reveal]'))
            .filter((el) => getComputedStyle(el).opacity !== '1')
            .map((el) => el.className),
        );
        expect(hidden).toEqual([]);
        await context.close();
      });
    });
  }
});

test.describe('/culture', () => {
  test('shows the six commitments with their verse references', async ({
    page,
  }) => {
    await page.goto('/culture');
    const values = page.locator('[data-culture-value]');
    await expect(values).toHaveCount(6);
    const rows = await values.evaluateAll((els) =>
      els.map((el) => ({
        title: el.querySelector('h3')?.textContent?.trim(),
        verse: el.querySelector('[data-culture-verse]')?.textContent?.trim(),
      })),
    );
    expect(rows).toEqual([
      { title: 'Bold Preaching', verse: '2 Timothy 4:2' },
      { title: 'Passionate Worship', verse: 'Psalm 95:6' },
      { title: 'Purposeful Discipleship', verse: '1 Thess. 2:8' },
      { title: 'Fervent Prayer', verse: 'Romans 12:12' },
      { title: 'Courageous Evangelism', verse: 'John 20:21' },
      { title: 'Church Planting', verse: 'Acts 14:23' },
    ]);
    for (const row of rows) expect(row.verse).toMatch(/\d+:\d+/);
    await expect(page.locator('main')).toContainText(
      'We exist to glorify God through the fulfillment of the Great Commission.',
    );
  });
});

test.describe('/who-we-are', () => {
  test('shows the roster grouped by role, from the Sanity read layer', async ({
    page,
  }) => {
    await page.goto('/who-we-are');
    const main = page.locator('main');
    await expect(main.locator('[data-leader-group]').first()).toBeVisible();
    await expect(
      main.getByRole('heading', { level: 2, name: 'Pastor | Elders' }),
    ).toBeVisible();
    await expect(main).toContainText('Daniel Ortega');
    await expect(main).toContainText('Rachel Collins');
    expect(await main.locator('[data-leader]').count()).toBeGreaterThan(5);
  });

  test('has no photos or bios', async ({ page }) => {
    await page.goto('/who-we-are');
    await expect(page.locator('main img')).toHaveCount(0);
  });
});

test.describe('/crossway-kids', () => {
  test('lists the six age groups and links to child safety', async ({
    page,
  }) => {
    await page.goto('/crossway-kids');
    await expect(page.locator('[data-age-group]')).toHaveText([
      'Infants',
      'Walkers',
      '2’s–3’s',
      'Pre-K/Kinder',
      '1st–2nd Grade',
      '3rd–5th Grade',
    ]);
    await expect(
      page.getByRole('link', { name: 'What about Child Safety?' }),
    ).toHaveAttribute('href', '/child-safety');
  });
});

test.describe('prose pages', () => {
  test('what we believe lists the beliefs, each with scripture references', async ({
    page,
  }) => {
    await page.goto('/what-we-believe');
    const main = page.locator('main');
    await expect(
      main.getByRole('heading', { level: 2, name: 'Statement of Faith' }),
    ).toBeVisible();
    await expect(
      main.getByRole('heading', { level: 2, name: 'Teaching Statement' }),
    ).toBeVisible();
    await expect(main.locator('.verse-refs').first()).toHaveText(
      '2 Timothy 3:16-17; 2 Peter 1:20-21',
    );
    await expect(
      main.getByRole('link', { name: 'Divorce & Remarriage' }),
    ).toHaveAttribute(
      'href',
      '/documents/divorce-and-remarriage-statement.pdf',
    );
  });

  test('child safety links out to the report forms', async ({ page }) => {
    await page.goto('/child-safety');
    const main = page.locator('main');
    await expect(
      main.getByRole('link', { name: 'Allegation Report Form' }),
    ).toHaveAttribute(
      'href',
      'https://crosswaysa.churchcenter.com/people/forms/1087577',
    );
    await expect(
      main.getByRole('link', { name: 'Report to DFPS' }),
    ).toHaveAttribute(
      'href',
      'https://www.txabusehotline.org/Login/Default.aspx',
    );
  });

  test('stewardship links to giving', async ({ page }) => {
    await page.goto('/christian-stewardship');
    await expect(
      page.locator('main').getByRole('link', { name: 'Give Now' }),
    ).toHaveAttribute('href', 'https://pushpay.com/g/crosswaysa?src=hpp');
  });

  test('networks links to the four networks', async ({ page }) => {
    await page.goto('/networks');
    const hrefs = await page
      .locator('main ul a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual([
      'https://www.gccollective.org/',
      'https://www.sbts.edu/',
      'https://www.9marks.org/',
      'https://www.thegospelcoalition.org/',
    ]);
  });

  test('small groups links to Step 2: Consider', async ({ page }) => {
    await page.goto('/small-groups');
    await expect(
      page.locator('main').getByRole('link', { name: 'Step 2: Consider' }),
    ).toHaveAttribute(
      'href',
      'https://crosswaysa.churchcenter.com/registrations',
    );
  });
});

test.describe('navigation to the content pages', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const routes: [string, string, string][] = [
    ['About Us', 'Our Leadership', '/who-we-are'],
    ['About Us', 'Our Beliefs', '/what-we-believe'],
    ['About Us', 'Child Safety', '/child-safety'],
    ['About Us', 'Networks', '/networks'],
    ['Church Life', 'Small Groups', '/small-groups'],
    ['Church Life', 'Students', '/students'],
    ['Church Life', 'Kids', '/crossway-kids'],
    ['Church Life', 'Biblical Counseling', '/biblical-counseling'],
  ];

  for (const [group, label, href] of routes) {
    test(`${group} then ${label} opens ${href}`, async ({ page }) => {
      await page.goto('/');
      const header = page.getByRole('banner');
      await header.getByRole('button', { name: group }).click();
      await header.getByRole('link', { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('Culture opens /culture', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Culture' })
      .click();
    await expect(page).toHaveURL(/\/culture$/);
    await expect(page.locator('h1')).toHaveText('Culture');
  });
});
