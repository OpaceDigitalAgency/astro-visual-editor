import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/options.js';
import { EditabilityPolicyManager } from '../src/server/editability-policy.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'astro-ve-policy-'));
  roots.push(root);
  await mkdir(join(root, 'src', 'pages'), { recursive: true });
  const options = normalizeOptions();
  return { root, options, manager: new EditabilityPolicyManager(root, options) };
}

describe('EditabilityPolicyManager', () => {
  it('previews and saves a Git-reviewable policy with conflict protection', async () => {
    const { root, options, manager } = await fixture();
    const loaded = await manager.load('owner', 'load-1', true);
    expect(loaded.success).toBe(true);
    expect(loaded.policy?.rules).toEqual([]);
    const request = {
      clientId: 'owner',
      requestId: 'change-1',
      expectedHash: loaded.policyHash!,
      policy: {
        version: 1 as const,
        rules: [
          {
            id: 'allow-strong',
            effect: 'allow' as const,
            scope: 'selector' as const,
            route: '/',
            selector: 'strong',
            filePath: 'src/pages/index.astro',
          },
        ],
      },
    };
    const preview = await manager.preview(request, true);
    expect(preview.success).toBe(true);
    expect(preview.diff?.lines.some((line) => line.kind === 'add')).toBe(true);
    const saved = await manager.save(request, true);
    expect(saved.success).toBe(true);
    expect(await readFile(join(root, 'astro-visual-editor.policy.json'), 'utf8')).toContain(
      'allow-strong',
    );
    const restarted = new EditabilityPolicyManager(root, options);
    expect((await restarted.load('owner', 'after-restart', true)).policy?.rules[0]?.id).toBe(
      'allow-strong',
    );
    expect((await manager.save(request, true)).error).toContain('changed on disk');
  });

  it('rejects editor mutations, duplicate targets and unsafe files', async () => {
    const { manager } = await fixture();
    const loaded = await manager.load('editor', 'load-1', false);
    const base = {
      clientId: 'editor',
      requestId: 'change-1',
      expectedHash: loaded.policyHash!,
    };
    const policy = {
      version: 1 as const,
      rules: [
        {
          id: 'allow-strong',
          effect: 'allow' as const,
          scope: 'selector' as const,
          route: '/',
          selector: 'strong',
          filePath: 'src/pages/index.astro',
        },
      ],
    };
    expect((await manager.preview({ ...base, policy }, false)).error).toContain('local owner');
    expect((await manager.save({ ...base, policy }, false)).error).toContain('local owner');
    expect((await manager.save({ ...base, clientId: 'owner', policy }, true)).error).toContain(
      'Review the exact',
    );
    expect(
      (
        await manager.preview(
          {
            ...base,
            policy: {
              version: 1,
              rules: [
                ...policy.rules,
                { ...policy.rules[0]!, id: 'deny-strong', effect: 'deny' as const },
              ],
            },
          },
          true,
        )
      ).error,
    ).toContain('same element');
    expect(
      (
        await manager.preview(
          {
            ...base,
            policy: {
              version: 1,
              rules: [{ ...policy.rules[0]!, filePath: '../outside.astro' }],
            },
          },
          true,
        )
      ).error,
    ).toContain('unsafe source');
  });

  it('fails closed when the manifest is invalid', async () => {
    const { root, manager } = await fixture();
    await writeFile(join(root, 'astro-visual-editor.policy.json'), '{not json');
    const loaded = await manager.load('owner', 'load-1', true);
    expect(loaded.success).toBe(false);
    expect(loaded.error).toContain('not valid JSON');
  });
});
