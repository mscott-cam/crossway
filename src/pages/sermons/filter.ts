import type { APIRoute } from 'astro';
import { bookBySlug } from '../../lib/books';

export const prerender = false;

const SPEAKER_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

function target(book: string, speaker: string): string {
  const bookSlug = bookBySlug(book)?.slug;
  if (bookSlug) return `/sermons/book/${bookSlug}`;
  if (speaker.length <= MAX_SLUG_LENGTH && SPEAKER_SLUG.test(speaker)) {
    return `/sermons/speaker/${speaker}`;
  }
  return '/sermons';
}

export const GET: APIRoute = ({ url }) => {
  const book = url.searchParams.get('book')?.trim() ?? '';
  const speaker = url.searchParams.get('speaker')?.trim() ?? '';
  return new Response(null, {
    status: 303,
    headers: {
      Location: target(book, speaker),
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
};
