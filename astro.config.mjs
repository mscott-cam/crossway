import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from './scripts/load-env.mjs';
import { loadAstroRedirects } from './scripts/build-redirects.ts';
import { pruneDevPages } from './scripts/prune-dev-pages.mjs';
import { requireContent } from './scripts/require-content.mjs';
import { getSermonsWithoutAudio } from './src/lib/sanity/queries.ts';

loadProjectEnv({
  root: fileURLToPath(new URL('.', import.meta.url)),
  mode: process.argv.includes('dev') ? 'development' : 'production',
});

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
  build: { concurrency: 4 },
  redirects,
  integrations: [
    requireContent(),
    sitemap({
      filter: (page) => !/^\/(dev|api|404)(\/|$)/.test(new URL(page).pathname),
    }),
    ...(isE2E ? [] : [pruneDevPages()]),
  ],
  vite: { define: { __E2E__: JSON.stringify(isE2E) } },
});
