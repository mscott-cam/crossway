import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderPage(path: string, route: string, settings?: string) {
  vi.resetModules();
  vi.stubEnv('SANITY_FIXTURES', '1');
  vi.stubEnv('E2E', '1');
  vi.stubEnv('SANITY_FIXTURE_SETTINGS', settings ?? '');
  const mod = await import(/* @vite-ignore */ path);
  const container = await AstroContainer.create({
    astroConfig: { site: 'https://crosswaysa.org' },
  });
  return container.renderToString(mod.default, {
    request: new Request(`https://crosswaysa.org${route}`),
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('home page settings variants', () => {
  it('shows the Entrusted feature by default and no announcement', async () => {
    const html = await renderPage('../../src/pages/index.astro', '/');
    expect(html).toContain('data-entrusted-feature');
    expect(html).not.toContain('data-announcement');
  });

  it('hides the Entrusted feature when showEntrustedOnHome is false', async () => {
    const html = await renderPage(
      '../../src/pages/index.astro',
      '/',
      'no-entrusted',
    );
    expect(html).not.toContain('data-entrusted-feature');
    expect(html).toContain('You are');
  });

  it('renders the announcement bar on the home page', async () => {
    const html = await renderPage(
      '../../src/pages/index.astro',
      '/',
      'announcement',
    );
    expect(html).toContain('data-announcement');
    expect(html).toContain(
      'Join us this Sunday as we continue the Entrusted series.',
    );
  });

  it('renders the announcement bar on other pages through the layout', async () => {
    const html = await renderPage(
      '../../src/pages/sermons/index.astro',
      '/sermons',
      'announcement',
    );
    expect(html).toContain('data-announcement');
    expect(html).toContain('href="/entrusted"');
  });

  it('renders no announcement bar on other pages by default', async () => {
    const html = await renderPage(
      '../../src/pages/sermons/index.astro',
      '/sermons',
    );
    expect(html).not.toContain('data-announcement');
  });
});
