import { writeFileSync } from 'node:fs';
import { htmlToMarkdownDraft } from './lib/html-to-markdown';
import { pageUrl, parseScrapeArgs } from './lib/scrape-args';

const USER_AGENT =
  'Mozilla/5.0 (compatible; CrosswayMigration/1.0; +https://crosswaysa.org)';
const TIMEOUT_MS = 20000;

async function fetchHtml(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (error) {
    const reason =
      error instanceof Error
        ? ((error.cause as Error | undefined)?.message ?? error.message)
        : String(error);
    throw new Error(
      `Could not fetch ${url}: ${reason}. If the bare domain does not resolve, retry with --base https://www.crosswaysa.org`,
    );
  }
  if (!res.ok) throw new Error(`Could not fetch ${url}: HTTP ${res.status}`);
  return res.text();
}

async function main(): Promise<void> {
  const { path, out, base } = parseScrapeArgs(process.argv.slice(2));
  const url = pageUrl(path, base);
  const markdown = htmlToMarkdownDraft(await fetchHtml(url));
  if (!markdown) throw new Error(`No page content found at ${url}`);
  if (out) {
    writeFileSync(out, markdown);
    console.error(`Wrote draft for ${url} to ${out}`);
  } else {
    process.stdout.write(markdown);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
