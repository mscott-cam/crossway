import { parse } from 'csv-parse/sync';
import {
  USAGE,
  commitInBatches,
  formatReport,
  parseArgs,
  type Mutation,
  type TransactionLike,
} from './import-cli';
import {
  parseColumnMap,
  transformRows,
  type ColumnOverrides,
  type Row,
  type SeriesDoc,
} from './webflow-transform';

export type ImportClient = {
  fetch(query: string, params: { ids: string[] }): Promise<string[]>;
  assets: {
    upload(
      type: 'image',
      body: Buffer,
      options: { filename: string; contentType?: string },
    ): Promise<{ _id: string }>;
  };
  transaction(): TransactionLike;
};

export type ImportDeps = {
  env: Record<string, string | undefined>;
  readText(path: string): string;
  createClient(config: {
    projectId: string;
    dataset: string;
    token: string;
    apiVersion: string;
    useCdn: boolean;
  }): ImportClient;
  fetchImage(url: string): Promise<{ data: Buffer; contentType?: string }>;
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  batchSize?: number;
};

const API_VERSION = '2025-02-19';
const BATCH_SIZE = 100;
const EXISTS_QUERY = '*[_id in $ids]._id';
const EXISTS_CHUNK = 300;

function readCsv(deps: ImportDeps, path: string): Row[] {
  let text: string;
  try {
    text = deps.readText(path);
  } catch {
    throw new Error(`Cannot read ${path}`);
  }
  return parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  });
}

async function findExisting(
  client: ImportClient,
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += EXISTS_CHUNK)
    for (const id of await client.fetch(EXISTS_QUERY, {
      ids: ids.slice(i, i + EXISTS_CHUNK),
    }))
      found.add(id);
  return found;
}

async function uploadArtwork(
  client: ImportClient,
  deps: ImportDeps,
  series: SeriesDoc[],
): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  const urls = [
    ...new Set(series.flatMap((s) => (s.artworkUrl ? [s.artworkUrl] : []))),
  ];
  for (const url of urls) {
    try {
      const { data, contentType } = await deps.fetchImage(url);
      const filename = decodeURIComponent(
        new URL(url).pathname.split('/').pop() ?? 'artwork',
      );
      const asset = await client.assets.upload('image', data, {
        filename,
        contentType,
      });
      assets.set(url, asset._id);
      deps.log(`Uploaded ${filename}`);
    } catch (error) {
      deps.warn(
        `Artwork not uploaded (${url}): ${(error as Error).message}. It will not be added on a default-mode rerun; add it in the Studio or use --overwrite.`,
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

function countLine(
  label: string,
  ids: string[],
  existing: Set<string>,
  overwrite: boolean,
) {
  const already = ids.filter((id) => existing.has(id)).length;
  const created = ids.length - already;
  return overwrite
    ? `  ${label}: ${created} created, ${already} replaced`
    : `  ${label}: ${created} created, ${already} already existed (left untouched)`;
}

export async function runImport(
  argv: string[],
  deps: ImportDeps,
): Promise<number> {
  const args = parseArgs(argv);
  if (args.errors.length) {
    deps.error([...args.errors, USAGE].join('\n'));
    return 1;
  }
  const mode = args.overwrite ? 'createOrReplace' : 'createIfNotExists';

  if (args.overwrite && !args.yes && !args.dryRun) {
    deps.error(
      '--overwrite replaces whole documents with the imported data and erases any edits made in the Studio (speaker roles, series artwork, audio links, fixed books and speakers, descriptions). Add --yes to confirm, or omit --overwrite for the default non-destructive mode.',
    );
    return 1;
  }

  let result;
  try {
    let overrides: ColumnOverrides = {};
    if (args.map) {
      try {
        overrides = parseColumnMap(JSON.parse(deps.readText(args.map)));
      } catch (error) {
        throw new Error(
          `Cannot use column map ${args.map}: ${(error as Error).message}`,
        );
      }
    }
    result = transformRows(
      readCsv(deps, args.sermons!),
      readCsv(deps, args.series!),
      overrides,
    );
  } catch (error) {
    deps.error((error as Error).message);
    return 1;
  }
  deps.log(formatReport(result));

  if (args.dryRun) {
    deps.log(
      `\nWrite mode would be ${mode}${
        args.overwrite
          ? ' (replaces whole documents; a real run also needs --yes)'
          : ' (documents that already exist are left untouched)'
      }.\nDry run: nothing was written.`,
    );
    return 0;
  }

  const token = deps.env.SANITY_API_WRITE_TOKEN;
  const projectId = deps.env.SANITY_PROJECT_ID;
  const dataset = deps.env.SANITY_DATASET || 'production';
  if (!token || !projectId) {
    deps.error(
      '\nNot writing: set SANITY_API_WRITE_TOKEN and SANITY_PROJECT_ID (and optionally SANITY_DATASET, default "production"), or use --dry-run.',
    );
    return 1;
  }
  if (!result.sermons.length) {
    deps.error(
      '\nNot writing: no sermons were produced. Check the problems above.',
    );
    return 1;
  }

  const client = deps.createClient({
    projectId,
    dataset,
    token,
    apiVersion: API_VERSION,
    useCdn: false,
  });
  const batchSize = deps.batchSize ?? BATCH_SIZE;
  let written = 0;
  const total =
    result.speakers.length + result.series.length + result.sermons.length;

  try {
    deps.log(`\nWriting to ${projectId}/${dataset} using ${mode}`);
    const existing = await findExisting(client, [
      ...result.speakers.map((d) => d._id),
      ...result.series.map((d) => d._id),
      ...result.sermons.map((d) => d._id),
    ]);
    const wantsArtwork = result.series.filter(
      (s) => args.overwrite || !existing.has(s._id),
    );
    const assets = await uploadArtwork(client, deps, wantsArtwork);
    const docs: Mutation[] = [
      ...result.speakers,
      ...result.series.map((s) =>
        wantsArtwork.includes(s)
          ? toSanitySeries(s, assets)
          : stripTransient(s),
      ),
      ...result.sermons,
    ];

    await commitInBatches(client, docs, batchSize, mode, (n, t) => {
      written = n;
      deps.log(`Wrote ${n}/${t} documents`);
    });

    deps.log('\nSummary:');
    deps.log(
      countLine(
        'speakers',
        result.speakers.map((d) => d._id),
        existing,
        args.overwrite,
      ),
    );
    deps.log(
      countLine(
        'series',
        result.series.map((d) => d._id),
        existing,
        args.overwrite,
      ),
    );
    deps.log(
      countLine(
        'sermons',
        result.sermons.map((d) => d._id),
        existing,
        args.overwrite,
      ),
    );
    deps.log('Done.');
    return 0;
  } catch (error) {
    deps.error(
      `\nImport failed after writing ${written} of ${total} documents: ${(error as Error).message}\nRe-run the same command (without --overwrite) to resume: documents that were already written are left untouched.`,
    );
    return 1;
  }
}

function stripTransient(doc: SeriesDoc) {
  const { artworkUrl, ...rest } = doc;
  return rest;
}
