import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import {
  BOOK_ALIASES,
  extractSpreakerId,
  extractVimeoUrl,
  normalizeBook,
  parseSermonDate,
  transformRows,
  type Row,
} from '../../scripts/lib/webflow-transform';
import {
  chunk,
  commitInBatches,
  formatReport,
  parseArgs,
} from '../../scripts/lib/import-cli';

const readCsv = (name: string): Row[] =>
  parse(readFileSync(`tests/fixtures/webflow/${name}`, 'utf8'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
  });

const sermonsCsv = readCsv('sermons.sample.csv');
const seriesCsv = readCsv('series.sample.csv');
const result = transformRows(sermonsCsv, seriesCsv);
const sermon = (slug: string) =>
  result.sermons.find((s) => s.slug.current === slug);

const withRow = (slug: string, patch: Record<string, string>) =>
  sermonsCsv.map((row) => (row['Slug'] === slug ? { ...row, ...patch } : row));

describe('slugs and paths', () => {
  it('preserves the Webflow slug and sets webflowPath', () => {
    const slug =
      'entrusted-with-resources-putting-money-in-its-place-2026-10-18';
    const doc = sermon(slug)!;
    expect(doc._id).toBe(`sermon-${slug}`);
    expect(doc._type).toBe('sermon');
    expect(doc.slug).toEqual({ _type: 'slug', current: slug });
    expect(doc.webflowPath).toBe(`/sermons/${slug}`);
    expect(doc.title).toBe(
      'Entrusted With Resources - Putting Money In its Place',
    );
  });

  it('keeps odd Webflow slugs untouched', () => {
    expect(sermon('god-settles-accounts-2026-06-14-701e6')?._id).toBe(
      'sermon-god-settles-accounts-2026-06-14-701e6',
    );
    expect(sermon('gospel-repair')).toBeUndefined();
    expect(sermon('christmas-transforms')?.webflowPath).toBe(
      '/sermons/christmas-transforms',
    );
  });

  it('keeps curly apostrophes in titles', () => {
    expect(sermon('faith-that-doesn-t-unravel-2026-09-06')?.title).toBe(
      'Faith That Doesn’t Unravel',
    );
  });

  it('derives a slug from title and date when the slug column is empty', () => {
    const rows = withRow('main-character-energy-2026-09-20', { Slug: '' });
    const out = transformRows(rows, seriesCsv);
    expect(
      out.sermons.some(
        (s) => s.slug.current === 'main-character-energy-2026-09-20',
      ),
    ).toBe(true);
    expect(out.problems.some((p) => /slug/i.test(p))).toBe(true);
  });

  it('skips a duplicate slug and reports it', () => {
    const dup = sermonsCsv.find((r) => r['Slug'] === 'getting-it-right')!;
    const out = transformRows([...sermonsCsv, dup], seriesCsv);
    expect(
      out.sermons.filter((s) => s.slug.current === 'getting-it-right'),
    ).toHaveLength(1);
    expect(
      out.problems.some(
        (p) => p.includes('getting-it-right') && /duplicate/i.test(p),
      ),
    ).toBe(true);
  });
});

describe('Spreaker', () => {
  it('parses the episode id from the URL', () => {
    expect(
      sermon('entrusted-with-resources-putting-money-in-its-place-2026-10-18')
        ?.spreakerEpisodeId,
    ).toBe('75851174');
    expect(
      extractSpreakerId(
        'https://www.spreaker.com/episode/entrusted-with-resources-putting-money-in-its-place--75851174',
      ),
    ).toBe('75851174');
  });

  it('handles embeds, bare episode urls, and empties', () => {
    expect(
      extractSpreakerId(
        '<a class="spreaker-player" href="https://www.spreaker.com/episode/x--9?foo=1" data-resource="episode_id=9"></a>',
      ),
    ).toBe('9');
    expect(extractSpreakerId('https://www.spreaker.com/episode/12345')).toBe(
      '12345',
    );
    expect(extractSpreakerId('')).toBeUndefined();
    expect(extractSpreakerId('https://example.com/nope')).toBeUndefined();
  });

  it('allows a sermon with no Spreaker episode', () => {
    expect(sermon('going-publicstaying-public')).toBeDefined();
    expect(
      sermon('going-publicstaying-public')?.spreakerEpisodeId,
    ).toBeUndefined();
  });
});

