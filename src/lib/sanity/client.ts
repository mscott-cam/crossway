import { createClient, type SanityClient } from '@sanity/client';

const API_VERSION = '2025-02-19';
const PLACEHOLDER_PROJECT_IDS = ['your-project-id', 'placeholder', 'todo'];

export function env(name: string): string {
  const value = process.env[name] ?? import.meta.env?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function isSanityConfigured(): boolean {
  const id = env('SANITY_PROJECT_ID');
  return id !== '' && !PLACEHOLDER_PROJECT_IDS.includes(id.toLowerCase());
}

export function isFixtureMode(): boolean {
  return env('SANITY_FIXTURES') === '1';
}

export function getClient(): SanityClient {
  const token = env('SANITY_API_READ_TOKEN');
  return createClient({
    projectId: env('SANITY_PROJECT_ID'),
    dataset: env('SANITY_DATASET') || 'production',
    apiVersion: API_VERSION,
    useCdn: true,
    perspective: 'published',
    ...(token ? { token } : {}),
  });
}
