import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { parse as parseAstro } from '@astrojs/compiler';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';
import { parseDocument } from 'yaml';
import type { NormalizedOptions } from '../options.js';
import type {
  SourceCandidate,
  SourceCandidateFormat,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  SectionDiscoveryRequest,
  SectionDiscoveryResponse,
  SectionRegionCandidate,
} from '../shared/types.js';

const MAX_DISCOVERY_FILES = 2_000;
const ignoredDirectories = new Set([
  '.astro',
  '.git',
  '.astro-visual-editor',
  'dist',
  'node_modules',
]);

interface PositionPoint {
  offset: number;
  line?: number;
}

interface AstroNode {
  type: string;
  name?: string;
  value?: string;
  children?: AstroNode[];
  position?: { start: PositionPoint; end?: PositionPoint };
}

interface Match {
  sourcePath?: string;
  line: number;
  reason: string;
}

function normalize(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function idFor(filePath: string, sourcePath: string | undefined, line: number): string {
  return createHash('sha256')
    .update(`${filePath}\0${sourcePath ?? ''}\0${line}`)
    .digest('hex')
    .slice(0, 20);
}

function lineAt(source: string, offset: number): number {
  return source.slice(0, offset).split('\n').length;
}

function walkAstro(node: AstroNode, visit: (node: AstroNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walkAstro(child, visit);
}

async function astroMatches(source: string, text: string): Promise<Match[]> {
  const parsed = await parseAstro(source, { position: true });
  const target = normalize(text);
  const matches: Match[] = [];
  walkAstro(parsed.ast as unknown as AstroNode, (node) => {
    if (node.type !== 'text' || !node.position?.end) return;
    const raw = source.slice(node.position.start.offset, node.position.end.offset);
    if (normalize(raw) !== target) return;
    matches.push({
      sourcePath: `astro:text:${node.position.start.offset}`,
      line: node.position.start.line ?? lineAt(source, node.position.start.offset),
      reason: 'Exact Astro literal text node.',
    });
  });
  return matches;
}

function pathLabel(parts: Array<string | number>): string {
  return parts
    .map((part, index) =>
      typeof part === 'number' ? `[${part}]` : index === 0 ? part : `.${part}`,
    )
    .join('');
}

function scalarMatches(
  value: unknown,
  text: string,
  parts: Array<string | number> = [],
): Array<{ path: string }> {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return normalize(String(value)) === normalize(text) ? [{ path: pathLabel(parts) }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => scalarMatches(item, text, [...parts, index]));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      scalarMatches(item, text, [...parts, key]),
    );
  }
  return [];
}

function valueSourceKey(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
}

function structuredItemId(value: unknown, sourceKey: string): string {
  let hint = 'item';
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record.id ?? record.slug ?? record.key ?? record.title ?? record.name;
    if (typeof candidate === 'string') hint = candidate;
  }
  const base = hint
    .replace(/[^A-Za-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
  return `${/^[a-z]/u.test(base) ? base : 'item'}-${sourceKey.slice(0, 10)}`;
}

function arraysOfLength(
  value: unknown,
  itemCount: number,
  parts: Array<string | number> = [],
): Array<{ path: string; items: unknown[] }> {
  const found: Array<{ path: string; items: unknown[] }> = [];
  if (Array.isArray(value)) {
    if (value.length === itemCount) found.push({ path: pathLabel(parts), items: value });
    value.forEach((item, index) =>
      found.push(...arraysOfLength(item, itemCount, [...parts, index])),
    );
  } else if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, item]) =>
      found.push(...arraysOfLength(item, itemCount, [...parts, key])),
    );
  }
  return found;
}

function structuredRegionCandidates(
  source: string,
  extension: string,
  filePath: string,
  itemCount: number,
  confidence: 'exact' | 'likely',
): SectionRegionCandidate[] {
  let value: unknown;
  if (extension === '.json' || extension === '.jsonc') {
    const errors: ParseError[] = [];
    value = parseJsonc(source, errors, { allowTrailingComma: true });
    if (errors.length > 0) return [];
  } else {
    const document = parseDocument(source);
    if (document.errors.length > 0) return [];
    value = document.toJS();
  }
  return arraysOfLength(value, itemCount).flatMap(({ path, items }) => {
    const mapped = items.map((item) => {
      const key = valueSourceKey(item);
      return { id: structuredItemId(item, key), sourceKey: key };
    });
    if (new Set(mapped.map((item) => item.sourceKey)).size !== mapped.length) return [];
    const kind = extension === '.json' || extension === '.jsonc' ? 'json' : 'yaml';
    const sourcePath = `${kind}:array:${path}`;
    return [
      {
        id: idFor(filePath, sourcePath, 1),
        filePath,
        sourcePath,
        line: 1,
        confidence,
        reason: `${itemCount} ordered items in the structured array ${path}. Every complete item is hash-checked before reordering.`,
        items: mapped,
      },
    ];
  });
}

