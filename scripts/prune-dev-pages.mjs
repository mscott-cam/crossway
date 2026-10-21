import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

export function pruneDevPages() {
  let root = process.cwd();
  return {
    name: 'prune-dev-pages',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root);
      },
      'astro:build:done': async ({ dir, logger }) => {
        const outputs = [
          fileURLToPath(dir),
          resolve(root, '.vercel/output/static'),
        ];
        for (const output of outputs) {
          const target = join(output, 'dev');
          if (existsSync(target)) {
            await rm(target, { recursive: true, force: true });
            logger.info(`removed ${target}`);
          }
        }
      },
    },
  };
}
