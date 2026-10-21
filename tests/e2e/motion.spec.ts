import { test, expect, type Page } from '@playwright/test';

const reveal = '[data-reveal]';

async function revealStates(page: Page) {
  return page.$$eval(reveal, (els) =>
    els.map((el) => {
      const style = getComputedStyle(el);
      return { opacity: style.opacity, transform: style.transform };
    }),
  );
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every reveal target shows its final state with no movement', async ({
    page,
  }) => {
    await page.goto('/dev/motion');
    await page.waitForLoadState('load');
    const states = await revealStates(page);
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      expect(state.opacity).toBe('1');
      expect(state.transform).toBe('none');
    }
    await expect(page.locator('html')).toHaveClass(/reduced/);
    expect(
      await page.$$eval('[data-draw]', (els) =>
        els.map((el) => getComputedStyle(el).clipPath),
      ),
    ).not.toHaveLength(0);
    for (const clip of await page.$$eval('[data-draw]', (els) =>
      els.map((el) => getComputedStyle(el).clipPath),
    ))
      expect(clip).toBe('none');
    for (const transform of await page.$$eval('[data-parallax]', (els) =>
      els.map((el) => getComputedStyle(el).transform),
    ))
      expect(transform).toBe('none');
  });
});

test.describe('javascript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('every reveal target is visible', async ({ page }) => {
    await page.goto('/dev/motion');
    const states = await revealStates(page);
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) expect(state.opacity).toBe('1');
  });
});

test.describe('motion allowed', () => {
  test('the last reveal is visible after scrolling it into view', async ({
    page,
  }) => {
    await page.goto('/dev/motion');
    const last = page.locator(reveal).last();
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    await expect(last).toHaveCSS('opacity', '1');
  });

  test('every reveal settles at opacity 1 after scrolling through the page', async ({
    page,
  }) => {
    await page.goto('/dev/motion');
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y <= height; y += 400) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(2500);
    const states = await revealStates(page);
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) {
      expect(state.opacity).toBe('1');
      expect(state.transform).toBe('none');
    }
  });

  test('a first-viewport reveal fades through partial opacity instead of popping in', async ({
    page,
  }) => {
    await page.goto('/dev/motion');
    const opacities = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const el = document.querySelector('[data-reveal="fade"]')!;
          const seen: number[] = [];
          const end = performance.now() + 1500;
          const sample = () => {
            seen.push(Number(getComputedStyle(el).opacity));
            if (performance.now() < end) requestAnimationFrame(sample);
            else resolve(seen);
          };
          sample();
        }),
    );
    expect(opacities.some((value) => value > 0.05 && value < 0.95)).toBe(true);
    expect(opacities.at(-1)).toBe(1);
  });

  test('a reveal below the fold stays hidden until scrolled to', async ({
    page,
  }) => {
    await page.goto('/dev/motion');
    await page.waitForTimeout(500);
    const last = page.locator(reveal).last();
    await expect(last).toHaveCSS('opacity', '0');
  });
});

const bundles = '**/_astro/**/*.js';

test.describe('script blocked', () => {
  test('every reveal and draw target is visible once the failsafe fires', async ({
    page,
  }) => {
    await page.route(bundles, (route) => route.abort());
    await page.goto('/dev/motion');
    await page.waitForTimeout(3500);
    const states = await revealStates(page);
    expect(states.length).toBeGreaterThan(0);
    for (const state of states) expect(state.opacity).toBe('1');
    const clips = await page.$$eval('[data-draw]', (els) =>
      els.map((el) => getComputedStyle(el).clipPath),
    );
    expect(clips.length).toBeGreaterThan(0);
    for (const clip of clips) expect(clip).toBe('none');
  });
});

test.describe('slow script', () => {
  test('first-viewport targets are hidden before the script runs and end visible', async ({
    page,
  }) => {
    await page.route(bundles, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto('/dev/motion', { waitUntil: 'commit' });
    const fade = page.locator('[data-reveal="fade"]').first();
    const heading = page.locator('h1[data-reveal="lines"]');
    await expect(fade).toHaveCSS('opacity', '0');
    await expect(heading).toHaveCSS('opacity', '0');
    await expect(fade).toHaveCSS('opacity', '1', { timeout: 8000 });
    await expect(heading).toHaveCSS('opacity', '1', { timeout: 8000 });
  });
});
