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
      PCO_FIXTURE_FILE: 'tests/fixtures/pco-empty/event_instances.json',
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

describe('a site with no upcoming events', () => {
  it('/events shows the Church Center link and no event rows', () => {
    const page = html('events');
    expect(page).toContain('See all upcoming events on Church Center');
    expect(page).toContain(
      'href="https://crosswaysa.churchcenter.com/calendar?view=gallery"',
    );
    expect(page).toContain('Registrations');
    expect(page).not.toContain('data-event');
  });
});

describe('a site with no leaders in Sanity', () => {
  it('/who-we-are falls back to the roster in the page frontmatter', () => {
    const page = html('who-we-are');
    expect(page).toContain('Pastor | Elders');
    expect(page).toContain('Josh de Koning');
    expect(page).toContain('Senior Pastor | Elder');
    expect(page).toContain('Kristen Clark');
    expect(page.match(/data-leader(?=[\s>])/g)).toHaveLength(19);
  });
});
