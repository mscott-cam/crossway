import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface VercelRoute {
  src?: string;
  dest?: string;
  status?: number;
  headers?: Record<string, string>;
  handle?: string;
}

const root = resolve(__dirname, '../..');
let work = '';
let routes: VercelRoute[] = [];

const redirectFor = (path: string) =>
  routes.find(
    (r) =>
      r.status !== undefined &&
      r.headers?.Location !== undefined &&
      r.src !== undefined &&
      new RegExp(r.src).test(path),
  );

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'crossway-redirects-'));
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

  const env = { ...process.env, SANITY_FIXTURES: '1', E2E: undefined };
  const build = spawnSync(join(root, 'node_modules/.bin/astro'), ['build'], {
    cwd: work,
    env,
    encoding: 'utf8',
  });
  if (build.status !== 0) {
    throw new Error(`astro build failed\n${build.stdout}\n${build.stderr}`);
  }
  const config = join(work, '.vercel/output/config.json');
  expect(existsSync(config)).toBe(true);
  routes = JSON.parse(readFileSync(config, 'utf8')).routes;
}, 240_000);

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

describe('Vercel output redirects', () => {
  it('redirects /connect to /visit with a 301', () => {
    const route = redirectFor('/connect');
    expect(route?.status).toBe(301);
    expect(route?.headers?.Location).toBe('/visit');
  });

  it.each([
    ['/sermons/faith-that-works', '/sermons/faith-that-works-2026-08-16'],
    [
      '/sermons/the-lord-will-provide',
      '/sermons/the-lord-will-provide-2025-01-26',
    ],
  ])('redirects legacy sermon %s with a 301', (from, to) => {
    const route = redirectFor(from);
    expect(route?.status).toBe(301);
    expect(route?.headers?.Location).toBe(to);
  });

  it('places redirects before the filesystem handler', () => {
    const fs = routes.findIndex((r) => r.handle === 'filesystem');
    expect(fs).toBeGreaterThan(-1);
    expect(routes.slice(0, fs).some((r) => r.status === 301)).toBe(true);
  });

  it('serves the rebuild cron endpoint from the server function', () => {
    const route = routes.find((r) => r.src === '^/api/cron/rebuild$');
    expect(route?.dest).toBe('_render');
  });

  it('does not redirect current sermon URLs', () => {
    expect(redirectFor('/sermons/faith-that-works-2026-08-16')).toBeUndefined();
  });

  it('redirects trailing-slash variants to the canonical path', () => {
    const route = redirectFor('/culture/');
    expect([301, 308]).toContain(route?.status);
    const location = '/culture/'.replace(
      new RegExp(route!.src!),
      route!.headers!.Location!,
    );
    expect(location).toBe('/culture');
  });
});
