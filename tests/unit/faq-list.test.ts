import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import FaqList from '../../src/components/faq-list.astro';

const items = [
  {
    id: 'first',
    question: 'Why one fund?',
    answerHtml: '<p>Because <em>one</em>.</p>',
  },
  {
    id: 'second',
    question: 'What <b>if</b> & more?',
    answerHtml: '<p>Then <strong>this</strong>.</p>',
  },
  {
    id: 'third',
    question: 'Third question?',
    answerHtml: '<p>Third answer.</p>',
  },
];

let html = '';

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(FaqList, { props: { items } });
});

describe('FaqList', () => {
  it('renders one details with one summary per item', () => {
    expect(html.match(/<details/g)).toHaveLength(items.length);
    expect(html.match(/<summary/g)).toHaveLength(items.length);
  });

  it('keeps every item closed by default', () => {
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it('gives each item its id for deep links', () => {
    for (const { id } of items) expect(html).toContain(`id="${id}"`);
  });

  it('escapes question text', () => {
    expect(html).toContain('What &lt;b&gt;if&lt;/b&gt; &amp; more?');
    expect(html).not.toContain('<b>if</b>');
  });

  it('renders the supplied answer HTML inside the item', () => {
    expect(html).toContain('<p>Because <em>one</em>.</p>');
    expect(html).toContain('<strong>this</strong>');
  });

  it('renders nothing for an empty list', async () => {
    const container = await AstroContainer.create();
    const empty = await container.renderToString(FaqList, {
      props: { items: [] },
    });
    expect(empty).not.toContain('<details');
  });
});
