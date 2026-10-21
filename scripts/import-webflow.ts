import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { createClient, type SanityClient } from '@sanity/client';
import {
  USAGE,
  commitInBatches,
  formatReport,
  parseArgs,
} from './lib/import-cli';
import {
  transformRows,
  type Row,
  type SeriesDoc,
} from './lib/webflow-transform';

const API_VERSION = '2025-02-19';
const BATCH_SIZE = 100;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readCsv(path: string): Row[] {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return fail(`Cannot read ${path}`);
  }
  return parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });
}

async function uploadArtwork(
  client: SanityClient,
  series: SeriesDoc[],
): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  const urls = [
    ...new Set(series.flatMap((s) => (s.artworkUrl ? [s.artworkUrl] : []))),
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const filename = decodeURIComponent(
        new URL(url).pathname.split('/').pop() ?? 'artwork',
      );
      const asset = await client.assets.upload(
        'image',
        Buffer.from(await res.arrayBuffer()),
        { filename, contentType: res.headers.get('content-type') ?? undefined },
      );
      assets.set(url, asset._id);
      console.log(`Uploaded ${filename}`);
    } catch (error) {
      console.warn(
        `Artwork not uploaded (${url}): ${(error as Error).message}`,
      );
    }
  }
  return assets;
}

function toSanitySeries(doc: SeriesDoc, assets: Map<string, string>) {
  const { artworkUrl, ...rest } = doc;
  const assetId = artworkUrl ? assets.get(artworkUrl) : undefined;
  return assetId
    ? {
        ...rest,
        artwork: {
          _type: 'image',
          asset: { _type: 'reference', _ref: assetId },
        },
      }
    : rest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.errors.length) fail([...args.errors, USAGE].join('\n'));

  const result = transformRows(readCsv(args.sermons!), readCsv(args.series!));
  console.log(formatReport(result));

  if (args.dryRun) {
    console.log('\nDry run: nothing was written.');
    return;
  }

  const token = process.env.SANITY_API_WRITE_TOKEN;
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || 'production';
  if (!token || !projectId)
    fail(
      '\nNot writing: set SANITY_API_WRITE_TOKEN and SANITY_PROJECT_ID (and optionally SANITY_DATASET, default "production"), or use --dry-run.',
    );
  if (!result.sermons.length)
    fail('\nNot writing: no sermons were produced. Check the problems above.');

  const client = createClient({
    projectId,
    dataset,
    token,
    apiVersion: API_VERSION,
    useCdn: false,
  });

  console.log(`\nWriting to ${projectId}/${dataset}`);
  const assets = await uploadArtwork(client, result.series);
  const docs = [
    ...result.speakers,
    ...result.series.map((s) => toSanitySeries(s, assets)),
    ...result.sermons,
  ];

  await commitInBatches(client, docs, BATCH_SIZE, (written, total) =>
    console.log(`Wrote ${written}/${total} documents`),
  );
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
