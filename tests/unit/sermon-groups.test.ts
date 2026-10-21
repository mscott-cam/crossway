import { describe, expect, it } from 'vitest';
import {
  groupBooks,
  groupSeries,
  groupSpeakers,
  sermonDescription,
  sermonMeta,
  sermonPageTitle,
  paragraphs,
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

  it('falls back to series and date', () => {
    const s = make({ slug: 'a', date: '2026-10-18' });
    expect(sermonDescription(s)).toBe('A · October 18, 2026');
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
