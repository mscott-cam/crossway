import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { matchAudio } from '../audio/match-audio';
import { fetchSpreakerFeed } from '../audio/spreaker';
import { writeCache } from '../cache';
import { sermonSlug } from '../slug';
import { env, getClient, isFixtureMode, isSanityConfigured } from './client';
import type {
  Leader,
  LeaderGroup,
  SanityImage,
  Series,
  Sermon,
  SiteSettings,
  Speaker,
  SundayCardRow,
} from './types';

export { isSanityConfigured } from './client';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
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
};

const IMAGE = `{alt, asset->{url, metadata{dimensions{width, height}}}}`;
const SPEAKER = `{_id, name, slug, role}`;
const SERIES = `{_id, title, slug, description, isStandalone, artwork${IMAGE}}`;

const SERMONS_QUERY = `*[_type == "sermon" && defined(date)] | order(date desc, title asc) {
  _id, title, date, book, passage, vimeoUrl, slug, description,
  audioOverrideUrl, spreakerEpisodeId, webflowPath,
  speaker->${SPEAKER},
  series->${SERIES}
}`;
const SERIES_QUERY = `*[_type == "series"] | order(title asc) ${SERIES}`;
const SPEAKERS_QUERY = `*[_type == "speaker"] | order(name asc) ${SPEAKER}`;
const LEADERS_QUERY = `*[_type == "leader"] | order(order asc, name asc) {
  _id, name, role, group, order, photo${IMAGE}
}`;
const SETTINGS_QUERY = `*[_type == "siteSettings" && _id == "siteSettings"][0] {
  serviceTimes,
  sundayCardRows[]{label, value, href},
  announcement{enabled, text, href},
  showEntrustedOnHome
}`;

type Raw = Record<string, any> | null | undefined;

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

const slugOf = (value: unknown): string | undefined =>
  str(value) ?? str((value as Raw)?.current);

function normalizeImage(raw: Raw): SanityImage | undefined {
  if (!raw) return undefined;
  const url = str(raw.url) ?? str(raw.asset?.url);
  const dims = raw.asset?.metadata?.dimensions;
  const width = Number(raw.width ?? dims?.width);
  const height = Number(raw.height ?? dims?.height);
  if (!url || !width || !height) return undefined;
  const alt = str(raw.alt);
  return { url, width, height, ...(alt ? { alt } : {}) };
}

function normalizeSpeaker(raw: Raw): Speaker | undefined {
  const slug = slugOf(raw?.slug);
  if (!raw || !str(raw._id) || !str(raw.name) || !slug) return undefined;
  const role = str(raw.role);
  return {
    _id: raw._id,
    name: raw.name,
    slug,
    ...(role ? { role } : {}),
  };
}

function normalizeSeries(raw: Raw): Series | undefined {
  const slug = slugOf(raw?.slug);
  if (!raw || !str(raw._id) || !str(raw.title) || !slug) return undefined;
  const artwork = normalizeImage(raw.artwork);
  const description = str(raw.description);
  return {
    _id: raw._id,
    title: raw.title,
    slug,
    isStandalone: raw.isStandalone === true,
    ...(artwork ? { artwork } : {}),
    ...(description ? { description } : {}),
  };
}

function normalizeSermon(raw: Raw): Sermon | undefined {
  if (!raw || !str(raw._id) || !str(raw.title) || !str(raw.date)) {
    return undefined;
  }
  const speaker = normalizeSpeaker(raw.speaker);
  const series = normalizeSeries(raw.series);
  if (!series) return undefined;
  const book = str(raw.book);
  const optional = Object.fromEntries(
    (
      [
        'passage',
        'vimeoUrl',
        'description',
        'audioOverrideUrl',
        'spreakerEpisodeId',
        'webflowPath',
      ] as const
    )
      .map((key) => [key, str(raw[key])] as const)
      .filter(([, value]) => value !== undefined),
  );
  return {
    _id: raw._id,
    title: raw.title,
    date: raw.date,
    series,
    ...(speaker ? { speaker } : {}),
    ...(book ? { book } : {}),
    slug: slugOf(raw.slug) ?? sermonSlug(raw.title, raw.date),
    ...optional,
  };
}

function normalizeLeader(raw: Raw): Leader | undefined {
  if (!raw || !str(raw._id) || !str(raw.name) || !str(raw.group)) {
    return undefined;
  }
  const role = str(raw.role);
  const photo = normalizeImage(raw.photo);
  return {
    _id: raw._id,
    name: raw.name,
    group: raw.group as LeaderGroup,
    order: typeof raw.order === 'number' ? raw.order : 100,
    ...(role ? { role } : {}),
    ...(photo ? { photo } : {}),
  };
}

function normalizeRows(raw: unknown): SundayCardRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows = raw.flatMap((row: Raw) => {
    const label = str(row?.label);
    const value = str(row?.value);
    if (!label || !value) return [];
    const href = str(row?.href);
    return [{ label, value, ...(href ? { href } : {}) }];
  });
  return rows.length > 0 ? rows : undefined;
}

