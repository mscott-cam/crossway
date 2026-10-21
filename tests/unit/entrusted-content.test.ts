import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseHtml } from 'node-html-parser';
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

  it('keeps the FAQ text exactly as reviewed against the live page', () => {
    const EXPECTED_FAQ_SHA256 =
      'ee8eec3bc1091cc7acb6751c29bcfb3e5f3b1d795203ca6130cd1140e3714b0f';
    const normalized = extras.faq
      .map((item) => `${item.question}\n${item.answer}`)
      .join('\n\n')
      .replace(/\s+/g, ' ');
    const actual = createHash('sha256').update(normalized).digest('hex');
    expect(
      actual,
      'FAQ text changed. If the church approved the edit, set EXPECTED_FAQ_SHA256 to this value',
    ).toBe(EXPECTED_FAQ_SHA256);
  });

  describe('gift chart as text', () => {
    const root = parseHtml(body);
    const details = root.querySelector('details.chart-text');
    const table = details?.querySelector('table');
    const money = (value: string) => Number(value.replace(/[^0-9.]/g, ''));
    const rows = (table?.querySelectorAll('tbody tr') ?? []).map((row) => ({
      cells: row.querySelectorAll('th, td').map((cell) => cell.text.trim()),
    }));

    it('is a closed details with a real captioned table', () => {
      expect(details).toBeTruthy();
      expect(details!.getAttribute('open')).toBeUndefined();
      expect(details!.querySelector('summary')?.text.trim()).toBe(
        'Gift chart as text',
      );
      expect(
        table!.querySelector('caption')?.text.trim().length,
      ).toBeGreaterThan(10);
      const headers = table!
        .querySelectorAll('thead th')
        .map((th) => [th.text.trim(), th.getAttribute('scope')]);
      expect(headers).toEqual([
        ['Gifts needed', 'col'],
        ['2-year gift', 'col'],
        ['Monthly gift', 'col'],
        ['Totals', 'col'],
      ]);
      for (const th of table!.querySelectorAll('tbody th')) {
        expect(th.getAttribute('scope')).toBe('row');
      }
    });

    it('has the thirteen rows the image shows, in order', () => {
      expect(rows.map((row) => row.cells)).toEqual([
        ['1', '$500,000', '$20,833', '$500,000'],
        ['1', '$300,000', '$12,500', '$300,000'],
        ['1', '$240,000', '$10,000', '$240,000'],
        ['1', '$192,000', '$8,000', '$192,000'],
        ['4', '$144,000', '$6,000', '$576,000'],
        ['6', '$96,000', '$4,000', '$576,000'],
        ['10', '$72,000', '$3,000', '$720,000'],
        ['15', '$48,000', '$2,000', '$720,000'],
        ['30', '$24,000', '$1,000', '$720,000'],
        ['40', '$18,000', '$750', '$720,000'],
        ['50', '$12,000', '$500', '$600,000'],
        ['70', '$7,200', '$300', '$504,000'],
        ['Many', '< $7,200', '< $300', '$132,000'],
      ]);
    });

    it('adds up to the $6,500,000 target', () => {
      const totals = rows.map((row) => money(row.cells[3]!));
      expect(totals.reduce((sum, value) => sum + value, 0)).toBe(6_500_000);
      const footer = table!.querySelector('tfoot')?.text ?? '';
      expect(footer).toContain('Total target');
      expect(money(footer.replace('Total target', ''))).toBe(6_500_000);
      for (const row of rows.filter((r) => r.cells[0] !== 'Many')) {
        expect(
          Number(row.cells[0]) * money(row.cells[1]!),
          row.cells.join(' '),
        ).toBe(money(row.cells[3]!));
      }
    });

    it('links to the full-size bundled chart in a new tab', () => {
      const link = root
        .querySelectorAll('a')
        .find(
          (a) =>
            a.getAttribute('href') === '/documents/entrusted-gift-chart.svg',
        );
      expect(link).toBeTruthy();
      expect(link!.getAttribute('target')).toBe('_blank');
      expect(link!.getAttribute('rel')).toContain('noopener');
      expect(link!.text).toContain('View full-size chart');
      expect(link!.text).toContain('(opens in a new tab)');
    });

    it('shortens the image alt to a pointer to the text version', () => {
      const alt = root
        .querySelectorAll('img')
        .find((img) => img.getAttribute('src')?.includes('gift-chart'))!
        .getAttribute('alt')!;
      expect(alt.length).toBeLessThan(200);
      expect(alt).toContain('$6,500,000');
      expect(alt).toContain('table');
    });
  });
});
