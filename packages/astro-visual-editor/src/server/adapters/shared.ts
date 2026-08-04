export interface SourceRange {
  start: number;
  end: number;
  replacement: string;
  label: string;
}

export function applyRanges(source: string, ranges: SourceRange[]): string {
  const ordered = [...ranges].sort((a, b) => b.start - a.start);
  let lastStart = source.length + 1;
  for (const range of ordered) {
    if (
      !Number.isInteger(range.start) ||
      !Number.isInteger(range.end) ||
      range.start < 0 ||
      range.end < range.start ||
      range.end > source.length
    ) {
      throw new Error(`Invalid source range for ${range.label}.`);
    }
    if (range.end > lastStart) {
      throw new Error(`Overlapping source edits are not allowed (${range.label}).`);
    }
    lastStart = range.start;
  }

  let next = source;
  for (const range of ordered) {
    next = `${next.slice(0, range.start)}${range.replacement}${next.slice(range.end)}`;
  }
  return next;
}

export function uniqueRange(source: string, needle: string, label: string): SourceRange {
  const start = source.indexOf(needle);
  if (start === -1) throw new Error(`Original text was not found for ${label}.`);
  if (source.indexOf(needle, start + needle.length) !== -1) {
    throw new Error(`Original text is ambiguous for ${label}. Add a structured source path.`);
  }
  return { start, end: start + needle.length, replacement: '', label };
}

export function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replaceAll('"', '&quot;');
}

export function pathParts(path: string): Array<string | number> {
  if (!path.trim()) throw new Error('A structured sourcePath is required.');
  return path
    .replace(/\[(\d+)\]/gu, '.$1')
    .split('.')
    .filter(Boolean)
    .map((part) => (/^\d+$/u.test(part) ? Number(part) : part));
}
