import { describe, expect, it, vi } from 'vitest';
import {
  buildRedirects,
  loadAstroRedirects,
  toAstroRedirects,
} from '../../scripts/build-redirects';

const connect = {
  source: '/connect',
  destination: '/visit',
  permanent: true,
};

const archive = {
  source: '/sermons/archive',
  destination: '/sermons/archive/1',
  permanent: true,
};

const culture = {
  source: '/culture',
  destination: '/#culture',
  permanent: true,
};

const statics = [connect, culture, archive];

describe('buildRedirects', () => {
  it('redirects the bare archive path to its first page', () => {
    expect(buildRedirects([])).toContainEqual(archive);
  });

  it('always includes /connect to /visit', () => {
    expect(buildRedirects([])).toEqual(statics);
  });

  it('emits nothing for an unchanged slug', () => {
    const out = buildRedirects([
      { slug: 'grace-2026-01-04', webflowPath: '/sermons/grace-2026-01-04' },
    ]);
    expect(out).toEqual(statics);
  });

  it('emits one 301 for a changed slug', () => {
    const out = buildRedirects([
      { slug: 'grace-and-truth-2026-01-04', webflowPath: '/sermons/grace' },
    ]);
    expect(out).toEqual([
      ...statics,
      {
        source: '/sermons/grace',
        destination: '/sermons/grace-and-truth-2026-01-04',
        permanent: true,
      },
    ]);
  });

  it('emits nothing for sermons without a webflowPath', () => {
    expect(buildRedirects([{ slug: 'new-one-2026-02-01' }])).toEqual(statics);
  });

  it('dedupes by source and keeps the first', () => {
    const out = buildRedirects([
      { slug: 'a-2026-01-04', webflowPath: '/sermons/old' },
      { slug: 'b-2026-01-11', webflowPath: '/sermons/old' },
    ]);
    expect(out.filter((r) => r.source === '/sermons/old')).toEqual([
      {
        source: '/sermons/old',
        destination: '/sermons/a-2026-01-04',
        permanent: true,
      },
    ]);
  });

  it('skips a redirect whose source equals its destination', () => {
    const out = buildRedirects([
      { slug: 'same', webflowPath: '/sermons/same/' },
      { slug: 'same-2', webflowPath: '/sermons/same-2' },
    ]);
    expect(out).toEqual(statics);
  });

  it('skips a source that is another sermon page', () => {
    const out = buildRedirects([
      { slug: 'new-2026-01-04', webflowPath: '/sermons/other-2026-01-11' },
      { slug: 'other-2026-01-11' },
    ]);
    expect(out).toEqual(statics);
  });

  it('skips a source that collides with a static route', () => {
    const warn = vi.fn();
    const out = buildRedirects(
      [
        { slug: 'x-2026-01-04', webflowPath: '/sermons/archive' },
        { slug: 'y-2026-01-11', webflowPath: '/sermons/filter' },
        { slug: 'z-2026-01-18', webflowPath: '/sermons' },
      ],
      { warn },
    );
    expect(out).toEqual(statics);
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('skips sources that are not a single safe sermon segment', () => {
    const out = buildRedirects([
      { slug: 'a-2026-01-04', webflowPath: '/sermons/Weird: slug/ü?' },
      { slug: 'b-2026-01-11', webflowPath: '/elsewhere/old' },
      { slug: 'c-2026-01-18', webflowPath: '/sermons/[id]' },
    ]);
    expect(out).toEqual(statics);
  });

  it('caps the total and reports it', () => {
    const warn = vi.fn();
    const sermons = Array.from({ length: 10 }, (_, i) => ({
      slug: `s${i}-2026-01-04`,
      webflowPath: `/sermons/old${i}`,
    }));
    const out = buildRedirects(sermons, { max: 4, warn });
    expect(out).toHaveLength(4);
    expect(out.slice(0, statics.length)).toEqual(statics);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cap'));
  });
});

describe('toAstroRedirects', () => {
  it('maps entries to Astro redirect config with status 301', () => {
    expect(toAstroRedirects(buildRedirects([]))).toEqual({
      '/connect': { status: 301, destination: '/visit' },
      '/culture': { status: 301, destination: '/#culture' },
      '/sermons/archive': { status: 301, destination: '/sermons/archive/1' },
    });
  });
});

describe('loadAstroRedirects', () => {
  it('uses the sermon list when it loads', async () => {
    const out = await loadAstroRedirects(async () => [
      { slug: 'new-2026-01-04', webflowPath: '/sermons/old' },
    ]);
    expect(out['/sermons/old']).toEqual({
      status: 301,
      destination: '/sermons/new-2026-01-04',
    });
    expect(out['/connect']).toBeDefined();
  });

  it('falls back to the static map with one warning when loading fails', async () => {
    const warn = vi.fn();
    const out = await loadAstroRedirects(async () => {
      throw new Error('boom');
    }, warn);
    expect(Object.keys(out)).toEqual([
      '/connect',
      '/culture',
      '/sermons/archive',
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('boom');
  });
});

describe('fixture sermons', () => {
  it('has exactly two legacy slugs that differ from the current slug', async () => {
    const { readFileSync } = await import('node:fs');
    const sermons = JSON.parse(
      readFileSync('tests/fixtures/sanity/sermons.json', 'utf8'),
    ) as { slug: string; webflowPath?: string }[];
    const changed = sermons.filter(
      (s) => s.webflowPath && s.webflowPath !== `/sermons/${s.slug}`,
    );
    expect(changed).toHaveLength(2);
    expect(buildRedirects(sermons)).toHaveLength(2 + statics.length);
  });
});
