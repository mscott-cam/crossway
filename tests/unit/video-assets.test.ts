import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'public', 'video');
const MB = 1024 * 1024;
const KB = 1024;

const files = [
  'lobby-1280.webm',
  'lobby-1280.mp4',
  'lobby-720.webm',
  'lobby-720.mp4',
  'lobby-poster.avif',
  'lobby-poster.jpg',
];

const size = (name: string) => statSync(join(dir, name)).size;

describe('hero video assets', () => {
  it.each(files)('%s exists', (name) => {
    expect(existsSync(join(dir, name))).toBe(true);
  });

  it.each(['lobby-1280.webm', 'lobby-1280.mp4'])('%s is under 4 MB', (name) => {
    expect(size(name)).toBeLessThan(4 * MB);
  });

  it.each(['lobby-720.webm', 'lobby-720.mp4'])('%s is under 2 MB', (name) => {
    expect(size(name)).toBeLessThan(2 * MB);
  });

  it('poster JPG is under 200 KB', () => {
    expect(size('lobby-poster.jpg')).toBeLessThan(200 * KB);
  });

  it('poster AVIF is under 200 KB', () => {
    expect(size('lobby-poster.avif')).toBeLessThan(200 * KB);
  });
});
