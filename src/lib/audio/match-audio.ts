import { toChicagoDate } from '../dates';
import type { Sermon } from '../sanity/types';
import type { Episode } from './spreaker';

export type AudioMatch = {
  sermons: Sermon[];
  unmatchedSermons: Sermon[];
  unmatchedEpisodes: Episode[];
};

const WINDOW_DAYS = 2;
const DAY_MS = 86_400_000;

function tokens(title: string): Set<string> {
  const words = title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’‘`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function matchAudio(sermons: Sermon[], episodes: Episode[]): AudioMatch {
  const results: Sermon[] = sermons.map((sermon) => {
    const { audio: _previous, ...fresh } = sermon;
    return fresh;
  });
  const byId = new Map<string, Episode>();
  for (const episode of episodes) {
    if (!byId.has(episode.id)) byId.set(episode.id, episode);
  }
  const claimed = new Set<string>();
  const inDateOrder = results
    .map((sermon, index) => ({ sermon, index }))
    .sort(
      (a, b) =>
        a.sermon.date.localeCompare(b.sermon.date) ||
        a.sermon.title.localeCompare(b.sermon.title) ||
        a.index - b.index,
    )
    .map(({ sermon }) => sermon);

  for (const sermon of inDateOrder) {
    const episode = sermon.spreakerEpisodeId
      ? byId.get(sermon.spreakerEpisodeId)
      : undefined;
    const available = episode !== undefined && !claimed.has(episode.id);
    if (available) claimed.add(episode.id);
    if (sermon.audioOverrideUrl) {
      sermon.audio = { url: sermon.audioOverrideUrl, source: 'override' };
    } else if (available) {
      sermon.audio = { url: episode.mp3Url, source: 'spreaker-id' };
    }
  }

  const dated = episodes.map((episode) => ({
    episode,
    day: toChicagoDate(episode.pubDate),
    time: Date.parse(episode.pubDate),
    words: tokens(episode.title),
  }));
  const pairs: {
    sermon: Sermon;
    episode: Episode;
    similarity: number;
    time: number;
  }[] = [];
  for (const sermon of inDateOrder) {
    if (sermon.audio) continue;
    const last = addDays(sermon.date, WINDOW_DAYS);
    const words = tokens(sermon.title);
    for (const candidate of dated) {
      if (claimed.has(candidate.episode.id)) continue;
      if (candidate.day < sermon.date || candidate.day > last) continue;
      pairs.push({
        sermon,
        episode: candidate.episode,
        similarity: jaccard(words, candidate.words),
        time: candidate.time,
      });
    }
  }
  pairs.sort((a, b) => b.similarity - a.similarity || a.time - b.time);
  for (const { sermon, episode } of pairs) {
    if (sermon.audio || claimed.has(episode.id)) continue;
    claimed.add(episode.id);
    sermon.audio = { url: episode.mp3Url, source: 'date-match' };
  }

  return {
    sermons: results,
    unmatchedSermons: results.filter((sermon) => !sermon.audio),
    unmatchedEpisodes: episodes.filter((episode) => !claimed.has(episode.id)),
  };
}
