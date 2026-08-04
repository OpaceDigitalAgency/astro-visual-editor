import { defineToolbarApp } from 'astro/toolbar';
import { ChangeHistory, changeKey } from './client/history.js';
import {
  regionIdFor,
  selectorFor,
  sourceFileFor,
} from './client/source-resolver.js';
import { pageSectionStyles, toolbarStyles } from './client/styles.js';
import {
  APP_ID,
  CONFIG_EVENT,
  READY_EVENT,
  RECEIPT_EVENT,
  RECEIPT_RESULT_EVENT,
  REVERT_EVENT,
  REVERT_RESULT_EVENT,
  SAVE_EVENT,
  SAVE_RESULT_EVENT,
} from './shared/events.js';
import type {
  ClientEditorConfig,
  EditorChange,
  ReceiptResponse,
  RevertResponse,
  SectionDescriptor,
  SectionsEditorChange,
  SeoEditorChange,
  SeoField,
  SeoValues,
  SaveResponse,
  TextEditorChange,
} from './shared/types.js';

type EditorMode = 'text' | 'sections' | 'seo' | 'review';
type MessageKind = 'error' | 'success' | 'warning';

const SESSION_QUEUE = `${APP_ID}:queue:v2`;
const SESSION_CLIENT = `${APP_ID}:client-id`;
const SESSION_PENDING = `${APP_ID}:pending`;
const SESSION_RECEIPT = `${APP_ID}:last-receipt`;
let hasUnsavedChanges = false;

