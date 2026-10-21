export const PLACEHOLDER_PROJECT_IDS = [
  'your-project-id',
  'placeholder',
  'placehold',
  'todo',
];

export type BuildEnv = Record<string, string | undefined>;

export type BuildCheck =
  { ok: true } | { ok: true; warning: string } | { ok: false; message: string };

export function isConfiguredProjectId(value: string | undefined): boolean {
  const id = (value ?? '').trim();
  return id !== '' && !PLACEHOLDER_PROJECT_IDS.includes(id.toLowerCase());
}

const MISSING = [
  'SANITY_PROJECT_ID is not set (or is a placeholder), so this build has no content source.',
  'The site would deploy with no sermons, no series, no leaders and default settings.',
];

export function checkBuildEnv(env: BuildEnv): BuildCheck {
  if (env.VERCEL_ENV !== 'production' || env.E2E === '1') return { ok: true };
  if (isConfiguredProjectId(env.SANITY_PROJECT_ID)) return { ok: true };

  if (env.ALLOW_EMPTY_CONTENT === '1') {
    return {
      warning: [
        '[build-guard] WARNING: production build with no Sanity project.',
        ...MISSING,
        'Continuing only because ALLOW_EMPTY_CONTENT=1 is set. Remove it once Sanity is configured.',
      ].join('\n'),
      ok: true,
    };
  }

  return {
    ok: false,
    message: [
      '',
      '[build-guard] Refusing to build a production deploy with no content.',
      ...MISSING,
      '',
      'Fix: in Vercel, Project, Settings, Environment Variables, set for Production:',
      '  SANITY_PROJECT_ID   the Sanity project id (sanity.io/manage)',
      '  SANITY_DATASET      usually "production"',
      'then redeploy. SANITY_FIXTURES is ignored in production builds.',
      '',
      'To deploy an empty site on purpose, set ALLOW_EMPTY_CONTENT=1 (the build then only warns).',
      'Preview and development builds are never blocked.',
      '',
    ].join('\n'),
  };
}
