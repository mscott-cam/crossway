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
