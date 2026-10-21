import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { robotsTxt } from '../../src/lib/seo/robots';
import { colors } from '../../src/lib/tokens';

const pub = (file: string) => resolve(__dirname, '../../public', file);

describe('open graph image', () => {
  it('is 1200x630 and at most 150 KB', async () => {
    const meta = await sharp(pub('og/default.jpg')).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
    expect(statSync(pub('og/default.jpg')).size).toBeLessThanOrEqual(150_000);
  });
});

describe('icons', () => {
  it.each([
    ['apple-touch-icon.png', 180],
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
  ])('%s is a %i px square PNG', async (file, size) => {
    const meta = await sharp(pub(file)).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(size);
    expect(meta.height).toBe(size);
  });
});

describe('web manifest', () => {
  const manifest = JSON.parse(readFileSync(pub('site.webmanifest'), 'utf8'));

  it('has the required fields', () => {
    expect(manifest.name).toBe('Crossway Bible Church');
    expect(manifest.short_name).toBe('Crossway');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('browser');
    expect(manifest.theme_color).toBe(colors.navy);
    expect(manifest.background_color).toBe(colors.paper);
  });

  it('lists 192 and 512 icons that exist', () => {
    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(statSync(pub(icon.src.slice(1))).isFile()).toBe(true);
    }
  });
});

describe('robots.txt', () => {
  it('points at the sitemap index the build produces once the site is indexable', () => {
    expect(robotsTxt(true, 'https://crosswaysa.org')).toMatch(
      /^Sitemap: https:\/\/crosswaysa\.org\/sitemap-index\.xml$/m,
    );
  });

  it('names no sitemap while the site is not indexable', () => {
    expect(robotsTxt(false, 'https://crosswaysa.org')).not.toMatch(/Sitemap:/);
  });

  it.each([true, false])(
    'keeps crawlers out of the API when indexable is %s',
    (indexable) => {
      const robots = robotsTxt(indexable, 'https://crosswaysa.org');
      expect(robots).toContain('Disallow: /api/');
      expect(robots).toContain('Disallow: /dev/');
    },
  );
});
