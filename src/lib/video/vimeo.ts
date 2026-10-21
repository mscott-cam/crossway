import { readCache, writeCache } from '../cache';
import { isFixtureMode } from '../sanity/client';

const TIMEOUT_MS = 4000;
const CONCURRENCY = 4;
const OEMBED = 'https://vimeo.com/api/oembed.json';
const NUMERIC_ID = /^\d+$/;
const HASH = /^[a-z0-9]+$/i;

function withHash(id: string, hash: string | null | undefined): string | null {
  if (!NUMERIC_ID.test(id)) return null;
  return hash && HASH.test(hash) ? `${id}?h=${hash}` : id;
}

export function parseVimeoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split('/').filter(Boolean);

  if (host === 'player.vimeo.com') {
    if (segments.length !== 2 || segments[0] !== 'video') return null;
    return withHash(segments[1], parsed.searchParams.get('h'));
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    if (segments.length < 1 || segments.length > 2) return null;
    const hash = segments[1] ?? parsed.searchParams.get('h');
    if (segments[1] && !HASH.test(segments[1])) return null;
    return withHash(segments[0], hash);
  }
  return null;
}

let active = 0;
const waiting: Array<() => void> = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= CONCURRENCY) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    active += 1;
  }
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }
}

function cacheKey(id: string): string {
  return `vimeo-thumb-${id.replace('?h=', '-')}`;
}

function pageUrl(id: string): string {
  const [base, hash] = id.split('?h=');
  return hash
    ? `https://vimeo.com/${base}/${hash}`
    : `https://vimeo.com/${base}`;
}

export async function getVimeoThumb(id: string): Promise<string | null> {
  try {
    if (isFixtureMode()) return null;
    const key = cacheKey(id);
    const cached = readCache<string>(key);
    if (typeof cached === 'string' && cached) return cached;

    const endpoint = `${OEMBED}?url=${encodeURIComponent(pageUrl(id))}&width=1280`;
    const thumb = await limited(async () => {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { thumbnail_url?: unknown };
      return typeof body.thumbnail_url === 'string' && body.thumbnail_url
        ? body.thumbnail_url
        : null;
    });
    if (thumb) writeCache(key, thumb);
    return thumb;
  } catch {
    return null;
  }
}
