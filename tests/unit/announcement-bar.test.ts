import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import AnnouncementBar from '../../src/components/announcement-bar.astro';

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = (announcement: Record<string, unknown>) =>
  container.renderToString(AnnouncementBar, { props: { announcement } });

describe('AnnouncementBar', () => {
  it('renders nothing when disabled', async () => {
    const html = await render({ enabled: false, text: 'Hidden' });
    expect(html).not.toContain('Hidden');
    expect(html).not.toContain('announcement');
  });

  it('renders nothing when enabled without text', async () => {
    const html = await render({ enabled: true, text: '   ' });
    expect(html).not.toContain('announcement');
  });

  it('renders the text as a link when an href is given', async () => {
    const html = await render({
      enabled: true,
      text: 'Join us this Sunday',
      href: '/entrusted',
    });
    expect(html).toContain('Join us this Sunday');
    expect(html).toContain('href="/entrusted"');
    expect(html).not.toContain('target="_blank"');
  });

  it('renders plain text when the href is absent', async () => {
    const html = await render({ enabled: true, text: 'No link here' });
    expect(html).toContain('No link here');
    expect(html).not.toContain('<a ');
  });

  it('opens external links in a new tab with a screen reader hint', async () => {
    const html = await render({
      enabled: true,
      text: 'Give today',
      href: 'https://pushpay.com/g/crosswaysa',
    });
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('(opens in a new tab)');
  });

  it('escapes markup in the text', async () => {
    const html = await render({
      enabled: true,
      text: '<img src=x onerror=alert(1)> & more',
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
