import { defineArrayMember, defineField, defineType } from 'sanity';

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'serviceTimes',
      title: 'Service times',
      type: 'array',
      description:
        'One entry per Sunday service, e.g. 9:00 and 10:45 (AM is added automatically).',
      of: [defineArrayMember({ type: 'string' })],
      initialValue: ['9:00', '10:45'],
      validation: (Rule) => Rule.required().min(1),
    }),
    defineField({
      name: 'sundayCardRows',
      title: 'This Sunday card rows',
      type: 'array',
      description:
        'The short lines shown on the home page “This Sunday” card. Keep these brief. Drag to reorder.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'sundayCardRow',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              description: 'e.g. "Kids & Students"',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'value',
              title: 'Text',
              type: 'string',
              description: 'e.g. "Both services"',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'href',
              title: 'Link',
              type: 'url',
              description: 'Optional. Makes this row a link.',
              validation: (Rule) =>
                Rule.uri({ scheme: ['https', 'http'], allowRelative: true }),
            }),
          ],
          preview: { select: { title: 'label', subtitle: 'value' } },
        }),
      ],
      initialValue: [
        {
          _type: 'sundayCardRow',
          _key: 'kids-students',
          label: 'Kids & Students',
          value: 'Both services',
        },
        {
          _type: 'sundayCardRow',
          _key: 'address',
          label: 'Address',
          value: '15759 San Pedro Ave, San Antonio, TX 78232',
          href: 'https://maps.app.goo.gl/o7uWJUWy6KxYDraX7',
        },
        {
          _type: 'sundayCardRow',
          _key: 'watch-live',
          label: 'Can’t make it?',
          value: 'Watch live',
          href: 'https://live.crosswaysa.org/',
        },
      ],
    }),
    defineField({
      name: 'announcement',
      title: 'Announcement banner',
      type: 'object',
      description:
        'An optional message shown across the site. Turn it off when it is no longer needed.',
      options: { collapsible: true, collapsed: false },
      initialValue: { enabled: false },
      fields: [
        defineField({
          name: 'enabled',
          title: 'Show the announcement',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'text',
          title: 'Message',
          type: 'string',
          description: 'Keep it to one short sentence.',
          validation: (Rule) =>
            Rule.custom((value, context) => {
              const parent = context.parent as
                { enabled?: boolean } | undefined;
              return parent?.enabled && !value
                ? 'Enter the message to show, or turn the announcement off.'
                : true;
            }),
        }),
        defineField({
          name: 'href',
          title: 'Link',
          type: 'url',
          description: 'Optional. Where the message should link to.',
          validation: (Rule) =>
            Rule.uri({ scheme: ['https', 'http'], allowRelative: true }),
        }),
      ],
    }),
    defineField({
      name: 'showEntrustedOnHome',
      title: 'Show the Entrusted section on the home page',
      type: 'boolean',
      initialValue: true,
    }),
  ],
  preview: { prepare: () => ({ title: 'Site Settings' }) },
});
