import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { pagesSchema } from '../../src/lib/pages-schema';
import { entrustedExtrasSchema } from '../../src/lib/entrusted-schema';
import { renderInlineMarkdown } from '../../src/lib/inline-markdown';

const LIVE_FAQ_COUNT = 13;

function load(slug: string) {
  const raw = readFileSync(`src/content/pages/${slug}.md`, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${slug}: missing frontmatter`);
  return { data: parse(match[1]!), body: match[2]! };
}

const { data, body } = load('entrusted');
const extras = entrustedExtrasSchema.parse(data);
const everything = JSON.stringify(data) + body;

describe('entrusted page content', () => {
  it('parses with the shared pages schema', () => {
    expect(pagesSchema.safeParse(data).success).toBe(true);
    expect(data.title).toBe('Entrusted');
  });

  it('has a title and description unique across the pages collection', () => {
    const others = [
      'culture',
      'who-we-are',
      'what-we-believe',
      'child-safety',
      'networks',
      'small-groups',
      'students',
      'crossway-kids',
      'biblical-counseling',
      'christian-stewardship',
      'visit',
    ].map((slug) => load(slug).data);
    for (const other of others) {
      expect(other.title).not.toBe(data.title);
      expect(other.description).not.toBe(data.description);
    }
    expect(data.description.length).toBeGreaterThan(40);
    expect(data.description.length).toBeLessThanOrEqual(200);
  });

  it('carries every FAQ question and answer the live page has', () => {
    expect(extras.faq).toHaveLength(LIVE_FAQ_COUNT);
    const ids = extras.faq.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(extras.faq[0]!.question).toBe(
      'In brief, what exactly is it that we’re doing?',
    );
    expect(extras.faq.at(-1)!.question).toBe('How long is my commitment?');
  });

  it('keeps the key facts exactly', () => {
    expect(everything).toContain('$6,500,000');
    expect(everything).toContain('December 13, 2026');
    expect(everything).toContain('from December 2026 to December 2028');
    expect(everything).toContain('One Fund. Two Years. Three Aims.');
    expect(everything).toContain('$1.7 million');
    expect(everything).toContain('$3.4 million');
    expect(everything).toContain('$3.1 million');
    expect(everything).toContain('Scott Barns');
    expect(everything).toContain('Scott@CrosswaySA.org');
  });

  it('keeps the Existing, Expanding and Extending aims and both commitment tools', () => {
    for (const word of ['Existing', 'Expanding', 'Extending']) {
      expect(body).toContain(word);
    }
    expect(body).toContain('The Gift Chart');
    expect(body).toContain('The Worksheet');
  });

  it('has no leftover Webflow, script or placeholder-copy junk', () => {
    expect(everything).not.toMatch(/<script/i);
    expect(everything).not.toMatch(/lorem/i);
    expect(everything).not.toMatch(/w-embed|w-richtext|w-inline-block/);
    expect(everything).not.toMatch(/website-files\.com|webflow\.io/i);
    expect(everything).not.toMatch(/[\u200b-\u200d\u00a0\ufb00-\ufb06]/);
  });

  it('starts the body at h2 and never skips a heading level', () => {
    expect(body.trim()).not.toMatch(/^#\s/);
    expect(body).not.toMatch(/^# /m);
    let previous = 1;
    for (const match of body.matchAll(/^(#{2,6}) /gm)) {
      expect(match[1]!.length).toBeLessThanOrEqual(previous + 1);
      previous = match[1]!.length;
    }
  });

  it('bundles the commitment images byte-for-byte locally and references them', () => {
    for (const file of [
      'entrusted-gift-chart.svg',
      'entrusted-giving-split.svg',
      'entrusted-worksheet.svg',
    ]) {
      expect(existsSync(`public/documents/${file}`)).toBe(true);
      expect(body).toContain(`/documents/${file}`);
    }
  });

  it('renders every FAQ answer safely, with the one mailto link intact', () => {
    const rendered = extras.faq.map((item) =>
      renderInlineMarkdown(item.answer),
    );
    for (const html of rendered) {
      expect(html).not.toMatch(/<script|javascript:/i);
    }
    const links = rendered.join('').match(/href="[^"]*"/g);
    expect(links).toEqual([
      'href="mailto:Scott@CrosswaySA.org?subject=Questions%20about%20ENTRUSTED"',
    ]);
  });
});
