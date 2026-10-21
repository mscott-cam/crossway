import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const cache = vi.hoisted(() => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
}));

vi.mock('../../src/lib/cache', () => cache);

const FEED = readFileSync('tests/fixtures/spreaker-feed.xml', 'utf8');
const FIRST_MP3 =
  'https://dts.podtrac.com/redirect.mp3/api.spreaker.com/download/episode/75851174/sermon_audio.mp3';

const item = (body: string) => `<item>${body}</item>`;
const feed = (...items: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0"><channel><title>Show</title>${items.join('')}</channel></rss>`;
const enclosure = (id: string) =>
  `<enclosure url="https://dts.podtrac.com/redirect.mp3/api.spreaker.com/download/episode/${id}/sermon_audio.mp3" length="1" type="audio/mpeg"/>`;

async function load() {
  vi.resetModules();
  return import('../../src/lib/audio/spreaker');
}

const okResponse = (body: string) =>
  ({ ok: true, status: 200, text: async () => body }) as Response;

beforeEach(() => {
  cache.readCache.mockReset();
  cache.writeCache.mockReset();
  vi.stubEnv('SANITY_FIXTURES', '');
  vi.stubEnv('VERCEL_ENV', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseSpreakerFeed', () => {
  it('parses the fixture feed', async () => {
    const { parseSpreakerFeed } = await load();
    const episodes = parseSpreakerFeed(FEED);
    expect(episodes).toHaveLength(9);
    expect(episodes[0]).toEqual({
      id: '75851174',
      title: 'Entrusted With Resources - Putting Money In its Place',
      pubDate: '2026-10-18T22:13:15.000Z',
      mp3Url: FIRST_MP3,
      durationSec: 2099,
    });
  });

  it('gives every fixture episode a numeric id matching its mp3 url', async () => {
    const { parseSpreakerFeed } = await load();
    for (const e of parseSpreakerFeed(FEED)) {
      expect(e.id).toMatch(/^\d+$/);
      expect(e.mp3Url).toMatch(
        new RegExp(
          `^https://dts\\.podtrac\\.com/redirect\\.mp3/api\\.spreaker\\.com/download/episode/${e.id}/[^/]+\\.mp3$`,
        ),
      );
      expect(Number.isNaN(Date.parse(e.pubDate))).toBe(false);
    }
  });

  it('reads HH:MM:SS, MM:SS and plain-second durations', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>A</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate><itunes:duration>00:36:28</itunes:duration>`,
      ),
      item(
        `<title>B</title>${enclosure('2')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate><itunes:duration>36:28</itunes:duration>`,
      ),
      item(
        `<title>C</title>${enclosure('3')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate><itunes:duration>2188</itunes:duration>`,
      ),
      item(
        `<title>D</title>${enclosure('4')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
      item(
        `<title>E</title>${enclosure('5')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate><itunes:duration>soon</itunes:duration>`,
      ),
    );
    const durations = parseSpreakerFeed(xml).map((e) => e.durationSec);
    expect(durations).toEqual([2188, 2188, 2188, undefined, undefined]);
  });

  it('decodes entities and CDATA in titles', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>Every Son &amp; Every Daughter’s Story</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
      item(
        `<title><![CDATA[Faith & Works <Part 2>]]></title>${enclosure('2')}<pubDate>Sun, 11 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml).map((e) => e.title)).toEqual([
      'Every Son & Every Daughter’s Story',
      'Faith & Works <Part 2>',
    ]);
  });

  it('decodes decimal and hex numeric character references', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>Don&#8217;t &#x2019; Stop</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml)[0].title).toBe('Don’t ’ Stop');
  });

  it('does not decode twice', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>A &amp;#8217; B &amp;amp; C</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml)[0].title).toBe('A &#8217; B &amp; C');
  });

  it('leaves CDATA content undecoded', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title><![CDATA[Don&#8217;t &amp; &#x2019;]]></title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml)[0].title).toBe('Don&#8217;t &amp; &#x2019;');
  });

  it('does not expand DOCTYPE entities (entity bomb)', async () => {
    const { parseSpreakerFeed } = await load();
    const doctype = `<!DOCTYPE feed [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;"><!ENTITY e "&d;&d;&d;&d;&d;&d;&d;&d;&d;&d;">]]>`;
    const xml = `<?xml version="1.0"?>${doctype}<rss version="2.0"><channel><item><title>&e;&e;&e;&e;&e;&e;&e;&e;&e;&e;</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate></item></channel></rss>`;
    const started = Date.now();
    const episodes = parseSpreakerFeed(xml);
    expect(Date.now() - started).toBeLessThan(2000);
    for (const e of episodes) expect(e.title.length).toBeLessThan(1000);
  });

  it('does not let a custom DOCTYPE entity inject text', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = `<?xml version="1.0"?><!DOCTYPE feed [<!ENTITY who "Injected">]><rss version="2.0"><channel><item><title>Hello &who;</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate></item></channel></rss>`;
    const [episode] = parseSpreakerFeed(xml);
    expect(episode?.title ?? '').not.toContain('Injected');
  });

  it('keeps numeric-looking titles as strings', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>1689</title>${enclosure('1')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml)[0].title).toBe('1689');
  });

  it('parses a feed with a single item', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>Only</title>${enclosure('42')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml).map((e) => e.id)).toEqual(['42']);
  });

  it('skips items without a usable enclosure or date', async () => {
    const { parseSpreakerFeed } = await load();
    const xml = feed(
      item(
        `<title>No enclosure</title><pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
      item(
        `<title>Odd url</title><enclosure url="https://example.org/a.mp3" type="audio/mpeg"/><pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
      item(`<title>No date</title>${enclosure('1')}`),
      item(
        `<title>Bad date</title>${enclosure('2')}<pubDate>whenever</pubDate>`,
      ),
      item(
        `<title>Good</title>${enclosure('3')}<pubDate>Sun, 18 Oct 2026 22:13:15 +0000</pubDate>`,
      ),
    );
    expect(parseSpreakerFeed(xml).map((e) => e.id)).toEqual(['3']);
  });

  it('returns [] for malformed XML, empty input and non-feeds', async () => {
    const { parseSpreakerFeed } = await load();
    expect(parseSpreakerFeed('<rss><channel><item><title>x</item>')).toEqual(
      [],
    );
    expect(parseSpreakerFeed(FEED.slice(0, FEED.length / 2))).toEqual([]);
    expect(parseSpreakerFeed('')).toEqual([]);
    expect(parseSpreakerFeed('<html><body>nope</body></html>')).toEqual([]);
    expect(parseSpreakerFeed('{"json": true}')).toEqual([]);
    expect(parseSpreakerFeed(feed())).toEqual([]);
  });
});

