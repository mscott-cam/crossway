import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { colors } from '../../src/lib/tokens';

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

type FixtureSermon = {
  title: string;
  slug: string;
  date: string;
  book?: string;
  vimeoUrl?: string;
  speaker?: { slug: string; name: string };
  series: { slug: string; title: string };
  description?: string;
  passage?: string;
};

const sermons = (
  JSON.parse(
    readFileSync(
      join(process.cwd(), 'tests/fixtures/sanity/sermons.json'),
      'utf8',
    ),
  ) as FixtureSermon[]
).sort(
  (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
);

const newest = sermons[0];
const bySlug = (slug: string) => sermons.find((s) => s.slug === slug)!;
const noSpeaker = bySlug('gospel-repair-2026-05-31');
const noBook = bySlug('orchestrating-a-festive-crisis-2015-03-29');
const noMedia = bySlug('hope-in-the-waiting-2026-06-14');

const cards = (page: Page) => page.locator('[data-sermon-card]');
const cardHrefs = (page: Page) =>
  cards(page).evaluateAll((els) =>
    els.map((el) => el.querySelector('a')!.getAttribute('href')),
  );

test.describe('sermons landing', () => {
  test('latest message feature shows the newest sermon', async ({ page }) => {
    const response = await page.goto('/sermons');
    expect(response?.status()).toBe(200);
    const latest = page.getByRole('region', { name: 'Latest message' });
    await expect(latest.getByRole('heading', { level: 3 }).first()).toHaveText(
      newest.title,
    );
    await expect(
      latest.getByRole('link', { name: newest.title }),
    ).toHaveAttribute('href', `/sermons/${newest.slug}`);
    await expect(latest).toContainText(newest.passage!);
    await expect(latest).toContainText(newest.series.title);
    await expect(latest).toContainText('October 18, 2026');
  });

  test('series grid shows up to 8 series and links to all series', async ({
    page,
  }) => {
    await page.goto('/sermons');
    const region = page.getByRole('region', { name: 'Series', exact: true });
    const links = region.locator('[data-series-card] a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);
    await expect(links.first()).toHaveAttribute(
      'href',
      /^\/series\/[a-z0-9-]+$/,
    );
    await expect(
      region.getByRole('link', { name: /All series/ }),
    ).toHaveAttribute('href', '/series');
    await expect(region.locator('img[src=""]')).toHaveCount(0);
  });

  test('archive lists the 12 messages after the latest with a browse link', async ({
    page,
  }) => {
    await page.goto('/sermons');
    const hrefs = await cardHrefs(page);
    expect(hrefs).toEqual(
      sermons.slice(1, 13).map((s) => `/sermons/${s.slug}`),
    );
    await expect(
      page.getByRole('link', { name: /Browse all messages/ }),
    ).toHaveAttribute('href', '/sermons/archive/1');
  });

  test('has a filter form that posts to the filter route', async ({ page }) => {
    await page.goto('/sermons');
    const form = page.locator('form[action="/sermons/filter"]');
    await expect(form).toHaveAttribute('method', /get/i);
    await expect(form.getByLabel('Book')).toBeVisible();
    await expect(form.getByLabel('Speaker')).toBeVisible();
    await expect(form.getByRole('button', { name: 'Filter' })).toBeVisible();
    const books = await form
      .getByLabel('Book')
      .locator('option')
      .allTextContents();
    expect(books).toContain('1 Timothy');
    expect(books).not.toContain('Obadiah');
  });

  test('the podcast links are offered on the landing page too', async ({
    page,
  }) => {
    await page.goto('/sermons');
    await expect(
      page.getByRole('link', { name: /Apple Podcasts/ }),
    ).toHaveAttribute(
      'href',
      'https://podcasts.apple.com/us/podcast/crossway-bible-church-sermons/id1353947938',
    );
  });
});

test.describe('filtering without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('choosing 1 Timothy lands on its book page listing only 1 Timothy', async ({
    page,
  }) => {
    await page.goto('/sermons');
    const form = page.locator('form[action="/sermons/filter"]');
    await form.getByLabel('Book').selectOption({ label: '1 Timothy' });
    await form.getByRole('button', { name: 'Filter' }).click();
    await expect(page).toHaveURL(/\/sermons\/book\/1-timothy$/);
    const expected = sermons
      .filter((s) => s.book === '1 Timothy')
      .map((s) => `/sermons/${s.slug}`);
    expect(expected.length).toBeGreaterThan(0);
    expect(await cardHrefs(page)).toEqual(expected);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '1 Timothy',
    );
  });

  test('choosing a speaker lands on the speaker page', async ({ page }) => {
    await page.goto('/sermons');
    const form = page.locator('form[action="/sermons/filter"]');
    await form.getByLabel('Speaker').selectOption({ label: 'Josh Collins' });
    await form.getByRole('button', { name: 'Filter' }).click();
    await expect(page).toHaveURL(/\/sermons\/speaker\/josh-collins$/);
    const expected = sermons
      .filter((s) => s.speaker?.slug === 'josh-collins')
      .map((s) => `/sermons/${s.slug}`);
    expect(await cardHrefs(page)).toEqual(expected);
  });

  test('submitting with nothing chosen returns to /sermons', async ({
    page,
  }) => {
    await page.goto('/sermons');
    await page
      .locator('form[action="/sermons/filter"]')
      .getByRole('button', { name: 'Filter' })
      .click();
    await expect(page).toHaveURL(/\/sermons$/);
  });
});

