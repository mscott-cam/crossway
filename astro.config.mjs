import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

const isE2E = process.env.E2E === '1';

export default defineConfig({
  output: 'static',
  adapter: isE2E ? node({ mode: 'standalone' }) : vercel(),
  site: 'https://crosswaysa.org',
});
