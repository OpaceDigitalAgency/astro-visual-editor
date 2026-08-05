import type { ClientEditorConfig, EditableFileExtension, SectionTemplate } from './shared/types.js';

export interface AstroVisualEditorOptions {
  enabled?: boolean;
  editableSelectors?: string[];
  excludeSelectors?: string[];
  fileMappings?: Record<string, string>;
  selectorMappings?: Record<string, string>;
  allowedExtensions?: EditableFileExtension[];
  sectionTemplates?: SectionTemplate[];
  maxChanges?: number;
  maxTextLength?: number;
  maxRequestBytes?: number;
  maxSourceFileBytes?: number;
  requestTimeoutMs?: number;
  receiptTtlMs?: number;
  historyLimit?: number;
  /** Allows <, >, { and } in replacement text. Disabled by default. */
  allowUnsafeSourceText?: boolean;
  /** Source writes are refused on non-loopback dev servers unless explicitly enabled. */
  allowRemoteDev?: boolean;
  /** Local setup capability. Remote dev servers can never manage editability policy. */
  editabilityRole?: 'owner' | 'editor';
  /** Project-relative, Git-reviewable editability policy manifest. */
  editabilityPolicyFile?: string;
}

export interface NormalizedOptions {
  enabled: boolean;
  editableSelectors: string[];
  excludeSelectors: string[];
  fileMappings: Record<string, string>;
  selectorMappings: Record<string, string>;
  allowedExtensions: EditableFileExtension[];
  sectionTemplates: SectionTemplate[];
  maxChanges: number;
  maxTextLength: number;
  maxRequestBytes: number;
  maxSourceFileBytes: number;
  requestTimeoutMs: number;
  receiptTtlMs: number;
  historyLimit: number;
  allowUnsafeSourceText: boolean;
  allowRemoteDev: boolean;
  editabilityRole: 'owner' | 'editor';
  editabilityPolicyFile: string;
}

const defaultTemplates: SectionTemplate[] = [
  {
    id: 'hero',
    name: 'Hero',
    description: 'A focused heading, introduction and primary action.',
    markup: `<section data-section="{{id}}" class="ave-hero">
  <p class="ave-kicker">New section</p>
  <h2>Introduce the next important idea</h2>
  <p>Explain the value clearly, then edit this copy with Text mode.</p>
  <a href="#">Primary action</a>
</section>`,
  },
  {
    id: 'features',
    name: 'Features',
    description: 'A heading followed by three compact feature cards.',
    markup: `<section data-section="{{id}}" class="ave-features">
  <h2>What makes this different</h2>
  <div class="ave-feature-grid">
    <article><h3>Feature one</h3><p>Describe the first benefit.</p></article>
    <article><h3>Feature two</h3><p>Describe the second benefit.</p></article>
    <article><h3>Feature three</h3><p>Describe the third benefit.</p></article>
  </div>
</section>`,
  },
  {
    id: 'text',
    name: 'Text',
    description: 'A simple long-form content section.',
    markup: `<section data-section="{{id}}" class="ave-text">
  <h2>Section heading</h2>
  <p>This is a simple content section. Use Text mode to replace this paragraph.</p>
</section>`,
  },
];

const defaults: NormalizedOptions = {
  enabled: true,
  editableSelectors: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'li',
    'blockquote',
    'figcaption',
    'button',
    'a',
    'label',
    'td',
    'th',
    '[data-astro-editable]',
  ],
  excludeSelectors: [
    'pre',
    'code',
    'script',
    'style',
    'textarea',
    'input',
    '[contenteditable="true"]',
    '[data-astro-edit-ignore]',
    '[data-astro-ve-ui]',
  ],
  fileMappings: {},
  selectorMappings: {},
  allowedExtensions: ['.astro', '.md', '.mdx', '.json', '.jsonc', '.yaml', '.yml'],
  sectionTemplates: defaultTemplates,
  maxChanges: 100,
  maxTextLength: 10_000,
  maxRequestBytes: 1_000_000,
  maxSourceFileBytes: 5_000_000,
  requestTimeoutMs: 15_000,
  receiptTtlMs: 10 * 60_000,
  historyLimit: 50,
  allowUnsafeSourceText: false,
  allowRemoteDev: false,
  editabilityRole: 'owner',
  editabilityPolicyFile: 'astro-visual-editor.policy.json',
};

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function validateSelectors(label: string, selectors: string[]): void {
  for (const selector of selectors) {
    if (!selector.trim() || /[\0\r\n]/u.test(selector)) {
      throw new Error(`${label} contains an invalid CSS selector.`);
    }
  }
}

