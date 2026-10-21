import { BOOKS } from '../../src/lib/books';
import { toChicagoDate } from '../../src/lib/dates';
import { sermonSlug } from '../../src/lib/slug';

export type Row = Record<string, string>;

export const BOOK_ALIASES: Record<string, string> = {
  gen: 'Genesis',
  ex: 'Exodus',
  exod: 'Exodus',
  lev: 'Leviticus',
  num: 'Numbers',
  deut: 'Deuteronomy',
  josh: 'Joshua',
  judg: 'Judges',
  '1 sam': '1 Samuel',
  '2 sam': '2 Samuel',
  '1 kgs': '1 Kings',
  '2 kgs': '2 Kings',
  '1 chron': '1 Chronicles',
  '2 chron': '2 Chronicles',
  neh: 'Nehemiah',
  ps: 'Psalms',
  psa: 'Psalms',
  psalm: 'Psalms',
  prov: 'Proverbs',
  eccl: 'Ecclesiastes',
  eccles: 'Ecclesiastes',
  'song of solomon': 'Song of Songs',
  'songs of solomon': 'Song of Songs',
  'song of songs': 'Song of Songs',
  song: 'Song of Songs',
  isa: 'Isaiah',
  jer: 'Jeremiah',
  lam: 'Lamentations',
  ezek: 'Ezekiel',
  dan: 'Daniel',
  hab: 'Habakkuk',
  zeph: 'Zephaniah',
  zech: 'Zechariah',
  matt: 'Matthew',
  rom: 'Romans',
  '1 cor': '1 Corinthians',
  '2 cor': '2 Corinthians',
  gal: 'Galatians',
  eph: 'Ephesians',
  phil: 'Philippians',
  col: 'Colossians',
  '1 thess': '1 Thessalonians',
  '2 thess': '2 Thessalonians',
  '1 tim': '1 Timothy',
  '2 tim': '2 Timothy',
  philem: 'Philemon',
  heb: 'Hebrews',
  jas: 'James',
  '1 pet': '1 Peter',
  '2 pet': '2 Peter',
  '1 jn': '1 John',
  '2 jn': '2 John',
  '3 jn': '3 John',
  rev: 'Revelation',
  revelations: 'Revelation',
};

export const SERMON_COLUMNS = {
  title: ['Name', 'Title'],
  slug: ['Slug'],
  draft: ['Draft'],
  archived: ['Archived'],
  date: ['Date', 'Sermon Date'],
  publishedOn: ['Published On'],
  speaker: ['Speaker', 'Speaker Name'],
  series: ['Series', 'Sermon Series'],
  book: ['Book', 'Book of the Bible'],
  passage: ['Passage', 'Scripture'],
  vimeo: [
    'Vimeo URL',
    'Vimeo Embed',
    'Vimeo',
    'Video Link',
    'Video Embed',
    'Video',
  ],
  spreaker: [
    'Spreaker URL',
    'Spreaker Embed',
    'Spreaker',
    'Audio URL',
    'Audio',
  ],
  description: ['Description', 'Summary'],
};

export const SERIES_COLUMNS = {
  title: ['Name', 'Title'],
  slug: ['Slug'],
  draft: ['Draft'],
  archived: ['Archived'],
  artwork: ['Artwork', 'Image', 'Cover Image', 'Thumbnail', 'Series Image'],
  description: ['Description', 'Summary'],
};

export type ColumnOverrides = {
  sermons?: Partial<Record<keyof typeof SERMON_COLUMNS, string[]>>;
  series?: Partial<Record<keyof typeof SERIES_COLUMNS, string[]>>;
};

function mergeColumns<T extends Record<string, string[]>>(
  defaults: T,
  overrides: Partial<Record<keyof T, string[]>> = {},
): T {
  return Object.fromEntries(
    Object.entries(defaults).map(([field, names]) => [
      field,
      [...(overrides[field as keyof T] ?? []), ...names],
    ]),
  ) as T;
}

