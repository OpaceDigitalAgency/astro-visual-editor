import { defineToolbarApp } from 'astro/toolbar';
import { ChangeHistory, changeKey } from './client/history.js';
import {
  classifyElement,
  inventoryPage,
  matchingPolicyRule,
  policyAllowSelectors,
  type InventoryItem,
  type InventoryStatus,
} from './client/editability.js';
import { renderEditabilityPanel } from './client/editability-panel.js';
import { renderFileDiffPanel, renderHistoryPanel } from './client/review-panels.js';
import {
  regionIdFor,
  selectorFor,
  sourceFileFor,
  sourceResolutionFor,
} from './client/source-resolver.js';
import { pageSectionStyles, toolbarStyles } from './client/styles.js';
import {
  APP_ID,
  CONFIG_EVENT,
  EDITABILITY_POLICY_EVENT,
  EDITABILITY_POLICY_RESULT_EVENT,
  EDITABILITY_PREVIEW_EVENT,
  EDITABILITY_PREVIEW_RESULT_EVENT,
  EDITABILITY_SAVE_EVENT,
  EDITABILITY_SAVE_RESULT_EVENT,
  HISTORY_EVENT,
  HISTORY_RESULT_EVENT,
  PREVIEW_EVENT,
  PREVIEW_RESULT_EVENT,
  READY_EVENT,
  RECEIPT_EVENT,
  RECEIPT_RESULT_EVENT,
  REVERT_EVENT,
  REVERT_RESULT_EVENT,
  SAVE_EVENT,
  SAVE_RESULT_EVENT,
  SOURCE_DISCOVERY_EVENT,
  SOURCE_DISCOVERY_RESULT_EVENT,
  SECTION_DISCOVERY_EVENT,
  SECTION_DISCOVERY_RESULT_EVENT,
} from './shared/events.js';
import type {
  ClientEditorConfig,
  EditabilityEffect,
  EditabilityPolicy,
  EditabilityPolicyResponse,
  EditabilityRule,
  EditabilityRuleScope,
  EditorChange,
  HistoryEntry,
  HistoryResponse,
  PreviewResponse,
  ReceiptResponse,
  RevertResponse,
  SectionDescriptor,
  SectionsEditorChange,
  SeoEditorChange,
  SeoField,
  SeoValues,
  SaveResponse,
  SourceCandidate,
  SourceDiscoveryResponse,
  SectionDiscoveryResponse,
  SectionRegionCandidate,
  SectionRegionRule,
  TextEditorChange,
} from './shared/types.js';

type EditorMode = 'text' | 'sections' | 'seo' | 'review' | 'setup';
type MessageKind = 'error' | 'success' | 'warning';

const SESSION_QUEUE = `${APP_ID}:queue:v2`;
const SESSION_CLIENT = `${APP_ID}:client-id`;
const SESSION_PENDING = `${APP_ID}:pending`;
const SESSION_RECEIPT = `${APP_ID}:last-receipt`;
const SESSION_CONFIG = `${APP_ID}:config:v1`;
let hasUnsavedChanges = false;

const defaultConfig: ClientEditorConfig = {
  editableSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'strong', 'em', 'small'],
  excludeSelectors: [
    'pre',
    'code',
    'script',
    'style',
    '[data-astro-edit-ignore]',
    '[data-astro-ve-ui]',
  ],
  fileMappings: {},
  selectorMappings: {},
  sectionTemplates: [],
  demoPages: [],
  maxChanges: 100,
  maxTextLength: 10_000,
  requestTimeoutMs: 15_000,
  allowUnsafeSourceText: false,
  writeEnabled: false,
  canManageEditability: false,
  editabilityPolicyFile: 'astro-visual-editor.policy.json',
};

const emptyEditabilityPolicy: EditabilityPolicy = { version: 1, rules: [] };

type IconName =
  | 'chevron-down'
  | 'chevron-up'
  | 'close'
  | 'content'
  | 'delete'
  | 'drag'
  | 'history'
  | 'lock'
  | 'minus'
  | 'page'
  | 'plus'
  | 'redo'
  | 'settings'
  | 'shield'
  | 'structure'
  | 'undo'
  | 'unlock';

