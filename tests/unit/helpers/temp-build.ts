import { spawn } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../../..');

export type TempBuild = {
  work: string;
  e2e: boolean;
  outputDir: string;
  cleanup: () => void;
};

export async function tempBuild(e2e: boolean): Promise<TempBuild> {
  const work = mkdtempSync(
    join(tmpdir(), `crossway-seo-${e2e ? 'e2e' : 'prod'}-`),
  );
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
  mkdirSync(join(work, 'node_modules'));
  for (const entry of readdirSync(join(root, 'node_modules'))) {
    if (entry.startsWith('.')) continue;
    symlinkSync(
      join(root, 'node_modules', entry),
      join(work, 'node_modules', entry),
    );
  }
  symlinkSync(join(root, 'public'), join(work, 'public'));

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SANITY_FIXTURES: '1',
    TURNSTILE_SITE_KEY: 'e2e-site-key',
  };
  if (e2e) env.E2E = '1';
  else delete env.E2E;

  await new Promise<void>((resolveBuild, reject) => {
    const child = spawn(join(root, 'node_modules/.bin/astro'), ['build'], {
      cwd: work,
      env,
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) =>
      code === 0
        ? resolveBuild()
        : reject(new Error(`astro build failed (${code})\n${output}`)),
    );
  });

  return {
    work,
    e2e,
    outputDir: join(work, e2e ? 'dist/client' : '.vercel/output/static'),
    cleanup: () => rmSync(work, { recursive: true, force: true }),
  };
}