export function parseColumnMap(json: unknown): ColumnOverrides {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isObject(json)) throw new Error('Column map must be a JSON object');
  const groups = { sermons: SERMON_COLUMNS, series: SERIES_COLUMNS } as const;
  const out: Record<string, Record<string, string[]>> = {};
  for (const [group, fields] of Object.entries(json)) {
    if (!(group in groups))
      throw new Error(
        `Column map: unknown section "${group}" (use "sermons" or "series")`,
      );
    if (!isObject(fields))
      throw new Error(`Column map: "${group}" must be an object`);
    const known = groups[group as keyof typeof groups] as Record<
      string,
      string[]
    >;
    out[group] = {};
    for (const [field, names] of Object.entries(fields)) {
      if (!(field in known))
        throw new Error(
          `Column map: unknown field "${field}" in "${group}" (known: ${Object.keys(known).join(', ')})`,
        );
      if (
        !Array.isArray(names) ||
        !names.every((n) => typeof n === 'string' && n.trim())
      )
        throw new Error(
          `Column map: "${group}.${field}" must be an array of header names`,
        );
      out[group][field] = names;
    }
  }
  return out as ColumnOverrides;
}

const SERMON_REQUIRED = ['title', 'date', 'speaker', 'book'] as const;
const SERIES_REQUIRED = ['title'] as const;

export const STANDALONE_SLUG = 'stand-alone-messages';
export const STANDALONE_TITLE = 'Stand Alone Messages';

type Ref = { _type: 'reference'; _ref: string };
type Slug = { _type: 'slug'; current: string };

export type SpeakerDoc = {
  _id: string;
  _type: 'speaker';
  name: string;
  slug: Slug;
};

export type SeriesDoc = {
  _id: string;
  _type: 'series';
  title: string;
  slug: Slug;
  isStandalone: boolean;
  description?: string;
  artworkUrl?: string;
};

export type SermonDoc = {
  _id: string;
  _type: 'sermon';
  title: string;
  date: string;
  speaker?: Ref;
  series: Ref;
  book?: string;
  passage?: string;
  vimeoUrl?: string;
  slug: Slug;
  description?: string;
  spreakerEpisodeId?: string;
  webflowPath: string;
};

export type TransformStats = {
  sermonRows: number;
  skippedDraftOrArchived: number;
  skippedInvalid: number;
  sermons: number;
  withoutBook: number;
  withoutSpeaker: number;
  series: number;
  speakers: number;
};

export type TransformResult = {
  sermons: SermonDoc[];
  series: SeriesDoc[];
  speakers: SpeakerDoc[];
  problems: string[];
  stats: TransformStats;
};

const normHeader = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const normName = (s: string) =>
  clean(s).replace(/[‘’]/g, "'").replace(/&amp;/g, '&').toLowerCase();

function cells(row: Row, names: string[]): string[] {
  const wanted = names.map(normHeader);
  const out: string[] = [];
  for (const name of wanted) {
    for (const [key, value] of Object.entries(row)) {
      if (normHeader(key) === name && typeof value === 'string' && value.trim())
        out.push(value.trim());
    }
  }
  return out;
}

const cell = (row: Row, names: string[]) => cells(row, names)[0] ?? '';

const isTrue = (v: string) =>
  ['true', 'yes', '1'].includes(v.trim().toLowerCase());

function missingColumns(
  rows: Row[],
  map: Record<string, string[]>,
  required: readonly string[],
  label: string,
): string[] {
  if (!rows.length) return [];
  const headers = new Set(rows.flatMap((r) => Object.keys(r).map(normHeader)));
  return required
    .filter((field) => !map[field].some((n) => headers.has(normHeader(n))))
    .map(
      (field) =>
        `${label} CSV: no column found for "${field}" (looked for: ${map[field].join(', ')}). Adjust ${label === 'Sermons' ? 'SERMON_COLUMNS' : 'SERIES_COLUMNS'}.`,
    );
}

function decode(raw: string): string {
  let out = raw.replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  for (let i = 0; i < 2; i++) {
    try {
      out = decodeURIComponent(out);
    } catch {
      break;
    }
  }
  return out;
}

