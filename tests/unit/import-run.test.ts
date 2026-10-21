import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  runImport,
  type ImportClient,
  type ImportDeps,
} from '../../scripts/lib/run-import';

const SERMONS = 'tests/fixtures/webflow/sermons.sample.csv';
const SERIES = 'tests/fixtures/webflow/series.sample.csv';
const BASE = ['--sermons', SERMONS, '--series', SERIES];
const ENV = {
  SANITY_API_WRITE_TOKEN: 'tok',
  SANITY_PROJECT_ID: 'proj',
};

type Op = { op: string; doc: Record<string, any> };

function setup(
  opts: {
    existing?: string[];
    env?: Record<string, string | undefined>;
    failCommitAt?: number;
    failImages?: boolean;
    batchSize?: number;
  } = {},
) {
  const existing = new Set(opts.existing ?? []);
  const transactions: Op[][] = [];
  const queries: { ids: string[] }[] = [];
  const uploads: string[] = [];
  const fetched: string[] = [];
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  let commits = 0;

  const client: ImportClient = {
    async fetch(_query, params) {
      queries.push({ ids: params.ids });
      return params.ids.filter((id) => existing.has(id));
    },
    assets: {
      async upload(_type, _body, options) {
        uploads.push(options.filename);
        return { _id: `image-${options.filename}` };
      },
    },
    transaction() {
      const ops: Op[] = [];
      const tx = {
        createIfNotExists(doc: Record<string, any>) {
          ops.push({ op: 'createIfNotExists', doc });
          return tx;
        },
        createOrReplace(doc: Record<string, any>) {
          ops.push({ op: 'createOrReplace', doc });
          return tx;
        },
        async commit() {
          commits++;
          if (opts.failCommitAt === commits) throw new Error('network down');
          transactions.push(ops);
        },
      };
      return tx;
    },
  };

  const createClient = vi.fn((_config: Record<string, unknown>) => client);
  const deps: ImportDeps = {
    env: opts.env ?? ENV,
    readText: (path) => readFileSync(path, 'utf8'),
    createClient,
    fetchImage: async (url) => {
      fetched.push(url);
      if (opts.failImages) throw new Error('timeout');
      return { data: Buffer.from('x'), contentType: 'image/png' };
    },
    log: (m) => logs.push(m),
    warn: (m) => warns.push(m),
    error: (m) => errors.push(m),
    batchSize: opts.batchSize,
  };

  const run = (args: string[]) => runImport([...BASE, ...args], deps);
  const ops = () => transactions.flat();
  return {
    run,
    createClient,
    transactions,
    ops,
    queries,
    uploads,
    fetched,
    logs,
    warns,
    errors,
    all: () => [...logs, ...warns, ...errors].join('\n'),
  };
}

describe('default mode', () => {
  it('emits createIfNotExists and never createOrReplace', async () => {
    const t = setup();
    expect(await t.run([])).toBe(0);
    const ops = t.ops();
    expect(ops).toHaveLength(32);
    expect(ops.every((o) => o.op === 'createIfNotExists')).toBe(true);
    expect(t.all()).toMatch(/createIfNotExists/);
  });

  it('writes speakers, then series, then sermons', async () => {
    const t = setup();
    await t.run([]);
    const types = t.ops().map((o) => o.doc._type);
    expect(types.lastIndexOf('speaker')).toBeLessThan(types.indexOf('series'));
    expect(types.lastIndexOf('series')).toBeLessThan(types.indexOf('sermon'));
  });

  it('checks existing ids with a single query and uses the default dataset', async () => {
    const t = setup();
    await t.run([]);
    expect(t.queries).toHaveLength(1);
    expect(t.queries[0].ids).toHaveLength(32);
    expect(t.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj', dataset: 'production' }),
    );
  });

  it('reports created versus already existing per type', async () => {
    const t = setup({
      existing: [
        'speaker-josh-de-koning',
        'series-acts',
        'sermon-christmas-transforms',
        'sermon-getting-it-right',
      ],
    });
    expect(await t.run([])).toBe(0);
    const out = t.all();
    expect(out).toContain('speakers: 5 created, 1 already existed');
    expect(out).toContain('series: 8 created, 1 already existed');
    expect(out).toContain('sermons: 15 created, 2 already existed');
  });
});

