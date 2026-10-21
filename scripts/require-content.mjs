import { checkBuildEnv } from '../src/lib/ops/build-guard.ts';

export function requireContent(env = process.env) {
  return {
    name: 'require-content',
    hooks: {
      'astro:config:setup': ({ command, logger }) => {
        if (command !== 'build') return;
        const result = checkBuildEnv(env);
        if (!result.ok) throw new Error(result.message);
        if ('warning' in result) logger.warn(result.warning);
      },
    },
  };
}
