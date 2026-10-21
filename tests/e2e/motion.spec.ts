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

  test('a reveal below the fold stays hidden until scrolled to', async ({
    page,
  }) => {
    await page.goto('/dev/motion');
    await page.waitForTimeout(500);
    const last = page.locator(reveal).last();
    await expect(last).toHaveCSS('opacity', '0');
  });
});
