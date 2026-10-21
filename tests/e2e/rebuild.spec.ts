import { expect, test } from '@playwright/test';
import { site } from '../../src/lib/site';

test.describe('rebuild cron endpoint', () => {
  test('refuses unauthenticated requests and never succeeds without config', async ({
    request,
  }) => {
    const res = await request.get('/api/cron/rebuild');
    expect([401, 503]).toContain(res.status());
    expect(await res.json()).toEqual({ ok: false });
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('fails closed even with a bearer token when the env is unset', async ({
    request,
  }) => {
    const res = await request.get('/api/cron/rebuild', {
      headers: { Authorization: 'Bearer guess' },
    });
    expect([401, 503]).toContain(res.status());
    expect(await res.json()).toEqual({ ok: false });
  });

  test('rejects POST with Allow: GET', async ({ request }) => {
    const res = await request.post('/api/cron/rebuild');
    expect(res.status()).toBe(405);
    expect(res.headers()['allow']).toBe('GET');
  });
});

test('robots.txt keeps crawlers out of the API', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('Disallow: /api/');
  expect(body).toContain('Disallow: /dev/');
  if (site.indexable) {
    expect(body).toContain('Sitemap: https://crosswaysa.org/sitemap-index.xml');
  } else {
    expect(body).not.toContain('Sitemap:');
  }
});
