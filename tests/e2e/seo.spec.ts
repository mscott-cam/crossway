import { expect, test, type APIRequestContext } from '@playwright/test';
import { parse } from 'node-html-parser';

import { site } from '../../src/lib/site';

const ORIGIN = 'https://crosswaysa.org';

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);
  const sitemaps = [
    ...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((m) => new URL(m[1]).pathname);
  expect(sitemaps.length).toBeGreaterThan(0);
  const paths: string[] = [];
  for (const sitemap of sitemaps) {
    const response = await request.get(sitemap);
    expect(response.status()).toBe(200);
    for (const m of (await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      expect(m[1].startsWith(`${ORIGIN}/`)).toBe(true);
      paths.push(new URL(m[1]).pathname);
    }
  }
  return paths;
}

function sample(paths: string[]): string[] {
  const matching = (re: RegExp) => paths.filter((p) => re.test(p));
  const sermons = matching(/^\/sermons\/(?!archive\/|book\/|speaker\/)[^/]+$/);
  const archive = matching(/^\/sermons\/archive\/\d+$/).slice(0, 2);
  const picks = [
    sermons[0],
    sermons[sermons.length - 1],
    matching(/^\/series\/[^/]+$/)[0],
    matching(/^\/sermons\/book\/[^/]+$/)[0],
    matching(/^\/sermons\/speaker\/[^/]+$/)[0],
    ...archive,
  ];
  const dynamic = new Set(
    paths.filter((p) =>
      /^\/(sermons\/(archive|book|speaker)\/|sermons\/[^/]+$|series\/[^/]+)/.test(
        p,
      ),
    ),
  );
  const fixed = paths.filter((p) => !dynamic.has(p));
  return [...new Set([...fixed, ...picks.filter(Boolean)])];
}

test('the sitemap lists the site, not fixtures or endpoints', async ({
  request,
}) => {
  const paths = await sitemapPaths(request);
  expect(paths).toEqual(expect.arrayContaining(['/', '/visit', '/events']));
  expect(paths.some((p) => /^\/(dev|api)(\/|$)/.test(p))).toBe(false);
  expect(paths.some((p) => p === '/sermons/filter')).toBe(false);
  expect(
    paths.filter((p) => p !== '/' && p.endsWith('/')),
    'no trailing slashes',
  ).toEqual([]);
});

test('robots.txt names the sitemap the build serves', async ({ request }) => {
  test.skip(
    !site.indexable,
    'the site is not indexable, so robots.txt names no sitemap',
  );
  const robots = await (await request.get('/robots.txt')).text();
  const name = robots.match(
    /^Sitemap: https:\/\/crosswaysa\.org\/(\S+)$/m,
  )?.[1];
  expect(name).toBe('sitemap-index.xml');
  expect((await request.get(`/${name}`)).status()).toBe(200);
});

test('every page has unique, well-formed metadata', async ({ request }) => {
  test.setTimeout(120_000);
  const paths = sample(await sitemapPaths(request));
  expect(paths.length).toBeGreaterThanOrEqual(18);

  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const problems: string[] = [];

  for (const path of paths) {
    const response = await request.get(path);
    if (response.status() !== 200) {
      problems.push(`${path}: status ${response.status()}`);
      continue;
    }
    const html = parse(await response.text());
    const meta = (selector: string) =>
      html.querySelector(selector)?.getAttribute('content')?.trim() ?? '';

    const title = html.querySelector('title')?.text.trim() ?? '';
    const description = meta('meta[name="description"]');
    const canonical =
      html.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '';
    const ogImage = meta('meta[property="og:image"]');
    const robots = meta('meta[name="robots"]');

    if (!title) problems.push(`${path}: empty title`);
    if (!description) problems.push(`${path}: empty description`);
    const sermonDetail =
      /^\/sermons\/(?!archive\/|book\/|speaker\/)[^/]+$/.test(path);
    const tooShort = !sermonDetail && description.length < 50;
    if (tooShort || description.length > 160) {
      problems.push(
        `${path}: description length ${description.length}: ${description}`,
      );
    }
    for (const [label, value] of [
      ['title', title],
      ['description', description],
      ['og:title', meta('meta[property="og:title"]')],
      ['og:description', meta('meta[property="og:description"]')],
    ] as const) {
      if (/undefined|\[object|null$/.test(value)) {
        problems.push(`${path}: bad ${label}: ${value}`);
      }
    }
    if (titles.has(title)) {
      problems.push(`${path}: title duplicates ${titles.get(title)}: ${title}`);
    }
    titles.set(title, path);
    if (!sermonDetail && descriptions.has(description)) {
      problems.push(
        `${path}: description duplicates ${descriptions.get(description)}`,
      );
    }
    if (!sermonDetail) descriptions.set(description, path);

    const expected = path === '/' ? `${ORIGIN}/` : `${ORIGIN}${path}`;
    if (canonical !== expected) {
      problems.push(`${path}: canonical ${canonical} !== ${expected}`);
    }
    if (!/^https:\/\/\S+$/.test(ogImage)) {
      problems.push(`${path}: og:image not absolute: ${ogImage}`);
    }
    if (meta('meta[name="twitter:card"]') !== 'summary_large_image') {
      problems.push(`${path}: twitter:card is not summary_large_image`);
    }
    const h1s = html.querySelectorAll('h1').length;
    if (h1s !== 1) problems.push(`${path}: ${h1s} h1 elements`);
    if (html.querySelector('html')?.getAttribute('lang') !== 'en') {
      problems.push(`${path}: html lang is not en`);
    }
    if (/noindex/i.test(robots) === site.indexable) {
      problems.push(
        `${path}: robots meta "${robots}" with indexable=${site.indexable}`,
      );
    }
    for (const script of html.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        JSON.parse(script.text);
      } catch {
        problems.push(`${path}: invalid JSON-LD`);
      }
    }
  }

  expect(problems).toEqual([]);
});

test('dev fixture pages are noindex', async ({ request }) => {
  for (const path of ['/dev/media', '/dev/hero', '/dev/motion']) {
    const html = parse(await (await request.get(path)).text());
    expect(
      html.querySelector('meta[name="robots"]')?.getAttribute('content'),
      path,
    ).toMatch(/noindex/);
  }
});

test('the head links the icons and manifest, and they resolve', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const hrefs = await page.evaluate(() => ({
    apple: document
      .querySelector('link[rel="apple-touch-icon"]')
      ?.getAttribute('href'),
    manifest: document
      .querySelector('link[rel="manifest"]')
      ?.getAttribute('href'),
    ogImage: document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content'),
    width: document
      .querySelector('meta[property="og:image:width"]')
      ?.getAttribute('content'),
    height: document
      .querySelector('meta[property="og:image:height"]')
      ?.getAttribute('content'),
    alt: document
      .querySelector('meta[property="og:image:alt"]')
      ?.getAttribute('content'),
  }));
  expect(hrefs.apple).toBe('/apple-touch-icon.png');
  expect(hrefs.manifest).toBe('/site.webmanifest');
  expect(hrefs.ogImage).toBe(`${ORIGIN}/og/default.jpg`);
  expect([hrefs.width, hrefs.height, hrefs.alt]).toEqual([
    '1200',
    '630',
    'Crossway Bible Church',
  ]);
  for (const href of [hrefs.apple, hrefs.manifest, '/og/default.jpg']) {
    expect((await request.get(href!)).status(), href!).toBe(200);
  }
});

