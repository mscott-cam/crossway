import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CALENDAR = 'https://crosswaysa.churchcenter.com/calendar?view=gallery';
const EXPECTED = [
  {
    id: '1009',
    name: 'Fall Prayer Retreat',
    date: 'Mon, Oct 19 – Wed, Oct 21',
  },
  { id: '1010', name: 'Community Care Day', date: 'Tue, Oct 20' },
  { id: '1001', name: 'Advanced Commitment Night', date: 'Sun, Oct 25' },
  { id: '1002', name: '1st Wednesday - Prayer & Praise', date: 'Wed, Nov 4' },
  { id: '1005', name: 'Fall Church Work Day', date: 'Sat, Nov 14' },
  { id: '1006', name: "Men's Retreat", date: 'Fri, Nov 20 – Sun, Nov 22' },
  { id: '1004', name: 'Step 2', date: 'Sun, Dec 13' },
  { id: '1003', name: 'Student Ministry-Christmas Party', date: 'Sun, Dec 13' },
  { id: '1007', name: "New Year's Eve Prayer Night", date: 'Thu, Dec 31' },
];

test.describe('events page', () => {
  test('lists the visible fixture events in date order', async ({ page }) => {
    const response = await page.goto('/events');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Events');
    const rows = page.locator('[data-event]');
    await expect(rows).toHaveCount(EXPECTED.length);
    for (const [i, expected] of EXPECTED.entries()) {
      const row = rows.nth(i);
      await expect(row.getByRole('heading', { level: 3 })).toContainText(
        expected.name,
      );
      await expect(row.locator('time')).toContainText(expected.date);
    }
  });

  test('leaves out hidden, link-only and past events and dedupes recurring ones', async ({
    page,
  }) => {
    await page.goto('/events');
    const content = page.locator('main');
    await expect(content).not.toContainText('Staff Planning Day');
    await expect(content).not.toContainText('Elders Retreat');
    await expect(content).not.toContainText('Fall Festival');
    await expect(
      content.getByText('1st Wednesday - Prayer & Praise'),
    ).toHaveCount(1);
  });

  test('every event links to its Church Center page in a new tab', async ({
    page,
  }) => {
    await page.goto('/events');
    for (const expected of EXPECTED) {
      const link = page.locator('[data-event]').getByRole('link', {
        name: new RegExp(expected.name.replace(/[()]/g, '')),
      });
      await expect(link).toHaveAttribute(
        'href',
        `https://crosswaysa.churchcenter.com/calendar/event/${expected.id}`,
      );
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toContainText('(opens in a new tab)');
    }
  });

  test('shows times in Chicago time and none for all-day events', async ({
    page,
  }) => {
    await page.goto('/events');
    const rows = page.locator('[data-event]');
    await expect(rows.nth(2).locator('time')).toContainText('7:00 – 8:30 PM');
    await expect(rows.nth(2)).toContainText('Main Campus');
    await expect(rows.nth(4).locator('time')).not.toContainText(/\d:\d\d/);
    await expect(rows.nth(5).locator('time')).toContainText('Starts 6:00 PM');
    await expect(rows.nth(8).locator('time')).toContainText(
      '10:00 PM – 12:30 AM',
    );
    await expect(rows.nth(2).locator('time')).toHaveAttribute(
      'datetime',
      '2026-10-26T00:00:00Z',
    );
  });

  test('keeps events that are in progress at the fixed now', async ({
    page,
  }) => {
    await page.goto('/events');
    const rows = page.locator('[data-event]');
    await expect(rows.nth(0)).toContainText('Fall Prayer Retreat');
    await expect(rows.nth(0).locator('time')).toContainText('Starts 6:00 PM');
    await expect(rows.nth(0).locator('time')).toHaveAttribute(
      'datetime',
      '2026-10-19T23:00:00Z',
    );
    await expect(rows.nth(1)).toContainText('Community Care Day');
    await expect(rows.nth(1).locator('time')).not.toContainText(/\d:\d\d/);
    await expect(rows.nth(1).locator('time')).toHaveAttribute(
      'datetime',
      '2026-10-20',
    );
  });

  test('omits the location line when there is none', async ({ page }) => {
    await page.goto('/events');
    await expect(
      page.locator('[data-event]').nth(6).locator('.event__where'),
    ).toHaveCount(0);
  });

  test('only the event with an image renders one, lazily with dimensions', async ({
    page,
  }) => {
    await page.goto('/events');
    const images = page.locator('[data-event] img');
    await expect(images).toHaveCount(1);
    await expect(images.first()).toHaveAttribute('loading', 'lazy');
    await expect(images.first()).toHaveAttribute('width', /\d+/);
    await expect(images.first()).toHaveAttribute('height', /\d+/);
    await images.first().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        images
          .first()
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
      )
      .toBe(true);
  });

  test('has a Registrations link near the top and a Church Center note', async ({
    page,
  }) => {
    await page.goto('/events');
    const registrations = page
      .getByRole('main')
      .getByRole('link', { name: /Registrations/ });
    await expect(registrations).toHaveAttribute(
      'href',
      'https://crosswaysa.churchcenter.com/registrations',
    );
    await expect(registrations).toHaveAttribute('target', '_blank');
    const firstEvent = page.locator('[data-event]').first();
    const registrationsBox = (await registrations.boundingBox())!;
    const eventBox = (await firstEvent.boundingBox())!;
    expect(registrationsBox.y).toBeLessThan(eventBox.y);

    const note = page.getByText('All events and sign-ups are managed on');
    await expect(note).toBeVisible();
    await expect(note).toContainText('managed on Church Center');
    await expect(
      note.getByRole('link', { name: /Church Center/ }),
    ).toHaveAttribute('href', 'https://crosswaysa.churchcenter.com/home');
  });

  test('does not show the empty-state link when there are events', async ({
    page,
  }) => {
    await page.goto('/events');
    await expect(
      page.getByText('See all upcoming events on Church Center'),
    ).toHaveCount(0);
    await expect(page.locator(`a[href="${CALENDAR}"]`)).toHaveCount(0);
  });

  test('has a unique title and description', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveTitle('Events | Crossway Bible Church');
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description?.length).toBeGreaterThan(40);
    await page.goto('/sermons');
    expect(
      await page.locator('meta[name="description"]').getAttribute('content'),
    ).not.toBe(description);
  });

  test('the nav Events link reaches the page', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Events' })
      .click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Events');
  });

  test('axe passes', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('load');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('has no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/events');
    await page.waitForLoadState('load');
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('every reveal reaches full opacity after scrolling to the bottom', async ({
    page,
  }) => {
    await page.goto('/events');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() =>
        page
          .locator('[data-reveal]')
          .evaluateAll((els) =>
            els.every((el) => Number(getComputedStyle(el).opacity) === 1),
          ),
      )
      .toBe(true);
  });

  test('keeps the first rows free of reveals so nothing above the fold fades in', async ({
    page,
  }) => {
    await page.goto('/events');
    for (const i of [0, 1, 2]) {
      await expect(page.locator('[data-event]').nth(i)).not.toHaveAttribute(
        'data-reveal',
        /.*/,
      );
    }
  });
});