describe('Vimeo', () => {
  it('uses a plain URL column', () => {
    expect(
      sermon('entrusted-with-resources-putting-money-in-its-place-2026-10-18')
        ?.vimeoUrl,
    ).toBe('https://vimeo.com/1237032843');
    expect(sermon('going-publicstaying-public')?.vimeoUrl).toBe(
      'https://vimeo.com/490654228/ac06dd6ad2',
    );
  });

  it('extracts from an Embedly iframe blob', () => {
    expect(sermon('treasuring-scripture-like-jesus-2026-09-27')?.vimeoUrl).toBe(
      'https://vimeo.com/1230704001',
    );
  });

  it('keeps a private hash and drops tracking query strings', () => {
    expect(sermon('christmas-transforms')?.vimeoUrl).toBe(
      'https://vimeo.com/493606995/16e4bc2622',
    );
    expect(sermon('god-settles-accounts-2026-06-14-701e6')?.vimeoUrl).toBe(
      'https://vimeo.com/1201205708',
    );
  });

  it('extracts from player URLs, including ?h= hashes', () => {
    expect(extractVimeoUrl('https://player.vimeo.com/video/123456789')).toBe(
      'https://vimeo.com/123456789',
    );
    expect(
      extractVimeoUrl(
        '<iframe src="https://player.vimeo.com/video/123456789?h=abcdef1234&amp;app_id=1"></iframe>',
      ),
    ).toBe('https://vimeo.com/123456789/abcdef1234');
    expect(extractVimeoUrl('https://www.vimeo.com/123456789/')).toBe(
      'https://vimeo.com/123456789',
    );
  });

  it('returns undefined when there is nothing to extract', () => {
    expect(extractVimeoUrl('')).toBeUndefined();
    expect(extractVimeoUrl('https://youtube.com/watch?v=1')).toBeUndefined();
  });

  it('allows a sermon with no Vimeo', () => {
    const doc = sermon('seeking-first-the-kingdom-of-me-2026-08-23');
    expect(doc).toBeDefined();
    expect(doc?.vimeoUrl).toBeUndefined();
    expect(result.problems.some((p) => p.includes('seeking-first'))).toBe(
      false,
    );
  });

  it('reports a non-empty Vimeo value that has no id, and still imports', () => {
    const rows = withRow('main-character-energy-2026-09-20', {
      'Vimeo Embed': '<p>coming soon</p>',
    });
    const out = transformRows(rows, seriesCsv);
    expect(
      out.sermons.some(
        (s) => s.slug.current === 'main-character-energy-2026-09-20',
      ),
    ).toBe(true);
    expect(
      out.problems.some(
        (p) => p.includes('main-character-energy') && /vimeo/i.test(p),
      ),
    ).toBe(true);
  });
});

