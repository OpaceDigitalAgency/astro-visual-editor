import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(root, file) {
  return JSON.parse(await readFile(join(root, file), 'utf8'));
}

async function requireText(root, file, expected) {
  const contents = await readFile(join(root, file), 'utf8');
  if (!contents.includes(expected)) {
    throw new Error(`${file} must contain ${JSON.stringify(expected)}.`);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} is ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`);
  }
}

export async function checkReleaseCandidate(requestedChannel, options = {}) {
  const root = options.root ?? repositoryRoot;
  const packagePath = 'packages/astro-visual-editor/package.json';
  const packageJson = await readJson(root, packagePath);
  const demoJson = await readJson(root, 'demo/package.json');
  const packageLock = await readJson(root, 'package-lock.json');
  const fixtures = await readJson(root, 'scripts/release-fixtures.json');
  const inferredChannel = packageJson.version.includes('-') ? 'beta' : 'latest';
  const channel = requestedChannel ?? inferredChannel;

  if (!['beta', 'latest'].includes(channel)) {
    throw new Error('Channel must be beta or latest.');
  }
  requireEqual(channel, inferredChannel, `Release channel for ${packageJson.version}`);
  requireEqual(
    demoJson.dependencies?.[packageJson.name],
    packageJson.version,
    `demo/package.json dependency on ${packageJson.name}`,
  );
  requireEqual(
    packageLock.packages?.demo?.dependencies?.[packageJson.name],
    packageJson.version,
    `package-lock.json demo dependency on ${packageJson.name}`,
  );

  await requireText(root, 'CHANGELOG.md', `## ${packageJson.version}`);
  await requireText(root, 'packages/astro-visual-editor/README.md', packageJson.name);

  for (const [file, expectedHash] of Object.entries(fixtures.files ?? {})) {
    const contents = await readFile(join(root, file));
    const actualHash = createHash('sha256').update(contents).digest('hex');
    requireEqual(actualHash, expectedHash, `${file} release-fixture hash`);
  }

  console.log(
    `Fast release-candidate check passed for ${packageJson.name}@${packageJson.version} (${channel}).`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  await checkReleaseCandidate(process.argv[2]);
}