export function extractVimeoUrl(raw: string): string | undefined {
  const text = decode(raw);
  const page = text.match(
    /(?:https?:)?\/\/(?:www\.)?vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/|video\/)?(\d+)(?:\/([0-9a-f]{8,})|\?([^\s"'<>#]*))?/i,
  );
  if (page) {
    const queryHash = page[3]?.match(/(?:^|&)h=([0-9a-f]+)/i)?.[1];
    const playerHash = text.match(
      new RegExp(
        `player\\.vimeo\\.com/video/${page[1]}\\?[^"'\\s<>]*?\\bh=([0-9a-f]+)`,
        'i',
      ),
    )?.[1];
    const hash = queryHash ?? playerHash;
    const suffix = page[2] ? `/${page[2]}` : hash ? `?h=${hash}` : '';
    return `https://vimeo.com/${page[1]}${suffix}`;
  }
  const player = text.match(
    /player\.vimeo\.com\/video\/(\d+)(?:\?([^"'\s<>]*))?/i,
  );
  if (!player) return undefined;
  const hash = player[2]?.match(/(?:^|&)h=([0-9a-f]+)/i)?.[1];
  return `https://vimeo.com/${player[1]}${hash ? `/${hash}` : ''}`;
}

export function extractSpreakerId(raw: string): string | undefined {
  const text = decode(raw).trim();
  return (
    text.match(
      /spreaker\.com\/episode\/(?:[^\s"'<>?#]*--)?(\d+)(?=[\s"'<>?#/]|$)/i,
    )?.[1] ??
    text.match(/episode_id=(\d+)/i)?.[1] ??
    text.match(/^(\d+)$/)?.[1]
  );
}

function ymd(y: number, m: number, d: number): string | undefined {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return undefined;
  return [y, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
}

const HAS_ZONE = /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})\s*(?:\(.*\))?$/i;

export function parseSermonDate(raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return ymd(+iso[1], +iso[2], +iso[3]);
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return ymd(+us[3], +us[1], +us[2]);
  if (!/\b\d{4}\b/.test(v)) return undefined;
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return undefined;
  if (!HAS_ZONE.test(v))
    return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const atUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  if (atUtcMidnight)
    return ymd(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  return toChicagoDate(date);
}

const BOOK_BY_KEY = new Map(BOOKS.map((b) => [b.name.toLowerCase(), b.name]));
const ORDINALS: Record<string, string> = {
  i: '1',
  '1st': '1',
  first: '1',
  ii: '2',
  '2nd': '2',
  second: '2',
  iii: '3',
  '3rd': '3',
  third: '3',
};

function bookKey(raw: string): string {
  let key = clean(raw)
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/^([123])(?=[a-z])/, '$1 ');
  key = clean(key);
  const lead = key.match(/^(iii|ii|i|1st|2nd|3rd|first|second|third)\s+(.+)$/);
  if (lead) key = `${ORDINALS[lead[1]]} ${lead[2]}`;
  return key;
}

function lookupBook(raw: string): string | undefined {
  const key = bookKey(raw);
  return BOOK_BY_KEY.get(key) ?? BOOK_ALIASES[key];
}

export function normalizeBook(
  raw: string,
): { book: string; passage?: string } | undefined {
  const value = clean(raw);
  if (!value) return undefined;
  const direct = lookupBook(value);
  if (direct) return { book: direct };
  const ref = value.match(
    /^(.*?[A-Za-z.])\s+(\d+(?::\d+)?(?:\s*[-–—]\s*\d+(?::\d+)?)?)$/,
  );
  if (!ref) return undefined;
  const book = lookupBook(ref[1]);
  return book
    ? { book, passage: `${book} ${ref[2].replace(/\s+/g, '')}` }
    : undefined;
}

function plainText(raw: string): string {
  return clean(
    raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"'),
  );
}

const DESCRIPTION_LIMIT = 400;

const idPart = (slug: string) => slug.replace(/[^a-zA-Z0-9._-]/g, '-');

function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit - 1);
  const lastSpace = head.lastIndexOf(' ');
  const cut = lastSpace > limit / 2 ? head.slice(0, lastSpace) : head;
  return `${cut.replace(/[\s,;:.\-–—]+$/, '')}\u2026`;
}

const slugOf = (text: string) => sermonSlug(text, '');

export function transformRows(
  sermonsCsv: Row[],
  seriesCsv: Row[],
  overrides: ColumnOverrides = {},
): TransformResult {
  const sc = mergeColumns(SERMON_COLUMNS, overrides.sermons);
  const rc = mergeColumns(SERIES_COLUMNS, overrides.series);
  const problems: string[] = [];
  problems.push(
    ...missingColumns(sermonsCsv, sc, SERMON_REQUIRED, 'Sermons'),
    ...missingColumns(seriesCsv, rc, SERIES_REQUIRED, 'Series'),
  );

  const seriesBySlug = new Map<string, SeriesDoc>();
  const seriesBySlugKey = new Map<string, SeriesDoc>();
  const seriesByName = new Map<string, SeriesDoc>();
  seriesCsv.forEach((row, i) => {
    if (isTrue(cell(row, rc.draft)) || isTrue(cell(row, rc.archived))) return;
    const title = clean(cell(row, rc.title));
    if (!title) {
      problems.push(`series row ${i + 2}: no title - skipped`);
      return;
    }
    let slug = clean(cell(row, rc.slug));
    if (!slug) {
      slug = slugOf(title);
      problems.push(`series "${title}": no slug, using "${slug}"`);
    }
    if (seriesBySlug.has(slug)) return;
    const artwork = cell(row, rc.artwork);
    const description = plainText(cell(row, rc.description));
    if (artwork && !/^https?:\/\//i.test(artwork))
      problems.push(
        `series "${slug}": artwork "${artwork}" is not an http(s) URL - ignored`,
      );
    const doc: SeriesDoc = {
      _id: `series-${idPart(slug)}`,
      _type: 'series',
      title,
      slug: { _type: 'slug', current: slug },
      isStandalone:
        slug === STANDALONE_SLUG ||
        normName(title) === normName(STANDALONE_TITLE),
      ...(description && { description }),
      ...(/^https?:\/\//i.test(artwork) && { artworkUrl: artwork }),
    };
    seriesBySlug.set(slug, doc);
    seriesBySlugKey.set(normName(slug), doc);
    if (!seriesByName.has(normName(title)))
      seriesByName.set(normName(title), doc);
  });

  type Candidate = Omit<SermonDoc, 'speaker'> & {
    speakerKey: string;
    speakerName: string;
  };
  let withoutBook = 0;
  let withoutSpeaker = 0;
  const candidates: Candidate[] = [];
  const seenSlugs = new Set<string>();
  let standaloneUsed = false;
  let skippedDraftOrArchived = 0;
  let skippedInvalid = 0;

  sermonsCsv.forEach((row, i) => {
    if (isTrue(cell(row, sc.draft)) || isTrue(cell(row, sc.archived))) {
      skippedDraftOrArchived++;
      return;
    }
    const title = clean(cell(row, sc.title));
    let slug = clean(cell(row, sc.slug));
    const label = slug || title || `row ${i + 2}`;
    let valid = true;
    const notes: string[] = [];
    const fail = (message: string) => {
      problems.push(`sermon "${label}": ${message}`);
      valid = false;
    };

    if (!title) fail('no title - skipped');

    let date: string | undefined;
    const rawDate = cell(row, sc.date);
    if (rawDate) {
      date = parseSermonDate(rawDate);
      if (!date) fail(`could not parse date "${rawDate}" - skipped`);
    } else {
      const published = cell(row, sc.publishedOn);
      date = parseSermonDate(published);
      if (date)
        notes.push(
          `sermon "${label}": no Date, used Published On "${published}" (${date}) - check it`,
        );
      else fail('no usable Date or Published On - skipped');
    }

    if (!slug && title && date) {
      slug = sermonSlug(title, date);
      notes.push(
        `sermon "${title}": no slug, derived "${slug}" - the old URL may differ`,
      );
    }
    if (slug && seenSlugs.has(slug)) fail('duplicate slug - skipped');

    const speakerName = clean(cell(row, sc.speaker));
    const speakerKey = slugOf(speakerName);
    if (!speakerKey) {
      notes.push(
        `sermon "${label}": no speaker${speakerName ? ` ("${speakerName}")` : ''} - imported without speaker`,
      );
    }

    const rawBook = cell(row, sc.book);
    const book = normalizeBook(rawBook);
    if (!book) {
      notes.push(
        rawBook
          ? `sermon "${label}": unknown book "${rawBook}" - imported without book (add it to BOOK_ALIASES in scripts/lib/webflow-transform.ts)`
          : `sermon "${label}": no book - imported without book`,
      );
    }

    const vimeoValues = cells(row, sc.vimeo);
    const vimeoUrl = vimeoValues.map(extractVimeoUrl).find(Boolean);
    if (vimeoValues.length && !vimeoUrl)
      notes.push(
        `sermon "${label}": no Vimeo id found in "${vimeoValues[0].slice(0, 80)}" - imported without video`,
      );

    const spreakerValues = cells(row, sc.spreaker);
    const spreakerEpisodeId = spreakerValues
      .map(extractSpreakerId)
      .find(Boolean);
    if (spreakerValues.length && !spreakerEpisodeId)
      notes.push(
        `sermon "${label}": no Spreaker episode id found in "${spreakerValues[0].slice(0, 80)}" - imported without audio id`,
      );

    const rawSeries = clean(cell(row, sc.series));
    let seriesDoc = rawSeries
      ? (seriesBySlugKey.get(normName(rawSeries)) ??
        seriesByName.get(normName(rawSeries)))
      : undefined;
    if (rawSeries && !seriesDoc)
      notes.push(
        `sermon "${label}": series "${rawSeries}" not found - assigned to ${STANDALONE_TITLE}`,
      );

    const slugDate = slug.match(
      /-(\d{4}-\d{2}-\d{2})(?:-[0-9a-f]{4,6})?$/,
    )?.[1];
    if (valid && date && slugDate && slugDate !== date)
      notes.push(
        `sermon "${label}": date ${date} does not match the slug date ${slugDate}`,
      );

    if (!valid || !date) {
      skippedInvalid++;
      return;
    }

    seenSlugs.add(slug);
    problems.push(...notes);
    if (!speakerKey) withoutSpeaker++;
    if (!book) withoutBook++;
    if (!seriesDoc || seriesDoc.isStandalone) {
      seriesDoc =
        [...seriesBySlug.values()].find((s) => s.isStandalone) ?? undefined;
      standaloneUsed = true;
    }
    const seriesId = seriesDoc?._id ?? `series-${STANDALONE_SLUG}`;

    const fullDescription = plainText(cell(row, sc.description));
    const description = truncateAtWord(fullDescription, DESCRIPTION_LIMIT);
    if (description !== fullDescription)
      problems.push(
        `sermon "${label}": description was ${fullDescription.length} characters, truncated to fit the ${DESCRIPTION_LIMIT}-character limit`,
      );
    const passage = clean(cell(row, sc.passage)) || book?.passage;
    candidates.push({
      _id: `sermon-${idPart(slug)}`,
      _type: 'sermon',
      title,
      date,
      series: { _type: 'reference', _ref: seriesId },
      ...(book && { book: book.book }),
      ...(passage && { passage }),
      ...(vimeoUrl && { vimeoUrl }),
      slug: { _type: 'slug', current: slug },
      ...(description && { description }),
      ...(spreakerEpisodeId && { spreakerEpisodeId }),
      webflowPath: `/sermons/${slug}`,
      speakerKey,
      speakerName,
    });
  });

  const series = [...seriesBySlug.values()];
  if (standaloneUsed && !series.some((s) => s.isStandalone))
    series.push({
      _id: `series-${STANDALONE_SLUG}`,
      _type: 'series',
      title: STANDALONE_TITLE,
      slug: { _type: 'slug', current: STANDALONE_SLUG },
      isStandalone: true,
    });

  const spellings = new Map<string, Map<string, number>>();
  for (const c of candidates) {
    if (!c.speakerKey) continue;
    const counts = spellings.get(c.speakerKey) ?? new Map<string, number>();
    counts.set(c.speakerName, (counts.get(c.speakerName) ?? 0) + 1);
    spellings.set(c.speakerKey, counts);
  }
  const speakers: SpeakerDoc[] = [...spellings.entries()]
    .map(([key, counts]) => {
      const [name] = [...counts.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0];
      return {
        _id: `speaker-${idPart(key)}`,
        _type: 'speaker' as const,
        name,
        slug: { _type: 'slug' as const, current: key },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const sermons: SermonDoc[] = candidates.map(
    ({ speakerKey, speakerName: _name, ...rest }) => ({
      ...rest,
      ...(speakerKey && {
        speaker: {
          _type: 'reference' as const,
          _ref: `speaker-${idPart(speakerKey)}`,
        },
      }),
    }),
  );

  return {
    sermons,
    series,
    speakers,
    problems,
    stats: {
      sermonRows: sermonsCsv.length,
      skippedDraftOrArchived,
      skippedInvalid,
      sermons: sermons.length,
      withoutBook,
      withoutSpeaker,
      series: series.length,
      speakers: speakers.length,
    },
  };
}
