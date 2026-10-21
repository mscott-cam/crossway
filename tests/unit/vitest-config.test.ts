import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('unit test configuration', () => {
  it('does not touch Sanity while loading the config', () => {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST')),
    );
    const result = spawnSync(
      'npx',
      ['vitest', 'run', 'tests/unit/slug.test.ts'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...env,
          SANITY_PROJECT_ID: 'config-load-probe',
          SANITY_FIXTURES: '',
          VERCEL_ENV: '',
        },
        timeout: 60_000,
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain('1 passed');
    expect(output).not.toMatch(/\[sanity\]/);
    expect(output).not.toContain('config-load-probe');
  }, 90_000);
});