describe('books', () => {
  it('normalizes variants to canonical names', () => {
    expect(sermon('how-to-not-be-a-pile-of-rocks-2026-09-13')?.book).toBe(
      '1 Peter',
    );
    expect(sermon('how-much-mercy-2026-06-14')?.book).toBe('1 Thessalonians');
    expect(sermon('faith-that-doesn-t-unravel-2026-09-06')?.book).toBe(
      '2 John',
    );
  });

  it('normalizeBook handles common spellings', () => {
    const cases: Record<string, string> = {
      'I Peter': '1 Peter',
      '1 Pet.': '1 Peter',
      '1Pet': '1 Peter',
      'II Timothy': '2 Timothy',
      'III John': '3 John',
      'First Corinthians': '1 Corinthians',
      '1 Thess.': '1 Thessalonians',
      'Song of Solomon': 'Song of Songs',
      Psalm: 'Psalms',
      '  john ': 'John',
      Isaiah: 'Isaiah',
      Revelation: 'Revelation',
    };
    for (const [raw, expected] of Object.entries(cases)) {
      expect(normalizeBook(raw)?.book, raw).toBe(expected);
    }
  });

  it('splits a trailing chapter and verse into a passage', () => {
    expect(normalizeBook('1 Timothy 6:6-19')).toEqual({
      book: '1 Timothy',
      passage: '1 Timothy 6:6-19',
    });
    expect(normalizeBook('Ruth 1')).toEqual({
      book: 'Ruth',
      passage: 'Ruth 1',
    });
  });

  it('returns undefined for unknown or empty books', () => {
    expect(normalizeBook('Various')).toBeUndefined();
    expect(normalizeBook('')).toBeUndefined();
  });

  it('exposes an extendable alias map', () => {
    expect(BOOK_ALIASES['1 pet']).toBe('1 Peter');
  });

  it('skips sermons with unknown or empty books and reports each one', () => {
    expect(sermon('forgive-one-another')).toBeUndefined();
    expect(sermon('orchestrating-a-festive-crisis')).toBeUndefined();
    expect(
      result.problems.some(
        (p) => p.includes('forgive-one-another') && p.includes('"Various"'),
      ),
    ).toBe(true);
    expect(
      result.problems.some(
        (p) => p.includes('orchestrating-a-festive-crisis') && /book/i.test(p),
      ),
    ).toBe(true);
  });

  it('uses the Passage column when present', () => {
    expect(
      sermon('entrusted-with-resources-putting-money-in-its-place-2026-10-18')
        ?.passage,
    ).toBe('1 Timothy 6:6-19');
    expect(sermon('main-character-energy-2026-09-20')?.passage).toBeUndefined();
  });
});

describe('speakers', () => {
  it('dedupes case-insensitively into one stable id', () => {
    const ids = result.speakers.map((s) => s._id);
    expect(ids.filter((id) => id === 'speaker-josh-de-koning')).toHaveLength(1);
    const josh = result.speakers.find(
      (s) => s._id === 'speaker-josh-de-koning',
    )!;
    expect(josh.name).toBe('Josh de Koning');
    expect(josh.slug).toEqual({ _type: 'slug', current: 'josh-de-koning' });
    expect(josh._type).toBe('speaker');
  });

  it('points every sermon at an existing speaker', () => {
    const ids = new Set(result.speakers.map((s) => s._id));
    for (const s of result.sermons) {
      expect(ids.has(s.speaker._ref)).toBe(true);
      expect(s.speaker._type).toBe('reference');
    }
    expect(
      sermon('how-to-not-be-a-pile-of-rocks-2026-09-13')?.speaker._ref,
    ).toBe('speaker-josh-de-koning');
  });

  it('lists the expected distinct speakers', () => {
    expect(result.speakers.map((s) => s._id).sort()).toEqual([
      'speaker-cullen-mills',
      'speaker-josh-collins',
      'speaker-josh-de-koning',
      'speaker-richard-cobb',
      'speaker-seth-kempf',
      'speaker-shamus-drake',
    ]);
  });

  it('collapses whitespace and picks the most common spelling', () => {
    const rows = sermonsCsv.map((r) =>
      r['Slug'] === 'main-character-energy-2026-09-20'
        ? { ...r, Speaker: '  Josh   DE  Koning ' }
        : r,
    );
    const out = transformRows(rows, seriesCsv);
    const josh = out.speakers.find((s) => s._id === 'speaker-josh-de-koning')!;
    expect(josh.name).toBe('Josh de Koning');
  });

  it('skips a sermon with no speaker and reports it', () => {
    expect(sermon('gospel-repair')).toBeUndefined();
    expect(
      result.problems.some(
        (p) => p.includes('gospel-repair') && /speaker/i.test(p),
      ),
    ).toBe(true);
  });
});

