import type { APIRoute } from 'astro';
import { bookBySlug } from '../../lib/books';
import { getSermons } from '../../lib/sanity/queries';
import { groupBooks, groupSpeakers } from '../../lib/sermon-groups';

export const prerender = false;

export const GET: APIRoute = async ({ url, redirect }) => {
  const book = url.searchParams.get('book')?.trim() ?? '';
  const speaker = url.searchParams.get('speaker')?.trim() ?? '';
  if (!book && !speaker) return redirect('/sermons', 303);

  const sermons = await getSermons();
  const bookName = bookBySlug(book)?.name;
  if (
    bookName &&
    groupBooks(sermons).some((group) => group.book.name === bookName)
  ) {
    return redirect(`/sermons/book/${bookBySlug(book)!.slug}`, 303);
  }
  const match = groupSpeakers(sermons).find(
    (group) => group.speaker.slug === speaker,
  );
  if (match) return redirect(`/sermons/speaker/${match.speaker.slug}`, 303);
  return redirect('/sermons', 303);
};
