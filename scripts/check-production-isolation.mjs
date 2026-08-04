import { readdir, readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const outputRoot = resolve('demo/dist');
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt']);
const forbiddenRuntimeMarkers = [
  'astro-visual-editor:config',
  'astro-visual-editor:save',
  'astro-visual-editor:receipt',
  'astro-visual-editor:revert',
  'Editing is disabled until the CSS selector configuration is fixed',
  'Connected. Changes remain local until committed.',
];

async function filesWithin(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesWithin(path) : [path];
    }),
  );
  return nested.flat();
}

let files;
try {
  files = await filesWithin(outputRoot);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Production output is unavailable at ${outputRoot}: ${detail}`);
}

for (const file of files) {
  if (!textExtensions.has(extname(file))) continue;
  const contents = await readFile(file, 'utf8');
  const marker = forbiddenRuntimeMarkers.find((candidate) => contents.includes(candidate));
  if (marker) {
    throw new Error(`Editor runtime marker ${JSON.stringify(marker)} leaked into ${file}.`);
  }
}

console.log(`Production isolation verified across ${files.length} generated files.`);