describe('series', () => {
  it('dedupes by slug and skips draft series', () => {
    const slugs = result.series.map((s) => s.slug.current);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('acts');
    expect(slugs).not.toContain('unpublished-series');
    expect(slugs).toHaveLength(9);
  });

  it('preserves series slugs and ids', () => {
    const s = result.series.find(
      (x) => x.title === 'Increase and Multiply - Forever Together',
    )!;
    expect(s._id).toBe('series-increase-and-multiply---forever-together');
    expect(s.slug.current).toBe('increase-and-multiply---forever-together');
    expect(s._type).toBe('series');
  });

  it('carries artwork URLs and descriptions', () => {
    const isaiah = result.series.find((s) => s.slug.current === 'isaiah')!;
    expect(isaiah.artworkUrl).toMatch(
      /^https:\/\/cdn\.prod\.website-files\.com\//,
    );
    expect(
      result.series.find((s) => s.slug.current === 'ruth')?.artworkUrl,
    ).toBeUndefined();
    expect(
      result.series.find((s) => s.slug.current === 'jude')?.description,
    ).toBe('Sample description (fixture only).');
  });

  it('references series by deterministic id', () => {
    expect(sermon('christmas-transforms')?.series._ref).toBe('series-acts');
  });

  it('marks only the stand-alone series', () => {
    const standalone = result.series.filter((s) => s.isStandalone);
    expect(standalone.map((s) => s._id)).toEqual([
      'series-stand-alone-messages',
    ]);
    expect(standalone[0].title).toBe('Stand Alone Messages');
  });

  it('assigns a missing series to Stand Alone Messages', () => {
    expect(sermon('life-on-the-altar-2026-06-07')?.series._ref).toBe(
      'series-stand-alone-messages',
    );
  });

  it('assigns an unknown series to Stand Alone Messages and reports it', () => {
    expect(sermon('the-fear-of-the-lord-2026-08-16')?.series._ref).toBe(
      'series-stand-alone-messages',
    );
    expect(
      result.problems.some(
        (p) =>
          p.includes('the-fear-of-the-lord') && p.includes('Proverbs Study'),
      ),
    ).toBe(true);
  });

  it('creates the stand-alone series when the series CSV lacks it', () => {
    const without = seriesCsv.filter(
      (r) => r['Slug'] !== 'stand-alone-messages',
    );
    const out = transformRows(sermonsCsv, without);
    const doc = out.series.find(
      (s) => s._id === 'series-stand-alone-messages',
    )!;
    expect(doc.isStandalone).toBe(true);
    expect(doc.slug.current).toBe('stand-alone-messages');
    expect(doc.title).toBe('Stand Alone Messages');
  });

  it('every sermon references an existing series', () => {
    const ids = new Set(result.series.map((s) => s._id));
    for (const s of result.sermons) expect(ids.has(s.series._ref)).toBe(true);
  });
});

describe('skipping and counts', () => {
  it('skips draft and archived rows silently', () => {
    expect(sermon('unpublished-draft-sermon-2026-10-25')).toBeUndefined();
    expect(sermon('archived-sermon-2019-01-06')).toBeUndefined();
    expect(result.problems.some((p) => p.includes('unpublished-draft'))).toBe(
      false,
    );
    expect(result.problems.some((p) => p.includes('archived-sermon'))).toBe(
      false,
    );
  });

  it('reports counts', () => {
    expect(result.stats).toEqual({
      sermonRows: 19,
      skippedDraftOrArchived: 2,
      skippedInvalid: 3,
      sermons: 14,
      series: 9,
      speakers: 6,
    });
    expect(result.sermons).toHaveLength(14);
    expect(result.stats.sermonRows).toBe(
      result.stats.skippedDraftOrArchived +
        result.stats.skippedInvalid +
        result.stats.sermons,
    );
  });

  it('formats a readable report with the first five docs and all problems', () => {
    const text = formatReport(result);
    expect(text).toContain('14 sermons');
    expect(text).toContain('9 series');
    expect(text).toContain('6 speakers');
    for (const p of result.problems) expect(text).toContain(p);
    const firstFive = result.sermons.slice(0, 5).map((s) => s._id);
    for (const id of firstFive) expect(text).toContain(id);
    expect(text).not.toContain(result.sermons[5]._id);
  });
});

