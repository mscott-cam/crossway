import { createHash, timingSafeEqual } from 'node:crypto';

type Env = Record<string, string | undefined>;

export type RebuildDeps = {
  env: Env;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
};

const HOOK_TIMEOUT_MS = 10_000;
const HOOK_HOST = 'api.vercel.com';
const HOOK_PATH_PREFIX = '/v1/integrations/deploy/';

const digest = (value: string) => createHash('sha256').update(value).digest();

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function isDeployHookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === HOOK_HOST &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.pathname.startsWith(HOOK_PATH_PREFIX) &&
    url.pathname.length > HOOK_PATH_PREFIX.length
  );
}

const json = (body: { ok: boolean }, status: number, extra?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });

const configured = (value: string | undefined) =>
  value !== undefined && value.trim() !== '' ? value.trim() : undefined;

function bearerToken(header: string | null): string {
  if (!header) return '';
  const match = /^Bearer (.*)$/.exec(header);
  return match ? match[1] : '';
}

export async function handleRebuild(
  request: Request,
  deps: RebuildDeps,
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ ok: false }, 405, { Allow: 'GET' });
  }

  const secret = configured(deps.env.CRON_SECRET);
  const hookUrl = configured(deps.env.VERCEL_DEPLOY_HOOK_URL);
  if (!secret || !hookUrl || !isDeployHookUrl(hookUrl)) {
    console.error('[rebuild] cron is not configured; refusing');
    return json({ ok: false }, 503);
  }

  const token = bearerToken(request.headers.get('authorization'));
  if (!token || !safeEqual(token, secret)) {
    return json({ ok: false }, 401);
  }

  try {
    const response = await deps.fetch(hookUrl, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
    });
    if (response.status < 200 || response.status > 299) {
      console.error('[rebuild] deploy hook returned a non-success status');
      return json({ ok: false }, 502);
    }
  } catch {
    console.error('[rebuild] deploy hook request failed');
    return json({ ok: false }, 502);
  }

  console.info('[rebuild] deploy hook triggered');
  return json({ ok: true }, 200);
}
