import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/options.js';
import { TransactionManager } from '../src/server/transaction-manager.js';
import { describeSeoCapabilitiesWithAdapter } from '../src/server/adapters/index.js';

async function project(): Promise<{ root: string; src: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ave-seo-caps-'));
  const src = join(root, 'src');
  await mkdir(join(src, 'pages'), { recursive: true });
  await mkdir(join(src, 'content'), { recursive: true });
  return { root, src };
}

const delegatedPage = `---
import Layout from '../layouts/Layout.astro';
---
<Layout title="Rendered title" description="Rendered description"><main /></Layout>`;

const headPage = `<html><head>
<title>Head title</title>
<meta name="description" content="Head description" />
</head><body /></html>`;

describe('SEO capabilities', () => {
  it('marks delegated props editable only when the page passes them', async () => {
    const fields = await describeSeoCapabilitiesWithAdapter(
      delegatedPage,
      '.astro',
      'src/pages/index.astro',
    );
    expect(fields.title).toEqual({ editable: true, value: 'Rendered title' });
    expect(fields.description).toEqual({ editable: true, value: 'Rendered description' });
    expect(fields.keywords.editable).toBe(false);
    expect(fields.keywords.reason).toContain('has no “keywords” prop');
    expect(fields.robots.editable).toBe(false);
  });

  it('reports every field editable for a page that owns its head', async () => {
    const fields = await describeSeoCapabilitiesWithAdapter(
      headPage,
      '.astro',
      'src/pages/index.astro',
    );
    expect(Object.values(fields).every((field) => field.editable)).toBe(true);
    expect(fields.title.value).toBe('Head title');
    expect(fields.description.value).toBe('Head description');
    // Absent fields report no value because the adapter inserts them.
    expect(fields.keywords.value).toBe('');
  });

  it('reports an expression-driven head field as not editable', async () => {
    const fields = await describeSeoCapabilitiesWithAdapter(
      '---\nconst title = "x";\n---\n<html><head><title>{title}</title>' +
        '<meta name="description" content={title} /></head><body /></html>',
      '.astro',
      'src/layouts/Layout.astro',
    );
    expect(fields.title.editable).toBe(false);
    expect(fields.title.reason).toContain('rendered from an expression');
    expect(fields.description.editable).toBe(false);
    expect(fields.keywords.editable).toBe(true);
  });

  it('reports duplicate head declarations as not editable', async () => {
    const fields = await describeSeoCapabilitiesWithAdapter(
      '<html><head><title>One</title><title>Two</title></head><body /></html>',
      '.astro',
      'src/pages/index.astro',
    );
    expect(fields.title.editable).toBe(false);
    expect(fields.title.reason).toContain('more than once');
  });

  it('reads markdown frontmatter values and keeps every field editable', async () => {
    const fields = await describeSeoCapabilitiesWithAdapter(
      '---\ntitle: Frontmatter title\nopenGraph:\n  title: Social title\n---\n\nBody.\n',
      '.md',
      'src/content/post.md',
    );
    expect(fields.title).toEqual({ editable: true, value: 'Frontmatter title' });
    expect(fields.ogTitle).toEqual({ editable: true, value: 'Social title' });
    expect(fields.keywords).toEqual({ editable: true, value: '' });
  });

  it('answers a capabilities request through the transaction manager', async () => {
    const { root, src } = await project();
    await writeFile(join(src, 'pages', 'index.astro'), delegatedPage);
    const manager = new TransactionManager(root, src, normalizeOptions());
    const response = await manager.seoCapabilities({
      clientId: 'client',
      requestId: 'request',
      filePath: 'src/pages/index.astro',
    });
    expect(response.success).toBe(true);
    expect(response.fields?.title.value).toBe('Rendered title');
    expect(response.fields?.canonical.editable).toBe(false);
  });

  it('reports a readable error instead of throwing for an unknown file', async () => {
    const { root, src } = await project();
    const manager = new TransactionManager(root, src, normalizeOptions());
    const response = await manager.seoCapabilities({
      clientId: 'client',
      requestId: 'request',
      filePath: 'src/pages/missing.astro',
    });
    expect(response.success).toBe(false);
    expect(response.error).toContain('does not exist');
  });
});
