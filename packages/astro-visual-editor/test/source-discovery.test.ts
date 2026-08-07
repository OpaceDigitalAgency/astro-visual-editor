import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeOptions } from '../src/options.js';
import { applyAstroSections, applyAstroText } from '../src/server/adapters/astro.js';
import { applyMarkdownText } from '../src/server/adapters/markdown.js';
import { applyJsonSections, applyYamlSections } from '../src/server/adapters/structured.js';
import { discoverSectionRegions, discoverSources } from '../src/server/source-discovery.js';
import type { SectionRegionCandidate } from '../src/shared/types.js';

describe('syntax-aware source discovery', () => {
  it('finds repeated Astro literals as separate safe mapped nodes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-discovery-'));
    const sourceRoot = join(root, 'src');
    await mkdir(join(sourceRoot, 'pages'), { recursive: true });
    const source = '<main><p>Repeated value</p><aside><p>Repeated value</p></aside></main>\n';
    await writeFile(join(sourceRoot, 'pages', 'index.astro'), source);

    const response = await discoverSources(
      root,
      sourceRoot,
      {
        clientId: 'client',
        requestId: 'request',
        route: '/',
        selector: 'main > p',
        text: 'Repeated value',
        hintedFilePath: 'src/pages/index.astro',
      },
      normalizeOptions(),
    );

    expect(response.success).toBe(true);
    expect(response.candidates).toHaveLength(2);
    expect(response.candidates?.every((candidate) => candidate.confidence === 'exact')).toBe(true);
    const selected = response.candidates![1]!;
    const edited = await applyAstroText(source, {
      kind: 'text',
      id: 'edit',
      route: '/',
      filePath: selected.filePath,
      sourcePath: selected.sourcePath,
      selector: 'aside > p',
      oldText: 'Repeated value',
      newText: 'Only the second value',
    });
    expect(edited).toContain('<p>Repeated value</p>');
    expect(edited).toContain('<aside><p>Only the second value</p></aside>');
  });

  it('keeps discovered section fingerprints aligned with multiline Astro closing tags', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-discovery-'));
    const sourceRoot = join(root, 'src');
    await mkdir(join(sourceRoot, 'pages'), { recursive: true });
    const source = `<section>
  <p>Summary</p>
  <button type="button">Action</button
  >
</section>\n`;
    await writeFile(join(sourceRoot, 'pages', 'index.astro'), source);

    const response = await discoverSectionRegions(
      root,
      sourceRoot,
      {
        clientId: 'client',
        requestId: 'request',
        route: '/',
        selector: 'section',
        itemCount: 2,
        itemTags: ['p', 'button'],
        hintedFilePath: 'src/pages/index.astro',
      },
      normalizeOptions(),
    );
    const candidate = response.candidates?.find(
      (item) => item.sourcePath === 'astro:children:element:section:0',
    );
    expect(candidate).toBeDefined();

    const edited = await applyAstroSections(
      source,
      {
        kind: 'sections',
        id: 'reorder',
        route: '/',
        filePath: 'src/pages/index.astro',
        regionId: 'content',
        sourcePath: candidate!.sourcePath,
        before: candidate!.items,
        after: [...candidate!.items].reverse(),
      },
      [],
    );

    expect(edited.indexOf('<button')).toBeLessThan(edited.indexOf('<p>'));
    expect(edited).toContain('</button\n  >');
  });

  it('discovers JSON, YAML and Markdown frontmatter paths without regex guessing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-discovery-'));
    const sourceRoot = join(root, 'src');
    await mkdir(join(sourceRoot, 'data'), { recursive: true });
    await mkdir(join(sourceRoot, 'content'), { recursive: true });
    await writeFile(
      join(sourceRoot, 'data', 'content.json'),
      '{"cards":[{"title":"Exact value"}]}\n',
    );
    await writeFile(join(sourceRoot, 'data', 'content.yaml'), 'hero:\n  title: Exact value\n');
    await writeFile(
      join(sourceRoot, 'content', 'page.md'),
      '---\ntitle: Exact value\n---\n\nExact value\n',
    );

    const response = await discoverSources(
      root,
      sourceRoot,
      {
        clientId: 'client',
        requestId: 'request',
        route: '/page',
        selector: 'h1',
        text: 'Exact value',
      },
      normalizeOptions(),
    );

    expect(response.candidates?.map((candidate) => candidate.sourcePath)).toEqual(
      expect.arrayContaining([
        'cards[0].title',
        'hero.title',
        'frontmatter.title',
        expect.stringMatching(/^markdown:body:\d+$/u),
      ]),
    );
  });

  it('refuses a stale confirmed Markdown range', () => {
    expect(() =>
      applyMarkdownText('Changed before save', {
        kind: 'text',
        id: 'edit',
        route: '/',
        filePath: 'src/content/page.md',
        sourcePath: 'markdown:body:0',
        oldText: 'Original',
        newText: 'Replacement',
      }),
    ).toThrow(/stale/u);
  });

  it('discovers and safely reorders unannotated Astro component children', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-sections-'));
    const sourceRoot = join(root, 'src');
    await mkdir(join(sourceRoot, 'pages'), { recursive: true });
    const source = `---
import Hero from '../components/Hero.astro';
import Proof from '../components/Proof.astro';
---
<Layout>
  <Hero />
  <p>Direct copy</p>
  <Proof />
</Layout>
`;
    await writeFile(join(sourceRoot, 'pages', 'index.astro'), source);
    const discovery = await discoverSectionRegions(
      root,
      sourceRoot,
      {
        clientId: 'client',
        requestId: 'request',
        route: '/',
        selector: 'main',
        itemCount: 3,
        hintedFilePath: 'src/pages/index.astro',
      },
      normalizeOptions(),
    );
    const candidate = discovery.candidates?.find((item) => item.sourcePath.includes(':Layout:'));
    expect(candidate).toBeDefined();
    expect(candidate).toMatchObject({
      containerTag: 'Layout',
      itemTags: ['Hero', 'p', 'Proof'],
    });
    const before = candidate!.items;
    const result = await applyAstroSections(
      source,
      {
        kind: 'sections',
        id: 'sections',
        route: '/',
        filePath: candidate!.filePath,
        regionId: 'home-sections',
        sourcePath: candidate!.sourcePath,
        before,
        after: [before[2]!, before[0]!, before[1]!],
      },
      [],
    );
    expect(result.indexOf('<Proof />')).toBeLessThan(result.indexOf('<Hero />'));
    expect(result.indexOf('<Hero />')).toBeLessThan(result.indexOf('<p>Direct copy</p>'));
  });

  it('discovers and safely reorders JSON and YAML arrays by complete item identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ave-structured-sections-'));
    const sourceRoot = join(root, 'src');
    await mkdir(join(sourceRoot, 'data'), { recursive: true });
    const json = '{"faqs":[{"id":"one","question":"First"},{"id":"two","question":"Second"}]}\n';
    const yaml = 'faqs:\n  - id: one\n    question: First\n  - id: two\n    question: Second\n';
    await writeFile(join(sourceRoot, 'data', 'faqs.json'), json);
    await writeFile(join(sourceRoot, 'data', 'faqs.yaml'), yaml);
    const discovery = await discoverSectionRegions(
      root,
      sourceRoot,
      {
        clientId: 'client',
        requestId: 'request',
        route: '/faq',
        selector: '.faqs',
        itemCount: 2,
      },
      normalizeOptions(),
    );
    const jsonCandidate = discovery.candidates?.find((item) => item.filePath.endsWith('.json'));
    const yamlCandidate = discovery.candidates?.find((item) => item.filePath.endsWith('.yaml'));
    expect(jsonCandidate).toBeDefined();
    expect(yamlCandidate).toBeDefined();
    expect(jsonCandidate).toMatchObject({ containerTag: 'data', itemTags: [] });
    const change = (candidate: SectionRegionCandidate) => ({
      kind: 'sections' as const,
      id: 'sections',
      route: '/faq',
      filePath: candidate.filePath,
      regionId: 'faqs',
      sourcePath: candidate.sourcePath,
      before: candidate.items,
      after: [candidate.items[1]!, candidate.items[0]!],
    });
    expect(JSON.parse(applyJsonSections(json, change(jsonCandidate!))).faqs[0].id).toBe('two');
    expect(applyYamlSections(yaml, change(yamlCandidate!))).toMatch(/- id: two[\s\S]*- id: one/u);
  });
});
