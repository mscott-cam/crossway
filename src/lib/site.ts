export type NavItem = {
  label: string;
  href?: string;
  external?: boolean;
  children?: NavItem[];
};

export const site = {
  name: 'Crossway Bible Church',
  address: {
    street: '15759 San Pedro Ave',
    city: 'San Antonio',
    region: 'TX',
    postalCode: '78232',
  },
  mapsUrl: 'https://maps.app.goo.gl/o7uWJUWy6KxYDraX7',
  links: {
    give: 'https://pushpay.com/g/crosswaysa?src=hpp',
    live: 'https://live.crosswaysa.org/',
    bookstore: 'https://us.10ofthose.com/partners/crosswaysa',
    espanol: 'https://crossway-espanol.webflow.io/',
    churchCenter: 'https://crosswaysa.churchcenter.com/home',
    registrations: 'https://crosswaysa.churchcenter.com/registrations',
    facebook: 'https://www.facebook.com/CrosswayBibleChurchSA',
    instagram: 'https://www.instagram.com/crosswaybiblechurchsa/',
    applePodcasts:
      'https://podcasts.apple.com/us/podcast/crossway-bible-church-sermons/id1353947938',
    spreakerShow: 'https://www.spreaker.com/show/2817602',
    spreakerFeed: 'https://www.spreaker.com/show/2817602/episodes/feed',
  },
  fallbackServiceTimes: ['9:00', '10:45'],
} as const;

export const nav: NavItem[] = [
  { label: 'Connect', href: '/visit' },
  { label: 'Culture', href: '/culture' },
  {
    label: 'About Us',
    children: [
      { label: 'Our Leadership', href: '/who-we-are' },
      { label: 'Our Beliefs', href: '/what-we-believe' },
      { label: 'Child Safety', href: '/child-safety' },
      { label: 'Networks', href: '/networks' },
    ],
  },
  {
    label: 'Church Life',
    children: [
      { label: 'Small Groups', href: '/small-groups' },
      { label: 'Students', href: '/students' },
      { label: 'Kids', href: '/crossway-kids' },
      { label: 'Biblical Counseling', href: '/biblical-counseling' },
      { label: 'Español', href: site.links.espanol, external: true },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Sermons', href: '/sermons' },
      { label: 'Sunday Live', href: site.links.live, external: true },
      { label: 'Bookstore', href: site.links.bookstore, external: true },
    ],
  },
  { label: 'Events', href: '/events' },
  { label: 'Give', href: site.links.give, external: true },
];
