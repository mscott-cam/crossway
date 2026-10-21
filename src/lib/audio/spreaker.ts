import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import { ENTITY_ACTION, EntityDecoder } from '@nodable/entities';
import { readCache, writeCache } from '../cache';
import { isFixtureMode } from '../sanity/client';

export type Episode = {
  id: string;
  title: string;
  pubDate: string;
  mp3Url: string;
  durationSec?: number;
};

export const SPREAKER_FEED_URL =
  'https://www.spreaker.com/show/2817602/episodes/feed';
const FIXTURE_FEED = 'tests/fixtures/spreaker-feed.xml';
const CACHE_KEY = 'spreaker-feed';
const TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 750;
const EPISODE_ID = /\/episode\/(\d+)\//;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name) => name === 'item',
  processEntities: {
    enabled: true,
    maxEntitySize: 1000,
    maxEntityCount: 10,
    maxTotalExpansions: 10000,
    maxExpandedLength: 1_000_000,
  },
  entityDecoder: new EntityDecoder({
    numericAllowed: true,
    limit: {
      maxTotalExpansions: 10000,
      maxExpandedLength: 1_000_000,
      applyLimitsTo: 'all',
    },
    onInputEntity: () => ENTITY_ACTION.BLOCK,
  }) as any,
});

const text = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

function parseDuration(value: unknown): number | undefined {
  const raw = text(value);
  if (!/^\d+(:\d{1,2}){0,2}$/.test(raw)) return undefined;
  return raw.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function parseItem(item: Record<string, any>): Episode | undefined {
  const enclosure = Array.isArray(item.enclosure)
    ? item.enclosure[0]
    : item.enclosure;
  const mp3Url = text(enclosure?.['@_url']);
  const id = EPISODE_ID.exec(mp3Url)?.[1];
  const published = new Date(text(item.pubDate));
  if (!id || Number.isNaN(published.getTime())) return undefined;
  const durationSec = parseDuration(item['itunes:duration']);
  return {
    id,
    title: text(item.title),
    pubDate: published.toISOString(),
    mp3Url,
    ...(durationSec !== undefined ? { durationSec } : {}),
  };
}

export function parseSpreakerFeed(xml: string): Episode[] {
  try {
    if (SyntaxValidator.validate(xml) !== true) return [];
    const items = parser.parse(xml)?.rss?.channel?.item;
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      const episode =
        item && typeof item === 'object' ? parseItem(item) : undefined;
      return episode ? [episode] : [];
    });
  } catch {
    return [];
  }
}

async function requestFeed(): Promise<Episode[]> {
  const response = await fetch(SPREAKER_FEED_URL, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const episodes = parseSpreakerFeed(await response.text());
  if (episodes.length === 0) throw new Error('feed had no readable episodes');
  return episodes;
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function loadFeed(retryDelayMs: number): Promise<Episode[]> {
  if (isFixtureMode()) {
    const xml = await readFile(join(process.cwd(), FIXTURE_FEED), 'utf8');
    return parseSpreakerFeed(xml);
  }
  try {
    let episodes: Episode[];
    try {
      episodes = await requestFeed();
    } catch {
      await wait(retryDelayMs);
      episodes = await requestFeed();
    }
    writeCache(CACHE_KEY, episodes);
    return episodes;
  } catch (error) {
    const cached = readCache<Episode[]>(CACHE_KEY);
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[spreaker] feed unavailable (${message}); using ${Array.isArray(cached) ? 'cached feed' : 'no audio feed'}.`,
    );
    return Array.isArray(cached) ? cached : [];
  }
}

let pending: Promise<Episode[]> | undefined;

export function fetchSpreakerFeed(
  options: { retryDelayMs?: number } = {},
): Promise<Episode[]> {
  pending ??= loadFeed(options.retryDelayMs ?? RETRY_DELAY_MS).catch(
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[spreaker] could not read the feed: ${message}`);
      return [];
    },
  );
  return pending;
}
