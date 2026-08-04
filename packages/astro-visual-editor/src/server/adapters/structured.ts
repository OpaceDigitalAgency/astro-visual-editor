import { applyEdits, modify, parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import { parseDocument } from 'yaml';
import type { TextEditorChange } from '../../shared/types.js';
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
