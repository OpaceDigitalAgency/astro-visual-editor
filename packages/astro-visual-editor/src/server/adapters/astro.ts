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

function walk(node: AstroNode, visit: (node: AstroNode, parent?: AstroNode) => void, parent?: AstroNode): void {
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
  if (node.position.end) return node.position.end.offset;
  const end = source.indexOf('>', node.position.start.offset);
  if (end === -1) throw new Error(`Cannot locate the end of <${node.name ?? node.type}>.`);
  return end + 1;
}

async function parseAstro(source: string): Promise<AstroNode> {
  const result = await parse(source, { position: true });
  return result.ast as unknown as AstroNode;
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
  const range = uniqueRange(source, change.oldText, `${change.filePath} (${change.selector ?? 'text'})`);
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
  if (node.name === 'link' && attribute(node, 'rel')?.toLowerCase() === 'canonical') return 'canonical';
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
  if (field === 'title') return (node.children ?? []).map((child) => child.value ?? '').join('').trim();
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

export async function applyAstroSeo(source: string, change: SeoEditorChange): Promise<string> {
  const ast = await parseAstro(source);
  let head: AstroNode | undefined;
  const existing = new Map<SeoField, AstroNode>();
  walk(ast, (node) => {
    if (node.type === 'element' && node.name === 'head') head ??= node;
    const field = classifySeoNode(node);
    if (field) {
      if (existing.has(field)) throw new Error(`Duplicate SEO field found in ${change.filePath}: ${field}.`);
      existing.set(field, node);
    }
  });
  if (!head?.position?.end) throw new Error(`No literal <head> element found in ${change.filePath}.`);

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
    throw new Error(`Section template ${template.id} must include a literal data-section attribute.`);
  }
  return markup;
}

export async function applyAstroSections(
  source: string,
  change: SectionsEditorChange,
  templates: SectionTemplate[],
): Promise<string> {
  assertUniqueSectionIds(change.before, 'Previous section state');
  assertUniqueSectionIds(change.after, 'Next section state');
  const ast = await parseAstro(source);
  const region = findRegion(ast, change.regionId);
  const sections = directSections(region);
  const current = sections.map((node) => ({ id: attribute(node, 'data-section')! }));
  if (current.map((item) => item.id).join('\0') !== change.before.map((item) => item.id).join('\0')) {
    throw new Error(`Section order changed before commit in region "${change.regionId}".`);
  }
  if (sections.length === 0) throw new Error('An editable section region must start with at least one section.');

  const byId = new Map<string, string>();
  for (const node of sections) byId.set(attribute(node, 'data-section')!, elementSource(source, node));
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
