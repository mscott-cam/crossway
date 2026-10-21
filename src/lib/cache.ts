import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const SAFE_KEY = /^[a-z0-9][a-z0-9._-]*$/i;

function cacheDir(): string {
  const override = process.env.CROSSWAY_CACHE_DIR;
  return override
    ? override
    : join(process.cwd(), 'node_modules', '.cache', 'crossway');
}

export function readCache<T>(key: string): T | undefined {
  if (!SAFE_KEY.test(key)) return undefined;
  try {
    return JSON.parse(
      readFileSync(join(cacheDir(), `${key}.json`), 'utf8'),
    ) as T;
  } catch {
    return undefined;
  }
}

export function writeCache(key: string, value: unknown): void {
  if (!SAFE_KEY.test(key)) return;
  let temp: string | undefined;
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return;
    const dir = cacheDir();
    mkdirSync(dir, { recursive: true });
    temp = join(dir, `.${key}.${process.pid}.${Date.now()}.tmp`);
    writeFileSync(temp, json);
    renameSync(temp, join(dir, `${key}.json`));
  } catch {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}