const defaultConfig: ClientEditorConfig = {
  editableSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'],
  excludeSelectors: ['pre', 'code', 'script', 'style', '[data-astro-edit-ignore]', '[data-astro-ve-ui]'],
  fileMappings: {},
  selectorMappings: {},
  sectionTemplates: [],
  maxChanges: 100,
  maxTextLength: 10_000,
  requestTimeoutMs: 15_000,
  allowUnsafeSourceText: false,
  writeEnabled: false,
};

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
  const setMeta = (selector: string, attribute: 'name' | 'property', key: string, value: string): void => {
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

function summary(change: EditorChange): { title: string; oldText: string; newText: string } {
  if (change.kind === 'text') return { title: 'Text replacement', oldText: change.oldText, newText: change.newText };
  if (change.kind === 'seo') {
    const changed = (Object.keys(change.after) as SeoField[]).filter(
      (field) => change.after[field] !== change.before[field],
    );
    return {
      title: `Changed ${changed.length} SEO field${changed.length === 1 ? '' : 's'}`,
      oldText: 'Existing rendered metadata',
      newText: changed.join(', '),
    };
  }
  const beforeIds = change.before.map((item) => item.id);
  const afterIds = change.after.map((item) => item.id);
  const added = afterIds.filter((id) => !beforeIds.includes(id));
  const removed = beforeIds.filter((id) => !afterIds.includes(id));
  const title = added.length && !removed.length
    ? `Added ${added.length} section${added.length === 1 ? '' : 's'} in ${change.regionId}`
    : removed.length && !added.length
      ? `Removed ${removed.length} section${removed.length === 1 ? '' : 's'} from ${change.regionId}`
      : !added.length && !removed.length
        ? `Reordered ${afterIds.length} sections in ${change.regionId}`
        : `Changed section structure in ${change.regionId}`;
  return {
    title,
    oldText: beforeIds.join(' → ') || 'Empty region',
    newText: afterIds.join(' → ') || 'Empty region',
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
    let config = defaultConfig;
    let configReady = false;
    let active = false;
    let mode: EditorMode = 'text';
    let hovered: HTMLElement | null = null;
    let editing: HTMLElement | null = null;
    let draggedSection: HTMLElement | null = null;
    let addTarget: { section: HTMLElement; placement: 'before' | 'after' } | null = null;
    let deleteTarget: HTMLElement | null = null;
    let saveInFlight = false;
    let timeoutId: number | undefined;
    let receiptPollId: number | undefined;
    let pendingRequestId = sessionStorage.getItem(SESSION_PENDING) ?? undefined;
    let lastReceiptId = sessionStorage.getItem(SESSION_RECEIPT) ?? undefined;
    let minimized = matchMedia('(max-width: 640px)').matches;

    const style = createElement('style');
    style.textContent = toolbarStyles;
    const panel = createElement('section', {
      class: 'workbench',
      'data-open': 'false',
      'data-minimized': String(minimized),
      'aria-label': 'Astro Visual Editor workbench',
    });
    panel.innerHTML = `
      <header class="masthead">
        <div><p class="eyebrow">Local source workbench</p><h2>Visual Editor</h2>
          <p class="status" data-state="warning"><span class="status-dot" aria-hidden="true"></span><span class="status-copy">Connecting to Astro…</span></p>
        </div>
        <button class="icon-button minimize" type="button" aria-label="Collapse editor" title="Collapse editor">−</button>
      </header>
      <div class="mode-tabs" role="tablist" aria-label="Editing mode">
        <button class="mode-tab" role="tab" data-mode="text" aria-selected="true">Text</button>
        <button class="mode-tab" role="tab" data-mode="sections" aria-selected="false">Sections</button>
        <button class="mode-tab" role="tab" data-mode="seo" aria-selected="false">SEO</button>
        <button class="mode-tab" role="tab" data-mode="review" aria-selected="false">Review</button>
      </div>
      <div class="instructions">Click visible text, or focus it and press Alt+Enter.</div>
      <div class="ledger" aria-live="polite" aria-label="Queued changes"></div>
      <p class="message" role="status" aria-live="polite"></p>
      <div class="history-actions">
        <button class="secondary undo" type="button" disabled>Undo</button>
        <button class="secondary redo" type="button" disabled>Redo</button>
      </div>
      <footer class="actions">
        <button class="primary commit" type="button" disabled>Commit 0 changes</button>
        <button class="secondary clear" type="button">Clear</button>
        <button class="secondary revert" type="button" disabled>Revert last commit</button>
      </footer>`;

    const picker = createElement('div', { class: 'picker', 'data-open': 'false' });
    picker.innerHTML = `<span class="picker-label">Tap content to edit</span><button class="secondary picker-review" type="button" title="Expand editor and review queued changes">Review 0</button><button class="icon-button picker-close" type="button" aria-label="Disable Visual Editor" title="Disable Visual Editor">×</button>`;

    const textDialog = createElement('dialog', { 'aria-labelledby': 'ave-text-title', 'aria-describedby': 'ave-text-file' });
    textDialog.innerHTML = `<form method="dialog" class="dialog-body"><p class="eyebrow">Preview before writing</p><h2 id="ave-text-title">Edit text</h2><p id="ave-text-file" class="dialog-file"></p><label for="ave-text-value">Replacement text</label><textarea id="ave-text-value" required></textarea><p class="field-help">The owning adapter validates syntax before any source file is written.</p><div class="dialog-actions"><button class="secondary" value="cancel" type="submit">Cancel</button><button class="primary queue-text" type="button">Queue change</button></div></form>`;

    const seoDialog = createElement('dialog', { 'aria-labelledby': 'ave-seo-title', 'aria-describedby': 'ave-seo-file' });
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

    const confirmDialog = createElement('dialog', { 'aria-labelledby': 'ave-confirm-title', 'aria-describedby': 'ave-confirm-copy' });
    confirmDialog.innerHTML = `<div class="dialog-body"><p class="eyebrow">Confirm structural change</p><h2 id="ave-confirm-title">Delete this section?</h2><p id="ave-confirm-copy">The section will be removed from the preview and queued. You can undo before committing.</p><div class="dialog-actions"><button class="secondary cancel-delete" type="button">Keep section</button><button class="danger confirm-delete" type="button">Delete section</button></div></div>`;

    canvas.append(style, panel, picker, textDialog, seoDialog, templateDialog, confirmDialog);

    const ledger = panel.querySelector<HTMLElement>('.ledger')!;
    const message = panel.querySelector<HTMLElement>('.message')!;
    const status = panel.querySelector<HTMLElement>('.status')!;
    const statusCopy = panel.querySelector<HTMLElement>('.status-copy')!;
    const instructions = panel.querySelector<HTMLElement>('.instructions')!;
    const commitButton = panel.querySelector<HTMLButtonElement>('.commit')!;
    const clearButton = panel.querySelector<HTMLButtonElement>('.clear')!;
    const revertButton = panel.querySelector<HTMLButtonElement>('.revert')!;
    const undoButton = panel.querySelector<HTMLButtonElement>('.undo')!;
    const redoButton = panel.querySelector<HTMLButtonElement>('.redo')!;
    const textarea = textDialog.querySelector<HTMLTextAreaElement>('textarea')!;
    const textFile = textDialog.querySelector<HTMLElement>('.dialog-file')!;
    const pickerLabel = picker.querySelector<HTMLElement>('.picker-label')!;
    const pickerReview = picker.querySelector<HTMLButtonElement>('.picker-review')!;
    const templateGrid = templateDialog.querySelector<HTMLElement>('.template-grid')!;
    const minimizeButton = panel.querySelector<HTMLButtonElement>('.minimize')!;

    function enableLightDismiss(dialog: HTMLDialogElement, onClose?: () => void): void {
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close('cancel');
      });
      if (onClose) dialog.addEventListener('close', onClose);
    }

    enableLightDismiss(textDialog);
    enableLightDismiss(seoDialog);
    enableLightDismiss(templateDialog, () => { addTarget = null; });
    enableLightDismiss(confirmDialog, () => { deleteTarget = null; });

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

    function renderQueue(): void {
      ledger.replaceChildren();
      if (queue.size === 0) {
        const empty = createElement('div', { class: 'empty' });
        empty.textContent = mode === 'sections'
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
          type.textContent = change.kind;
          const file = createElement('div', { class: 'file', title: change.filePath });
          file.textContent = change.filePath;
          const values = summary(change);
          const summaryLine = createElement('div', { class: 'change-summary' });
          summaryLine.textContent = values.title;
          const diff = createElement('div', { class: 'diff' });
          const oldText = createElement('span', { class: 'old' });
          const newText = createElement('span', { class: 'new' });
          oldText.textContent = `Before: ${values.oldText}`;
          newText.textContent = `After: ${values.newText}`;
          diff.append(oldText, newText);
          copy.append(type, file, summaryLine, diff);
          const removeLabel = `Undo ${change.kind} change in ${change.filePath}`;
          const remove = createElement('button', { class: 'icon-button', type: 'button', 'aria-label': removeLabel, title: removeLabel });
          remove.textContent = '×';
          remove.addEventListener('click', () => mutate(() => queue.delete(key)));
          row.append(copy, remove);
          ledger.append(row);
        }
      }
      commitButton.disabled = queue.size === 0 || saveInFlight || !config.writeEnabled;
      commitButton.textContent = saveInFlight
        ? 'Validating and writing…'
        : pendingRequestId
          ? `Retry ${queue.size} safely`
          : `Commit ${queue.size} change${queue.size === 1 ? '' : 's'}`;
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
      for (const candidate of document.querySelectorAll<HTMLElement>('[data-astro-edit-region], [data-astro-edit-sections]')) {
        if (regionIdFor(candidate) === regionId && sourceFileFor(candidate, config) === filePath) return candidate;
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
        (child): child is HTMLElement => child instanceof HTMLElement && child.matches('section[data-section]'),
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
        if (!node && descriptor.templateId) node = templateNode(descriptor.templateId, descriptor.id) ?? undefined;
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
          if (element) element.textContent = change.newText;
        } else if (change.kind === 'seo') setSeoPreview(change.after);
        else if (change.kind === 'sections') applySectionState(change, change.after);
      }
    }

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
      hovered = null;
    }

    function editableTarget(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element) || !configReady) return null;
      let candidate: HTMLElement | null = null;
      try {
        candidate = target.closest<HTMLElement>(config.editableSelectors.join(','));
      } catch {
        return null;
      }
      if (!candidate || candidate.closest('astro-dev-toolbar') || candidate.closest('[data-astro-ve-ui]')) return null;
      if (config.excludeSelectors.some((selector) => {
        try { return candidate!.matches(selector) || Boolean(candidate!.closest(selector)); } catch { return true; }
      })) return null;
      if (!candidate.hasAttribute('data-astro-editable') && candidate.children.length > 0) return null;
      return candidate.textContent?.trim() ? candidate : null;
    }

    function openTextEditor(candidate: HTMLElement): void {
      editing = candidate;
      const selector = selectorFor(candidate);
      const queued = queue.get(`text:${sourceFileFor(candidate, config)}:${selector}`);
      const existing = queued?.kind === 'text' ? queued : undefined;
      textarea.value = existing?.newText ?? candidate.textContent?.trim() ?? '';
      textFile.textContent = sourceFileFor(candidate, config);
      textDialog.showModal();
      textarea.focus();
      textarea.select();
    }

    function onPointerOver(event: PointerEvent): void {
      if (!active || mode !== 'text' || textDialog.open) return;
      const candidate = editableTarget(event.target);
      if (candidate === hovered) return;
      restoreHighlight();
      hovered = candidate;
      if (hovered) {
        hovered.style.outline = '3px solid #ff7a3d';
        hovered.style.outlineOffset = '3px';
        hovered.style.cursor = 'text';
      }
    }

    function onPageClick(event: MouseEvent): void {
      if (!active || mode !== 'text' || textDialog.open) return;
      const candidate = editableTarget(event.target);
      if (!candidate) return;
      event.preventDefault();
      event.stopPropagation();
      openTextEditor(candidate);
    }

    function queueText(): void {
      if (!editing) return;
      const newText = textarea.value.trim();
      const selector = selectorFor(editing);
      const filePath = sourceFileFor(editing, config);
      const key = `text:${filePath}:${selector}`;
      const existing = queue.get(key);
      if (!existing && queue.size >= config.maxChanges) {
        showMessage(`The queue limit is ${config.maxChanges} changes. Remove or commit a change first.`, 'error');
        return;
      }
      const oldText = existing?.kind === 'text' ? existing.oldText : editing.textContent?.trim() ?? '';
      if (!newText) {
        showMessage('Replacement text cannot be empty. Delete a section in Sections mode instead.', 'error');
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
            kind: 'text', id: existing?.id ?? crypto.randomUUID(), filePath,
            route: window.location.pathname, selector, oldText, newText,
            sourcePath: editing?.closest<HTMLElement>('[data-astro-edit-path]')?.dataset.astroEditPath,
          };
          queue.set(key, change);
        }
      });
      textDialog.close();
      if (matchMedia('(max-width: 640px)').matches) setMinimized(true);
    }

    function editableRegion(section: HTMLElement): HTMLElement | null {
      return section.closest<HTMLElement>('[data-astro-edit-region], [data-astro-edit-sections]');
    }

    function descriptors(region: HTMLElement): SectionDescriptor[] {
      return directSections(region).map((section) => ({
        id: section.dataset.section!,
        ...(section.dataset.astroVeTemplate ? { templateId: section.dataset.astroVeTemplate } : {}),
      }));
    }

    function regionKey(region: HTMLElement): string {
      return `${sourceFileFor(region, config)}:${regionIdFor(region)}`;
    }

    function queueRegion(region: HTMLElement): void {
      const filePath = sourceFileFor(region, config);
      const regionId = regionIdFor(region);
      const key = `sections:${filePath}:${regionId}`;
      const before = initialSections.get(regionKey(region)) ?? descriptors(region);
      initialSections.set(regionKey(region), structuredClone(before));
      const after = descriptors(region);
      if (JSON.stringify(before) === JSON.stringify(after)) queue.delete(key);
      else {
        queue.set(key, {
          kind: 'sections', id: crypto.randomUUID(), filePath, route: window.location.pathname,
          regionId, before, after,
        });
      }
    }

    function moveSection(section: HTMLElement, direction: -1 | 1): void {
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
    }

    function addControl(controls: HTMLElement, label: string, text: string, action: () => void): HTMLButtonElement {
      const button = createElement('button', { type: 'button', 'aria-label': label, title: label, 'data-tooltip': label });
      button.textContent = text;
      button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); action(); });
      controls.append(button);
      return button;
    }

    function setupSectionControls(): void {
      sectionListenerController.abort();
      sectionListenerController = new AbortController();
      document.querySelectorAll('[data-astro-ve-ui]').forEach((element) => element.remove());
      document.querySelectorAll<HTMLElement>('[data-astro-ve-section-active]').forEach((section) => {
        section.removeAttribute('data-astro-ve-section-active'); section.removeAttribute('tabindex'); section.removeAttribute('aria-label');
      });
      if (!active || mode !== 'sections') return;
      for (const region of document.querySelectorAll<HTMLElement>('[data-astro-edit-region], [data-astro-edit-sections]')) {
        const current = descriptors(region);
        if (!initialSections.has(regionKey(region))) initialSections.set(regionKey(region), structuredClone(current));
        ensureAnchor(region);
        for (const section of directSections(region)) {
          const id = section.dataset.section!;
          sectionNodes.set(id, section);
          section.dataset.astroVeSectionActive = 'true';
          section.tabIndex = 0;
          section.setAttribute('aria-label', `Editable section ${id}`);
          const controls = createElement('div', { class: 'astro-ve-section-controls', 'data-astro-ve-ui': 'true', role: 'toolbar', 'aria-label': `Controls for section ${id}` });
          addControl(controls, `Add section before ${id}`, '+↑', () => openTemplates(section, 'before'));
          addControl(controls, `Move ${id} up`, '↑', () => moveSection(section, -1));
          const drag = addControl(controls, `Drag ${id} to reorder`, '⠿', () => undefined);
          drag.classList.add('astro-ve-drag-handle'); drag.draggable = true;
          drag.addEventListener('dragstart', (event) => {
            draggedSection = section; section.dataset.astroVeDragging = 'true';
            event.dataTransfer?.setData('text/plain', id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
          });
          drag.addEventListener('dragend', () => { delete section.dataset.astroVeDragging; draggedSection = null; document.querySelectorAll('[data-astro-ve-drag-over]').forEach((node) => node.removeAttribute('data-astro-ve-drag-over')); });
          addControl(controls, `Move ${id} down`, '↓', () => moveSection(section, 1));
          addControl(controls, `Add section after ${id}`, '+↓', () => openTemplates(section, 'after'));
          addControl(controls, `Delete section ${id}`, '×', () => { deleteTarget = section; confirmDialog.showModal(); confirmDialog.querySelector<HTMLButtonElement>('.cancel-delete')?.focus(); });
          section.append(controls);
          section.addEventListener('dragover', onSectionDragOver, { signal: sectionListenerController.signal });
          section.addEventListener('dragleave', () => delete section.dataset.astroVeDragOver, { signal: sectionListenerController.signal });
          section.addEventListener('drop', onSectionDrop, { signal: sectionListenerController.signal });
        }
      }
    }

    function onSectionDragOver(event: DragEvent): void {
      if (!draggedSection || !(event.currentTarget instanceof HTMLElement)) return;
      const target = event.currentTarget;
      if (editableRegion(target) !== editableRegion(draggedSection) || target === draggedSection) return;
      event.preventDefault(); target.dataset.astroVeDragOver = 'true';
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }

    function onSectionDrop(event: DragEvent): void {
      if (!draggedSection || !(event.currentTarget instanceof HTMLElement)) return;
      const target = event.currentTarget;
      const region = editableRegion(target);
      if (!region || region !== editableRegion(draggedSection) || target === draggedSection) return;
      event.preventDefault();
      mutate(() => {
        const before = event.clientY < target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2;
        if (before) target.before(draggedSection!); else target.after(draggedSection!);
        queueRegion(region);
      });
      setupSectionControls();
    }

    function openTemplates(section: HTMLElement, placement: 'before' | 'after'): void {
      addTarget = { section, placement };
      templateGrid.replaceChildren();
      for (const template of config.sectionTemplates) {
        const button = createElement('button', { class: 'template-card', type: 'button' });
        const name = createElement('strong'); name.textContent = template.name;
        const description = createElement('span'); description.textContent = template.description;
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
      if (!node) { showMessage(`Template ${templateId} could not be rendered.`, 'error'); return; }
      mutate(() => {
        if (addTarget!.placement === 'before') addTarget!.section.before(node); else addTarget!.section.after(node);
        queueRegion(region);
      });
      templateDialog.close(); addTarget = null; setupSectionControls(); node.focus();
    }

    function openSeo(): void {
      const current = [...queue.values()].find((change): change is SeoEditorChange => change.kind === 'seo');
      const values = current?.after ?? seoValues();
      const filePath = document.querySelector<HTMLElement>('[data-astro-edit-seo-file]')?.dataset.astroEditSeoFile ?? sourceFileFor(document.documentElement, config);
      seoDialog.querySelector<HTMLElement>('.dialog-file')!.textContent = filePath;
      for (const [field, value] of Object.entries(values)) {
        const input = seoDialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`);
        if (input) input.value = value;
      }
      seoDialog.showModal();
      seoDialog.querySelector<HTMLInputElement>('[name="title"]')?.focus();
    }

    function queueSeo(): void {
      const after = {} as SeoValues;
      for (const field of ['title','description','keywords','canonical','ogTitle','ogDescription','robots'] as SeoField[]) {
        after[field] = seoDialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)?.value.trim() ?? '';
      }
      if (after.canonical) {
        try {
          const url = new URL(after.canonical);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
          showMessage('Canonical URL must be a complete http:// or https:// URL.', 'error'); return;
        }
      }
      const filePath = seoDialog.querySelector<HTMLElement>('.dialog-file')!.textContent!;
      const key = `seo:${filePath}`;
      const existing = queue.get(key);
      if (!existing && queue.size >= config.maxChanges) {
        showMessage(`The queue limit is ${config.maxChanges} changes. Remove or commit a change first.`, 'error');
        return;
      }
      const before = existing?.kind === 'seo' ? existing.before : seoValues();
      mutate(() => {
        if (JSON.stringify(before) === JSON.stringify(after)) queue.delete(key);
        else queue.set(key, { kind: 'seo', id: existing?.id ?? crypto.randomUUID(), filePath, route: window.location.pathname, before, after });
      });
      seoDialog.close();
      const notes: string[] = [];
      if (after.title.length > 60) notes.push('title is over 60 characters');
      if (after.description.length > 160) notes.push('description is over 160 characters');
      if (notes.length) showMessage(`Queued with editorial guidance: ${notes.join('; ')}.`, 'warning');
    }

    function setMode(next: EditorMode): void {
      mode = next;
      restoreHighlight();
      for (const tab of panel.querySelectorAll<HTMLButtonElement>('.mode-tab')) tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
      if (mode === 'text') instructions.textContent = 'Click visible text, or focus it and press Alt+Enter.';
      if (mode === 'sections') instructions.textContent = 'Drag the handle to reorder, or use the keyboard-friendly move/add/delete buttons.';
      if (mode === 'seo') instructions.textContent = 'Edit page metadata through its syntax-aware source adapter.';
      if (mode === 'review') instructions.textContent = 'Review every queued source change before committing the batch.';
      pickerLabel.textContent = mode === 'sections' ? 'Arrange sections' : 'Tap content to edit';
      setupSectionControls(); renderQueue();
      if (mode === 'seo') openSeo();
    }

    function setMinimized(value: boolean): void {
      minimized = value;
      panel.dataset.minimized = String(value);
      picker.dataset.open = String(active && value);
      minimizeButton.setAttribute('aria-label', value ? 'Expand editor' : 'Collapse editor');
      minimizeButton.title = value ? 'Expand editor' : 'Collapse editor';
    }

    function activate(): void {
      if (active) return;
      active = true; panel.dataset.open = 'true'; setMinimized(minimized);
      document.addEventListener('pointerover', onPointerOver, { capture: true, signal: listenerController.signal });
      document.addEventListener('click', onPageClick, { capture: true, signal: listenerController.signal });
      setupSectionControls();
    }

    function deactivate(): void {
      active = false; panel.dataset.open = 'false'; picker.dataset.open = 'false'; restoreHighlight();
      document.querySelectorAll('[data-astro-ve-ui]').forEach((element) => element.remove());
      document.querySelectorAll<HTMLElement>('[data-astro-ve-section-active]').forEach((section) => { section.removeAttribute('data-astro-ve-section-active'); section.removeAttribute('tabindex'); section.removeAttribute('aria-label'); });
      for (const dialog of [textDialog, seoDialog, templateDialog, confirmDialog]) if (dialog.open) dialog.close();
    }

    function sendSave(): void {
      if (queue.size === 0 || saveInFlight || !config.writeEnabled) return;
      saveInFlight = true; clearMessage();
      pendingRequestId ??= crypto.randomUUID();
      sessionStorage.setItem(SESSION_PENDING, pendingRequestId);
      server.send(SAVE_EVENT, { clientId, requestId: pendingRequestId, changes: serializableQueue() });
      window.clearInterval(receiptPollId);
      receiptPollId = window.setInterval(() => {
        if (pendingRequestId) server.send(RECEIPT_EVENT, { clientId, requestId: pendingRequestId });
      }, 750);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        saveInFlight = false;
        showMessage('The save result was not received. Retry is safe: the same request cannot be applied twice.', 'warning');
        renderQueue();
      }, config.requestTimeoutMs);
      renderQueue();
    }

    function handleSaveResponse(response: SaveResponse): void {
      if (response.clientId !== clientId || response.requestId !== pendingRequestId) return;
      window.clearTimeout(timeoutId); saveInFlight = false;
      window.clearInterval(receiptPollId);
      if (response.success) {
        queue.clear(); history.record([]); pendingRequestId = undefined;
        sessionStorage.removeItem(SESSION_PENDING); sessionStorage.removeItem(SESSION_QUEUE);
        lastReceiptId = response.receiptId; if (lastReceiptId) sessionStorage.setItem(SESSION_RECEIPT, lastReceiptId);
        showMessage(`Written ${response.changeCount ?? 0} change${response.changeCount === 1 ? '' : 's'} to source.`, 'success');
      } else {
        pendingRequestId = undefined; sessionStorage.removeItem(SESSION_PENDING);
        showMessage(response.error ?? 'The source update was rejected.', 'error');
      }
      renderQueue();
    }

    function onDocumentKeydown(event: KeyboardEvent): void {
      if (!active) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); sendSave(); return; }
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (mode === 'text' && event.altKey && event.key === 'Enter') {
        const target = editableTarget(document.activeElement); if (target) { event.preventDefault(); openTextEditor(target); }
      }
      if (mode === 'sections' && event.altKey && document.activeElement instanceof HTMLElement && document.activeElement.matches('section[data-section]')) {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); moveSection(document.activeElement, event.key === 'ArrowUp' ? -1 : 1); }
        if (event.key === 'Delete') { event.preventDefault(); deleteTarget = document.activeElement; confirmDialog.showModal(); }
      }
    }

    panel.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode as EditorMode)));
    minimizeButton.addEventListener('click', () => setMinimized(true));
    pickerReview.addEventListener('click', () => {
      setMinimized(false);
      if (queue.size) setMode('review');
    });
    picker.querySelector<HTMLButtonElement>('.picker-close')!.addEventListener('click', () => app.toggleState({ state: false }));
    textDialog.querySelector<HTMLButtonElement>('.queue-text')!.addEventListener('click', queueText);
    seoDialog.querySelector<HTMLButtonElement>('.queue-seo')!.addEventListener('click', queueSeo);
    templateDialog.querySelector<HTMLButtonElement>('.close-templates')!.addEventListener('click', () => templateDialog.close());
    confirmDialog.querySelector<HTMLButtonElement>('.cancel-delete')!.addEventListener('click', () => { deleteTarget = null; confirmDialog.close(); });
    confirmDialog.querySelector<HTMLButtonElement>('.confirm-delete')!.addEventListener('click', () => {
      if (!deleteTarget) return;
      const region = editableRegion(deleteTarget);
      if (region) mutate(() => { deleteTarget!.remove(); queueRegion(region); });
      confirmDialog.close(); deleteTarget = null; setupSectionControls();
    });
    clearButton.addEventListener('click', () => mutate(() => queue.clear()));
    undoButton.addEventListener('click', undo); redoButton.addEventListener('click', redo);
    commitButton.addEventListener('click', sendSave);
    revertButton.addEventListener('click', () => {
      if (!lastReceiptId || saveInFlight) return;
      const requestId = crypto.randomUUID(); saveInFlight = true; renderQueue();
      server.send(REVERT_EVENT, { clientId, requestId, receiptId: lastReceiptId });
    });

    server.on(CONFIG_EVENT, (next: ClientEditorConfig) => {
      config = { ...defaultConfig, ...next }; configReady = true;
      try {
        for (const selector of [...config.editableSelectors, ...config.excludeSelectors, ...Object.keys(config.selectorMappings)]) {
          document.querySelector(selector);
        }
      } catch (error) {
        config.writeEnabled = false;
        const detail = error instanceof Error ? error.message : 'invalid CSS selector';
        setConnection('Editor configuration is invalid.', 'error');
        showMessage(`Editing is disabled until the CSS selector configuration is fixed: ${detail}`, 'error');
        renderQueue();
        return;
      }
      if (config.writeEnabled) setConnection('Connected. Changes remain local until committed.', config.remoteWarning ? 'warning' : 'ready');
      else setConnection(config.remoteWarning ?? 'Source writes are unavailable.', 'error');
      if (config.remoteWarning) showMessage(config.remoteWarning, config.writeEnabled ? 'warning' : 'error');
      replaceQueue(safeParseQueue());
      if (pendingRequestId) server.send(RECEIPT_EVENT, { clientId, requestId: pendingRequestId });
    });
    server.on(SAVE_RESULT_EVENT, handleSaveResponse);
    server.on(RECEIPT_RESULT_EVENT, (receipt: ReceiptResponse) => {
      if (receipt.clientId !== clientId || receipt.requestId !== pendingRequestId) return;
      if (receipt.response) handleSaveResponse(receipt.response);
      else showMessage('The previous save has no receipt. Retry will reuse its idempotency key safely.', 'warning');
    });
    server.on(REVERT_RESULT_EVENT, (response: RevertResponse) => {
      if (response.clientId !== clientId || response.receiptId !== lastReceiptId) return;
      saveInFlight = false;
      if (response.success) {
        lastReceiptId = undefined; sessionStorage.removeItem(SESSION_RECEIPT);
        showMessage(`Restored ${response.files?.length ?? 0} source file${response.files?.length === 1 ? '' : 's'}.`, 'success');
      } else showMessage(response.error ?? 'Revert was refused.', 'error');
      renderQueue();
    });

    document.addEventListener('keydown', onDocumentKeydown, { capture: true, signal: listenerController.signal });
    document.addEventListener('astro:before-swap', persist, { signal: listenerController.signal });
    document.addEventListener('astro:page-load', () => { if (configReady) replaceQueue(safeParseQueue()); }, { signal: listenerController.signal });
    window.addEventListener('beforeunload', (event) => { if (hasUnsavedChanges) event.preventDefault(); }, { signal: listenerController.signal });
    const pageStyle = createElement('style', { 'data-astro-ve-page-style': 'true' }); pageStyle.textContent = pageSectionStyles; document.head.append(pageStyle);

    app.onToggled(({ state }) => state ? activate() : deactivate());
    app.onToolbarPlacementUpdated(({ placement }) => { panel.dataset.placement = placement; picker.dataset.placement = placement; });
    server.send(READY_EVENT, { clientId, route: window.location.pathname });
    renderQueue();
  },
  beforeTogglingOff() {
    return !hasUnsavedChanges || window.confirm('Keep queued Visual Editor changes in this tab and close the workbench?');
  },
});
