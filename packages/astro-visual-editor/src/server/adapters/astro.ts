import { parse, transform } from '@astrojs/compiler';
import type {
  SectionDescriptor,
  SectionTemplate,
  SectionsEditorChange,
  SeoEditorChange,
  SeoField,
  TextEditorChange,
} from '../../shared/types.js';
import {
  applyRanges,
  escapeHtmlAttribute,
  escapeHtmlText,
  type SourceRange,
  uniqueRange,
} from './shared.js';
import { createHash } from 'node:crypto';

interface PositionPoint {
  offset: number;
}
interface AstroNode {
  type: string;
  name?: string;
  value?: string;
  attributes?: Array<{ name: string; value?: string; kind?: string }>;
  children?: AstroNode[];
  position?: { start: PositionPoint; end?: PositionPoint };
}

function walk(
  node: AstroNode,
  visit: (node: AstroNode, parent?: AstroNode) => void,
  parent?: AstroNode,
): void {
  visit(node, parent);
  for (const child of node.children ?? []) walk(child, visit, node);
}

function attribute(node: AstroNode, name: string): string | undefined {
  const found = node.attributes?.find((item) => item.name === name);
  if (!found) return undefined;
  return found.kind === 'empty' ? '' : found.value;
}

function elementSource(source: string, node: AstroNode): string {
  if (!node.position) throw new Error('Astro compiler did not provide source positions.');
  return source.slice(node.position.start.offset, nodeEndOffset(source, node));
}

function nodeEndOffset(source: string, node: AstroNode): number {
  if (!node.position) throw new Error('Astro compiler did not provide a source start position.');
  if (node.position.end) {
    const end = node.position.end.offset;
    if (node.type === 'element' && node.name) {
      const raw = source.slice(node.position.start.offset, end);
      if (raw.includes(`</${node.name}`) && !raw.trimEnd().endsWith('>')) {
        const closingBracket = source.indexOf('>', end);
        const nextTag = source.indexOf('<', end);
        if (closingBracket !== -1 && (nextTag === -1 || closingBracket < nextTag)) {
          return closingBracket + 1;
        }
      }
    }
    if (node.type === 'component' || node.type === 'custom-element') {
      const raw = source.slice(node.position.start.offset, end);
      if (!raw.includes(`</${node.name ?? ''}`)) {
        const selfClosing = source.indexOf('/>', node.position.start.offset);
        const nextTag = source.indexOf('<', node.position.start.offset + 1);
        if (selfClosing !== -1 && (nextTag === -1 || selfClosing < nextTag)) {
          return selfClosing + 2;
        }
      }
    }
    // The compiler currently reports self-closing component positions before
    // the final `>`, while normal element ranges are end-exclusive.
    return source[end] === '>' ? end + 1 : end;
  }
  const end = source.indexOf('>', node.position.start.offset);
  if (end === -1) throw new Error(`Cannot locate the end of <${node.name ?? node.type}>.`);
  return end + 1;
}

async function parseAstro(source: string): Promise<AstroNode> {
  const result = await parse(source, { position: true });
  return result.ast as unknown as AstroNode;
}

