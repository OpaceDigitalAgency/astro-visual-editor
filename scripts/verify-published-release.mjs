import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const [version, channel] = process.argv.slice(2);
const packageName = '@opacedev/astro-visual-editor';

if (!version || !['beta', 'latest'].includes(channel)) {
  throw new Error('Usage: node scripts/verify-published-release.mjs <version> <beta|latest>');
}

async function run(command, args, options = {}) {
  const result = await execFile(command, args, {
    cwd: options.cwd ?? process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.stdout.trim();
}

const publishedVersion = JSON.parse(
  await run('npm', ['view', `${packageName}@${version}`, 'version', '--json']),
);
if (publishedVersion !== version) {
  throw new Error(`npm returned ${publishedVersion}; expected ${version}.`);
}

const tags = JSON.parse(await run('npm', ['view', packageName, 'dist-tags', '--json']));
if (tags[channel] !== version) {
  throw new Error(`npm ${channel} tag is ${tags[channel] ?? 'missing'}; expected ${version}.`);
}

const integrity = JSON.parse(
  await run('npm', ['view', `${packageName}@${version}`, 'dist.integrity', '--json']),
);
if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) {
  throw new Error('Published package has no valid npm integrity value.');
}

const consumerDirectory = await mkdtemp(join(tmpdir(), 'astro-visual-editor-registry-'));
try {
  await mkdir(join(consumerDirectory, 'src/pages'), { recursive: true });
  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ name: 'registry-consumer-check', private: true, type: 'module' }, null, 2),
  );
  await writeFile(
    join(consumerDirectory, 'astro.config.mjs'),
    `import { defineConfig } from 'astro/config';\nimport visualEditor from '${packageName}';\n\nexport default defineConfig({ integrations: [visualEditor()] });\n`,
  );
  await writeFile(join(consumerDirectory, 'src/pages/index.astro'), '<h1>Registry consumer</h1>\n');

  await run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      'astro@7.1.6',
      `${packageName}@${version}`,
    ],
    { cwd: consumerDirectory },
  );
  await run('npx', ['--no-install', 'astro', 'build'], { cwd: consumerDirectory });
  console.log(`Registry consumer build passed for ${packageName}@${version}.`);
} finally {
  await rm(consumerDirectory, { recursive: true, force: true });
}