export function resolveStructuredRegionItems(
  source: string,
  extension: string,
  sourcePath: string,
): Array<{ id: string; sourceKey: string }> {
  const match = /^(json|yaml):array:(.+)$/u.exec(sourcePath);
  if (!match) throw new Error('The saved structured section mapping is invalid.');
  let value: unknown;
  if (match[1] === 'json') {
    const errors: ParseError[] = [];
    value = parseJsonc(source, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error('The mapped JSON source is invalid.');
  } else {
    const document = parseDocument(source);
    if (document.errors.length > 0) throw new Error('The mapped YAML source is invalid.');
    value = document.toJS();
  }
  const parts = match[2]!
    .replace(/\[(\d+)\]/gu, '.$1')
    .split('.')
    .filter(Boolean)
    .map((part) => (/^\d+$/u.test(part) ? Number(part) : part));
  for (const part of parts) {
    if (typeof value !== 'object' || value === null || !(part in value)) {
      throw new Error('The saved structured section array no longer exists.');
    }
    value = (value as Record<string | number, unknown>)[part];
  }
  if (!Array.isArray(value))
    throw new Error('The saved structured section source is not an array.');
  const items = value.map((item) => {
    const key = valueSourceKey(item);
    return { id: structuredItemId(item, key), sourceKey: key };
  });
  if (new Set(items.map((item) => item.sourceKey)).size !== items.length) {
    throw new Error(
      'The mapped structured array contains duplicate items without stable identities.',
    );
  }
  if ((match[1] === 'json') !== ['.json', '.jsonc'].includes(extension)) {
    throw new Error('The saved structured section format no longer matches its source file.');
  }
  return items;
}

function jsonMatches(source: string, text: string): Match[] {
  const errors: ParseError[] = [];
  const value = parseJsonc(source, errors, { allowTrailingComma: true });
  if (errors.length > 0) return [];
  return scalarMatches(value, text).map(({ path }) => ({
    sourcePath: path,
    line: source.split('\n').findIndex((line) => line.includes(JSON.stringify(text))) + 1 || 1,
    reason: `Exact structured value at ${path}.`,
  }));
}

function yamlMatches(source: string, text: string, prefix = ''): Match[] {
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length > 0) return [];
  return scalarMatches(document.toJS(), text).map(({ path }) => ({
    sourcePath: prefix ? `${prefix}.${path}` : path,
    line: source.split('\n').findIndex((line) => line.includes(text)) + 1 || 1,
    reason: `Exact structured value at ${prefix ? `${prefix}.` : ''}${path}.`,
  }));
}

function markdownMatches(source: string, text: string, allowBody: boolean): Match[] {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  const matches: Match[] = [];
  if (frontmatter?.[1]) {
    const start = source.indexOf(frontmatter[1]);
    matches.push(
      ...yamlMatches(frontmatter[1], text, 'frontmatter').map((match) => ({
        ...match,
        line: lineAt(source, start) + match.line - 1,
      })),
    );
  }
  if (!allowBody) return matches;
  const bodyStart = frontmatter
    ? source.indexOf('---', source.indexOf(frontmatter[1]!) + frontmatter[1]!.length) + 3
    : 0;
  const body = source.slice(bodyStart);
  let cursor = 0;
  while (cursor <= body.length) {
    const found = body.indexOf(text, cursor);
    if (found === -1) break;
    const absolute = bodyStart + found;
    matches.push({
      sourcePath: `markdown:body:${absolute}`,
      line: lineAt(source, absolute),
      reason: 'Exact Markdown body text.',
    });
    cursor = found + Math.max(1, text.length);
  }
  return matches;
}

