import { describe, expect, it } from 'vitest';
import {
  defaultSermonDate,
  sermonSlugSource,
} from '../../studio/schemaTypes/sermon-helpers';

const at = (iso: string) => defaultSermonDate(new Date(iso));

describe('defaultSermonDate', () => {
  it('returns the same day on a Sunday afternoon', () => {
    expect(at('2026-09-06T17:00:00Z')).toBe('2026-09-06');
  });

  it('returns the previous Sunday midweek and on Saturday', () => {
    expect(at('2026-09-09T17:00:00Z')).toBe('2026-09-06');
    expect(at('2026-09-12T17:00:00Z')).toBe('2026-09-06');
  });

  it('is still Saturday night in Chicago when UTC has reached Sunday', () => {
    expect(at('2026-09-06T03:00:00Z')).toBe('2026-08-30');
    expect(at('2026-09-06T04:59:00Z')).toBe('2026-08-30');
  });

  it('becomes Sunday at midnight Chicago time (CDT)', () => {
    expect(at('2026-09-06T05:00:00Z')).toBe('2026-09-06');
  });

  it('stays on Sunday through Sunday night even after UTC rolls to Monday', () => {
    expect(at('2026-09-07T04:59:00Z')).toBe('2026-09-06');
  });

  it('handles the spring-forward week (2026-03-08)', () => {
    expect(at('2026-03-08T05:59:00Z')).toBe('2026-03-01');
    expect(at('2026-03-08T06:00:00Z')).toBe('2026-03-08');
    expect(at('2026-03-08T07:30:00Z')).toBe('2026-03-08');
    expect(at('2026-03-09T04:59:00Z')).toBe('2026-03-08');
    expect(at('2026-03-09T05:00:00Z')).toBe('2026-03-08');
    expect(at('2026-03-14T17:00:00Z')).toBe('2026-03-08');
  });

  it('handles the fall-back week (2026-11-01)', () => {
    expect(at('2026-11-01T04:59:00Z')).toBe('2026-10-25');
    expect(at('2026-11-01T05:00:00Z')).toBe('2026-11-01');
    expect(at('2026-11-01T07:30:00Z')).toBe('2026-11-01');
    expect(at('2026-11-02T05:59:00Z')).toBe('2026-11-01');
    expect(at('2026-11-02T06:00:00Z')).toBe('2026-11-01');
    expect(at('2026-11-07T17:00:00Z')).toBe('2026-11-01');
  });

  it('crosses month and year boundaries', () => {
    expect(at('2026-10-02T17:00:00Z')).toBe('2026-09-27');
    expect(at('2027-01-02T17:00:00Z')).toBe('2026-12-27');
    expect(at('2027-01-03T05:59:00Z')).toBe('2026-12-27');
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

  it('keeps the base letters of accented characters', () => {
    expect(
      sermonSlugSource('Café & Résumé — Grace – Part 2', '2026-09-06'),
    ).toBe('cafe-resume-grace-part-2-2026-09-06');
  });

  it('handles decomposed accents the same way', () => {
    expect(sermonSlugSource('Café Niño', '2026-09-06')).toBe(
      'cafe-nino-2026-09-06',
    );
  });

  it('handles ampersands, dashes and punctuation', () => {
    expect(sermonSlugSource('Entrusted - A Way of Life!', '2026-10-11')).toBe(
      'entrusted-a-way-of-life-2026-10-11',
    );
    expect(sermonSlugSource('Faith & Works: Part 1', '2026-09-06')).toBe(
      'faith-works-part-1-2026-09-06',
    );
  });

  it('keeps numerals', () => {
    expect(sermonSlugSource('1 Timothy 6:6–19', '2026-09-06')).toBe(
      '1-timothy-6-6-19-2026-09-06',
    );
  });

  it('works without a title or date', () => {
    expect(sermonSlugSource('', '2026-10-11')).toBe('2026-10-11');
    expect(sermonSlugSource('Grace', undefined)).toBe('grace');
  });
});
