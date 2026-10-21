import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/seo/robots';
import { site } from '../lib/site';

export const GET: APIRoute = ({ site: origin }) =>
  new Response(robotsTxt(site.indexable, origin!.origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
