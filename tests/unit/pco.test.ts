import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const FIXTURE = JSON.parse(
  readFileSync('tests/fixtures/pco/event_instances.json', 'utf8'),
);
const NOW = new Date('2026-10-20T12:00:00-05:00');
const API_ROOT = 'https://api.planningcenteronline.com/calendar/v2/';
const APP_ID = 'app-id-123';
const SECRET = 'pco-secret-456';

async function load() {
  vi.resetModules();
  return import('../../src/lib/events/pco');
}

const page = (data: unknown[], included: unknown[], next?: string) => ({
  links: next ? { next } : {},
  data,
  included,
});

const instance = (
  id: string,
  eventId: string,
  startsAt: string,
  extra: Record<string, unknown> = {},
) => ({
  type: 'EventInstance',
  id,
  attributes: {
    starts_at: startsAt,
    ends_at: null,
    all_day_event: false,
    ...extra,
  },
  relationships: { event: { data: { type: 'Event', id: eventId } } },
});

const event = (
  id: string,
  name: string,
  extra: Record<string, unknown> = {},
) => ({
  type: 'Event',
  id,
  attributes: {
    name,
    visible_in_church_center: true,
    link_only: false,
    image_url: null,
    ...extra,
  },
});

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;
const failResponse = (status: number) =>
  ({
    ok: false,
    status,
    json: async () => ({ errors: [] }),
  }) as Response;

const allLogs = (spies: ReturnType<typeof vi.spyOn>[]) =>
  spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join('\n');

