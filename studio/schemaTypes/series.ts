import { defineField, defineType } from 'sanity';

export const series = defineType({
  name: 'series',
  title: 'Series',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Web address',
      type: 'slug',
      description: 'Click Generate. This becomes the link to the series page.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'artwork',
      title: 'Artwork',
      type: 'image',
      description:
        'Square or landscape cover image. You can drag the focus point to choose what stays visible when cropped.',
      options: { hotspot: true },
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description: 'Optional short summary of the series.',
    }),
    defineField({
      name: 'isStandalone',
      title: 'This is the "Stand Alone Messages" series',
      type: 'boolean',
      description:
        'Turn on only for the catch-all series that holds one-off messages.',
      initialValue: false,
    }),
  ],
  orderings: [
    {
      title: 'Title (A to Z)',
      name: 'titleAsc',
      by: [{ field: 'title', direction: 'asc' }],
    },
  ],
  preview: { select: { title: 'title', media: 'artwork' } },
});
