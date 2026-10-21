import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import { loadAstroRedirects } from './scripts/build-redirects.ts';
import { getSermonsWithoutAudio } from './src/lib/sanity/queries.ts';

const isE2E = process.env.E2E === '1';

const adapter = isE2E
  ? (await import('@astrojs/node')).default({ mode: 'standalone' })
  : vercel();

const redirects = await loadAstroRedirects(getSermonsWithoutAudio);

export default defineConfig({
  output: 'static',
  adapter,
  site: 'https://crosswaysa.org',
  trailingSlash: 'never',
  redirects,
});
