import { describe, expect, it } from 'vitest';
import { matchAudio } from '../../src/lib/audio/match-audio';
import type { Episode } from '../../src/lib/audio/spreaker';
import type { Sermon } from '../../src/lib/sanity/types';

const series = {
  _id: 'se1',
  title: 'Entrusted',
  slug: 'entrusted',
  isStandalone: false,
};

const sermon = (title: string, date: string, extra: Partial<Sermon> = {}) =>
  ({
    _id: `sermon-${title}-${date}`,
    title,
    date,
    series,
    slug: `${title}-${date}`,
    ...extra,
  }) as Sermon;

const episode = (
  id: string,
  title: string,
  pubDate: string,
  extra: Partial<Episode> = {},
): Episode => ({
  id,
  title,
  pubDate: new Date(pubDate).toISOString(),
  mp3Url: `https://dts.podtrac.com/redirect.mp3/api.spreaker.com/download/episode/${id}/sermon_audio.mp3`,
  ...extra,
});

const mp3 = (id: string) =>
  `https://dts.podtrac.com/redirect.mp3/api.spreaker.com/download/episode/${id}/sermon_audio.mp3`;

describe('matchAudio by date', () => {
  it('matches a sermon to the episode published on its Sunday', () => {
    const result = matchAudio(
      [sermon('Entrusted With Resources', '2026-10-18')],
      [
        episode(
          '75851174',
          'Entrusted With Resources',
          'Sun, 18 Oct 2026 22:13:15 +0000',
        ),
      ],
    );
    expect(result.sermons[0].audio).toEqual({
      url: mp3('75851174'),
      source: 'date-match',
    });
    expect(result.unmatchedSermons).toEqual([]);
    expect(result.unmatchedEpisodes).toEqual([]);
  });

  it('matches an episode published up to two days after the sermon date', () => {
    const s = sermon('Title', '2026-10-18');
    const monday = matchAudio(
      [s],
      [episode('1', 'Title', 'Mon, 19 Oct 2026 18:00:00 +0000')],
    );
    expect(monday.sermons[0].audio?.url).toBe(mp3('1'));
    const tuesday = matchAudio(
      [s],
      [episode('1', 'Title', 'Tue, 20 Oct 2026 18:00:00 +0000')],
    );
    expect(tuesday.sermons[0].audio?.url).toBe(mp3('1'));
    const wednesday = matchAudio(
      [s],
      [episode('1', 'Title', 'Wed, 21 Oct 2026 18:00:00 +0000')],
    );
    expect(wednesday.sermons[0].audio).toBeUndefined();
  });

  it('does not match an episode published before the sermon date', () => {
    const result = matchAudio(
      [sermon('Title', '2026-10-18')],
      [episode('1', 'Title', 'Sat, 17 Oct 2026 18:00:00 +0000')],
    );
    expect(result.sermons[0].audio).toBeUndefined();
    expect(result.unmatchedSermons).toHaveLength(1);
    expect(result.unmatchedEpisodes).toHaveLength(1);
  });

  it('uses Chicago time: Monday 03:30 UTC is still Sunday evening', () => {
    const result = matchAudio(
      [sermon('Title', '2026-10-18')],
      [episode('7', 'Title', 'Mon, 19 Oct 2026 03:30:00 +0000')],
    );
    expect(result.sermons[0].audio?.url).toBe(mp3('7'));
  });

  it('uses Chicago time: an episode just after midnight UTC on Sunday belongs to Saturday', () => {
    const result = matchAudio(
      [sermon('Title', '2026-10-18')],
      [episode('7', 'Title', 'Sun, 18 Oct 2026 03:30:00 +0000')],
    );
    expect(result.sermons[0].audio).toBeUndefined();
  });

  it('still matches a lone same-day episode whose title is unrelated', () => {
    const result = matchAudio(
      [sermon('Doers of the Word', '2026-08-30')],
      [episode('9', 'Promises to Trust', 'Sun, 30 Aug 2026 22:21:32 +0000')],
    );
    expect(result.sermons[0].audio?.source).toBe('date-match');
  });

  it('prefers the most similar title among several candidates', () => {
    const result = matchAudio(
      [sermon('Faith That Works', '2026-08-16')],
      [
        episode('1', 'Something Else', 'Sun, 16 Aug 2026 20:00:00 +0000'),
        episode('2', 'Faith that Works!', 'Sun, 16 Aug 2026 22:00:00 +0000'),
      ],
    );
    expect(result.sermons[0].audio?.url).toBe(mp3('2'));
    expect(result.unmatchedEpisodes.map((e) => e.id)).toEqual(['1']);
  });

  it('breaks similarity ties by the earliest pubDate', () => {
    const result = matchAudio(
      [sermon('Unrelated', '2026-08-16')],
      [
        episode('late', 'Alpha', 'Sun, 16 Aug 2026 22:00:00 +0000'),
        episode('early', 'Beta', 'Sun, 16 Aug 2026 20:00:00 +0000'),
      ],
    );
    expect(result.sermons[0].audio?.url).toBe(mp3('early'));
  });

  it('ignores case, punctuation and curly apostrophes in titles', () => {
    const result = matchAudio(
      [sermon('Faith That Doesn’t Unravel', '2026-09-06')],
      [
        episode('1', 'Other Message', 'Sun, 06 Sep 2026 20:00:00 +0000'),
        episode(
          '2',
          "FAITH THAT DOESN'T UNRAVEL",
          'Sun, 06 Sep 2026 22:00:00 +0000',
        ),
      ],
    );
    expect(result.sermons[0].audio?.url).toBe(mp3('2'));
  });
});

