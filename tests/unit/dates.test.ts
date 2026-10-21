import { describe, expect, it } from 'vitest';
import { formatSermonDate, toChicagoDate } from '../../src/lib/dates';

describe('toChicagoDate', () => {
  it('converts a UTC afternoon to the same Chicago day', () => {
    expect(toChicagoDate('2026-10-18T22:13:15Z')).toBe('2026-10-18');
  });

  it('keeps late-evening Chicago time on the previous UTC day', () => {
    expect(toChicagoDate('2026-10-19T04:30:00Z')).toBe('2026-10-18');
  });

  it('handles standard time (CST)', () => {
    expect(toChicagoDate('2026-12-07T05:30:00Z')).toBe('2026-12-06');
    expect(toChicagoDate('2026-12-07T06:00:00Z')).toBe('2026-12-07');
  });

  it('accepts Date objects', () => {
    expect(toChicagoDate(new Date('2026-10-19T04:30:00Z'))).toBe('2026-10-18');
  });

  it('passes date-only strings through unchanged', () => {
    expect(toChicagoDate('2026-10-18')).toBe('2026-10-18');
  });
});

describe('formatSermonDate', () => {
  it('formats a date-only string without shifting it', () => {
    expect(formatSermonDate('2026-10-18')).toBe('October 18, 2026');
    expect(formatSermonDate('2026-01-01')).toBe('January 1, 2026');
    expect(formatSermonDate('2026-12-31')).toBe('December 31, 2026');
  });
});