test('home and visit carry Church JSON-LD without opening hours', async ({
  request,
}) => {
  for (const path of ['/', '/visit']) {
    const body = await (await request.get(path)).text();
    const html = parse(body);
    const blocks = html
      .querySelectorAll('script[type="application/ld+json"]')
      .map((s) => JSON.parse(s.text));
    const church = blocks.find((b) => b['@type'] === 'Church');
    expect(church, path).toBeDefined();
    expect(church.address.streetAddress).toBe('15759 San Pedro Ave');
    expect(body).not.toContain('openingHoursSpecification');
  }
});

test('events carry one Event JSON-LD array with Chicago offsets', async ({
  request,
}) => {
  const html = parse(await (await request.get('/events')).text());
  const scripts = html.querySelectorAll('script[type="application/ld+json"]');
  expect(scripts).toHaveLength(1);
  const events = JSON.parse(scripts[0].text);
  expect(Array.isArray(events)).toBe(true);
  expect(events.length).toBeGreaterThan(0);
  const named = html.querySelectorAll('[data-event]').length;
  expect(events).toHaveLength(named);
  for (const event of events) {
    expect(event['@type']).toBe('Event');
    expect(event.url).toMatch(/^https:\/\/crosswaysa\.churchcenter\.com\//);
    expect(event.startDate).toMatch(/^\d{4}-\d{2}-\d{2}(T[\d:]{8}-0[56]:00)?$/);
  }
});
