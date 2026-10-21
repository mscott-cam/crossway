export const colors = {
  paper: '#F3F0E8',
  navy: '#1A374D',
  amber: '#F5A707',
  amberInk: '#8F6000',
  mist: '#A9B7C8',
  charcoal: '#333333',
  error: '#9B2C1C',
} as const;

export type ColorName = keyof typeof colors;

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function tokensToCss(): string {
  const vars = Object.entries(colors)
    .map(([name, value]) => `--${kebab(name)}:${value}`)
    .join(';');
  return `:root{${vars}}`;
}