describe('fetchSpreakerFeed', () => {
  it('fetches the show feed, parses it and caches the episodes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(FEED));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    const episodes = await fetchSpreakerFeed();
    expect(episodes).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://www.spreaker.com/show/2817602/episodes/feed',
    );
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(cache.writeCache).toHaveBeenCalledWith('spreaker-feed', episodes);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('retries once after a failure and returns the episodes without a fallback warning', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce(okResponse(FEED));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    const episodes = await fetchSpreakerFeed({ retryDelayMs: 0 });
    expect(episodes).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.readCache).not.toHaveBeenCalled();
    expect(cache.writeCache).toHaveBeenCalledWith('spreaker-feed', episodes);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an HTTP error',
      { ok: false, status: 502, text: async (): Promise<string> => '' },
    ],
    ['an unreadable feed', okResponse('<rss><channel><item>')],
  ])('retries after %s', async (_name, first) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValue(okResponse(FEED));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    const episodes = await fetchSpreakerFeed({ retryDelayMs: 0 });
    expect(episodes).toHaveLength(9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('falls back to the cache after both attempts fail, with one warning', async () => {
    const cached = [
      {
        id: '1',
        title: 'Cached',
        pubDate: '2026-10-18T22:13:15.000Z',
        mp3Url: 'https://example.org/1.mp3',
      },
    ];
    cache.readCache.mockReturnValue(cached);
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual(
      cached,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('gives every attempt its own timeout signal', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    await fetchSpreakerFeed({ retryDelayMs: 0 });
    const signals = fetchMock.mock.calls.map((call) => call[1]?.signal);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[1]).toBeInstanceOf(AbortSignal);
    expect(signals[0]).not.toBe(signals[1]);
  });

  it('memoizes: one network call however many callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(FEED));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    await Promise.all([fetchSpreakerFeed(), fetchSpreakerFeed()]);
    await fetchSpreakerFeed();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the cached feed and warns once when fetch rejects', async () => {
    const cached = [
      {
        id: '1',
        title: 'Cached',
        pubDate: '2026-10-18T22:13:15.000Z',
        mp3Url: 'https://example.org/1.mp3',
      },
    ];
    cache.readCache.mockReturnValue(cached);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual(
      cached,
    );
    expect(cache.readCache).toHaveBeenCalledWith('spreaker-feed');
    expect(cache.writeCache).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(console.warn).mock.calls[0][0])).toContain(
      'offline',
    );
  });

  it('resolves to [] with no cache when fetch rejects', async () => {
    cache.readCache.mockReturnValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('falls back on an HTTP error status', async () => {
    cache.readCache.mockReturnValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async (): Promise<string> => '',
      }),
    );
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cache on malformed XML without overwriting it', async () => {
    const cached = [
      {
        id: '1',
        title: 'Cached',
        pubDate: '2026-10-18T22:13:15.000Z',
        mp3Url: 'https://example.org/1.mp3',
      },
    ];
    cache.readCache.mockReturnValue(cached);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse('<rss><channel><item>')),
    );
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual(
      cached,
    );
    expect(cache.writeCache).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('ignores a cache that is not an array', async () => {
    cache.readCache.mockReturnValue({ nope: true });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual([]);
  });

  it('never throws even when reading the response body fails', async () => {
    cache.readCache.mockReturnValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => {
          throw new Error('aborted');
        },
      }),
    );
    const { fetchSpreakerFeed } = await load();
    await expect(fetchSpreakerFeed({ retryDelayMs: 0 })).resolves.toEqual([]);
  });

  it('reads the fixture feed with no network or cache in fixture mode', async () => {
    vi.stubEnv('SANITY_FIXTURES', '1');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    const episodes = await fetchSpreakerFeed();
    expect(episodes).toHaveLength(9);
    expect(episodes[0].id).toBe('75851174');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.readCache).not.toHaveBeenCalled();
    expect(cache.writeCache).not.toHaveBeenCalled();
  });

  it('uses the network on Vercel production even if the fixture flag is set', async () => {
    vi.stubEnv('SANITY_FIXTURES', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(okResponse(FEED));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchSpreakerFeed } = await load();
    await fetchSpreakerFeed();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
