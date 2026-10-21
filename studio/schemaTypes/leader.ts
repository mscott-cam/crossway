import { defineField, defineType } from 'sanity';

export const leader = defineType({
  name: 'leader',
  title: 'Leader',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: 'e.g. "Lead Pastor" or "Children’s Ministry Director".',
    }),
    defineField({
      name: 'group',
      title: 'Group',
      type: 'string',
      description:
        'Which section of the Our Leadership page this person appears in.',
      options: {
        list: ['Staff', 'Elders', 'Deacons', 'Ministry Leaders'],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Lower numbers appear first within the group (1, 2, 3...).',
      initialValue: 100,
      validation: (Rule) => Rule.required().integer().min(0),
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      description:
        'Optional. Drag the focus point to keep the face visible when cropped.',
      options: { hotspot: true },
    }),
  ],
  orderings: [
    {
      title: 'Group, then order',
      name: 'groupOrder',
      by: [
        { field: 'group', direction: 'asc' },
        { field: 'order', direction: 'asc' },
      ],
    },
  ],
  preview: { select: { title: 'name', subtitle: 'group', media: 'photo' } },
});
