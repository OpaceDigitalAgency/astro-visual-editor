import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { checkReleaseCandidate } from './check-release-candidate.mjs';

const execFile = promisify(execFileCallback);
const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureManifest = JSON.parse(
  await readFile(join(repositoryRoot, 'scripts/release-fixtures.json'), 'utf8'),
);
const fixtureFiles = Object.keys(fixtureManifest.files ?? {});

async function git(args) {
  const { stdout } = await execFile('git', args, {
    cwd: repositoryRoot,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout.trim();
}

async function portIsOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(300, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

if (await portIsOpen(4322)) {
  throw new Error(
    'Localhost port 4322 is still running. Stop the owned demo server before finalising so it cannot change release fixtures during the merge.',
  );
}

const fixtureStatus = await git([
  'status',
  '--porcelain=v1',
  '--untracked-files=all',
  '--',
  ...fixtureFiles,
]);
if (fixtureStatus) {
  const patch = await git(['diff', '--binary', 'HEAD', '--', ...fixtureFiles]);
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupDirectory = join(repositoryRoot, '.astro-visual-editor', 'release-backups');
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = join(backupDirectory, `${timestamp}.patch`);
  await writeFile(backupPath, `${patch}\n`);
  await git(['restore', '--source=HEAD', '--worktree', '--', ...fixtureFiles]);
  console.log(`Restored localhost demo changes; recoverable backup: ${backupPath}`);
}

const worktreeStatus = await git(['status', '--porcelain=v1', '--untracked-files=all']);
if (worktreeStatus) {
  throw new Error(
    `Release finalisation found unrelated worktree changes and left them untouched:\n${worktreeStatus}`,
  );
}

const branch = await git(['branch', '--show-current']);
if (!branch || branch === 'main') {
  throw new Error(
    'Finalise the already-tested release-candidate branch before merging it to main.',
  );
}

let upstream;
try {
  upstream = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
} catch {
  throw new Error('Push the release-candidate branch and let its pull-request CI pass first.');
}
const [head, upstreamHead] = await Promise.all([
  git(['rev-parse', 'HEAD']),
  git(['rev-parse', upstream]),
]);
if (head !== upstreamHead) {
  throw new Error(
    'Local HEAD differs from the pushed candidate. Push it and rerun CI before release.',
  );
}

await checkReleaseCandidate(process.argv[2]);
console.log(`Release candidate ${head} is frozen and ready for protected merge.`);
