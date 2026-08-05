import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const packagePath = 'packages/astro-visual-editor/package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const [channel] = process.argv.slice(2);

if (!['beta', 'latest'].includes(channel)) {
  throw new Error('Usage: node scripts/release-preflight.mjs <beta|latest>');
}

const isPrerelease = packageJson.version.includes('-');
if ((isPrerelease && channel !== 'beta') || (!isPrerelease && channel !== 'latest')) {
  throw new Error(
    `Version ${packageJson.version} must publish to ${isPrerelease ? 'beta' : 'latest'}, not ${channel}.`,
  );
}

async function requireText(file, expected) {
  const contents = await readFile(file, 'utf8');
  if (!contents.includes(expected)) {
    throw new Error(`${file} must contain ${JSON.stringify(expected)} before release.`);
  }
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

await requireText('CHANGELOG.md', `## ${packageJson.version}`);
await requireText('PROJECT.md', `Version \`${packageJson.version}\``);
await requireText(
  'RELEASE_PLAN.md',
  `**Current public version:** \`${packageJson.name}@${packageJson.version}\``,
);

const status = await run('git', ['status', '--porcelain']);
if (status) {
  throw new Error(
    'Release preflight requires a clean Git worktree. Commit or deliberately remove every change first.',
  );
}

const tempRoot = await mkdtemp(join(tmpdir(), 'astro-visual-editor-release-'));
const packageDirectory = join(tempRoot, 'package');
const consumerDirectory = join(tempRoot, 'consumer');

try {
  await run('npm', ['run', 'build', '--workspace', packageJson.name]);
  await mkdir(packageDirectory, { recursive: true });
  await mkdir(join(consumerDirectory, 'src/pages'), { recursive: true });
  const packOutput = await run('npm', [
    'pack',
    '--workspace',
    packageJson.name,
    '--json',
    '--pack-destination',
    packageDirectory,
  ]);
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = resolve(packageDirectory, filename);

  await writeFile(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({ name: 'release-consumer-check', private: true, type: 'module' }, null, 2),
  );
  await writeFile(
    join(consumerDirectory, 'astro.config.mjs'),
    `import { defineConfig } from 'astro/config';\nimport visualEditor from '${packageJson.name}';\n\nexport default defineConfig({ integrations: [visualEditor()] });\n`,
  );
  await writeFile(join(consumerDirectory, 'src/pages/index.astro'), '<h1>Release consumer</h1>\n');

  await run(
    'npm',
    ['install', '--no-audit', '--no-fund', '--ignore-scripts', 'astro@7.1.6', tarball],
    { cwd: consumerDirectory },
  );
  await run('npx', ['--no-install', 'astro', 'build'], { cwd: consumerDirectory });
  console.log(`Clean tarball consumer build passed for ${basename(tarball)}.`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