describe('matchAudio with two sermons on one Sunday', () => {
  const episodes = [
    episode('1', 'Gospel Repair', 'Sun, 31 May 2026 20:49:23 +0000'),
    episode('2', 'In the Beginning', 'Sun, 31 May 2026 22:30:00 +0000'),
  ];

  it('separates them by title similarity', () => {
    const result = matchAudio(
      [
        sermon('Gospel Repair', '2026-05-31'),
        sermon('In the Beginning', '2026-05-31'),
      ],
      episodes,
    );
    expect(result.sermons.map((s) => s.audio?.url)).toEqual([
      mp3('1'),
      mp3('2'),
    ]);
  });

  it('separates them regardless of input order', () => {
    const result = matchAudio(
      [
        sermon('In the Beginning', '2026-05-31'),
        sermon('Gospel Repair', '2026-05-31'),
      ],
      [...episodes].reverse(),
    );
    expect(result.sermons.map((s) => s.audio?.url)).toEqual([
      mp3('2'),
      mp3('1'),
    ]);
  });

  it('does not let a weak early preference steal a stronger match', () => {
    const result = matchAudio(
      [
        sermon('Walk by Faith', '2026-05-31'),
        sermon('Walk by Faith Not by Sight', '2026-05-31'),
      ],
      [
        episode(
          'a',
          'Walk by Faith Not by Sight',
          'Sun, 31 May 2026 20:00:00 +0000',
        ),
        episode('b', 'Walk Today', 'Sun, 31 May 2026 22:00:00 +0000'),
      ],
    );
    expect(result.sermons.map((s) => s.audio?.url)).toEqual([
      mp3('b'),
      mp3('a'),
    ]);
  });

  it('attaches each episode to at most one sermon', () => {
    const result = matchAudio(
      [
        sermon('Gospel Repair', '2026-05-31'),
        sermon('Gospel Repair', '2026-05-31'),
      ],
      [episode('1', 'Gospel Repair', 'Sun, 31 May 2026 20:49:23 +0000')],
    );
    expect(result.sermons.filter((s) => s.audio)).toHaveLength(1);
    expect(result.unmatchedSermons).toHaveLength(1);
    expect(result.unmatchedEpisodes).toEqual([]);
  });
});

