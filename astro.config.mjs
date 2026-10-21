import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const isE2E = process.env.E2E === '1';

const adapter = isE2E
  ? (await import('@astrojs/node')).default({ mode: 'standalone' })
  : vercel();

export default defineConfig({
  output: 'static',
  adapter,
  site: 'https://crosswaysa.org',
});
