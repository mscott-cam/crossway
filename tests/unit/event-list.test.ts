import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import EventList from '../../src/components/event-list.astro';
import type { ChurchEvent } from '../../src/lib/events/pco';

const CALENDAR = 'https://crosswaysa.churchcenter.com/calendar?view=gallery';

const events: ChurchEvent[] = [
  {
    id: '1001',
    name: 'Advanced Commitment Night',
    startsAt: '2026-10-26T00:00:00Z',
    endsAt: '2026-10-26T01:30:00Z',
    allDay: false,
    location: 'Main Campus',
    url: 'https://crosswaysa.churchcenter.com/calendar/event/1001',
  },
  {
    id: '1003',
    name: 'Student Ministry-Christmas Party',
    startsAt: '2026-12-13T23:00:00Z',
    allDay: false,
    imageUrl: '/dev/poster.svg',
    url: 'https://crosswaysa.churchcenter.com/calendar/event/1003',
  },
  {
    id: '1005',
    name: 'Fall Church Work Day',
    startsAt: '2026-11-14T06:00:00Z',
    endsAt: '2026-11-15T06:00:00Z',
    allDay: true,
    url: 'https://crosswaysa.churchcenter.com/calendar/event/1005',
  },
];

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = (props: Record<string, unknown>) =>
  container.renderToString(EventList, { props });

describe('EventList', () => {
  it('renders a full list row per event with time elements and external links', async () => {
    const html = await render({ events, variant: 'full' });
    expect(html.match(/<li\b/g)).toHaveLength(3);
    expect(html).toContain('datetime="2026-10-26T00:00:00Z"');
    expect(html).toContain('datetime="2026-11-14"');
    expect(html).toContain('Sun, Oct 25');
    expect(html).toContain('7:00 – 8:30 PM');
    expect(html).toContain('Main Campus');
    expect(html).toContain(
      'href="https://crosswaysa.churchcenter.com/calendar/event/1001"',
    );
    expect(html).toMatch(/target="_blank"/);
    expect(html).toMatch(/rel="noopener noreferrer"/);
    expect(html).toContain('(opens in a new tab)');
  });

  it('renders the image lazily with explicit dimensions only when there is one', async () => {
    const html = await render({ events, variant: 'full' });
    const imgs = html.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toContain('src="/dev/poster.svg"');
    expect(imgs[0]).toContain('loading="lazy"');
    expect(imgs[0]).toMatch(/width="\d+"/);
    expect(imgs[0]).toMatch(/height="\d+"/);
    expect(imgs[0]).toContain('alt=""');
  });

  it('shows no time for all-day events', async () => {
    const html = await render({ events: [events[2]], variant: 'full' });
    expect(html).toContain('Sat, Nov 14');
    expect(html).not.toMatch(/\d:\d\d/);
  });

  it('respects the limit', async () => {
    const html = await render({ events, variant: 'home', limit: 2 });
    expect(html.match(/<li\b/g)).toHaveLength(2);
    expect(html).not.toContain('Fall Church Work Day');
  });

  it('renders compact rows without images or locations in the home variant', async () => {
    const html = await render({ events, variant: 'home' });
    expect(html.match(/<li\b/g)).toHaveLength(3);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('Main Campus');
    expect(html).toContain('Advanced Commitment Night');
    expect(html).toContain('7:00 – 8:30 PM');
  });

  it('escapes event names', async () => {
    const html = await render({
      events: [{ ...events[0], name: '<script>alert(1)</script>' }],
      variant: 'full',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  for (const [label, value] of [
    ['null', null],
    ['an empty list', []],
  ] as const) {
    for (const variant of ['full', 'home'] as const) {
      it(`shows the Church Center link for ${label} (${variant})`, async () => {
        const html = await render({ events: value, variant });
        expect(html).toContain('See all upcoming events on Church Center');
        expect(html).toContain(`href="${CALENDAR}"`);
        expect(html).not.toMatch(/<li\b/);
      });
    }
  }

  it('fades rows after the first three by default and not when reveal is off', async () => {
    const many = [...events, ...events].map((event, index) => ({
      ...event,
      id: `${event.id}-${index}`,
    }));
    const on = await render({ events: many, variant: 'home' });
    expect(on.match(/data-reveal="fade"/g)).toHaveLength(3);
    const off = await render({ events: many, variant: 'home', reveal: false });
    expect(off).not.toContain('data-reveal');
  });
});
