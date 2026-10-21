export function sermonSlug(title: string, date: string): string {
  const slugTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return [slugTitle, date].filter(Boolean).join('-');
}
