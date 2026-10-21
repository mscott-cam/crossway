import { sermonSlug } from '../../src/lib/slug';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function defaultSermonDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const daysSinceSunday = WEEKDAYS.indexOf(get('weekday'));
  const day = new Date(
    Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))),
  );
  day.setUTCDate(day.getUTCDate() - daysSinceSunday);
  return day.toISOString().slice(0, 10);
}

export function sermonSlugSource(title: string, date?: string): string {
  return sermonSlug(title, date ?? '');
}
