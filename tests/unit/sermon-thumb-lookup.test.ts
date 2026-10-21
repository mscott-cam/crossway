import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import SermonMedia from '../../src/components/sermon-media.astro';
import SermonPage from '../../src/pages/sermons/[slug].astro';

const lookups = vi.hoisted(() => ({ getVimeoThumb: vi.fn() }));

vi.mock('../../src/lib/video/vimeo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/video/vimeo')>()),
  getVimeoThumb: lookups.getVimeoThumb,
}));

const sermon = {
  _id: 'sermon-a',
  slug: 'faith-that-works-2026-08-16',
  title: 'Faith That Works',
  date: '2026-08-16',
  vimeoUrl: 'https://vimeo.com/76979871',
  audio: { url: 'https://example.com/a.mp3' },
  series: { _id: 'series-x', title: 'X', slug: 'x', isStandalone: false },
  description: 'Short.',
};

let container: AstroContainer;

beforeAll(async () => {
  vi.stubEnv('SANITY_FIXTURES', '1');
  container = await AstroContainer.create({
    astroConfig: { site: 'https://crosswaysa.org' },
  });
});

beforeEach(() => {
  lookups.getVimeoThumb.mockReset();
  lookups.getVimeoThumb.mockResolvedValue('https://i.vimeocdn.com/t.jpg');
});

describe('Vimeo thumbnail lookups per sermon page', () => {
  it('looks the thumbnail up once for the whole page', async () => {
    const html = await container.renderToString(SermonPage, {
      props: { sermon },
      params: { slug: sermon.slug },
      request: new Request(`https://crosswaysa.org/sermons/${sermon.slug}`),
    });
    expect(html).toContain('data-sermon-media');
    expect(lookups.getVimeoThumb).toHaveBeenCalledTimes(1);
    expect(lookups.getVimeoThumb).toHaveBeenCalledWith('76979871');
    expect(html).toContain('https://i.vimeocdn.com/t.jpg');
  });

  it('SermonMedia trusts a thumb it is given, including null', async () => {
    await container.renderToString(SermonMedia, {
      props: { sermon, thumb: null },
    });
    await container.renderToString(SermonMedia, {
      props: { sermon, thumb: 'https://i.vimeocdn.com/given.jpg' },
    });
    expect(lookups.getVimeoThumb).not.toHaveBeenCalled();
  });

  it('SermonMedia still looks one up when used on its own', async () => {
    await container.renderToString(SermonMedia, { props: { sermon } });
    expect(lookups.getVimeoThumb).toHaveBeenCalledTimes(1);
  });
});
