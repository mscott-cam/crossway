import { describe, expect, it } from 'vitest';
import { hasCurrentChild, isCurrent } from '../../src/lib/nav-state';
import { nav } from '../../src/lib/site';

const aboutUs = nav.find((item) => item.label === 'About Us')!;
const connect = nav.find((item) => item.label === 'Connect')!;
const give = nav.find((item) => item.label === 'Give')!;

describe('isCurrent', () => {
  it('matches the exact path', () => {
    expect(isCurrent('/visit', '/visit')).toBe(true);
    expect(isCurrent('/culture', '/visit')).toBe(false);
  });

  it('matches nested routes under the href', () => {
    expect(isCurrent('/sermons/some-sermon-2026-01-04', '/sermons')).toBe(true);
  });

  it('does not match a path that only shares a prefix', () => {
    expect(isCurrent('/visit-us', '/visit')).toBe(false);
    expect(isCurrent('/events-archive', '/events')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isCurrent('/visit/', '/visit')).toBe(true);
  });

  it('matches only the home page for /', () => {
    expect(isCurrent('/', '/')).toBe(true);
    expect(isCurrent('/visit', '/')).toBe(false);
  });

  it('is never current without an href or for external links', () => {
    expect(isCurrent('/visit', undefined)).toBe(false);
    expect(isCurrent('/g/crosswaysa', give.href)).toBe(false);
    expect(isCurrent('/', give.href)).toBe(false);
  });

  it('marks Connect current on /visit', () => {
    expect(isCurrent('/visit', connect.href)).toBe(true);
  });
});

describe('hasCurrentChild', () => {
  it('is true when a child route is current', () => {
    expect(hasCurrentChild('/who-we-are', aboutUs)).toBe(true);
    expect(hasCurrentChild('/what-we-believe/', aboutUs)).toBe(true);
  });

  it('is false for other routes and for the home page', () => {
    expect(hasCurrentChild('/sermons', aboutUs)).toBe(false);
    expect(hasCurrentChild('/', aboutUs)).toBe(false);
  });

  it('is false for items without children', () => {
    expect(hasCurrentChild('/visit', connect)).toBe(false);
  });

  it('ignores external children', () => {
    const churchLife = nav.find((item) => item.label === 'Church Life')!;
    expect(hasCurrentChild('/', churchLife)).toBe(false);
  });
});
