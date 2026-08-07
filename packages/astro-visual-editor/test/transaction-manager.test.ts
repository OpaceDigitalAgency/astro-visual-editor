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
    const request = {
      clientId: 'tab',
      requestId: 'same',
      changes: [
        {
          kind: 'text' as const,
          id: 'one',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Old heading',
          newText: 'New heading',
        },
      ],
    };
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
    const response = await manager.save({
      clientId: 'tab',
      requestId: 'too-many',
      changes: [
        {
          kind: 'text',
          id: 'one',
          filePath: 'src/pages/missing.astro',
          route: '/',
          oldText: 'a',
          newText: 'b',
        },
        {
          kind: 'text',
          id: 'two',
          filePath: 'src/pages/missing.astro',
          route: '/',
          oldText: 'c',
          newText: 'd',
        },
      ],
    });
    expect(response.success).toBe(false);
    expect(response.error).toContain('more than 1');
  });

  it('identifies the failed change without writing any part of the batch', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    const original = '<h1>Old heading</h1><p>Stable copy</p>';
    await writeFile(page, original);
    const manager = new TransactionManager(root, src, normalizeOptions());
    const response = await manager.preview({
      clientId: 'tab',
      requestId: 'failed-change',
      changes: [
        {
          kind: 'text',
          id: 'valid-change',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Old heading',
          newText: 'New heading',
        },
        {
          kind: 'text',
          id: 'failed-change',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Missing copy',
          newText: 'Edited copy',
        },
      ],
    });
    expect(response.success).toBe(false);
    expect(response.failedChangeId).toBe('failed-change');
    expect(await readFile(page, 'utf8')).toBe(original);
  });

  it('restores a checksummed receipt after restart and ignores tampered history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<h1>Old heading</h1>');
    const request = {
      clientId: 'tab',
      requestId: 'restart-safe',
      changes: [
        {
          kind: 'text' as const,
          id: 'one',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Old heading',
          newText: 'New heading',
        },
      ],
    };
    const first = await new TransactionManager(root, src, normalizeOptions()).save(request);
    const restarted = new TransactionManager(root, src, normalizeOptions());
    expect(await restarted.history()).toHaveLength(1);
    expect((await restarted.revert('tab', 'restart-revert', first.receiptId!)).success).toBe(true);
    expect(await readFile(page, 'utf8')).toBe('<h1>Old heading</h1>');

    await writeFile(join(root, '.astro-visual-editor', 'receipts.json'), '{"tampered":true}');
    const tampered = new TransactionManager(root, src, normalizeOptions());
    expect(await tampered.history()).toEqual([]);
  });

  it('shows an exact source diff without writing, then commits those validated snapshots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<main>\n  <h1>Old heading</h1>\n</main>');
    const manager = new TransactionManager(root, src, normalizeOptions());
    const request = {
      clientId: 'tab',
      requestId: 'preview-exact',
      changes: [
        {
          kind: 'text' as const,
          id: 'one',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Old heading',
          newText: 'New heading',
        },
      ],
    };
    const preview = await manager.preview(request);
    expect(preview.success).toBe(true);
    expect(preview.diffs?.[0]?.lines.filter((line) => line.kind !== 'context')).toEqual([
      { kind: 'remove', text: '  <h1>Old heading</h1>', oldLine: 2 },
      { kind: 'add', text: '  <h1>New heading</h1>', newLine: 2 },
    ]);
    expect(await readFile(page, 'utf8')).toContain('Old heading');
    expect((await manager.save(request)).success).toBe(true);
    expect(await readFile(page, 'utf8')).toContain('New heading');
  });

  it('adds template sections before applying independently scoped text edits inside them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      '<main data-astro-edit-region="home"><section data-section="hero"><h1>Hero</h1></section></main>',
    );
    const manager = new TransactionManager(root, src, normalizeOptions());
    const response = await manager.save({
      clientId: 'tab',
      requestId: 'add-then-edit',
      changes: [
        {
          kind: 'text',
          id: 'text-one',
          filePath: 'src/pages/index.astro',
          route: '/',
          selector: '[data-section="text-one"] > p',
          oldText: 'This is a simple content section. Select this paragraph to edit it.',
          newText: 'First independent paragraph.',
        },
        {
          kind: 'text',
          id: 'text-two',
          filePath: 'src/pages/index.astro',
          route: '/',
          selector: '[data-section="text-two"] > p',
          oldText: 'This is a simple content section. Select this paragraph to edit it.',
          newText: 'Second independent paragraph.',
        },
        {
          kind: 'sections',
          id: 'sections',
          filePath: 'src/pages/index.astro',
          route: '/',
          regionId: 'home',
          before: [{ id: 'hero' }],
          after: [
            { id: 'hero' },
            { id: 'text-one', templateId: 'text' },
            { id: 'text-two', templateId: 'text' },
          ],
        },
      ],
    });
    expect(response.success, response.error).toBe(true);
    const result = await readFile(page, 'utf8');
    expect(result).toContain('First independent paragraph.');
    expect(result).toContain('Second independent paragraph.');
    expect(result).not.toContain('This is a simple content section.');
  });

  it('refuses restart recovery when a committed file changed afterwards', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<h1>Old heading</h1>');
    const request = {
      clientId: 'tab',
      requestId: 'conflict-safe',
      changes: [
        {
          kind: 'text' as const,
          id: 'one',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Old heading',
          newText: 'New heading',
        },
      ],
    };
    const saved = await new TransactionManager(root, src, normalizeOptions()).save(request);
    await writeFile(page, '<h1>Newer manual work</h1>');
    const restarted = new TransactionManager(root, src, normalizeOptions());
    const reverted = await restarted.revert('tab', 'conflict-revert', saved.receiptId!);
    expect(reverted.success).toBe(false);
    expect(reverted.error).toContain('changed after this receipt');
    expect(await readFile(page, 'utf8')).toContain('Newer manual work');
  });

  it('drops expired recovery receipts after restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    await writeFile(join(src, 'pages', 'index.astro'), '<h1>Old heading</h1>');
    const options = normalizeOptions({ receiptTtlMs: 1 });
    await new TransactionManager(root, src, options).save({
      clientId: 'tab',
      requestId: 'expires',
      changes: [
        {
          kind: 'text',
          id: 'one',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Old heading',
          newText: 'New heading',
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await new TransactionManager(root, src, options).history()).toEqual([]);
  });
});
