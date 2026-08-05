import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(repositoryRoot, 'scripts/release-fixtures.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

for (const file of Object.keys(manifest.files ?? {})) {
  const contents = await readFile(join(repositoryRoot, file));
  manifest.files[file] = createHash('sha256').update(contents).digest('hex');
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Captured the intentional canonical demo fixture hashes.');
