export function sermonSlug(title: string, date: string): string {
  const slugTitle = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return [slugTitle, date].filter(Boolean).join('-');
}
