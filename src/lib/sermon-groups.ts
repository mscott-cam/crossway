import { BOOKS, type Book } from './books';
import { formatSermonDate } from './dates';
import type { Series, Sermon, Speaker } from './sanity/types';

export type SeriesGroup = { series: Series; count: number; latest: string };
export type BookGroup = { book: Book; sermons: Sermon[] };
export type SpeakerGroup = { speaker: Speaker; sermons: Sermon[] };

export function groupSeries(sermons: Sermon[]): SeriesGroup[] {
  const groups = new Map<string, SeriesGroup>();
  for (const sermon of sermons) {
    const group = groups.get(sermon.series.slug);
    if (!group) {
      groups.set(sermon.series.slug, {
        series: sermon.series,
        count: 1,
        latest: sermon.date,
      });
    } else {
      group.count += 1;
      if (sermon.date > group.latest) group.latest = sermon.date;
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.latest.localeCompare(a.latest) ||
      a.series.title.localeCompare(b.series.title),
  );
}

export function groupBooks(sermons: Sermon[]): BookGroup[] {
  return BOOKS.flatMap((book) => {
    const matching = sermons.filter((sermon) => sermon.book === book.name);
    return matching.length > 0 ? [{ book, sermons: matching }] : [];
  });
}

export function groupSpeakers(sermons: Sermon[]): SpeakerGroup[] {
  const groups = new Map<string, SpeakerGroup>();
  for (const sermon of sermons) {
    if (!sermon.speaker) continue;
    const group = groups.get(sermon.speaker.slug);
    if (group) group.sermons.push(sermon);
    else
      groups.set(sermon.speaker.slug, {
        speaker: sermon.speaker,
        sermons: [sermon],
      });
  }
  return [...groups.values()].sort((a, b) =>
    a.speaker.name.localeCompare(b.speaker.name),
  );
}

export type MetaField = 'speaker' | 'passage' | 'series' | 'date';

export function sermonMeta(sermon: Sermon, fields: MetaField[]): string[] {
  const values: Record<MetaField, string | undefined> = {
    speaker: sermon.speaker?.name,
    passage: sermon.passage,
    series: sermon.series.title,
    date: formatSermonDate(sermon.date),
  };
  return fields.flatMap((field) => values[field] ?? []);
}

export function sermonPageTitle(sermon: Sermon): string {
  const who = [sermon.speaker?.name, formatSermonDate(sermon.date)]
    .filter(Boolean)
    .join(', ');
  return `${sermon.title} – ${who}`;
}

const DESCRIPTION_LIMIT = 160;

export function sermonDescription(sermon: Sermon): string {
  const text = sermon.description?.replace(/\s+/g, ' ').trim();
  if (!text) {
    return `${sermon.series.title} · ${formatSermonDate(sermon.date)}`;
  }
  if (text.length <= DESCRIPTION_LIMIT) return text;
  const cut = text.slice(0, DESCRIPTION_LIMIT - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(' '));
  return `${atWord || cut}…`;
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}