describe('idempotency', () => {
  it('produces deep-equal output on repeated runs', () => {
    const again = transformRows(
      readCsv('sermons.sample.csv'),
      readCsv('series.sample.csv'),
    );
    expect(again).toEqual(result);
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(sermonsCsv);
    transformRows(sermonsCsv, seriesCsv);
    expect(JSON.stringify(sermonsCsv)).toBe(before);
  });

  it('uses only deterministic ids', () => {
    for (const s of result.sermons)
      expect(s._id).toBe(`sermon-${s.slug.current}`);
    for (const s of result.series)
      expect(s._id).toBe(`series-${s.slug.current}`);
    for (const s of result.speakers)
      expect(s._id).toBe(`speaker-${s.slug.current}`);
  });

  it('is independent of row order for speakers and ids', () => {
    const reversed = transformRows([...sermonsCsv].reverse(), seriesCsv);
    expect(reversed.speakers.map((s) => s._id)).toEqual(
      result.speakers.map((s) => s._id),
    );
    expect(reversed.sermons.map((s) => s._id).sort()).toEqual(
      result.sermons.map((s) => s._id).sort(),
    );
  });
});

describe('dates', () => {
  it('reads the Webflow GMT format as the calendar date', () => {
    expect(
      sermon('entrusted-with-resources-putting-money-in-its-place-2026-10-18')
        ?.date,
    ).toBe('2026-10-18');
    expect(
      parseSermonDate(
        'Sun Oct 18 2026 00:00:00 GMT+0000 (Coordinated Universal Time)',
      ),
    ).toBe('2026-10-18');
  });

  it('reads ISO, date-only and US formats', () => {
    expect(parseSermonDate('2026-09-27T00:00:00.000Z')).toBe('2026-09-27');
    expect(parseSermonDate('2026-09-13')).toBe('2026-09-13');
    expect(parseSermonDate('9/6/2026')).toBe('2026-09-06');
    expect(parseSermonDate('Oct 18, 2026')).toBe('2026-10-18');
  });

  it('converts real instants to America/Chicago at the day boundary', () => {
    expect(parseSermonDate('2026-06-08T03:30:00.000Z')).toBe('2026-06-07');
    expect(sermon('life-on-the-altar-2026-06-07')?.date).toBe('2026-06-07');
    expect(parseSermonDate('2026-10-19T04:59:00.000Z')).toBe('2026-10-18');
    expect(parseSermonDate('2026-10-19T05:00:00.000Z')).toBe('2026-10-19');
    expect(parseSermonDate('2026-12-14T05:30:00.000Z')).toBe('2026-12-13');
    expect(parseSermonDate('2026-12-14T06:30:00.000Z')).toBe('2026-12-14');
  });

  it('returns undefined for blank or unparseable values', () => {
    expect(parseSermonDate('')).toBeUndefined();
    expect(parseSermonDate('next Sunday-ish')).toBeUndefined();
    expect(parseSermonDate('2026-13-45')).toBeUndefined();
  });

  it('falls back to Published On and flags it', () => {
    const rows = withRow('main-character-energy-2026-09-20', {
      Date: '',
      'Published On': '2026-09-20T15:00:00.000Z',
    });
    const out = transformRows(rows, seriesCsv);
    const doc = out.sermons.find(
      (s) => s.slug.current === 'main-character-energy-2026-09-20',
    );
    expect(doc?.date).toBe('2026-09-20');
    expect(
      out.problems.some(
        (p) => p.includes('main-character-energy') && /published on/i.test(p),
      ),
    ).toBe(true);
  });

  it('skips a sermon whose date cannot be parsed and reports it', () => {
    const rows = withRow('main-character-energy-2026-09-20', {
      Date: 'sometime in September',
      'Published On': '',
    });
    const out = transformRows(rows, seriesCsv);
    expect(
      out.sermons.some(
        (s) => s.slug.current === 'main-character-energy-2026-09-20',
      ),
    ).toBe(false);
    expect(
      out.problems.some(
        (p) =>
          p.includes('main-character-energy') &&
          p.includes('sometime in September'),
      ),
    ).toBe(true);
  });

  it('flags a date that disagrees with the date in the slug', () => {
    const rows = withRow('main-character-energy-2026-09-20', {
      Date: '2026-09-21',
    });
    const out = transformRows(rows, seriesCsv);
    expect(
      out.problems.some(
        (p) => p.includes('main-character-energy') && /slug/i.test(p),
      ),
    ).toBe(true);
    expect(
      result.problems.some((p) => /does not match the slug/i.test(p)),
    ).toBe(false);
  });
});