async function sourceFiles(
  sourceRoot: string,
  options: NormalizedOptions,
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  let truncated = false;
  async function visit(directory: string): Promise<void> {
    if (files.length >= MAX_DISCOVERY_FILES) {
      truncated = true;
      return;
    }
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= MAX_DISCOVERY_FILES) {
        truncated = true;
        return;
      }
      if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue;
      const fullPath = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (
        entry.isFile() &&
        options.allowedExtensions.includes(extname(entry.name).toLowerCase() as never)
      ) {
        const details = await stat(fullPath);
        if (details.size <= options.maxSourceFileBytes) files.push(fullPath);
      }
    }
  }
  await visit(sourceRoot);
  return { files, truncated };
}

function displayPath(projectRoot: string, fullPath: string): string {
  return relative(projectRoot, fullPath).split(sep).join('/');
}

function formatFor(extension: string): SourceCandidateFormat {
  if (extension === '.astro') return 'astro';
  if (extension === '.json' || extension === '.jsonc') return 'json';
  if (extension === '.yaml' || extension === '.yml') return 'yaml';
  return 'markdown';
}

function likelyRouteFiles(route: string): Set<string> {
  const clean = route.replace(/^\/+|\/+$/gu, '');
  if (!clean)
    return new Set(['src/pages/index.astro', 'src/pages/index.md', 'src/pages/index.mdx']);
  return new Set([
    `src/pages/${clean}.astro`,
    `src/pages/${clean}.md`,
    `src/pages/${clean}.mdx`,
    `src/pages/${clean}/index.astro`,
    `src/pages/${clean}/index.md`,
    `src/pages/${clean}/index.mdx`,
  ]);
}

export async function discoverSources(
  projectRoot: string,
  sourceRoot: string,
  request: SourceDiscoveryRequest,
  options: NormalizedOptions,
): Promise<SourceDiscoveryResponse> {
  try {
    const listing = await sourceFiles(sourceRoot, options);
    const routeFiles = likelyRouteFiles(request.route);
    const candidates: SourceCandidate[] = [];
    for (const fullPath of listing.files) {
      const source = await readFile(fullPath, 'utf8');
      const filePath = displayPath(projectRoot, fullPath);
      const extension = extname(fullPath).toLowerCase();
      let matches: Match[] = [];
      if (extension === '.astro') matches = await astroMatches(source, request.text);
      else if (extension === '.json' || extension === '.jsonc')
        matches = jsonMatches(source, request.text);
      else if (extension === '.yaml' || extension === '.yml')
        matches = yamlMatches(source, request.text);
      else if (extension === '.md' || extension === '.mdx')
        matches = markdownMatches(source, request.text, extension === '.md');
      for (const match of matches) {
        const hinted = request.hintedFilePath === filePath;
        const routeOwned = routeFiles.has(filePath);
        candidates.push({
          id: idFor(filePath, match.sourcePath, match.line),
          filePath,
          sourcePath: match.sourcePath,
          format: formatFor(extension),
          line: match.line,
          confidence: hinted || routeOwned ? 'exact' : 'likely',
          reason: `${match.reason}${hinted ? ' Matches the current source hint.' : routeOwned ? ' Matches the current route.' : ''}`,
        });
      }
    }
    candidates.sort((left, right) => {
      if (left.confidence !== right.confidence) return left.confidence === 'exact' ? -1 : 1;
      return left.filePath.localeCompare(right.filePath) || left.line - right.line;
    });
    return {
      clientId: request.clientId,
      requestId: request.requestId,
      success: true,
      candidates: candidates.slice(0, 100),
      searchedFiles: listing.files.length,
      truncated: listing.truncated || candidates.length > 100,
    };
  } catch (error) {
    return {
      clientId: request.clientId,
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unable to search project sources.',
    };
  }
}

function nodeEnd(source: string, node: AstroNode): number {
  if (node.position?.end) {
    const end = node.position.end.offset;
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
    return source[end] === '>' ? end + 1 : end;
  }
  if (!node.position) return -1;
  const end = source.indexOf('>', node.position.start.offset);
  return end === -1 ? -1 : end + 1;
}

function significantChildren(node: AstroNode): AstroNode[] {
  return (node.children ?? []).filter(
    (child) =>
      Boolean(child.position) &&
      ['element', 'component', 'custom-element', 'fragment'].includes(child.type) &&
      !['style', 'script'].includes(child.name ?? ''),
  );
}

function nodeSourceKey(source: string, node: AstroNode): string {
  const end = nodeEnd(source, node);
  if (!node.position || end < node.position.start.offset) return '';
  return createHash('sha256')
    .update(source.slice(node.position.start.offset, end))
    .digest('hex')
    .slice(0, 20);
}

