import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../../src/lib/seo/serialize';
import { churchJsonLd } from '../../src/lib/seo/church';
import { eventJsonLd, eventsJsonLd } from '../../src/lib/seo/event';
import type { ChurchEvent } from '../../src/lib/events/pco';

const ORIGIN = 'https://crosswaysa.org';

const base: ChurchEvent = {
  id: '1',
  name: 'Fall Festival',
  startsAt: '2026-10-26T00:00:00Z',
  endsAt: '2026-10-26T01:30:00Z',
  allDay: false,
  location: 'Main Campus',
  url: 'https://crosswaysa.churchcenter.com/calendar/event/1',
};

describe('serializeJsonLd', () => {
  it('round-trips ordinary data', () => {
    const data = { '@type': 'Church', name: 'Crossway', n: 1, list: [1, 2] };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('never emits a raw less-than sign', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('</script');
  });

  it('survives hostile strings and still parses back to the original', () => {
    const hostile = [
      '</script>',
      '</SCRIPT >',
      '<!--',
      '<script>',
      '\u2028\u2029',
      '"quoted" \\ back',
      '-->',
      '<img src=x onerror=alert(1)>',
    ];
    const data = { a: hostile, b: { [hostile[0]]: hostile[1] } };
    const out = serializeJsonLd(data);
    expect(out).not.toMatch(/<|\u2028|\u2029/);
    expect(JSON.parse(out)).toEqual(data);
  });

  it('escapes the less-than sign as a JSON unicode escape', () => {
    expect(serializeJsonLd({ x: '<' })).toBe('{"x":"\\u003c"}');
  });
});

describe('churchJsonLd', () => {
  const church = churchJsonLd(ORIGIN) as Record<string, any>;

  it('is a schema.org Church with only known facts', () => {
    expect(church['@context']).toBe('https://schema.org');
    expect(church['@type']).toBe('Church');
    expect(church.name).toBe('Crossway Bible Church');
    expect(church.url).toBe('https://crosswaysa.org/');
  });

  it('has the postal address', () => {
    expect(church.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '15759 San Pedro Ave',
      addressLocality: 'San Antonio',
      addressRegion: 'TX',
      postalCode: '78232',
      addressCountry: 'US',
    });
  });

  it('links socials, map, logo and image with absolute URLs', () => {
    expect(church.sameAs).toEqual([
      'https://www.facebook.com/CrosswayBibleChurchSA',
      'https://www.instagram.com/crosswaybiblechurchsa/',
    ]);
    expect(church.hasMap).toBe('https://maps.app.goo.gl/o7uWJUWy6KxYDraX7');
    expect(church.logo).toBe('https://crosswaysa.org/icons/icon-512.png');
    expect(church.image).toBe('https://crosswaysa.org/og/default.jpg');
  });

  it('does not invent hours, phone or email', () => {
    const json = JSON.stringify(church);
    expect(json).not.toMatch(/openingHours|telephone|email|closes|opens/i);
  });
});

describe('eventJsonLd', () => {
  const ld = (event: ChurchEvent) =>
    eventJsonLd(event, ORIGIN) as Record<string, any>;

  it('describes a timed event with a CDT offset', () => {
    const out = ld(base);
    expect(out['@context']).toBe('https://schema.org');
    expect(out['@type']).toBe('Event');
    expect(out.name).toBe('Fall Festival');
    expect(out.startDate).toBe('2026-10-25T19:00:00-05:00');
    expect(out.endDate).toBe('2026-10-25T20:30:00-05:00');
    expect(out.eventAttendanceMode).toBe(
      'https://schema.org/OfflineEventAttendanceMode',
    );
    expect(out.eventStatus).toBe('https://schema.org/EventScheduled');
    expect(out.url).toBe(base.url);
    expect(out.organizer).toEqual({
      '@type': 'Church',
      name: 'Crossway Bible Church',
      url: 'https://crosswaysa.org/',
    });
  });

  it('uses a CST offset in winter', () => {
    const out = ld({
      ...base,
      startsAt: '2026-12-13T23:00:00Z',
      endsAt: '2026-12-14T01:30:00Z',
    });
    expect(out.startDate).toBe('2026-12-13T17:00:00-06:00');
    expect(out.endDate).toBe('2026-12-13T19:30:00-06:00');
  });

  it('gets the offset right on either side of the fall-back hour', () => {
    expect(
      ld({ ...base, startsAt: '2026-11-01T06:30:00Z', endsAt: undefined })
        .startDate,
    ).toBe('2026-11-01T01:30:00-05:00');
    expect(
      ld({ ...base, startsAt: '2026-11-01T07:30:00Z', endsAt: undefined })
        .startDate,
    ).toBe('2026-11-01T01:30:00-06:00');
  });

  it('omits endDate when there is no end or it is not after the start', () => {
    expect(ld({ ...base, endsAt: undefined })).not.toHaveProperty('endDate');
    expect(ld({ ...base, endsAt: base.startsAt })).not.toHaveProperty(
      'endDate',
    );
  });

  it('uses a date-only value for an all-day event stored at UTC midnight', () => {
    const out = ld({
      ...base,
      allDay: true,
      startsAt: '2026-10-31T00:00:00Z',
      endsAt: undefined,
    });
    expect(out.startDate).toBe('2026-10-31');
    expect(out).not.toHaveProperty('endDate');
  });

  it('uses a date-only value for an all-day event stored at Chicago midnight', () => {
    const out = ld({
      ...base,
      allDay: true,
      startsAt: '2026-10-31T05:00:00Z',
      endsAt: undefined,
    });
    expect(out.startDate).toBe('2026-10-31');
  });

  it('gives a multi-day all-day event an inclusive last day', () => {
    const out = ld({
      ...base,
      allDay: true,
      startsAt: '2026-10-30T00:00:00Z',
      endsAt: '2026-11-01T00:00:00Z',
    });
    expect(out.startDate).toBe('2026-10-30');
    expect(out.endDate).toBe('2026-10-31');
  });

  it('uses the event location string as a named Place only', () => {
    expect(ld(base).location).toEqual({
      '@type': 'Place',
      name: 'Main Campus',
    });
  });

  it('omits location when planning center has none', () => {
    const out = ld({ ...base, location: undefined });
    expect(out).not.toHaveProperty('location');
    expect(JSON.stringify(out)).not.toContain('San Pedro');
  });

  it('includes the image when present, absolute', () => {
    expect(ld({ ...base, imageUrl: 'https://cdn.example/x.jpg' }).image).toBe(
      'https://cdn.example/x.jpg',
    );
    expect(ld({ ...base, imageUrl: '/a.jpg' }).image).toBe(
      'https://crosswaysa.org/a.jpg',
    );
    expect(ld(base)).not.toHaveProperty('image');
  });
});

describe('eventsJsonLd', () => {
  it('returns undefined when there are no events', () => {
    expect(eventsJsonLd(null, ORIGIN)).toBeUndefined();
    expect(eventsJsonLd([], ORIGIN)).toBeUndefined();
  });

  it('returns an array of events', () => {
    const out = eventsJsonLd([base, { ...base, id: '2' }], ORIGIN);
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(2);
  });
});
