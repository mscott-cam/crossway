import type { TransformResult } from './webflow-transform';

export type CliArgs = {
  sermons?: string;
  series?: string;
  map?: string;
  dryRun: boolean;
  overwrite: boolean;
  yes: boolean;
  errors: string[];
};

export const USAGE =
  'Usage: npx tsx scripts/import-webflow.ts --sermons <sermons.csv> --series <series.csv> [--map <columns.json>] [--dry-run] [--overwrite --yes]';

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    overwrite: false,
    yes: false,
    errors: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s, 2);
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--overwrite') {
      args.overwrite = true;
    } else if (flag === '--yes') {
      args.yes = true;
    } else if (
      flag === '--sermons' ||
      flag === '--series' ||
      flag === '--map'
    ) {
      const value = inline ?? argv[++i];
      if (!value || value.startsWith('--')) {
        args.errors.push(`${flag} needs a file path`);
        if (value?.startsWith('--')) i--;
      } else if (flag === '--sermons') args.sermons = value;
      else if (flag === '--series') args.series = value;
      else args.map = value;
    } else {
      args.errors.push(`Unknown argument ${argv[i]}`);
    }
  }
  if (!args.sermons && !args.errors.some((e) => e.startsWith('--sermons')))
    args.errors.push('Missing --sermons <csv>');
  if (!args.series && !args.errors.some((e) => e.startsWith('--series')))
    args.errors.push('Missing --series <csv>');
  return args;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1)
    throw new Error('chunk size must be a positive integer');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export function formatReport(result: TransformResult): string {
  const { stats, problems } = result;
  const lines = [
    `Sermons CSV: ${stats.sermonRows} rows, ${stats.skippedDraftOrArchived} draft/archived skipped, ${stats.skippedInvalid} skipped because of problems`,
    `Ready to import: ${stats.sermons} sermons (${stats.withoutBook} without a book, ${stats.withoutSpeaker} without a speaker), ${stats.series} series, ${stats.speakers} speakers`,
    '',
    `First ${Math.min(5, result.sermons.length)} transformed sermons:`,
    ...result.sermons.slice(0, 5).map((s) => JSON.stringify(s, null, 2)),
    '',
    `Problems (${problems.length}):`,
    ...(problems.length ? problems.map((p) => `  - ${p}`) : ['  none']),
  ];
  return lines.join('\n');
}

export type Mutation = { _id: string; _type: string };

export type TransactionLike = {
  createIfNotExists(doc: Mutation): TransactionLike;
  createOrReplace(doc: Mutation): TransactionLike;
  commit(): Promise<unknown>;
};

export async function commitInBatches(
  client: { transaction(): TransactionLike },
  docs: readonly Mutation[],
  size: number,
  mode: 'createIfNotExists' | 'createOrReplace',
  onBatch?: (written: number, total: number) => void,
): Promise<number> {
  let written = 0;
  for (const batch of chunk(docs, size)) {
    const tx = client.transaction();
    for (const doc of batch) tx[mode](doc);
    await tx.commit();
    written += batch.length;
    onBatch?.(written, docs.length);
  }
  return written;
}
