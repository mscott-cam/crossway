import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GET, prerender } from '../../src/pages/sermons/filter';

const call = async (query: string) => {
  const response = await (
    GET as unknown as (ctx: unknown) => Promise<Response>
  )({ url: new URL(`http://localhost/sermons/filter${query}`) });
  return {
    status: response.status,
    location: response.headers.get('location'),
    cache: response.headers.get('cache-control'),
  };
};

describe('filter route source', () => {
  const source = readFileSync('src/pages/sermons/filter.ts', 'utf8');

  it('is on demand', () => {
    expect(prerender).toBe(false);
  });

  it('imports no data layer', () => {
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    );
    expect(
      imports.filter((path) => /sanity|audio|cache|queries/.test(path)),
    ).toEqual([]);
    expect(source).not.toMatch(/getSermons|getSpeakers|getSeriesList/);
  });
});

describe('filter route', () => {
  it('redirects a known book to its page with 303 and a CDN cache header', async () => {
    expect(await call('?book=1-timothy')).toEqual({
      status: 303,
      location: '/sermons/book/1-timothy',
      cache: 'public, s-maxage=3600',
    });
  });

  it('redirects a well-formed speaker slug', async () => {
    expect(await call('?speaker=josh-de-koning')).toMatchObject({
      status: 303,
      location: '/sermons/speaker/josh-de-koning',
    });
  });

  it('lets the book win when both are supplied', async () => {
    expect(await call('?book=john&speaker=josh-collins')).toMatchObject({
      location: '/sermons/book/john',
    });
  });

  it('falls back to the speaker when the book is invalid', async () => {
    expect(await call('?book=nope&speaker=josh-collins')).toMatchObject({
      location: '/sermons/speaker/josh-collins',
    });
  });

  it('sends empty and invalid input to /sermons', async () => {
    for (const query of [
      '',
      '?book=',
      '?speaker=',
      '?book=not-a-book',
      '?book=//evil.example',
      '?speaker=//evil.example',
      '?speaker=https://evil.example',
      '?speaker=../../etc/passwd',
      '?speaker=Josh%20Collins',
      '?speaker=UPPER',
      '?speaker=-leading',
      '?speaker=trailing-',
      '?speaker=a--b',
      '?speaker=%0d%0aSet-Cookie:x=1',
      `?speaker=${'a'.repeat(200)}`,
    ]) {
      expect(await call(query), query).toMatchObject({
        status: 303,
        location: '/sermons',
      });
    }
  });
});
