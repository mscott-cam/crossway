import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import SundayCard from '../../src/components/sunday-card.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = (rows: Array<{ label: string; value: string; href?: string }>) =>
  container.renderToString(SundayCard, {
    props: {
      settings: { serviceTimes: ['9:00', '10:45'], sundayCardRows: rows },
    },
  });

describe('SundayCard row links', () => {
  it('links safe internal and external hrefs', async () => {
    const html = await render([
      { label: 'Kids', value: 'Crossway Kids', href: '/crossway-kids' },
      { label: 'Live', value: 'Watch', href: 'https://live.crosswaysa.org/' },
    ]);
    expect(html).toContain('href="/crossway-kids"');
    expect(html).toContain('href="https://live.crosswaysa.org/"');
    expect(html).toContain('target="_blank"');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    '//evil.example.com',
    'vbscript:x',
    ' javascript:alert(1)',
  ])('renders an unsafe href %s as plain text', async (href) => {
    const html = await render([{ label: 'Where', value: 'Main hall', href }]);
    expect(html).toContain('Main hall');
    expect(html).not.toContain('href="javascript');
    expect(html).not.toContain('evil.example.com');
    expect(html).not.toMatch(/<dd>\s*<a /);
    expect(html.match(/arrow__glyph/g)).toHaveLength(1);
  });

  it('renders a row without an href as plain text', async () => {
    const html = await render([{ label: 'Where', value: 'Main hall' }]);
    expect(html).toContain('Main hall');
    expect(html).not.toMatch(/<dd>\s*<a /);
  });
});
