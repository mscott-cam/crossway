import { createClient, type SanityClient } from '@sanity/client';

const API_VERSION = '2025-02-19';
const REQUEST_TIMEOUT_MS = 15000;
const PLACEHOLDER_PROJECT_IDS = ['your-project-id', 'placeholder', 'todo'];

export function env(name: string): string {
  const value = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function isSanityConfigured(): boolean {
  const id = env('SANITY_PROJECT_ID');
  return id !== '' && !PLACEHOLDER_PROJECT_IDS.includes(id.toLowerCase());
}

let fixtureNoticeLogged = false;

export function isFixtureMode(): boolean {
  if (env('SANITY_FIXTURES') !== '1') return false;
  if (env('VERCEL_ENV') === 'production') {
    if (!fixtureNoticeLogged) {
      fixtureNoticeLogged = true;
      console.error(
        '[sanity] SANITY_FIXTURES is set on a production build; ignoring it and using Sanity.',
      );
    }
    return false;
  }
  if (!fixtureNoticeLogged) {
    fixtureNoticeLogged = true;
    console.warn('[sanity] SANITY_FIXTURES=1: using fixture data.');
  }
  return true;
}

export function getClient(): SanityClient {
  const token = env('SANITY_API_READ_TOKEN');
  return createClient({
    projectId: env('SANITY_PROJECT_ID'),
    dataset: env('SANITY_DATASET') || 'production',
    apiVersion: API_VERSION,
    useCdn: true,
    perspective: 'published',
    timeout: REQUEST_TIMEOUT_MS,
    ...(token ? { token } : {}),
  });
}
