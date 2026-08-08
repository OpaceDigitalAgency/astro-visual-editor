import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * A timeout-aborted run can skip a test's `finally` restore and leave demo/
 * fixtures dirty. Later green runs then read the polluted file as their
 * "original" and faithfully restore the pollution, so the residue
 * self-perpetuates and every subsequent result describes corrupted fixtures.
 * Refuse to start instead: dirty fixtures are an operator decision, not
 * something the suite should silently adopt or silently discard.
 */
export default function globalSetup(): void {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const dirty = execSync('git status --porcelain -- demo/', { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  if (dirty.length > 0) {
    throw new Error(
      [
        'demo/ has uncommitted changes, so e2e results would describe polluted fixtures:',
        ...dirty.map((line) => `  ${line}`),
        'If this is residue from an aborted run, restore it with: git checkout -- demo/',
        'If it is deliberate work in progress, commit or stash it before running the suite.',
      ].join('\n'),
    );
  }
}
