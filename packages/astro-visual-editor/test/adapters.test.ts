import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/options.js';
import { applyChangeBatch } from '../src/server/file-updater.js';
import type { EditorChange, SeoValues } from '../src/shared/types.js';

async function project(): Promise<{ root: string; src: string }> {
  const root = await mkdtemp(join(tmpdir(), 'ave-adapters-'));
  const src = join(root, 'src');
  await mkdir(join(src, 'pages'), { recursive: true });
  await mkdir(join(src, 'data'), { recursive: true });
  return { root, src };
}

const emptySeo: SeoValues = {
  title: '',
  description: '',
  keywords: '',
  canonical: '',
  ogTitle: '',
  ogDescription: '',
  robots: '',
};

function sectionSourceKey(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 20);
}

describe('source adapters', () => {
  it('updates formatted multiline Astro text using its rendered whitespace', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      `<p data-astro-edit-id="lead">
  A long sentence can wrap across source lines while rendering as one line of text.
  The editor should still find it.
</p>`,
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'text',
          id: 'multiline',
          filePath: 'src/pages/index.astro',
          route: '/',
          selector: '[data-astro-edit-id="lead"]',
          oldText:
            'A long sentence can wrap across source lines while rendering as one line of text. The editor should still find it.',
          newText: 'The replacement is written safely.',
        },
      ],
      normalizeOptions(),
    );
    expect(await readFile(page, 'utf8')).toBe(
      `<p data-astro-edit-id="lead">
  The replacement is written safely.
</p>`,
    );
  });

  it('matches a visible Astro literal without confusing identical attribute text', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      '<p data-astro-edit-origin="a Content Collection field">Content Collection</p>',
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'text',
          id: 'literal-not-attribute',
          filePath: 'src/pages/index.astro',
          route: '/',
          selector: 'p',
          oldText: 'Content Collection',
          newText: 'Collection source, reviewed',
        },
      ],
      normalizeOptions(),
    );
    expect(await readFile(page, 'utf8')).toBe(
      '<p data-astro-edit-origin="a Content Collection field">Collection source, reviewed</p>',
    );
  });

  it('updates JSON and YAML by structured path', async () => {
    const { root, src } = await project();
    await writeFile(join(src, 'data', 'copy.json'), '{\n  "hero": { "title": "Old JSON" }\n}\n');
    await writeFile(join(src, 'data', 'copy.yaml'), 'hero:\n  title: Old YAML\n');
    const changes: EditorChange[] = [
      {
        kind: 'text',
        id: 'j',
        filePath: 'src/data/copy.json',
        route: '/',
        sourcePath: 'hero.title',
        oldText: 'Old JSON',
        newText: 'New JSON',
      },
      {
        kind: 'text',
        id: 'y',
        filePath: 'src/data/copy.yaml',
        route: '/',
        sourcePath: 'hero.title',
        oldText: 'Old YAML',
        newText: 'New YAML',
      },
    ];
    await applyChangeBatch(root, src, changes, normalizeOptions());
    expect(await readFile(join(src, 'data', 'copy.json'), 'utf8')).toContain('"New JSON"');
    expect(await readFile(join(src, 'data', 'copy.yaml'), 'utf8')).toContain('title: New YAML');
  });

  it('updates, inserts and removes Astro SEO elements', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      '<html><head><title>Old title</title><meta name="description" content="Old description" /></head><body /></html>',
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'seo',
          id: 'seo',
          filePath: 'src/pages/index.astro',
          route: '/',
          before: { ...emptySeo, title: 'Old title', description: 'Old description' },
          after: {
            ...emptySeo,
            title: 'New title',
            canonical: 'https://example.com/',
            ogTitle: 'Social title',
            robots: 'index, follow',
          },
        },
      ],
      normalizeOptions(),
    );
    const result = await readFile(page, 'utf8');
    expect(result).toContain('<title>New title</title>');
    expect(result).not.toContain('Old description');
    expect(result).toContain('rel="canonical"');
    expect(result).toContain('property="og:title"');
  });

  it('updates unique rendered SEO props when the route delegates its head to a layout', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      `---\nimport Layout from '../layouts/Layout.astro';\n---\n<Layout title="Old rendered title" description="Old rendered description" keywords="" canonical="" ogTitle="" ogDescription="" robots=""><main /></Layout>`,
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'seo',
          id: 'layout-title',
          filePath: 'src/pages/index.astro',
          route: '/',
          before: {
            ...emptySeo,
            title: 'Old rendered title',
            description: 'Old rendered description',
          },
          after: {
            ...emptySeo,
            title: 'New rendered title',
            description: 'New rendered description',
            keywords: 'astro, editor',
            canonical: 'https://example.com/reviewed',
            ogTitle: 'New social title',
            ogDescription: 'New social description',
            robots: 'index, follow',
          },
        },
      ],
      normalizeOptions(),
    );
    const result = await readFile(page, 'utf8');
    expect(result).toContain('title="New rendered title"');
    expect(result).toContain('description="New rendered description"');
    expect(result).toContain('keywords="astro, editor"');
    expect(result).toContain('canonical="https://example.com/reviewed"');
    expect(result).toContain('ogTitle="New social title"');
    expect(result).toContain('ogDescription="New social description"');
    expect(result).toContain('robots="index, follow"');
  });

  it('refuses ambiguous or non-title layout props for delegated SEO titles', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    const change = {
      kind: 'seo' as const,
      id: 'layout-title',
      filePath: 'src/pages/index.astro',
      route: '/',
      before: { ...emptySeo, title: 'Repeated title' },
      after: { ...emptySeo, title: 'Replacement title' },
    };
    await writeFile(page, '<Layout title="Repeated title" /><Card title="Repeated title" />');
    await expect(applyChangeBatch(root, src, [change], normalizeOptions())).rejects.toThrow(
      'More than one literal “title” prop',
    );
    await writeFile(page, '<Layout heading="Repeated title" />');
    await expect(applyChangeBatch(root, src, [change], normalizeOptions())).rejects.toThrow(
      'page title is not a literal “title” prop',
    );
  });

  it('explains a delegated SEO field that is not exposed as a literal route prop', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<Layout title="Rendered title" />');
    await expect(
      applyChangeBatch(
        root,
        src,
        [
          {
            kind: 'seo',
            id: 'layout-description',
            filePath: 'src/pages/index.astro',
            route: '/',
            before: { ...emptySeo, title: 'Rendered title', description: '' },
            after: { ...emptySeo, title: 'Rendered title', description: 'New description' },
          },
        ],
        normalizeOptions(),
      ),
    ).rejects.toThrow('search description is not a literal “description” prop');
  });

  it('rewrites head SEO elements without leaving a stray opening bracket', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      `<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="Old &gt; description" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Old title</title>
  </head>
  <body />
</html>
`,
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'seo',
          id: 'head-seo',
          filePath: 'src/pages/index.astro',
          route: '/',
          before: {
            ...emptySeo,
            title: 'Old title',
            description: 'Old > description',
            robots: 'noindex, nofollow',
          },
          after: {
            ...emptySeo,
            title: 'New title',
            description: 'New description',
            robots: '',
            keywords: 'one, two',
          },
        },
      ],
      normalizeOptions(),
    );
    expect(await readFile(page, 'utf8')).toBe(
      `<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="New description" />
    <title>New title</title>
    <meta name="keywords" content="one, two" />
  </head>
  <body />
</html>
`,
    );
  });

  it('separates a stale delegated SEO prop from a missing one', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<Layout title="Source title" />');
    await expect(
      applyChangeBatch(
        root,
        src,
        [
          {
            kind: 'seo',
            id: 'stale-prop',
            filePath: 'src/pages/index.astro',
            route: '/',
            before: { ...emptySeo, title: 'Decorated title | Site' },
            after: { ...emptySeo, title: 'Replacement title' },
          },
        ],
        normalizeOptions(),
      ),
    ).rejects.toThrow('SEO field changed before commit in src/pages/index.astro: title.');
  });

  it('escapes quotes and entities written into a delegated SEO prop', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, "<Layout title='Old title' />");
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'seo',
          id: 'escaped',
          filePath: 'src/pages/index.astro',
          route: '/',
          before: { ...emptySeo, title: 'Old title' },
          after: { ...emptySeo, title: `Ben's "R&D" <notes>` },
        },
      ],
      normalizeOptions(),
    );
    expect(await readFile(page, 'utf8')).toBe(
      "<Layout title='Ben&#39;s &quot;R&amp;D&quot; &lt;notes&gt;' />",
    );
  });

  it('refuses an Astro SEO field that is rendered from an expression', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      '---\nconst title = "Computed";\n---\n<html><head><title>{title}</title></head><body /></html>',
    );
    await expect(
      applyChangeBatch(
        root,
        src,
        [
          {
            kind: 'seo',
            id: 'expression-title',
            filePath: 'src/pages/index.astro',
            route: '/',
            before: { ...emptySeo, title: 'Computed' },
            after: { ...emptySeo, title: 'Replacement' },
          },
        ],
        normalizeOptions(),
      ),
    ).rejects.toThrow('page title is rendered from an expression');
  });

  it('persists section reorder, delete and template insertion', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      `<main data-astro-edit-region="home">
  <section data-section="hero"><h1>Hero</h1></section>
  <section data-section="features"><h2>Features</h2></section>
</main>`,
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'sections',
          id: 'sections',
          filePath: 'src/pages/index.astro',
          route: '/',
          regionId: 'home',
          before: [{ id: 'hero' }, { id: 'features' }],
          after: [{ id: 'features' }, { id: 'new-text', templateId: 'text' }],
        },
      ],
      normalizeOptions(),
    );
    const result = await readFile(page, 'utf8');
    expect(result.indexOf('data-section="features"')).toBeLessThan(
      result.indexOf('data-section="new-text"'),
    );
    expect(result).not.toContain('data-section="hero"');
    expect(result).toContain('Section heading');
  });

  it('rebases an intended section order when only the source order drifted', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(
      page,
      `<main data-astro-edit-region="home">
  <section data-section="features"><h2>Features</h2></section>
  <section data-section="hero"><h1>Hero</h1></section>
</main>`,
    );
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'sections',
          id: 'stale-order-only',
          filePath: 'src/pages/index.astro',
          route: '/',
          regionId: 'home',
          before: [{ id: 'hero' }, { id: 'features' }],
          after: [{ id: 'hero' }, { id: 'features' }],
        },
      ],
      normalizeOptions(),
    );
    const result = await readFile(page, 'utf8');
    expect(result.indexOf('data-section="hero"')).toBeLessThan(
      result.indexOf('data-section="features"'),
    );
  });

  it('preserves multiline Astro closing brackets when mapped elements are reordered', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    const text = '<p>Summary</p>';
    const button = '<button type="button">Action</button\n  >';
    await writeFile(page, `<section>\n  ${text}\n  ${button}\n</section>`);
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'sections',
          id: 'mapped-elements',
          filePath: 'src/pages/index.astro',
          route: '/',
          regionId: 'mapped',
          sourcePath: 'astro:children:element:section:0',
          before: [
            { id: 'summary', sourceKey: sectionSourceKey(text) },
            { id: 'action', sourceKey: sectionSourceKey(button) },
          ],
          after: [
            { id: 'action', sourceKey: sectionSourceKey(button) },
            { id: 'summary', sourceKey: sectionSourceKey(text) },
          ],
        },
      ],
      normalizeOptions(),
    );
    const result = await readFile(page, 'utf8');
    expect(result.indexOf('<button')).toBeLessThan(result.indexOf('<p>'));
    expect(result).toContain('</button\n  >');
  });

  it('refuses stale SEO state and unstructured MDX expression editing', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<html><head><title>Current title</title></head><body /></html>');
    await expect(
      applyChangeBatch(
        root,
        src,
        [
          {
            kind: 'seo',
            id: 'stale-seo',
            filePath: 'src/pages/index.astro',
            route: '/',
            before: { ...emptySeo, title: 'Stale title' },
            after: { ...emptySeo, title: 'Replacement title' },
          },
        ],
        normalizeOptions(),
      ),
    ).rejects.toThrow('changed before commit');
    expect(await readFile(page, 'utf8')).toContain('Current title');

    const mdx = join(src, 'pages', 'example.mdx');
    await writeFile(mdx, '---\ntitle: Example\n---\n\n# {dynamicHeading}\n');
    await expect(
      applyChangeBatch(
        root,
        src,
        [
          {
            kind: 'text',
            id: 'mdx',
            filePath: 'src/pages/example.mdx',
            route: '/example',
            oldText: 'dynamicHeading',
            newText: 'changedExpression',
          },
        ],
        normalizeOptions(),
      ),
    ).rejects.toThrow('structured data-astro-edit-path');
  });

  it('keeps raw Astro markup behind the explicit unsafe option', async () => {
    const { root, src } = await project();
    const page = join(src, 'pages', 'index.astro');
    await writeFile(page, '<p>Plain copy</p>');
    await applyChangeBatch(
      root,
      src,
      [
        {
          kind: 'text',
          id: 'unsafe',
          filePath: 'src/pages/index.astro',
          route: '/',
          oldText: 'Plain copy',
          newText: '<strong>Structured copy</strong>',
        },
      ],
      normalizeOptions({ allowUnsafeSourceText: true }),
    );
    expect(await readFile(page, 'utf8')).toBe('<p><strong>Structured copy</strong></p>');
  });
});
