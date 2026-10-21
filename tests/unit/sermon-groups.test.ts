import { describe, expect, it, vi } from 'vitest';
import {
  groupBooks,
  groupSeries,
  groupSpeakers,
  sermonDescription,
  seriesDescription,
  sermonMeta,
  sermonPageTitle,
  paragraphs,
  uniqueBySlug,
} from '../../src/lib/sermon-groups';
import { sanityImageUrl } from '../../src/lib/image-url';
import type { Sermon } from '../../src/lib/sanity/types';

const speaker = (slug: string, name = slug) => ({ _id: slug, slug, name });
const series = (slug: string, isStandalone = false) => ({
  _id: slug,
  slug,
  title: slug.toUpperCase(),
  isStandalone,
});

const make = (over: Partial<Sermon> & { slug: string }): Sermon => ({
  _id: over.slug,
  title: `Title ${over.slug}`,
  date: '2026-01-01',
  series: series('a'),
  ...over,
});

describe('groupSeries', () => {
  it('orders series by their newest sermon and counts them', () => {
    const sermons = [
      make({ slug: 'a1', date: '2026-03-01', series: series('a') }),
      make({ slug: 'b1', date: '2026-04-01', series: series('b') }),
      make({ slug: 'a2', date: '2026-02-01', series: series('a') }),
    ];
    const groups = groupSeries(sermons);
    expect(groups.map((g) => [g.series.slug, g.count, g.latest])).toEqual([
      ['b', 1, '2026-04-01'],
      ['a', 2, '2026-03-01'],
    ]);
  });
});

describe('groupBooks', () => {
  it('returns only books with sermons in canonical order and skips unknown names', () => {
    const sermons = [
      make({ slug: 'x', book: 'John' }),
      make({ slug: 'y', book: 'Genesis' }),
      make({ slug: 'z' }),
      make({ slug: 'w', book: 'Not A Book' }),
      make({ slug: 'v', book: 'John' }),
    ];
    const groups = groupBooks(sermons);
    expect(groups.map((g) => [g.book.slug, g.sermons.length])).toEqual([
      ['genesis', 1],
      ['john', 2],
    ]);
  });
});

describe('groupSpeakers', () => {
  it('returns speakers with sermons ordered by name', () => {
    const sermons = [
      make({ slug: 'x', speaker: speaker('zed', 'Zed') }),
      make({ slug: 'y', speaker: speaker('amy', 'Amy') }),
      make({ slug: 'z' }),
      make({ slug: 'w', speaker: speaker('amy', 'Amy') }),
    ];
    expect(
      groupSpeakers(sermons).map((g) => [g.speaker.slug, g.sermons.length]),
    ).toEqual([
      ['amy', 2],
      ['zed', 1],
    ]);
  });
});

describe('sermonMeta', () => {
  const full = make({
    slug: 'f',
    date: '2026-10-18',
    speaker: speaker('s', 'Speaker Name'),
    passage: 'John 3:16',
    series: series('s1'),
  });

  it('joins the requested parts in order', () => {
    expect(sermonMeta(full, ['speaker', 'passage', 'series', 'date'])).toEqual([
      'Speaker Name',
      'John 3:16',
      'S1',
      'October 18, 2026',
    ]);
  });

  it('omits missing parts without placeholders', () => {
    const bare = make({ slug: 'b', date: '2026-10-18' });
    expect(sermonMeta(bare, ['speaker', 'passage', 'date'])).toEqual([
      'October 18, 2026',
    ]);
  });
});

