import { describe, expect, it } from 'vitest';
import { sermonSlug } from '../../src/lib/slug';

describe('sermonSlug', () => {
  it('builds the Webflow title-date pattern', () => {
    expect(
      sermonSlug(
        'Entrusted With Resources - Putting Money In its Place',
        '2026-10-18',
      ),
    ).toBe('entrusted-with-resources-putting-money-in-its-place-2026-10-18');
  });

  it('drops straight and curly apostrophes without hyphenating', () => {
    expect(sermonSlug("Faith That Doesn't Unravel", '2026-09-06')).toBe(
      'faith-that-doesnt-unravel-2026-09-06',
    );
    expect(sermonSlug('Faith That Doesn’t Unravel', '2026-09-06')).toBe(
      'faith-that-doesnt-unravel-2026-09-06',
    );
  });

  it('strips accents and collapses punctuation runs', () => {
    expect(sermonSlug('Café & Résumé — Grace – Part 2', '2026-09-06')).toBe(
      'cafe-resume-grace-part-2-2026-09-06',
    );
  });

  it('trims leading and trailing hyphens', () => {
    expect(sermonSlug('  --Grace!! ', '2026-09-06')).toBe('grace-2026-09-06');
  });
});
