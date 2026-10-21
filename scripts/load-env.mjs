import { loadEnv } from 'vite';

export const PROJECT_ENV_NAMES = [
  'SANITY_PROJECT_ID',
  'SANITY_DATASET',
  'SANITY_API_READ_TOKEN',
  'SANITY_FIXTURES',
  'SANITY_FIXTURE_DIR',
  'SANITY_FIXTURE_SETTINGS',
];

export function loadProjectEnv({
  root,
  mode = 'production',
  env = process.env,
}) {
  const loaded = loadEnv(mode, root, '');
  for (const name of PROJECT_ENV_NAMES) {
    if (env[name] === undefined && loaded[name] !== undefined) {
      env[name] = loaded[name];
    }
  }
  return env;
}
