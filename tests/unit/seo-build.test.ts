import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tempBuild, type TempBuild } from './helpers/temp-build';

let prod: TempBuild;
let e2e: TempBuild;

beforeAll(async () => {
  [prod, e2e] = await Promise.all([tempBuild(false), tempBuild(true)]);
}, 480_000);

afterAll(() => {
  prod?.cleanup();
  e2e?.cleanup();
});

const read = (build: TempBuild, file: string) =>
  readFileSync(join(build.outputDir, file), 'utf8');

function sitemapUrls(build: TempBuild): string[] {
  const index = read(build, 'sitemap-index.xml');
  const files = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(files.length).toBeGreaterThan(0);
  return files.flatMap((loc) => {
    const name = new URL(loc).pathname.slice(1);
    return [...read(build, name).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (m) => m[1],
    );
  });
}

function jsonLdBlocks(build: TempBuild, file: string): any[] {
  const root = parse(read(build, file));
  return root
    .querySelectorAll('script[type="application/ld+json"]')
    .map((node) => JSON.parse(node.text));
}

const expectedPaths = [
  '/',
  '/visit',
  '/events',
  '/sermons',
  '/series',
  '/entrusted',
  '/culture',
  '/who-we-are',
  '/what-we-believe',
  '/small-groups',
  '/students',
  '/crossway-kids',
  '/biblical-counseling',
  '/child-safety',
  '/networks',
  '/christian-stewardship',
  '/sermons/archive/1',
];

describe.each([
  ['production build', () => prod],
  ['e2e build', () => e2e],
])('sitemap in the %s', (_label, get) => {
  it('lists the expected pages with canonical slashless URLs', () => {
    const urls = sitemapUrls(get());
    for (const path of expectedPaths) {
      expect(urls).toContain(`https://crosswaysa.org${path}`);
    }
    for (const url of urls) {
      const { pathname, search, hash } = new URL(url);
      expect(url.startsWith('https://crosswaysa.org/')).toBe(true);
      expect(search + hash).toBe('');
      if (pathname !== '/') expect(pathname.endsWith('/')).toBe(false);
    }
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('excludes dev fixtures and api routes', () => {
    const urls = sitemapUrls(get());
    expect(urls.some((u) => /\/dev(\/|$)/.test(u))).toBe(false);
    expect(urls.some((u) => /\/api(\/|$)/.test(u))).toBe(false);
    expect(urls.some((u) => u.endsWith('/sermons/filter'))).toBe(false);
  });
});

describe('dev fixture pages', () => {
  it('are absent from the production output', () => {
    expect(existsSync(join(prod.outputDir, 'dev'))).toBe(false);
    expect(existsSync(join(prod.outputDir, 'index.html'))).toBe(true);
    expect(existsSync(join(prod.outputDir, 'favicon.svg'))).toBe(true);
  });

  it('are still built for e2e', () => {
    for (const page of ['media', 'hero', 'motion']) {
      expect(existsSync(join(e2e.outputDir, 'dev', page, 'index.html'))).toBe(
        true,
      );
    }
    expect(existsSync(join(e2e.outputDir, 'dev/poster.svg'))).toBe(true);
  });
});

describe.each([
  ['production build', () => prod],
  ['e2e build', () => e2e],
])('Church JSON-LD in the %s', (_label, get) => {
  it.each(['index.html', 'visit/index.html'])('is valid on %s', (file) => {
    const church = jsonLdBlocks(get(), file).find(
      (b) => b['@type'] === 'Church',
    );
    expect(church).toBeDefined();
    expect(church.name).toBe('Crossway Bible Church');
    expect(church.address.streetAddress).toBe('15759 San Pedro Ave');
    expect(church.address.postalCode).toBe('78232');
    expect(church.sameAs).toHaveLength(2);
    expect(church).not.toHaveProperty('openingHoursSpecification');
    expect(read(get(), file)).not.toContain('openingHoursSpecification');
  });

  it('is not on other pages', () => {
    expect(jsonLdBlocks(get(), 'culture/index.html')).toEqual([]);
  });
});

describe('Event JSON-LD on /events (e2e fixtures)', () => {
  it('is one array with an entry per event', () => {
    const blocks = jsonLdBlocks(e2e, 'events/index.html');
    expect(blocks).toHaveLength(1);
    expect(Array.isArray(blocks[0])).toBe(true);
    const events = blocks[0];
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event['@type']).toBe('Event');
      expect(event.startDate).toMatch(
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}-0[56]:00)?$/,
      );
    }
    const noLocation = events.filter((e: any) => !e.location);
    for (const event of noLocation) {
      expect(JSON.stringify(event)).not.toContain('San Pedro');
    }
  });
});
