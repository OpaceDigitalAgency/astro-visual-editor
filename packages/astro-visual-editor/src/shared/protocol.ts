import type {
  EditorChange,
  ReceiptRequest,
  RevertRequest,
  SaveRequest,
  SeoValues,
} from './types.js';

const seoFields = [
  'title',
  'description',
  'keywords',
  'canonical',
  'ogTitle',
  'ogDescription',
  'robots',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown, max = 100_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isSeoValues(value: unknown): value is SeoValues {
  return (
    isRecord(value) &&
    seoFields.every((field) => typeof value[field] === 'string' && value[field].length <= 100_000)
  );
}

function isEditorChange(value: unknown): value is EditorChange {
  if (!isRecord(value) || !isString(value.id, 200) || !isString(value.filePath, 4_096)) {
    return false;
  }
  if (typeof value.route !== 'string' || value.route.length > 4_096) return false;

  if (value.kind === 'text') {
    return (
      isString(value.oldText) &&
      typeof value.newText === 'string' &&
      value.newText.length <= 100_000 &&
      (value.selector === undefined || typeof value.selector === 'string') &&
      (value.sourcePath === undefined || typeof value.sourcePath === 'string')
    );
  }

  if (value.kind === 'seo') return isSeoValues(value.before) && isSeoValues(value.after);

  if (value.kind === 'sections') {
    const validList = (list: unknown): boolean =>
      Array.isArray(list) &&
      list.every(
        (item) =>
          isRecord(item) &&
          isString(item.id, 200) &&
          (item.templateId === undefined || isString(item.templateId, 200)),
      );
    return isString(value.regionId, 200) && validList(value.before) && validList(value.after);
  }

  return false;
}

export function parseSaveRequest(
  value: unknown,
  maxChanges: number,
  maxRequestBytes: number,
): SaveRequest {
  let bytes = Number.POSITIVE_INFINITY;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    throw new Error('Save request is not serializable.');
  }
  if (bytes > maxRequestBytes) {
    throw new Error(`Save request exceeds the ${maxRequestBytes}-byte limit.`);
  }
  if (
    !isRecord(value) ||
    !isString(value.clientId, 200) ||
    !isString(value.requestId, 200) ||
    !Array.isArray(value.changes) ||
    value.changes.length === 0 ||
    value.changes.length > maxChanges ||
    !value.changes.every(isEditorChange)
  ) {
    throw new Error('Save request failed runtime validation.');
  }
  return value as unknown as SaveRequest;
}

export function parseReceiptRequest(value: unknown): ReceiptRequest {
  if (!isRecord(value) || !isString(value.clientId, 200) || !isString(value.requestId, 200)) {
    throw new Error('Receipt request failed runtime validation.');
  }
  return value as unknown as ReceiptRequest;
}

export function parseRevertRequest(value: unknown): RevertRequest {
  if (
    !isRecord(value) ||
    !isString(value.clientId, 200) ||
    !isString(value.requestId, 200) ||
    !isString(value.receiptId, 200)
  ) {
    throw new Error('Revert request failed runtime validation.');
  }
  return value as unknown as RevertRequest;
}
