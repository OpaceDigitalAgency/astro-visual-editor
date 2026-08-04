import { rm, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const execute = promisify(execFile);

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await Promise.all([
  build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    sourcemap: true,
    external: ['astro'],
  }),
  build({
    entryPoints: ['src/toolbar.ts'],
    outfile: 'dist/toolbar.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    external: ['astro/toolbar'],
  }),
]);

await execute(process.execPath, [
  '../../node_modules/typescript/bin/tsc',
  '--project',
  'tsconfig.build.json',
]);

