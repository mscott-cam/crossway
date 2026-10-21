import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chromium,
  test,
  expect,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const SERMON =
  '/sermons/entrusted-with-resources-putting-money-in-its-place-2026-10-18';

const ROUTES = [
  '/',
  '/visit',
  '/events',
  '/entrusted',
  '/who-we-are',
  '/what-we-believe',
  '/culture',
  '/small-groups',
  '/students',
  '/crossway-kids',
  '/biblical-counseling',
  '/child-safety',
  '/networks',
  '/christian-stewardship',
  '/sermons',
  '/sermons/archive/1',
  '/sermons/archive/2',
  SERMON,
  '/series',
  '/series/entrusted',
  '/sermons/book/1-timothy',
  '/sermons/speaker/scott-graham',
];

const WIDTHS = [320, 390, 768, 1024, 1280, 1600];
const SHOTS = 'test-results/responsive';

const slugOf = (route: string) =>
  route === '/' ? 'home' : route.slice(1).replace(/\//g, '_');

async function revealLazyMedia(page: Page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    for (const img of images) img.loading = 'eager';
    await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
  });
}

async function headerGeometry(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const visible = (el: Element | null) =>
      Boolean(el) &&
      (el as HTMLElement).checkVisibility({ checkVisibilityCSS: true });
    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bar: box(document.querySelector('.site-header__bar')),
      logo: box(document.querySelector('.site-header__logo')),
      menu: visible(document.querySelector('.menu-button'))
        ? box(document.querySelector('.menu-button'))
        : null,
    };
  });
}

async function h1Spill(page: Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('main h1');
    if (!h1) return 0;
    const range = document.createRange();
    range.selectNodeContents(h1);
    const text = range.getBoundingClientRect();
    const box = h1.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    return Math.max(text.right - Math.min(box.right, viewport), 0);
  });
}

test.describe('every public route across widths', () => {
  test.use({ reducedMotion: 'reduce' });
  test.describe.configure({ mode: 'parallel' });
  test.setTimeout(90_000);

  mkdirSync(SHOTS, { recursive: true });

  for (const route of ROUTES) {
    test(`${route} holds together from 320 to 1600`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTHS[0], height: 800 });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);

      const problems: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(60);
        const at = `${route} @${width}`;

        const report = await page.evaluate(() => {
          const root = document.documentElement;
          const out: Record<string, unknown> = {
            overflow: root.scrollWidth - root.clientWidth,
          };

          const header = document.querySelector('[data-site-header]');
          out.headerVisible = Boolean(
            header &&
            (header as HTMLElement).checkVisibility({
              checkVisibilityCSS: true,
            }) &&
            header.getBoundingClientRect().height > 0,
          );

          const h1 = document.querySelector('main h1');
          if (h1) {
            const r = h1.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(h1);
            const text = range.getBoundingClientRect();
            const container =
              h1.closest('.container, .prose, [class*="container"]') ??
              h1.parentElement!;
            const c = container.getBoundingClientRect();
            const slack = 1;
            out.h1 = {
              insideViewport:
                r.left >= -slack && r.right <= root.clientWidth + slack,
              insideContainer:
                r.left >= c.left - slack && r.right <= c.right + slack,
              textInside:
                text.left >= r.left - slack && text.right <= r.right + slack,
              scrollClipped: h1.scrollWidth > h1.clientWidth + slack,
            };
          } else {
            out.h1 = null;
          }

          const bar = document.querySelector('.site-header__bar');
          const hits: string[] = [];
          if (bar) {
            const b = bar.getBoundingClientRect();
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
            );
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const text = node.textContent?.trim();
              const el = node.parentElement;
              if (!text || !el) continue;
              if (header?.contains(el) || el.closest('.skip-link')) continue;
              if (
                !el.checkVisibility({
                  checkOpacity: true,
                  checkVisibilityCSS: true,
                })
              )
                continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              for (const r of range.getClientRects()) {
                const w = Math.min(r.right, b.right) - Math.max(r.left, b.left);
                const h = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
                if (w > 1 && h > 1) hits.push(text.slice(0, 40));
              }
            }
          }
          out.hits = hits;
          return out as {
            overflow: number;
            headerVisible: boolean;
            h1: {
              insideViewport: boolean;
              insideContainer: boolean;
              textInside: boolean;
              scrollClipped: boolean;
            } | null;
            hits: string[];
          };
        });

        if (report.overflow > 0)
          problems.push(`${at}: horizontal overflow ${report.overflow}px`);
        if (!report.headerVisible) problems.push(`${at}: header not visible`);
        if (!report.h1) problems.push(`${at}: no h1`);
        else {
          if (!report.h1.insideViewport)
            problems.push(`${at}: h1 outside viewport`);
          if (!report.h1.insideContainer)
            problems.push(`${at}: h1 outside its container`);
          if (!report.h1.textInside || report.h1.scrollClipped)
            problems.push(`${at}: h1 text clipped`);
        }
        if (report.hits.length)
          problems.push(
            `${at}: text under the header pill: ${report.hits.join(' | ')}`,
          );

        await revealLazyMedia(page);
        await page.screenshot({
          path: `${SHOTS}/${slugOf(route)}-${width}.png`,
          fullPage: true,
        });
      }
      expect(problems).toEqual([]);
    });
  }
});

