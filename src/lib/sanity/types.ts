export type SanityImage = {
  url: string;
  width: number;
  height: number;
  alt?: string;
};

export type Speaker = {
  _id: string;
  name: string;
  slug: string;
  role?: string;
};

export type Series = {
  _id: string;
  title: string;
  slug: string;
  artwork?: SanityImage;
  description?: string;
  isStandalone: boolean;
};

export type SermonAudio = {
  url: string;
  source: 'override' | 'spreaker-id' | 'date-match';
};

export type Sermon = {
  _id: string;
  title: string;
  date: string;
  speaker?: Speaker;
  series: Series;
  book?: string;
  passage?: string;
  vimeoUrl?: string;
  slug: string;
  description?: string;
  audioOverrideUrl?: string;
  spreakerEpisodeId?: string;
  webflowPath?: string;
  audio?: SermonAudio;
};

export type LeaderGroup = 'Staff' | 'Elders' | 'Deacons' | 'Ministry Leaders';

export type Leader = {
  _id: string;
  name: string;
  role?: string;
  group: LeaderGroup;
  order: number;
  photo?: SanityImage;
};

export type SundayCardRow = {
  label: string;
  value: string;
  href?: string;
};

export type Announcement = {
  enabled: boolean;
  text?: string;
  href?: string;
};

export type SiteSettings = {
  serviceTimes: string[];
  sundayCardRows: SundayCardRow[];
  announcement: Announcement;
  showEntrustedOnHome: boolean;
};