describe('matchAudio by id and override', () => {
  it('matches by spreakerEpisodeId regardless of date', () => {
    const result = matchAudio(
      [sermon('Old', '2015-03-29', { spreakerEpisodeId: '13864183' })],
      [episode('13864183', 'Whatever', 'Mon, 30 Mar 2015 03:33:00 +0000')],
    );
    expect(result.sermons[0].audio).toEqual({
      url: mp3('13864183'),
      source: 'spreaker-id',
    });
  });

  it('matches an id even when the episode is far from the sermon date', () => {
    const result = matchAudio(
      [sermon('Moved', '2026-05-31', { spreakerEpisodeId: '5' })],
      [episode('5', 'Moved', 'Sun, 01 Feb 2026 20:00:00 +0000')],
    );
    expect(result.sermons[0].audio?.source).toBe('spreaker-id');
  });

  it('falls back to the date when the id matches no episode', () => {
    const result = matchAudio(
      [sermon('Title', '2026-10-18', { spreakerEpisodeId: 'missing' })],
      [episode('1', 'Title', 'Sun, 18 Oct 2026 22:13:15 +0000')],
    );
    expect(result.sermons[0].audio).toEqual({
      url: mp3('1'),
      source: 'date-match',
    });
  });

  it('lets the override win over an id match', () => {
    const result = matchAudio(
      [
        sermon('Title', '2026-10-18', {
          audioOverrideUrl: 'https://example.org/a.mp3',
          spreakerEpisodeId: '1',
        }),
      ],
      [episode('1', 'Title', 'Sun, 18 Oct 2026 22:13:15 +0000')],
    );
    expect(result.sermons[0].audio).toEqual({
      url: 'https://example.org/a.mp3',
      source: 'override',
    });
  });

  it('lets the override win over a date match', () => {
    const result = matchAudio(
      [
        sermon('Title', '2026-10-18', {
          audioOverrideUrl: 'https://example.org/a.mp3',
        }),
      ],
      [episode('1', 'Title', 'Sun, 18 Oct 2026 22:13:15 +0000')],
    );
    expect(result.sermons[0].audio?.source).toBe('override');
  });

  it('does not let a date match steal an episode claimed by id', () => {
    const result = matchAudio(
      [
        sermon('Earlier', '2026-05-31'),
        sermon('Pinned', '2026-05-31', { spreakerEpisodeId: '1' }),
      ],
      [episode('1', 'Earlier', 'Sun, 31 May 2026 20:49:23 +0000')],
    );
    const byTitle = Object.fromEntries(
      result.sermons.map((s) => [s.title, s.audio]),
    );
    expect(byTitle.Pinned?.source).toBe('spreaker-id');
    expect(byTitle.Earlier).toBeUndefined();
  });

  it('gives a duplicated id to the earlier sermon only', () => {
    const result = matchAudio(
      [
        sermon('Second', '2026-06-07', { spreakerEpisodeId: '1' }),
        sermon('First', '2026-05-31', { spreakerEpisodeId: '1' }),
      ],
      [episode('1', 'First', 'Sun, 31 May 2026 20:49:23 +0000')],
    );
    expect(result.sermons[0].audio).toBeUndefined();
    expect(result.sermons[1].audio?.source).toBe('spreaker-id');
  });

  it('keeps an episode named by an overridden sermon claimed', () => {
    const result = matchAudio(
      [
        sermon('Overridden', '2026-10-18', {
          audioOverrideUrl: 'https://example.org/a.mp3',
          spreakerEpisodeId: '1',
        }),
        sermon('Other', '2026-10-18'),
      ],
      [episode('1', 'Overridden', 'Sun, 18 Oct 2026 22:13:15 +0000')],
    );
    expect(result.sermons[1].audio).toBeUndefined();
    expect(result.unmatchedEpisodes).toEqual([]);
  });
});

describe('matchAudio reporting and purity', () => {
  it('lists episodes with no sermon in unmatchedEpisodes', () => {
    const extra = episode('3', 'Trusting', 'Sun, 04 Oct 2026 22:43:56 +0000');
    const result = matchAudio(
      [sermon('Title', '2026-10-18')],
      [episode('1', 'Title', 'Sun, 18 Oct 2026 22:13:15 +0000'), extra],
    );
    expect(result.unmatchedEpisodes).toEqual([extra]);
  });

  it('lists sermons with no audio in unmatchedSermons', () => {
    const lonely = sermon('Remember the Old Paths', '2019-01-06');
    const result = matchAudio(
      [lonely, sermon('Title', '2026-10-18')],
      [episode('1', 'Title', 'Sun, 18 Oct 2026 22:13:15 +0000')],
    );
    expect(result.unmatchedSermons.map((s) => s.title)).toEqual([
      'Remember the Old Paths',
    ]);
  });

  it('returns sermons in input order as new objects without mutating inputs', () => {
    const inputs = [
      sermon('Older', '2026-10-11'),
      sermon('Newer', '2026-10-18'),
    ];
    const episodes = [
      episode('1', 'Newer', 'Sun, 18 Oct 2026 22:13:15 +0000'),
      episode('2', 'Older', 'Sun, 11 Oct 2026 22:13:15 +0000'),
    ];
    inputs.forEach((s) => Object.freeze(s));
    Object.freeze(inputs);
    Object.freeze(episodes);
    const result = matchAudio(inputs, episodes);
    expect(result.sermons).not.toBe(inputs);
    expect(result.sermons.map((s) => s.title)).toEqual(['Older', 'Newer']);
    result.sermons.forEach((s, i) => {
      expect(s).not.toBe(inputs[i]);
      expect(s.audio).toBeDefined();
    });
    expect(inputs.every((s) => s.audio === undefined)).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(matchAudio([], [])).toEqual({
      sermons: [],
      unmatchedSermons: [],
      unmatchedEpisodes: [],
    });
    const only = matchAudio([sermon('A', '2026-10-18')], []);
    expect(only.sermons[0].audio).toBeUndefined();
    expect(only.unmatchedSermons).toHaveLength(1);
  });

  it('applies overrides even when the feed is empty', () => {
    const result = matchAudio(
      [
        sermon('A', '2026-10-18', {
          audioOverrideUrl: 'https://example.org/a.mp3',
        }),
      ],
      [],
    );
    expect(result.sermons[0].audio?.source).toBe('override');
    expect(result.unmatchedSermons).toEqual([]);
  });
});