test.describe('enlarged text on phones', () => {
  test.use({ reducedMotion: 'reduce' });
  test.describe.configure({ mode: 'parallel' });

  for (const route of ['/', '/who-we-are']) {
    for (const width of [320, 390]) {
      for (const scale of [125, 150, 200]) {
        test(`${route} at ${width}px with ${scale}% text has no overflow and a whole header`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}%`;
          }, scale);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(250);

          expect(await h1Spill(page), 'h1 text spills').toBeLessThanOrEqual(1);
          const g = await headerGeometry(page);
          expect(g.scrollWidth, 'page scrollWidth').toBeLessThanOrEqual(
            g.viewport,
          );
          const bar = g.bar!;
          expect(bar.left).toBeGreaterThanOrEqual(0);
          expect(bar.right).toBeLessThanOrEqual(g.viewport);
          const logo = g.logo!;
          expect(logo.left).toBeGreaterThanOrEqual(bar.left);
          expect(logo.right).toBeLessThanOrEqual(bar.right);
          const menu = g.menu!;
          expect(menu, 'menu button visible').not.toBeNull();
          expect(menu.left).toBeGreaterThanOrEqual(bar.left);
          expect(menu.right).toBeLessThanOrEqual(bar.right);
          expect(menu.width).toBeGreaterThanOrEqual(44);
          expect(menu.height).toBeGreaterThanOrEqual(44);
          expect(menu.left).toBeGreaterThanOrEqual(logo.right);
        });
      }
    }
  }

  test('the mobile menu itself fits at 390px with 200% text', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/who-we-are', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await page.locator('.menu-button').click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    const g = await headerGeometry(page);
    expect(g.scrollWidth).toBeLessThanOrEqual(g.viewport);
  });
});

test.describe('enlarged text across every route', () => {
  test.use({ reducedMotion: 'reduce' });
  test.describe.configure({ mode: 'parallel' });

  for (const route of ROUTES) {
    test(`${route} never overflows sideways on a phone with enlarged text`, async ({
      page,
    }) => {
      const problems: string[] = [];
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        for (const scale of [125, 150, 200]) {
          await page.evaluate((size) => {
            document.documentElement.style.fontSize = `${size}%`;
          }, scale);
          await page.waitForTimeout(80);
          const g = await headerGeometry(page);
          if (g.scrollWidth > g.viewport)
            problems.push(
              `${width}px @${scale}%: scrollWidth ${g.scrollWidth}`,
            );
          if (g.bar && g.bar.right > g.viewport + 0.5)
            problems.push(`${width}px @${scale}%: header bar spills`);
          if ((await h1Spill(page)) > 1)
            problems.push(`${width}px @${scale}%: h1 text spills`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

test.describe('a larger default font size set in the browser itself', () => {
  test.setTimeout(60_000);

  async function launch(size: number): Promise<BrowserContext | null> {
    const dir = mkdtempSync(join(tmpdir(), 'cw-font-'));
    mkdirSync(join(dir, 'Default'));
    writeFileSync(
      join(dir, 'Default', 'Preferences'),
      JSON.stringify({
        webkit: {
          webprefs: {
            default_font_size: size,
            default_fixed_font_size: size - 3,
          },
        },
      }),
    );
    try {
      return await chromium.launchPersistentContext(dir, {
        channel: 'chrome',
        reducedMotion: 'reduce',
        viewport: { width: 390, height: 800 },
      });
    } catch {
      return null;
    }
  }

  for (const size of [24, 32]) {
    test(`${size}px default text keeps every page and the header inside a phone`, async ({
      baseURL,
    }) => {
      const context = await launch(size);
      test.skip(!context, 'Chrome is not installed');
      const page = context!.pages()[0] ?? (await context!.newPage());
      try {
        const problems: string[] = [];
        for (const width of [320, 390]) {
          await page.setViewportSize({ width, height: 800 });
          for (const route of ['/', '/visit', '/who-we-are', '/sermons']) {
            await page.goto(`${baseURL}${route}`);
            expect(
              await page.evaluate(
                () => getComputedStyle(document.documentElement).fontSize,
              ),
            ).toBe(`${size}px`);
            const g = await headerGeometry(page);
            if (g.scrollWidth > g.viewport)
              problems.push(`${route} @${width}: scrollWidth ${g.scrollWidth}`);
            if (g.bar && g.bar.right > g.viewport + 0.5)
              problems.push(`${route} @${width}: header bar spills`);
            if ((await h1Spill(page)) > 1)
              problems.push(`${route} @${width}: h1 text spills`);
          }
        }
        expect(problems).toEqual([]);
      } finally {
        await context!.close();
      }
    });
  }
});
