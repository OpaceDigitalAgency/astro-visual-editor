import { realpath, readFile, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { EditorChange } from '../shared/types.js';
import type { NormalizedOptions } from '../options.js';

export interface ApplyBatchResult {
  files: string[];
  changeCount: number;
}

function isWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent === '' ||
    (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== '..' && !isAbsolute(pathFromParent))
  );
}

function countOccurrences(source: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = source.indexOf(needle, cursor)) !== -1) {
    count += 1;
    cursor += needle.length;
  }
  return count;
}

function validateText(change: EditorChange, options: NormalizedOptions): void {
  if (!change.oldText || !change.newText) {
    throw new Error('Both oldText and newText are required.');
  }
  if (change.newText.length > options.maxTextLength) {
    throw new Error(`Edited text exceeds the ${options.maxTextLength}-character limit.`);
  }
  if (change.newText.includes('\0')) {
    throw new Error('Edited text cannot contain a null byte.');
  }
  if (!options.allowUnsafeSourceText && /[<>{}]/u.test(change.newText)) {
    throw new Error(
      'Edited text contains Astro source characters (<, >, { or }). ' +
        'Use code editing for markup, or explicitly enable allowUnsafeSourceText.',
    );
  }
}

async function resolveEditableFile(
  projectRoot: string,
  sourceRoot: string,
  filePath: string,
  options: NormalizedOptions,
): Promise<string> {
  if (!filePath || isAbsolute(filePath)) {
    throw new Error('Source file paths must be project-relative.');
  }

  const candidate = resolve(projectRoot, filePath);
  const realSourceRoot = await realpath(sourceRoot);
  let realCandidate: string;
  try {
    realCandidate = await realpath(candidate);
  } catch {
    throw new Error(`Source file does not exist: ${filePath}`);
  }

  if (!isWithin(realSourceRoot, realCandidate)) {
    throw new Error(`Source file is outside the configured source directory: ${filePath}`);
  }

  const extension = extname(realCandidate).toLowerCase();
  if (!options.allowedExtensions.includes(extension as never)) {
    throw new Error(`File extension is not editable: ${extension || '(none)'}`);
  }

  return realCandidate;
}

export async function applyChangeBatch(
  projectRoot: string,
  sourceRoot: string,
  changes: EditorChange[],
  options: NormalizedOptions,
): Promise<ApplyBatchResult> {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error('At least one queued change is required.');
  }
  if (changes.length > options.maxChanges) {
    throw new Error(`A batch cannot contain more than ${options.maxChanges} changes.`);
  }

  const prepared = new Map<string, { displayPath: string; original: string; next: string }>();

  for (const change of changes) {
    validateText(change, options);
    const fullPath = await resolveEditableFile(projectRoot, sourceRoot, change.filePath, options);
    let file = prepared.get(fullPath);
    if (!file) {
      const original = await readFile(fullPath, 'utf8');
      file = { displayPath: change.filePath, original, next: original };
      prepared.set(fullPath, file);
    }

    const occurrences = countOccurrences(file.next, change.oldText);
    if (occurrences === 0) {
      throw new Error(
        `Original text was not found in ${change.filePath}. The file may have changed.`,
      );
    }
    if (occurrences > 1) {
      throw new Error(
        `Original text is ambiguous in ${change.filePath} (${occurrences} matches). ` +
          'Add a more specific data-astro-edit-file mapping or edit the source directly.',
      );
    }

    file.next = file.next.replace(change.oldText, change.newText);
  }

  const written: Array<[string, string]> = [];
  try {
    for (const [fullPath, file] of prepared) {
      await writeFile(fullPath, file.next, 'utf8');
      written.push([fullPath, file.original]);
    }
  } catch (error) {
    await Promise.allSettled(
      written.map(([fullPath, original]) => writeFile(fullPath, original, 'utf8')),
    );
    throw error;
  }

  return {
    files: [...prepared.values()].map((file) => file.displayPath),
    changeCount: changes.length,
  };
}

