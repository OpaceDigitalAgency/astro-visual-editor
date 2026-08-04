import { realpath, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { NormalizedOptions } from '../options.js';

export interface SourceSnapshot {
  fullPath: string;
  displayPath: string;
  extension: string;
  source: string;
  hash: string;
}

export function hashSource(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex');
}

function isWithin(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent === '' ||
    (!pathFromParent.startsWith(`..${sep}`) &&
      pathFromParent !== '..' &&
      !isAbsolute(pathFromParent))
  );
}

export async function readSourceSnapshot(
  projectRoot: string,
  sourceRoot: string,
  filePath: string,
  options: NormalizedOptions,
): Promise<SourceSnapshot> {
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

  const details = await stat(realCandidate);
  if (!details.isFile()) throw new Error(`Source path is not a file: ${filePath}`);
  if (details.size > options.maxSourceFileBytes) {
    throw new Error(
      `Source file exceeds the ${options.maxSourceFileBytes}-byte limit: ${filePath}`,
    );
  }

  const source = await readFile(realCandidate, 'utf8');
  return {
    fullPath: realCandidate,
    displayPath: filePath,
    extension,
    source,
    hash: hashSource(source),
  };
}