function normalizeSettings(raw: Raw): SiteSettings {
  const times = Array.isArray(raw?.serviceTimes)
    ? raw.serviceTimes.filter((t: unknown) => str(t))
    : [];
  const text = str(raw?.announcement?.text);
  const href = str(raw?.announcement?.href);
  return {
    serviceTimes: times.length > 0 ? times : DEFAULT_SITE_SETTINGS.serviceTimes,
    sundayCardRows:
      normalizeRows(raw?.sundayCardRows) ??
      DEFAULT_SITE_SETTINGS.sundayCardRows,
    announcement: {
      enabled: raw?.announcement?.enabled === true,
      ...(text ? { text } : {}),
      ...(href ? { href } : {}),
    },
    showEntrustedOnHome:
      typeof raw?.showEntrustedOnHome === 'boolean'
        ? raw.showEntrustedOnHome
        : DEFAULT_SITE_SETTINGS.showEntrustedOnHome,
  };
}

const present = <T>(value: T | undefined): value is T => value !== undefined;

const list =
  <T>(label: string, normalize: (raw: Raw) => T | undefined) =>
  (raw: unknown): T[] => {
    if (!Array.isArray(raw)) return [];
    const kept: T[] = [];
    const dropped: string[] = [];
    for (const row of raw as Raw[]) {
      const value = normalize(row);
      if (value === undefined) dropped.push(str(row?._id) ?? '(no id)');
      else kept.push(value);
    }
    if (dropped.length > 0) {
      console.warn(
        `[sanity] ${label} dropped ${dropped.length} incomplete row(s): ${dropped.join(', ')}`,
      );
    }
    return kept;
  };

const FIXTURE_DIR = 'tests/fixtures/sanity';

function fixtureDir(): string {
  const name = env('SANITY_FIXTURE_DIR');
  return /^tests\/fixtures\/[a-z0-9-]+$/i.test(name) ? name : FIXTURE_DIR;
}

async function readFixture(file: string): Promise<unknown> {
  const text = await readFile(join(process.cwd(), fixtureDir(), file), 'utf8');
  return JSON.parse(text);
}

function settingsFixtureFile(): string {
  const name = env('SANITY_FIXTURE_SETTINGS');
  return /^[a-z0-9-]+$/i.test(name) ? `settings.${name}.json` : 'settings.json';
}

let warnedUnconfigured = false;

async function load<T>(
  label: string,
  fixture: () => string,
  query: string,
  normalize: (raw: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    if (isFixtureMode()) return normalize(await readFixture(fixture()));
    if (!isSanityConfigured()) {
      if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        console.warn(
          '[sanity] SANITY_PROJECT_ID is not set; using empty content and default settings.',
        );
      }
      return fallback;
    }
    return normalize(await getClient().fetch(query));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[sanity] ${label} failed; using fallback data: ${message}`);
    return fallback;
  }
}

function memoize<T>(fn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= fn());
}

const sortSermons = (sermons: Sermon[]) =>
  sermons.sort(
    (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title),
  );

async function withAudio(sermons: Sermon[]): Promise<Sermon[]> {
  if (sermons.length === 0) return sermons;
  try {
    const episodes = await fetchSpreakerFeed();
    const {
      sermons: matched,
      unmatchedSermons,
      unmatchedEpisodes,
    } = matchAudio(sermons, episodes);
    if (episodes.length > 0 && !isFixtureMode()) {
      writeCache('audio-report', {
        generatedAt: new Date().toISOString(),
        unmatchedSermons: unmatchedSermons.map(({ slug, title, date }) => ({
          slug,
          title,
          date,
        })),
        unmatchedEpisodes: unmatchedEpisodes.map(({ id, title, pubDate }) => ({
          id,
          title,
          pubDate,
        })),
      });
    }
    return matched;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[audio] matching failed; sermons have no audio: ${message}`);
    return sermons;
  }
}

export const getSermons = memoize(async () =>
  withAudio(
    await load(
      'getSermons',
      () => 'sermons.json',
      SERMONS_QUERY,
      (raw) => sortSermons(list('getSermons', normalizeSermon)(raw)),
      [],
    ),
  ),
);

export const getSeriesList = memoize(() =>
  load(
    'getSeriesList',
    () => 'series.json',
    SERIES_QUERY,
    list('getSeriesList', normalizeSeries),
    [],
  ),
);

export const getSpeakers = memoize(() =>
  load(
    'getSpeakers',
    () => 'speakers.json',
    SPEAKERS_QUERY,
    list('getSpeakers', normalizeSpeaker),
    [],
  ),
);

export const getLeaders = memoize(() =>
  load(
    'getLeaders',
    () => 'leaders.json',
    LEADERS_QUERY,
    (raw) =>
      list(
        'getLeaders',
        normalizeLeader,
      )(raw).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [],
  ),
);

export const getSiteSettings = memoize(() =>
  load(
    'getSiteSettings',
    settingsFixtureFile,
    SETTINGS_QUERY,
    (raw) => normalizeSettings(raw as Raw),
    DEFAULT_SITE_SETTINGS,
  ),
);
