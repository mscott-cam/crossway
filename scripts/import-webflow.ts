import { readFileSync } from 'node:fs';
import { createClient } from '@sanity/client';
import { runImport, type ImportClient } from './lib/run-import';

const IMAGE_TIMEOUT_MS = 20000;

runImport(process.argv.slice(2), {
  env: process.env,
  readText: (path) => readFileSync(path, 'utf8'),
  createClient: (config) => createClient(config) as unknown as ImportClient,
  fetchImage: async (url) => {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {
      data: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? undefined,
    };
  },
  log: (message) => console.log(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
})
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
