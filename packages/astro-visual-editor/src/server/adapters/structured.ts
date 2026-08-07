import { applyEdits, modify, parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import { parseDocument } from 'yaml';
import { createHash } from 'node:crypto';
import type { SectionsEditorChange, TextEditorChange } from '../../shared/types.js';
import { pathParts } from './shared.js';

export function applyJsonText(source: string, change: TextEditorChange): string {
  if (!change.sourcePath) {
    throw new Error(`JSON edits require data-astro-edit-path for ${change.filePath}.`);
  }
  const errors: Array<{ error: number; offset: number; length: number }> = [];
  const value = parseJsonc(source, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    throw new Error(`JSON source is invalid: ${printParseErrorCode(errors[0]!.error)}.`);
  }
  const path = pathParts(change.sourcePath);
  let current: unknown = value;
  for (const part of path) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      throw new Error(`JSON sourcePath was not found: ${change.sourcePath}.`);
    }
    current = (current as Record<string | number, unknown>)[part];
  }
  if (String(current) !== change.oldText) {
    throw new Error(`JSON value changed before commit: ${change.sourcePath}.`);
  }
  return applyEdits(
    source,
    modify(source, path, change.newText, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: source.includes('\r\n') ? '\r\n' : '\n',
      },
    }),
  );
}

export function applyYamlText(source: string, change: TextEditorChange): string {
  if (!change.sourcePath) {
    throw new Error(`YAML edits require data-astro-edit-path for ${change.filePath}.`);
  }
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length > 0)
    throw new Error(`YAML source is invalid: ${document.errors[0]!.message}`);
  const path = pathParts(change.sourcePath);
  const current = document.getIn(path, true);
  if (String(current ?? '') !== change.oldText) {
    throw new Error(`YAML value changed before commit: ${change.sourcePath}.`);
  }
  document.setIn(path, change.newText);
  return document.toString({ lineWidth: 0 });
}

function sourceKey(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20);
}

function valueAtPath(value: unknown, path: Array<string | number>, label: string): unknown {
  let current = value;
  for (const part of path) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      throw new Error(`${label} was not found.`);
    }
    current = (current as Record<string | number, unknown>)[part];
  }
  return current;
}

function reorderedArray(current: unknown, change: SectionsEditorChange): unknown[] {
  if (!Array.isArray(current))
    throw new Error('The mapped structured section source is not an array.');
  const keys = current.map(sourceKey);
  if (keys.join('\0') !== change.before.map((item) => item.sourceKey).join('\0')) {
    throw new Error('The mapped structured section array changed before commit. Rediscover it.');
  }
  const values = new Map(keys.map((key, index) => [key, current[index]]));
  return change.after.map((item) => {
    if (!item.sourceKey || !values.has(item.sourceKey)) {
      throw new Error('Adding template sections to a structured array requires a project schema.');
    }
    return values.get(item.sourceKey);
  });
}

export function applyJsonSections(source: string, change: SectionsEditorChange): string {
  const prefix = 'json:array:';
  if (!change.sourcePath?.startsWith(prefix))
    throw new Error('The JSON section mapping is invalid.');
  const errors: Array<{ error: number; offset: number; length: number }> = [];
  const value = parseJsonc(source, errors, { allowTrailingComma: true });
  if (errors.length > 0)
    throw new Error(`JSON source is invalid: ${printParseErrorCode(errors[0]!.error)}.`);
  const path = pathParts(change.sourcePath.slice(prefix.length));
  const nextArray = reorderedArray(valueAtPath(value, path, 'JSON section array'), change);
  return applyEdits(
    source,
    modify(source, path, nextArray, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: source.includes('\r\n') ? '\r\n' : '\n',
      },
    }),
  );
}

export function applyYamlSections(source: string, change: SectionsEditorChange): string {
  const prefix = 'yaml:array:';
  if (!change.sourcePath?.startsWith(prefix))
    throw new Error('The YAML section mapping is invalid.');
  const document = parseDocument(source, { keepSourceTokens: true });
  if (document.errors.length > 0)
    throw new Error(`YAML source is invalid: ${document.errors[0]!.message}`);
  const path = pathParts(change.sourcePath.slice(prefix.length));
  const nextArray = reorderedArray(
    valueAtPath(document.toJS(), path, 'YAML section array'),
    change,
  );
  document.setIn(path, nextArray);
  return document.toString({ lineWidth: 0 });
}
