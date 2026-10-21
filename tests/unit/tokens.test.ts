import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, tokensToCss } from '../../src/lib/tokens';

describe('color tokens', () => {
  it('navy text on paper passes AA', () => {
    expect(contrastRatio(colors.navy, colors.paper)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('amber-ink text on paper passes AA', () => {
    expect(contrastRatio(colors.amberInk, colors.paper)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('amber text on navy passes AA', () => {
    expect(contrastRatio(colors.amber, colors.navy)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('mist text on navy passes AA', () => {
    expect(contrastRatio(colors.mist, colors.navy)).toBeGreaterThanOrEqual(4.5);
  });

  it('amber on paper fails, so it is never used as text there', () => {
    expect(contrastRatio(colors.amber, colors.paper)).toBeLessThan(3);
  });

  it('emits css custom properties', () => {
    const css = tokensToCss();
    expect(css).toContain('--amber-ink:#8F6000');
    expect(css).toContain('--paper:#F3F0E8');
    expect(css.startsWith(':root{')).toBe(true);
  });
});
