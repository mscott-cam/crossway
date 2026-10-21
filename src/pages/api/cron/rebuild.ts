import type { APIRoute } from 'astro';
import { handleRebuild } from '../../../lib/ops/rebuild';

export const prerender = false;

const run: APIRoute = ({ request }) =>
  handleRebuild(request, { env: process.env, fetch: globalThis.fetch });

export const GET: APIRoute = run;
export const ALL: APIRoute = run;
