import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/options.js';
import { applyChangeBatch } from '../src/server/file-updater.js';
import type { TextEditorChange } from '../src/shared/types.js';

async function fixture(): Promise<{ root: string; src: string; page: string }> {
  const root = await mkdtemp(join(tmpdir(), 'astro-visual-editor-'));
  const src = join(root, 'src');
  const pages = join(src, 'pages');
  await mkdir(pages, { recursive: true });
  const page = join(pages, 'index.astro');
  await writeFile(page, '<h1>Original heading</h1>\n<p>Unique body copy.</p>\n', 'utf8');
  return { root, src, page };
}

function change(overrides: Partial<TextEditorChange> = {}): TextEditorChange {
  return {
    kind: 'text',
    id: 'change-1',
    filePath: 'src/pages/index.astro',
    oldText: 'Original heading',
    newText: 'Improved heading',
    route: '/',
    ...overrides,
  };
}

describe('applyChangeBatch', () => {
  it('writes a validated batch to source files', async () => {
    const { root, src, page } = await fixture();
    const result = await applyChangeBatch(root, src, [change()], normalizeOptions());
    expect(result).toMatchObject({ files: ['src/pages/index.astro'], changeCount: 1 });
    expect(result.receiptId).toBeTypeOf('string');
    expect(await readFile(page, 'utf8')).toContain('Improved heading');
  });

  it('validates every edit before writing any file', async () => {
    const { root, src, page } = await fixture();
    const changes = [
      change(),
      change({ id: 'change-2', oldText: 'Missing text', newText: 'Never written' }),
    ];
    await expect(applyChangeBatch(root, src, changes, normalizeOptions())).rejects.toThrow(
      'Original text was not found',
    );
    expect(await readFile(page, 'utf8')).toContain('Original heading');
  });

  it('rejects ambiguous source matches', async () => {
    const { root, src, page } = await fixture();
    await writeFile(page, '<p>Repeated</p><p>Repeated</p>', 'utf8');
    await expect(
      applyChangeBatch(
        root,
        src,
        [change({ oldText: 'Repeated', newText: 'Changed' })],
        normalizeOptions(),
      ),
    ).rejects.toThrow('ambiguous');
  });

  it('rejects absolute paths, traversal and symbolic-link escapes', async () => {
    const { root, src } = await fixture();
    const outside = join(root, 'outside.astro');
    await writeFile(outside, '<p>Outside</p>', 'utf8');
    await symlink(outside, join(src, 'pages', 'escape.astro'));
    const options = normalizeOptions();

    await expect(
      applyChangeBatch(root, src, [change({ filePath: outside })], options),
    ).rejects.toThrow('project-relative');
    await expect(
      applyChangeBatch(root, src, [change({ filePath: '../outside.astro' })], options),
    ).rejects.toThrow('outside');
    await expect(
      applyChangeBatch(
        root,
        src,
        [change({ filePath: 'src/pages/escape.astro', oldText: 'Outside', newText: 'Inside' })],
        options,
      ),
    ).rejects.toThrow('outside');
  });

  it('escapes markup in literal Astro text instead of changing document structure', async () => {
    const { root, src, page } = await fixture();
    await applyChangeBatch(
      root,
      src,
      [change({ newText: '<strong>Still text</strong>' })],
      normalizeOptions(),
    );
    expect(await readFile(page, 'utf8')).toContain('&lt;strong&gt;Still text&lt;/strong&gt;');
  });
});
