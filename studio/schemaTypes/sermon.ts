import { defineField, defineType } from 'sanity';
import { BOOKS } from './books';
import {
  defaultSermonDate,
  requiredUnlessImported,
  sermonSlugSource,
} from './sermon-helpers';

export const sermon = defineType({
  name: 'sermon',
  title: 'Sermon',
  type: 'document',
  fieldsets: [
    {
      name: 'advanced',
      title: 'Advanced',
      description: 'Most sermons never need these.',
      options: { collapsible: true, collapsed: true },
    },
    {
      name: 'imported',
      title: 'Imported data',
      description: 'Filled in automatically. Please do not change.',
      options: { collapsible: true, collapsed: true },
    },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date preached',
      type: 'date',
      description: 'Defaults to the most recent Sunday. Change it if needed.',
      initialValue: () => defaultSermonDate(),
      options: { dateFormat: 'MMMM D, YYYY' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'speaker',
      title: 'Speaker',
      type: 'reference',
      to: [{ type: 'speaker' }],
      validation: (Rule) => Rule.custom(requiredUnlessImported),
    }),
    defineField({
      name: 'series',
      title: 'Series',
      type: 'reference',
      to: [{ type: 'series' }],
      description:
        'Choose "Stand Alone Messages" if this message is not part of a series.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'book',
      title: 'Book of the Bible',
      type: 'string',
      description: 'The main book this message is from.',
      options: {
        list: BOOKS.map((book) => ({ title: book.name, value: book.name })),
      },
      validation: (Rule) => Rule.custom(requiredUnlessImported),
    }),
    defineField({
      name: 'passage',
      title: 'Passage',
      type: 'string',
      description: 'Optional, e.g. "1 Timothy 6:6–19".',
    }),
    defineField({
      name: 'vimeoUrl',
      title: 'Vimeo link',
      type: 'url',
      description:
        'Paste the sermon’s Vimeo link, e.g. https://vimeo.com/123456789.',
      validation: (Rule) => [
        Rule.uri({ scheme: ['https', 'http'] }).error(
          'This does not look like a web link. It should start with https://',
        ),
        Rule.custom((value) =>
          !value || /^https?:\/\/([\w-]+\.)*vimeo\.com(\/|$)/i.test(value)
            ? true
            : 'This is not a vimeo.com link. Double-check it before publishing.',
        ).warning(),
      ],
    }),
    defineField({
      name: 'slug',
      title: 'Web address',
      type: 'slug',
      description:
        'Click Generate after entering the title and date. This becomes the sermon’s link.',
      options: {
        source: (doc) =>
          sermonSlugSource(
            String((doc as { title?: string }).title ?? ''),
            (doc as { date?: string }).date,
          ),
        slugify: (input) => sermonSlugSource(input),
        maxLength: 200,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Short description',
      type: 'text',
      rows: 3,
      description: 'Optional. One or two sentences, up to 400 characters.',
      validation: (Rule) => Rule.max(400),
    }),
    defineField({
      name: 'audioOverrideUrl',
      title: 'Audio file link',
      type: 'url',
      description:
        'Only if the audio on the sermon page is wrong or missing. Paste a direct link to an MP3 file.',
      fieldset: 'advanced',
      validation: (Rule) => Rule.uri({ scheme: ['https', 'http'] }),
    }),
    defineField({
      name: 'spreakerEpisodeId',
      title: 'Spreaker episode ID',
      type: 'string',
      readOnly: true,
      fieldset: 'imported',
    }),
    defineField({
      name: 'webflowPath',
      title: 'Old website path',
      type: 'string',
      readOnly: true,
      fieldset: 'imported',
    }),
  ],
  orderings: [
    {
      title: 'Date, newest first',
      name: 'dateDesc',
      by: [{ field: 'date', direction: 'desc' }],
    },
    {
      title: 'Date, oldest first',
      name: 'dateAsc',
      by: [{ field: 'date', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'title', date: 'date', speaker: 'speaker.name' },
    prepare: ({ title, date, speaker }) => ({
      title,
      subtitle: [date, speaker].filter(Boolean).join(' · '),
    }),
  },
});
