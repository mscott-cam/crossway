import { pathToFileURL } from 'node:url';
import { readCache } from '../src/lib/cache';

const STALE_AFTER_MS = 36 * 3600_000;
const LIMIT = 20;

const ABSENT = 'No audio report (feed unavailable or no sermons)';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === 'string' ? value : '?');

function section(
  heading: string,
  items: unknown,
  describe: (item: Record<string, unknown>) => string,
): string[] {
  const rows = (Array.isArray(items) ? items : []).filter(isRecord);
  const lines = [`${heading} (${rows.length})`];
  for (const row of rows.slice(0, LIMIT)) lines.push(`  - ${describe(row)}`);
  if (rows.length > LIMIT) lines.push(`  …and ${rows.length - LIMIT} more`);
  return lines;
}

export function formatAudioReport(report: unknown, now: Date): string {
  if (report === undefined) return ABSENT;
  if (!isRecord(report) || typeof report.generatedAt !== 'string') {
    return 'Audio report is unreadable (unexpected shape)';
  }
  const age = now.getTime() - Date.parse(report.generatedAt);
  const stale = !Number.isFinite(age) || age > STALE_AFTER_MS;
  return [
    `Audio report generated ${report.generatedAt}${
      stale
        ? ' (STALE: older than 36 hours; the last build did not refresh it)'
        : ''
    }`,
    ...section(
      'Unmatched sermons',
      report.unmatchedSermons,
      (s) => `${text(s.slug)} | ${text(s.title)} | ${text(s.date)}`,
    ),
    ...section(
      'Unmatched episodes',
      report.unmatchedEpisodes,
      (e) => `${text(e.id)} | ${text(e.title)} | ${text(e.pubDate)}`,
    ),
  ].join('\n');
}

export function run(now: Date = new Date()): number {
  try {
    console.log(formatAudioReport(readCache<unknown>('audio-report'), now));
  } catch {
    try {
      console.warn('[audio-report] could not print the report');
    } catch {}
  }
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run();
}
