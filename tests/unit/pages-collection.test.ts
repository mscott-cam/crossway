import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { pagesSchema } from '../../src/lib/pages-schema';

describe('pages collection schema', () => {
  it('requires a title and description', () => {
    expect(pagesSchema.safeParse({ title: 'x' }).success).toBe(false);
    expect(pagesSchema.safeParse({ description: 'x' }).success).toBe(false);
    expect(
      pagesSchema.safeParse({ title: 'x', description: 'y' }).success,
    ).toBe(true);
  });

  it('keeps unknown frontmatter fields for page-specific data', () => {
    const parsed = pagesSchema.parse({
      title: 'x',
      description: 'y',
      eyebrow: 'z',
      ageGroups: ['a'],
    });
    expect(parsed).toMatchObject({ eyebrow: 'z', ageGroups: ['a'] });
  });

  it('validates the visit page frontmatter', () => {
    const raw = readFileSync('src/content/pages/visit.md', 'utf8');
    const block = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const data = pagesSchema.parse(parse(block));
    expect(data.title).toBe('Plan your visit');
    expect(data.description.length).toBeGreaterThan(40);
    expect(data.ageGroups).toHaveLength(6);
  });
});
