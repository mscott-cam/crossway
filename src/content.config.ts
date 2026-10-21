import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { pagesSchema } from './lib/pages-schema';

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: pagesSchema,
});

export const collections = { pages };