describe('sermonPageTitle and sermonDescription', () => {
  it('uses speaker and date in the title', () => {
    const s = make({
      slug: 'a',
      title: 'Grace',
      date: '2026-10-18',
      speaker: speaker('s', 'Pat'),
    });
    expect(sermonPageTitle(s)).toBe('Grace – Pat, October 18, 2026');
  });

  it('works without a speaker', () => {
    const s = make({ slug: 'a', title: 'Grace', date: '2026-10-18' });
    expect(sermonPageTitle(s)).toBe('Grace – October 18, 2026');
  });

  it('prefers the description, truncated at a word', () => {
    const long = 'word '.repeat(80).trim();
    const s = make({ slug: 'a', description: long });
    const text = sermonDescription(s);
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text.endsWith('…')).toBe(true);
    expect(text).not.toMatch(/wor…$/);
  });

  it('falls back to a sentence naming the sermon, speaker, series and date', () => {
    const s = make({
      slug: 'a',
      title: 'Grace',
      date: '2026-10-18',
      speaker: speaker('s', 'Pat'),
    });
    expect(sermonDescription(s)).toBe(
      'Grace by Pat, from the A series at Crossway Bible Church on October 18, 2026.',
    );
  });

  it('leaves out the series for a standalone message and the speaker when unknown', () => {
    const s = make({
      slug: 'a',
      title: 'Grace',
      date: '2026-10-18',
      series: series('a', true),
    });
    expect(sermonDescription(s)).toBe(
      'Grace, at Crossway Bible Church on October 18, 2026.',
    );
  });

  it('keeps a short description as written', () => {
    const s = make({ slug: 'a', description: 'A short one.' });
    expect(sermonDescription(s)).toBe('A short one.');
  });

  it('keeps a description that is long enough as written', () => {
    const own = 'A walk through the book of James, one chapter at a time.';
    const s = make({ slug: 'a', description: own });
    expect(sermonDescription(s)).toBe(own);
  });

  it('never exceeds the limit even with a long title', () => {
    const s = make({ slug: 'a', title: 'Long title '.repeat(30) });
    expect(sermonDescription(s).length).toBeLessThanOrEqual(160);
  });
});

describe('seriesDescription', () => {
  it('joins the intro and the message count', () => {
    expect(
      seriesDescription(
        'A walk through the book of James, chapter by chapter.',
        12,
      ),
    ).toBe(
      'A walk through the book of James, chapter by chapter. 12 messages, newest first.',
    );
  });

  it('singularizes one message and appends the page range', () => {
    expect(seriesDescription(undefined, 1, ' Page 1 of 1.')).toBe(
      'A sermon series at Crossway Bible Church. 1 message, newest first. Page 1 of 1.',
    );
  });

  it('pads a very short intro so the description is long enough', () => {
    const text = seriesDescription('Faith.', 3);
    expect(text.length).toBeGreaterThanOrEqual(50);
    expect(text.startsWith('Faith. A sermon series')).toBe(true);
  });

  it('clips a long intro so the whole description stays within 160', () => {
    const text = seriesDescription(
      'word '.repeat(100).trim(),
      120,
      ' Page 2 of 3.',
    );
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text).toContain('…');
    expect(text.endsWith('120 messages, newest first. Page 2 of 3.')).toBe(
      true,
    );
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and drops empties', () => {
    expect(paragraphs('One\n\n\nTwo\nstill two\n\n')).toEqual([
      'One',
      'Two\nstill two',
    ]);
  });
});

describe('sanityImageUrl', () => {
  it('adds width and auto format to Sanity CDN urls', () => {
    expect(
      sanityImageUrl('https://cdn.sanity.io/images/p/d/abc.jpg', 640),
    ).toBe('https://cdn.sanity.io/images/p/d/abc.jpg?w=640&auto=format');
  });

  it('leaves other urls untouched', () => {
    expect(sanityImageUrl('/local/pic.png', 640)).toBe('/local/pic.png');
    expect(sanityImageUrl('https://example.com/a.jpg', 640)).toBe(
      'https://example.com/a.jpg',
    );
  });
});

describe('uniqueBySlug', () => {
  it('keeps the first sermon for a slug and warns once listing duplicates', () => {
    const warn = vi.fn();
    const first = make({ slug: 'a-2026-01-01', _id: 'one' });
    const out = uniqueBySlug(
      [
        first,
        make({ slug: 'b-2026-01-08' }),
        make({ slug: 'a-2026-01-01', _id: 'two' }),
        make({ slug: 'a-2026-01-01', _id: 'three' }),
        make({ slug: 'b-2026-01-08', _id: 'four' }),
      ],
      warn,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(first);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('a-2026-01-01');
    expect(warn.mock.calls[0]![0]).toContain('b-2026-01-08');
  });

  it('stays quiet when every slug is unique', () => {
    const warn = vi.fn();
    const sermons = [make({ slug: 'x' }), make({ slug: 'y' })];
    expect(uniqueBySlug(sermons, warn)).toEqual(sermons);
    expect(warn).not.toHaveBeenCalled();
  });
});
