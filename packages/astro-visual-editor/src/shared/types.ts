export type EditableFileExtension =
  | '.astro'
  | '.md'
  | '.mdx'
  | '.json'
  | '.yaml'
  | '.yml';

export interface EditorChange {
  id: string;
  filePath: string;
  oldText: string;
  newText: string;
  route: string;
  selector?: string;
}

export interface ClientEditorConfig {
  editableSelectors: string[];
  excludeSelectors: string[];
  fileMappings: Record<string, string>;
  selectorMappings: Record<string, string>;
  maxChanges: number;
  maxTextLength: number;
  allowUnsafeSourceText: boolean;
}

export interface SaveRequest {
  requestId: string;
  changes: EditorChange[];
}

export interface SaveResponse {
  requestId: string;
  success: boolean;
  files?: string[];
  changeCount?: number;
  error?: string;
}

