import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env, isFixtureMode } from '../sanity/client';

export type ChurchEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  location?: string;
  imageUrl?: string;
  url: string;
};

const API_HOST = 'api.planningcenteronline.com';
const INSTANCES_URL = `https://${API_HOST}/calendar/v2/event_instances?filter=future&include=event&order=starts_at&per_page=100`;
const CHURCH_CENTER_EVENT =
  'https://crosswaysa.churchcenter.com/calendar/event/';
const FIXTURE_FILE = 'tests/fixtures/pco/event_instances.json';
const FIXTURE_NOW = new Date('2026-10-20T12:00:00-05:00');
const MAX_PAGES = 5;
const TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 750;

type Json = Record<string, any>;

class PcoError extends Error {}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

function validDate(value: unknown): Date | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function churchCenterUrl(candidate: unknown, eventId: string): string {
  const raw = text(candidate);
  try {
    const url = new URL(raw);
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'churchcenter.com' ||
        url.hostname.endsWith('.churchcenter.com'))
    ) {
      return url.href;
    }
  } catch {}
  return `${CHURCH_CENTER_EVENT}${encodeURIComponent(eventId)}`;
}

function safeImage(value: unknown): string | undefined {
  const raw = text(value);
  return /^https:\/\/\S+$/.test(raw) || /^\/(?!\/)\S*$/.test(raw)
    ? raw
    : undefined;
}

export function mapPcoEvents(json: unknown, now: Date): ChurchEvent[] {
  if (!isObject(json) || !Array.isArray(json.data)) return [];
  const events = new Map<string, Json>();
  if (Array.isArray(json.included)) {
    for (const item of json.included) {
      if (isObject(item) && item.type === 'Event' && item.id != null) {
        events.set(String(item.id), item.attributes ?? {});
      }
    }
  }

  const candidates: { startMs: number; event: ChurchEvent }[] = [];
  for (const item of json.data) {
    if (!isObject(item) || !isObject(item.attributes)) continue;
    const eventId = item.relationships?.event?.data?.id;
    if (eventId == null) continue;
    const eventAttrs = events.get(String(eventId));
    if (
      !eventAttrs ||
      eventAttrs.visible_in_church_center !== true ||
      eventAttrs.link_only === true
    ) {
      continue;
    }
    const attrs = item.attributes;
    const start = validDate(attrs.starts_at);
    const name = text(attrs.name) || text(eventAttrs.name);
    if (!start || !name || start.getTime() < now.getTime()) continue;

    const id = String(eventId);
    const end = validDate(attrs.ends_at);
    const location = text(attrs.location);
    const imageUrl = safeImage(eventAttrs.image_url);
    candidates.push({
      startMs: start.getTime(),
      event: {
        id,
        name,
        startsAt: text(attrs.starts_at),
        ...(end ? { endsAt: text(attrs.ends_at) } : {}),
        allDay: attrs.all_day_event === true,
        ...(location ? { location } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        url: churchCenterUrl(attrs.church_center_url, id),
      },
    });
  }

  candidates.sort((a, b) => a.startMs - b.startMs);
  const seen = new Set<string>();
  return candidates.flatMap(({ event }) => {
    if (seen.has(event.id)) return [];
    seen.add(event.id);
    return [event];
  });
}

const wait = (ms: number) =>
  new Promise<void>((resolveWait) => setTimeout(resolveWait, ms));

async function requestPage(url: string, authorization: string): Promise<Json> {
  const response = await fetch(url, {
    headers: { Authorization: authorization, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new PcoError(`HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!isObject(body)) throw new PcoError('unexpected response');
  return body;
}

async function requestWithRetry(
  url: string,
  authorization: string,
  retryDelayMs: number,
): Promise<Json> {
  try {
    return await requestPage(url, authorization);
  } catch {
    await wait(retryDelayMs);
    return requestPage(url, authorization);
  }
}

function nextPageUrl(body: Json): string | undefined {
  const next = text(body.links?.next);
  if (!next) return undefined;
  const url = new URL(next);
  if (url.protocol !== 'https:' || url.hostname !== API_HOST) {
    throw new PcoError('unexpected next page link');
  }
  return url.href;
}

async function fetchFromApi(
  appId: string,
  secret: string,
  retryDelayMs: number,
): Promise<ChurchEvent[]> {
  const authorization = `Basic ${Buffer.from(`${appId}:${secret}`).toString('base64')}`;
  const data: unknown[] = [];
  const included: unknown[] = [];
  let url: string | undefined = INSTANCES_URL;
  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    const body = await requestWithRetry(url, authorization, retryDelayMs);
    if (Array.isArray(body.data)) data.push(...body.data);
    if (Array.isArray(body.included)) included.push(...body.included);
    url = nextPageUrl(body);
  }
  return mapPcoEvents({ data, included }, new Date());
}

async function readFixture(): Promise<ChurchEvent[]> {
  const file = env('PCO_FIXTURE_FILE') || FIXTURE_FILE;
  const json: unknown = JSON.parse(
    await readFile(resolve(process.cwd(), file), 'utf8'),
  );
  return mapPcoEvents(json, FIXTURE_NOW);
}

async function loadEvents(retryDelayMs: number): Promise<ChurchEvent[] | null> {
  try {
    if (isFixtureMode()) return await readFixture();
    const appId = env('PCO_APP_ID');
    const secret = env('PCO_SECRET');
    if (!appId || !secret) {
      console.warn(
        '[events] PCO_APP_ID and PCO_SECRET are not set; events are unavailable.',
      );
      return null;
    }
    return await fetchFromApi(appId, secret, retryDelayMs);
  } catch (error) {
    const reason =
      error instanceof PcoError
        ? error.message
        : error instanceof Error
          ? error.name
          : 'unknown error';
    console.warn(
      `[events] Planning Center events unavailable (${reason}); linking to Church Center instead.`,
    );
    return null;
  }
}

let pending: Promise<ChurchEvent[] | null> | undefined;

export async function fetchUpcomingEvents(
  limit?: number,
  options: { retryDelayMs?: number } = {},
): Promise<ChurchEvent[] | null> {
  pending ??= loadEvents(options.retryDelayMs ?? RETRY_DELAY_MS);
  const events = await pending;
  if (!events) return null;
  return limit === undefined ? events : events.slice(0, Math.max(0, limit));
}
