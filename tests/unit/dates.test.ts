import { describe, expect, it } from 'vitest';
import {
  describeEventWhen,
  formatEventDate,
  formatEventTime,
  formatSermonDate,
  toChicagoDate,
} from '../../src/lib/dates';

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

describe('formatEventDate and formatEventTime', () => {
  it('formats a Chicago weekday, month and day', () => {
    expect(formatEventDate('2026-10-26T00:00:00Z')).toBe('Sun, Oct 25');
    expect(formatEventDate('2026-12-13T23:00:00Z')).toBe('Sun, Dec 13');
  });

  it('formats times in Chicago across daylight saving', () => {
    expect(formatEventTime('2026-10-26T00:00:00Z')).toBe('7:00 PM');
    expect(formatEventTime('2026-11-05T00:30:00Z')).toBe('6:30 PM');
    expect(formatEventTime('2026-11-01T07:30:00Z')).toBe('1:30 AM');
    expect(formatEventTime('2026-12-13T18:00:00Z')).toBe('12:00 PM');
  });

  it('uses ordinary spaces', () => {
    expect(formatEventTime('2026-10-26T00:00:00Z')).not.toMatch(/ | /);
  });
});

describe('describeEventWhen', () => {
  it('shares the meridiem across a same-period range', () => {
    expect(
      describeEventWhen({
        startsAt: '2026-10-26T00:00:00Z',
        endsAt: '2026-10-26T01:30:00Z',
        allDay: false,
      }),
    ).toEqual({
      dateLabel: 'Sun, Oct 25',
      timeLabel: '7:00 – 8:30 PM',
      day: '25',
      month: 'Oct',
      datetime: '2026-10-26T00:00:00Z',
    });
  });

  it('keeps both meridiems when the range crosses noon', () => {
    expect(
      describeEventWhen({
        startsAt: '2026-12-13T16:30:00Z',
        endsAt: '2026-12-13T19:00:00Z',
        allDay: false,
      }).timeLabel,
    ).toBe('10:30 AM – 1:00 PM');
  });

  it('shows only the start time without an end', () => {
    expect(
      describeEventWhen({ startsAt: '2026-10-26T00:00:00Z', allDay: false })
        .timeLabel,
    ).toBe('7:00 PM');
  });

  it('ignores an end that is not after the start', () => {
    expect(
      describeEventWhen({
        startsAt: '2026-10-26T00:00:00Z',
        endsAt: '2026-10-26T00:00:00Z',
        allDay: false,
      }).timeLabel,
    ).toBe('7:00 PM');
  });

  it('keeps an event that runs past midnight on its start day', () => {
    const when = describeEventWhen({
      startsAt: '2027-01-01T04:00:00Z',
      endsAt: '2027-01-01T06:30:00Z',
      allDay: false,
    });
    expect(when.dateLabel).toBe('Thu, Dec 31');
    expect(when.timeLabel).toBe('10:00 PM – 12:30 AM');
    expect(when.day).toBe('31');
    expect(when.month).toBe('Dec');
  });

  it('shows a date range and the start time for a multi-day event', () => {
    const when = describeEventWhen({
      startsAt: '2026-11-21T00:00:00Z',
      endsAt: '2026-11-22T18:00:00Z',
      allDay: false,
    });
    expect(when.dateLabel).toBe('Fri, Nov 20 – Sun, Nov 22');
    expect(when.timeLabel).toBe('Starts 6:00 PM');
  });

  it('shows no time for a single all-day event ending at local midnight', () => {
    expect(
      describeEventWhen({
        startsAt: '2026-11-14T06:00:00Z',
        endsAt: '2026-11-15T06:00:00Z',
        allDay: true,
      }),
    ).toEqual({
      dateLabel: 'Sat, Nov 14',
      day: '14',
      month: 'Nov',
      datetime: '2026-11-14',
    });
  });

  it('shows a range for a multi-day all-day event', () => {
    const when = describeEventWhen({
      startsAt: '2026-11-14T06:00:00Z',
      endsAt: '2026-11-17T06:00:00Z',
      allDay: true,
    });
    expect(when.dateLabel).toBe('Sat, Nov 14 – Mon, Nov 16');
    expect(when.timeLabel).toBeUndefined();
  });

  it('treats an all-day event ending at 11:59 PM as a single day', () => {
    expect(
      describeEventWhen({
        startsAt: '2026-11-14T06:00:00Z',
        endsAt: '2026-11-15T05:59:00Z',
        allDay: true,
      }).dateLabel,
    ).toBe('Sat, Nov 14');
  });
});
