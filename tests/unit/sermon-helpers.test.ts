import { describe, expect, it } from 'vitest';
import {
  defaultSermonDate,
  sermonSlugSource,
} from '../../studio/schemaTypes/sermon-helpers';

describe('defaultSermonDate', () => {
  it('returns the same day on a Sunday', () => {
    expect(defaultSermonDate(new Date('2026-09-06T17:00:00Z'))).toBe(
      '2026-09-06',
    );
  });

  it('returns the previous Sunday on a Wednesday', () => {
    expect(defaultSermonDate(new Date('2026-09-09T17:00:00Z'))).toBe(
      '2026-09-06',
    );
  });

  it('returns the previous Sunday on a Saturday', () => {
    expect(defaultSermonDate(new Date('2026-09-12T17:00:00Z'))).toBe(
      '2026-09-06',
    );
  });

  it('uses Chicago time, not UTC, late on a Sunday evening', () => {
    expect(defaultSermonDate(new Date('2026-09-07T03:30:00Z'))).toBe(
      '2026-09-06',
    );
  });

  it('uses Chicago time, not UTC, early on a Monday UTC that is still Sunday', () => {
    expect(defaultSermonDate(new Date('2026-09-07T04:59:00Z'))).toBe(
      '2026-09-06',
    );
  });

  it('rolls back to Sunday just after Chicago midnight Monday', () => {
    expect(defaultSermonDate(new Date('2026-09-07T05:01:00Z'))).toBe(
      '2026-09-06',
    );
  });

  it('crosses a month boundary', () => {
    expect(defaultSermonDate(new Date('2026-10-02T17:00:00Z'))).toBe(
      '2026-09-27',
    );
  });

  it('crosses a year boundary', () => {
    expect(defaultSermonDate(new Date('2027-01-02T17:00:00Z'))).toBe(
      '2026-12-27',
    );
  });
});

describe('sermonSlugSource', () => {
  it('builds title-date slugs in the Webflow pattern', () => {
    expect(sermonSlugSource('Faith That Doesn’t Unravel', '2026-09-06')).toBe(
      'faith-that-doesnt-unravel-2026-09-06',
    );
    expect(sermonSlugSource("Faith That Doesn't Unravel", '2026-09-06')).toBe(
      'faith-that-doesnt-unravel-2026-09-06',
    );
  });

  it('strips punctuation and collapses separators', () => {
    expect(sermonSlugSource('Entrusted - A Way of Life!', '2026-10-11')).toBe(
      'entrusted-a-way-of-life-2026-10-11',
    );
  });

  it('works without a title or date', () => {
    expect(sermonSlugSource('', '2026-10-11')).toBe('2026-10-11');
    expect(sermonSlugSource('Grace', undefined)).toBe('grace');
  });
});
