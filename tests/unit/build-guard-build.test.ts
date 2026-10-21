import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
let work = '';

function build(extra: Record<string, string>) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined &&
      !/^(SANITY_|VERCEL|E2E$|ALLOW_EMPTY_CONTENT$)/.test(key)
    ) {
      env[key] = value;
    }
  }
  rmSync(join(work, '.vercel'), { recursive: true, force: true });
  rmSync(join(work, 'dist'), { recursive: true, force: true });
  const result = spawnSync(join(root, 'node_modules/.bin/astro'), ['build'], {
    cwd: work,
    env: { ...env, ...extra },
    encoding: 'utf8',
  });
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
  };
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'crossway-guard-'));
  for (const entry of [
    'src',
    'scripts',
    'astro.config.mjs',
    'package.json',
    'tsconfig.json',
    'vercel.json',
  ]) {
    cpSync(join(root, entry), join(work, entry), { recursive: true });
  }
  mkdirSync(join(work, 'tests'));
  cpSync(join(root, 'tests/fixtures'), join(work, 'tests/fixtures'), {
    recursive: true,
  });
  symlinkSync(join(root, 'node_modules'), join(work, 'node_modules'));
  symlinkSync(join(root, 'public'), join(work, 'public'));
}, 60_000);

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

describe('production build guard', () => {
  it('fails a production build with no Sanity project id', () => {
    const { status, output } = build({ VERCEL_ENV: 'production' });
    expect(status).not.toBe(0);
    expect(output).toContain('[build-guard]');
    expect(output).toContain('SANITY_PROJECT_ID');
    expect(output).toContain('SANITY_DATASET');
    expect(output).toContain('ALLOW_EMPTY_CONTENT=1');
    expect(existsSync(join(work, '.vercel/output/config.json'))).toBe(false);
  }, 120_000);

  it('fails a production build that sets only SANITY_FIXTURES', () => {
    const { status, output } = build({
      VERCEL_ENV: 'production',
      SANITY_FIXTURES: '1',
    });
    expect(status).not.toBe(0);
    expect(output).toContain('[build-guard]');
  }, 120_000);

  it('only warns with ALLOW_EMPTY_CONTENT=1', () => {
    const { status, output } = build({
      VERCEL_ENV: 'production',
      ALLOW_EMPTY_CONTENT: '1',
    });
    expect(status).toBe(0);
    expect(output).toContain('[build-guard] WARNING');
    expect(existsSync(join(work, '.vercel/output/config.json'))).toBe(true);
  }, 240_000);

  it('builds a preview deploy with no Sanity project id', () => {
    const { status, output } = build({ VERCEL_ENV: 'preview' });
    expect(status).toBe(0);
    expect(output).not.toContain('[build-guard]');
  }, 240_000);

  it('builds an E2E fixtures build', () => {
    const { status, output } = build({
      E2E: '1',
      SANITY_FIXTURES: '1',
      VERCEL_ENV: 'production',
    });
    expect(status).toBe(0);
    expect(output).not.toContain('[build-guard]');
  }, 240_000);
});