function safeItemId(node: AstroNode, sourceKey: string): string {
  const base = (node.name ?? node.type)
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/[^A-Za-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase();
  return `${/^[a-z]/u.test(base) ? base : `section-${base || 'item'}`}-${sourceKey.slice(0, 10)}`;
}

function locateChildrenContainer(ast: AstroNode, sourcePath: string): AstroNode | undefined {
  const match = /^astro:children:([a-z-]+):([A-Za-z0-9_.:-]+):(\d+)$/u.exec(sourcePath);
  if (!match) return undefined;
  const [, type, name, occurrenceText] = match;
  const matches: AstroNode[] = [];
  walkAstro(ast, (node) => {
    if (node.type === type && (node.name ?? node.type) === name) matches.push(node);
  });
  return matches[Number(occurrenceText)];
}

export async function resolveAstroRegionItems(
  source: string,
  sourcePath: string,
): Promise<Array<{ id: string; sourceKey: string }>> {
  const parsed = await parseAstro(source, { position: true });
  const container = locateChildrenContainer(parsed.ast as unknown as AstroNode, sourcePath);
  if (!container) throw new Error('The saved section mapping no longer exists in its Astro file.');
  return significantChildren(container).map((child) => {
    const key = nodeSourceKey(source, child);
    return { id: safeItemId(child, key), sourceKey: key };
  });
}

async function astroRegionCandidates(
  source: string,
  filePath: string,
  itemCount: number,
  confidence: 'exact' | 'likely',
): Promise<SectionRegionCandidate[]> {
  const parsed = await parseAstro(source, { position: true });
  const candidates: SectionRegionCandidate[] = [];
  const occurrences = new Map<string, number>();
  walkAstro(parsed.ast as unknown as AstroNode, (node) => {
    const name = node.name ?? node.type;
    const identity = `${node.type}:${name}`;
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    const children = significantChildren(node);
    if (children.length !== itemCount || !node.position) return;
    const items = children.map((child) => {
      const key = nodeSourceKey(source, child);
      return { id: safeItemId(child, key), sourceKey: key };
    });
    if (items.some((item) => !item.sourceKey)) return;
    const sourcePath = `astro:children:${node.type}:${name}:${occurrence}`;
    candidates.push({
      id: idFor(filePath, sourcePath, node.position.start.line ?? 1),
      filePath,
      sourcePath,
      line: node.position.start.line ?? lineAt(source, node.position.start.offset),
      confidence,
      reason: `${itemCount} contiguous source-owned Astro children inside <${name}>. The exact source blocks are hash-checked before reordering.`,
      items,
    });
  });
  return candidates;
}

export async function discoverSectionRegions(
  projectRoot: string,
  sourceRoot: string,
  request: SectionDiscoveryRequest,
  options: NormalizedOptions,
): Promise<SectionDiscoveryResponse> {
  try {
    const listing = await sourceFiles(sourceRoot, options);
    const routeFiles = likelyRouteFiles(request.route);
    const candidates: SectionRegionCandidate[] = [];
    for (const fullPath of listing.files) {
      const filePath = displayPath(projectRoot, fullPath);
      const extension = extname(fullPath).toLowerCase();
      if (!['.astro', '.json', '.jsonc', '.yaml', '.yml'].includes(extension)) continue;
      const source = await readFile(fullPath, 'utf8');
      const exact = request.hintedFilePath === filePath || routeFiles.has(filePath);
      if (extension === '.astro') {
        candidates.push(
          ...(await astroRegionCandidates(
            source,
            filePath,
            request.itemCount,
            exact ? 'exact' : 'likely',
          )),
        );
      } else {
        candidates.push(
          ...structuredRegionCandidates(
            source,
            extension,
            filePath,
            request.itemCount,
            exact ? 'exact' : 'likely',
          ),
        );
      }
    }
    candidates.sort((left, right) => {
      if (left.confidence !== right.confidence) return left.confidence === 'exact' ? -1 : 1;
      return left.filePath.localeCompare(right.filePath) || left.line - right.line;
    });
    return {
      clientId: request.clientId,
      requestId: request.requestId,
      success: true,
      candidates: candidates.slice(0, 100),
      searchedFiles: listing.files.length,
    };
  } catch (error) {
    return {
      clientId: request.clientId,
      requestId: request.requestId,
      success: false,
      error: error instanceof Error ? error.message : 'Unable to discover section sources.',
    };
  }
}
