import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/lib/site';

const config = JSON.parse(
  readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8'),
);

describe('indexing', () => {
  it('sends X-Robots-Tag on every response exactly while the site is not indexable', () => {
    const rule = (config.headers ?? []).find(
      (entry: { source: string }) => entry.source === '/(.*)',
    );
    const tag = rule?.headers.find(
      (header: { key: string }) => header.key === 'X-Robots-Tag',
    );
    if (site.indexable) {
      expect(tag).toBeUndefined();
    } else {
      expect(tag?.value).toMatch(/noindex/);
      expect(tag?.value).toMatch(/nofollow/);
    }
  });
});
