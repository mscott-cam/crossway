import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MAPS = 'https://maps.app.goo.gl/o7uWJUWy6KxYDraX7';
const LIVE = 'https://live.crosswaysa.org/';

const hero = (page: Page) => page.locator('[data-hero]');
const card = (page: Page) => page.locator('[data-sunday-card]');

async function noOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

async function settled(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.querySelector('[data-sunday-card]')!;
        const style = getComputedStyle(el);
        return style.opacity === '1' && style.transform === 'none';
      }),
    )
    .toBe(true);
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

test.describe('hero', () => {
  test('headline, eyebrow and verse', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    expect(
      (await page.locator('h1').evaluate((el) => el.textContent))
        ?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('You are loved.');
    await expect(hero(page)).toContainText(
      'Crossway Bible Church · San Antonio',
    );
    await expect(hero(page)).toContainText(
      'We love because he first loved us.',
    );
    await expect(hero(page).locator('.verse-cite')).toHaveText('1 John 4:19');
  });

  test('the verse citation uses the amber ink, never plain amber', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(hero(page).locator('.verse-cite')).toHaveCSS(
      'color',
      'rgb(143, 96, 0)',
    );
  });

  test('the hero video plays within 3 seconds of load and starts at the poster frame', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      document.addEventListener(
        'playing',
        (event) => {
          const w = window as unknown as { __firstPlaying?: number };
          w.__firstPlaying ??= (event.target as HTMLVideoElement).currentTime;
        },
        true,
      );
    });
    await page.goto('/');
    const video = page.locator('[data-hero-video] video');
    await expect
      .poll(
        () =>
          video.evaluate(
            (v: HTMLVideoElement) => !v.paused && v.currentTime > 0,
          ),
        { timeout: 3000 },
      )
      .toBe(true);
    await expect(page.locator('[data-hero-video]')).toHaveClass(/is-playing/);
    const first = await page.evaluate(
      () => (window as unknown as { __firstPlaying?: number }).__firstPlaying,
    );
    expect(first).toBeGreaterThanOrEqual(2.9);
  });

  test('the poster preload is in the head and the poster has no reveal', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.locator('head link[rel="preload"][as="image"]'),
    ).toHaveAttribute('href', '/video/lobby-poster.avif');
    await expect(
      page.locator('[data-hero-video] picture img'),
    ).not.toHaveAttribute('data-reveal', /.*/);
  });
});

