import type {
  EditabilityPolicy,
  EditabilityPolicyChangeRequest,
  EditabilityPolicyRequest,
  EditorChange,
  ReceiptRequest,
  RevertRequest,
  SaveRequest,
  SeoCapabilitiesRequest,
  SessionRestoreRequest,
  SessionStateRequest,
  SeoValues,
  SourceDiscoveryRequest,
  SectionDiscoveryRequest,
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
          (item.label === undefined || isString(item.label, 500)) &&
          (item.templateId === undefined || isString(item.templateId, 200)) &&
          (item.sourceKey === undefined || isString(item.sourceKey, 200)),
      );
    return (
      isString(value.regionId, 200) &&
      (value.sourcePath === undefined || isString(value.sourcePath, 4_096)) &&
      validList(value.before) &&
      validList(value.after)
    );
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

export function parseSessionStateRequest(value: unknown): SessionStateRequest {
  if (!isRecord(value) || !isString(value.clientId, 200) || !isString(value.requestId, 200)) {
    throw new Error('Session state request failed runtime validation.');
  }
  return value as unknown as SessionStateRequest;
}

export function parseSessionRestoreRequest(value: unknown): SessionRestoreRequest {
  if (!isRecord(value) || !isString(value.clientId, 200) || !isString(value.requestId, 200)) {
    throw new Error('Session restore request failed runtime validation.');
  }
  return value as unknown as SessionRestoreRequest;
}

export function parseEditabilityPolicyRequest(value: unknown): EditabilityPolicyRequest {
  if (!isRecord(value) || !isString(value.clientId, 200) || !isString(value.requestId, 200)) {
    throw new Error('Editability policy request failed runtime validation.');
  }
  return value as unknown as EditabilityPolicyRequest;
}

export function parseSourceDiscoveryRequest(
  value: unknown,
  maxRequestBytes: number,
): SourceDiscoveryRequest {
  let bytes = Number.POSITIVE_INFINITY;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    throw new Error('Source discovery request is not serializable.');
  }
  if (bytes > maxRequestBytes) {
    throw new Error(`Source discovery request exceeds the ${maxRequestBytes}-byte limit.`);
  }
  if (
    !isRecord(value) ||
    !isString(value.clientId, 200) ||
    !isString(value.requestId, 200) ||
    typeof value.route !== 'string' ||
    value.route.length > 4_096 ||
    !isString(value.selector, 2_000) ||
    !isString(value.text) ||
    (value.hintedFilePath !== undefined && !isString(value.hintedFilePath, 4_096))
  ) {
    throw new Error('Source discovery request failed runtime validation.');
  }
  return value as unknown as SourceDiscoveryRequest;
}

export function parseSeoCapabilitiesRequest(value: unknown): SeoCapabilitiesRequest {
  if (
    !isRecord(value) ||
    !isString(value.clientId, 200) ||
    !isString(value.requestId, 200) ||
    !isString(value.filePath, 4_096)
  ) {
    throw new Error('SEO capabilities request failed runtime validation.');
  }
  return value as unknown as SeoCapabilitiesRequest;
}

export function parseSectionDiscoveryRequest(
  value: unknown,
  maxRequestBytes: number,
): SectionDiscoveryRequest {
  let bytes = Number.POSITIVE_INFINITY;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    throw new Error('Section discovery request is not serializable.');
  }
  if (bytes > maxRequestBytes) {
    throw new Error(`Section discovery request exceeds the ${maxRequestBytes}-byte limit.`);
  }
  if (
    !isRecord(value) ||
    !isString(value.clientId, 200) ||
    !isString(value.requestId, 200) ||
    typeof value.route !== 'string' ||
    value.route.length > 4_096 ||
    !isString(value.selector, 2_000) ||
    !Number.isInteger(value.itemCount) ||
    Number(value.itemCount) < 2 ||
    Number(value.itemCount) > 100 ||
    (value.hintedFilePath !== undefined && !isString(value.hintedFilePath, 4_096))
  ) {
    throw new Error('Section discovery request failed runtime validation.');
  }
  return value as unknown as SectionDiscoveryRequest;
}

function isEditabilityPolicy(value: unknown): value is EditabilityPolicy {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.rules)) return false;
  if (value.rules.length > 500) return false;
  const rulesValid = value.rules.every(
    (rule) =>
      isRecord(rule) &&
      isString(rule.id, 200) &&
      (rule.effect === 'allow' || rule.effect === 'deny') &&
      (rule.scope === 'element' || rule.scope === 'selector') &&
      isString(rule.route, 4_096) &&
      isString(rule.selector, 2_000) &&
      (rule.filePath === undefined || isString(rule.filePath, 4_096)) &&
      (rule.sourcePath === undefined || isString(rule.sourcePath, 4_096)),
  );
  const regions = value.regions;
  const regionsValid =
    regions === undefined ||
    (Array.isArray(regions) &&
      regions.length <= 100 &&
      regions.every(
        (region) =>
          isRecord(region) &&
          isString(region.id, 200) &&
          isString(region.route, 4_096) &&
          isString(region.selector, 2_000) &&
          isString(region.filePath, 4_096) &&
          isString(region.sourcePath, 4_096) &&
          Array.isArray(region.items) &&
          region.items.length >= 2 &&
          region.items.length <= 100 &&
          region.items.every(
            (item) => isRecord(item) && isString(item.id, 200) && isString(item.sourceKey, 200),
          ),
      ));
  return rulesValid && regionsValid;
}

export function parseEditabilityPolicyChangeRequest(
  value: unknown,
  maxRequestBytes: number,
): EditabilityPolicyChangeRequest {
  let bytes = Number.POSITIVE_INFINITY;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    throw new Error('Editability policy request is not serializable.');
  }
  if (bytes > maxRequestBytes) {
    throw new Error(`Editability policy request exceeds the ${maxRequestBytes}-byte limit.`);
  }
  if (
    !isRecord(value) ||
    !isString(value.clientId, 200) ||
    !isString(value.requestId, 200) ||
    typeof value.expectedHash !== 'string' ||
    value.expectedHash.length > 200 ||
    !isEditabilityPolicy(value.policy)
  ) {
    throw new Error('Editability policy change failed runtime validation.');
  }
  return value as unknown as EditabilityPolicyChangeRequest;
}
