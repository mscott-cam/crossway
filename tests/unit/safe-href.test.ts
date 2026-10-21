import { describe, expect, it } from 'vitest';
import { safeHref } from '../../src/lib/safe-href';

describe('safeHref', () => {
  it('allows relative paths, http, https and mailto', () => {
    expect(safeHref('/entrusted')).toBe('/entrusted');
    expect(safeHref('/sermons?x=1#top')).toBe('/sermons?x=1#top');
    expect(safeHref('https://example.org/a')).toBe('https://example.org/a');
    expect(safeHref('http://example.org')).toBe('http://example.org');
    expect(safeHref('mailto:hello@crosswaysa.org')).toBe(
      'mailto:hello@crosswaysa.org',
    );
  });

  it('trims whitespace', () => {
    expect(safeHref('  /visit  ')).toBe('/visit');
  });

  it('rejects dangerous or unsupported schemes and protocol-relative urls', () => {
    for (const bad of [
      'javascript:alert(1)',
      ' JavaScript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:x',
      'file:///etc/passwd',
      '//evil.example',
      '\\\\evil.example',
      'tel:+12105550100',
    ])
      expect(safeHref(bad), bad).toBeUndefined();
  });

  it('returns undefined for empty or missing values', () => {
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
    expect(safeHref('   ')).toBeUndefined();
  });

  it('rejects bare words and relative paths without a leading slash', () => {
    expect(safeHref('entrusted')).toBeUndefined();
    expect(safeHref('www.example.org')).toBeUndefined();
  });
});
