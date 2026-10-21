import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };

test.describe('desktop header', () => {
  test.use({ viewport: desktop });

  test('has a Plan a Visit link to /visit', async ({ page }) => {
    await page.goto('/');
    const link = page
      .getByRole('banner')
      .getByRole('link', { name: 'Plan a Visit' });
    await expect(link).toHaveAttribute('href', '/visit');
  });

  test('top-level items are present in order', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link', { name: 'Connect' })).toHaveAttribute(
      'href',
      '/visit',
    );
    await expect(nav.getByRole('link', { name: 'Culture' })).toHaveAttribute(
      'href',
      '/culture',
    );
    await expect(nav.getByRole('link', { name: 'Events' })).toHaveAttribute(
      'href',
      '/events',
    );
    for (const name of ['About Us', 'Church Life', 'Resources']) {
      await expect(nav.getByRole('button', { name })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }
  });

  test('About Us opens with Enter, children are focusable, Escape returns focus', async ({
    page,
  }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'About Us' });
    const header = page.getByRole('banner');
    const beliefs = header.getByRole('link', { name: 'Our Beliefs' });
    await expect(beliefs).toBeHidden();

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(beliefs).toBeVisible();
    await expect(beliefs).toHaveAttribute('href', '/what-we-believe');

    await page.keyboard.press('Tab');
    await expect(
      header.getByRole('link', { name: 'Our Leadership' }),
    ).toBeFocused();
    await beliefs.focus();
    await expect(beliefs).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(beliefs).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('opening one dropdown closes another and outside click closes', async ({
    page,
  }) => {
    await page.goto('/');
    const about = page.getByRole('button', { name: 'About Us' });
    const life = page.getByRole('button', { name: 'Church Life' });
    await about.click();
    await life.click();
    await expect(about).toHaveAttribute('aria-expanded', 'false');
    await expect(life).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.click(10, 500);
    await expect(life).toHaveAttribute('aria-expanded', 'false');
  });

  test('tabbing out of an open dropdown closes it', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Resources' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('external links open in a new tab with warning text', async ({
    page,
  }) => {
    await page.goto('/');
    const give = page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /^Give/ });
    await expect(give).toHaveAttribute(
      'href',
      'https://pushpay.com/g/crosswaysa?src=hpp',
    );
    await expect(give).toHaveAttribute('target', '_blank');
    await expect(give).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(give).toContainText('(opens in a new tab)');

    await page.getByRole('button', { name: 'Resources' }).click();
    const live = page
      .getByRole('banner')
      .getByRole('link', { name: /^Sunday Live/ });
    await expect(live).toHaveAttribute('href', 'https://live.crosswaysa.org/');
    await expect(live).toHaveAttribute('target', '_blank');
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'About Us' }).click();
    const results = await new AxeBuilder({ page })
      .include('.site-header')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('the mobile menu is not rendered at desktop width', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  });
});

test.describe('breakpoint', () => {
  test('collapses below 1100px and fits at 1100px', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    const overflow = await page.evaluate(() => {
      const bar = document.querySelector('.site-header__bar') as HTMLElement;
      return bar.scrollWidth - bar.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);

    await page.setViewportSize({ width: 1099, height: 800 });
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  });
});