function normalizedText(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function normalizedLiteralRange(
  source: string,
  ast: AstroNode,
  renderedText: string,
  label: string,
  root: AstroNode = ast,
): SourceRange {
  const target = normalizedText(renderedText);
  const matches: SourceRange[] = [];
  walk(root, (node) => {
    if (node.type !== 'text' || !node.position?.end) return;
    const raw = source.slice(node.position.start.offset, node.position.end.offset);
    if (normalizedText(raw) !== target) return;
    const leading = raw.search(/\S/u);
    const trailing = raw.search(/\s*$/u);
    if (leading === -1) return;
    matches.push({
      start: node.position.start.offset + leading,
      end: node.position.start.offset + trailing,
      replacement: '',
      label,
    });
  });
  if (matches.length === 0) throw new Error(`Original text was not found for ${label}.`);
  if (matches.length > 1) {
    throw new Error(`Original text is ambiguous for ${label}. Add a structured source path.`);
  }
  return matches[0]!;
}

function sectionScopedRoot(ast: AstroNode, selector?: string): AstroNode | undefined {
  if (!selector) return undefined;
  const match = /\[data-section=(?:"([^"]+)"|'([^']+)')\]/u.exec(selector);
  const sectionId = match?.[1] ?? match?.[2];
  if (!sectionId) return undefined;
  const matches: AstroNode[] = [];
  walk(ast, (node) => {
    if (attribute(node, 'data-section') === sectionId) matches.push(node);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function mappedLiteralRange(
  source: string,
  ast: AstroNode,
  sourcePath: string,
  renderedText: string,
  label: string,
): SourceRange | undefined {
  const match = /^astro:text:(\d+)$/u.exec(sourcePath);
  if (!match) return undefined;
  const offset = Number(match[1]);
  let located: SourceRange | undefined;
  walk(ast, (node) => {
    if (located || node.type !== 'text' || !node.position?.end) return;
    if (node.position.start.offset !== offset) return;
    const raw = source.slice(node.position.start.offset, node.position.end.offset);
    if (normalizedText(raw) !== normalizedText(renderedText)) {
      throw new Error(
        `The confirmed Astro source mapping is stale for ${label}. Run source discovery again.`,
      );
    }
    const leading = raw.search(/\S/u);
    const trailing = raw.search(/\s*$/u);
    if (leading === -1) return;
    located = {
      start: node.position.start.offset + leading,
      end: node.position.start.offset + trailing,
      replacement: '',
      label,
    };
  });
  if (!located) {
    throw new Error(
      `The confirmed Astro source mapping was not found for ${label}. Run source discovery again.`,
    );
  }
  return located;
}

export async function validateAstro(source: string, filename: string): Promise<void> {
  try {
    await transform(source, { filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Astro validation failed after editing ${filename}: ${message}`);
  }
}

function quotedReplacement(source: string, range: SourceRange, value: string): string | undefined {
  const quote = source[range.start - 1];
  if ((quote !== "'" && quote !== '"' && quote !== '`') || source[range.end] !== quote) {
    return undefined;
  }
  let next = value.replaceAll('\\', '\\\\');
  next = next.replaceAll(quote, `\\${quote}`);
  if (quote === '`') next = next.replaceAll('${', '\\${');
  return next;
}

export async function applyAstroText(
  source: string,
  change: TextEditorChange,
  allowUnsafeSourceText = false,
): Promise<string> {
  const ast = await parseAstro(source);
  const label = `${change.filePath} (${change.selector ?? 'text'})`;
  let range = change.sourcePath
    ? mappedLiteralRange(source, ast, change.sourcePath, change.oldText, label)
    : undefined;
  if (!range) {
    try {
      // Match parsed Astro text nodes first so the same words inside attributes,
      // comments or scripts cannot make a visible literal falsely ambiguous.
      const scopedRoot = sectionScopedRoot(ast, change.selector);
      range = normalizedLiteralRange(source, ast, change.oldText, label, scopedRoot ?? ast);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ambiguous')) throw error;
      // Complete quoted values are the only supported non-literal fallback.
      range = uniqueRange(source, change.oldText, label);
    }
  }
  let isLiteralText = false;
  walk(ast, (node) => {
    if (
      node.type === 'text' &&
      node.position?.end &&
      range.start >= node.position.start.offset &&
      range.end <= node.position.end.offset
    ) {
      isLiteralText = true;
    }
  });

  const quoted = quotedReplacement(source, range, change.newText);
  if (!isLiteralText && quoted === undefined) {
    throw new Error(
      `The rendered value in ${change.filePath} is not a literal text node or complete quoted value. ` +
        'Add a structured data-astro-edit-path mapping or edit the source directly.',
    );
  }
  range.replacement = isLiteralText
    ? allowUnsafeSourceText
      ? change.newText
      : escapeHtmlText(change.newText)
    : quoted!;
  const next = applyRanges(source, [range]);
  await validateAstro(next, change.filePath);
  return next;
}

function innerRange(source: string, node: AstroNode, label: string): SourceRange {
  if (!node.position?.end) throw new Error(`Missing source position for ${label}.`);
  const raw = elementSource(source, node);
  const openEnd = raw.indexOf('>');
  const closeStart = raw.lastIndexOf('</');
  if (openEnd === -1 || closeStart === -1 || closeStart < openEnd) {
    throw new Error(`Cannot locate editable content for ${label}.`);
  }
  const start = node.position.start.offset + openEnd + 1;
  return { start, end: node.position.start.offset + closeStart, replacement: '', label };
}

function classifySeoNode(node: AstroNode): SeoField | undefined {
  if (node.type !== 'element') return undefined;
  if (node.name === 'title') return 'title';
  if (node.name === 'link' && attribute(node, 'rel')?.toLowerCase() === 'canonical')
    return 'canonical';
  if (node.name !== 'meta') return undefined;
  const name = attribute(node, 'name')?.toLowerCase();
  const property = attribute(node, 'property')?.toLowerCase();
  if (name === 'description') return 'description';
  if (name === 'keywords') return 'keywords';
  if (name === 'robots') return 'robots';
  if (property === 'og:title') return 'ogTitle';
  if (property === 'og:description') return 'ogDescription';
  return undefined;
}

function currentSeoValue(node: AstroNode, field: SeoField): string {
  if (field === 'title')
    return (node.children ?? [])
      .map((child) => child.value ?? '')
      .join('')
      .trim();
  if (field === 'canonical') return attribute(node, 'href') ?? '';
  return attribute(node, 'content') ?? '';
}

function seoMarkup(field: SeoField, value: string): string {
  const escaped = escapeHtmlAttribute(value);
  switch (field) {
    case 'title':
      return `<title>${escapeHtmlText(value)}</title>`;
    case 'canonical':
      return `<link rel="canonical" href="${escaped}" />`;
    case 'ogTitle':
      return `<meta property="og:title" content="${escaped}" />`;
    case 'ogDescription':
      return `<meta property="og:description" content="${escaped}" />`;
    default:
      return `<meta name="${field}" content="${escaped}" />`;
  }
}

const delegatedSeoProps: Record<SeoField, string> = {
  title: 'title',
  description: 'description',
  keywords: 'keywords',
  canonical: 'canonical',
  ogTitle: 'ogTitle',
  ogDescription: 'ogDescription',
  robots: 'robots',
};

const delegatedSeoLabels: Record<SeoField, string> = {
  title: 'page title',
  description: 'search description',
  keywords: 'keywords',
  canonical: 'canonical URL',
  ogTitle: 'social sharing title',
  ogDescription: 'social sharing description',
  robots: 'search visibility',
};

function literalSeoPropRange(
  source: string,
  ast: AstroNode,
  field: SeoField,
  value: string,
  replacement: string,
  filePath: string,
): SourceRange {
  const propName = delegatedSeoProps[field];
  const matches: SourceRange[] = [];
  walk(ast, (node) => {
    if (!node.position || !['component', 'custom-element'].includes(node.type)) return;
    for (const item of node.attributes ?? []) {
      if (item.name !== propName || item.kind !== 'quoted' || item.value !== value) continue;
      const opening = source.slice(node.position.start.offset, nodeEndOffset(source, node));
      for (const quote of ['"', "'"]) {
        const literal = `${item.name}=${quote}${value}${quote}`;
        let cursor = 0;
        while (cursor <= opening.length) {
          const found = opening.indexOf(literal, cursor);
          if (found === -1) break;
          const start = node.position.start.offset + found + item.name.length + 2;
          matches.push({
            start,
            end: start + value.length,
            replacement: escapeHtmlAttribute(replacement),
            label: `SEO ${delegatedSeoLabels[field]} prop in ${filePath}`,
          });
          cursor = found + literal.length;
        }
      }
    }
  });
  if (matches.length === 0)
    throw new Error(
      `This page delegates its SEO, but ${delegatedSeoLabels[field]} is not a literal “${propName}” prop in ${filePath}.`,
    );
  if (matches.length > 1)
    throw new Error(
      `More than one literal “${propName}” prop matches ${delegatedSeoLabels[field]} in ${filePath}.`,
    );
  return matches[0]!;
}

export async function applyAstroSeo(source: string, change: SeoEditorChange): Promise<string> {
  const ast = await parseAstro(source);
  let head: AstroNode | undefined;
  const existing = new Map<SeoField, AstroNode>();
  walk(ast, (node) => {
    if (node.type === 'element' && node.name === 'head') head ??= node;
    const field = classifySeoNode(node);
    if (field) {
      if (existing.has(field))
        throw new Error(`Duplicate SEO field found in ${change.filePath}: ${field}.`);
      existing.set(field, node);
    }
  });
  const changedFields = (Object.keys(change.after) as SeoField[]).filter(
    (field) => change.after[field] !== change.before[field],
  );
  if (!head?.position?.end) {
    const output = applyRanges(
      source,
      changedFields.map((field) =>
        literalSeoPropRange(
          source,
          ast,
          field,
          change.before[field],
          change.after[field],
          change.filePath,
        ),
      ),
    );
    await validateAstro(output, change.filePath);
    return output;
  }

  const ranges: SourceRange[] = [];
  const inserts: string[] = [];
  for (const field of Object.keys(change.after) as SeoField[]) {
    if (change.after[field] === change.before[field]) continue;
    const node = existing.get(field);
    if (node) {
      const current = currentSeoValue(node, field);
      const comparableCanonical = field !== 'canonical' || /^https?:\/\//u.test(current);
      if (comparableCanonical && current !== change.before[field]) {
        throw new Error(`SEO field changed before commit in ${change.filePath}: ${field}.`);
      }
    } else if (change.before[field]) {
      throw new Error(`SEO field disappeared before commit in ${change.filePath}: ${field}.`);
    }
    if (node?.position) {
      ranges.push({
        start: node.position.start.offset,
        end: nodeEndOffset(source, node),
        replacement: change.after[field] ? seoMarkup(field, change.after[field]) : '',
        label: `SEO ${field}`,
      });
    } else if (change.after[field]) {
      inserts.push(seoMarkup(field, change.after[field]));
    }
  }

  if (inserts.length > 0) {
    const range = innerRange(source, head, 'head');
    const current = source.slice(range.start, range.end);
    const indentMatch = current.match(/\n([ \t]+)\S/u);
    const indent = indentMatch?.[1] ?? '  ';
    range.start = range.end;
    range.replacement = `\n${indent}${inserts.join(`\n${indent}`)}`;
    range.label = 'SEO insertions';
    ranges.push(range);
  }

  const next = applyRanges(source, ranges);
  await validateAstro(next, change.filePath);
  return next;
}

function findRegion(ast: AstroNode, regionId: string): AstroNode {
  const regions: AstroNode[] = [];
  walk(ast, (node) => {
    if (node.type !== 'element') return;
    const named = attribute(node, 'data-astro-edit-region');
    const unnamed = attribute(node, 'data-astro-edit-sections');
    if (named === regionId || (regionId === 'default' && unnamed !== undefined)) regions.push(node);
  });
  if (regions.length !== 1) {
    throw new Error(`Expected one editable section region "${regionId}", found ${regions.length}.`);
  }
  return regions[0]!;
}

function directSections(region: AstroNode): AstroNode[] {
  return (region.children ?? []).filter(
    (node) => node.type === 'element' && attribute(node, 'data-section') !== undefined,
  );
}

function assertUniqueSectionIds(descriptors: SectionDescriptor[], label: string): void {
  const ids = descriptors.map((item) => item.id);
  if (ids.some((id) => !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error(`${label} contains invalid or duplicate section ids.`);
  }
}

function renderTemplate(template: SectionTemplate, id: string): string {
  const markup = template.markup.replaceAll('{{id}}', id);
  if (!/data-section\s*=\s*["'][^"']+["']/u.test(markup)) {
    throw new Error(
      `Section template ${template.id} must include a literal data-section attribute.`,
    );
  }
  return markup;
}

function significantChildren(node: AstroNode): AstroNode[] {
  return (node.children ?? []).filter(
    (child) =>
      Boolean(child.position) &&
      ['element', 'component', 'custom-element', 'fragment'].includes(child.type) &&
      !['style', 'script'].includes(child.name ?? ''),
  );
}

function sourceKey(source: string, node: AstroNode): string {
  return createHash('sha256').update(elementSource(source, node)).digest('hex').slice(0, 20);
}

function mappedChildrenContainer(ast: AstroNode, sourcePath: string): AstroNode {
  const match = /^astro:children:([a-z-]+):([A-Za-z0-9_.:-]+):(\d+)$/u.exec(sourcePath);
  if (!match) throw new Error('The section source mapping is invalid.');
  const [, type, name, occurrenceText] = match;
  const occurrence = Number(occurrenceText);
  const matches: AstroNode[] = [];
  walk(ast, (node) => {
    if (node.type === type && (node.name ?? node.type) === name) matches.push(node);
  });
  const container = matches[occurrence];
  if (!container) {
    throw new Error('The confirmed section source mapping is stale. Run section discovery again.');
  }
  return container;
}

async function applyMappedAstroChildren(
  source: string,
  change: SectionsEditorChange,
  templates: SectionTemplate[],
): Promise<string> {
  assertUniqueSectionIds(change.before, 'Previous section state');
  assertUniqueSectionIds(change.after, 'Next section state');
  const ast = await parseAstro(source);
  const container = mappedChildrenContainer(ast, change.sourcePath!);
  const children = significantChildren(container);
  if (children.length < 2)
    throw new Error('A mapped section region must contain at least two items.');
  const currentKeys = children.map((node) => sourceKey(source, node));
  const beforeKeys = change.before.map((item) => item.sourceKey);
  if (beforeKeys.some((key) => !key) || currentKeys.join('\0') !== beforeKeys.join('\0')) {
    throw new Error(
      'The mapped section source changed before commit. Run section discovery again.',
    );
  }
  const sourceByKey = new Map(
    children.map((node) => [sourceKey(source, node), elementSource(source, node)]),
  );
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const ordered = change.after.map((descriptor) => {
    const existing = descriptor.sourceKey ? sourceByKey.get(descriptor.sourceKey) : undefined;
    if (existing) return existing;
    const template = descriptor.templateId ? templateById.get(descriptor.templateId) : undefined;
    if (!template) throw new Error(`Unknown source item or template for section ${descriptor.id}.`);
    return renderTemplate(template, descriptor.id);
  });
  const first = children[0]!.position!;
  const last = children.at(-1)!;
  const lastEnd = nodeEndOffset(source, last);
  const between = source.slice(first.start.offset, lastEnd);
  const withoutChildren = children.reduce(
    (value, node) => value.replace(elementSource(source, node), ''),
    between,
  );
  if (withoutChildren.trim()) {
    throw new Error('The mapped Astro children are not contiguous; reordering was refused.');
  }
  const gap = between.match(/>([\s\r\n]+)</u)?.[1] ?? '\n';
  const next = applyRanges(source, [
    {
      start: first.start.offset,
      end: lastEnd,
      replacement: ordered.join(gap),
      label: `mapped section region ${change.regionId}`,
    },
  ]);
  await validateAstro(next, change.filePath);
  return next;
}

export async function applyAstroSections(
  source: string,
  change: SectionsEditorChange,
  templates: SectionTemplate[],
): Promise<string> {
  if (change.sourcePath?.startsWith('astro:children:')) {
    return applyMappedAstroChildren(source, change, templates);
  }
  assertUniqueSectionIds(change.before, 'Previous section state');
  assertUniqueSectionIds(change.after, 'Next section state');
  const ast = await parseAstro(source);
  const region = findRegion(ast, change.regionId);
  const sections = directSections(region);
  const current = sections.map((node) => ({ id: attribute(node, 'data-section')! }));
  if (
    current.map((item) => item.id).join('\0') !== change.before.map((item) => item.id).join('\0')
  ) {
    throw new Error(`Section order changed before commit in region "${change.regionId}".`);
  }
  if (sections.length === 0)
    throw new Error('An editable section region must start with at least one section.');

  const byId = new Map<string, string>();
  for (const node of sections)
    byId.set(attribute(node, 'data-section')!, elementSource(source, node));
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const ordered = change.after.map((descriptor) => {
    const existing = byId.get(descriptor.id);
    if (existing) return existing;
    const template = descriptor.templateId ? templateById.get(descriptor.templateId) : undefined;
    if (!template) throw new Error(`Unknown template for new section ${descriptor.id}.`);
    return renderTemplate(template, descriptor.id);
  });

  const first = sections[0]!.position!;
  const last = sections.at(-1)!.position!;
  if (!last.end) throw new Error('The final editable section has no closing source position.');
  const between = source.slice(first.start.offset, last.end.offset);
  const withoutSections = sections.reduce(
    (value, node) => value.replace(elementSource(source, node), ''),
    between,
  );
  if (withoutSections.trim()) {
    throw new Error(
      `Editable region "${change.regionId}" contains non-section markup between sections. ` +
        'Keep editable sections contiguous so reordering cannot discard content.',
    );
  }
  const gap = between.match(/<\/section>([\s\r\n]+)<section/u)?.[1] ?? '\n';
  const range: SourceRange = {
    start: first.start.offset,
    end: last.end.offset,
    replacement: ordered.join(gap),
    label: `section region ${change.regionId}`,
  };
  const next = applyRanges(source, [range]);
  await validateAstro(next, change.filePath);
  return next;
}
