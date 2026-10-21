import { describe, expect, it } from 'vitest';
import {
  formatServiceTimes,
  serviceTimeParts,
} from '../../src/lib/format-times';

describe('formatServiceTimes', () => {
  it('joins two times with an ampersand and appends AM once', () => {
    expect(formatServiceTimes(['9:00', '10:45'])).toBe('9:00 & 10:45 AM');
  });

  it('handles a single time', () => {
    expect(formatServiceTimes(['10:00'])).toBe('10:00 AM');
  });

  it('lists three or more with commas and a final ampersand', () => {
    expect(formatServiceTimes(['8:00', '9:30', '11:00'])).toBe(
      '8:00, 9:30 & 11:00 AM',
    );
  });

  it('leaves entries alone when any already carries am or pm', () => {
    expect(formatServiceTimes(['9:00 AM', '6:00 PM'])).toBe(
      '9:00 AM & 6:00 PM',
    );
    expect(formatServiceTimes(['9:00am', '6pm'])).toBe('9:00am & 6pm');
  });

  it('trims entries and drops blanks', () => {
    expect(formatServiceTimes([' 9:00 ', '', '10:45'])).toBe('9:00 & 10:45 AM');
  });

  it('returns an empty string for no times', () => {
    expect(formatServiceTimes([])).toBe('');
  });
});

describe('serviceTimeParts', () => {
  it('splits into times, separators and the meridiem', () => {
    expect(serviceTimeParts(['9:00', '10:45'])).toEqual([
      { kind: 'time', text: '9:00' },
      { kind: 'separator', text: ' & ' },
      { kind: 'time', text: '10:45' },
      { kind: 'meridiem', text: ' AM' },
    ]);
  });
});
