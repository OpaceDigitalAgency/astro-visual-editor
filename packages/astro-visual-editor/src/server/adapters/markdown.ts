import { parseDocument } from 'yaml';
import type { SeoEditorChange, SeoField, TextEditorChange } from '../../shared/types.js';
import { applyRanges, pathParts, uniqueRange } from './shared.js';

interface Frontmatter {
  start: number;
  end: number;
  body: string;
}

function frontmatter(source: string): Frontmatter | undefined {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return undefined;
  const start = source.indexOf(match[1]!);
  return { start, end: start + match[1]!.length, body: match[1]! };
}

function updateFrontmatter(
  source: string,
  updater: (document: ReturnType<typeof parseDocument>) => void,
): string {
  const block = frontmatter(source);
  if (!block) throw new Error('Markdown source has no YAML frontmatter block.');
  const document = parseDocument(block.body, { keepSourceTokens: true });
  if (document.errors.length > 0) {
    throw new Error(`Markdown frontmatter is invalid: ${document.errors[0]!.message}`);
  }
  updater(document);
  const replacement = document.toString({ lineWidth: 0 }).trimEnd();
  return applyRanges(source, [
    { start: block.start, end: block.end, replacement, label: 'Markdown frontmatter' },
  ]);
}

export function applyMarkdownText(source: string, change: TextEditorChange): string {
  if (change.sourcePath) {
    const path = pathParts(change.sourcePath.replace(/^frontmatter\./u, ''));
    return updateFrontmatter(source, (document) => {
      const current = document.getIn(path, true);
      if (String(current ?? '') !== change.oldText) {
        throw new Error(`Frontmatter value changed before commit: ${change.sourcePath}.`);
      }
      document.setIn(path, change.newText);
    });
  }
  const block = frontmatter(source);
  const bodyStart = block ? source.indexOf('---', block.end) + 3 : 0;
  const body = source.slice(bodyStart);
  const relative = uniqueRange(body, change.oldText, `${change.filePath} Markdown body`);
  relative.start += bodyStart;
  relative.end += bodyStart;
  relative.replacement = change.newText;
  return applyRanges(source, [relative]);
}

const seoPaths: Record<SeoField, Array<string>> = {
  title: ['title'],
  description: ['description'],
  keywords: ['keywords'],
  canonical: ['canonical'],
  ogTitle: ['openGraph', 'title'],
  ogDescription: ['openGraph', 'description'],
  robots: ['robots'],
};

export function applyMarkdownSeo(source: string, change: SeoEditorChange): string {
  return updateFrontmatter(source, (document) => {
    for (const field of Object.keys(change.after) as SeoField[]) {
      if (change.after[field] === change.before[field]) continue;
      const path = seoPaths[field];
      if (change.after[field]) document.setIn(path, change.after[field]);
      else document.deleteIn(path);
    }
  });
}
