import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const out = join(process.cwd(), 'dist-empty-states');

const html = (path: string) =>
  readFileSync(join(out, 'client', path, 'index.html'), 'utf8');

beforeAll(() => {
  rmSync(out, { recursive: true, force: true });
  execFileSync('npx', ['astro', 'build', '--outDir', out], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      E2E: '1',
      SANITY_FIXTURES: '1',
      SANITY_FIXTURE_DIR: 'tests/fixtures/sanity-empty',
    },
    stdio: 'pipe',
  });
}, 180_000);

afterAll(() => {
  rmSync(out, { recursive: true, force: true });
});

describe('a site with no sermons', () => {
  it('/sermons shows the empty message and no sections', () => {
    const page = html('sermons');
    expect(page).toContain('Messages will appear here soon.');
    expect(page).not.toContain('id="latest-heading"');
    expect(page).not.toContain('id="series-heading"');
    expect(page).not.toContain('id="archive-heading"');
  });

  it('/series shows the empty message', () => {
    expect(html('series')).toContain('No series yet.');
  });

  it('the archive shows an empty list message and no pagination', () => {
    const page = html('sermons/archive/1');
    expect(page).toContain('No messages here yet.');
    expect(page).not.toContain('aria-label="Pagination"');
  });
});
