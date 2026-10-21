import { defineField, defineType } from 'sanity';

export const speaker = defineType({
  name: 'speaker',
  title: 'Speaker',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'As it should appear on the site, e.g. "Pastor Jim Smith".',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Web address',
      type: 'slug',
      description:
        'Click Generate. This becomes the link to this speaker’s sermons.',
      options: { source: 'name', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'Optional, e.g. "Lead Pastor" or "Guest Speaker".',
    }),
  ],
  orderings: [
    {
      title: 'Name (A to Z)',
      name: 'nameAsc',
      by: [{ field: 'name', direction: 'asc' }],
    },
  ],
  preview: { select: { title: 'name', subtitle: 'role' } },
});
