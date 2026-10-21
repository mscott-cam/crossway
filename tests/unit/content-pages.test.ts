import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ageGroups } from '../../src/lib/kids';
import { culture } from '../../src/lib/culture';
import { pagesSchema } from '../../src/lib/pages-schema';

const SLUGS = [
  'who-we-are',
  'what-we-believe',
  'child-safety',
  'networks',
  'small-groups',
  'students',
  'crossway-kids',
  'biblical-counseling',
  'christian-stewardship',
];

function load(slug: string) {
  const raw = readFileSync(`src/content/pages/${slug}.md`, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${slug}: missing frontmatter`);
  return { data: parse(match[1]!), body: match[2]! };
}

const pages = SLUGS.map((slug) => ({ slug, ...load(slug) }));

describe('content pages carried over from the live site', () => {
  it('has an entry for each of the nine pages', () => {
    for (const slug of SLUGS) {
      expect(existsSync(`src/content/pages/${slug}.md`)).toBe(true);
    }
  });

  it('parses every entry with the shared pages schema', () => {
    for (const { slug, data } of pages) {
      const result = pagesSchema.safeParse(data);
      expect(result.success, slug).toBe(true);
    }
  });

  it('gives each page a unique non-empty title and description', () => {
    const titles = pages.map((p) => p.data.title as string);
    const descriptions = pages.map((p) => p.data.description as string);
    for (const value of [...titles, ...descriptions]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const description of descriptions) {
      expect(description.length).toBeGreaterThan(40);
      expect(description.length).toBeLessThanOrEqual(200);
    }
  });

  it('has no leftover Webflow, script or placeholder-copy junk in any body', () => {
    for (const { slug, body } of pages) {
      expect(body, slug).not.toMatch(/<script/i);
      expect(body, slug).not.toMatch(/lorem/i);
      expect(body, slug).not.toMatch(/w-embed|w-richtext|w-inline-block/);
      expect(body, slug).not.toMatch(/website-files\.com|webflow\.io/i);
      expect(body, slug).not.toMatch(/‍| /);
    }
  });

  it('starts every body at h2 or a paragraph and never uses an h1', () => {
    for (const { slug, body } of pages) {
      const trimmed = body.trim();
      if (trimmed) expect(trimmed, slug).not.toMatch(/^#\s/);
      expect(body, slug).not.toMatch(/^# /m);
      expect(body, slug).not.toMatch(/<h1/i);
      const levels = [...body.matchAll(/^(#{2,6}) /gm)].map(
        (m) => m[1]!.length,
      );
      let previous = 1;
      for (const level of levels) {
        expect(level, `${slug}: heading skips a level`).toBeLessThanOrEqual(
          previous + 1,
        );
        previous = level;
      }
    }
  });

  it('keeps internal links relative and external links absolute', () => {
    for (const { slug, body } of pages) {
      for (const [, href] of body.matchAll(/\]\(([^)\s]+)/g)) {
        expect(href, slug).not.toMatch(/^https?:\/\/(www\.)?crosswaysa\.org/i);
        expect(href, slug).toMatch(/^(\/|https:\/\/|mailto:|tel:)/);
      }
    }
  });

  it('uses typographic apostrophes in prose', () => {
    for (const { slug, body } of pages) {
      const prose = body.replace(/\]\([^)]*\)/g, ']').replace(/<[^>]+>/g, '');
      expect(prose, slug).not.toMatch(/\w'\w/);
    }
  });
});

describe('culture', () => {
  it('lists the six commitments as on the live page, each with a verse reference', () => {
    expect(culture.values.map((v: { title: string }) => v.title)).toEqual([
      'Bold Preaching',
      'Passionate Worship',
      'Purposeful Discipleship',
      'Fervent Prayer',
      'Courageous Evangelism',
      'Church Planting',
    ]);
    expect(culture.values).toHaveLength(6);
    for (const value of culture.values) {
      expect(value.verse).toMatch(/\d+:\d+/);
    }
  });

  it('carries the mission and vision from the live page', () => {
    expect(culture.mission).toBe(
      'We exist to glorify God through the fulfillment of the Great Commission.',
    );
    expect(culture.vision).toEqual([
      'Lost people saved,',
      'Saved people matured,',
      'Matured people multiplied,',
      'All to the glory of God.',
    ]);
  });
});

describe('crossway kids', () => {
  it('matches the age groups the live page lists', () => {
    const { body } = pages.find((p) => p.slug === 'crossway-kids')!;
    expect(body).toContain('Same Mission');
    expect(ageGroups).toHaveLength(6);
  });
});

describe('what we believe', () => {
  const { body } = pages.find((p) => p.slug === 'what-we-believe')!;

  it('keeps the two statements and every belief with its references', () => {
    expect(body).toMatch(/^## Statement of Faith$/m);
    expect(body).toMatch(/^## Teaching Statement$/m);
    expect((body.match(/^### /gm) ?? []).length).toBe(35);
    expect((body.match(/<p class="verse-refs">/g) ?? []).length).toBe(31);
  });

  it('links to the position papers that ship in public/documents', () => {
    for (const [, href] of body.matchAll(/\]\((\/documents\/[^)]+)\)/g)) {
      expect(existsSync(`public${href}`), href).toBe(true);
    }
  });
});
