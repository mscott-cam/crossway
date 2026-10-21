import { z } from 'astro/zod';
import type { Leader, LeaderGroup } from './sanity/types';

export const leaderGroups: readonly LeaderGroup[] = [
  'Elders',
  'Staff',
  'Deacons',
  'Ministry Leaders',
];

export const leaderGroupHeadings: Record<LeaderGroup, string> = {
  Elders: 'Pastor | Elders',
  Staff: 'Staff',
  Deacons: 'Deacons',
  'Ministry Leaders': 'Ministry Leaders',
};

export const rosterSchema = z.array(
  z.object({
    group: z.enum(['Elders', 'Staff', 'Deacons', 'Ministry Leaders']),
    name: z.string().min(1),
    role: z.string().min(1).optional(),
  }),
);

export type RosterEntry = z.infer<typeof rosterSchema>[number];

export type LeaderSection = {
  group: LeaderGroup;
  heading: string;
  leaders: Leader[];
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function rosterToLeaders(roster: readonly RosterEntry[]): Leader[] {
  const taken = new Set<string>();
  const counts = new Map<LeaderGroup, number>();
  return roster.map((entry) => {
    const order = (counts.get(entry.group) ?? 0) + 1;
    counts.set(entry.group, order);
    const base = `leader-${slugify(entry.name)}`;
    const _id = taken.has(base) ? `${base}-${slugify(entry.group)}` : base;
    taken.add(_id);
    return {
      _id,
      name: entry.name,
      group: entry.group,
      order,
      ...(entry.role ? { role: entry.role } : {}),
    };
  });
}

export function resolveLeaders(
  live: readonly Leader[],
  roster: readonly RosterEntry[],
): Leader[] {
  return live.length > 0 ? [...live] : rosterToLeaders(roster);
}

export function groupLeaders(leaders: readonly Leader[]): LeaderSection[] {
  return leaderGroups.flatMap((group) => {
    const members = leaders
      .filter((leader) => leader.group === group)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return members.length > 0
      ? [{ group, heading: leaderGroupHeadings[group], leaders: members }]
      : [];
  });
}
