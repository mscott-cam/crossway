import { z } from 'astro/zod';

export const pagesSchema = z.looseObject({
  title: z.string(),
  description: z.string(),
  eyebrow: z.string().optional(),
  lede: z.string().optional(),
  ageGroups: z.array(z.string()).optional(),
});
