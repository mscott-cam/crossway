const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const chicago = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toChicagoDate(d: Date | string): string {
  if (typeof d === 'string' && DATE_ONLY.test(d)) return d;
  const date = typeof d === 'string' ? new Date(d) : d;
  const parts = chicago.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const long = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function formatSermonDate(iso: string): string {
  const [year, month, day] = toChicagoDate(iso).split('-').map(Number);
  return long.format(new Date(Date.UTC(year, month - 1, day)));
}

const chicagoClock = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});

const chicagoPeriod = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function clock(date: Date) {
  const parts = chicagoClock.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const periodParts = chicagoPeriod.formatToParts(date);
  const period = (
    periodParts.find((p) => p.type === 'dayPeriod')?.value ?? ''
  ).toUpperCase();
  return {
    weekday: get('weekday'),
    month: get('month'),
    day: get('day'),
    hour: Number(get('hour')),
    hour12: periodParts.find((p) => p.type === 'hour')?.value ?? '',
    minute: get('minute'),
    period,
  };
}

const calendarDay = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function dayParts(ymd: string) {
  const [year, month, day] = ymd.split('-').map(Number);
  const parts = calendarDay.formatToParts(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  const monthName = get('month');
  const dayNumber = get('day');
  return {
    label: `${weekday}, ${monthName} ${dayNumber}`,
    month: monthName,
    day: dayNumber,
  };
}

const isUtcMidnight = (date: Date) => date.getTime() % 86_400_000 === 0;

export type EventWhenInput = {
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
};

const MINUTE = 60_000;

export function eventSpan(input: EventWhenInput): {
  first: string;
  last: string;
} {
  const start = new Date(input.startsAt);
  const parsedEnd = input.endsAt ? new Date(input.endsAt) : undefined;
  const end =
    parsedEnd && parsedEnd.getTime() > start.getTime() ? parsedEnd : undefined;
  if (input.allDay) {
    const day = isUtcMidnight(start)
      ? (date: Date) => date.toISOString().slice(0, 10)
      : (date: Date) => toChicagoDate(date);
    const first = day(start);
    const last = end ? day(new Date(end.getTime() - MINUTE)) : first;
    return { first, last: last < first ? first : last };
  }
  return {
    first: toChicagoDate(start),
    last: toChicagoDate(end ?? start),
  };
}

export function formatEventDate(iso: string, allDay = false): string {
  if (allDay) {
    return dayParts(eventSpan({ startsAt: iso, allDay }).first).label;
  }
  const c = clock(new Date(iso));
  return `${c.weekday}, ${c.month} ${c.day}`;
}

export function formatEventTime(iso: string): string {
  const c = clock(new Date(iso));
  return `${c.hour12}:${c.minute} ${c.period}`;
}

export type EventWhen = {
  dateLabel: string;
  timeLabel?: string;
  day: string;
  month: string;
  datetime: string;
};

const SPILL_HOURS = 12;
const SPILL_CUTOFF_HOUR = 6;

function timeRange(start: Date, end: Date): string {
  const s = clock(start);
  const e = clock(end);
  const from =
    s.period === e.period
      ? `${s.hour12}:${s.minute}`
      : `${s.hour12}:${s.minute} ${s.period}`;
  return `${from} – ${e.hour12}:${e.minute} ${e.period}`;
}

export function describeEventWhen(input: EventWhenInput): EventWhen {
  const start = new Date(input.startsAt);
  const parsedEnd = input.endsAt ? new Date(input.endsAt) : undefined;
  const end =
    parsedEnd && parsedEnd.getTime() > start.getTime() ? parsedEnd : undefined;
  const startClock = clock(start);
  const startDay = toChicagoDate(start);
  const startLabel = formatEventDate(input.startsAt);
  const base = { day: startClock.day, month: startClock.month };

  if (input.allDay) {
    const { first, last } = eventSpan(input);
    const firstDay = dayParts(first);
    return {
      day: firstDay.day,
      month: firstDay.month,
      dateLabel:
        last > first
          ? `${firstDay.label} – ${dayParts(last).label}`
          : firstDay.label,
      datetime: first,
    };
  }

  if (!end) {
    return {
      ...base,
      dateLabel: startLabel,
      timeLabel: formatEventTime(input.startsAt),
      datetime: input.startsAt,
    };
  }

  const endsLater = toChicagoDate(end) > startDay;
  const spillsPastMidnight =
    endsLater &&
    clock(end).hour < SPILL_CUTOFF_HOUR &&
    end.getTime() - start.getTime() < SPILL_HOURS * 60 * MINUTE;

  if (endsLater && !spillsPastMidnight) {
    return {
      ...base,
      dateLabel: `${startLabel} – ${formatEventDate(end.toISOString())}`,
      timeLabel: `Starts ${formatEventTime(input.startsAt)}`,
      datetime: input.startsAt,
    };
  }

  return {
    ...base,
    dateLabel: startLabel,
    timeLabel: timeRange(start, end),
    datetime: input.startsAt,
  };
}
