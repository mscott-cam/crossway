import type { StructureResolver } from 'sanity/structure';

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Sermons')
        .child(
          S.documentTypeList('sermon')
            .title('Sermons')
            .defaultOrdering([{ field: 'date', direction: 'desc' }]),
        ),
      S.documentTypeListItem('series').title('Series'),
      S.documentTypeListItem('speaker').title('Speakers'),
      S.documentTypeListItem('leader').title('Leaders'),
      S.divider(),
      S.listItem()
        .title('Site Settings')
        .child(
          S.document()
            .schemaType('siteSettings')
            .documentId('siteSettings')
            .title('Site Settings'),
        ),
    ]);
