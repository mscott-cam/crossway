import { describe, expect, it } from 'vitest';
import { BOOKS, bookBySlug } from '../../src/lib/books';

describe('BOOKS', () => {
  it('lists all 66 books', () => {
    expect(BOOKS.length).toBe(66);
  });

  it('runs from Genesis to Revelation', () => {
    expect(BOOKS[0].name).toBe('Genesis');
    expect(BOOKS[65].name).toBe('Revelation');
  });

  it('splits 39 Old Testament and 27 New Testament books', () => {
    expect(BOOKS.filter((b) => b.testament === 'OT')).toHaveLength(39);
    expect(BOOKS.filter((b) => b.testament === 'NT')).toHaveLength(27);
    expect(BOOKS[38].name).toBe('Malachi');
    expect(BOOKS[39].name).toBe('Matthew');
  });

  it('has unique slugs and names', () => {
    expect(new Set(BOOKS.map((b) => b.slug)).size).toBe(66);
    expect(new Set(BOOKS.map((b) => b.name)).size).toBe(66);
  });

  it('uses lowercase hyphenated slugs', () => {
    for (const book of BOOKS)
      expect(book.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('bookBySlug', () => {
  it('finds a numbered book', () => {
    expect(bookBySlug('1-timothy')?.name).toBe('1 Timothy');
  });

  it('finds Song of Songs', () => {
    expect(bookBySlug('song-of-songs')?.name).toBe('Song of Songs');
  });

  it('returns undefined for an unknown slug', () => {
    expect(bookBySlug('nope')).toBeUndefined();
  });
});