test.describe('filter route', () => {
  const redirect = async (page: Page, query: string) => {
    const response = await page.request.get(`/sermons/filter${query}`, {
      maxRedirects: 0,
    });
    return {
      status: response.status(),
      location: response.headers()['location'],
    };
  };

  test('redirects a valid book with 303', async ({ page }) => {
    expect(await redirect(page, '?book=1-timothy')).toEqual({
      status: 303,
      location: '/sermons/book/1-timothy',
    });
  });

  test('redirects a valid speaker with 303', async ({ page }) => {
    expect(await redirect(page, '?speaker=josh-de-koning')).toEqual({
      status: 303,
      location: '/sermons/speaker/josh-de-koning',
    });
  });

  test('redirects a well-formed speaker slug even if it has no page yet', async ({
    page,
  }) => {
    expect(await redirect(page, '?speaker=nobody')).toEqual({
      status: 303,
      location: '/sermons/speaker/nobody',
    });
  });

  test('redirects a real book with no sermons to its (absent) page', async ({
    page,
  }) => {
    expect(await redirect(page, '?book=obadiah')).toEqual({
      status: 303,
      location: '/sermons/book/obadiah',
    });
  });

  test('lets the book win when both a book and a speaker are given', async ({
    page,
  }) => {
    expect(await redirect(page, '?book=john&speaker=josh-collins')).toEqual({
      status: 303,
      location: '/sermons/book/john',
    });
  });

  test('is cacheable at the edge', async ({ page }) => {
    const response = await page.request.get('/sermons/filter?book=john', {
      maxRedirects: 0,
    });
    expect(response.headers()['cache-control']).toBe('public, s-maxage=3600');
  });

  test('sends empty or invalid input to /sermons', async ({ page }) => {
    for (const query of [
      '',
      '?book=',
      '?speaker=',
      '?book=not-a-book',
      '?book=//evil.example',
      '?speaker=https://evil.example',
      '?speaker=//evil.example',
      '?book=../../etc/passwd',
      '?speaker=../../etc/passwd',
      '?speaker=Not%20A%20Slug',
      '?book=%0d%0aSet-Cookie:x=1',
      '?speaker=%0d%0aSet-Cookie:x=1',
    ]) {
      expect(await redirect(page, query), query).toEqual({
        status: 303,
        location: '/sermons',
      });
    }
  });
});

