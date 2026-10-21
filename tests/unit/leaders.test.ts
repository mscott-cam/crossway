import { readFileSync } from 'node:fs';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { parse } from 'yaml';
import { beforeAll, describe, expect, it } from 'vitest';
import LeaderGrid from '../../src/components/leader-grid.astro';
import {
  groupLeaders,
  resolveLeaders,
  rosterSchema,
  rosterToLeaders,
} from '../../src/lib/leaders';
import type { Leader } from '../../src/lib/sanity/types';

const raw = readFileSync('src/content/pages/who-we-are.md', 'utf8');
const front = parse(raw.match(/^---\n([\s\S]*?)\n---/)![1]!);
const roster = rosterSchema.parse(front.roster);

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const live: Leader[] = [
  { _id: 'a', name: 'Zed Live', role: 'Elder', group: 'Elders', order: 2 },
  { _id: 'b', name: 'Amy Live', role: 'Elder', group: 'Elders', order: 1 },
  { _id: 'c', name: 'Cal Live', group: 'Deacons', order: 1 },
];

describe('the who-we-are fallback roster', () => {
  it('has names and roles only, in the live page’s three groups', () => {
    expect(roster).toHaveLength(19);
    expect(new Set(roster.map((r) => r.group))).toEqual(
      new Set(['Elders', 'Staff', 'Deacons']),
    );
    for (const entry of roster) {
      expect(Object.keys(entry).sort()).toEqual(['group', 'name', 'role']);
    }
    expect(roster).toContainEqual({
      group: 'Staff',
      name: 'Scott Graham',
      role: 'Student Minister',
    });
    expect(roster).toContainEqual({
      group: 'Deacons',
      name: 'Dave & Ashley Pflug',
      role: 'Benevolence',
    });
  });

  it('is used when the Sanity read layer returns nothing, and only then', () => {
    expect(resolveLeaders([], roster)).toEqual(rosterToLeaders(roster));
    expect(resolveLeaders(live, roster).map((l) => l._id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('gives unique ids even when a person appears in two groups', () => {
    const ids = rosterToLeaders(roster).map((l) => l._id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('leader-richard-cobb');
    expect(ids).toContain('leader-richard-cobb-deacons');
  });

  it('matches the seed file the owner imports into Sanity', () => {
    const seed = JSON.parse(readFileSync('scripts/leaders-seed.json', 'utf8'));
    const expected = rosterToLeaders(roster).map(
      ({ _id, name, role, group, order }) => ({
        _id,
        _type: 'leader',
        name,
        role,
        group,
        order,
      }),
    );
    expect(seed).toEqual(expected);
  });
});

describe('groupLeaders', () => {
  it('orders groups Elders, Staff, Deacons, Ministry Leaders and sorts within a group', () => {
    const sections = groupLeaders([
      ...live,
      { _id: 'd', name: 'Dee', group: 'Ministry Leaders', order: 1 },
      { _id: 'e', name: 'Eve', group: 'Staff', order: 1 },
    ]);
    expect(sections.map((s) => s.group)).toEqual([
      'Elders',
      'Staff',
      'Deacons',
      'Ministry Leaders',
    ]);
    expect(sections[0]!.leaders.map((l) => l.name)).toEqual([
      'Amy Live',
      'Zed Live',
    ]);
    expect(sections[0]!.heading).toBe('Pastor | Elders');
  });

  it('skips empty groups', () => {
    expect(groupLeaders([live[2]!]).map((s) => s.group)).toEqual(['Deacons']);
  });
});

describe('LeaderGrid', () => {
  it('renders the frontmatter roster when the live list is empty', async () => {
    const html = await container.renderToString(LeaderGrid, {
      props: { leaders: resolveLeaders([], roster) },
    });
    expect(html.match(/data-leader(?=[\s>])/g)).toHaveLength(19);
    expect(html).toContain('Josh de Koning');
    expect(html).toContain('Senior Pastor | Elder');
    expect(html).toContain('Zack &amp; Kristen Clark');
    expect(html).toMatch(/Pastor \| Elders/);
    expect(html).not.toMatch(/undefined|null|<img/);
  });

  it('renders nothing for an empty list', async () => {
    const html = await container.renderToString(LeaderGrid, {
      props: { leaders: [] },
    });
    expect(html).not.toContain('data-leader');
  });
});
