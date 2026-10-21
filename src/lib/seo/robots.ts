export function robotsTxt(indexable: boolean, origin: string) {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /dev/',
  ];
  if (indexable) lines.push('', `Sitemap: ${origin}/sitemap-index.xml`);
  return `${lines.join('\n')}\n`;
}
