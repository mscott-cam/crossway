import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getVimeoThumb, parseVimeoId } from '../../src/lib/video/vimeo';
import { readCache, writeCache } from '../../src/lib/cache';

describe('parseVimeoId', () => {
  it('parses a plain vimeo.com URL', () => {
    expect(parseVimeoId('https://vimeo.com/123456')).toBe('123456');
    expect(parseVimeoId('https://www.vimeo.com/123456')).toBe('123456');
    expect(parseVimeoId('vimeo.com/123456')).toBe('123456');
  });

  it('parses the path hash form', () => {
    expect(parseVimeoId('https://vimeo.com/123456/abcdef0123')).toBe(
      '123456?h=abcdef0123',
    );
  });

  it('parses the query hash form', () => {
    expect(parseVimeoId('https://vimeo.com/123456?h=abcdef0123')).toBe(
      '123456?h=abcdef0123',
    );
    expect(parseVimeoId('https://vimeo.com/123456?foo=1&h=abc123')).toBe(
      '123456?h=abc123',
    );
  });

  it('parses player URLs and keeps the hash', () => {
    expect(parseVimeoId('https://player.vimeo.com/video/123456')).toBe(
      '123456',
    );
    expect(
      parseVimeoId('https://player.vimeo.com/video/123456?title=0&byline=0'),
    ).toBe('123456');
    expect(
      parseVimeoId('https://player.vimeo.com/video/123456?h=abc123&dnt=1'),
    ).toBe('123456?h=abc123');
  });

  it('tolerates surrounding whitespace and a trailing slash', () => {
    expect(parseVimeoId('  https://vimeo.com/123456/  ')).toBe('123456');
  });

  it('returns null for anything else', () => {
    expect(parseVimeoId('not a vimeo link')).toBeNull();
    expect(parseVimeoId('not a url')).toBeNull();
    expect(parseVimeoId('')).toBeNull();
    expect(parseVimeoId('https://vimeo.com/')).toBeNull();
    expect(parseVimeoId('https://vimeo.com/about')).toBeNull();
    expect(parseVimeoId('https://youtube.com/watch?v=123456')).toBeNull();
    expect(parseVimeoId('https://notvimeo.com/123456')).toBeNull();
    expect(parseVimeoId('https://vimeo.com.evil.test/123456')).toBeNull();
    expect(parseVimeoId('https://player.vimeo.com/other/123456')).toBeNull();
  });
});

type Deferred = {
  url: string;
  signal?: AbortSignal | null;
  resolve: (body: unknown) => void;
  reject: (error: unknown) => void;
};

function okResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe('getVimeoThumb', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'crossway-vimeo-'));
    vi.stubEnv('CROSSWAY_CACHE_DIR', dir);
    vi.stubEnv('SANITY_FIXTURES', '');
    vi.stubEnv('VERCEL_ENV', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null without touching the network in fixtures mode', async () => {
    vi.stubEnv('SANITY_FIXTURES', '1');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getVimeoThumb('111')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requests oEmbed at width 1280 with the hash and returns the thumbnail', async () => {
    const fetchSpy = vi.fn(async () =>
      okResponse({ thumbnail_url: 'https://i.vimeocdn.com/video/1_1280x720' }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getVimeoThumb('222?h=abc123')).toBe(
      'https://i.vimeocdn.com/video/1_1280x720',
    );
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain('https://vimeo.com/api/oembed.json?');
    expect(url).toContain('width=1280');
    expect(decodeURIComponent(url)).toContain(
      'url=https://vimeo.com/222/abc123',
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('serves a cache hit without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    writeCache('vimeo-thumb-333', 'https://i.vimeocdn.com/cached');
    expect(await getVimeoThumb('333')).toBe('https://i.vimeocdn.com/cached');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('caches a successful result for the next call', async () => {
    const fetchSpy = vi.fn(async () =>
      okResponse({ thumbnail_url: 'https://i.vimeocdn.com/444' }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await getVimeoThumb('444?h=zzz');
    await getVimeoThumb('444?h=zzz');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(readCache('vimeo-thumb-444-zzz')).toBe('https://i.vimeocdn.com/444');
  });

  it('returns null on network failure, bad status and bad bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await getVimeoThumb('555')).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 }) as Response),
    );
    expect(await getVimeoThumb('556')).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse({ title: 'no thumbnail' })),
    );
    expect(await getVimeoThumb('557')).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => {
              throw new Error('bad json');
            },
          }) as unknown as Response,
      ),
    );
    expect(await getVimeoThumb('558')).toBeNull();
  });

  it('does not cache failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await getVimeoThumb('559');
    expect(readCache('vimeo-thumb-559')).toBeUndefined();
  });

  it('applies a 4 second timeout and returns null when it fires', async () => {
    const controller = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('timed out', 'TimeoutError')),
            );
          }),
      ),
    );
    const pending = getVimeoThumb('666');
    await vi.waitFor(() => expect(timeoutSpy).toHaveBeenCalledWith(4000));
    controller.abort();
    expect(await pending).toBeNull();
  });

  it('runs at most 4 requests at once and starts the next as one finishes', async () => {
    const inflight: Deferred[] = [];
    let peak = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string, init: RequestInit) =>
          new Promise((resolve, reject) => {
            const entry: Deferred = {
              url,
              signal: init.signal,
              resolve: (body) => {
                inflight.splice(inflight.indexOf(entry), 1);
                resolve(okResponse(body));
              },
              reject,
            };
            inflight.push(entry);
            peak = Math.max(peak, inflight.length);
          }),
      ),
    );

    const ids = ['701', '702', '703', '704', '705', '706'];
    const results = ids.map((id) => getVimeoThumb(id));

    await vi.waitFor(() => expect(inflight).toHaveLength(4));
    await new Promise((r) => setTimeout(r, 20));
    expect(inflight).toHaveLength(4);
    expect(peak).toBe(4);

    inflight[0].resolve({ thumbnail_url: 'https://i.vimeocdn.com/a' });
    await vi.waitFor(() => expect(inflight).toHaveLength(4));
    expect(peak).toBe(4);

    while (inflight.length) {
      inflight[0].resolve({ thumbnail_url: 'https://i.vimeocdn.com/x' });
      await new Promise((r) => setTimeout(r, 0));
    }
    const settled = await Promise.all(results);
    expect(settled.every((s) => typeof s === 'string')).toBe(true);
    expect(peak).toBe(4);
  });
});
