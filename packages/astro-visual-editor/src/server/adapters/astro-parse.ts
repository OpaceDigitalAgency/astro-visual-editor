import { parse } from '@astrojs/compiler';
import { describe, expect, it } from 'vitest';
import {
  normalizeCompilerOffsets,
  parseAstroSource,
  utf8ByteToCharMap,
} from '../src/server/adapters/astro-parse.js';

interface Node {
  type: string;
  name?: string;
  position?: { start: { offset: number }; end?: { offset: number } };
  children?: Node[];
  attributes?: Node[];
}

function collect(node: Node, out: Node[] = []): Node[] {
  out.push(node);
  for (const child of node.children ?? []) collect(child, out);
  return out;
}

function sliceOf(source: string, node: Node): string {
  return source.slice(node.position!.start.offset, node.position!.end?.offset);
}

describe('utf8ByteToCharMap', () => {
  it('is the identity for ASCII', () => {
    const map = utf8ByteToCharMap('abc');
    expect(Array.from(map)).toEqual([0, 1, 2, 3]);
  });

  it('maps every byte of a multi-byte character to its first code unit', () => {
    // "ä" = 2 bytes, "€" = 3 bytes, "😀" = 4 bytes and 2 UTF-16 code units.
    const source = 'aä€😀z';
    const map = utf8ByteToCharMap(source);
    expect(Buffer.byteLength(source, 'utf8')).toBe(11);
    expect(map.length).toBe(12);
    expect(Array.from(map)).toEqual([0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 5, 6]);
    expect(map[map.length - 1]).toBe(source.length);
  });
});

describe('parseAstroSource', () => {
  const source = `---
const title = 'Über uns';
---
<h1 class="größe">Grüße äöü ß 😀</h1>
<p data-astro-edit-id="lead">Zweiter Absatz — mit Gedankenstrich</p>`;

  it('demonstrates that the raw compiler emits byte offsets', async () => {
    const { ast } = await parse(source, { position: true });
    const paragraph = collect(ast as unknown as Node).find((node) => node.name === 'p')!;
    // Raw offsets are shifted by the number of extra UTF-8 bytes preceding them.
    expect(sliceOf(source, paragraph)).not.toBe(
      '<p data-astro-edit-id="lead">Zweiter Absatz — mit Gedankenstrich</p>',
    );
  });

  it('returns offsets that slice the source exactly', async () => {
    const { ast } = await parseAstroSource(source);
    const nodes = collect(ast as unknown as Node);
    const heading = nodes.find((node) => node.name === 'h1')!;
    const paragraph = nodes.find((node) => node.name === 'p')!;
    const headingText = heading.children!.find((node) => node.type === 'text')!;
    const paragraphText = paragraph.children!.find((node) => node.type === 'text')!;

    expect(sliceOf(source, heading)).toBe('<h1 class="größe">Grüße äöü ß 😀</h1>');
    expect(sliceOf(source, headingText)).toBe('Grüße äöü ß 😀');
    expect(sliceOf(source, paragraph)).toBe(
      '<p data-astro-edit-id="lead">Zweiter Absatz — mit Gedankenstrich</p>',
    );
    expect(sliceOf(source, paragraphText)).toBe('Zweiter Absatz — mit Gedankenstrich');
  });

  it('normalizes attribute positions too', async () => {
    const { ast } = await parseAstroSource(source);
    const heading = collect(ast as unknown as Node).find((node) => node.name === 'h1')!;
    const attribute = heading.attributes![0]!;
    expect(source.slice(attribute.position!.start.offset)).toMatch(/^class="größe"/u);
  });

  it('leaves ASCII-only sources untouched', async () => {
    const ascii = '<main><h1>Hello</h1><p>World</p></main>';
    const raw = await parse(ascii, { position: true });
    const normalized = await parseAstroSource(ascii);
    expect(JSON.stringify(normalized.ast)).toBe(JSON.stringify(raw.ast));
  });

  it('rejects offsets beyond the end of the source', () => {
    expect(() => normalizeCompilerOffsets({ position: { start: { offset: 99 } } }, 'kurz')).toThrow(
      /beyond the end of the source/u,
    );
  });
});