test.describe('This Sunday card', () => {
  test('shows formatted times, the visit link and the settings rows', async ({
    page,
  }) => {
    await page.goto('/');
    const c = card(page);
    await expect(c).toContainText('This Sunday');
    await expect(c.locator('[data-sunday-times]')).toHaveText(
      '9:00 & 10:45 AM',
    );
    const visit = c.getByRole('link', { name: 'Plan your visit' });
    await expect(visit).toHaveAttribute('href', '/visit');

    await expect(c).toContainText('Kids & Students');
    await expect(c).toContainText('Both services');
    await expect(c).toContainText('Address');
    const address = c.getByRole('link', { name: /15759 San Pedro Ave/ });
    await expect(address).toHaveAttribute('href', MAPS);
    await expect(address).toHaveAttribute('target', '_blank');
    await expect(address).toHaveAttribute('rel', /noopener/);
    await expect(c).toContainText('Can’t make it?');
    const live = c.getByRole('link', { name: /Watch live/ });
    await expect(live).toHaveAttribute('href', LIVE);
    await expect(live).toHaveAttribute('target', '_blank');
    await expect(live).toContainText('opens in a new tab');
  });

  test('sits in the document before the mission band', async ({ page }) => {
    await page.goto('/');
    const order = await page.evaluate(() => {
      const c = document.querySelector('[data-sunday-card]')!;
      const m = document.querySelector('[data-mission]')!;
      return c.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order).toBeTruthy();
  });
});

test.describe('layout', () => {
  test('stacks below the hero at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await settled(page);
    const h = await hero(page).boundingBox();
    const c = await card(page).boundingBox();
    expect(c!.y).toBeGreaterThanOrEqual(h!.y + h!.height - 0.5);
    expect(await noOverflow(page)).toBe(true);
  });

  test('stacks below the hero at 1099px and overlaps at 1100px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto('/');
    await settled(page);
    let h = (await hero(page).boundingBox())!;
    let c = (await card(page).boundingBox())!;
    expect(c.y).toBeGreaterThanOrEqual(h.y + h.height - 0.5);
    await page.setViewportSize({ width: 1100, height: 900 });
    await settled(page);
    h = (await hero(page).boundingBox())!;
    c = (await card(page).boundingBox())!;
    expect(c.y).toBeLessThan(h.y + h.height);
  });

  test('overlaps the hero bottom edge by 64px at 1440px and stays in the viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await settled(page);
    const h = (await hero(page).boundingBox())!;
    const c = (await card(page).boundingBox())!;
    expect(c.y).toBeLessThan(h.y + h.height);
    expect(c.y + c.height - (h.y + h.height)).toBeCloseTo(64, 0);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(1440);
  });

  test('has no horizontal overflow at 320x640', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    expect(await noOverflow(page)).toBe(true);
    await scrollThrough(page);
    expect(await noOverflow(page)).toBe(true);
  });

  test('has no horizontal overflow at 1440 with a 200% root font size', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.waitForTimeout(200);
    expect(await noOverflow(page)).toBe(true);
  });

  test('has no horizontal overflow at 768px and 1024px', async ({ page }) => {
    for (const width of [768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      expect(await noOverflow(page)).toBe(true);
    }
  });
});

test.describe('header and announcement', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the header pill floats over the hero', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('[data-site-header]');
    await expect(header).toHaveCSS('position', 'absolute');
    const h = (await header.boundingBox())!;
    const hr = (await hero(page).boundingBox())!;
    expect(h.y).toBeGreaterThanOrEqual(hr.y - 0.5);
    expect(h.y + h.height).toBeLessThan(hr.y + hr.height);
  });

  test('nav links keep 4.5:1 contrast against the pill background', async ({
    page,
  }) => {
    await page.goto('/');
    const ratio = await page.evaluate(() => {
      const parse = (value: string) => {
        const nums = (value.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number);
        const scale = value.startsWith('color(') ? 255 : 1;
        const alpha = nums.length > 3 ? nums[3] : 1;
        return { rgb: nums.slice(0, 3).map((n) => n * scale), alpha };
      };
      const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = ([r, g, b]: number[]) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const link = document.querySelector('.primary-nav .nav-link')!;
      const bar = document.querySelector('.site-header__bar')!;
      const fg = parse(getComputedStyle(link).color).rgb;
      const bg = parse(getComputedStyle(bar).backgroundColor);
      const fl = lum(fg);
      return Math.min(
        ...[0, 255].map((base) => {
          const mixed = bg.rgb.map((c) => c * bg.alpha + base * (1 - bg.alpha));
          const bl = lum(mixed);
          return (Math.max(fl, bl) + 0.05) / (Math.min(fl, bl) + 0.05);
        }),
      );
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('there is no announcement bar by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-announcement]')).toHaveCount(0);
  });
});

