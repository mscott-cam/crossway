import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

const isE2E = process.env.E2E === '1';

export default defineConfig({
  output: 'static',
  adapter: isE2E ? undefined : vercel(),
  site: 'https://crosswaysa.org',
});
