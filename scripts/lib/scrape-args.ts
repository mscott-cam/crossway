export const DEFAULT_BASE = 'https://crosswaysa.org';

export type ScrapeArgs = { path: string; out?: string; base?: string };

const USAGE = 'usage: scrape-pages.ts <path> [--out <file>] [--base <url>]';

export function pageUrl(path: string, base: string = DEFAULT_BASE): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function parseScrapeArgs(argv: string[]): ScrapeArgs {
  let path: string | undefined;
  let out: string | undefined;
  let base: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--out' || arg === '--base') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} needs a value. ${USAGE}`);
      }
      if (arg === '--out') out = value;
      else base = value;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}. ${USAGE}`);
    } else if (path === undefined) {
      path = arg;
    } else {
      throw new Error(USAGE);
    }
  }
  if (!path) throw new Error(USAGE);
  return { path, ...(out ? { out } : {}), ...(base ? { base } : {}) };
}