describe('column map', () => {
  it('reports a required column that no header matches', () => {
    const renamed = sermonsCsv.map(({ Speaker, ...rest }) => ({
      Presenter: Speaker,
      ...rest,
    }));
    const out = transformRows(renamed, seriesCsv);
    expect(
      out.problems.some((p) => /no column/i.test(p) && /speaker/i.test(p)),
    ).toBe(true);
  });

  it('matches headers case- and whitespace-insensitively', () => {
    const shouting = sermonsCsv.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [` ${k.toUpperCase()} `, v]),
      ),
    );
    const out = transformRows(shouting, seriesCsv);
    expect(out.sermons).toHaveLength(result.sermons.length);
  });

  it('treats Draft and Archived case-insensitively', () => {
    const rows = withRow('main-character-energy-2026-09-20', { Draft: 'TRUE' });
    const out = transformRows(rows, seriesCsv);
    expect(
      out.sermons.some(
        (s) => s.slug.current === 'main-character-energy-2026-09-20',
      ),
    ).toBe(false);
  });
});

describe('cli helpers', () => {
  it('parses arguments', () => {
    expect(
      parseArgs(['--sermons', 'a.csv', '--series', 'b.csv', '--dry-run']),
    ).toEqual({
      sermons: 'a.csv',
      series: 'b.csv',
      dryRun: true,
      errors: [],
    });
    expect(parseArgs(['--sermons=a.csv', '--series=b.csv'])).toEqual({
      sermons: 'a.csv',
      series: 'b.csv',
      dryRun: false,
      errors: [],
    });
  });

  it('reports missing, unknown and incomplete arguments', () => {
    expect(parseArgs([]).errors.join(' ')).toMatch(/--sermons/);
    expect(parseArgs(['--sermons', 'a.csv']).errors.join(' ')).toMatch(
      /--series/,
    );
    expect(parseArgs(['--sermons']).errors.join(' ')).toMatch(/--sermons/);
    expect(
      parseArgs(['--sermons', 'a', '--series', 'b', '--wat']).errors.join(' '),
    ).toMatch(/--wat/);
  });

  it('chunks arrays', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
    const big = Array.from({ length: 250 }, (_, i) => i);
    expect(chunk(big, 100).map((c) => c.length)).toEqual([100, 100, 50]);
    expect(() => chunk([1], 0)).toThrow();
  });

  it('commits createOrReplace mutations in transactions of at most 100', async () => {
    const commits: { op: string; id: string }[][] = [];
    const client = {
      transaction() {
        const ops: { op: string; id: string }[] = [];
        const tx = {
          createOrReplace(doc: { _id: string }) {
            ops.push({ op: 'createOrReplace', id: doc._id });
            return tx;
          },
          async commit() {
            commits.push(ops);
          },
        };
        return tx;
      },
    };
    const docs = Array.from({ length: 205 }, (_, i) => ({
      _id: `sermon-${i}`,
      _type: 'sermon',
    }));
    const seen: number[] = [];
    const total = await commitInBatches(client, docs, 100, (n) => seen.push(n));
    expect(total).toBe(205);
    expect(commits.map((c) => c.length)).toEqual([100, 100, 5]);
    expect(commits.flat().every((o) => o.op === 'createOrReplace')).toBe(true);
    expect(seen).toEqual([100, 200, 205]);
  });
});
