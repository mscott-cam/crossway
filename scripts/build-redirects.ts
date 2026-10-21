export interface SermonLegacyPath {
  webflowPath?: string;
  slug: string;
}

export interface RedirectEntry {
  source: string;
  destination: string;
  permanent: true;
}

export interface AstroRedirect {
  status: 301;
  destination: string;
}

interface BuildOptions {
  max?: number;
  warn?: (message: string) => void;
}

export const MAX_REDIRECTS = 2000;

const STATIC_REDIRECTS: RedirectEntry[] = [
  { source: '/connect', destination: '/visit', permanent: true },
];

const SERMON_PATH = /^\/sermons\/[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

const RESERVED_SOURCES = new Set([
  '/',
  '/sermons',
  '/sermons/archive',
  '/sermons/book',
  '/sermons/filter',
  '/sermons/speaker',
  '/series',
  '/visit',
  '/events',
]);

const stripTrailingSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, '') : path;

export function buildRedirects(
  sermons: SermonLegacyPath[],
  { max = MAX_REDIRECTS, warn = () => {} }: BuildOptions = {},
): RedirectEntry[] {
  const entries = [...STATIC_REDIRECTS];
  const taken = new Set(entries.map((e) => e.source));
  const livePaths = new Set(sermons.map((s) => `/sermons/${s.slug}`));
  let capped = false;

  for (const { slug, webflowPath } of sermons) {
    if (!webflowPath) continue;
    const destination = `/sermons/${slug}`;
    const source = stripTrailingSlash(webflowPath);
    if (source === destination) continue;

    const reason = !SERMON_PATH.test(source)
      ? 'is not a single safe sermon path'
      : !SERMON_PATH.test(destination)
        ? 'has an unsafe destination'
        : RESERVED_SOURCES.has(source)
          ? 'collides with a static route'
          : livePaths.has(source)
            ? 'is the live URL of another sermon'
            : taken.has(source)
              ? undefined
              : null;
    if (reason === undefined) continue;
    if (reason !== null) {
      warn(`[redirects] skipped ${webflowPath} -> ${destination}: ${reason}`);
      continue;
    }
    if (entries.length >= max) {
      capped = true;
      continue;
    }
    taken.add(source);
    entries.push({ source, destination, permanent: true });
  }

  if (capped) {
    warn(`[redirects] reached the cap of ${max} entries; some were dropped`);
  }
  return entries;
}

export function toAstroRedirects(
  entries: RedirectEntry[],
): Record<string, AstroRedirect> {
  return Object.fromEntries(
    entries.map((e) => [e.source, { status: 301, destination: e.destination }]),
  );
}

export async function loadAstroRedirects(
  loadSermons: () => Promise<SermonLegacyPath[]>,
  warn: (message: string) => void = console.warn,
): Promise<Record<string, AstroRedirect>> {
  let sermons: SermonLegacyPath[] = [];
  try {
    sermons = await loadSermons();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warn(
      `[redirects] could not load sermons (${message}); using static redirects only`,
    );
  }
  return toAstroRedirects(buildRedirects(sermons, { warn }));
}
