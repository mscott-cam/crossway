import { site } from '../site';

const withSlash = (origin: string) => `${origin.replace(/\/$/, '')}/`;

export function churchJsonLd(origin: string): object {
  const base = withSlash(origin);
  return {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: site.name,
    url: base,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.city,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: 'US',
    },
    logo: new URL('icons/icon-512.png', base).href,
    image: new URL('og/default.jpg', base).href,
    sameAs: [site.links.facebook, site.links.instagram],
    hasMap: site.mapsUrl,
  };
}
