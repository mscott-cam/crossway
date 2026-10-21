import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { eventSpan, toChicagoDate } from '../dates';
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
const MAX_RETRY_AFTER_MS = 5000;

type Json = Record<string, any>;

class PcoError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

type FetchOptions = {
  retryDelayMs?: number;
  maxRetryAfterMs?: number;
  timeoutMs?: number;
};

type Settings = Required<FetchOptions>;

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

function isUpcoming(
  start: Date,
  end: Date | undefined,
  allDay: boolean,
  now: Date,
): boolean {
  if (allDay) {
    const { last } = eventSpan({
      startsAt: start.toISOString(),
      endsAt: end?.toISOString(),
      allDay,
    });
    return last >= toChicagoDate(now);
  }
  if (start.getTime() >= now.getTime()) return true;
  return end !== undefined && end.getTime() > now.getTime();
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
    if (!start || !name) continue;
    const allDay = attrs.all_day_event === true;
    const end = validDate(attrs.ends_at);
    if (!isUpcoming(start, end, allDay, now)) continue;

    const id = String(eventId);
    const location = text(attrs.location);
    const imageUrl = safeImage(eventAttrs.image_url);
    candidates.push({
      startMs: start.getTime(),
      event: {
        id,
        name,
        startsAt: text(attrs.starts_at),
        ...(end ? { endsAt: text(attrs.ends_at) } : {}),
        allDay,
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

function retryAfterMs(header: string | null | undefined, cap: number) {
  const seconds = Number(header?.trim());
  if (!header || !/^\d+$/.test(header.trim()) || !Number.isFinite(seconds)) {
    return undefined;
  }
  return Math.min(seconds * 1000, cap);
}

async function requestPage(
  url: string,
  authorization: string,
  settings: Settings,
): Promise<Json> {
  const response = await fetch(url, {
    headers: { Authorization: authorization, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(settings.timeoutMs),
  });
  if (!response.ok) {
    const { status } = response;
    if (status === 429) {
      throw new PcoError(
        `HTTP ${status}`,
        true,
        retryAfterMs(
          response.headers?.get('retry-after'),
          settings.maxRetryAfterMs,
        ),
      );
    }
    throw new PcoError(`HTTP ${status}`, status >= 500);
  }
  const body: unknown = await response.json();
  if (!isObject(body)) throw new PcoError('unexpected response');
  return body;
}

async function requestWithRetry(
  url: string,
  authorization: string,
  settings: Settings,
): Promise<Json> {
  try {
    return await requestPage(url, authorization, settings);
  } catch (error) {
    if (error instanceof PcoError && !error.retryable) throw error;
    const delay =
      error instanceof PcoError && error.retryAfterMs !== undefined
        ? error.retryAfterMs
        : settings.retryDelayMs;
    await wait(delay);
    return requestPage(url, authorization, settings);
  }
}

function nextPageUrl(body: Json): string | undefined {
  const next = text(body.links?.next);
  if (!next) return undefined;
  const url = new URL(next);
  if (url.protocol !== 'https:' || url.hostname !== API_HOST) {
    throw new PcoError('unexpected next page link', false);
  }
  return url.href;
}

function reason(error: unknown): string {
  if (error instanceof PcoError) return error.message;
  return error instanceof Error ? error.name : 'unknown error';
}

async function fetchFromApi(
  appId: string,
  secret: string,
  settings: Settings,
): Promise<ChurchEvent[]> {
  const authorization = `Basic ${Buffer.from(`${appId}:${secret}`).toString('base64')}`;
  const data: unknown[] = [];
  const included: unknown[] = [];
  let url: string | undefined = INSTANCES_URL;
  for (let page = 0; url && page < MAX_PAGES; page += 1) {
    let body: Json;
    try {
      body = await requestWithRetry(url, authorization, settings);
    } catch (error) {
      if (page === 0) throw error;
      console.warn(
        `[events] a later page of Planning Center events failed (${reason(error)}); showing the events loaded so far.`,
      );
      url = undefined;
      break;
    }
    if (Array.isArray(body.data)) data.push(...body.data);
    if (Array.isArray(body.included)) included.push(...body.included);
    try {
      url = nextPageUrl(body);
    } catch (error) {
      console.warn(
        `[events] the next page of Planning Center events was refused (${reason(error)}); showing the events loaded so far.`,
      );
      url = undefined;
    }
  }
  if (url) {
    console.warn(
      `[events] more than ${MAX_PAGES} pages of Planning Center events; the list is truncated.`,
    );
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

async function loadEvents(settings: Settings): Promise<ChurchEvent[] | null> {
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
    return await fetchFromApi(appId, secret, settings);
  } catch (error) {
    console.warn(
      `[events] Planning Center events unavailable (${reason(error)}); linking to Church Center instead.`,
    );
    return null;
  }
}

let pending: Promise<ChurchEvent[] | null> | undefined;

export async function fetchUpcomingEvents(
  limit?: number,
  options: FetchOptions = {},
): Promise<ChurchEvent[] | null> {
  pending ??= loadEvents({
    retryDelayMs: options.retryDelayMs ?? RETRY_DELAY_MS,
    maxRetryAfterMs: options.maxRetryAfterMs ?? MAX_RETRY_AFTER_MS,
    timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
  });
  const events = await pending;
  if (!events) return null;
  return limit === undefined ? events : events.slice(0, Math.max(0, limit));
}