test.describe('mobile menu', () => {
  test.use({ viewport: mobile });

  test('opens, shows every top-level item, closes with Escape', async ({
    page,
  }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('html')).toHaveClass(/menu-open/);

    const panel = page.getByRole('navigation', { name: 'Mobile' });
    for (const name of ['Connect', 'Culture', 'Events']) {
      await expect(panel.getByRole('link', { name })).toBeVisible();
    }
    for (const name of ['About Us', 'Church Life', 'Resources']) {
      await expect(panel.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(panel.getByRole('link', { name: /^Give/ })).toBeVisible();
    await expect(
      panel.getByRole('link', { name: 'Plan a Visit' }),
    ).toHaveAttribute('href', '/visit');

    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(panel.getByRole('link', { name: 'Connect' })).toBeHidden();
    await expect(menu).toBeFocused();
    await expect(page.locator('html')).not.toHaveClass(/menu-open/);
  });

  test('menu links receive pointer events and navigate', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const culture = page
      .getByRole('navigation', { name: 'Mobile' })
      .getByRole('link', { name: 'Culture' });
    await expect(culture).toBeVisible();
    const hit = await culture.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
      );
    });
    expect(hit).toBe(true);
    await culture.click({ timeout: 3000 });
    await page.waitForURL('**/culture');
  });

  test('traps focus while open and releases the page afterwards', async ({
    page,
  }) => {
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.click();
    await expect(page.locator('main')).toHaveJSProperty('inert', true);
    await expect(page.locator('footer')).toHaveJSProperty('inert', true);

    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest('.site-header'),
      );
      expect(inside).toBe(true);
    }
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(
        () => !!document.activeElement?.closest('.site-header'),
      );
      expect(inside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('main')).toHaveJSProperty('inert', false);
    await expect(page.locator('footer')).toHaveJSProperty('inert', false);
  });

  test('has no axe violations closed or open', async ({ page }) => {
    await page.goto('/');
    let results = await new AxeBuilder({ page })
      .include('.site-header')
      .analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(
      page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', {
        name: 'Connect',
      }),
    ).toBeVisible();
    await expect(page.locator('#mobile-menu')).toHaveCSS('opacity', '1');
    results = await new AxeBuilder({ page }).include('.site-header').analyze();
    expect(results.violations).toEqual([]);
  });

  test('closes when the viewport grows to desktop width', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.setViewportSize(desktop);
    await expect(page.locator('main')).toHaveJSProperty('inert', false);
    await expect(page.locator('html')).not.toHaveClass(/menu-open/);
  });
});

test.describe('footer', () => {
  test.use({ viewport: desktop });

  test('shows times, address, links and the year', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Meeting Sundays 9:00 & 10:45a');
    await expect(footer).toContainText('San Antonio, TX 78232');
    await expect(
      footer.getByRole('link', { name: /15759 San Pedro Ave/ }),
    ).toHaveAttribute('href', 'https://maps.app.goo.gl/o7uWJUWy6KxYDraX7');
    await expect(
      footer.getByRole('link', { name: /^Church Center/ }),
    ).toHaveAttribute('href', 'https://crosswaysa.churchcenter.com/home');
    await expect(
      footer.getByRole('link', { name: /^Facebook/ }),
    ).toHaveAttribute('href', 'https://www.facebook.com/CrosswayBibleChurchSA');
    await expect(
      footer.getByRole('link', { name: /^Instagram/ }),
    ).toHaveAttribute(
      'href',
      'https://www.instagram.com/crosswaybiblechurchsa/',
    );
    await expect(
      footer.getByRole('link', { name: /^Watch Live/ }),
    ).toHaveAttribute('href', 'https://live.crosswaysa.org/');
    await expect(
      footer.getByRole('link', { name: 'Our Beliefs' }),
    ).toHaveAttribute('href', '/what-we-believe');
    await expect(
      footer.getByRole('link', { name: 'Biblical Counseling' }),
    ).toHaveAttribute('href', '/biblical-counseling');
    await expect(footer).toContainText(
      `© ${new Date().getFullYear()} Crossway Bible Church`,
    );
  });

  test('has no axe violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).include('footer').analyze();
    expect(results.violations).toEqual([]);
  });
});

test('skip link is first and focuses main without an outline', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const outline = await page
    .locator('main')
    .evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('none');
});

test.describe('without JavaScript', () => {
  test.use({ viewport: desktop, javaScriptEnabled: false });

  test('top-level links show, dropdown panels stay hidden, footer lists children', async ({
    page,
  }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Connect' })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Events' })).toBeVisible();
    await expect(
      header.getByRole('link', { name: 'Our Beliefs' }),
    ).toBeHidden();
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: 'Our Beliefs' }),
    ).toBeVisible();
  });
});
