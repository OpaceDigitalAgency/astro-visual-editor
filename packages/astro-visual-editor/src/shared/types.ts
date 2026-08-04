export type EditableFileExtension =
  '.astro' | '.md' | '.mdx' | '.json' | '.jsonc' | '.yaml' | '.yml';

export interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  /** Astro/HTML markup. Use {{id}} where the generated section id belongs. */
  markup: string;
}

export type ClientSectionTemplate = SectionTemplate;

export interface BaseEditorChange {
  id: string;
  filePath: string;
  route: string;
}

export interface TextEditorChange extends BaseEditorChange {
  kind: 'text';
  oldText: string;
  newText: string;
  selector?: string;
  /** Required for JSON/YAML and recommended for frontmatter, e.g. hero.title. */
  sourcePath?: string;
}

export type SeoField =
  'title' | 'description' | 'keywords' | 'canonical' | 'ogTitle' | 'ogDescription' | 'robots';

export type SeoValues = Record<SeoField, string>;

export interface SeoEditorChange extends BaseEditorChange {
  kind: 'seo';
  before: SeoValues;
  after: SeoValues;
}

export interface SectionDescriptor {
  id: string;
  templateId?: string;
}

export interface SectionsEditorChange extends BaseEditorChange {
  kind: 'sections';
  regionId: string;
  before: SectionDescriptor[];
  after: SectionDescriptor[];
}

export type EditorChange = TextEditorChange | SeoEditorChange | SectionsEditorChange;

export interface ClientEditorConfig {
  editableSelectors: string[];
  excludeSelectors: string[];
  fileMappings: Record<string, string>;
  selectorMappings: Record<string, string>;
  sectionTemplates: ClientSectionTemplate[];
  maxChanges: number;
  maxTextLength: number;
  requestTimeoutMs: number;
  allowUnsafeSourceText: boolean;
  writeEnabled: boolean;
  remoteWarning?: string;
}

export interface ClientMessage {
  clientId: string;
}

export interface SaveRequest extends ClientMessage {
  requestId: string;
  changes: EditorChange[];
}

export interface SaveResponse extends ClientMessage {
  requestId: string;
  success: boolean;
  files?: string[];
  changeCount?: number;
  receiptId?: string;
  error?: string;
}

export interface ReceiptRequest extends ClientMessage {
  requestId: string;
}

export interface ReceiptResponse extends ClientMessage {
  requestId: string;
  status: 'success' | 'failed' | 'unknown';
  response?: SaveResponse;
}

export interface RevertRequest extends ClientMessage {
  requestId: string;
  receiptId: string;
}

export interface RevertResponse extends ClientMessage {
  requestId: string;
  receiptId: string;
  success: boolean;
  files?: string[];
  error?: string;
}

export interface ApplyBatchResult {
  files: string[];
  changeCount: number;
  receiptId: string;
}