describe('mapPcoEvents', () => {
  it('returns one entry per visible future event, sorted by start', async () => {
    const { mapPcoEvents } = await load();
    const events = mapPcoEvents(FIXTURE, NOW);
    expect(events.map((e) => [e.id, e.name, e.startsAt])).toEqual([
      ['1001', 'Advanced Commitment Night', '2026-10-26T00:00:00Z'],
      ['1002', '1st Wednesday - Prayer & Praise', '2026-11-05T00:30:00Z'],
      ['1005', 'Fall Church Work Day', '2026-11-14T06:00:00Z'],
      ['1006', "Men's Retreat", '2026-11-21T00:00:00Z'],
      ['1004', 'Step 2', '2026-12-13T16:30:00Z'],
      ['1003', 'Student Ministry-Christmas Party', '2026-12-13T23:00:00Z'],
      ['1007', "New Year's Eve Prayer Night", '2027-01-01T04:00:00Z'],
    ]);
  });

  it('leaves out hidden, link-only and past-only events', async () => {
    const { mapPcoEvents } = await load();
    const ids = mapPcoEvents(FIXTURE, NOW).map((e) => e.id);
    expect(ids).not.toContain('2001');
    expect(ids).not.toContain('2002');
    expect(ids).not.toContain('1008');
  });

  it('keeps only the next instance of a recurring event, ignoring a past one', async () => {
    const { mapPcoEvents } = await load();
    const prayer = mapPcoEvents(FIXTURE, NOW).filter((e) => e.id === '1002');
    expect(prayer).toHaveLength(1);
    expect(prayer[0].startsAt).toBe('2026-11-05T00:30:00Z');
  });

  it('keeps an instance starting exactly now and drops one a second earlier', async () => {
    const { mapPcoEvents } = await load();
    const json = page(
      [
        instance('1', 'e1', '2026-10-20T17:00:00Z'),
        instance('2', 'e2', '2026-10-20T16:59:59Z'),
      ],
      [event('e1', 'Now'), event('e2', 'Just gone')],
    );
    expect(mapPcoEvents(json, NOW).map((e) => e.id)).toEqual(['e1']);
  });

  it('maps all-day, location, end time and image', async () => {
    const { mapPcoEvents } = await load();
    const byId = Object.fromEntries(
      mapPcoEvents(FIXTURE, NOW).map((e) => [e.id, e]),
    );
    expect(byId['1005'].allDay).toBe(true);
    expect(byId['1001'].allDay).toBe(false);
    expect(byId['1001'].location).toBe('Main Campus');
    expect(byId['1001'].endsAt).toBe('2026-10-26T01:30:00Z');
    expect('location' in byId['1004']).toBe(false);
    expect(byId['1003'].imageUrl).toBe('/dev/poster.svg');
    expect('imageUrl' in byId['1001']).toBe(false);
  });

  it('uses the Church Center URL from the API, or builds the event page URL', async () => {
    const { mapPcoEvents } = await load();
    const byId = Object.fromEntries(
      mapPcoEvents(FIXTURE, NOW).map((e) => [e.id, e]),
    );
    expect(byId['1001'].url).toBe(
      'https://crosswaysa.churchcenter.com/calendar/event/1001',
    );
    expect(byId['1005'].url).toBe(
      'https://crosswaysa.churchcenter.com/calendar/event/1005',
    );
  });

  it('refuses a church_center_url that is not on churchcenter.com', async () => {
    const { mapPcoEvents } = await load();
    for (const bad of [
      'https://evil.example/calendar/event/1',
      'http://crosswaysa.churchcenter.com/calendar/event/1',
      'javascript:alert(1)',
      'https://churchcenter.com.evil.example/x',
    ]) {
      const json = page(
        [
          instance('1', 'e1', '2026-11-01T17:00:00Z', {
            church_center_url: bad,
          }),
        ],
        [event('e1', 'Event')],
      );
      expect(mapPcoEvents(json, NOW)[0].url).toBe(
        'https://crosswaysa.churchcenter.com/calendar/event/e1',
      );
    }
  });

  it('prefers the instance name and falls back to the event name', async () => {
    const { mapPcoEvents } = await load();
    const json = page(
      [
        instance('1', 'e1', '2026-11-01T17:00:00Z', { name: 'Renamed' }),
        instance('2', 'e2', '2026-11-02T17:00:00Z', { name: '  ' }),
      ],
      [event('e1', 'Original'), event('e2', 'Event Two')],
    );
    expect(mapPcoEvents(json, NOW).map((e) => e.name)).toEqual([
      'Renamed',
      'Event Two',
    ]);
  });

  it('only accepts https or root-relative image URLs', async () => {
    const { mapPcoEvents } = await load();
    const images = [
      'https://cdn.example/a.jpg',
      '/dev/poster.svg',
      'http://cdn.example/a.jpg',
      'javascript:alert(1)',
      '//cdn.example/a.jpg',
      '',
    ];
    const json = page(
      images.map((_, i) =>
        instance(`i${i}`, `e${i}`, `2026-11-0${i + 1}T17:00:00Z`),
      ),
      images.map((url, i) => event(`e${i}`, `Event ${i}`, { image_url: url })),
    );
    expect(mapPcoEvents(json, NOW).map((e) => e.imageUrl)).toEqual([
      'https://cdn.example/a.jpg',
      '/dev/poster.svg',
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('skips instances without a usable event, start or name', async () => {
    const { mapPcoEvents } = await load();
    const json = page(
      [
        instance('1', 'missing', '2026-11-01T17:00:00Z'),
        instance('2', 'e2', 'not a date'),
        {
          type: 'EventInstance',
          id: '3',
          attributes: { starts_at: '2026-11-01T17:00:00Z' },
        },
        instance('4', 'e4', '2026-11-04T17:00:00Z'),
        instance('5', 'e5', '2026-11-05T17:00:00Z'),
      ],
      [event('e2', 'Bad date'), event('e4', 'Good'), event('e5', '   ')],
    );
    expect(mapPcoEvents(json, NOW).map((e) => e.id)).toEqual(['e4']);
  });

  it('requires visible_in_church_center to be exactly true', async () => {
    const { mapPcoEvents } = await load();
    const json = page(
      [
        instance('1', 'e1', '2026-11-01T17:00:00Z'),
        instance('2', 'e2', '2026-11-02T17:00:00Z'),
      ],
      [
        event('e1', 'String', { visible_in_church_center: 'true' }),
        event('e2', 'Missing', { visible_in_church_center: undefined }),
      ],
    );
    expect(mapPcoEvents(json, NOW)).toEqual([]);
  });

  it('returns an empty list for malformed input', async () => {
    const { mapPcoEvents } = await load();
    for (const bad of [
      null,
      undefined,
      'text',
      42,
      [],
      {},
      { data: 'x' },
      { data: [null, 1, 'x'] },
    ]) {
      expect(mapPcoEvents(bad, NOW)).toEqual([]);
    }
  });
});

describe('fetchUpcomingEvents', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SANITY_FIXTURES', '');
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('PCO_APP_ID', APP_ID);
    vi.stubEnv('PCO_SECRET', SECRET);
    vi.stubEnv('PCO_FIXTURE_FILE', '');
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves null without a network call when credentials are unset', async () => {
    vi.stubEnv('PCO_APP_ID', '');
    vi.stubEnv('PCO_SECRET', '');
    const { fetchUpcomingEvents } = await load();
    await expect(fetchUpcomingEvents()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves null without a network call when only one credential is set or they are blank', async () => {
    for (const [id, secret] of [
      [APP_ID, ''],
      ['', SECRET],
      ['   ', '   '],
    ]) {
      vi.stubEnv('PCO_APP_ID', id);
      vi.stubEnv('PCO_SECRET', secret);
      const { fetchUpcomingEvents } = await load();
      await expect(fetchUpcomingEvents()).resolves.toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests event instances with Basic auth, include=event and a timeout', async () => {
    fetchMock.mockResolvedValue(okResponse(FIXTURE));
    const { fetchUpcomingEvents } = await load();
    const events = await fetchUpcomingEvents();
    expect(events?.map((e) => e.id)).toEqual([
      '1001',
      '1002',
      '1005',
      '1006',
      '1004',
      '1003',
      '1007',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `${API_ROOT}event_instances`,
    );
    expect(parsed.searchParams.get('filter')).toBe('future');
    expect(parsed.searchParams.get('include')).toBe('event');
    expect(parsed.searchParams.get('order')).toBe('starts_at');
    expect(parsed.searchParams.get('per_page')).toBe('100');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from(`${APP_ID}:${SECRET}`).toString('base64')}`,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses the real clock outside fixtures mode', async () => {
    vi.setSystemTime(new Date('2026-12-10T12:00:00Z'));
    fetchMock.mockResolvedValue(okResponse(FIXTURE));
    const { fetchUpcomingEvents } = await load();
    const events = await fetchUpcomingEvents();
    expect(events?.map((e) => e.id)).toEqual(['1004', '1003', '1007', '1002']);
  });

  it('applies the limit to the sorted list', async () => {
    fetchMock.mockResolvedValue(okResponse(FIXTURE));
    const { fetchUpcomingEvents } = await load();
    const three = await fetchUpcomingEvents(3);
    expect(three?.map((e) => e.id)).toEqual(['1001', '1002', '1005']);
    const all = await fetchUpcomingEvents();
    expect(all).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves null on a 500 after one retry, without throwing, with one warning', async () => {
    fetchMock.mockResolvedValue(failResponse(500));
    const { fetchUpcomingEvents } = await load();
    await expect(
      fetchUpcomingEvents(undefined, { retryDelayMs: 0 }),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('500');
  });

  it('resolves null on a 401', async () => {
    fetchMock.mockResolvedValue(failResponse(401));
    const { fetchUpcomingEvents } = await load();
    await expect(
      fetchUpcomingEvents(undefined, { retryDelayMs: 0 }),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('resolves null when the network rejects or the body is not JSON', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    let mod = await load();
    await expect(
      mod.fetchUpcomingEvents(undefined, { retryDelayMs: 0 }),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);
    mod = await load();
    await expect(
      mod.fetchUpcomingEvents(undefined, { retryDelayMs: 0 }),
    ).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('recovers when the retry succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(failResponse(503))
      .mockResolvedValueOnce(okResponse(FIXTURE));
    const { fetchUpcomingEvents } = await load();
    const events = await fetchUpcomingEvents(undefined, { retryDelayMs: 0 });
    expect(events).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('follows links.next, merges pages and dedupes across them', async () => {
    const next = `${API_ROOT}event_instances?filter=future&include=event&order=starts_at&per_page=100&offset=100`;
    fetchMock
      .mockResolvedValueOnce(
        okResponse(
          page(
            [
              instance('1', 'e1', '2026-11-01T17:00:00Z'),
              instance('2', 'e2', '2026-11-03T17:00:00Z'),
            ],
            [event('e1', 'One'), event('e2', 'Two')],
            next,
          ),
        ),
      )
      .mockResolvedValueOnce(
        okResponse(
          page(
            [
              instance('3', 'e2', '2026-11-10T17:00:00Z'),
              instance('4', 'e3', '2026-11-12T17:00:00Z'),
            ],
            [event('e2', 'Two'), event('e3', 'Three')],
          ),
        ),
      );
    const { fetchUpcomingEvents } = await load();
    const events = await fetchUpcomingEvents();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toBe(next);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      fetchMock.mock.calls[0][1].headers.Authorization,
    );
    expect(events?.map((e) => [e.id, e.startsAt])).toEqual([
      ['e1', '2026-11-01T17:00:00Z'],
      ['e2', '2026-11-03T17:00:00Z'],
      ['e3', '2026-11-12T17:00:00Z'],
    ]);
  });

  it('stops after five pages', async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => {
      n += 1;
      return okResponse(
        page(
          [
            instance(
              `i${n}`,
              `e${n}`,
              `2026-11-${String(n).padStart(2, '0')}T17:00:00Z`,
            ),
          ],
          [event(`e${n}`, `Event ${n}`)],
          `${API_ROOT}event_instances?offset=${n * 100}`,
        ),
      );
    });
    const { fetchUpcomingEvents } = await load();
    const events = await fetchUpcomingEvents();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(events).toHaveLength(5);
  });

  it('never sends credentials to a next link on another host', async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse(
        page(
          [instance('1', 'e1', '2026-11-01T17:00:00Z')],
          [event('e1', 'One')],
          'https://evil.example/calendar/v2/event_instances?offset=100',
        ),
      ),
    );
    const { fetchUpcomingEvents } = await load();
    await expect(
      fetchUpcomingEvents(undefined, { retryDelayMs: 0 }),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('memoizes the result for the rest of the build', async () => {
    fetchMock.mockResolvedValue(okResponse(FIXTURE));
    const { fetchUpcomingEvents } = await load();
    const [a, b] = await Promise.all([
      fetchUpcomingEvents(),
      fetchUpcomingEvents(2),
    ]);
    await fetchUpcomingEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(7);
    expect(b).toHaveLength(2);
  });

  it('never logs credentials', async () => {
    fetchMock.mockResolvedValueOnce(failResponse(500));
    fetchMock.mockRejectedValue(new Error(`boom ${APP_ID} ${SECRET}`));
    const { fetchUpcomingEvents } = await load();
    await fetchUpcomingEvents(undefined, { retryDelayMs: 0 });
    expect(warn).toHaveBeenCalledTimes(1);
    const logs = allLogs([warn, error, log]);
    expect(logs).not.toContain(SECRET);
    expect(logs).not.toContain(APP_ID);
    expect(logs).not.toContain(
      Buffer.from(`${APP_ID}:${SECRET}`).toString('base64'),
    );
  });

  describe('fixtures mode', () => {
    beforeEach(() => {
      vi.stubEnv('SANITY_FIXTURES', '1');
      vi.stubEnv('PCO_APP_ID', '');
      vi.stubEnv('PCO_SECRET', '');
    });

    it('reads the fixture file with no network call and no credentials', async () => {
      const { fetchUpcomingEvents } = await load();
      const events = await fetchUpcomingEvents();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(events?.map((e) => e.id)).toEqual([
        '1001',
        '1002',
        '1005',
        '1006',
        '1004',
        '1003',
        '1007',
      ]);
    });

    it('uses the fixed now regardless of the real date', async () => {
      vi.setSystemTime(new Date('2031-06-01T12:00:00Z'));
      const { fetchUpcomingEvents } = await load();
      const events = await fetchUpcomingEvents();
      expect(events).toHaveLength(7);
      expect(events?.[0].id).toBe('1001');
    });

    it('can read a different fixture file', async () => {
      vi.stubEnv(
        'PCO_FIXTURE_FILE',
        'tests/fixtures/pco-empty/event_instances.json',
      );
      const { fetchUpcomingEvents } = await load();
      await expect(fetchUpcomingEvents()).resolves.toEqual([]);
    });

    it('resolves null with one warning when the fixture file is missing', async () => {
      vi.stubEnv('PCO_FIXTURE_FILE', 'tests/fixtures/pco/does-not-exist.json');
      const { fetchUpcomingEvents } = await load();
      await expect(fetchUpcomingEvents()).resolves.toBeNull();
      const pcoWarnings = warn.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('[events]'),
      );
      expect(pcoWarnings).toHaveLength(1);
    });

    it('ignores fixtures on a production build', async () => {
      vi.stubEnv('VERCEL_ENV', 'production');
      const { fetchUpcomingEvents } = await load();
      await expect(fetchUpcomingEvents()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
