import type { EditableFileExtension, ClientEditorConfig } from './shared/types.js';

export interface AstroVisualEditorOptions {
  /** Disable the integration without removing it from Astro config. */
  enabled?: boolean;
  /** Elements considered editable when they contain direct text. */
  editableSelectors?: string[];
  /** Elements ignored even when they match an editable selector. */
  excludeSelectors?: string[];
  /** Route-to-source mappings, e.g. `/about`: `src/pages/about.astro`. */
  fileMappings?: Record<string, string>;
  /** CSS selector-to-source mappings for shared components. */
  selectorMappings?: Record<string, string>;
  /** File extensions that the server may modify. */
  allowedExtensions?: EditableFileExtension[];
  /** Maximum number of changes accepted in one batch. */
  maxChanges?: number;
  /** Maximum length of one edited text value. */
  maxTextLength?: number;
  /** Permit `<`, `{` and `}` in replacement text. Disabled by default. */
  allowUnsafeSourceText?: boolean;
}

export interface NormalizedOptions {
  enabled: boolean;
  editableSelectors: string[];
  excludeSelectors: string[];
  fileMappings: Record<string, string>;
  selectorMappings: Record<string, string>;
  allowedExtensions: EditableFileExtension[];
  maxChanges: number;
  maxTextLength: number;
  allowUnsafeSourceText: boolean;
}

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
  ],
  fileMappings: {},
  selectorMappings: {
    header: 'src/components/Header.astro',
    footer: 'src/components/Footer.astro',
  },
  allowedExtensions: ['.astro', '.md', '.mdx', '.json', '.yaml', '.yml'],
  maxChanges: 100,
  maxTextLength: 10_000,
  allowUnsafeSourceText: false,
};

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function normalizeOptions(options: AstroVisualEditorOptions = {}): NormalizedOptions {
  return {
    enabled: options.enabled ?? defaults.enabled,
    editableSelectors: options.editableSelectors?.length
      ? [...options.editableSelectors]
      : [...defaults.editableSelectors],
    excludeSelectors: options.excludeSelectors?.length
      ? [...options.excludeSelectors]
      : [...defaults.excludeSelectors],
    fileMappings: { ...defaults.fileMappings, ...options.fileMappings },
    selectorMappings: { ...defaults.selectorMappings, ...options.selectorMappings },
    allowedExtensions: options.allowedExtensions?.length
      ? [...options.allowedExtensions]
      : [...defaults.allowedExtensions],
    maxChanges: positiveInteger(options.maxChanges, defaults.maxChanges),
    maxTextLength: positiveInteger(options.maxTextLength, defaults.maxTextLength),
    allowUnsafeSourceText:
      options.allowUnsafeSourceText ?? defaults.allowUnsafeSourceText,
  };
}

export function toClientConfig(options: NormalizedOptions): ClientEditorConfig {
  return {
    editableSelectors: options.editableSelectors,
    excludeSelectors: options.excludeSelectors,
    fileMappings: options.fileMappings,
    selectorMappings: options.selectorMappings,
    maxChanges: options.maxChanges,
    maxTextLength: options.maxTextLength,
    allowUnsafeSourceText: options.allowUnsafeSourceText,
  };
}

