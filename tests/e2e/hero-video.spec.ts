import { test, expect } from '@playwright/test';

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
