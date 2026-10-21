import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('hero video', () => {
  test('poster image has explicit dimensions and is decorative', async ({
    page,
  }) => {
    await page.goto('/dev/hero');
    const img = page.locator('[data-hero-video] picture img');
    await expect(img).toHaveAttribute('width', /^\d+$/);
    await expect(img).toHaveAttribute('height', /^\d+$/);
    await expect(img).toHaveAttribute('alt', '');
    await expect(page.locator('[data-hero-video] video')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('plays within 3 seconds by default', async ({ page }) => {
    await page.goto('/dev/hero');
    const video = page.locator('[data-hero-video] video');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused), {
        timeout: 3000,
      })
      .toBe(false);
    await expect(page.locator('[data-hero-video]')).toHaveClass(/is-playing/);
    await expect(video).toHaveCSS('opacity', '1');
  });

  test('pauses when the tab is hidden and resumes when visible', async ({
    page,
  }) => {
    await page.goto('/dev/hero');
    const video = page.locator('[data-hero-video] video');
    const paused = () => video.evaluate((v: HTMLVideoElement) => v.paused);
    await expect.poll(paused, { timeout: 3000 }).toBe(false);
    const setVisibility = (state: 'hidden' | 'visible') =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => s,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await setVisibility('hidden');
    await expect.poll(paused).toBe(true);
    await setVisibility('visible');
    await expect.poll(paused).toBe(false);
  });

  test.describe('phone viewport', () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test('uses the 720 sources', async ({ page }) => {
      await page.goto('/dev/hero');
      const sources = page.locator('[data-hero-video] video source');
      await expect(sources).toHaveCount(2);
      for (const src of await sources.evaluateAll((els) =>
        els.map((el) => el.getAttribute('src')),
      ))
        expect(src).toContain('lobby-720');
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('video has no sources and never plays', async ({ page }) => {
      await page.goto('/dev/hero');
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
      const video = page.locator('[data-hero-video] video');
      await expect(video.locator('source')).toHaveCount(0);
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
        true,
      );
      await expect(page.locator('[data-hero-video] picture img')).toBeVisible();
    });
  });

  test.describe('data saver', () => {
    test('video has no sources and never plays', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'connection', {
          configurable: true,
          value: { saveData: true },
        });
      });
      await page.goto('/dev/hero');
      await page.waitForLoadState('load');
      await page.waitForTimeout(500);
      const video = page.locator('[data-hero-video] video');
      await expect(video.locator('source')).toHaveCount(0);
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(
        true,
      );
    });
  });
});

const videoPaused = (page: Page) =>
  page
    .locator('[data-hero-video] video')
    .evaluate((v: HTMLVideoElement) => v.paused);

const pauseButton = (page: Page) =>
  page.getByRole('button', { name: /background video$/ });

