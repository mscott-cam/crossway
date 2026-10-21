import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { ageGroups } from '../../src/lib/kids';
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
      anything: ['a'],
    });
    expect(parsed).toMatchObject({ eyebrow: 'z', anything: ['a'] });
  });

  it('validates the visit page frontmatter and keeps its page-specific lede', () => {
    const raw = readFileSync('src/content/pages/visit.md', 'utf8');
    const block = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const data = pagesSchema.parse(parse(block));
    expect(data.title).toBe('Plan your visit');
    expect(data.description.length).toBeGreaterThan(40);
    expect(data.lede).toBeTruthy();
    expect(data.ageGroups).toBeUndefined();
  });

  it('keeps the visit prose to the owner’s description', () => {
    const raw = readFileSync('src/content/pages/visit.md', 'utf8');
    expect(raw).not.toMatch(/why we gather/i);
    expect(raw).not.toMatch(/come as you are/i);
  });
});

describe('kids age groups', () => {
  it('lists the six groups from PRODUCT.md in order', () => {
    expect(ageGroups).toEqual([
      'Infants',
      'Walkers',
      '2’s–3’s',
      'Pre-K/Kinder',
      '1st–2nd Grade',
      '3rd–5th Grade',
    ]);
  });
});