test.describe('sections', () => {
  test('upcoming events: up to four in date order with a link to all events', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('[data-home-events]');
    const rows = section.locator('[data-event]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(4);
    const stamps = await rows
      .locator('time')
      .evaluateAll((els) => els.map((el) => el.getAttribute('datetime')!));
    expect([...stamps].sort()).toEqual(stamps);
    const all = section.getByRole('link', { name: /See all events/ });
    await expect(all).toHaveAttribute('href', '/events');
  });

  test('latest sermon: newest title linking to its page, plus all messages', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('[data-latest-sermon]');
    const link = section.getByRole('link', {
      name: 'Entrusted With Resources - Putting Money In its Place',
    });
    await expect(link).toHaveAttribute(
      'href',
      '/sermons/entrusted-with-resources-putting-money-in-its-place-2026-10-18',
    );
    await expect(section).toContainText('Josh de Koning');
    await expect(section).toContainText('1 Timothy 6:6–19');
    await expect(section).toContainText('October 18, 2026');
    await expect(
      section.getByRole('link', { name: /All messages/ }),
    ).toHaveAttribute('href', '/sermons');
  });

  test('connect, consider, commit steps link to the right places', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('[data-steps]');
    for (const text of [
      'Connect',
      'We want to meet you!',
      'Consider',
      'Learn more about us.',
      'Commit',
      'Join our church!',
    ])
      await expect(section).toContainText(text);
    await expect(
      section.getByRole('link', { name: /Let’s connect/ }),
    ).toHaveAttribute('href', '/visit');
    await expect(
      section.getByRole('link', { name: /Tell me more/ }),
    ).toHaveAttribute('href', '/culture');
    const ready = section.getByRole('link', { name: /I’m ready/ });
    await expect(ready).toHaveAttribute(
      'href',
      'https://crosswaysa.churchcenter.com/home',
    );
    await expect(ready).toHaveAttribute('target', '_blank');
  });

  test('mission band copy', async ({ page }) => {
    await page.goto('/');
    const band = page.locator('[data-mission]');
    await expect(band).toContainText('Why we gather');
    await expect(band).toContainText(
      'We exist to glorify God through the fulfillment of the Great Commission.',
    );
  });

  test('Entrusted feature shows by default and links to /entrusted', async ({
    page,
  }) => {
    await page.goto('/');
    const section = page.locator('[data-entrusted-feature]');
    await expect(section).toContainText('With much, for more.');
    await expect(
      section.getByRole('link', { name: /Learn about Entrusted/ }),
    ).toHaveAttribute('href', '/entrusted');
  });

  test('has exactly one questions form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#questions')).toHaveCount(1);
  });
});

test.describe('metadata', () => {
  test('has a title and description distinct from other pages', async ({
    page,
  }) => {
    await page.goto('/');
    const title = await page.title();
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    await page.goto('/sermons');
    expect(await page.title()).not.toBe(title);
    expect(
      await page.locator('meta[name="description"]').getAttribute('content'),
    ).not.toBe(description);
    expect(title).toContain('Crossway Bible Church');
    expect(description!.length).toBeGreaterThan(50);
  });
});

test.describe('motion', () => {
  test('every reveal reaches opacity 1 after scrolling to the bottom', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(2500);
    const states = await page.$$eval('[data-reveal]', (els) =>
      els.map((el) => ({
        name: el.tagName + '.' + el.className,
        opacity: getComputedStyle(el).opacity,
      })),
    );
    expect(states.length).toBeGreaterThan(5);
    for (const state of states)
      expect(state, state.name).toMatchObject({ opacity: '1' });
  });

  test('every reveal reaches opacity 1 after scrolling to the bottom on a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(2500);
    const opacities = await page.$$eval('[data-reveal]', (els) =>
      els.map((el) => getComputedStyle(el).opacity),
    );
    for (const opacity of opacities) expect(opacity).toBe('1');
  });

  test('with reduced motion everything is visible and the video stays still', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    for (const opacity of await page.$$eval('[data-reveal]', (els) =>
      els.map((el) => getComputedStyle(el).opacity),
    ))
      expect(opacity).toBe('1');
    expect(
      await page
        .locator('[data-hero-video] video')
        .evaluate((v: HTMLVideoElement) => v.paused),
    ).toBe(true);
    await context.close();
  });
});

test.describe('accessibility', () => {
  test('axe passes on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await scrollThrough(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('axe passes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await scrollThrough(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