test.describe('hero video pause control', () => {
  test('appears once playback starts and toggles the video', async ({
    page,
  }) => {
    await page.goto('/');
    await expect.poll(() => videoPaused(page), { timeout: 3000 }).toBe(false);
    const button = pauseButton(page);
    await expect(button).toHaveAccessibleName('Pause background video');
    await expect(button).not.toHaveAttribute('aria-pressed');
    await button.click();
    await expect.poll(() => videoPaused(page)).toBe(true);
    await expect(button).toHaveAccessibleName('Play background video');
    await button.click();
    await expect.poll(() => videoPaused(page)).toBe(false);
    await expect(button).toHaveAccessibleName('Pause background video');
  });

  test('is at least 44px square with a visible focus ring', async ({
    page,
  }) => {
    await page.goto('/');
    const button = pauseButton(page);
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Tab');
    await button.focus();
    await expect(button).toBeFocused();
    const outline = await button.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style).not.toBe('none');
    expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
  });

  test('works from the keyboard', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => videoPaused(page), { timeout: 3000 }).toBe(false);
    const button = pauseButton(page);
    await button.focus();
    await page.keyboard.press('Space');
    await expect.poll(() => videoPaused(page)).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => videoPaused(page)).toBe(false);
  });

  test('the choice survives a reload within the session', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => videoPaused(page), { timeout: 3000 }).toBe(false);
    await pauseButton(page).click();
    await expect.poll(() => videoPaused(page)).toBe(true);
    await page.reload();
    await expect(pauseButton(page)).toHaveAccessibleName(
      'Play background video',
    );
    await page.waitForTimeout(800);
    expect(await videoPaused(page)).toBe(true);
    await expect(page.locator('[data-hero-video] picture img')).toBeVisible();
    await pauseButton(page).click();
    await expect.poll(() => videoPaused(page), { timeout: 3000 }).toBe(false);
    await page.reload();
    await expect.poll(() => videoPaused(page), { timeout: 3000 }).toBe(false);
    await expect(pauseButton(page)).toHaveAccessibleName(
      'Pause background video',
    );
  });

  test('a hidden tab does not resume a video the visitor paused', async ({
    page,
  }) => {
    await page.goto('/');
    await expect.poll(() => videoPaused(page), { timeout: 3000 }).toBe(false);
    await pauseButton(page).click();
    await expect.poll(() => videoPaused(page)).toBe(true);
    const setVisibility = (state: 'hidden' | 'visible') =>
      page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => s,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await setVisibility('hidden');
    await setVisibility('visible');
    await page.waitForTimeout(400);
    expect(await videoPaused(page)).toBe(true);
    await pauseButton(page).click();
    await expect.poll(() => videoPaused(page)).toBe(false);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('there is no control', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('load');
      await page.waitForTimeout(600);
      await expect(pauseButton(page)).toHaveCount(0);
    });
  });

  test('there is no control under data saver', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { saveData: true },
      });
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(600);
    await expect(pauseButton(page)).toHaveCount(0);
  });

  test('passes axe with the control showing', async ({ page }) => {
    await page.goto('/');
    await expect(pauseButton(page)).toBeVisible();
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  for (const [width, height, scale] of [
    [1440, 900, 100],
    [1024, 800, 100],
    [768, 900, 100],
    [390, 844, 100],
    [1440, 900, 200],
  ] as const) {
    test(`stays clear of the headline, verse and Sunday card at ${width}px${scale === 100 ? '' : ` with ${scale}% text`}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(pauseButton(page)).toBeVisible();
      if (scale !== 100) {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}%`;
        }, scale);
      }
      await page.waitForTimeout(2800);
      const boxes = await page.evaluate(() => {
        const rect = (el: Element | null) => {
          const r = el!.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const button = document.querySelector(
          '[data-hero] button[aria-label$="background video"]',
        );
        return {
          button: rect(button),
          hero: rect(document.querySelector('[data-hero]')),
          others: {
            h1: rect(document.querySelector('[data-hero] h1')),
            eyebrow: rect(document.querySelector('[data-hero] .eyebrow')),
            verse: rect(document.querySelector('.hero__verse')),
            card: rect(document.querySelector('[data-sunday-card]')),
          },
        };
      });
      const intersects = (
        a: { x: number; y: number; w: number; h: number },
        b: { x: number; y: number; w: number; h: number },
      ) =>
        a.x < b.x + b.w &&
        b.x < a.x + a.w &&
        a.y < b.y + b.h &&
        b.y < a.y + a.h;
      for (const [name, box] of Object.entries(boxes.others))
        expect(intersects(boxes.button, box), name).toBe(false);
      expect(boxes.button.x).toBeGreaterThanOrEqual(0);
      expect(boxes.button.x + boxes.button.w).toBeLessThanOrEqual(width);
      expect(boxes.button.y).toBeGreaterThanOrEqual(boxes.hero.y);
      expect(boxes.button.y + boxes.button.h).toBeLessThanOrEqual(
        boxes.hero.y + boxes.hero.h,
      );
      expect(boxes.button.x).toBeLessThan(width / 2);
    });
  }
});
