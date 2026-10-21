import { eventSpan, toChicagoIso } from '../dates';
import type { ChurchEvent } from '../events/pco';
import { site } from '../site';

export function eventJsonLd(event: ChurchEvent, origin: string): object {
  const base = `${origin.replace(/\/$/, '')}/`;
  const start = new Date(event.startsAt);
  const parsedEnd = event.endsAt ? new Date(event.endsAt) : undefined;
  const end =
    parsedEnd && parsedEnd.getTime() > start.getTime() ? parsedEnd : undefined;

  let startDate: string;
  let endDate: string | undefined;
  if (event.allDay) {
    const { first, last } = eventSpan(event);
    startDate = first;
    endDate = last > first ? last : undefined;
  } else {
    startDate = toChicagoIso(start);
    endDate = end ? toChicagoIso(end) : undefined;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate,
    ...(endDate ? { endDate } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    ...(event.location
      ? { location: { '@type': 'Place', name: event.location } }
      : {}),
    url: event.url,
    ...(event.imageUrl ? { image: new URL(event.imageUrl, base).href } : {}),
    organizer: { '@type': 'Church', name: site.name, url: base },
  };
}

export function eventsJsonLd(
  events: ChurchEvent[] | null,
  origin: string,
): object[] | undefined {
  if (!events || events.length === 0) return undefined;
  return events.map((event) => eventJsonLd(event, origin));
}