test.describe('sermon detail', () => {
  test('renders the sermon with media, meta, passage and description', async ({
    page,
  }) => {
    const response = await page.goto(`/sermons/${newest.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      newest.title,
    );
    const meta = page.locator('[data-sermon-meta]').first();
    await expect(meta).toContainText('Josh de Koning');
    await expect(meta).toContainText('October 18, 2026');
    await expect(page.locator('[data-sermon-passage]')).toHaveText(
      newest.passage!,
    );
    await expect(page.getByText(newest.description!)).toBeVisible();
    await expect(page.locator('[data-sermon-media]')).toHaveCount(1);
  });

  test('lists up to 3 other sermons from the same series, newest first', async ({
    page,
  }) => {
    const sermon = bySlug('faith-that-works-2026-08-16');
    await page.goto(`/sermons/${sermon.slug}`);
    const region = page.getByRole('region', { name: 'More from this series' });
    const expected = sermons
      .filter((s) => s.series.slug === sermon.series.slug && s !== sermon)
      .slice(0, 3)
      .map((s) => `/sermons/${s.slug}`);
    expect(expected).toHaveLength(3);
    const hrefs = await region
      .locator('[data-sermon-card] a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual(expected);
  });

  test('omits More from this series for a single-sermon series', async ({
    page,
  }) => {
    const lone = bySlug('one-word-from-the-lord-2023-05-07');
    expect(
      sermons.filter((s) => s.series.slug === lone.series.slug),
    ).toHaveLength(1);
    await page.goto(`/sermons/${lone.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      lone.title,
    );
    await expect(
      page.getByRole('region', { name: 'More from this series' }),
    ).toHaveCount(0);
    await expect(page.getByText('More from this series')).toHaveCount(0);
  });

  test('offers Apple Podcasts and Spreaker', async ({ page }) => {
    await page.goto(`/sermons/${newest.slug}`);
    await expect(
      page.getByRole('link', { name: /Apple Podcasts/ }),
    ).toHaveAttribute(
      'href',
      'https://podcasts.apple.com/us/podcast/crossway-bible-church-sermons/id1353947938',
    );
    await expect(page.getByRole('link', { name: /Spreaker/ })).toHaveAttribute(
      'href',
      'https://www.spreaker.com/show/2817602',
    );
    await expect(page.getByText(/Listen on your favorite app/i)).toBeVisible();
  });

  test('a sermon without a speaker renders cleanly', async ({ page }) => {
    await page.goto(`/sermons/${noSpeaker.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      noSpeaker.title,
    );
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/undefined|null|NaN/);
    const meta = (
      await page.locator('[data-sermon-meta]').first().innerText()
    ).trim();
    expect(meta).toContain('May 31, 2026');
    expect(meta).not.toMatch(/^·|·\s*·|·$/);
  });

  test('a sermon without a book renders cleanly', async ({ page }) => {
    await page.goto(`/sermons/${noBook.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      noBook.title,
    );
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/undefined|null|NaN/);
    await expect(page.locator('[data-sermon-passage]')).toHaveCount(0);
    const meta = (
      await page.locator('[data-sermon-meta]').first().innerText()
    ).trim();
    expect(meta).not.toMatch(/^·|·\s*·|·$/);
  });

  test('a sermon with no video and no audio renders no media area', async ({
    page,
  }) => {
    await page.goto(`/sermons/${noMedia.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      noMedia.title,
    );
    await expect(page.locator('[data-sermon-media]')).toHaveCount(0);
    await expect(page.locator('.vimeo-facade')).toHaveCount(0);
    await expect(page.locator('audio')).toHaveCount(0);
  });

  test('unknown slugs are 404', async ({ page }) => {
    const response = await page.goto('/sermons/not-a-real-sermon-2020-01-01');
    expect(response?.status()).toBe(404);
  });

  test('has a title and description tailored to the sermon, with share meta', async ({
    page,
  }) => {
    await page.goto(`/sermons/${newest.slug}`);
    await expect(page).toHaveTitle(
      `${newest.title} – Josh de Koning, October 18, 2026 | Crossway Bible Church`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      newest.description!,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Entrusted With Resources/,
    );
    await page.goto(`/sermons/${noMedia.slug}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Stand Alone Messages · June 14, 2026',
    );
  });
});

test.describe('series pages', () => {
  test('/series lists every series', async ({ page }) => {
    const response = await page.goto('/series');
    expect(response?.status()).toBe(200);
    const slugs = [...new Set(sermons.map((s) => s.series.slug))];
    const hrefs = await page
      .locator('[data-series-card] a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect([...hrefs].sort()).toEqual(slugs.map((s) => `/series/${s}`).sort());
  });

  test('a series page lists only that series, newest first', async ({
    page,
  }) => {
    const slug = 'the-gospel-of-john';
    const response = await page.goto(`/series/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'The Gospel of John',
    );
    await expect(
      page.getByText('Seeing Jesus through John’s eyes.'),
    ).toBeVisible();
    const expected = sermons
      .filter((s) => s.series.slug === slug)
      .map((s) => `/sermons/${s.slug}`);
    expect(await cardHrefs(page)).toEqual(expected);
  });

  test('the standalone series reads sensibly', async ({ page }) => {
    await page.goto('/series/stand-alone-messages');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Stand Alone Messages',
    );
    await expect(
      page.getByText('Messages that stand on their own'),
    ).toBeVisible();
    const count = sermons.filter(
      (s) => s.series.slug === 'stand-alone-messages',
    ).length;
    expect(await cards(page).count()).toBe(Math.min(count, 24));
  });

  test('series without artwork get a typographic card with no broken image', async ({
    page,
  }) => {
    await page.goto('/series');
    const card = page
      .locator('[data-series-card]')
      .filter({ hasNot: page.locator('img') })
      .first();
    await expect(card.locator('img')).toHaveCount(0);
    const title = card.getByRole('heading', { level: 2 });
    await expect(title).toBeVisible();
    await expect(card.locator('.series-card__type')).toHaveCSS(
      'background-color',
      rgb(colors.navy),
    );
    await expect(title).toHaveCSS('color', rgb(colors.paper));
    expect(
      await title.evaluate((el) => getComputedStyle(el).fontFamily),
    ).toMatch(/Caslon/);
  });

  test('a series with artwork renders an image with dimensions and alt', async ({
    page,
  }) => {
    await page.goto('/series');
    const card = page.locator('[data-series-card]').filter({
      has: page.getByRole('heading', { name: 'Walking With Wisdom' }),
    });
    const img = card.locator('img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', '/dev/poster.svg');
    await expect(img).toHaveAttribute('width', '1280');
    await expect(img).toHaveAttribute('height', '720');
    await expect(img).toHaveAttribute(
      'alt',
      'Walking With Wisdom series artwork',
    );
    await expect(img).toHaveAttribute('loading', 'lazy');
    expect(
      await page
        .locator('[data-series-card] img')
        .evaluateAll((els) => els.filter((el) => !el.getAttribute('src'))),
    ).toEqual([]);
    expect(
      await img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
  });

  test('the artwork series page shows its artwork', async ({ page }) => {
    await page.goto('/series/walking-with-wisdom');
    const img = page.locator('img.series-art');
    await expect(img).toHaveAttribute(
      'alt',
      'Walking With Wisdom series artwork',
    );
    await expect(img).toHaveAttribute('width', '1280');
    expect(await cardHrefs(page)).toHaveLength(2);
  });

  test('unknown series are 404', async ({ page }) => {
    const response = await page.goto('/series/not-a-series');
    expect(response?.status()).toBe(404);
  });
});

test.describe('archive, book and speaker pagination', () => {
  test('archive page 1 shows 24 with real pagination links', async ({
    page,
  }) => {
    const response = await page.goto('/sermons/archive/1');
    expect(response?.status()).toBe(200);
    expect(await cards(page).count()).toBe(24);
    expect(await cardHrefs(page)).toEqual(
      sermons.slice(0, 24).map((s) => `/sermons/${s.slug}`),
    );
    const nav = page.getByRole('navigation', { name: 'Pagination' });
    await expect(nav.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/sermons/archive/2',
    );
    await expect(nav.getByRole('link', { name: 'Previous' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'href',
      '/sermons/archive/2',
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveText(/Page 1/);
  });

  test('archive page 2 holds the rest and links back', async ({ page }) => {
    const response = await page.goto('/sermons/archive/2');
    expect(response?.status()).toBe(200);
    expect(await cardHrefs(page)).toEqual(
      sermons.slice(24).map((s) => `/sermons/${s.slug}`),
    );
    const nav = page.getByRole('navigation', { name: 'Pagination' });
    await expect(nav.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/sermons/archive/1',
    );
    await expect(nav.getByRole('link', { name: 'Next' })).toHaveCount(0);
  });

  test('following Next works as a plain link', async ({ page }) => {
    await page.goto('/sermons/archive/1');
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/\/sermons\/archive\/2$/);
  });

  test('page 3 of the archive does not exist', async ({ page }) => {
    const response = await page.goto('/sermons/archive/3');
    expect(response?.status()).toBe(404);
  });

  test('short lists have no pagination nav', async ({ page }) => {
    await page.goto('/sermons/book/john');
    await expect(
      page.getByRole('navigation', { name: 'Pagination' }),
    ).toHaveCount(0);
    expect(await cards(page).count()).toBe(
      sermons.filter((s) => s.book === 'John').length,
    );
    const second = await page.goto('/sermons/book/john/2');
    expect(second?.status()).toBe(404);
  });

  test('only books and speakers with sermons have pages', async ({ page }) => {
    expect((await page.goto('/sermons/book/obadiah'))?.status()).toBe(404);
    expect((await page.goto('/sermons/speaker/nobody'))?.status()).toBe(404);
    expect((await page.goto('/sermons/book/1-timothy'))?.status()).toBe(200);
  });

  test('speaker pages exclude sermons without a speaker', async ({ page }) => {
    await page.goto('/sermons/speaker/josh-de-koning');
    const hrefs = await cardHrefs(page);
    expect(hrefs).not.toContain(`/sermons/${noSpeaker.slug}`);
    expect(hrefs).toEqual(
      sermons
        .filter((s) => s.speaker?.slug === 'josh-de-koning')
        .slice(0, 24)
        .map((s) => `/sermons/${s.slug}`),
    );
  });

  test('a card without a speaker or book shows no stray separators', async ({
    page,
  }) => {
    await page.goto('/sermons/archive/2');
    const text = await page.locator('main').innerText();
    expect(text).not.toMatch(/undefined|null|NaN/);
    for (const meta of await page
      .locator('[data-sermon-meta]')
      .allInnerTexts()) {
      expect(meta.trim()).not.toMatch(/^·|·\s*·|·$/);
    }
  });
});

test.describe('titles and accessibility', () => {
  const urls = [
    '/sermons',
    `/sermons/${newest.slug}`,
    `/sermons/${noMedia.slug}`,
    `/sermons/${noSpeaker.slug}`,
    '/series',
    '/series/the-gospel-of-john',
    '/series/stand-alone-messages',
    '/sermons/archive/1',
    '/sermons/archive/2',
    '/sermons/book/1-timothy',
    '/sermons/book/john',
    '/sermons/speaker/josh-de-koning',
    '/sermons/speaker/josh-collins',
  ];

  test('every page has a unique title and description', async ({ page }) => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const url of urls) {
      await page.goto(url);
      const title = await page.title();
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute('content');
      expect(title.length, url).toBeGreaterThan(0);
      expect(description?.length, url).toBeGreaterThan(0);
      expect(titles.has(title), `${url}: ${title}`).toBe(false);
      expect(descriptions.has(description!), `${url}: ${description}`).toBe(
        false,
      );
      titles.add(title);
      descriptions.add(description!);
    }
  });

  for (const url of [
    '/sermons',
    `/sermons/${newest.slug}`,
    `/sermons/${noMedia.slug}`,
    '/series',
    '/series/the-gospel-of-john',
    '/sermons/archive/1',
    '/sermons/book/john',
  ]) {
    test(`axe passes on ${url}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('load');
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('there is no horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const url of [
      '/sermons',
      `/sermons/${newest.slug}`,
      '/series',
      '/sermons/archive/1',
    ]) {
      await page.goto(url);
      await page.waitForLoadState('load');
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('motion', () => {
  for (const url of [
    '/sermons',
    `/sermons/${newest.slug}`,
    '/sermons/archive/1',
    '/series/the-gospel-of-john',
  ]) {
    test(`every reveal on ${url} reaches full opacity after scrolling to the bottom`, async ({
      page,
    }) => {
      await page.goto(url);
      await page.waitForLoadState('load');
      expect(await page.locator('[data-reveal]').count()).toBeGreaterThan(0);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect
        .poll(
          () =>
            page.$$eval('[data-reveal]', (els) =>
              els.map((el) => getComputedStyle(el).opacity),
            ),
          { timeout: 5000 },
        )
        .toEqual(Array(await page.locator('[data-reveal]').count()).fill('1'));
    });
  }

  test('only calm fade reveals are used', async ({ page }) => {
    for (const url of ['/sermons', `/sermons/${newest.slug}`]) {
      await page.goto(url);
      const kinds = await page.$$eval('[data-reveal]', (els) => [
        ...new Set(els.map((el) => el.getAttribute('data-reveal'))),
      ]);
      expect(kinds).toEqual(['fade']);
    }
  });
});

test.describe('largest contentful paint', () => {
  test('the latest message media is not revealed or lazy-gated', async ({
    page,
  }) => {
    await page.goto('/sermons');
    const media = page.locator('.feature__media');
    await expect(media).toHaveCount(1);
    expect(
      await media.evaluate((el) => el.closest('[data-reveal]') !== null),
    ).toBe(false);
    expect(
      await page
        .locator('.feature__media [data-sermon-media]')
        .evaluate((el) => el.closest('[data-reveal]') !== null),
    ).toBe(false);
    await expect(page.locator('.feature__media')).toHaveCSS('opacity', '1');
  });

  test('the detail media is not inside a reveal', async ({ page }) => {
    await page.goto(`/sermons/${newest.slug}`);
    expect(
      await page
        .locator('[data-sermon-media]')
        .evaluate((el) => el.closest('[data-reveal]') !== null),
    ).toBe(false);
  });
});

test.describe('long unbroken titles', () => {
  const long = sermons.find((s) => !s.title.includes(' '))!;

  test('the fixture has an unbroken word over 60 characters', () => {
    expect(long.title.length).toBeGreaterThan(60);
  });

  for (const url of [
    '/sermons/archive/2',
    `/sermons/${long.slug}`,
    '/series/stand-alone-messages',
    '/sermons/book/proverbs',
    '/sermons/speaker/josh-collins',
  ]) {
    test(`${url} has no horizontal overflow at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(url);
      await page.waitForLoadState('load');
      await expect(
        page.getByText(long.title, { exact: true }).first(),
      ).toBeAttached();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
