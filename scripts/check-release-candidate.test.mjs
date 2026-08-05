import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReleaseCandidate } from './check-release-candidate.mjs';

const packageName = '@opacedev/astro-visual-editor';
const version = '0.1.0-beta.9';

async function writeJson(root, file, value) {
  const target = join(root, file);
  await mkdir(join(target, '..'), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function makeCandidate() {
  const root = await mkdtemp(join(tmpdir(), 'release-candidate-test-'));
  const fixture = 'demo/src/pages/index.astro';
  const fixtureContents = '<h1>Canonical release fixture</h1>\n';
  const fixtureHash = createHash('sha256').update(fixtureContents).digest('hex');

  await writeJson(root, 'packages/astro-visual-editor/package.json', {
    name: packageName,
    version,
  });
  await writeJson(root, 'demo/package.json', {
    dependencies: { [packageName]: version },
  });
  await writeJson(root, 'package-lock.json', {
    packages: { demo: { dependencies: { [packageName]: version } } },
  });
  await writeJson(root, 'scripts/release-fixtures.json', {
    files: { [fixture]: fixtureHash },
  });
  await mkdir(join(root, 'demo/src/pages'), { recursive: true });
  await writeFile(join(root, fixture), fixtureContents);
  await writeFile(join(root, 'CHANGELOG.md'), `## ${version}\n`);
  await writeFile(join(root, '<removed internal document>'), `Version \`${version}\`\n`);
  await writeFile(
    join(root, '<removed internal document>'),
    `**Current public version:** \`${packageName}@${version}\`\n`,
  );

  return { root, fixture };
}

test('accepts a synchronised canonical release candidate', async () => {
  const { root } = await makeCandidate();
  try {
    await checkReleaseCandidate('beta', { root });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects the stale demo dependency that delayed Beta 4', async () => {
  const { root } = await makeCandidate();
  try {
    await writeJson(root, 'demo/package.json', {
      dependencies: { [packageName]: '0.1.0-beta.8' },
    });
    await assert.rejects(
      checkReleaseCandidate('beta', { root }),
      /demo\/package\.json dependency.*beta\.8.*beta\.9/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a localhost-modified canonical demo fixture', async () => {
  const { root, fixture } = await makeCandidate();
  try {
    await writeFile(join(root, fixture), '<h1>Changed during localhost testing</h1>\n');
    await assert.rejects(checkReleaseCandidate('beta', { root }), /release-fixture hash/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