function validateRelativeMappings(label: string, mappings: Record<string, string>): void {
  for (const [key, filePath] of Object.entries(mappings)) {
    if (!key.trim() || !filePath.trim() || filePath.startsWith('/') || filePath.includes('\0')) {
      throw new Error(`${label} contains an invalid project-relative file mapping.`);
    }
  }
}

function validateTemplates(templates: SectionTemplate[]): void {
  const ids = new Set<string>();
  for (const template of templates) {
    if (!/^[a-z][a-z0-9-]*$/u.test(template.id) || ids.has(template.id)) {
      throw new Error(`Section template id is invalid or duplicated: ${template.id}`);
    }
    if (!template.name.trim() || !template.markup.includes('<section')) {
      throw new Error(`Section template ${template.id} must have a name and section markup.`);
    }
    ids.add(template.id);
  }
}

export function normalizeOptions(options: AstroVisualEditorOptions = {}): NormalizedOptions {
  const normalized: NormalizedOptions = {
    enabled: options.enabled ?? defaults.enabled,
    editableSelectors: options.editableSelectors?.length
      ? [...options.editableSelectors]
      : [...defaults.editableSelectors],
    excludeSelectors: options.excludeSelectors?.length
      ? [...options.excludeSelectors]
      : [...defaults.excludeSelectors],
    fileMappings: { ...options.fileMappings },
    selectorMappings: { ...options.selectorMappings },
    allowedExtensions: options.allowedExtensions?.length
      ? [...new Set(options.allowedExtensions)]
      : [...defaults.allowedExtensions],
    sectionTemplates: options.sectionTemplates?.length
      ? options.sectionTemplates.map((template) => ({ ...template }))
      : defaults.sectionTemplates.map((template) => ({ ...template })),
    maxChanges: positiveInteger(options.maxChanges, defaults.maxChanges),
    maxTextLength: positiveInteger(options.maxTextLength, defaults.maxTextLength),
    maxRequestBytes: positiveInteger(options.maxRequestBytes, defaults.maxRequestBytes),
    maxSourceFileBytes: positiveInteger(options.maxSourceFileBytes, defaults.maxSourceFileBytes),
    requestTimeoutMs: positiveInteger(options.requestTimeoutMs, defaults.requestTimeoutMs),
    receiptTtlMs: positiveInteger(options.receiptTtlMs, defaults.receiptTtlMs),
    historyLimit: positiveInteger(options.historyLimit, defaults.historyLimit),
    allowUnsafeSourceText: options.allowUnsafeSourceText ?? defaults.allowUnsafeSourceText,
    allowRemoteDev: options.allowRemoteDev ?? defaults.allowRemoteDev,
    editabilityRole: options.editabilityRole ?? defaults.editabilityRole,
    editabilityPolicyFile: options.editabilityPolicyFile ?? defaults.editabilityPolicyFile,
  };

  validateSelectors('editableSelectors', normalized.editableSelectors);
  validateSelectors('excludeSelectors', normalized.excludeSelectors);
  validateSelectors('selectorMappings', Object.keys(normalized.selectorMappings));
  validateRelativeMappings('fileMappings', normalized.fileMappings);
  validateRelativeMappings('selectorMappings', normalized.selectorMappings);
  validateTemplates(normalized.sectionTemplates);
  if (!['owner', 'editor'].includes(normalized.editabilityRole)) {
    throw new Error('editabilityRole must be owner or editor.');
  }
  if (
    !normalized.editabilityPolicyFile.trim() ||
    normalized.editabilityPolicyFile.startsWith('/') ||
    normalized.editabilityPolicyFile.includes('\0') ||
    normalized.editabilityPolicyFile.includes('/') ||
    normalized.editabilityPolicyFile.includes('\\')
  ) {
    throw new Error('editabilityPolicyFile must be a safe file in the project root.');
  }
  return normalized;
}

export function toClientConfig(
  options: NormalizedOptions,
  writeEnabled = true,
  remoteWarning?: string,
  canManageEditability = options.editabilityRole === 'owner',
): ClientEditorConfig {
  return {
    editableSelectors: options.editableSelectors,
    excludeSelectors: options.excludeSelectors,
    fileMappings: options.fileMappings,
    selectorMappings: options.selectorMappings,
    sectionTemplates: options.sectionTemplates,
    maxChanges: options.maxChanges,
    maxTextLength: options.maxTextLength,
    requestTimeoutMs: options.requestTimeoutMs,
    allowUnsafeSourceText: options.allowUnsafeSourceText,
    writeEnabled,
    canManageEditability,
    editabilityPolicyFile: options.editabilityPolicyFile,
    remoteWarning,
  };
}
