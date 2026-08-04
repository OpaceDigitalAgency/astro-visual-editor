import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/options.js';
import { TransactionManager } from '../src/server/transaction-manager.js';

describe('TransactionManager', () => {
  it('is idempotent and only reverts an unchanged committed receipt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<h1>Old heading</h1>');
    const manager = new TransactionManager(root, src, normalizeOptions());
    const request = { clientId: 'tab', requestId: 'same', changes: [{
      kind: 'text' as const, id: 'one', filePath: 'src/pages/index.astro', route: '/', oldText: 'Old heading', newText: 'New heading',
    }] };
    const first = await manager.save(request);
    const replay = await manager.save(request);
    expect(replay).toEqual(first);
    expect(await readFile(page, 'utf8')).toBe('<h1>New heading</h1>');
    const reverted = await manager.revert('tab', 'revert', first.receiptId!);
    expect(reverted.success).toBe(true);
    expect(await readFile(page, 'utf8')).toBe('<h1>Old heading</h1>');
  });

  it('rejects an oversized compatibility batch before reading source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const manager = new TransactionManager(root, src, normalizeOptions({ maxChanges: 1 }));
    const response = await manager.save({ clientId: 'tab', requestId: 'too-many', changes: [
      { kind: 'text', id: 'one', filePath: 'src/pages/missing.astro', route: '/', oldText: 'a', newText: 'b' },
      { kind: 'text', id: 'two', filePath: 'src/pages/missing.astro', route: '/', oldText: 'c', newText: 'd' },
    ] });
    expect(response.success).toBe(false);
    expect(response.error).toContain('more than 1');
  });
});