function icon(name: IconName): string {
  const paths: Record<IconName, string> = {
    'chevron-down': '<path d="m7 10 5 5 5-5"/>',
    'chevron-up': '<path d="m7 14 5-5 5 5"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    content: '<path d="M5 6h14M5 10h14M5 14h9M5 18h7"/>',
    delete: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    drag: '<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2"/>',
    minus: '<path d="M6 12h12"/>',
    page: '<path d="M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    redo: '<path d="M16 7h4v4M20 7l-4-3M20 7h-9a6 6 0 0 0-6 6 6 6 0 0 0 6 6h3"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7L0 10.5v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" transform="translate(2 -1) scale(.84)"/>',
    shield: '<path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6zM9 12l2 2 4-5"/>',
    structure:
      '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="15" width="8" height="5" rx="1"/><rect x="13" y="15" width="8" height="5" rx="1"/><path d="M12 9v3M7 12h10M7 12v3M17 12v3"/>',
    undo: '<path d="M8 7H4v4M4 7l4-3M4 7h9a6 6 0 0 1 6 6 6 6 0 0 1-6 6h-3"/>',
    unlock:
      '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M9 10V7a4 4 0 0 1 7-2.6M12 14v2"/>',
  };
  return `<svg class="ave-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function getClientId(): string {
  let id = sessionStorage.getItem(SESSION_CLIENT);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_CLIENT, id);
  }
  return id;
}

function seoValues(): SeoValues {
  const content = (selector: string): string =>
    document.head.querySelector<HTMLMetaElement>(selector)?.content ?? '';
  return {
    title: document.title,
    description: content('meta[name="description"]'),
    keywords: content('meta[name="keywords"]'),
    canonical: document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? '',
    ogTitle: content('meta[property="og:title"]'),
    ogDescription: content('meta[property="og:description"]'),
    robots: content('meta[name="robots"]'),
  };
}

function setSeoPreview(values: SeoValues): void {
  const setMeta = (
    selector: string,
    attribute: 'name' | 'property',
    key: string,
    value: string,
  ): void => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);
    if (!value) {
      element?.remove();
      return;
    }
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      element.dataset.astroVePreview = 'true';
      document.head.append(element);
    }
    element.content = value;
  };
  document.title = values.title;
  setMeta('meta[name="description"]', 'name', 'description', values.description);
  setMeta('meta[name="keywords"]', 'name', 'keywords', values.keywords);
  setMeta('meta[name="robots"]', 'name', 'robots', values.robots);
  setMeta('meta[property="og:title"]', 'property', 'og:title', values.ogTitle);
  setMeta('meta[property="og:description"]', 'property', 'og:description', values.ogDescription);
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!values.canonical) canonical?.remove();
  else {
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.dataset.astroVePreview = 'true';
      document.head.append(canonical);
    }
    canonical.href = values.canonical;
  }
}

interface ChangeSummary {
  title: string;
  description: string;
  before: string;
  after: string;
}

function quoted(value: string, maximum = 90): string {
  const clean = value.replace(/\s+/gu, ' ').trim();
  const compact = clean.length > maximum ? `${clean.slice(0, maximum - 1).trimEnd()}…` : clean;
  return `“${compact || 'empty'}”`;
}

function visibleValue(value: string, maximum = 260): string {
  const clean = value.replace(/\s+/gu, ' ').trim() || 'Empty';
  if (clean.length <= maximum) return clean;
  const edge = Math.floor((maximum - 3) / 2);
  return `${clean.slice(0, edge).trimEnd()} … ${clean.slice(-edge).trimStart()}`;
}

function changedTextDescription(before: string, after: string): string {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
    prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix += 1;
  const removed = before.slice(prefix, before.length - suffix);
  const added = after.slice(prefix, after.length - suffix);
  const nearby = before.slice(Math.max(0, prefix - 42), prefix).trim();
  if (!removed && added)
    return nearby ? `Added ${quoted(added)} after ${quoted(nearby)}` : `Added ${quoted(added)}`;
  if (removed && !added)
    return nearby
      ? `Removed ${quoted(removed)} after ${quoted(nearby)}`
      : `Removed ${quoted(removed)}`;
  if (removed || added) return `Changed ${quoted(removed)} to ${quoted(added)}`;
  return `Changed visible text to ${quoted(after)}`;
}

const seoLabels: Record<SeoField, string> = {
  title: 'page title',
  description: 'search description',
  keywords: 'keywords',
  canonical: 'canonical URL',
  ogTitle: 'social sharing title',
  ogDescription: 'social sharing description',
  robots: 'search visibility',
};

function descriptorLabel(descriptor: SectionDescriptor): string {
  if (descriptor.label?.trim()) return descriptor.label.trim();
  return descriptor.id
    .replace(/-[a-f0-9]{8,}$/u, '')
    .replace(/[-_]+/gu, ' ')
    .replace(/^\w/u, (letter) => letter.toUpperCase());
}

function summary(change: EditorChange): ChangeSummary {
  if (change.kind === 'text')
    return {
      title: 'Changed visible text',
      description: changedTextDescription(change.oldText, change.newText),
      before: change.oldText,
      after: change.newText,
    };
  if (change.kind === 'seo') {
    const changed = (Object.keys(change.after) as SeoField[]).filter(
      (field) => change.after[field] !== change.before[field],
    );
    const first = changed[0];
    return {
      title:
        changed.length === 1 && first
          ? `Updated ${seoLabels[first]}`
          : `Updated ${changed.length} page settings`,
      description:
        changed.length === 1 && first
          ? `${quoted(change.before[first])} to ${quoted(change.after[first])}`
          : changed.map((field) => seoLabels[field]).join(', '),
      before: changed.map((field) => `${seoLabels[field]}: ${change.before[field]}`).join('\n'),
      after: changed.map((field) => `${seoLabels[field]}: ${change.after[field]}`).join('\n'),
    };
  }
  const beforeIds = change.before.map((item) => item.id);
  const afterIds = change.after.map((item) => item.id);
  const added = afterIds.filter((id) => !beforeIds.includes(id));
  const removed = beforeIds.filter((id) => !afterIds.includes(id));
  const title =
    added.length && !removed.length
      ? `Added ${added.length} section${added.length === 1 ? '' : 's'}`
      : removed.length && !added.length
        ? `Deleted ${removed.length} section${removed.length === 1 ? '' : 's'}`
        : !added.length && !removed.length
          ? `Reordered ${afterIds.length} sections`
          : 'Changed page sections';
  const beforeLabels = change.before.map(descriptorLabel);
  const afterLabels = change.after.map(descriptorLabel);
  const removedLabels = change.before
    .filter((item) => removed.includes(item.id))
    .map(descriptorLabel);
  const addedLabels = change.after.filter((item) => added.includes(item.id)).map(descriptorLabel);
  const description =
    removedLabels.length && !addedLabels.length
      ? `Deleted ${removedLabels.map((label) => quoted(label)).join(', ')}`
      : addedLabels.length && !removedLabels.length
        ? `Added ${addedLabels.map((label) => quoted(label)).join(', ')}`
        : !addedLabels.length && !removedLabels.length
          ? (() => {
              const changedIndex = afterIds.findIndex((id, index) => id !== beforeIds[index]);
              const movedId = changedIndex >= 0 ? afterIds[changedIndex] : undefined;
              const previousIndex = movedId ? beforeIds.indexOf(movedId) : -1;
              return movedId && previousIndex >= 0
                ? `Moved ${quoted(descriptorLabel(change.after[changedIndex]!))} from position ${previousIndex + 1} to ${changedIndex + 1}`
                : `Changed the order of ${afterLabels.length} items`;
            })()
          : `Now: ${afterLabels.join(' → ')}`;
  return {
    title,
    description,
    before: beforeLabels.join(' → ') || 'Empty region',
    after: afterLabels.join(' → ') || 'Empty region',
  };
}

function safeParseQueue(): EditorChange[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_QUEUE) ?? '[]');
    return Array.isArray(value) ? (value as EditorChange[]) : [];
  } catch {
    return [];
  }
}

function safeParseConfig(): ClientEditorConfig | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_CONFIG) ?? 'null');
    return value && typeof value === 'object' ? (value as ClientEditorConfig) : undefined;
  } catch {
    return undefined;
  }
}

export default defineToolbarApp({
  init(canvas, app, server) {
    const clientId = getClientId();
    const history = new ChangeHistory(50);
    const queue = new Map<string, EditorChange>();
    const sectionNodes = new Map<string, HTMLElement>();
    const initialSections = new Map<string, SectionDescriptor[]>();
    const regionAnchors = new WeakMap<HTMLElement, Comment>();
    const listenerController = new AbortController();
    let sectionListenerController = new AbortController();
    const cachedConfig = safeParseConfig();
    let config = cachedConfig ? { ...defaultConfig, ...cachedConfig } : defaultConfig;
    let configReady = Boolean(cachedConfig);
    let configConfirmed = false;
    let active = false;
    let mode: EditorMode = 'text';
    let lastEditingMode: Exclude<EditorMode, 'review' | 'setup'> = 'text';
    let hovered: HTMLElement | null = null;
    let editing: HTMLElement | null = null;
    let selectedKind: 'text' | 'section' | null = null;
    let draggedSection: HTMLElement | null = null;
    let addTarget: { section: HTMLElement; placement: 'before' | 'after' } | null = null;
    let deleteTarget: HTMLElement | null = null;
    let saveInFlight = false;
    let timeoutId: number | undefined;
    let previewTimeoutId: number | undefined;
    let receiptPollId: number | undefined;
    let pendingRequestId = sessionStorage.getItem(SESSION_PENDING) ?? undefined;
    let lastReceiptId = sessionStorage.getItem(SESSION_RECEIPT) ?? undefined;
    let savedHistory: HistoryEntry[] = [];
    let previewRequestId: string | undefined;
    let previewInFlight = false;
    let minimized = matchMedia('(max-width: 640px)').matches;
    let editabilityPolicy = structuredClone(emptyEditabilityPolicy);
    let draftEditabilityPolicy = structuredClone(emptyEditabilityPolicy);
    let editabilityPolicyHash = '';
    let editabilityRequestId: string | undefined;
    let editabilityPreviewId: string | undefined;
    let inventory: InventoryItem[] = [];
    let inventoryFilter: InventoryStatus | 'all' = 'all';
    let inventoryManagerOpen = false;
    let sectionManagerOpen = false;
    let setupBusy = false;
    let directPolicySave = false;
    let directPolicyLabel = '';
    let sourceDiscoveryRequestId: string | undefined;
    let sourceDiscoveryItem: InventoryItem | undefined;
    let sourceCandidates: SourceCandidate[] = [];
    let sectionDiscoveryRequestId: string | undefined;
    let sectionDiscoveryElement: HTMLElement | undefined;
    let sectionCandidates: SectionRegionCandidate[] = [];
    let setupPickerKind: 'text' | 'section' | undefined;
    let setupPickerTarget: HTMLElement | undefined;
    let setupPickerCandidates: HTMLElement[] = [];

    const style = createElement('style');
    style.textContent = toolbarStyles;
    const panel = createElement('section', {
      class: 'workbench',
      'data-open': 'false',
      'data-minimized': String(minimized),
      'data-has-selection': 'false',
      'data-mode': mode,
      'aria-label': 'Astro Visual Editor workbench',
    });
    panel.innerHTML = `
      <header class="masthead">
        <div class="masthead-copy"><p class="eyebrow">Astro Visual Builder</p><h2 class="panel-title">Edit content</h2>
          <p class="status" data-state="warning"><span class="status-dot" aria-hidden="true"></span><span class="status-copy">Connecting to Astro…</span></p>
        </div>
        <div class="masthead-actions"><button class="utility-button setup-toggle" type="button" aria-label="Developer diagnostics" title="Developer diagnostics" hidden>${icon('settings')}<span class="utility-label">Diagnostics</span></button><button class="icon-button minimize" type="button" aria-label="Collapse editor" title="Collapse editor">${icon('minus')}</button></div>
      </header>
      <aside class="demo-context" hidden><span>Demo page</span><nav class="demo-surfaces" aria-label="Demo test pages"></nav></aside>
      <div class="mode-tabs" role="tablist" aria-label="Editing mode">
        <button class="mode-tab" role="tab" data-mode="text" aria-selected="true">${icon('content')}<span>Content</span></button>
        <button class="mode-tab" role="tab" data-mode="sections" aria-selected="false">${icon('structure')}<span>Structure</span></button>
        <button class="mode-tab" role="tab" data-mode="seo" aria-selected="false">${icon('page')}<span>Page</span></button>
      </div>
      <div class="instructions"><span class="instruction-icon" aria-hidden="true">${icon('content')}</span><span class="instructions-copy">Click text to edit, or use a section handle to arrange the page.</span></div>
      <section class="changes-tray" aria-label="Changes tray">
        <section class="selection-inspector" aria-label="Selected element settings" hidden>
          <div class="selection-summary">
            <span class="selection-kicker">Selected element</span>
            <strong class="selection-name">Text</strong>
            <span class="selection-preview"></span>
            <span class="selection-state" role="status"></span>
          </div>
          <div class="inspector-tabs" role="tablist" aria-label="Element settings">
            <button class="inspector-tab" type="button" role="tab" data-inspector-tab="content" aria-selected="true">Content</button>
            <button class="inspector-tab" type="button" role="tab" data-inspector-tab="design" aria-selected="false">Design</button>
            <button class="inspector-tab" type="button" role="tab" data-inspector-tab="advanced" aria-selected="false">Advanced</button>
          </div>
          <div class="inspector-panel" data-inspector-panel="content">
            <details class="setting-group text-setting" open>
              <summary>Text</summary>
              <div class="setting-body">
                <label for="ave-inspector-text">Content</label>
                <textarea id="ave-inspector-text" required></textarea>
                <p class="source-warning inspector-source-warning" hidden></p>
              </div>
            </details>
            <details class="setting-group text-setting" open>
              <summary>Link</summary>
              <div class="setting-body unavailable-setting"><span>No editable link is available for this element.</span><small>Only source-safe fields are enabled.</small></div>
            </details>
            <details class="setting-group section-setting" hidden open>
              <summary>Section</summary>
              <div class="setting-body section-setting-body"><p class="section-setting-copy"></p><div class="section-setting-actions"><button class="secondary add-before-selected" type="button">Add before</button><button class="secondary add-after-selected" type="button">Add after</button><button class="danger delete-selected" type="button">Delete</button></div></div>
            </details>
          </div>
          <div class="inspector-panel" data-inspector-panel="design" hidden>
            <details class="setting-group" open>
              <summary>Typography</summary>
              <dl class="computed-settings"><div><dt>Font</dt><dd data-computed="font"></dd></div><div><dt>Size</dt><dd data-computed="size"></dd></div><div><dt>Weight</dt><dd data-computed="weight"></dd></div><div><dt>Alignment</dt><dd data-computed="align"></dd></div></dl>
            </details>
            <details class="setting-group">
              <summary>Spacing</summary>
              <dl class="computed-settings"><div><dt>Margin</dt><dd data-computed="margin"></dd></div><div><dt>Padding</dt><dd data-computed="padding"></dd></div></dl>
            </details>
            <p class="capability-note"><strong>Design values are shown for context.</strong> Style writes stay unavailable until the owning CSS or Astro style source can be proven safely.</p>
          </div>
          <div class="inspector-panel" data-inspector-panel="advanced" hidden>
            <details class="setting-group" open>
              <summary>Source ownership</summary>
              <dl class="advanced-settings"><div><dt>File</dt><dd class="inspector-file"></dd></div><div><dt>Field</dt><dd class="inspector-source-path"></dd></div><div><dt>Page selector</dt><dd class="inspector-selector"></dd></div></dl>
            </details>
            <p class="capability-note selection-protection-note"><strong>Source protection stays authoritative.</strong> User locks can be changed here; unsafe or unresolved source mappings remain protected.</p>
          </div>
          <footer class="inspector-actions">
            <button class="icon-button cancel-selection" type="button" aria-label="Cancel element editing" title="Cancel">${icon('close')}</button>
            <button class="secondary toggle-selection-lock" type="button">${icon('lock')}<span>Lock</span></button>
            <button class="secondary reset-selection" type="button">Reset</button>
            <button class="primary apply-selection" type="button">Queue change</button>
          </footer>
        </section>
        <div class="changes-header">
          <button class="changes-toggle" type="button" aria-expanded="false"><span>Review changes</span><span class="change-count">0</span></button>
          <button class="icon-button undo" type="button" aria-label="Undo" title="Undo last change" disabled>${icon('undo')}</button>
        </div>
        <div class="ledger" aria-live="polite" aria-label="Queued changes"></div>
        <p class="message" role="status" aria-live="polite"></p>
        <div class="history-actions">
          <button class="secondary redo" type="button" disabled>${icon('redo')}<span>Redo</span></button>
          <button class="secondary show-history" type="button">${icon('history')}<span>History</span></button>
        </div>
        <footer class="actions">
          <button class="primary commit" type="button" disabled>Review and save</button>
          <button class="secondary clear" type="button">Discard changes</button>
          <button class="secondary revert" type="button" disabled>Restore previous save</button>
        </footer>
      </section>
      <div class="setup-actions">
        <button class="secondary leave-setup" type="button">← Back to editor</button>
        <button class="primary review-policy" type="button" disabled>Review and save</button>
        <button class="secondary reload-policy" type="button" hidden>Discard unsaved changes</button>
      </div>`;

    const picker = createElement('div', { class: 'picker', 'data-open': 'false' });
    picker.innerHTML = `<span class="picker-label">Tap content to edit</span><button class="secondary picker-review" type="button" title="Expand editor and review queued changes">Review 0</button><button class="icon-button picker-close" type="button" aria-label="Disable Visual Editor" title="Disable Visual Editor">${icon('close')}</button>`;

    const setupPagePicker = createElement('div', {
      class: 'setup-page-picker',
      'data-open': 'false',
      'data-astro-ve-ui': 'true',
      role: 'status',
      'aria-live': 'polite',
    });
    setupPagePicker.innerHTML = `<div><strong class="setup-picker-title">Select on page</strong><span class="setup-picker-help">Move over the page, then click the item you want.</span></div><span class="setup-picker-label">Nothing selected yet</span><button class="secondary cancel-setup-picker" type="button">Cancel</button>`;

    const textDialog = createElement('dialog', {
      'aria-labelledby': 'ave-text-title',
      'aria-describedby': 'ave-text-file',
    });
    textDialog.innerHTML = `<form method="dialog" class="dialog-body"><p class="eyebrow">Preview before writing</p><h2 id="ave-text-title">Edit text</h2><p id="ave-text-file" class="dialog-file"></p><p class="source-warning" hidden></p><label for="ave-text-value">Replacement text</label><textarea id="ave-text-value" required></textarea><p class="field-help">The owning adapter validates syntax before any source file is written.</p><div class="dialog-actions"><button class="secondary" value="cancel" type="submit">Cancel</button><button class="primary queue-text" type="button">Queue change</button></div></form>`;

    const seoDialog = createElement('dialog', {
      'aria-labelledby': 'ave-seo-title',
      'aria-describedby': 'ave-seo-file',
    });
    seoDialog.innerHTML = `<form method="dialog" class="dialog-body"><p class="eyebrow">Page metadata</p><h2 id="ave-seo-title">Edit SEO</h2><p id="ave-seo-file" class="dialog-file"></p><div class="seo-grid">
      <div class="wide"><label for="ave-seo-title-field">Title</label><input id="ave-seo-title-field" name="title"><p class="field-help">Editorial guide: usually 30–60 characters.</p></div>
      <div class="wide"><label for="ave-seo-description">Description</label><textarea id="ave-seo-description" name="description"></textarea><p class="field-help">Editorial guide: usually 120–160 characters.</p></div>
      <div class="wide"><label for="ave-seo-keywords">Keywords</label><input id="ave-seo-keywords" name="keywords"></div>
      <div class="wide"><label for="ave-seo-canonical">Canonical URL</label><input id="ave-seo-canonical" name="canonical" inputmode="url"></div>
      <div><label for="ave-seo-og-title">Open Graph title</label><input id="ave-seo-og-title" name="ogTitle"></div>
      <div><label for="ave-seo-robots">Robots</label><input id="ave-seo-robots" name="robots" placeholder="index, follow"></div>
      <div class="wide"><label for="ave-seo-og-description">Open Graph description</label><textarea id="ave-seo-og-description" name="ogDescription"></textarea></div>
      </div><div class="dialog-actions"><button class="secondary" value="cancel" type="submit">Cancel</button><button class="primary queue-seo" type="button">Queue SEO change</button></div></form>`;

    const templateDialog = createElement('dialog', { 'aria-labelledby': 'ave-template-title' });
    templateDialog.innerHTML = `<div class="dialog-body"><p class="eyebrow">Component library</p><h2 id="ave-template-title">Add a section</h2><div class="template-grid"></div><div class="dialog-actions"><button class="secondary close-templates" type="button">Cancel</button></div></div>`;

    const confirmDialog = createElement('dialog', {
      'aria-labelledby': 'ave-confirm-title',
      'aria-describedby': 'ave-confirm-copy',
    });
    confirmDialog.innerHTML = `<div class="dialog-body"><p class="eyebrow">Confirm structural change</p><h2 id="ave-confirm-title">Delete this section?</h2><p id="ave-confirm-copy">The section will be removed from the preview and queued. You can undo before committing.</p><div class="dialog-actions"><button class="secondary cancel-delete" type="button">Keep section</button><button class="danger confirm-delete" type="button">Delete section</button></div></div>`;

    const historyDialog = createElement('dialog', { 'aria-labelledby': 'ave-history-title' });
    historyDialog.innerHTML = `<div class="dialog-body"><p class="eyebrow">Local recovery record</p><h2 id="ave-history-title">Saved changes</h2><p class="field-help">Only unchanged saved files can be restored. This record stays on this computer.</p><div class="history-list"></div><div class="dialog-actions"><button class="secondary close-history" type="button">Close</button></div></div>`;

    const diffDialog = createElement('dialog', {
      'aria-labelledby': 'ave-diff-title',
      'aria-describedby': 'ave-diff-help',
    });
    diffDialog.innerHTML = `<div class="dialog-body diff-dialog"><p class="eyebrow">Final safety check</p><h2 id="ave-diff-title">Review and save</h2><p id="ave-diff-help" class="field-help">These are the exact source lines that will be written. Nothing is saved until you confirm.</p><div class="file-diff-list"></div><div class="dialog-actions"><button class="secondary cancel-diff" type="button">Cancel</button><button class="primary confirm-commit" type="button">Save changes</button></div></div>`;

    const policyDialog = createElement('dialog', {
      'aria-labelledby': 'ave-policy-title',
      'aria-describedby': 'ave-policy-help',
    });
    policyDialog.innerHTML = `<div class="dialog-body diff-dialog"><p class="eyebrow">Ready to enable</p><h2 id="ave-policy-title">Save these editor choices?</h2><p id="ave-policy-help" class="field-help">This saves which text and sections can be maintained on this page. It does not change the page content.</p><details class="technical-details policy-technical"><summary>Review technical project change</summary><div class="policy-diff-list file-diff-list"></div></details><div class="dialog-actions"><button class="secondary cancel-policy" type="button">Keep editing</button><button class="primary confirm-policy" type="button">Save settings</button></div></div>`;

    const sourceDialog = createElement('dialog', {
      'aria-labelledby': 'ave-source-title',
      'aria-describedby': 'ave-source-help',
    });
    sourceDialog.innerHTML = `<form method="dialog" class="dialog-body"><p class="eyebrow">One safety check</p><h2 id="ave-source-title">Which source owns this text?</h2><p id="ave-source-help" class="field-help">More than one exact source match exists, so the editor will not guess. Choose only if you recognise the owner.</p><div class="source-candidate-list"></div><div class="dialog-actions"><button class="secondary cancel-source" value="cancel" type="submit">Cancel safely</button><button class="primary confirm-source" type="button">Use selected source</button></div></form>`;

    const regionDialog = createElement('dialog', {
      'aria-labelledby': 'ave-region-title',
      'aria-describedby': 'ave-region-help',
    });
    regionDialog.innerHTML = `<form method="dialog" class="dialog-body"><p class="eyebrow">Page sections</p><h2 id="ave-region-title">Choose an area to reorder</h2><p id="ave-region-help" class="field-help">Select on the page, then choose whether you mean the smallest item, a parent area or the whole page.</p><div class="region-candidate-list friendly-region-list"></div><div class="dialog-actions"><button class="secondary" value="cancel" type="submit">Cancel</button><button class="primary pick-region-on-page" type="button">Select on page</button></div></form>`;

    const regionSourceDialog = createElement('dialog', {
      'aria-labelledby': 'ave-region-source-title',
      'aria-describedby': 'ave-region-source-help',
    });
    regionSourceDialog.innerHTML = `<form method="dialog" class="dialog-body"><p class="eyebrow">One safety check</p><h2 id="ave-region-source-title">Which source owns this section?</h2><p id="ave-region-source-help" class="field-help">The page selection is complete, but more than one source structure could produce it. Choose only if you recognise the owner; otherwise cancel safely.</p><div class="region-source-candidate-list source-candidate-list"></div><div class="dialog-actions"><button class="secondary" value="cancel" type="submit">Cancel safely</button><button class="primary confirm-region-source" type="button">Use selected source</button></div></form>`;

    const permissionDialog = createElement('dialog', {
      'aria-labelledby': 'ave-permission-title',
      'aria-describedby': 'ave-permission-help',
    });
    permissionDialog.innerHTML = `<div class="dialog-body"><p class="eyebrow">Text editing</p><h2 id="ave-permission-title">Choose what can be edited</h2><p id="ave-permission-help" class="field-help permission-copy"></p><details class="technical-details"><summary>Technical details</summary><p class="dialog-file permission-source"></p></details><div class="dialog-actions permission-actions"><button class="secondary cancel-permission" type="button">Cancel</button></div></div>`;

    canvas.append(
      style,
      panel,
      picker,
      setupPagePicker,
      textDialog,
      seoDialog,
      templateDialog,
      confirmDialog,
      historyDialog,
      diffDialog,
      policyDialog,
      sourceDialog,
      regionDialog,
      regionSourceDialog,
      permissionDialog,
    );

    const ledger = panel.querySelector<HTMLElement>('.ledger')!;
    const message = panel.querySelector<HTMLElement>('.message')!;
    const status = panel.querySelector<HTMLElement>('.status')!;
    const statusCopy = panel.querySelector<HTMLElement>('.status-copy')!;
    const panelTitle = panel.querySelector<HTMLElement>('.panel-title')!;
    const instructions = panel.querySelector<HTMLElement>('.instructions-copy')!;
    const demoSurfaces = panel.querySelector<HTMLElement>('.demo-surfaces')!;
    const demoContext = panel.querySelector<HTMLElement>('.demo-context')!;
    const changesToggle = panel.querySelector<HTMLButtonElement>('.changes-toggle')!;
    const changeCount = panel.querySelector<HTMLElement>('.change-count')!;
    const commitButton = panel.querySelector<HTMLButtonElement>('.commit')!;
    const clearButton = panel.querySelector<HTMLButtonElement>('.clear')!;
    const revertButton = panel.querySelector<HTMLButtonElement>('.revert')!;
    const undoButton = panel.querySelector<HTMLButtonElement>('.undo')!;
    const redoButton = panel.querySelector<HTMLButtonElement>('.redo')!;
    const historyButton = panel.querySelector<HTMLButtonElement>('.show-history')!;
    const historyList = historyDialog.querySelector<HTMLElement>('.history-list')!;
    const fileDiffList = diffDialog.querySelector<HTMLElement>('.file-diff-list')!;
    const textarea = textDialog.querySelector<HTMLTextAreaElement>('textarea')!;
    const textFile = textDialog.querySelector<HTMLElement>('.dialog-file')!;
    const sourceWarning = textDialog.querySelector<HTMLElement>('.source-warning')!;
    const selectionInspector = panel.querySelector<HTMLElement>('.selection-inspector')!;
    const inspectorTextarea = panel.querySelector<HTMLTextAreaElement>('#ave-inspector-text')!;
    const inspectorName = panel.querySelector<HTMLElement>('.selection-name')!;
    const inspectorPreview = panel.querySelector<HTMLElement>('.selection-preview')!;
    const inspectorState = panel.querySelector<HTMLElement>('.selection-state')!;
    const inspectorFile = panel.querySelector<HTMLElement>('.inspector-file')!;
    const inspectorSourcePath = panel.querySelector<HTMLElement>('.inspector-source-path')!;
    const inspectorSelector = panel.querySelector<HTMLElement>('.inspector-selector')!;
    const inspectorSourceWarning = panel.querySelector<HTMLElement>('.inspector-source-warning')!;
    const applySelectionButton = panel.querySelector<HTMLButtonElement>('.apply-selection')!;
    const cancelSelectionButton = panel.querySelector<HTMLButtonElement>('.cancel-selection')!;
    const resetSelectionButton = panel.querySelector<HTMLButtonElement>('.reset-selection')!;
    const toggleSelectionLockButton =
      panel.querySelector<HTMLButtonElement>('.toggle-selection-lock')!;
    const sectionSetting = panel.querySelector<HTMLElement>('.section-setting')!;
    const sectionSettingCopy = panel.querySelector<HTMLElement>('.section-setting-copy')!;
    const addBeforeSelectedButton = panel.querySelector<HTMLButtonElement>('.add-before-selected')!;
    const addAfterSelectedButton = panel.querySelector<HTMLButtonElement>('.add-after-selected')!;
    const deleteSelectedButton = panel.querySelector<HTMLButtonElement>('.delete-selected')!;
    const pickerLabel = picker.querySelector<HTMLElement>('.picker-label')!;
    const pickerReview = picker.querySelector<HTMLButtonElement>('.picker-review')!;
    const templateGrid = templateDialog.querySelector<HTMLElement>('.template-grid')!;
    const minimizeButton = panel.querySelector<HTMLButtonElement>('.minimize')!;
    const setupButton = panel.querySelector<HTMLButtonElement>('.setup-toggle')!;
    const leaveSetupButton = panel.querySelector<HTMLButtonElement>('.leave-setup')!;
    const reloadPolicyButton = panel.querySelector<HTMLButtonElement>('.reload-policy')!;
    const reviewPolicyButton = panel.querySelector<HTMLButtonElement>('.review-policy')!;
    const policyDiffList = policyDialog.querySelector<HTMLElement>('.policy-diff-list')!;
    const setupPickerTitle = setupPagePicker.querySelector<HTMLElement>('.setup-picker-title')!;
    const setupPickerLabel = setupPagePicker.querySelector<HTMLElement>('.setup-picker-label')!;
    const permissionCopy = permissionDialog.querySelector<HTMLElement>('.permission-copy')!;
    const permissionSource = permissionDialog.querySelector<HTMLElement>('.permission-source')!;
    const permissionActions = permissionDialog.querySelector<HTMLElement>('.permission-actions')!;

    function enableLightDismiss(dialog: HTMLDialogElement, onClose?: () => void): void {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close('cancel');
      });
      if (onClose) dialog.addEventListener('close', onClose);
    }

    enableLightDismiss(textDialog, () => {
      if (matchMedia('(max-width: 640px)').matches) clearSelection();
    });
    enableLightDismiss(seoDialog);
    enableLightDismiss(templateDialog, () => {
      addTarget = null;
    });
    enableLightDismiss(confirmDialog, () => {
      deleteTarget = null;
    });
    enableLightDismiss(historyDialog);
    enableLightDismiss(diffDialog, () => {
      previewRequestId = undefined;
    });
    enableLightDismiss(policyDialog);
    enableLightDismiss(regionDialog, clearSetupPickerHighlight);
    enableLightDismiss(regionSourceDialog, clearSetupPickerHighlight);
    enableLightDismiss(permissionDialog, () => {
      if (mode === 'setup') renderInventory();
    });

    function renderHistory(): void {
      renderHistoryPanel(historyList, savedHistory, (entry) => {
        if (saveInFlight) return;
        lastReceiptId = entry.receiptId;
        sessionStorage.setItem(SESSION_RECEIPT, entry.receiptId);
        historyDialog.close();
        requestRevert();
      });
    }

    function renderDemoSurfaces(): void {
      demoSurfaces.replaceChildren();
      demoContext.hidden = config.demoPages.length < 2;
      for (const page of config.demoPages) {
        const button = createElement('button', {
          class: 'demo-surface',
          type: 'button',
          title: page.description,
          'aria-current': page.path === window.location.pathname ? 'page' : 'false',
        });
        button.textContent = page.label;
        button.addEventListener('click', () => {
          if (page.path === window.location.pathname) return;
          if (
            queue.size > 0 &&
            !window.confirm('Switch demo pages and discard this local preview?')
          )
            return;
          window.location.assign(page.path);
        });
        demoSurfaces.append(button);
      }
    }

    function pageDisplay(route: string): { name: string; path: string } {
      const demo = config.demoPages.find((page) => page.path === route);
      if (demo) return { name: demo.label, path: route };
      return { name: route === '/' ? 'Home page' : 'Page', path: route };
    }

    function serializableQueue(): EditorChange[] {
      return [...queue.values()];
    }

    function persist(): void {
      const changes = serializableQueue();
      hasUnsavedChanges = changes.length > 0 || Boolean(pendingRequestId);
      sessionStorage.setItem(SESSION_QUEUE, JSON.stringify(changes));
    }

    function showMessage(text: string, kind: MessageKind): void {
      message.textContent = text;
      message.dataset.show = 'true';
      message.dataset.kind = kind;
    }

    function clearMessage(): void {
      message.textContent = '';
      message.dataset.show = 'false';
    }

    function setConnection(text: string, state: 'ready' | 'warning' | 'error'): void {
      statusCopy.textContent = text;
      status.dataset.state = state;
    }

    function policyIsDirty(): boolean {
      return JSON.stringify(draftEditabilityPolicy) !== JSON.stringify(editabilityPolicy);
    }

    function policyChangeCount(): number {
      const saved = new Map<string, unknown>([
        ...editabilityPolicy.rules.map(
          (rule) => [`rule\n${rule.route}\n${rule.selector}`, rule] as const,
        ),
        ...(editabilityPolicy.regions ?? []).map(
          (region) => [`region\n${region.route}\n${region.selector}`, region] as const,
        ),
      ]);
      const draft = new Map<string, unknown>([
        ...draftEditabilityPolicy.rules.map(
          (rule) => [`rule\n${rule.route}\n${rule.selector}`, rule] as const,
        ),
        ...(draftEditabilityPolicy.regions ?? []).map(
          (region) => [`region\n${region.route}\n${region.selector}`, region] as const,
        ),
      ]);
      return new Set([...saved.keys(), ...draft.keys()]).size
        ? [...new Set([...saved.keys(), ...draft.keys()])].filter(
            (key) => JSON.stringify(saved.get(key)) !== JSON.stringify(draft.get(key)),
          ).length
        : 0;
    }

    function clearGeneratedSectionMappings(): void {
      document
        .querySelectorAll<HTMLElement>('[data-astro-ve-generated-region="true"]')
        .forEach((region) => {
          delete region.dataset.astroVeGeneratedRegion;
          delete region.dataset.astroEditRegion;
          delete region.dataset.astroEditFile;
          delete region.dataset.astroEditPath;
          for (const child of [...region.children]) {
            if (!(child instanceof HTMLElement) || child.dataset.astroVeGeneratedSection !== 'true')
              continue;
            delete child.dataset.astroVeGeneratedSection;
            delete child.dataset.section;
            delete child.dataset.astroEditSourceKey;
          }
        });
    }

    function applySectionRegionPolicy(policy: EditabilityPolicy): void {
      clearGeneratedSectionMappings();
      initialSections.clear();
      const claimedRegions = new Set<HTMLElement>();
      for (const regionRule of policy.regions ?? []) {
        if (regionRule.route !== window.location.pathname) continue;
        let matches: NodeListOf<HTMLElement>;
        try {
          matches = document.querySelectorAll<HTMLElement>(regionRule.selector);
        } catch {
          continue;
        }
        if (matches.length !== 1) continue;
        const region = matches[0]!;
        if (claimedRegions.has(region)) continue;
        const children = [...region.children].filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        );
        if (children.length !== regionRule.items.length) continue;
        region.dataset.astroVeGeneratedRegion = 'true';
        region.dataset.astroEditRegion = regionRule.id;
        region.dataset.astroEditFile = regionRule.filePath;
        region.dataset.astroEditPath = regionRule.sourcePath;
        children.forEach((child, index) => {
          const item = regionRule.items[index]!;
          child.dataset.astroVeGeneratedSection = 'true';
          child.dataset.section = item.id;
          child.dataset.astroEditSourceKey = item.sourceKey;
        });
        claimedRegions.add(region);
      }
    }

    function sectionRegionElements(): HTMLElement[] {
      const seen = new Set<string>();
      return [...document.querySelectorAll<HTMLElement>('main, article, section, div')].filter(
        (element) => {
          if (element.closest('astro-dev-toolbar') || element.closest('[data-astro-ve-ui]'))
            return false;
          const children = [...element.children].filter(
            (child): child is HTMLElement =>
              child instanceof HTMLElement && child.getClientRects().length > 0,
          );
          if (children.length < 2 || children.length > 100) return false;
          const selector = selectorFor(element);
          if (!selector || seen.has(selector)) return false;
          seen.add(selector);
          return true;
        },
      );
    }

    function matchingSectionRegions(target: EventTarget | null): HTMLElement[] {
      if (!(target instanceof Element)) return [];
      return setupPickerCandidates
        .filter((candidate) => candidate === target || candidate.contains(target))
        .sort((left, right) => {
          const leftArea = left.getBoundingClientRect().width * left.getBoundingClientRect().height;
          const rightArea =
            right.getBoundingClientRect().width * right.getBoundingClientRect().height;
          if (leftArea !== rightArea) return leftArea - rightArea;
          return right.querySelectorAll('*').length - left.querySelectorAll('*').length;
        });
    }

    function compactLabel(value: string, maximum = 72): string {
      const clean = value.replace(/\s+/gu, ' ').trim();
      return clean.length > maximum ? `${clean.slice(0, maximum - 1).trimEnd()}…` : clean;
    }

    function regionLabel(region: HTMLElement): string {
      const labelledBy = region.getAttribute('aria-labelledby');
      const labelledText = labelledBy
        ? document.getElementById(labelledBy)?.textContent?.trim()
        : undefined;
      const directHeading = [...region.children].find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && /^H[1-4]$/u.test(child.tagName),
      );
      const explicit =
        region.getAttribute('aria-label') ??
        labelledText ??
        directHeading?.textContent?.trim() ??
        region.dataset.section;
      if (explicit) return compactLabel(explicit);
      if (region.tagName === 'MAIN') return 'Main page content';
      const heading = region.querySelector<HTMLElement>('h1, h2, h3, h4');
      if (heading?.textContent?.trim()) return compactLabel(heading.textContent);
      if (region.tagName === 'ARTICLE') return 'Article or content card';
      const identity = region.id || [...region.classList].find((name) => name.length > 2);
      if (identity)
        return compactLabel(
          identity.replace(/[-_]+/gu, ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase()),
        );
      return `${region.tagName.toLowerCase()} content area`;
    }

    function clearSetupPickerHighlight(): void {
      setupPickerTarget?.removeAttribute('data-astro-ve-setup-pick');
      setupPickerTarget = undefined;
    }

    function stopSetupPagePicker(restoreSetup = true): void {
      clearSetupPickerHighlight();
      setupPickerKind = undefined;
      setupPickerCandidates = [];
      setupPagePicker.dataset.open = 'false';
      if (restoreSetup) {
        panel.dataset.open = String(active);
        updateSetupDock();
        if (mode === 'setup') renderInventory();
      }
    }

    function startSetupPagePicker(kind: 'text' | 'section'): void {
      if (regionDialog.open) regionDialog.close('pick-on-page');
      setupPickerKind = kind;
      setupPickerCandidates =
        kind === 'section'
          ? sectionRegionElements()
          : inventory.map((item) => item.element).filter((element) => element.isConnected);
      clearInventoryMarkers();
      document.documentElement.dataset.astroVeDocked = 'false';
      document.documentElement.dataset.astroVeSetupDocked = 'false';
      panel.dataset.open = 'false';
      picker.dataset.open = 'false';
      setupPickerTitle.textContent = kind === 'section' ? 'Select a page section' : 'Select text';
      setupPickerLabel.textContent =
        kind === 'section'
          ? 'Click any page content. You will then choose the exact size of the area to reorder.'
          : 'Hover to highlight text, then click it.';
      setupPagePicker.dataset.open = 'true';
    }

    function setupPickerCandidate(target: EventTarget | null): HTMLElement | undefined {
      return matchingSectionRegions(target)[0];
    }

    function openPermissionChoice(item: InventoryItem): void {
      permissionCopy.textContent = `“${compactLabel(item.text)}” is currently ${item.status}.`;
      permissionSource.textContent = `${item.sourceFile}${item.sourcePath ? ` → ${item.sourcePath}` : ''}`;
      permissionActions.querySelectorAll('.permission-choice').forEach((button) => button.remove());
      const action = createElement('button', {
        class: `permission-choice ${item.status === 'editable' ? 'danger' : 'primary'}`,
        type: 'button',
      });
      if (item.status === 'editable') {
        action.textContent = 'Block editing this text';
        action.addEventListener('click', () => {
          permissionDialog.close('choose');
          setDraftRule(item, 'deny', 'element');
        });
        permissionActions.append(action);
      } else if (item.canAllow) {
        action.textContent =
          item.status === 'unresolved'
            ? 'Find source and allow editing'
            : 'Allow editing this text';
        action.addEventListener('click', () => {
          permissionDialog.close('choose');
          if (item.status === 'unresolved') requestSourceDiscovery(item);
          else setDraftRule(item, 'allow', 'element');
        });
        permissionActions.append(action);
      }
      permissionDialog.showModal();
      permissionDialog
        .querySelector<HTMLButtonElement>('.permission-choice, .cancel-permission')
        ?.focus();
    }

    function regionScopeName(region: HTMLElement, index: number, total: number): string {
      if (region.tagName === 'MAIN') return 'Whole page';
      if (index === 0) return 'Smallest area';
      if (index === total - 1) return 'Largest area';
      return `Parent area ${index}`;
    }

    function appendRegionChoice(list: HTMLElement, region: HTMLElement, scope?: string): void {
      const childCount = [...region.children].filter(
        (child) => child instanceof HTMLElement,
      ).length;
      const row = createElement('article', { class: 'friendly-region' });
      const copy = createElement('div');
      if (scope) {
        const level = createElement('span', { class: 'region-scope' });
        level.textContent = scope;
        copy.append(level);
      }
      const title = createElement('strong');
      title.textContent = regionLabel(region);
      const description = createElement('span');
      description.textContent = `Move its ${childCount} direct item${childCount === 1 ? '' : 's'}`;
      copy.append(title, description);
      const choose = createElement('button', { class: 'primary', type: 'button' });
      choose.textContent = 'Choose';
      choose.setAttribute(
        'aria-label',
        `Choose ${scope ? `${scope}: ` : ''}${regionLabel(region)}`,
      );
      const highlight = () => {
        clearSetupPickerHighlight();
        setupPickerTarget = region;
        region.dataset.astroVeSetupPick = 'true';
      };
      row.addEventListener('pointerenter', highlight);
      choose.addEventListener('focus', highlight);
      choose.addEventListener('click', () => beginSectionDiscovery(region));
      row.append(copy, choose);
      list.append(row);
    }

    function openRegionScopeChoice(regions: HTMLElement[]): void {
      const list = regionDialog.querySelector<HTMLElement>('.region-candidate-list')!;
      const title = regionDialog.querySelector<HTMLElement>('#ave-region-title')!;
      const help = regionDialog.querySelector<HTMLElement>('#ave-region-help')!;
      const pick = regionDialog.querySelector<HTMLButtonElement>('.pick-region-on-page')!;
      list.replaceChildren();
      title.textContent = 'How much do you want to reorder?';
      help.textContent =
        'Choose the exact level. You can enable the whole page, a parent section, or smaller content inside it independently.';
      pick.hidden = true;
      regions.forEach((region, index) =>
        appendRegionChoice(list, region, regionScopeName(region, index, regions.length)),
      );
      if (regions[0]) {
        setupPickerTarget = regions[0];
        regions[0].dataset.astroVeSetupPick = 'true';
      }
      regionDialog.showModal();
    }

    function openRegionSetup(): void {
      const list = regionDialog.querySelector<HTMLElement>('.region-candidate-list')!;
      const title = regionDialog.querySelector<HTMLElement>('#ave-region-title')!;
      const help = regionDialog.querySelector<HTMLElement>('#ave-region-help')!;
      const pick = regionDialog.querySelector<HTMLButtonElement>('.pick-region-on-page')!;
      list.replaceChildren();
      title.textContent = 'Choose an area to reorder';
      help.textContent =
        'Choose a named area below, or select on the page and then pick its exact nesting level.';
      pick.hidden = false;
      const regions = sectionRegionElements();
      regions.forEach((region) => appendRegionChoice(list, region));
      if (!regions.length) {
        const empty = createElement('div', { class: 'empty' });
        empty.textContent = 'No visible container with two or more direct items was found.';
        list.append(empty);
      }
      pick.disabled = regions.length === 0;
      regionDialog.showModal();
    }

    function nestedInsideGeneratedRegion(region: HTMLElement): boolean {
      return (
        region.dataset.astroVeGeneratedSection === 'true' ||
        Boolean(region.parentElement?.closest('[data-astro-ve-generated-region="true"]'))
      );
    }

    function trustedSectionResolution(
      region: HTMLElement,
      resolution: ReturnType<typeof sourceResolutionFor>,
    ): boolean {
      if (!resolution.proven || nestedInsideGeneratedRegion(region)) return false;
      return resolution.kind !== 'route' || region.tagName === 'MAIN';
    }

    function candidateMatchesRenderedStructure(
      candidate: SectionRegionCandidate,
      region: HTMLElement,
    ): boolean {
      const renderedTags = [...region.children]
        .filter((child): child is HTMLElement => child instanceof HTMLElement)
        .map((child) => child.tagName.toLowerCase());
      return (
        candidate.containerTag === region.tagName.toLowerCase() &&
        candidate.itemTags?.length === renderedTags.length &&
        candidate.itemTags.every((tag, index) => tag === renderedTags[index])
      );
    }

    function candidateMatchesRenderedData(
      candidate: SectionRegionCandidate,
      region: HTMLElement,
    ): boolean {
      if (candidate.containerTag !== 'data') return false;
      const renderedItems = [...region.children].filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );
      if (
        candidate.items.length !== renderedItems.length ||
        candidate.itemValues?.length !== renderedItems.length
      )
        return false;
      return candidate.itemValues.every((sourceValues, index) => {
        const child = renderedItems[index]!;
        const leafValues = [...child.querySelectorAll<HTMLElement>('*')]
          .filter((element) => element.children.length === 0)
          .map((element) => element.textContent?.replace(/\s+/gu, ' ').trim())
          .filter((value): value is string => Boolean(value));
        const visibleValues = leafValues.length
          ? leafValues
          : [child.textContent?.replace(/\s+/gu, ' ').trim() ?? ''];
        return visibleValues.every((value) => sourceValues.includes(value));
      });
    }

    function candidateMatchesRenderedRegion(
      candidate: SectionRegionCandidate,
      region: HTMLElement,
    ): boolean {
      return (
        candidateMatchesRenderedStructure(candidate, region) ||
        candidateMatchesRenderedData(candidate, region)
      );
    }

    function renderedStructureSimilarity(
      candidate: SectionRegionCandidate,
      region: HTMLElement,
    ): number {
      const renderedTags = [...region.children]
        .filter((child): child is HTMLElement => child instanceof HTMLElement)
        .map((child) => child.tagName.toLowerCase());
      let score = candidate.containerTag === region.tagName.toLowerCase() ? 4 : 0;
      candidate.itemTags?.forEach((tag, index) => {
        if (tag === renderedTags[index]) score += 2;
      });
      return score;
    }

    function beginSectionDiscovery(region: HTMLElement): void {
      const children = [...region.children].filter((child) => child instanceof HTMLElement);
      sectionDiscoveryElement = region;
      sectionDiscoveryRequestId = crypto.randomUUID();
      setupBusy = true;
      if (regionDialog.open) regionDialog.close('discover');
      const resolution = sourceResolutionFor(region, config, draftEditabilityPolicy);
      const hintedFilePath = trustedSectionResolution(region, resolution)
        ? resolution.filePath
        : undefined;
      server.send(SECTION_DISCOVERY_EVENT, {
        clientId,
        requestId: sectionDiscoveryRequestId,
        route: window.location.pathname,
        selector: selectorFor(region),
        itemCount: children.length,
        containerTag: region.tagName.toLowerCase(),
        itemTags: children.map((child) => child.tagName.toLowerCase()),
        hintedFilePath,
      });
      showMessage(`Checking “${regionLabel(region)}” against its source…`, 'warning');
    }

    function sectionCandidateScore(candidate: SectionRegionCandidate): number {
      if (!sectionDiscoveryElement) return 0;
      let score = candidate.confidence === 'exact' ? 2 : 0;
      const resolution = sourceResolutionFor(
        sectionDiscoveryElement,
        config,
        draftEditabilityPolicy,
      );
      if (
        trustedSectionResolution(sectionDiscoveryElement, resolution) &&
        resolution.filePath === candidate.filePath
      )
        score += 8;
      score += renderedStructureSimilarity(candidate, sectionDiscoveryElement);
      score += candidateMatchesRenderedRegion(candidate, sectionDiscoveryElement) ? 24 : -12;
      return score;
    }

    function sourceKind(candidate: { filePath: string }): string {
      if (/\/layouts?\//u.test(candidate.filePath)) return 'Page layout';
      if (/\/components?\//u.test(candidate.filePath)) return 'Reusable component';
      if (/\/pages?\//u.test(candidate.filePath)) return 'Page template';
      if (/\.(jsonc?|ya?ml)$/u.test(candidate.filePath)) return 'Structured site data';
      return 'Project source';
    }

    function saveSectionCandidate(candidate: SectionRegionCandidate): void {
      if (!sectionDiscoveryElement) return;
      const regionRule: SectionRegionRule = {
        id: `region-${crypto.randomUUID()}`,
        route: window.location.pathname,
        selector: selectorFor(sectionDiscoveryElement),
        filePath: candidate.filePath,
        sourcePath: candidate.sourcePath,
        items: candidate.items,
      };
      draftEditabilityPolicy = {
        ...draftEditabilityPolicy,
        regions: [
          ...(draftEditabilityPolicy.regions ?? []).filter(
            (region) =>
              !(region.route === regionRule.route && region.selector === regionRule.selector),
          ),
          regionRule,
        ],
      };
      sectionDiscoveryElement = undefined;
      sectionCandidates = [];
      if (regionSourceDialog.open) regionSourceDialog.close('confirm');
      requestPolicyPreview();
    }

    function renderSectionCandidates(candidates: SectionRegionCandidate[]): void {
      const list = regionSourceDialog.querySelector<HTMLElement>('.region-source-candidate-list')!;
      list.replaceChildren();
      const ranked = candidates
        .map((candidate) => ({ candidate, score: sectionCandidateScore(candidate) }))
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.candidate.filePath.localeCompare(right.candidate.filePath),
        );
      const resolution = sectionDiscoveryElement
        ? sourceResolutionFor(sectionDiscoveryElement, config, draftEditabilityPolicy)
        : undefined;
      const isSafeAutomaticMatch = (candidate: SectionRegionCandidate): boolean => {
        if (!sectionDiscoveryElement) return false;
        if (candidateMatchesRenderedRegion(candidate, sectionDiscoveryElement)) return true;
        if (
          resolution &&
          trustedSectionResolution(sectionDiscoveryElement, resolution) &&
          resolution.filePath === candidate.filePath
        )
          return true;
        return false;
      };
      const viable = ranked.filter(({ candidate }) => isSafeAutomaticMatch(candidate));
      if (viable[0] && (viable.length === 1 || viable[0].score > viable[1]!.score)) {
        saveSectionCandidate(viable[0].candidate);
        return;
      }
      viable.forEach(({ candidate }, index) => {
        const label = createElement('label', { class: 'source-candidate' });
        const input = createElement('input', {
          type: 'radio',
          name: 'region-source-candidate',
          value: candidate.id,
        });
        if (index === 0) input.checked = true;
        const copy = createElement('span');
        const file = createElement('strong');
        file.textContent = sourceKind(candidate);
        const reason = createElement('small');
        reason.textContent = `Contains ${candidate.items.length} reorderable items.`;
        const technical = createElement('details', { class: 'technical-details' });
        const summary = createElement('summary');
        summary.textContent = 'Technical details';
        const path = createElement('code');
        path.textContent = `${candidate.filePath}:${candidate.line} → ${candidate.sourcePath}`;
        technical.append(summary, path);
        copy.append(file, reason, technical);
        label.append(input, copy);
        list.append(label);
      });
      if (!viable.length) {
        const empty = createElement('div', { class: 'empty' });
        empty.textContent = 'No matching contiguous Astro source structure was found.';
        list.append(empty);
      }
      regionSourceDialog.querySelector<HTMLButtonElement>('.confirm-region-source')!.disabled =
        viable.length === 0;
      regionSourceDialog.showModal();
    }

    function confirmSectionCandidate(): void {
      const selected = regionSourceDialog.querySelector<HTMLInputElement>(
        'input[name="region-source-candidate"]:checked',
      );
      const candidate = sectionCandidates.find((item) => item.id === selected?.value);
      if (!candidate) return;
      saveSectionCandidate(candidate);
    }

    function requestPolicyPreview(saveDirectly = false): void {
      if (!policyIsDirty() || setupBusy || !config.canManageEditability) return;
      setupBusy = true;
      directPolicySave = saveDirectly;
      editabilityPreviewId = crypto.randomUUID();
      server.send(EDITABILITY_PREVIEW_EVENT, {
        clientId,
        requestId: editabilityPreviewId,
        expectedHash: editabilityPolicyHash,
        policy: draftEditabilityPolicy,
      });
      if (mode === 'setup') renderInventory();
      else renderQueue();
    }

    function leaveSetup(): void {
      if (policyIsDirty()) {
        requestPolicyPreview();
        return;
      }
      setMode('text');
    }

    function clearInventoryMarkers(): void {
      document
        .querySelectorAll<HTMLElement>('[data-astro-ve-inventory-status]')
        .forEach((element) => {
          delete element.dataset.astroVeInventoryStatus;
          delete element.dataset.astroVeInventoryIndex;
          delete element.dataset.astroVeInventoryFocus;
        });
    }

    function updateSetupDock(): void {
      document.documentElement.dataset.astroVeDocked = String(
        active && !minimized && mode !== 'setup',
      );
      document.documentElement.dataset.astroVeSetupDocked = String(active && mode === 'setup');
    }

    function policyRuleId(effect: EditabilityEffect, scope: EditabilityRuleScope): string {
      return `${effect}-${scope}-${crypto.randomUUID()}`;
    }

    function userLockRule(
      element: HTMLElement,
      policy: EditabilityPolicy = editabilityPolicy,
    ): EditabilityRule | undefined {
      const rule = matchingPolicyRule(element, policy);
      return rule?.effect === 'deny' ? rule : undefined;
    }

    function isSourceProtected(element: HTMLElement): boolean {
      if (element.closest('[data-astro-edit-ignore], [data-astro-edit-protected]')) return true;
      if (element.matches('[data-section]')) return !editableRegion(element);
      const item = classifyElement(element, config, editabilityPolicy);
      return item.status !== 'editable' && !userLockRule(element);
    }

    function toggleUserLock(element: HTMLElement): void {
      if (!config.canManageEditability || setupBusy) return;
      if (isSourceProtected(element)) {
        showMessage(
          'This item is source-protected. A user lock cannot override an unsafe or unresolved source mapping.',
          'warning',
        );
        return;
      }
      const route = window.location.pathname;
      const selector = selectorFor(element);
      const currentLock = userLockRule(element);
      draftEditabilityPolicy = structuredClone(editabilityPolicy);
      if (currentLock) {
        draftEditabilityPolicy.rules = draftEditabilityPolicy.rules.filter(
          (rule) => rule.id !== currentLock.id,
        );
        directPolicyLabel = `Unlocked ${selectedKind === 'section' ? 'section' : 'element'}.`;
      } else {
        draftEditabilityPolicy.rules = [
          ...draftEditabilityPolicy.rules.filter(
            (rule) => !(rule.route === route && rule.selector === selector),
          ),
          {
            id: policyRuleId('deny', 'element'),
            effect: 'deny',
            scope: 'element',
            route,
            selector,
          },
        ];
        directPolicyLabel = `Locked ${selectedKind === 'section' ? 'section' : 'element'}.`;
      }
      showMessage(currentLock ? 'Unlocking…' : 'Locking…', 'warning');
      renderSelectionState(element);
      requestPolicyPreview(true);
    }

    function setDraftRule(
      item: InventoryItem,
      effect: EditabilityEffect,
      scope: EditabilityRuleScope,
      confirmedFile?: string,
      confirmedPath?: string,
    ): void {
      if (!config.canManageEditability || setupBusy) return;
      const selector = scope === 'selector' ? item.tagName : item.selector;
      try {
        document.querySelector(selector);
      } catch {
        showMessage(`The selector “${selector}” is not valid in this browser.`, 'error');
        return;
      }
      const route = window.location.pathname;
      let ruleFile = confirmedFile?.trim();
      if (!ruleFile && scope === 'element') ruleFile = item.sourceFile;
      if (!ruleFile && scope === 'selector') {
        const files = new Set(
          [...document.querySelectorAll<HTMLElement>(selector)]
            .map((element) => sourceResolutionFor(element, config, draftEditabilityPolicy))
            .filter((resolution) => resolution.proven)
            .map((resolution) => resolution.filePath),
        );
        if (files.size === 1) ruleFile = [...files][0];
      }
      const rule: EditabilityRule = {
        id: policyRuleId(effect, scope),
        effect,
        scope,
        route,
        selector,
        ...(effect === 'allow' && ruleFile ? { filePath: ruleFile } : {}),
        ...(effect === 'allow' && scope === 'element' && (confirmedPath || item.sourcePath)
          ? { sourcePath: (confirmedPath || item.sourcePath)?.trim() }
          : {}),
      };
      draftEditabilityPolicy = {
        ...draftEditabilityPolicy,
        rules: [
          ...draftEditabilityPolicy.rules.filter(
            (existing) => !(existing.route === route && existing.selector === selector),
          ),
          rule,
        ],
      };
      clearMessage();
      renderInventory();
      requestPolicyPreview();
    }

    function removeDraftRule(rule: EditabilityRule): void {
      draftEditabilityPolicy = {
        ...draftEditabilityPolicy,
        rules: draftEditabilityPolicy.rules.filter((candidate) => candidate.id !== rule.id),
      };
      clearMessage();
      renderInventory();
      requestPolicyPreview();
    }

    function locateInventoryItem(item: InventoryItem, row: HTMLElement): void {
      item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.element.dataset.astroVeInventoryFocus = 'true';
      row.focus({ preventScroll: true });
      window.setTimeout(() => delete item.element.dataset.astroVeInventoryFocus, 1_400);
    }

    function requestSourceDiscovery(item: InventoryItem): void {
      if (!config.canManageEditability || setupBusy) return;
      sourceDiscoveryItem = item;
      sourceCandidates = [];
      sourceDiscoveryRequestId = crypto.randomUUID();
      setupBusy = true;
      server.send(SOURCE_DISCOVERY_EVENT, {
        clientId,
        requestId: sourceDiscoveryRequestId,
        route: window.location.pathname,
        selector: item.selector,
        text: item.text,
        hintedFilePath: item.sourceFile,
      });
      showMessage(
        'Searching supported project source files for exact syntax-aware matches…',
        'warning',
      );
      renderInventory();
    }

    function renderSourceCandidates(candidates: SourceCandidate[], searchedFiles = 0): void {
      const list = sourceDialog.querySelector<HTMLElement>('.source-candidate-list')!;
      list.replaceChildren();
      const exact = candidates.filter((candidate) => candidate.confidence === 'exact');
      const automatic =
        exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : undefined;
      if (automatic && sourceDiscoveryItem) {
        const item = sourceDiscoveryItem;
        sourceDiscoveryItem = undefined;
        sourceCandidates = [];
        setDraftRule(item, 'allow', 'element', automatic.filePath, automatic.sourcePath);
        return;
      }
      if (!candidates.length) {
        const empty = createElement('div', { class: 'empty' });
        empty.textContent = `No exact writable source value was found in ${searchedFiles} supported files.`;
        list.append(empty);
      } else {
        candidates.forEach((candidate, index) => {
          const label = createElement('label', { class: 'source-candidate' });
          const input = createElement('input', {
            type: 'radio',
            name: 'source-candidate',
            value: candidate.id,
          });
          if (index === 0) input.checked = true;
          const copy = createElement('span');
          const file = createElement('strong');
          file.textContent = sourceKind(candidate);
          const reason = createElement('small');
          reason.textContent = 'Contains the exact selected text.';
          const technical = createElement('details', { class: 'technical-details' });
          const summary = createElement('summary');
          summary.textContent = 'Technical details';
          const path = createElement('code');
          path.textContent = `${candidate.filePath}:${candidate.line} → ${candidate.sourcePath ?? 'literal value'}`;
          technical.append(summary, path);
          copy.append(file, reason, technical);
          label.append(input, copy);
          list.append(label);
        });
      }
      const confirm = sourceDialog.querySelector<HTMLButtonElement>('.confirm-source')!;
      confirm.disabled = candidates.length === 0;
      sourceDialog.showModal();
      sourceDialog.querySelector<HTMLInputElement>('input:checked')?.focus();
    }

    function renderInventory(): void {
      const currentInventoryManager = ledger.querySelector<HTMLDetailsElement>('.manage-text');
      const currentSectionManager = ledger.querySelector<HTMLDetailsElement>('.manage-sections');
      if (currentInventoryManager) inventoryManagerOpen = currentInventoryManager.open;
      if (currentSectionManager) sectionManagerOpen = currentSectionManager.open;
      clearInventoryMarkers();
      ledger.setAttribute('aria-label', 'Page editability inventory');
      inventory = inventoryPage(config, draftEditabilityPolicy);
      inventory.forEach((item, index) => {
        item.element.dataset.astroVeInventoryStatus = item.status;
        item.element.dataset.astroVeInventoryIndex = String(index);
      });
      renderEditabilityPanel(ledger, inventory, {
        policyFile: config.editabilityPolicyFile,
        route: window.location.pathname,
        sectionRegions: (draftEditabilityPolicy.regions ?? []).filter(
          (region) => region.route === window.location.pathname,
        ),
        canManage: config.canManageEditability,
        pendingChanges: policyChangeCount(),
        filter: inventoryFilter,
        inventoryOpen: inventoryManagerOpen,
        sectionsOpen: sectionManagerOpen,
        onReview: requestPolicyPreview,
        onFilter: (filter) => {
          inventoryFilter = filter;
          renderInventory();
        },
        onLocate: locateInventoryItem,
        onDiscoverSource: requestSourceDiscovery,
        onAddSectionRegion: openRegionSetup,
        onPickSectionRegion: () => startSetupPagePicker('section'),
        onPickText: () => startSetupPagePicker('text'),
        onRemoveSectionRegion: (region) => {
          draftEditabilityPolicy = {
            ...draftEditabilityPolicy,
            regions: (draftEditabilityPolicy.regions ?? []).filter(
              (candidate) => candidate.id !== region.id,
            ),
          };
          clearMessage();
          renderInventory();
          requestPolicyPreview();
        },
        onSetRule: setDraftRule,
        onRemoveRule: (item) => {
          if (item.activeRule) removeDraftRule(item.activeRule);
        },
      });
      const pendingChanges = policyChangeCount();
      reviewPolicyButton.disabled =
        pendingChanges === 0 || setupBusy || !config.canManageEditability;
      reviewPolicyButton.textContent = setupBusy
        ? 'Preparing review…'
        : `Review and save${pendingChanges > 0 ? ` (${pendingChanges})` : ''}`;
      reloadPolicyButton.hidden = pendingChanges === 0;
      reloadPolicyButton.disabled = setupBusy;
    }

    function renderQueue(): void {
      if (mode === 'setup') {
        renderInventory();
        return;
      }
      panel.dataset.needsSection = 'false';
      clearInventoryMarkers();
      ledger.setAttribute('aria-label', 'Queued changes');
      ledger.replaceChildren();
      if (queue.size === 0) {
        const empty = createElement('div', { class: 'empty' });
        empty.textContent =
          mode === 'sections'
            ? 'No structural changes. Use section controls or drag a section handle.'
            : mode === 'seo'
              ? 'No SEO changes queued.'
              : 'No queued changes. Select visible content to begin.';
        ledger.append(empty);
      } else {
        for (const [key, change] of queue) {
          const row = createElement('article', { class: 'change' });
          const copy = createElement('div');
          const type = createElement('span', { class: 'change-type' });
          type.textContent =
            change.kind === 'text' ? 'Text' : change.kind === 'seo' ? 'Page settings' : 'Sections';
          const affectedPage = pageDisplay(change.route);
          const page = createElement('div', { class: 'change-page' });
          const pageName = createElement('strong');
          pageName.textContent = affectedPage.name;
          const pagePath = createElement('span');
          pagePath.textContent = affectedPage.path;
          page.append(pageName, pagePath);
          const technical = createElement('details', {
            class: 'technical-details change-technical',
          });
          const technicalSummary = createElement('summary');
          technicalSummary.textContent = 'Technical details';
          const file = createElement('div', { class: 'file', title: change.filePath });
          file.textContent = `Source file: ${change.filePath}`;
          const values = summary(change);
          const summaryLine = createElement('div', { class: 'change-summary' });
          summaryLine.textContent = values.title;
          const description = createElement('p', { class: 'change-description' });
          description.textContent = values.description;
          const visibleDiff = createElement('div', { class: 'visible-diff' });
          if (change.kind !== 'sections') {
            const beforeValue = createElement('div');
            const beforeLabel = createElement('strong');
            beforeLabel.textContent = 'Before';
            const beforeCopy = createElement('span');
            beforeCopy.textContent = visibleValue(values.before);
            beforeValue.append(beforeLabel, beforeCopy);
            const afterValue = createElement('div');
            const afterLabel = createElement('strong');
            afterLabel.textContent = 'After';
            const afterCopy = createElement('span');
            afterCopy.textContent = visibleValue(values.after);
            afterValue.append(afterLabel, afterCopy);
            visibleDiff.append(beforeValue, afterValue);
          }
          const sourceLocator = createElement('div', { class: 'file' });
          const sourcePath = change.kind === 'seo' ? undefined : change.sourcePath;
          sourceLocator.textContent = sourcePath
            ? `Source field: ${sourcePath}`
            : change.kind === 'text' && change.selector
              ? `Page selector: ${change.selector}`
              : change.kind === 'sections'
                ? `Section region: ${change.regionId}`
                : 'Source field: page metadata';
          const diff = createElement('div', { class: 'diff technical-diff' });
          const oldText = createElement('span', { class: 'old' });
          const newText = createElement('span', { class: 'new' });
          oldText.textContent = `Before: ${values.before}`;
          newText.textContent = `After: ${values.after}`;
          diff.append(oldText, newText);
          technical.append(technicalSummary, file, sourceLocator, diff);
          copy.append(page, type, summaryLine, description);
          if (visibleDiff.childElementCount) copy.append(visibleDiff);
          copy.append(technical);
          const removeLabel = `Undo ${change.kind} change in ${change.filePath}`;
          const remove = createElement('button', {
            class: 'icon-button',
            type: 'button',
            'aria-label': removeLabel,
            title: removeLabel,
          });
          remove.textContent = '×';
          remove.addEventListener('click', () => mutate(() => queue.delete(key)));
          row.append(copy, remove);
          ledger.append(row);
        }
      }
      commitButton.disabled =
        queue.size === 0 || saveInFlight || previewInFlight || !config.writeEnabled;
      commitButton.textContent = saveInFlight
        ? 'Validating and writing…'
        : previewInFlight
          ? 'Checking source files…'
          : pendingRequestId
            ? `Retry ${queue.size} safely`
            : `Review and save${queue.size ? ` (${queue.size})` : ''}`;
      changeCount.textContent = String(queue.size);
      changesToggle.setAttribute('aria-expanded', String(mode === 'review'));
      changesToggle.setAttribute(
        'aria-label',
        `${mode === 'review' ? 'Close' : 'Open'} changes tray, ${queue.size} queued change${queue.size === 1 ? '' : 's'}`,
      );
      panel.dataset.hasChanges = String(queue.size > 0);
      undoButton.disabled = !history.canUndo || saveInFlight;
      redoButton.disabled = !history.canRedo || saveInFlight;
      revertButton.disabled = !lastReceiptId || saveInFlight || !config.writeEnabled;
      pickerReview.textContent = queue.size ? `Review ${queue.size}` : 'Expand';
      pickerReview.title = queue.size
        ? `Expand editor and review ${queue.size} queued change${queue.size === 1 ? '' : 's'}`
        : 'Expand editor';
      app.toggleNotification({ state: queue.size > 0, level: 'info' });
      persist();
    }

    function findRegion(regionId: string, filePath: string): HTMLElement | null {
      for (const candidate of document.querySelectorAll<HTMLElement>(
        '[data-astro-edit-region], [data-astro-edit-sections]',
      )) {
        if (
          regionIdFor(candidate) === regionId &&
          sourceFileFor(candidate, config, editabilityPolicy) === filePath
        )
          return candidate;
      }
      return null;
    }

    function templateNode(templateId: string, id: string): HTMLElement | null {
      const template = config.sectionTemplates.find((item) => item.id === templateId);
      if (!template) return null;
      const holder = document.createElement('template');
      holder.innerHTML = template.markup.replaceAll('{{id}}', id).trim();
      const node = holder.content.firstElementChild;
      if (!(node instanceof HTMLElement) || node.tagName.toLowerCase() !== 'section') return null;
      node.dataset.section = id;
      node.dataset.astroVeTemplate = templateId;
      sectionNodes.set(id, node);
      return node;
    }

    function directSections(region: HTMLElement): HTMLElement[] {
      return [...region.children].filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.matches('[data-section]'),
      );
    }

    function ensureAnchor(region: HTMLElement): Comment {
      let anchor = regionAnchors.get(region);
      if (!anchor) {
        anchor = document.createComment('astro-visual-editor-section-anchor');
        const sections = directSections(region);
        sections.at(-1)?.after(anchor);
        if (sections.length === 0) region.append(anchor);
        regionAnchors.set(region, anchor);
      }
      return anchor;
    }

    function applySectionState(change: SectionsEditorChange, state: SectionDescriptor[]): void {
      const region = findRegion(change.regionId, change.filePath);
      if (!region) return;
      const anchor = ensureAnchor(region);
      for (const section of directSections(region)) {
        const id = section.dataset.section;
        if (id) sectionNodes.set(id, section);
        section.remove();
      }
      for (const descriptor of state) {
        let node = sectionNodes.get(descriptor.id);
        if (!node && descriptor.templateId)
          node = templateNode(descriptor.templateId, descriptor.id) ?? undefined;
        if (node) region.insertBefore(node, anchor);
      }
      if (mode === 'sections') setupSectionControls();
    }

    function revertVisual(changes: EditorChange[]): void {
      for (const change of [...changes].reverse()) {
        if (change.kind === 'text' && change.selector) {
          const element = document.querySelector<HTMLElement>(change.selector);
          if (element) element.textContent = change.oldText;
        } else if (change.kind === 'seo') setSeoPreview(change.before);
        else if (change.kind === 'sections') applySectionState(change, change.before);
      }
    }

    function applyVisual(changes: EditorChange[]): void {
      for (const change of changes) {
        if (change.kind === 'text' && change.selector) {
          const element = document.querySelector<HTMLElement>(change.selector);
          if (element && element.textContent !== change.newText)
            element.textContent = change.newText;
        } else if (change.kind === 'seo') setSeoPreview(change.after);
        else if (change.kind === 'sections') applySectionState(change, change.after);
      }
    }

    // Astro HMR can replace page content just after the toolbar has restored a
    // tab's session queue. Reapply text previews when that replacement lands so
    // the queued value stays visible without changing another tab's queue.
    let previewFrame: number | undefined;
    const pageObserver = new MutationObserver(() => {
      if (!panel.isConnected) {
        pageObserver.disconnect();
        if (previewFrame !== undefined) cancelAnimationFrame(previewFrame);
        return;
      }
      if (queue.size === 0 || previewFrame !== undefined) return;
      previewFrame = requestAnimationFrame(() => {
        previewFrame = undefined;
        for (const change of queue.values()) {
          if (change.kind !== 'text' || !change.selector) continue;
          const element = document.querySelector<HTMLElement>(change.selector);
          if (element && element.textContent !== change.newText)
            element.textContent = change.newText;
        }
      });
    });
    // Observe the Document itself because Astro may replace the complete
    // documentElement while keeping the dev toolbar alive.
    pageObserver.observe(document, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    function replaceQueue(changes: EditorChange[]): void {
      const current = serializableQueue();
      revertVisual(current);
      queue.clear();
      for (const change of changes) queue.set(changeKey(change), change);
      applyVisual(changes);
      renderQueue();
    }

    function mutate(change: () => void): void {
      const current = serializableQueue();
      history.record(current);
      revertVisual(current);
      change();
      applyVisual(serializableQueue());
      pendingRequestId = undefined;
      previewRequestId = undefined;
      sessionStorage.removeItem(SESSION_PENDING);
      clearMessage();
      renderQueue();
    }

    function undo(): void {
      const previous = history.undo(serializableQueue());
      if (!previous) return;
      replaceQueue(previous);
      showMessage('Last queued action undone.', 'success');
    }

    function redo(): void {
      const next = history.redo(serializableQueue());
      if (!next) return;
      replaceQueue(next);
      showMessage('Queued action restored.', 'success');
    }

    function restoreHighlight(): void {
      if (!hovered) return;
      hovered.style.removeProperty('outline');
      hovered.style.removeProperty('outline-offset');
      hovered.style.removeProperty('cursor');
      delete hovered.dataset.astroVeTextState;
      delete hovered.dataset.astroVeTextLabel;
      hovered = null;
    }

    function setupTextBoundaries(): void {
      document.querySelectorAll<HTMLElement>('[data-astro-ve-text-active]').forEach((element) => {
        delete element.dataset.astroVeTextActive;
        if (element !== editing) delete element.dataset.astroVeProtection;
      });
      if (!active || !configReady) return;
      for (const item of inventoryPage(config, editabilityPolicy)) {
        item.element.dataset.astroVeTextActive = 'true';
        item.element.dataset.astroVeProtection = selectionProtection(item.element).state;
      }
    }

    function showElementControls(candidate: HTMLElement): void {
      document.querySelector('.astro-ve-element-controls')?.remove();
      const protection = selectionProtection(candidate);
      const label = textTargetLabel(candidate);
      const controls = createElement('div', {
        class: 'astro-ve-element-controls',
        'data-astro-ve-ui': 'true',
        'data-protection': protection.state,
        role: 'toolbar',
        'aria-label': `Controls for ${label}`,
      });
      const controlsLabel = createElement('span', { class: 'astro-ve-element-label' });
      controlsLabel.textContent = label;
      controls.append(controlsLabel);
      addControl(controls, `Edit ${label}`, 'settings', () => openTextEditor(candidate));
      if (protection.state === 'protected') {
        const shield = addControl(
          controls,
          `${label} is source-protected`,
          'shield',
          () => undefined,
        );
        shield.disabled = true;
      } else {
        addControl(
          controls,
          `${protection.state === 'locked' ? 'Unlock' : 'Lock'} ${label}`,
          protection.state === 'locked' ? 'unlock' : 'lock',
          () => {
            selectedKind = 'text';
            editing = candidate;
            toggleUserLock(candidate);
          },
        );
      }
      document.body.append(controls);
      const rect = candidate.getBoundingClientRect();
      const controlHeight = 34;
      const top =
        rect.top >= controlHeight + 8
          ? window.scrollY + rect.top - controlHeight
          : window.scrollY + rect.bottom + 4;
      const controlsWidth = controls.getBoundingClientRect().width;
      const left = Math.min(
        window.scrollX + rect.right - controlsWidth,
        window.scrollX + innerWidth - controlsWidth - 8,
      );
      controls.style.setProperty('top', `${top}px`, 'important');
      controls.style.setProperty('left', `${Math.max(window.scrollX + 4, left)}px`, 'important');
    }

    function setInspectorTab(next: 'content' | 'design' | 'advanced'): void {
      for (const tab of selectionInspector.querySelectorAll<HTMLButtonElement>('.inspector-tab')) {
        tab.setAttribute('aria-selected', String(tab.dataset.inspectorTab === next));
      }
      for (const content of selectionInspector.querySelectorAll<HTMLElement>('.inspector-panel')) {
        content.hidden = content.dataset.inspectorPanel !== next;
      }
    }

    function clearSelection(): void {
      editing?.removeAttribute('data-astro-ve-selected');
      editing?.removeAttribute('data-astro-ve-protection');
      editing = null;
      selectedKind = null;
      selectionInspector.hidden = true;
      panel.dataset.hasSelection = 'false';
      if (mode === 'text') {
        panelTitle.textContent = 'Edit content';
        instructions.textContent = 'Hover over page content, then click to edit.';
      }
    }

    function populateComputedSettings(candidate: HTMLElement): void {
      const computed = getComputedStyle(candidate);
      const values: Record<string, string> = {
        font: computed.fontFamily,
        size: computed.fontSize,
        weight: computed.fontWeight,
        align: computed.textAlign,
        margin: computed.margin,
        padding: computed.padding,
      };
      for (const target of selectionInspector.querySelectorAll<HTMLElement>('[data-computed]')) {
        target.textContent = values[target.dataset.computed ?? ''] || 'Not set';
      }
    }

    function selectionProtection(candidate: HTMLElement): {
      state: 'unlocked' | 'locked' | 'protected';
      reason: string;
    } {
      const lock = userLockRule(candidate);
      if (lock)
        return {
          state: 'locked',
          reason: 'Locked by the site owner. Unlock it here to edit or move it.',
        };
      if (isSourceProtected(candidate)) {
        const item = candidate.matches('[data-section]')
          ? undefined
          : classifyElement(candidate, config, editabilityPolicy);
        return {
          state: 'protected',
          reason:
            item?.reason ??
            'Protected because this section does not have a validated source-owned region.',
        };
      }
      return {
        state: 'unlocked',
        reason: 'Unlocked and ready to edit.',
      };
    }

    function renderSelectionState(candidate: HTMLElement): void {
      const protection = selectionProtection(candidate);
      selectionInspector.dataset.protection = protection.state;
      candidate.dataset.astroVeProtection = protection.state;
      inspectorState.textContent =
        protection.state === 'unlocked'
          ? 'Unlocked · ready to edit'
          : protection.state === 'locked'
            ? 'Locked · click Unlock to edit'
            : `Protected · ${protection.reason}`;
      toggleSelectionLockButton.hidden =
        protection.state === 'protected' || !config.canManageEditability;
      toggleSelectionLockButton.disabled = setupBusy;
      toggleSelectionLockButton.innerHTML =
        protection.state === 'locked'
          ? `${icon('unlock')}<span>Unlock</span>`
          : `${icon('lock')}<span>Lock</span>`;
      toggleSelectionLockButton.setAttribute(
        'aria-label',
        protection.state === 'locked' ? 'Unlock selected item' : 'Lock selected item',
      );
      const editable = protection.state === 'unlocked';
      if (selectedKind === 'text') {
        inspectorTextarea.disabled = !editable;
        resetSelectionButton.hidden = !editable;
        applySelectionButton.hidden = !editable;
      } else {
        applySelectionButton.hidden = false;
        for (const button of [
          addBeforeSelectedButton,
          addAfterSelectedButton,
          deleteSelectedButton,
        ])
          button.disabled = !editable;
      }
    }

    function textCandidate(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element) || !configReady) return null;
      const candidate = target.closest<HTMLElement>(
        'h1,h2,h3,h4,h5,h6,p,li,strong,em,blockquote,figcaption,a,button,span',
      );
      if (
        !candidate ||
        candidate.closest('astro-dev-toolbar') ||
        candidate.closest('[data-astro-ve-ui]') ||
        !candidate.textContent?.trim()
      )
        return null;
      return candidate;
    }

    function textTargetLabel(candidate: HTMLElement): string {
      if (/^H[1-6]$/.test(candidate.tagName)) return 'Heading';
      if (candidate.tagName === 'P') return 'Paragraph';
      if (candidate.tagName === 'LI') return 'List item';
      if (candidate.tagName === 'A') return 'Link text';
      if (candidate.tagName === 'BUTTON') return 'Button text';
      if (candidate.tagName === 'STRONG') return 'Bold text';
      return 'Text';
    }

    function editableTarget(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element) || !configReady) return null;
      let candidate: HTMLElement | null = null;
      try {
        candidate = target.closest<HTMLElement>(
          [...config.editableSelectors, ...policyAllowSelectors(editabilityPolicy)].join(','),
        );
      } catch {
        return null;
      }
      if (
        !candidate ||
        candidate.closest('astro-dev-toolbar') ||
        candidate.closest('[data-astro-ve-ui]')
      )
        return null;
      return classifyElement(candidate, config, editabilityPolicy).status === 'editable'
        ? candidate
        : null;
    }

    function openTextEditor(candidate: HTMLElement): void {
      if (mode !== 'text') setMode('text');
      editing?.removeAttribute('data-astro-ve-selected');
      editing = candidate;
      selectedKind = 'text';
      editing.dataset.astroVeSelected = 'true';
      const selector = selectorFor(candidate);
      const queued = queue.get(
        `text:${sourceFileFor(candidate, config, editabilityPolicy)}:${selector}`,
      );
      const existing = queued?.kind === 'text' ? queued : undefined;
      textarea.value = existing?.newText ?? candidate.textContent?.trim() ?? '';
      const resolution = sourceResolutionFor(candidate, config, editabilityPolicy);
      textFile.textContent = `${resolution.filePath}${resolution.sourcePath ? ` → ${resolution.sourcePath}` : ''}`;
      sourceWarning.hidden = !resolution.sharedRouteCount;
      sourceWarning.textContent = resolution.sharedRouteCount
        ? `Shared source: this edit will affect ${resolution.sharedRouteCount} routes.`
        : '';
      const protection = selectionProtection(candidate);
      if (matchMedia('(max-width: 640px)').matches && protection.state === 'unlocked') {
        textDialog.showModal();
        textarea.focus();
        textarea.select();
        return;
      }
      const label = textTargetLabel(candidate);
      const value = existing?.newText ?? candidate.textContent?.trim() ?? '';
      panel.dataset.hasSelection = 'true';
      selectionInspector.hidden = false;
      panelTitle.textContent = `Edit ${label.toLowerCase()}`;
      instructions.textContent = `${label} selected on the page.`;
      inspectorName.textContent = label;
      inspectorPreview.textContent = compactLabel(value);
      inspectorTextarea.value = value;
      inspectorFile.textContent = resolution.filePath;
      inspectorSourcePath.textContent = resolution.sourcePath ?? 'Literal rendered text';
      inspectorSelector.textContent = selector;
      inspectorSourceWarning.hidden = !resolution.sharedRouteCount;
      inspectorSourceWarning.textContent = resolution.sharedRouteCount
        ? `Shared source: this edit will affect ${resolution.sharedRouteCount} routes.`
        : '';
      applySelectionButton.textContent = existing ? 'Update queued change' : 'Queue change';
      selectionInspector
        .querySelectorAll<HTMLElement>('.text-setting')
        .forEach((setting) => (setting.hidden = false));
      sectionSetting.hidden = true;
      resetSelectionButton.hidden = false;
      populateComputedSettings(candidate);
      renderSelectionState(candidate);
      setInspectorTab('content');
      if (!inspectorTextarea.disabled) {
        inspectorTextarea.focus();
        inspectorTextarea.select();
      } else toggleSelectionLockButton.focus();
    }

    function openSectionInspector(section: HTMLElement): void {
      if (mode !== 'sections') setMode('sections');
      editing?.removeAttribute('data-astro-ve-selected');
      editing = section;
      selectedKind = 'section';
      editing.dataset.astroVeSelected = 'true';
      const label = sectionControlLabel(section);
      const region = editableRegion(section);
      const resolutionTarget = region ?? section;
      const resolution = sourceResolutionFor(resolutionTarget, config, editabilityPolicy);
      panel.dataset.hasSelection = 'true';
      selectionInspector.hidden = false;
      panelTitle.textContent = 'Edit section';
      instructions.textContent = `${label} selected on the page.`;
      inspectorName.textContent = label;
      const childCount = section.querySelectorAll(':scope > :not([data-astro-ve-ui])').length;
      inspectorPreview.textContent = `${childCount} direct child${childCount === 1 ? '' : 'ren'}`;
      inspectorFile.textContent = resolution.filePath;
      inspectorSourcePath.textContent =
        resolution.sourcePath ?? region?.dataset.astroEditRegion ?? 'Section region';
      inspectorSelector.textContent = selectorFor(section);
      inspectorSourceWarning.hidden = true;
      selectionInspector
        .querySelectorAll<HTMLElement>('.text-setting')
        .forEach((setting) => (setting.hidden = true));
      sectionSetting.hidden = false;
      sectionSettingCopy.textContent =
        'Use the same source-safe controls shown on the selected section boundary.';
      resetSelectionButton.hidden = true;
      applySelectionButton.textContent = 'Done';
      populateComputedSettings(section);
      renderSelectionState(section);
      setInspectorTab('content');
    }

    function onPointerOver(event: PointerEvent): void {
      if (setupPickerKind) {
        const candidate = setupPickerCandidate(event.target);
        if (candidate === setupPickerTarget) return;
        clearSetupPickerHighlight();
        setupPickerTarget = candidate;
        if (candidate) {
          candidate.dataset.astroVeSetupPick = 'true';
          setupPickerLabel.textContent =
            setupPickerKind === 'section'
              ? `${regionLabel(candidate)} · smallest of ${matchingSectionRegions(event.target).length} available levels`
              : compactLabel(candidate.textContent ?? 'Selected text');
        } else {
          setupPickerLabel.textContent = 'Move over page content to highlight it.';
        }
        return;
      }
      if (!active || mode === 'review' || mode === 'seo' || mode === 'setup' || textDialog.open)
        return;
      if (event.target instanceof Element && event.target.closest('[data-astro-ve-ui]')) return;
      if (event.target instanceof Element && !event.target.closest('[data-astro-ve-ui]')) {
        const section = event.target.closest<HTMLElement>('[data-astro-ve-section-active="true"]');
        if (section) revealSectionControls(section);
      }
      const candidate = textCandidate(event.target);
      if (candidate === hovered) return;
      restoreHighlight();
      hovered = candidate;
      if (hovered) {
        const protection = selectionProtection(hovered);
        hovered.dataset.astroVeTextState = protection.state;
        hovered.dataset.astroVeTextLabel = `${protection.state === 'unlocked' ? 'Edit' : protection.state === 'locked' ? 'Unlock' : 'Protected'} · ${textTargetLabel(hovered)}`;
        hovered.style.cursor = protection.state === 'protected' ? 'not-allowed' : 'pointer';
        showElementControls(hovered);
      }
    }

    function onPageClick(event: MouseEvent): void {
      if (!active || textDialog.open) return;
      if (setupPickerKind) {
        const candidate = setupPickerCandidate(event.target);
        if (!candidate) return;
        const kind = setupPickerKind;
        const regionMatches = kind === 'section' ? matchingSectionRegions(event.target) : [];
        event.preventDefault();
        event.stopPropagation();
        stopSetupPagePicker(false);
        panel.dataset.open = String(active);
        updateSetupDock();
        if (kind === 'section') {
          if (regionMatches.length > 1) openRegionScopeChoice(regionMatches);
          else beginSectionDiscovery(candidate);
        } else {
          const item = inventory.find((entry) => entry.element === candidate);
          if (item) openPermissionChoice(item);
          else if (mode === 'setup') renderInventory();
        }
        return;
      }
      if (mode === 'setup') {
        if (!(event.target instanceof Element)) return;
        const selected = event.target.closest<HTMLElement>('[data-astro-ve-inventory-status]');
        const item = inventory.find((candidate) => candidate.element === selected);
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        const rows = [...ledger.querySelectorAll<HTMLElement>('.inventory-item')];
        const row = rows.find(
          (candidate) => candidate.querySelector('.inventory-copy')?.textContent === item.text,
        );
        if (row) locateInventoryItem(item, row);
        return;
      }
      if (mode === 'review' || mode === 'seo') return;
      const text = textCandidate(event.target);
      if (text) {
        event.preventDefault();
        event.stopPropagation();
        const protection = selectionProtection(text);
        if (matchMedia('(max-width: 640px)').matches && protection.state === 'locked') {
          selectedKind = 'text';
          toggleUserLock(text);
        } else openTextEditor(text);
        return;
      }
      if (event.target instanceof Element) {
        const section = event.target.closest<HTMLElement>(
          '[data-section][data-astro-ve-section-active="true"]',
        );
        if (!section || event.target.closest('[data-astro-ve-ui]')) return;
        event.preventDefault();
        event.stopPropagation();
        openSectionInspector(section);
      }
    }

    function queueText(): void {
      if (!editing) return;
      const inspectorOpen = !selectionInspector.hidden && !matchMedia('(max-width: 640px)').matches;
      const newText = (inspectorOpen ? inspectorTextarea : textarea).value.trim();
      const selector = selectorFor(editing);
      const resolution = sourceResolutionFor(editing, config, editabilityPolicy);
      const filePath = resolution.filePath;
      const key = `text:${filePath}:${selector}`;
      const existing = queue.get(key);
      if (!existing && queue.size >= config.maxChanges) {
        showMessage(
          `The queue limit is ${config.maxChanges} changes. Remove or commit a change first.`,
          'error',
        );
        return;
      }
      const oldText =
        existing?.kind === 'text' ? existing.oldText : (editing.textContent?.trim() ?? '');
      if (!newText) {
        showMessage(
          'Replacement text cannot be empty. Delete a section in Sections mode instead.',
          'error',
        );
        return;
      }
      if (newText.length > config.maxTextLength) {
        showMessage(`Text exceeds the ${config.maxTextLength}-character limit.`, 'error');
        return;
      }
      mutate(() => {
        if (newText === oldText) queue.delete(key);
        else {
          const change: TextEditorChange = {
            kind: 'text',
            id: existing?.id ?? crypto.randomUUID(),
            filePath,
            route: window.location.pathname,
            selector,
            oldText,
            newText,
            sourcePath: resolution.sourcePath,
          };
          queue.set(key, change);
        }
      });
      if (textDialog.open) textDialog.close();
      if (matchMedia('(max-width: 640px)').matches) {
        setMinimized(true);
      } else {
        applySelectionButton.textContent = 'Update queued change';
        inspectorPreview.textContent = compactLabel(newText);
        showMessage('Content preview queued. Review changes before saving.', 'success');
      }
    }

    function editableRegion(section: HTMLElement): HTMLElement | null {
      const parentRegion = section.parentElement?.closest<HTMLElement>(
        '[data-astro-edit-region], [data-astro-edit-sections]',
      );
      if (parentRegion && directSections(parentRegion).includes(section)) return parentRegion;
      return section.closest<HTMLElement>('[data-astro-edit-region], [data-astro-edit-sections]');
    }

    function descriptors(region: HTMLElement): SectionDescriptor[] {
      return directSections(region).map((section) => ({
        id: section.dataset.section!,
        label: sectionReviewLabel(section),
        ...(section.dataset.astroVeTemplate ? { templateId: section.dataset.astroVeTemplate } : {}),
        ...(section.dataset.astroEditSourceKey
          ? { sourceKey: section.dataset.astroEditSourceKey }
          : {}),
      }));
    }

    function sectionReviewLabel(section: HTMLElement): string {
      const clone = section.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-astro-ve-ui]').forEach((element) => element.remove());
      const heading = clone.querySelector<HTMLElement>('h1, h2, h3, h4');
      const shortLabel = clone.querySelector<HTMLElement>('strong, [data-astro-edit-label]');
      const text = (heading?.textContent ?? shortLabel?.textContent ?? clone.textContent ?? '')
        .replace(/\s+/gu, ' ')
        .trim();
      if (text) return compactLabel(text, 90);
      return descriptorLabel({ id: section.dataset.section! });
    }

    function sectionControlLabel(section: HTMLElement): string {
      const kind = /^H[1-6]$/u.test(section.tagName)
        ? 'Heading'
        : section.tagName === 'BUTTON'
          ? 'Button'
          : section.tagName === 'P'
            ? 'Text'
            : section.tagName === 'SECTION'
              ? 'Section'
              : section.tagName === 'ARTICLE'
                ? 'Card'
                : 'Block';
      return `${kind}: ${sectionReviewLabel(section)}`;
    }

    function sameSectionStructure(
      before: SectionDescriptor[],
      after: SectionDescriptor[],
    ): boolean {
      const structural = (items: SectionDescriptor[]) =>
        items.map(({ id, templateId, sourceKey }) => ({ id, templateId, sourceKey }));
      return JSON.stringify(structural(before)) === JSON.stringify(structural(after));
    }

    function regionKey(region: HTMLElement): string {
      return `${sourceFileFor(region, config, editabilityPolicy)}:${regionIdFor(region)}`;
    }

    function queueRegion(region: HTMLElement): void {
      const filePath = sourceFileFor(region, config, editabilityPolicy);
      const regionId = regionIdFor(region);
      const sourcePath = region.dataset.astroEditPath;
      const key = `sections:${filePath}:${regionId}`;
      const before = initialSections.get(regionKey(region)) ?? descriptors(region);
      initialSections.set(regionKey(region), structuredClone(before));
      const after = descriptors(region);
      if (sameSectionStructure(before, after)) queue.delete(key);
      else {
        queue.set(key, {
          kind: 'sections',
          id: crypto.randomUUID(),
          filePath,
          route: window.location.pathname,
          regionId,
          sourcePath,
          before,
          after,
        });
      }
    }

    function moveSection(section: HTMLElement, direction: -1 | 1): void {
      if (selectionProtection(section).state !== 'unlocked') return;
      const region = editableRegion(section);
      if (!region) return;
      const sections = directSections(region);
      const index = sections.indexOf(section);
      const target = sections[index + direction];
      if (!target) return;
      mutate(() => {
        if (direction < 0) target.before(section);
        else target.after(section);
        queueRegion(region);
      });
      setupSectionControls();
      setupTextBoundaries();
    }

    function addControl(
      controls: HTMLElement,
      label: string,
      iconName: IconName,
      action: () => void,
    ): HTMLButtonElement {
      const button = createElement('button', {
        type: 'button',
        'aria-label': label,
        title: label,
        'data-tooltip': label,
      });
      button.innerHTML = icon(iconName);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        action();
      });
      controls.append(button);
      return button;
    }

    function revealSectionControls(section: HTMLElement): void {
      const region = editableRegion(section);
      if (!region) return;
      region
        .querySelectorAll<HTMLElement>('.astro-ve-section-controls')
        .forEach(
          (toolbar) =>
            (toolbar.dataset.visible = String(
              toolbar.dataset.sectionId === section.dataset.section,
            )),
        );
    }

    function setupSectionControls(): void {
      sectionListenerController.abort();
      sectionListenerController = new AbortController();
      document.querySelectorAll('[data-astro-ve-ui]').forEach((element) => element.remove());
      document
        .querySelectorAll<HTMLElement>('[data-astro-ve-section-active]')
        .forEach((section) => {
          section.removeAttribute('data-astro-ve-section-active');
          if (section.dataset.astroVeAddedTabindex === 'true') {
            section.removeAttribute('tabindex');
            delete section.dataset.astroVeAddedTabindex;
          }
        });
      if (!active) return;
      for (const region of document.querySelectorAll<HTMLElement>(
        '[data-astro-edit-region], [data-astro-edit-sections]',
      )) {
        const current = descriptors(region);
        if (!initialSections.has(regionKey(region)))
          initialSections.set(regionKey(region), structuredClone(current));
        ensureAnchor(region);
        const regionSections = directSections(region);
        for (const section of regionSections) {
          const id = section.dataset.section!;
          const label = sectionControlLabel(section);
          sectionNodes.set(id, section);
          section.dataset.astroVeSectionActive = 'true';
          if (section.tabIndex < 0) {
            section.tabIndex = 0;
            section.dataset.astroVeAddedTabindex = 'true';
          }
          const protection = selectionProtection(section);
          section.dataset.astroVeProtection = protection.state;
          const controls = createElement('div', {
            class: 'astro-ve-section-controls',
            'data-astro-ve-ui': 'true',
            'data-section-id': id,
            'data-visible': 'false',
            'data-protection': protection.state,
            role: 'toolbar',
            'aria-label': `Controls for ${label}`,
          });
          const controlsLabel = createElement('span', { class: 'astro-ve-section-label' });
          controlsLabel.textContent = label;
          controls.append(controlsLabel);
          addControl(controls, `Open settings for ${label}`, 'settings', () =>
            openSectionInspector(section),
          );
          if (protection.state === 'protected') {
            const shield = addControl(
              controls,
              `${label} is source-protected`,
              'shield',
              () => undefined,
            );
            shield.disabled = true;
          } else {
            addControl(
              controls,
              `${protection.state === 'locked' ? 'Unlock' : 'Lock'} ${label}`,
              protection.state === 'locked' ? 'unlock' : 'lock',
              () => {
                selectedKind = 'section';
                editing = section;
                toggleUserLock(section);
              },
            );
          }
          if (protection.state === 'unlocked') {
            addControl(controls, `Move ${label} up`, 'chevron-up', () => moveSection(section, -1));
            const drag = addControl(controls, `Drag ${label} to reorder`, 'drag', () => undefined);
            drag.classList.add('astro-ve-drag-handle');
            drag.draggable = true;
            drag.addEventListener('dragstart', (event) => {
              draggedSection = section;
              section.dataset.astroVeDragging = 'true';
              event.dataTransfer?.setData('text/plain', id);
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            });
            drag.addEventListener('dragend', () => {
              delete section.dataset.astroVeDragging;
              draggedSection = null;
              document
                .querySelectorAll('[data-astro-ve-drag-over]')
                .forEach((node) => node.removeAttribute('data-astro-ve-drag-over'));
            });
            addControl(controls, `Move ${label} down`, 'chevron-down', () =>
              moveSection(section, 1),
            );
            addControl(controls, `Delete section ${label}`, 'delete', () => {
              deleteTarget = section;
              confirmDialog.showModal();
              confirmDialog.querySelector<HTMLButtonElement>('.cancel-delete')?.focus();
            });
          }
          region.append(controls);
          const regionRect = region.getBoundingClientRect();
          const sectionRect = section.getBoundingClientRect();
          controls.style.setProperty(
            'top',
            `${sectionRect.top - regionRect.top + region.scrollTop + 10}px`,
            'important',
          );
          controls.style.setProperty(
            'left',
            `${sectionRect.left - regionRect.left + region.scrollLeft + 10}px`,
            'important',
          );
          const showControls = () => {
            revealSectionControls(section);
          };
          section.addEventListener('pointerenter', showControls, {
            signal: sectionListenerController.signal,
          });
          section.addEventListener(
            'click',
            (event) => {
              if ((event.target as Element).closest('[data-astro-ve-ui]')) return;
              event.preventDefault();
              event.stopPropagation();
              showControls();
              openSectionInspector(section);
            },
            { signal: sectionListenerController.signal },
          );
          section.addEventListener('focusin', showControls, {
            signal: sectionListenerController.signal,
          });
          controls.addEventListener('pointerenter', showControls, {
            signal: sectionListenerController.signal,
          });
          section.addEventListener('dragover', onSectionDragOver, {
            signal: sectionListenerController.signal,
          });
          section.addEventListener('dragleave', () => delete section.dataset.astroVeDragOver, {
            signal: sectionListenerController.signal,
          });
          section.addEventListener('drop', onSectionDrop, {
            signal: sectionListenerController.signal,
          });
        }
      }
    }

    function onSectionDragOver(event: DragEvent): void {
      if (!draggedSection || !(event.currentTarget instanceof HTMLElement)) return;
      const target = event.currentTarget;
      if (editableRegion(target) !== editableRegion(draggedSection) || target === draggedSection)
        return;
      event.preventDefault();
      target.dataset.astroVeDragOver = 'true';
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }

    function onSectionDrop(event: DragEvent): void {
      if (!draggedSection || !(event.currentTarget instanceof HTMLElement)) return;
      const target = event.currentTarget;
      const region = editableRegion(target);
      if (!region || region !== editableRegion(draggedSection) || target === draggedSection) return;
      event.preventDefault();
      mutate(() => {
        const before =
          event.clientY <
          target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
        if (before) target.before(draggedSection!);
        else target.after(draggedSection!);
        queueRegion(region);
      });
      setupSectionControls();
      setupTextBoundaries();
    }

    function openTemplates(section: HTMLElement, placement: 'before' | 'after'): void {
      addTarget = { section, placement };
      templateGrid.replaceChildren();
      for (const template of config.sectionTemplates) {
        const button = createElement('button', { class: 'template-card', type: 'button' });
        const name = createElement('strong');
        name.textContent = template.name;
        const description = createElement('span');
        description.textContent = template.description;
        button.append(name, description);
        button.addEventListener('click', () => addTemplate(template.id));
        templateGrid.append(button);
      }
      templateDialog.showModal();
      templateGrid.querySelector<HTMLButtonElement>('button')?.focus();
    }

    function addTemplate(templateId: string): void {
      if (!addTarget) return;
      const region = editableRegion(addTarget.section);
      if (!region) return;
      const id = `${templateId}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`;
      const node = templateNode(templateId, id);
      if (!node) {
        showMessage(`Template ${templateId} could not be rendered.`, 'error');
        return;
      }
      mutate(() => {
        if (addTarget!.placement === 'before') addTarget!.section.before(node);
        else addTarget!.section.after(node);
        queueRegion(region);
      });
      templateDialog.close();
      addTarget = null;
      setupSectionControls();
      node.focus();
    }

    function openSeo(): void {
      const current = [...queue.values()].find(
        (change): change is SeoEditorChange => change.kind === 'seo',
      );
      const values = current?.after ?? seoValues();
      const filePath =
        document.querySelector<HTMLElement>('[data-astro-edit-seo-file]')?.dataset
          .astroEditSeoFile ?? sourceFileFor(document.documentElement, config, editabilityPolicy);
      seoDialog.querySelector<HTMLElement>('.dialog-file')!.textContent = filePath;
      for (const [field, value] of Object.entries(values)) {
        const input = seoDialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          `[name="${field}"]`,
        );
        if (input) input.value = value;
      }
      seoDialog.showModal();
      seoDialog.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    }

    function queueSeo(): void {
      const after = {} as SeoValues;
      for (const field of [
        'title',
        'description',
        'keywords',
        'canonical',
        'ogTitle',
        'ogDescription',
        'robots',
      ] as SeoField[]) {
        after[field] =
          seoDialog
            .querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)
            ?.value.trim() ?? '';
      }
      if (after.canonical) {
        try {
          const url = new URL(after.canonical);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
          showMessage('Canonical URL must be a complete http:// or https:// URL.', 'error');
          return;
        }
      }
      const filePath = seoDialog.querySelector<HTMLElement>('.dialog-file')!.textContent!;
      const key = `seo:${filePath}`;
      const existing = queue.get(key);
      if (!existing && queue.size >= config.maxChanges) {
        showMessage(
          `The queue limit is ${config.maxChanges} changes. Remove or commit a change first.`,
          'error',
        );
        return;
      }
      const before = existing?.kind === 'seo' ? existing.before : seoValues();
      mutate(() => {
        if (JSON.stringify(before) === JSON.stringify(after)) queue.delete(key);
        else
          queue.set(key, {
            kind: 'seo',
            id: existing?.id ?? crypto.randomUUID(),
            filePath,
            route: window.location.pathname,
            before,
            after,
          });
      });
      seoDialog.close();
      const notes: string[] = [];
      if (after.title.length > 60) notes.push('title is over 60 characters');
      if (after.description.length > 160) notes.push('description is over 160 characters');
      if (notes.length)
        showMessage(`Queued with editorial guidance: ${notes.join('; ')}.`, 'warning');
    }

    function setMode(next: EditorMode): void {
      if (next === 'setup' && mode !== 'setup') clearMessage();
      if (next !== 'text' && next !== 'review') clearSelection();
      if (next !== 'review' && next !== 'setup') lastEditingMode = next;
      mode = next;
      panel.dataset.mode = mode;
      updateSetupDock();
      restoreHighlight();
      for (const tab of panel.querySelectorAll<HTMLButtonElement>('.mode-tab'))
        tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
      if (mode === 'text') {
        panelTitle.textContent = 'Edit content';
        instructions.textContent =
          'Click text to edit, or use a section handle to arrange the page.';
      }
      if (mode === 'sections') {
        panelTitle.textContent = 'Edit structure';
        instructions.textContent =
          'Section handles are available directly on the page. This tab is an optional navigator.';
      }
      if (mode === 'seo') {
        panelTitle.textContent = 'Page settings';
        instructions.textContent = 'Edit SEO and sharing details for this page.';
      }
      if (mode === 'review') {
        panelTitle.textContent = 'Review changes';
        instructions.textContent = 'Review every queued source change before committing the batch.';
      }
      if (mode === 'setup') {
        panelTitle.textContent = 'Editor settings';
        instructions.textContent =
          'Set up text permissions and reorderable section regions without weakening source safety.';
      }
      setupButton.setAttribute('aria-pressed', String(mode === 'setup'));
      setupButton.setAttribute(
        'aria-label',
        mode === 'setup' ? 'Back to editor' : 'Open Editor Setup',
      );
      setupButton.title = mode === 'setup' ? 'Back to editor' : 'Open Editor Setup';
      setupButton.innerHTML =
        mode === 'setup'
          ? `<span aria-hidden="true">←</span><span class="utility-label">Back</span>`
          : `${icon('settings')}<span class="utility-label">Settings</span>`;
      pickerLabel.textContent =
        mode === 'sections'
          ? 'Arrange sections'
          : mode === 'setup'
            ? 'Editor Setup'
            : 'Tap content to edit';
      setupSectionControls();
      renderQueue();
      if (mode === 'seo') openSeo();
      if (mode === 'sections' && active) {
        const hasEditableRegion = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-astro-edit-region], [data-astro-edit-sections]',
          ),
        ].some((region) => directSections(region).length > 0);
        setMinimized(matchMedia('(max-width: 640px)').matches);
        if (!hasEditableRegion) {
          showMessage(
            'No source-owned section region is available on this page. Unsupported structure stays protected rather than appearing movable.',
            'warning',
          );
        }
      }
      if (mode === 'setup') setMinimized(false);
    }

    function setMinimized(value: boolean): void {
      minimized = value;
      panel.dataset.minimized = String(value);
      picker.dataset.open = String(active && value);
      minimizeButton.setAttribute('aria-label', value ? 'Expand editor' : 'Collapse editor');
      minimizeButton.title = value ? 'Expand editor' : 'Collapse editor';
      updateSetupDock();
    }

    function activate(): void {
      if (active) return;
      active = true;
      updateSetupDock();
      panel.dataset.open = 'true';
      setMinimized(minimized);
      document.addEventListener('pointerover', onPointerOver, {
        capture: true,
        signal: listenerController.signal,
      });
      document.addEventListener('pointermove', onPointerOver, {
        capture: true,
        signal: listenerController.signal,
      });
      document.addEventListener('click', onPageClick, {
        capture: true,
        signal: listenerController.signal,
      });
      setupSectionControls();
      setupTextBoundaries();
    }

    function deactivate(): void {
      active = false;
      stopSetupPagePicker(false);
      updateSetupDock();
      panel.dataset.open = 'false';
      picker.dataset.open = 'false';
      restoreHighlight();
      clearSelection();
      clearInventoryMarkers();
      document.querySelectorAll('[data-astro-ve-ui]').forEach((element) => element.remove());
      document.querySelectorAll<HTMLElement>('[data-astro-ve-text-active]').forEach((element) => {
        delete element.dataset.astroVeTextActive;
        delete element.dataset.astroVeProtection;
      });
      document
        .querySelectorAll<HTMLElement>('[data-astro-ve-section-active]')
        .forEach((section) => {
          section.removeAttribute('data-astro-ve-section-active');
          if (section.dataset.astroVeAddedTabindex === 'true') {
            section.removeAttribute('tabindex');
            delete section.dataset.astroVeAddedTabindex;
          }
        });
      for (const dialog of [
        textDialog,
        seoDialog,
        templateDialog,
        confirmDialog,
        historyDialog,
        diffDialog,
        policyDialog,
        permissionDialog,
        regionDialog,
        regionSourceDialog,
      ])
        if (dialog.open) dialog.close();
    }

    function pollForPendingReceipt(): void {
      window.clearInterval(receiptPollId);
      if (!pendingRequestId) return;
      const requestReceipt = () => {
        if (pendingRequestId) server.send(RECEIPT_EVENT, { clientId, requestId: pendingRequestId });
      };
      requestReceipt();
      receiptPollId = window.setInterval(requestReceipt, 750);
    }

    function requestPreview(): void {
      if (queue.size === 0 || saveInFlight || previewInFlight || !config.writeEnabled) return;
      previewInFlight = true;
      clearMessage();
      previewRequestId = crypto.randomUUID();
      server.send(PREVIEW_EVENT, {
        clientId,
        requestId: previewRequestId,
        changes: serializableQueue(),
      });
      window.clearTimeout(previewTimeoutId);
      previewTimeoutId = window.setTimeout(() => {
        previewInFlight = false;
        previewRequestId = undefined;
        showMessage(
          'The source check did not complete. Your changes are still queued; try Review and save again.',
          'warning',
        );
        renderQueue();
      }, config.requestTimeoutMs);
      renderQueue();
    }

    function sendSave(requestId?: string): void {
      if (queue.size === 0 || saveInFlight || !config.writeEnabled) return;
      saveInFlight = true;
      clearMessage();
      pendingRequestId ??= requestId ?? crypto.randomUUID();
      sessionStorage.setItem(SESSION_PENDING, pendingRequestId);
      server.send(SAVE_EVENT, {
        clientId,
        requestId: pendingRequestId,
        changes: serializableQueue(),
      });
      pollForPendingReceipt();
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        saveInFlight = false;
        showMessage(
          'The save result was not received. Retry is safe: the same request cannot be applied twice.',
          'warning',
        );
        renderQueue();
      }, config.requestTimeoutMs);
      renderQueue();
    }

    function requestRevert(): void {
      if (!lastReceiptId || saveInFlight || !config.writeEnabled) return;
      const requestId = crypto.randomUUID();
      saveInFlight = true;
      renderQueue();
      server.send(REVERT_EVENT, { clientId, requestId, receiptId: lastReceiptId });
    }

    function handleSaveResponse(response: SaveResponse): void {
      if (response.clientId !== clientId || response.requestId !== pendingRequestId) return;
      window.clearTimeout(timeoutId);
      saveInFlight = false;
      window.clearInterval(receiptPollId);
      if (response.success) {
        queue.clear();
        history.record([]);
        pendingRequestId = undefined;
        sessionStorage.removeItem(SESSION_PENDING);
        sessionStorage.removeItem(SESSION_QUEUE);
        lastReceiptId = response.receiptId;
        if (lastReceiptId) sessionStorage.setItem(SESSION_RECEIPT, lastReceiptId);
        showMessage(
          `Written ${response.changeCount ?? 0} change${response.changeCount === 1 ? '' : 's'} to source.`,
          'success',
        );
      } else {
        pendingRequestId = undefined;
        sessionStorage.removeItem(SESSION_PENDING);
        showMessage(response.error ?? 'The source update was rejected.', 'error');
      }
      renderQueue();
    }

    function onDocumentKeydown(event: KeyboardEvent): void {
      if (!active) return;
      if (event.key === 'Escape' && editing && !textDialog.open) {
        event.preventDefault();
        clearSelection();
        return;
      }
      if (setupPickerKind && event.key === 'Escape') {
        event.preventDefault();
        stopSetupPagePicker(true);
        return;
      }
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        requestPreview();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mode === 'text' && event.altKey && event.key === 'Enter') {
        const target = editableTarget(document.activeElement);
        if (target) {
          event.preventDefault();
          openTextEditor(target);
        }
      }
      if (
        mode === 'sections' &&
        event.altKey &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement.matches('[data-section]')
      ) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          moveSection(document.activeElement, event.key === 'ArrowUp' ? -1 : 1);
        }
        if (event.key === 'Delete') {
          event.preventDefault();
          deleteTarget = document.activeElement;
          confirmDialog.showModal();
        }
      }
    }

    panel
      .querySelectorAll<HTMLButtonElement>('.mode-tab')
      .forEach((tab) =>
        tab.addEventListener('click', () => setMode(tab.dataset.mode as EditorMode)),
      );
    minimizeButton.addEventListener('click', () => setMinimized(true));
    setupButton.addEventListener('click', () =>
      mode === 'setup' ? leaveSetup() : setMode('setup'),
    );
    leaveSetupButton.addEventListener('click', leaveSetup);
    pickerReview.addEventListener('click', () => {
      setMinimized(false);
      if (queue.size) setMode('review');
    });
    changesToggle.addEventListener('click', () => {
      setMode(mode === 'review' ? lastEditingMode : 'review');
    });
    picker
      .querySelector<HTMLButtonElement>('.picker-close')!
      .addEventListener('click', () => app.toggleState({ state: false }));
    textDialog
      .querySelector<HTMLButtonElement>('.queue-text')!
      .addEventListener('click', queueText);
    applySelectionButton.addEventListener('click', () => {
      if (selectedKind === 'text') queueText();
      else clearSelection();
    });
    cancelSelectionButton.addEventListener('click', clearSelection);
    resetSelectionButton.addEventListener('click', () => {
      if (!editing) return;
      const selector = selectorFor(editing);
      const resolution = sourceResolutionFor(editing, config, editabilityPolicy);
      const queued = queue.get(`text:${resolution.filePath}:${selector}`);
      inspectorTextarea.value =
        queued?.kind === 'text' ? queued.newText : (editing.textContent?.trim() ?? '');
      inspectorTextarea.focus();
      inspectorTextarea.select();
    });
    toggleSelectionLockButton.addEventListener('click', () => {
      if (editing) toggleUserLock(editing);
    });
    addBeforeSelectedButton.addEventListener('click', () => {
      if (selectedKind === 'section' && editing) openTemplates(editing, 'before');
    });
    addAfterSelectedButton.addEventListener('click', () => {
      if (selectedKind === 'section' && editing) openTemplates(editing, 'after');
    });
    deleteSelectedButton.addEventListener('click', () => {
      if (selectedKind !== 'section' || !editing) return;
      if (selectionProtection(editing).state !== 'unlocked') return;
      deleteTarget = editing;
      confirmDialog.showModal();
      confirmDialog.querySelector<HTMLButtonElement>('.cancel-delete')?.focus();
    });
    selectionInspector
      .querySelectorAll<HTMLButtonElement>('.inspector-tab')
      .forEach((tab) =>
        tab.addEventListener('click', () =>
          setInspectorTab(tab.dataset.inspectorTab as 'content' | 'design' | 'advanced'),
        ),
      );
    seoDialog.querySelector<HTMLButtonElement>('.queue-seo')!.addEventListener('click', queueSeo);
    templateDialog
      .querySelector<HTMLButtonElement>('.close-templates')!
      .addEventListener('click', () => templateDialog.close());
    confirmDialog
      .querySelector<HTMLButtonElement>('.cancel-delete')!
      .addEventListener('click', () => {
        deleteTarget = null;
        confirmDialog.close();
      });
    confirmDialog
      .querySelector<HTMLButtonElement>('.confirm-delete')!
      .addEventListener('click', () => {
        if (!deleteTarget) return;
        const region = editableRegion(deleteTarget);
        if (region)
          mutate(() => {
            deleteTarget!.remove();
            queueRegion(region);
          });
        clearSelection();
        confirmDialog.close();
        deleteTarget = null;
        setupSectionControls();
        setupTextBoundaries();
      });
    clearButton.addEventListener('click', () => mutate(() => queue.clear()));
    undoButton.addEventListener('click', undo);
    redoButton.addEventListener('click', redo);
    historyButton.addEventListener('click', () => {
      const requestId = crypto.randomUUID();
      server.send(HISTORY_EVENT, { clientId, requestId });
      renderHistory();
      historyDialog.showModal();
    });
    historyDialog
      .querySelector<HTMLButtonElement>('.close-history')!
      .addEventListener('click', () => historyDialog.close());
    diffDialog
      .querySelector<HTMLButtonElement>('.cancel-diff')!
      .addEventListener('click', () => diffDialog.close('cancel'));
    diffDialog
      .querySelector<HTMLButtonElement>('.confirm-commit')!
      .addEventListener('click', () => {
        const requestId = previewRequestId;
        if (!requestId) return;
        diffDialog.close('commit');
        sendSave(requestId);
      });
    commitButton.addEventListener('click', requestPreview);
    revertButton.addEventListener('click', requestRevert);
    reloadPolicyButton.addEventListener('click', () => {
      setupBusy = true;
      editabilityRequestId = crypto.randomUUID();
      server.send(EDITABILITY_POLICY_EVENT, { clientId, requestId: editabilityRequestId });
      renderInventory();
    });
    reviewPolicyButton.addEventListener('click', () => requestPolicyPreview());
    policyDialog
      .querySelector<HTMLButtonElement>('.cancel-policy')!
      .addEventListener('click', () => {
        editabilityPreviewId = undefined;
        policyDialog.close('cancel');
      });
    policyDialog
      .querySelector<HTMLButtonElement>('.confirm-policy')!
      .addEventListener('click', () => {
        if (!editabilityPreviewId) return;
        setupBusy = true;
        policyDialog.close('save');
        server.send(EDITABILITY_SAVE_EVENT, {
          clientId,
          requestId: editabilityPreviewId,
          expectedHash: editabilityPolicyHash,
          policy: draftEditabilityPolicy,
        });
        renderInventory();
      });
    sourceDialog
      .querySelector<HTMLButtonElement>('.confirm-source')!
      .addEventListener('click', () => {
        if (!sourceDiscoveryItem) return;
        const selected = sourceDialog.querySelector<HTMLInputElement>(
          'input[name="source-candidate"]:checked',
        );
        const candidate = sourceCandidates.find((item) => item.id === selected?.value);
        if (!candidate) return;
        sourceDialog.close('confirm');
        const item = sourceDiscoveryItem;
        sourceDiscoveryItem = undefined;
        sourceCandidates = [];
        setDraftRule(item, 'allow', 'element', candidate.filePath, candidate.sourcePath);
      });
    regionDialog
      .querySelector<HTMLButtonElement>('.pick-region-on-page')!
      .addEventListener('click', () => startSetupPagePicker('section'));
    setupPagePicker
      .querySelector<HTMLButtonElement>('.cancel-setup-picker')!
      .addEventListener('click', () => stopSetupPagePicker(true));
    permissionDialog
      .querySelector<HTMLButtonElement>('.cancel-permission')!
      .addEventListener('click', () => permissionDialog.close('cancel'));
    regionSourceDialog
      .querySelector<HTMLButtonElement>('.confirm-region-source')!
      .addEventListener('click', confirmSectionCandidate);

    server.on(CONFIG_EVENT, (next: ClientEditorConfig) => {
      config = { ...defaultConfig, ...next };
      configReady = true;
      configConfirmed = true;
      renderDemoSurfaces();
      sessionStorage.setItem(SESSION_CONFIG, JSON.stringify(next));
      setupButton.hidden = true;
      try {
        for (const selector of [
          ...config.editableSelectors,
          ...config.excludeSelectors,
          ...Object.keys(config.selectorMappings),
        ]) {
          document.querySelector(selector);
        }
      } catch (error) {
        config.writeEnabled = false;
        const detail = error instanceof Error ? error.message : 'invalid CSS selector';
        setConnection('Editor configuration is invalid.', 'error');
        showMessage(
          `Editing is disabled until the CSS selector configuration is fixed: ${detail}`,
          'error',
        );
        renderQueue();
        return;
      }
      setupTextBoundaries();
      if (config.writeEnabled)
        setConnection(
          'Ready. Changes stay local until saved.',
          config.remoteWarning ? 'warning' : 'ready',
        );
      else setConnection(config.remoteWarning ?? 'Source writes are unavailable.', 'error');
      if (config.remoteWarning)
        showMessage(config.remoteWarning, config.writeEnabled ? 'warning' : 'error');
      replaceQueue(safeParseQueue());
      pollForPendingReceipt();
      editabilityRequestId = crypto.randomUUID();
      server.send(EDITABILITY_POLICY_EVENT, { clientId, requestId: editabilityRequestId });
    });
    server.on(SAVE_RESULT_EVENT, handleSaveResponse);
    server.on(PREVIEW_RESULT_EVENT, (response: PreviewResponse) => {
      if (response.clientId !== clientId || response.requestId !== previewRequestId) return;
      window.clearTimeout(previewTimeoutId);
      previewInFlight = false;
      if (!response.success || !response.diffs) {
        previewRequestId = undefined;
        showMessage(response.error ?? 'The file preview was rejected.', 'error');
      } else {
        renderFileDiffPanel(fileDiffList, response.diffs);
        diffDialog.showModal();
      }
      renderQueue();
    });
    server.on(RECEIPT_RESULT_EVENT, (receipt: ReceiptResponse) => {
      if (receipt.clientId !== clientId || receipt.requestId !== pendingRequestId) return;
      if (receipt.response) handleSaveResponse(receipt.response);
      else
        showMessage(
          'The previous save has no receipt. Retry will reuse its idempotency key safely.',
          'warning',
        );
    });
    server.on(REVERT_RESULT_EVENT, (response: RevertResponse) => {
      if (response.clientId !== clientId || response.receiptId !== lastReceiptId) return;
      saveInFlight = false;
      if (response.success) {
        lastReceiptId = undefined;
        sessionStorage.removeItem(SESSION_RECEIPT);
        showMessage(
          `Restored ${response.files?.length ?? 0} source file${response.files?.length === 1 ? '' : 's'}.`,
          'success',
        );
        server.send(HISTORY_EVENT, { clientId, requestId: crypto.randomUUID() });
      } else showMessage(response.error ?? 'Revert was refused.', 'error');
      renderQueue();
    });
    server.on(HISTORY_RESULT_EVENT, (response: HistoryResponse) => {
      if (response.clientId !== clientId) return;
      savedHistory = response.entries;
      renderHistory();
    });
    server.on(EDITABILITY_POLICY_RESULT_EVENT, (response: EditabilityPolicyResponse) => {
      if (response.clientId !== clientId || response.requestId !== editabilityRequestId) return;
      setupBusy = false;
      if (!response.success || !response.policy || response.policyHash === undefined) {
        showMessage(response.error ?? 'The editability policy could not be loaded.', 'error');
      } else {
        editabilityPolicy = structuredClone(response.policy);
        draftEditabilityPolicy = structuredClone(response.policy);
        editabilityPolicyHash = response.policyHash;
        applySectionRegionPolicy(editabilityPolicy);
        config.canManageEditability = response.canManage ?? config.canManageEditability;
        setupButton.hidden = true;
        if (mode === 'setup') showMessage('Editability policy loaded from the project.', 'success');
        setupSectionControls();
        setupTextBoundaries();
      }
      renderQueue();
    });
    server.on(EDITABILITY_PREVIEW_RESULT_EVENT, (response: EditabilityPolicyResponse) => {
      if (response.clientId !== clientId || response.requestId !== editabilityPreviewId) return;
      setupBusy = false;
      if (!response.success || !response.diff) {
        editabilityPreviewId = undefined;
        directPolicySave = false;
        draftEditabilityPolicy = structuredClone(editabilityPolicy);
        showMessage(response.error ?? 'The editability policy preview was rejected.', 'error');
      } else if (directPolicySave) {
        setupBusy = true;
        server.send(EDITABILITY_SAVE_EVENT, {
          clientId,
          requestId: editabilityPreviewId,
          expectedHash: editabilityPolicyHash,
          policy: draftEditabilityPolicy,
        });
      } else {
        renderFileDiffPanel(policyDiffList, [response.diff]);
        policyDialog.showModal();
        policyDialog.querySelector<HTMLButtonElement>('.cancel-policy')?.focus();
      }
      if (mode === 'setup') renderInventory();
    });
    server.on(EDITABILITY_SAVE_RESULT_EVENT, (response: EditabilityPolicyResponse) => {
      if (response.clientId !== clientId || response.requestId !== editabilityPreviewId) return;
      setupBusy = false;
      editabilityPreviewId = undefined;
      const wasDirect = directPolicySave;
      directPolicySave = false;
      if (!response.success || !response.policy || response.policyHash === undefined) {
        draftEditabilityPolicy = structuredClone(editabilityPolicy);
        showMessage(response.error ?? 'The editability policy was not saved.', 'error');
      } else {
        editabilityPolicy = structuredClone(response.policy);
        draftEditabilityPolicy = structuredClone(response.policy);
        editabilityPolicyHash = response.policyHash;
        applySectionRegionPolicy(editabilityPolicy);
        if (!wasDirect) setMode('text');
        showMessage(
          wasDirect
            ? directPolicyLabel
            : `Saved ${response.policyFile ?? config.editabilityPolicyFile}. Your text permissions and section mappings are now active.`,
          'success',
        );
      }
      directPolicyLabel = '';
      setupSectionControls();
      setupTextBoundaries();
      if (editing?.isConnected) {
        if (selectedKind === 'section') openSectionInspector(editing);
        else if (selectedKind === 'text') openTextEditor(editing);
      }
      renderQueue();
    });
    server.on(SOURCE_DISCOVERY_RESULT_EVENT, (response: SourceDiscoveryResponse) => {
      if (response.clientId !== clientId || response.requestId !== sourceDiscoveryRequestId) return;
      setupBusy = false;
      sourceDiscoveryRequestId = undefined;
      if (!response.success || !response.candidates) {
        sourceDiscoveryItem = undefined;
        showMessage(response.error ?? 'Source discovery failed.', 'error');
      } else {
        sourceCandidates = response.candidates;
        clearMessage();
        renderSourceCandidates(response.candidates, response.searchedFiles);
        if (response.truncated) {
          showMessage(
            'The source result list was bounded; refine or confirm one visible candidate.',
            'warning',
          );
        }
      }
      if (mode === 'setup') renderInventory();
    });
    server.on(SECTION_DISCOVERY_RESULT_EVENT, (response: SectionDiscoveryResponse) => {
      if (response.clientId !== clientId || response.requestId !== sectionDiscoveryRequestId)
        return;
      setupBusy = false;
      sectionDiscoveryRequestId = undefined;
      if (!response.success || !response.candidates) {
        sectionDiscoveryElement = undefined;
        showMessage(response.error ?? 'Section discovery failed.', 'error');
      } else {
        sectionCandidates = response.candidates;
        clearMessage();
        renderSectionCandidates(response.candidates);
      }
      renderQueue();
    });

    document.addEventListener('keydown', onDocumentKeydown, {
      capture: true,
      signal: listenerController.signal,
    });
    document.addEventListener('astro:before-swap', persist, { signal: listenerController.signal });
    document.addEventListener(
      'astro:page-load',
      () => {
        updateSetupDock();
        if (configReady) {
          applySectionRegionPolicy(editabilityPolicy);
          replaceQueue(safeParseQueue());
        }
      },
      { signal: listenerController.signal },
    );
    const pageStyle = createElement('style', { 'data-astro-ve-page-style': 'true' });
    pageStyle.textContent = pageSectionStyles;
    document.head.append(pageStyle);

    app.onToggled(({ state }) => (state ? activate() : deactivate()));
    app.onToolbarPlacementUpdated(({ placement }) => {
      panel.dataset.placement = placement;
      picker.dataset.placement = placement;
    });
    const announceReady = (): void => {
      if (panel.isConnected)
        server.send(READY_EVENT, { clientId, route: window.location.pathname });
    };
    if (configReady) replaceQueue(safeParseQueue());
    announceReady();
    // The toolbar websocket can reconnect during Astro HMR just as the first
    // ready event is sent. Retry the handshake until the server confirms the
    // configuration instead of leaving source actions disabled.
    const configRetryId = window.setInterval(() => {
      if (configConfirmed || !panel.isConnected) window.clearInterval(configRetryId);
      else announceReady();
    }, 500);
    renderQueue();
  },
  beforeTogglingOff() {
    return (
      !hasUnsavedChanges ||
      window.confirm('Keep queued Visual Editor changes in this tab and close the workbench?')
    );
  },
});
