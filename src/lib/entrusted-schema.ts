import { z } from 'astro/zod';

export const entrustedExtrasSchema = z.object({
  faqHeading: z.string().min(1),
  faq: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .min(1),
});

export type EntrustedExtras = z.infer<typeof entrustedExtrasSchema>;
