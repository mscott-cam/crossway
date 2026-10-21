import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { siteSettings } from '../../studio/schemaTypes/site-settings';
import { BOOKS } from '../../src/lib/books';
import { sermonSlug } from '../../src/lib/slug';

const fetchMock = vi.fn();
const createClientMock = vi.fn((_config: unknown) => ({ fetch: fetchMock }));

vi.mock('@sanity/client', () => ({
  createClient: (config: unknown) => createClientMock(config),
}));

const speaker = { _id: 'sp1', name: 'Josh Collins', slug: { current: 'josh' } };
const series = {
  _id: 'se1',
  title: 'Entrusted',
  slug: { current: 'entrusted' },
  isStandalone: false,
};
const rawSermon = (title: string, date: string, extra = {}) => ({
  _id: `sermon-${title}`,
  title,
  date,
  speaker,
  series,
  book: '1 Timothy',
  slug: { current: sermonSlug(title, date) },
  ...extra,
});

async function load() {
  vi.resetModules();
  return import('../../src/lib/sanity/queries');
}

function configure() {
  vi.stubEnv('SANITY_PROJECT_ID', 'abc123');
  vi.stubEnv('SANITY_DATASET', 'production');
  vi.stubEnv('SANITY_FIXTURES', '');
}

beforeEach(() => {
  fetchMock.mockReset();
  createClientMock.mockClear();
  vi.stubEnv('SANITY_PROJECT_ID', '');
  vi.stubEnv('SANITY_FIXTURES', '');
  vi.stubEnv('SANITY_FIXTURE_SETTINGS', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isSanityConfigured', () => {
  it('is false without a project id', async () => {
    const { isSanityConfigured } = await import('../../src/lib/sanity/client');
    expect(isSanityConfigured()).toBe(false);
  });

  it('is false for a blank or placeholder project id', async () => {
    const { isSanityConfigured } = await import('../../src/lib/sanity/client');
    vi.stubEnv('SANITY_PROJECT_ID', '   ');
    expect(isSanityConfigured()).toBe(false);
    vi.stubEnv('SANITY_PROJECT_ID', 'your-project-id');
    expect(isSanityConfigured()).toBe(false);
  });

  it('is true with a real project id', async () => {
    const { isSanityConfigured } = await import('../../src/lib/sanity/client');
    vi.stubEnv('SANITY_PROJECT_ID', 'abc123');
    expect(isSanityConfigured()).toBe(true);
  });
});

describe('unconfigured Sanity', () => {
  it('resolves default site settings', async () => {
    const { getSiteSettings } = await load();
    const settings = await getSiteSettings();
    expect(settings.serviceTimes).toEqual(['9:00', '10:45']);
    expect(settings.sundayCardRows.map((r) => r.label)).toEqual([
      'Kids & Students',
      'Address',
      'Can’t make it?',
    ]);
    expect(settings.announcement.enabled).toBe(false);
    expect(settings.showEntrustedOnHome).toBe(true);
  });

  it('resolves empty lists without calling Sanity', async () => {
    const q = await load();
    expect(await q.getSermons()).toEqual([]);
    expect(await q.getSeriesList()).toEqual([]);
    expect(await q.getSpeakers()).toEqual([]);
    expect(await q.getLeaders()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('warns once, concisely', async () => {
    const q = await load();
    await q.getSermons();
    await q.getSeriesList();
    await q.getSiteSettings();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe('getSermons with a mocked client', () => {
  it('sorts date descending, then title, and computes slugs', async () => {
    configure();
    fetchMock.mockResolvedValue([
      rawSermon('B Older', '2026-01-04'),
      rawSermon('Zeta Same Day', '2026-10-18'),
      rawSermon('Alpha Same Day', '2026-10-18'),
      rawSermon('Middle', '2026-05-03', { slug: { current: 'custom-slug' } }),
    ]);
    const { getSermons } = await load();
    const sermons = await getSermons();
    expect(sermons.map((s) => s.title)).toEqual([
      'Alpha Same Day',
      'Zeta Same Day',
      'Middle',
      'B Older',
    ]);
    expect(sermons[0].slug).toBe('alpha-same-day-2026-10-18');
    expect(sermons[2].slug).toBe('custom-slug');
    expect(typeof sermons[0].slug).toBe('string');
    expect(sermons[0].book).toBe('1 Timothy');
  });

  it('flattens expanded speaker and series slugs', async () => {
    configure();
    fetchMock.mockResolvedValue([rawSermon('One', '2026-10-18')]);
    const { getSermons } = await load();
    const [sermon] = await getSermons();
    expect(sermon.speaker).toMatchObject({
      name: 'Josh Collins',
      slug: 'josh',
    });
    expect(sermon.series).toMatchObject({
      title: 'Entrusted',
      slug: 'entrusted',
      isStandalone: false,
    });
  });

  it('drops sermons whose speaker or series reference is missing', async () => {
    configure();
    fetchMock.mockResolvedValue([
      rawSermon('Good', '2026-10-18'),
      rawSermon('No Speaker', '2026-10-11', { speaker: null }),
      rawSermon('No Series', '2026-10-04', { series: null }),
    ]);
    const { getSermons } = await load();
    expect((await getSermons()).map((s) => s.title)).toEqual(['Good']);
  });

  it('memoizes the fetch per build', async () => {
    configure();
    fetchMock.mockResolvedValue([rawSermon('One', '2026-10-18')]);
    const { getSermons } = await load();
    await Promise.all([getSermons(), getSermons()]);
    await getSermons();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads published content through the CDN', async () => {
    configure();
    vi.stubEnv('SANITY_API_READ_TOKEN', 'tok');
    fetchMock.mockResolvedValue([]);
    const { getSermons } = await load();
    await getSermons();
    expect(createClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'abc123',
        dataset: 'production',
        useCdn: true,
        perspective: 'published',
        timeout: 15000,
        token: 'tok',
        apiVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
  });

  it('warns once, naming the ids, when rows are dropped', async () => {
    configure();
    fetchMock.mockResolvedValue([
      rawSermon('Good', '2026-10-18'),
      rawSermon('No Speaker', '2026-10-11', { speaker: null }),
      rawSermon('No Series', '2026-10-04', { series: null }),
    ]);
    const { getSermons } = await load();
    await getSermons();
    await getSermons();
    expect(console.warn).toHaveBeenCalledTimes(1);
    const message = String(vi.mocked(console.warn).mock.calls[0][0]);
    expect(message).toContain('getSermons');
    expect(message).toContain('sermon-No Speaker');
    expect(message).toContain('sermon-No Series');
    expect(message).not.toContain('sermon-Good');
  });

  it('warns once for dropped speakers and series', async () => {
    configure();
    fetchMock.mockResolvedValue([
      { _id: 'sp-ok', name: 'A', slug: { current: 'a' } },
      { _id: 'sp-bad', name: 'B', slug: null },
    ]);
    const { getSpeakers } = await load();
    expect(await getSpeakers()).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain(
      'sp-bad',
    );
  });

  it('logs nothing for a clean fetch', async () => {
    configure();
    fetchMock.mockResolvedValue([
      rawSermon('One', '2026-10-18'),
      rawSermon('Two', '2026-10-11'),
    ]);
    const { getSermons } = await load();
    expect(await getSermons()).toHaveLength(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns [] and does not throw when the fetch fails', async () => {
    configure();
    fetchMock.mockRejectedValue(new Error('network down'));
    const { getSermons, getSeriesList } = await load();
    await expect(getSermons()).resolves.toEqual([]);
    await expect(getSeriesList()).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns [] when the response is not an array', async () => {
    configure();
    fetchMock.mockResolvedValue(null);
    const { getSermons } = await load();
    await expect(getSermons()).resolves.toEqual([]);
  });
});

describe('other fetchers with a mocked client', () => {
  it('flattens series slugs and artwork', async () => {
    configure();
    fetchMock.mockResolvedValue([
      {
        _id: 's1',
        title: 'Entrusted',
        slug: { current: 'entrusted' },
        artwork: { url: 'https://cdn/x.jpg', width: 1600, height: 900 },
        isStandalone: null,
      },
    ]);
    const { getSeriesList } = await load();
    expect(await getSeriesList()).toEqual([
      {
        _id: 's1',
        title: 'Entrusted',
        slug: 'entrusted',
        artwork: { url: 'https://cdn/x.jpg', width: 1600, height: 900 },
        isStandalone: false,
      },
    ]);
  });

  it('merges a partial settings document over the defaults', async () => {
    configure();
    fetchMock.mockResolvedValue({
      serviceTimes: ['8:30'],
      sundayCardRows: null,
      announcement: { enabled: true, text: 'Hello', href: null },
      showEntrustedOnHome: false,
    });
    const { getSiteSettings } = await load();
    const settings = await getSiteSettings();
    expect(settings.serviceTimes).toEqual(['8:30']);
    expect(settings.sundayCardRows).toHaveLength(3);
    expect(settings.announcement).toEqual({ enabled: true, text: 'Hello' });
    expect(settings.showEntrustedOnHome).toBe(false);
  });

  it('falls back to defaults when no settings document exists', async () => {
    configure();
    fetchMock.mockResolvedValue(null);
    const { getSiteSettings } = await load();
    expect((await getSiteSettings()).serviceTimes).toEqual(['9:00', '10:45']);
  });

  it('falls back to defaults when the settings fetch fails', async () => {
    configure();
    fetchMock.mockRejectedValue(new Error('boom'));
    const { getSiteSettings } = await load();
    expect((await getSiteSettings()).showEntrustedOnHome).toBe(true);
  });
});

describe('site settings defaults', () => {
  const rowShape = (rows: unknown) =>
    (rows as { label: string; value: string; href?: string }[]).map(
      ({ label, value, href }) => ({ label, value, href }),
    );
  const initialValueOf = (name: string) =>
    (
      siteSettings.fields.find((f) => f.name === name) as
        { initialValue?: unknown } | undefined
    )?.initialValue;

  it('matches the Studio initial values', async () => {
    const { DEFAULT_SITE_SETTINGS } = await load();
    expect(DEFAULT_SITE_SETTINGS.serviceTimes).toEqual(
      initialValueOf('serviceTimes'),
    );
    expect(DEFAULT_SITE_SETTINGS.showEntrustedOnHome).toBe(
      initialValueOf('showEntrustedOnHome'),
    );
    expect(DEFAULT_SITE_SETTINGS.announcement).toEqual(
      initialValueOf('announcement'),
    );
    expect(rowShape(DEFAULT_SITE_SETTINGS.sundayCardRows)).toEqual(
      rowShape(initialValueOf('sundayCardRows')),
    );
  });

  it('matches tests/fixtures/sanity/settings.json', async () => {
    const { DEFAULT_SITE_SETTINGS } = await load();
    const fixture = JSON.parse(
      readFileSync('tests/fixtures/sanity/settings.json', 'utf8'),
    );
    expect(fixture).toEqual(DEFAULT_SITE_SETTINGS);
  });
});

describe('fixture mode', () => {
  beforeEach(() => {
    vi.stubEnv('SANITY_FIXTURES', '1');
  });

  it('reads fixtures instead of Sanity even when configured', async () => {
    vi.stubEnv('SANITY_PROJECT_ID', 'abc123');
    const q = await load();
    expect((await q.getSermons()).length).toBeGreaterThanOrEqual(30);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('warns once that fixture data is in use', async () => {
    const q = await load();
    await Promise.all([q.getSermons(), q.getSeriesList(), q.getSiteSettings()]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain(
      'using fixture data',
    );
  });

  it('ignores the flag on Vercel production and says so', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('SANITY_PROJECT_ID', 'abc123');
    fetchMock.mockResolvedValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const q = await load();
    expect(await q.getSermons()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.error).mock.calls[0][0])).toContain(
      'SANITY_FIXTURES',
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('still honours the flag on Vercel preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const q = await load();
    expect((await q.getSermons()).length).toBeGreaterThanOrEqual(30);
  });

  it('returns sermons date-descending', async () => {
    const { getSermons } = await load();
    const dates = (await getSermons()).map((s) => s.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('has at least three series including the standalone one', async () => {
    const { getSeriesList, getSermons } = await load();
    const list = await getSeriesList();
    expect(list.length).toBeGreaterThanOrEqual(3);
    const standalone = list.find((s) => s.isStandalone);
    expect(standalone?.title).toBe('Stand Alone Messages');
    const sermons = await getSermons();
    for (const s of list) {
      expect(sermons.some((x) => x.series._id === s._id)).toBe(true);
    }
  });

  it('has at least three speakers', async () => {
    const { getSpeakers } = await load();
    const names = (await getSpeakers()).map((s) => s.name);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(names).toEqual(
      expect.arrayContaining([
        'Josh de Koning',
        'Josh Collins',
        'Scott Graham',
      ]),
    );
  });

  it('only uses valid book names and includes 1 Timothy', async () => {
    const { getSermons } = await load();
    const sermons = await getSermons();
    const names = new Set(BOOKS.map((b) => b.name));
    for (const s of sermons) expect(names.has(s.book)).toBe(true);
    expect(sermons.some((s) => s.book === '1 Timothy')).toBe(true);
  });

  it('has unique Webflow-style slugs equal to sermonSlug(title, date)', async () => {
    const { getSermons } = await load();
    const sermons = await getSermons();
    for (const s of sermons) expect(s.slug).toBe(sermonSlug(s.title, s.date));
    expect(new Set(sermons.map((s) => s.slug)).size).toBe(sermons.length);
    expect(new Set(sermons.map((s) => s._id)).size).toBe(sermons.length);
  });

  it('includes the special review sermons', async () => {
    const { getSermons } = await load();
    const sermons = await getSermons();
    expect(sermons.filter((s) => !s.vimeoUrl)).toHaveLength(1);
    expect(
      sermons.filter((s) => s.vimeoUrl === 'not a vimeo link'),
    ).toHaveLength(1);
    expect(sermons.some((s) => s.date === '2019-01-06')).toBe(true);
    const normal = sermons.filter(
      (s) => s.vimeoUrl && s.vimeoUrl !== 'not a vimeo link',
    );
    for (const s of normal)
      expect(s.vimeoUrl).toMatch(/^https:\/\/vimeo\.com\/\d+$/);
  });

  it('spreads sermons over about two years', async () => {
    const { getSermons } = await load();
    const recent = (await getSermons()).filter((s) => s.date >= '2024-01-01');
    const dates = recent.map((s) => s.date);
    expect(dates[0] >= '2026-10-01').toBe(true);
    expect(dates[dates.length - 1] <= '2024-12-31').toBe(true);
  });

  it('serves leaders in all four groups', async () => {
    const { getLeaders } = await load();
    const groups = new Set((await getLeaders()).map((l) => l.group));
    expect([...groups].sort()).toEqual([
      'Deacons',
      'Elders',
      'Ministry Leaders',
      'Staff',
    ]);
  });

  it('serves the Studio default settings', async () => {
    const { getSiteSettings } = await load();
    expect(await getSiteSettings()).toEqual({
      serviceTimes: ['9:00', '10:45'],
      sundayCardRows: [
        { label: 'Kids & Students', value: 'Both services' },
        {
          label: 'Address',
          value: '15759 San Pedro Ave, San Antonio, TX 78232',
          href: 'https://maps.app.goo.gl/o7uWJUWy6KxYDraX7',
        },
        {
          label: 'Can’t make it?',
          value: 'Watch live',
          href: 'https://live.crosswaysa.org/',
        },
      ],
      announcement: { enabled: false },
      showEntrustedOnHome: true,
    });
  });

  it('selects a named settings fixture', async () => {
    vi.stubEnv('SANITY_FIXTURE_SETTINGS', 'announcement');
    const a = await (await load()).getSiteSettings();
    expect(a.announcement.enabled).toBe(true);
    expect(a.announcement.text).toBeTruthy();
    expect(a.announcement.href).toBeTruthy();

    vi.stubEnv('SANITY_FIXTURE_SETTINGS', 'no-entrusted');
    const b = await (await load()).getSiteSettings();
    expect(b.showEntrustedOnHome).toBe(false);
  });

  it('falls back to default settings for an unknown fixture name', async () => {
    vi.stubEnv('SANITY_FIXTURE_SETTINGS', 'does-not-exist');
    const { getSiteSettings } = await load();
    expect((await getSiteSettings()).serviceTimes).toEqual(['9:00', '10:45']);
  });
});
