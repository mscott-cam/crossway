import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCache, writeCache } from '../../src/lib/cache';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crossway-cache-'));
  vi.stubEnv('CROSSWAY_CACHE_DIR', dir);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('cache', () => {
  it('round-trips JSON values', () => {
    writeCache('thing', { a: 1, b: ['x'] });
    expect(readCache('thing')).toEqual({ a: 1, b: ['x'] });
  });

  it('returns undefined for a missing key', () => {
    expect(readCache('nope')).toBeUndefined();
  });

  it('returns undefined for a corrupt file', () => {
    writeFileSync(join(dir, 'broken.json'), '{not json');
    expect(readCache('broken')).toBeUndefined();
  });

  it('creates the directory on demand', () => {
    rmSync(dir, { recursive: true, force: true });
    writeCache('thing', [1, 2]);
    expect(readCache('thing')).toEqual([1, 2]);
  });

  it('overwrites an existing value', () => {
    writeCache('thing', 1);
    writeCache('thing', 2);
    expect(readCache('thing')).toBe(2);
  });

  it('never throws when the directory cannot be written', () => {
    const blocker = join(dir, 'file');
    writeFileSync(blocker, 'x');
    vi.stubEnv('CROSSWAY_CACHE_DIR', join(blocker, 'sub'));
    expect(() => writeCache('thing', 1)).not.toThrow();
    expect(readCache('thing')).toBeUndefined();
  });

  it('never throws for unserializable values', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => writeCache('thing', circular)).not.toThrow();
    expect(existsSync(join(dir, 'thing.json'))).toBe(false);
  });

  it('rejects keys that could escape the cache directory', () => {
    expect(() => writeCache('../evil', 1)).not.toThrow();
    expect(readCache('../evil')).toBeUndefined();
    expect(existsSync(join(dir, '..', 'evil.json'))).toBe(false);
  });

  it('defaults to node_modules/.cache/crossway', () => {
    vi.stubEnv('CROSSWAY_CACHE_DIR', '');
    const key = `cache-test-${process.pid}-${Date.now()}`;
    const file = join(
      process.cwd(),
      'node_modules',
      '.cache',
      'crossway',
      `${key}.json`,
    );
    try {
      writeCache(key, { ok: true });
      expect(existsSync(file)).toBe(true);
      expect(readCache(key)).toEqual({ ok: true });
    } finally {
      rmSync(file, { force: true });
    }
  });
});
