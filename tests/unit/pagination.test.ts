import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, pageHref, pageItems } from '../../src/lib/pagination';

describe('PAGE_SIZE', () => {
  it('is 24', () => {
    expect(PAGE_SIZE).toBe(24);
  });
});

describe('pageHref', () => {
  it('uses the base for page 1 by default', () => {
    expect(pageHref('/sermons/book/john', 1)).toBe('/sermons/book/john');
    expect(pageHref('/sermons/book/john', 2)).toBe('/sermons/book/john/2');
  });

  it('numbers page 1 when asked', () => {
    expect(pageHref('/sermons/archive', 1, true)).toBe('/sermons/archive/1');
    expect(pageHref('/sermons/archive', 3, true)).toBe('/sermons/archive/3');
  });
});

describe('pageItems', () => {
  it('lists every page when there are few', () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(2, 1)).toEqual([1]);
  });

  it('collapses distant pages into gaps', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageItems(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageItems(10, 10)).toEqual([1, null, 9, 10]);
  });

  it('fills a gap that would hide only one page', () => {
    expect(pageItems(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageItems(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(pageItems(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8]);
  });
});
