import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleRebuild,
  isDeployHookUrl,
  safeEqual,
} from '../../src/lib/ops/rebuild';
import * as route from '../../src/pages/api/cron/rebuild';

const SECRET = 'cron-secret-value-123';
const HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_abc/hook-token';

const req = (init: RequestInit & { auth?: string | null } = {}) => {
  const { auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (auth !== null && auth !== undefined) headers.set('authorization', auth);
  return new Request('https://crosswaysa.org/api/cron/rebuild', {
    method: 'GET',
    ...rest,
    headers,
  });
};

const okFetch = () => vi.fn(async () => new Response('{}', { status: 201 }));
const env = (extra: Record<string, string | undefined> = {}) => ({
  CRON_SECRET: SECRET,
  VERCEL_DEPLOY_HOOK_URL: HOOK,
  ...extra,
});

const consoleSpies = () =>
  (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeEqual', () => {
  it('matches equal strings only', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'abc')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('isDeployHookUrl', () => {
  it.each([
    [HOOK, true],
    ['http://api.vercel.com/v1/integrations/deploy/prj/x', false],
    ['https://evil.example/v1/integrations/deploy/prj/x', false],
    ['https://api.vercel.com.evil.example/v1/integrations/deploy/p/x', false],
    ['https://user:pw@api.vercel.com/v1/integrations/deploy/p/x', false],
    ['https://api.vercel.com:8443/v1/integrations/deploy/p/x', false],
    ['https://api.vercel.com/v2/other', false],
    ['not a url', false],
    ['', false],
  ])('%s -> %s', (url, expected) => {
    expect(isDeployHookUrl(url)).toBe(expected);
  });
});

describe('handleRebuild auth', () => {
  it.each([
    ['missing header', null],
    ['wrong token', 'Bearer nope'],
    ['wrong scheme', `Basic ${SECRET}`],
    ['bare token', SECRET],
    ['empty bearer', 'Bearer '],
  ])('returns 401 for %s without calling the hook', async (_n, auth) => {
    const fetch = okFetch();
    const res = await handleRebuild(req({ auth }), { env: env(), fetch });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('handleRebuild fail closed', () => {
  it.each([
    ['CRON_SECRET unset', { CRON_SECRET: undefined }],
    ['CRON_SECRET blank', { CRON_SECRET: '  ' }],
    ['hook unset', { VERCEL_DEPLOY_HOOK_URL: undefined }],
    ['hook blank', { VERCEL_DEPLOY_HOOK_URL: '' }],
    [
      'hook not on api.vercel.com',
      { VERCEL_DEPLOY_HOOK_URL: 'https://evil.example/hook' },
    ],
    [
      'hook not https',
      {
        VERCEL_DEPLOY_HOOK_URL:
          'http://api.vercel.com/v1/integrations/deploy/p/x',
      },
    ],
  ])('returns 503 when %s', async (_n, extra) => {
    const fetch = okFetch();
    const res = await handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
      env: env(extra),
      fetch,
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is closed even when the request carries an empty bearer and no secret is set', async () => {
    const res = await handleRebuild(req({ auth: 'Bearer ' }), {
      env: env({ CRON_SECRET: undefined }),
      fetch: okFetch(),
    });
    expect(res.status).toBe(503);
  });
});

describe('handleRebuild success', () => {
  it('POSTs the hook once without following redirects and returns 200', async () => {
    const fetch = okFetch();
    const res = await handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
      env: env(),
      fetch,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(HOOK);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.body).toBeUndefined();
  });

  it('sets no-store on every response', async () => {
    const cases = [
      await handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
        env: env(),
        fetch: okFetch(),
      }),
      await handleRebuild(req(), { env: env(), fetch: okFetch() }),
      await handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
        env: {},
        fetch: okFetch(),
      }),
      await handleRebuild(req({ method: 'POST' }), {
        env: env(),
        fetch: okFetch(),
      }),
      await handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
        env: env(),
        fetch: async () => new Response('', { status: 500 }),
      }),
    ];
    for (const res of cases) {
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });
});

describe('handleRebuild hook failure', () => {
  it.each([
    ['non-2xx', async () => new Response('', { status: 500 })],
    ['redirect', async () => new Response('', { status: 302 })],
    [
      'network error',
      async () => {
        throw new Error('boom');
      },
    ],
    [
      'timeout',
      async () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    ],
  ])('returns 502 on %s', async (_n, impl) => {
    const res = await handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
      env: env(),
      fetch: vi.fn(impl),
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe('handleRebuild methods', () => {
  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
    'returns 405 with Allow: GET for %s',
    async (method) => {
      const fetch = okFetch();
      const res = await handleRebuild(
        req({ method, auth: `Bearer ${SECRET}` }),
        { env: env(), fetch },
      );
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('returns 405 for HEAD', async () => {
    const res = await handleRebuild(
      req({ method: 'HEAD', auth: `Bearer ${SECRET}` }),
      { env: env(), fetch: okFetch() },
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
  });
});

describe('handleRebuild logging', () => {
  it('never logs the secret, the bearer or the hook URL', async () => {
    const spies = consoleSpies();
    const scenarios: Array<() => Promise<Response>> = [
      () =>
        handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
          env: env(),
          fetch: okFetch(),
        }),
      () =>
        handleRebuild(req({ auth: `Bearer wrong-${SECRET}` }), {
          env: env(),
          fetch: okFetch(),
        }),
      () =>
        handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
          env: env(),
          fetch: async () => {
            throw new Error(`failed calling ${HOOK} with ${SECRET}`);
          },
        }),
      () =>
        handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
          env: env(),
          fetch: async () => new Response(HOOK, { status: 500 }),
        }),
      () =>
        handleRebuild(req({ auth: `Bearer ${SECRET}` }), {
          env: env({
            VERCEL_DEPLOY_HOOK_URL: `https://evil.example/${SECRET}`,
          }),
          fetch: okFetch(),
        }),
    ];
    for (const run of scenarios) await run();
    const output = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(output).not.toContain(SECRET);
    expect(output).not.toContain('hook-token');
    expect(output).not.toContain('api.vercel.com');
    expect(output).not.toContain('evil.example');
  });
});

describe('rebuild route', () => {
  it('is not prerendered and exports GET and ALL', () => {
    expect(route.prerender).toBe(false);
    expect(typeof route.GET).toBe('function');
    expect(typeof route.ALL).toBe('function');
  });

  it('fails closed through the route when env is unset', async () => {
    vi.stubEnv('CRON_SECRET', '');
    vi.stubEnv('VERCEL_DEPLOY_HOOK_URL', '');
    const res = await (route.GET as (c: unknown) => Promise<Response>)({
      request: req({ auth: 'Bearer anything' }),
    });
    expect(res.status).toBe(503);
    vi.unstubAllEnvs();
  });

  it('rejects other methods through ALL', async () => {
    const res = await (route.ALL as (c: unknown) => Promise<Response>)({
      request: req({ method: 'POST' }),
    });
    expect(res.status).toBe(405);
  });
});

describe('vercel.json', () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'),
  );

  it('declares the daily rebuild cron at 11:00 UTC', () => {
    expect(config.crons).toEqual([
      { path: '/api/cron/rebuild', schedule: '0 11 * * *' },
    ]);
  });

  it('has a schema and does not set trailingSlash', () => {
    expect(config.$schema).toBe('https://openapi.vercel.sh/vercel.json');
    expect('trailingSlash' in config).toBe(false);
  });
});
