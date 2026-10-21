import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAudioReport, run } from '../../scripts/audio-report';

const NOW = new Date('2026-10-21T12:00:00Z');
const hoursAgo = (h: number) =>
  new Date(NOW.getTime() - h * 3600_000).toISOString();

const sermon = (i: number) => ({
  slug: `s-${i}`,
  title: `Sermon ${i}`,
  date: '2026-01-01',
});
const episode = (i: number) => ({
  id: `e-${i}`,
  title: `Episode ${i}`,
  pubDate: '2026-02-02',
});

describe('formatAudioReport', () => {
  it('prints one line when the report is absent', () => {
    expect(formatAudioReport(undefined, NOW)).toBe(
      'No audio report (feed unavailable or no sermons)',
    );
  });

  it.each([null, 'str', 42, [], {}, { generatedAt: 5 }])(
    'degrades gracefully for malformed report %j',
    (bad) => {
      const out = formatAudioReport(bad, NOW);
      expect(typeof out).toBe('string');
      expect(out).toMatch(/unreadable|No audio report/i);
    },
  );

  it('formats a fresh report with all matched', () => {
    const out = formatAudioReport(
      { generatedAt: hoursAgo(2), unmatchedSermons: [], unmatchedEpisodes: [] },
      NOW,
    );
    expect(out).toContain(hoursAgo(2));
    expect(out).not.toContain('STALE');
    expect(out).toContain('Unmatched sermons (0)');
    expect(out).toContain('Unmatched episodes (0)');
  });

  it('flags a report older than 36 hours as stale', () => {
    const out = formatAudioReport(
      {
        generatedAt: hoursAgo(37),
        unmatchedSermons: [],
        unmatchedEpisodes: [],
      },
      NOW,
    );
    expect(out).toContain('STALE');
  });

  it('does not flag exactly 36 hours as stale', () => {
    const out = formatAudioReport(
      {
        generatedAt: hoursAgo(36),
        unmatchedSermons: [],
        unmatchedEpisodes: [],
      },
      NOW,
    );
    expect(out).not.toContain('STALE');
  });

  it('lists unmatched sermons and episodes with their fields', () => {
    const out = formatAudioReport(
      {
        generatedAt: hoursAgo(1),
        unmatchedSermons: [sermon(1)],
        unmatchedEpisodes: [episode(1)],
      },
      NOW,
    );
    expect(out).toContain('s-1');
    expect(out).toContain('Sermon 1');
    expect(out).toContain('2026-01-01');
    expect(out).toContain('e-1');
    expect(out).toContain('Episode 1');
    expect(out).toContain('2026-02-02');
    expect(out).not.toContain('more');
  });

  it('truncates each list to 20 with an and-N-more line', () => {
    const out = formatAudioReport(
      {
        generatedAt: hoursAgo(1),
        unmatchedSermons: Array.from({ length: 25 }, (_, i) => sermon(i)),
        unmatchedEpisodes: Array.from({ length: 21 }, (_, i) => episode(i)),
      },
      NOW,
    );
    expect(out).toContain('s-19');
    expect(out).not.toContain('s-20 ');
    expect(out).toContain('…and 5 more');
    expect(out).toContain('e-19');
    expect(out).not.toContain('e-20');
    expect(out).toContain('…and 1 more');
    expect(out).toContain('Unmatched sermons (25)');
  });

  it('ignores malformed entries instead of throwing', () => {
    const out = formatAudioReport(
      {
        generatedAt: hoursAgo(1),
        unmatchedSermons: [null, 3, sermon(1)],
        unmatchedEpisodes: 'nope',
      },
      NOW,
    );
    expect(out).toContain('s-1');
  });

  it('treats an unparsable generatedAt as unreadable-age and stale', () => {
    const out = formatAudioReport(
      { generatedAt: 'garbage', unmatchedSermons: [], unmatchedEpisodes: [] },
      NOW,
    );
    expect(out).toContain('STALE');
  });
});

describe('run', () => {
  let dir = '';
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  const useDir = () => {
    dir = mkdtempSync(join(tmpdir(), 'crossway-audio-report-'));
    vi.stubEnv('CROSSWAY_CACHE_DIR', dir);
  };

  it('prints the no-report line when the cache is empty', () => {
    useDir();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(run(NOW)).toBe(0);
    expect(log).toHaveBeenCalledWith(
      'No audio report (feed unavailable or no sermons)',
    );
  });

  it('prints a stored report', () => {
    useDir();
    writeFileSync(
      join(dir, 'audio-report.json'),
      JSON.stringify({
        generatedAt: hoursAgo(1),
        unmatchedSermons: [sermon(7)],
        unmatchedEpisodes: [],
      }),
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(run(NOW)).toBe(0);
    expect(String(log.mock.calls[0][0])).toContain('s-7');
  });

  it('returns 0 and does not throw on malformed JSON in the cache', () => {
    useDir();
    writeFileSync(join(dir, 'audio-report.json'), '{not json');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(run(NOW)).toBe(0);
  });

  it('returns 0 even if printing throws', () => {
    useDir();
    vi.spyOn(console, 'log').mockImplementation(() => {
      throw new Error('stdout closed');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(run(NOW)).toBe(0);
  });
});
