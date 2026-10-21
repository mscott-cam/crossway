import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HERO_POSTER, HERO_POSTER_AVIF } from '../../src/lib/video/hero-poster';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function renderHome() {
  vi.stubEnv('SANITY_FIXTURES', '1');
  vi.stubEnv('E2E', '1');
  const mod = await import('../../src/pages/index.astro');
  const container = await AstroContainer.create({
    astroConfig: { site: 'https://crosswaysa.org' },
  });
  return container.renderToString(mod.default, {
    request: new Request('https://crosswaysa.org/'),
  });
}

describe('hero poster', () => {
  it('derives the avif path from the one shared base', () => {
    expect(HERO_POSTER_AVIF).toBe(`${HERO_POSTER}.avif`);
  });

  it('preloads exactly the avif the picture uses, once, in the head', async () => {
    const html = await renderHome();
    const preloads = [
      ...html.matchAll(/<link[^>]*rel="preload"[^>]*as="image"[^>]*>/g),
    ].map((m) => m[0]);
    expect(preloads).toHaveLength(1);
    expect(preloads[0]).toContain(`href="${HERO_POSTER_AVIF}"`);
    expect(html.indexOf(preloads[0]!)).toBeLessThan(html.indexOf('<body'));

    const source = html.match(
      /<source[^>]*srcset="([^"]+)"[^>]*type="image\/avif"/,
    );
    expect(source?.[1]).toBe(HERO_POSTER_AVIF);
  });
});
