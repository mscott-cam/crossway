import { describe, expect, it } from 'vitest';
import { checkBuildEnv } from '../../src/lib/ops/build-guard';

const production = { VERCEL_ENV: 'production' };

describe('checkBuildEnv', () => {
  it('fails a production build with no Sanity project id', () => {
    const result = checkBuildEnv(production);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('SANITY_PROJECT_ID');
      expect(result.message).toContain('SANITY_DATASET');
      expect(result.message).toContain('ALLOW_EMPTY_CONTENT=1');
      expect(result.message.split('\n').length).toBeGreaterThan(3);
    }
  });

  it.each(['', '   ', '\t\n'])('fails on a blank id %j', (id) => {
    expect(checkBuildEnv({ ...production, SANITY_PROJECT_ID: id }).ok).toBe(
      false,
    );
  });

  it.each([
    'your-project-id',
    'placeholder',
    'placehold',
    'TODO',
    ' Placehold ',
  ])('fails on the placeholder id %j', (id) => {
    expect(checkBuildEnv({ ...production, SANITY_PROJECT_ID: id }).ok).toBe(
      false,
    );
  });

  it('passes a production build with a project id', () => {
    expect(
      checkBuildEnv({ ...production, SANITY_PROJECT_ID: 'abcd1234' }),
    ).toEqual({ ok: true });
  });

  it('does not require a dataset', () => {
    expect(
      checkBuildEnv({ ...production, SANITY_PROJECT_ID: 'abcd1234' }).ok,
    ).toBe(true);
  });

  it('downgrades to a warning with ALLOW_EMPTY_CONTENT=1', () => {
    const result = checkBuildEnv({ ...production, ALLOW_EMPTY_CONTENT: '1' });
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('warning');
    if ('warning' in result) {
      expect(result.warning).toContain('SANITY_PROJECT_ID');
      expect(result.warning).toContain('ALLOW_EMPTY_CONTENT');
    }
  });

  it('only honors ALLOW_EMPTY_CONTENT when it is exactly 1', () => {
    expect(
      checkBuildEnv({ ...production, ALLOW_EMPTY_CONTENT: 'true' }).ok,
    ).toBe(false);
  });

  it('gives no warning when configured, even with ALLOW_EMPTY_CONTENT=1', () => {
    expect(
      checkBuildEnv({
        ...production,
        SANITY_PROJECT_ID: 'abcd1234',
        ALLOW_EMPTY_CONTENT: '1',
      }),
    ).toEqual({ ok: true });
  });

  it.each([['preview'], ['development'], [undefined], ['']])(
    'never blocks VERCEL_ENV=%s',
    (vercelEnv) => {
      expect(checkBuildEnv({ VERCEL_ENV: vercelEnv })).toEqual({ ok: true });
    },
  );

  it('never blocks an E2E build', () => {
    expect(checkBuildEnv({ ...production, E2E: '1' })).toEqual({ ok: true });
  });

  it('does not honor SANITY_FIXTURES in production', () => {
    expect(checkBuildEnv({ ...production, SANITY_FIXTURES: '1' }).ok).toBe(
      false,
    );
  });

  it('ignores a missing Spreaker or Planning Center configuration', () => {
    expect(
      checkBuildEnv({ ...production, SANITY_PROJECT_ID: 'abcd1234' }),
    ).toEqual({ ok: true });
  });
});
