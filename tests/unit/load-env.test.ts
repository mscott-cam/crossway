import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadProjectEnv } from '../../scripts/load-env.mjs';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'crossway-env-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadProjectEnv', () => {
  it('makes SANITY_PROJECT_ID from .env visible to the config', () => {
    writeFileSync(
      join(root, '.env'),
      'SANITY_PROJECT_ID=abcd1234\nSANITY_DATASET=staging\n',
    );
    const env: NodeJS.ProcessEnv = {};
    loadProjectEnv({ root, env });
    expect(env.SANITY_PROJECT_ID).toBe('abcd1234');
    expect(env.SANITY_DATASET).toBe('staging');
  });

  it('never overrides a real environment variable', () => {
    writeFileSync(join(root, '.env'), 'SANITY_PROJECT_ID=fromfile\n');
    const env: NodeJS.ProcessEnv = { SANITY_PROJECT_ID: 'fromshell' };
    loadProjectEnv({ root, env });
    expect(env.SANITY_PROJECT_ID).toBe('fromshell');
  });

  it('only copies the names this project uses', () => {
    writeFileSync(
      join(root, '.env'),
      'SANITY_PROJECT_ID=abcd1234\nSOMETHING_ELSE=secret\nPUBLIC_X=1\n',
    );
    const env: NodeJS.ProcessEnv = {};
    loadProjectEnv({ root, env });
    expect(Object.keys(env)).toEqual(['SANITY_PROJECT_ID']);
  });

  it('reads mode files and tolerates a missing .env', () => {
    writeFileSync(
      join(root, '.env.production'),
      'SANITY_PROJECT_ID=prodid12\n',
    );
    const env: NodeJS.ProcessEnv = {};
    loadProjectEnv({ root, mode: 'production', env });
    expect(env.SANITY_PROJECT_ID).toBe('prodid12');

    const empty: NodeJS.ProcessEnv = {};
    loadProjectEnv({ root: join(root, 'nothing-here'), env: empty });
    expect(empty).toEqual({});
  });
});