describe('artwork', () => {
  it('is requested only for series that do not exist yet', async () => {
    const t = setup({ existing: ['series-acts', 'series-isaiah'] });
    await t.run([]);
    expect(t.fetched.some((u) => u.includes('Isaiah'))).toBe(false);
    expect(t.fetched.some((u) => u.includes('sgmssxwrzmm327'))).toBe(false);
    expect(t.fetched.some((u) => u.includes('lvpiqdxd9ajrvr'))).toBe(true);
    expect(new Set(t.fetched).size).toBe(t.fetched.length);
  });

  it('references uploaded assets only on series that were created', async () => {
    const t = setup({ existing: ['series-acts'] });
    await t.run([]);
    const series = t.ops().filter((o) => o.doc._type === 'series');
    const iPeter = series.find((o) => o.doc._id === 'series-i-peter')!;
    expect(iPeter.doc.artwork.asset._ref).toMatch(/^image-/);
    expect(iPeter.doc).not.toHaveProperty('artworkUrl');
    const ruth = series.find((o) => o.doc._id === 'series-ruth')!;
    expect(ruth.doc).not.toHaveProperty('artwork');
  });

  it('warns on a failed image and never writes an artwork field', async () => {
    const t = setup({ failImages: true });
    expect(await t.run([])).toBe(0);
    expect(t.warns.length).toBeGreaterThan(0);
    for (const o of t.ops().filter((o) => o.doc._type === 'series'))
      expect(o.doc).not.toHaveProperty('artwork');
    expect(t.ops()).toHaveLength(32);
  });
});

describe('--overwrite', () => {
  it('refuses without --yes and writes nothing', async () => {
    const t = setup();
    expect(await t.run(['--overwrite'])).toBe(1);
    expect(t.errors.join('\n')).toMatch(/--yes/);
    expect(t.errors.join('\n')).toMatch(/replaces whole documents/i);
    expect(t.errors.join('\n')).toMatch(/erases/i);
    expect(t.createClient).not.toHaveBeenCalled();
    expect(t.fetched).toHaveLength(0);
    expect(t.ops()).toHaveLength(0);
  });

  it('emits createOrReplace with --yes and uploads artwork for every series', async () => {
    const t = setup({ existing: ['series-acts'] });
    expect(await t.run(['--overwrite', '--yes'])).toBe(0);
    const ops = t.ops();
    expect(ops).toHaveLength(32);
    expect(ops.every((o) => o.op === 'createOrReplace')).toBe(true);
    expect(t.fetched.some((u) => u.includes('sgmssxwrzmm327'))).toBe(true);
    expect(t.all()).toMatch(/createOrReplace/);
    expect(t.all()).toContain('series: 8 created, 1 replaced');
  });
});

describe('safety', () => {
  it('a real run without a token exits non-zero, explains, and writes nothing', async () => {
    const t = setup({ env: { SANITY_PROJECT_ID: 'proj' } });
    expect(await t.run([])).toBe(1);
    expect(t.errors.join('\n')).toMatch(/SANITY_API_WRITE_TOKEN/);
    expect(t.createClient).not.toHaveBeenCalled();
    expect(t.ops()).toHaveLength(0);
    expect(t.fetched).toHaveLength(0);
  });

  it('a real run without a project id exits non-zero', async () => {
    const t = setup({ env: { SANITY_API_WRITE_TOKEN: 'tok' } });
    expect(await t.run([])).toBe(1);
    expect(t.errors.join('\n')).toMatch(/SANITY_PROJECT_ID/);
    expect(t.createClient).not.toHaveBeenCalled();
  });

  it('a dry run needs no token, makes no client, and states the mode', async () => {
    const t = setup({ env: {} });
    expect(await t.run(['--dry-run'])).toBe(0);
    expect(t.createClient).not.toHaveBeenCalled();
    expect(t.fetched).toHaveLength(0);
    expect(t.all()).toContain('17 sermons');
    expect(t.all()).toMatch(/createIfNotExists/);
    expect(t.all()).toMatch(/nothing was written/i);
  });

  it('a dry run with --overwrite states the destructive mode', async () => {
    const t = setup({ env: {} });
    expect(await t.run(['--dry-run', '--overwrite'])).toBe(0);
    expect(t.all()).toMatch(/createOrReplace/);
  });

  it('exits non-zero on bad arguments', async () => {
    const t = setup();
    expect(
      await runImport(['--dry-run'], {
        ...({} as ImportDeps),
        error: (m) => t.errors.push(m),
      }),
    ).toBe(1);
    expect(t.errors.join('\n')).toMatch(/--sermons/);
  });

  it('reports a missing CSV file without a stack trace', async () => {
    const t = setup();
    const code = await runImport(
      ['--sermons', 'nope.csv', '--series', SERIES, '--dry-run'],
      {
        ...({
          env: {},
          readText: (p: string) => readFileSync(p, 'utf8'),
        } as ImportDeps),
        log: () => {},
        warn: () => {},
        error: (m) => t.errors.push(m),
      },
    );
    expect(code).toBe(1);
    expect(t.errors.join('\n')).toMatch(/nope\.csv/);
  });

  it('on a mid-run failure says how much was written and that rerunning resumes', async () => {
    const t = setup({ batchSize: 10, failCommitAt: 2 });
    expect(await t.run([])).toBe(1);
    expect(t.transactions).toHaveLength(1);
    const message = t.errors.join('\n');
    expect(message).toContain('10 of 32');
    expect(message).toMatch(/re-?run/i);
    expect(message).toMatch(/resume/i);
    expect(message).toContain('network down');
  });
});
