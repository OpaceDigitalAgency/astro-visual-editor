import { createHash } from 'node:crypto';
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

  it('remaps JSON text edits queued against pre-reorder array indices', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-transaction-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'data'), { recursive: true });
    const dataFile = join(src, 'data', 'page.json');
    const items = [
      { label: 'Layout', value: 'Shared navigation' },
      { label: 'Component', value: 'Reusable hero' },
      { label: 'Data', value: 'Direct JSON' },
    ];
    await writeFile(dataFile, `${JSON.stringify({ evidence: items }, null, 2)}\n`);
    const key = (item: (typeof items)[number]): string =>
      createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 20);
    const manager = new TransactionManager(root, src, normalizeOptions());
    // The text edit targets evidence.1 (Component) as rendered before the
    // reorder moved that entry to position 0. Both must land.
    const response = await manager.save({
      clientId: 'tab',
      requestId: 'reorder-and-edit',
      changes: [
        {
          kind: 'sections',
          id: 'reorder',
          filePath: 'src/data/page.json',
          route: '/',
          regionId: 'cards',
          sourcePath: 'json:array:evidence',
          before: [
            { id: 'card-0', sourceKey: key(items[0]!) },
            { id: 'card-1', sourceKey: key(items[1]!) },
            { id: 'card-2', sourceKey: key(items[2]!) },
          ],
          after: [
            { id: 'card-1', sourceKey: key(items[1]!) },
            { id: 'card-0', sourceKey: key(items[0]!) },
            { id: 'card-2', sourceKey: key(items[2]!) },
          ],
        },
        {
          kind: 'text',
          id: 'edit',
          filePath: 'src/data/page.json',
          route: '/',
          sourcePath: 'evidence.1.value',
          oldText: 'Reusable hero',
          newText: 'Reusable hero, updated',
        },
      ],
    });
    expect(response.success).toBe(true);
    const saved = JSON.parse(await readFile(dataFile, 'utf8')) as {
      evidence: Array<{ label: string; value: string }>;
    };
    expect(saved.evidence.map((item) => item.label)).toEqual(['Component', 'Layout', 'Data']);
    expect(saved.evidence[0]!.value).toBe('Reusable hero, updated');
    expect(saved.evidence[1]!.value).toBe('Shared navigation');
  });
});

describe('TransactionManager session restore', () => {
  const textChange = (id: string, oldText: string, newText: string) => ({
    kind: 'text' as const,
    id,
    filePath: 'src/pages/index.astro',
    route: '/',
    oldText,
    newText,
  });

  it('rewinds multiple saves on one file to the pre-session contents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-session-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<h1>Original</h1>');
    const manager = new TransactionManager(root, src, normalizeOptions());
    await manager.save({
      clientId: 'tab',
      requestId: 'one',
      changes: [textChange('a', 'Original', 'Second')],
    });
    await manager.save({
      clientId: 'tab',
      requestId: 'two',
      changes: [textChange('b', 'Second', 'Third')],
    });
    expect(await readFile(page, 'utf8')).toBe('<h1>Third</h1>');
    expect((await manager.sessionState('tab')).available).toBe(true);
    const restored = await manager.restoreSession('tab', 'restore');
    expect(restored.success).toBe(true);
    expect(restored.files).toEqual(['src/pages/index.astro']);
    expect(await readFile(page, 'utf8')).toBe('<h1>Original</h1>');
    expect((await manager.sessionState('tab')).available).toBe(false);
    const again = await manager.restoreSession('tab', 'restore-again');
    expect(again.success).toBe(false);
  });

  it('refuses when a file changed outside the editor and keeps sessions separate', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-session-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<h1>Original</h1>');
    const manager = new TransactionManager(root, src, normalizeOptions());
    await manager.save({
      clientId: 'tab',
      requestId: 'one',
      changes: [textChange('a', 'Original', 'Edited')],
    });
    await writeFile(page, '<h1>Manual outside edit</h1>');
    const refused = await manager.restoreSession('tab', 'restore');
    expect(refused.success).toBe(false);
    expect(refused.error).toContain('outside the editor');
    expect(await readFile(page, 'utf8')).toBe('<h1>Manual outside edit</h1>');
    expect((await manager.sessionState('other-tab')).available).toBe(false);
    const otherTab = await manager.restoreSession('other-tab', 'restore');
    expect(otherTab.success).toBe(false);
  });

  it('stays restorable after a last-commit revert and survives a restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-session-'));
    const src = join(root, 'src');
    await mkdir(join(src, 'pages'), { recursive: true });
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<h1>Original</h1>');
    const manager = new TransactionManager(root, src, normalizeOptions());
    await manager.save({
      clientId: 'tab',
      requestId: 'one',
      changes: [textChange('a', 'Original', 'Second')],
    });
    const second = await manager.save({
      clientId: 'tab',
      requestId: 'two',
      changes: [textChange('b', 'Second', 'Third')],
    });
    await manager.revert('tab', 'revert', second.receiptId!);
    expect(await readFile(page, 'utf8')).toBe('<h1>Second</h1>');
    // A fresh manager instance simulates a dev-server restart mid-session.
    const restarted = new TransactionManager(root, src, normalizeOptions());
    expect((await restarted.sessionState('tab')).available).toBe(true);
    const restored = await restarted.restoreSession('tab', 'restore');
    expect(restored.success).toBe(true);
    expect(await readFile(page, 'utf8')).toBe('<h1>Original</h1>');
  });
});
