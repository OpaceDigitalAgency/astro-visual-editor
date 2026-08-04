import { defineToolbarApp } from 'astro/toolbar';
import type {
  ClientEditorConfig,
  EditorChange,
  SaveResponse,
} from './shared/types.js';

const APP_ID = 'astro-visual-editor';
const READY_EVENT = `${APP_ID}:ready`;
const CONFIG_EVENT = `${APP_ID}:config`;
const SAVE_EVENT = `${APP_ID}:save`;
const SAVE_RESULT_EVENT = `${APP_ID}:save-result`;

interface QueuedChange extends EditorChange {
  element: HTMLElement;
  elementKey: string;
}

const defaultConfig: ClientEditorConfig = {
  editableSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'],
  excludeSelectors: ['pre', 'code', 'script', 'style', '[data-astro-edit-ignore]'],
  fileMappings: {},
  selectorMappings: {},
  maxChanges: 100,
  maxTextLength: 10_000,
  allowUnsafeSourceText: false,
};

function createElement<K extends keyof HTMLElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function routeFallback(pathname: string): string {
  const clean = pathname.replace(/\/$/u, '') || '/';
  return clean === '/' ? 'src/pages/index.astro' : `src/pages${clean}.astro`;
}

function selectorFor(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const editableId = element.dataset.astroEditId;
  if (editableId) return `[data-astro-edit-id="${CSS.escape(editableId)}"]`;
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && parts.length < 4 && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.classList.length > 0) {
      part += `.${CSS.escape(current.classList[0] ?? '')}`;
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

export default defineToolbarApp({
  init(canvas, app, server) {
    let config = defaultConfig;
    let active = false;
    let hovered: HTMLElement | null = null;
    let editing: HTMLElement | null = null;
    let originalEditingText = '';
    let elementSequence = 0;
    let saveInFlight = false;
    const queue = new Map<string, QueuedChange>();
    const originalByElement = new WeakMap<HTMLElement, string>();
    const keyByElement = new WeakMap<HTMLElement, string>();
    const previousStyle = new WeakMap<HTMLElement, { outline: string; cursor: string }>();

    const style = createElement('style');
    style.textContent = `
      :host { color-scheme: dark; }
      * { box-sizing: border-box; }
      .workbench {
        width: min(430px, calc(100vw - 32px));
        max-height: min(720px, calc(100vh - 110px));
        display: none;
        overflow: hidden;
        color: #f7f5f2;
        background: #151719;
        border: 1px solid #34383d;
        border-radius: 16px;
        box-shadow: 0 24px 70px rgba(0, 0, 0, .48);
        font: 14px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .workbench[data-open="true"] { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; }
      .masthead { padding: 18px 18px 14px; border-bottom: 1px solid #2a2e32; }
      .eyebrow { margin: 0 0 5px; color: #ff8a4c; font: 700 10px/1.2 ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; }
      h2 { margin: 0; font-size: 18px; letter-spacing: -.02em; }
      .status { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; color: #aeb4bb; font-size: 12px; }
      .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #6ee7a8; box-shadow: 0 0 0 4px rgba(110, 231, 168, .1); }
      .instructions { padding: 12px 18px; color: #c5cad0; background: #1b1e21; border-bottom: 1px solid #2a2e32; font-size: 12px; }
      .ledger { min-height: 132px; overflow: auto; padding: 12px; }
      .empty { display: grid; place-items: center; min-height: 108px; padding: 16px; text-align: center; color: #777f87; border: 1px dashed #353a3f; border-radius: 12px; }
      .change { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 12px; margin-bottom: 8px; background: #1e2124; border: 1px solid #30353a; border-radius: 11px; }
      .file { overflow: hidden; color: #ffab7a; font: 600 11px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .diff { display: grid; gap: 3px; margin-top: 7px; font-size: 12px; }
      .old { color: #8c949c; text-decoration: line-through; }
      .new { color: #f7f5f2; }
      .remove { align-self: center; width: 30px; height: 30px; color: #ff9d9d; background: transparent; border: 1px solid #4a3436; border-radius: 8px; cursor: pointer; }
      .remove:hover, .remove:focus-visible { background: #3b2528; outline: 2px solid #ff8a4c; outline-offset: 2px; }
      .actions { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 12px; border-top: 1px solid #2a2e32; }
      button { font: inherit; }
      .primary, .secondary { min-height: 42px; border-radius: 10px; font-weight: 750; cursor: pointer; }
      .primary { color: #17191b; background: #ff8a4c; border: 1px solid #ff9e6b; }
      .primary:hover:not(:disabled), .primary:focus-visible { background: #ff9f69; outline: 2px solid #ffd0b5; outline-offset: 2px; }
      .primary:disabled { cursor: not-allowed; opacity: .45; }
      .secondary { padding-inline: 14px; color: #d8dce0; background: #24282c; border: 1px solid #3a4046; }
      .secondary:hover, .secondary:focus-visible { background: #30353a; outline: 2px solid #838b94; outline-offset: 2px; }
      dialog { width: min(560px, calc(100vw - 32px)); padding: 0; color: #f7f5f2; background: #17191b; border: 1px solid #3a3f45; border-radius: 16px; box-shadow: 0 28px 90px rgba(0, 0, 0, .6); }
      dialog::backdrop { background: rgba(7, 9, 10, .7); backdrop-filter: blur(4px); }
      .dialog-body { padding: 20px; }
      .dialog-file { margin: 4px 0 16px; overflow-wrap: anywhere; color: #ffab7a; font: 600 11px/1.45 ui-monospace, monospace; }
      label { display: block; margin-bottom: 7px; color: #c9ced3; font-size: 12px; font-weight: 700; }
      textarea { width: 100%; min-height: 150px; resize: vertical; padding: 13px; color: #fff; background: #0f1113; border: 1px solid #42484f; border-radius: 10px; font: 14px/1.55 ui-monospace, monospace; }
      textarea:focus { border-color: #ff8a4c; outline: 3px solid rgba(255, 138, 76, .2); }
      .dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
      .message { display: none; margin: 0 12px 12px; padding: 10px 12px; border-radius: 9px; font-size: 12px; }
      .message[data-show="true"] { display: block; }
      .message[data-kind="error"] { color: #ffc7c7; background: #3b2427; border: 1px solid #613238; }
      .message[data-kind="success"] { color: #bdf5d7; background: #183128; border: 1px solid #285441; }
      @media (prefers-reduced-motion: no-preference) {
        .workbench { animation: arrive .16s ease-out; }
        @keyframes arrive { from { opacity: 0; transform: translateY(6px) scale(.985); } }
      }
    `;

    const panel = createElement('section', {
      class: 'workbench',
      'data-open': 'false',
      'aria-label': 'Astro Visual Editor change ledger',
    });
    panel.innerHTML = `
      <header class="masthead">
        <p class="eyebrow">Local source workbench</p>
        <h2>Visual Editor</h2>
        <p class="status">Ready. Source files remain untouched.</p>
      </header>
      <div class="instructions">Click visible text on the page. Changes stay in this ledger until you commit them.</div>
      <div class="ledger" aria-live="polite"></div>
      <p class="message" role="status"></p>
      <footer class="actions">
        <button class="primary" type="button" disabled>Commit 0 changes</button>
        <button class="secondary" type="button">Clear</button>
      </footer>
    `;

    const dialog = createElement('dialog');
    dialog.innerHTML = `
      <form method="dialog" class="dialog-body">
        <p class="eyebrow">Preview before writing</p>
        <h2>Edit text</h2>
        <p class="dialog-file"></p>
        <label for="astro-visual-editor-text">Replacement text</label>
        <textarea id="astro-visual-editor-text" required></textarea>
        <div class="dialog-actions">
          <button class="secondary" value="cancel" type="submit">Cancel</button>
          <button class="primary queue-change" value="default" type="button">Queue change</button>
        </div>
      </form>
    `;

    canvas.append(style, panel, dialog);

    const ledger = panel.querySelector<HTMLElement>('.ledger')!;
    const commitButton = panel.querySelector<HTMLButtonElement>('.primary')!;
    const clearButton = panel.querySelector<HTMLButtonElement>('.secondary')!;
    const message = panel.querySelector<HTMLElement>('.message')!;
    const textarea = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    const dialogFile = dialog.querySelector<HTMLElement>('.dialog-file')!;
    const queueButton = dialog.querySelector<HTMLButtonElement>('.queue-change')!;

    dialog.addEventListener('close', () => {
      editing = null;
      originalEditingText = '';
    });

    function showMessage(text: string, kind: 'error' | 'success'): void {
      message.textContent = text;
      message.dataset.show = 'true';
      message.dataset.kind = kind;
    }

    function clearMessage(): void {
      message.textContent = '';
      message.dataset.show = 'false';
    }

    function elementKey(element: HTMLElement): string {
      let key = keyByElement.get(element);
      if (!key) {
        elementSequence += 1;
        key = `element-${elementSequence}`;
        keyByElement.set(element, key);
      }
      return key;
    }

    function sourceFileFor(element: HTMLElement): string {
      const explicit = element.closest<HTMLElement>('[data-astro-edit-file]')?.dataset.astroEditFile;
      if (explicit) return explicit;
      for (const [selector, filePath] of Object.entries(config.selectorMappings)) {
        if (element.closest(selector)) return filePath;
      }
      const path = window.location.pathname;
      return config.fileMappings[path] ?? config.fileMappings[path.replace(/\/$/u, '')] ?? routeFallback(path);
    }

    function restoreHighlight(element: HTMLElement | null): void {
      if (!element) return;
      const old = previousStyle.get(element);
      if (old) {
        element.style.outline = old.outline;
        element.style.cursor = old.cursor;
        previousStyle.delete(element);
      }
    }

    function highlight(element: HTMLElement): void {
      if (!previousStyle.has(element)) {
        previousStyle.set(element, {
          outline: element.style.outline,
          cursor: element.style.cursor,
        });
      }
      element.style.outline = '2px solid #ff8a4c';
      element.style.outlineOffset = '3px';
      element.style.cursor = 'text';
    }

    function editableTarget(target: EventTarget | null): HTMLElement | null {
      if (!(target instanceof Element)) return null;
      const candidate = target.closest<HTMLElement>(config.editableSelectors.join(','));
      if (!candidate || candidate.closest('astro-dev-toolbar')) return null;
      if (config.excludeSelectors.some((selector) => candidate!.matches(selector) || candidate!.closest(selector))) {
        return null;
      }
      const explicitlyEditable = candidate.hasAttribute('data-astro-editable');
      if (!explicitlyEditable && candidate.children.length > 0) return null;
      if (!candidate.textContent?.trim()) return null;
      return candidate;
    }

    function renderQueue(): void {
      ledger.replaceChildren();
      if (queue.size === 0) {
        const empty = createElement('div', { class: 'empty' });
        empty.textContent = 'No queued changes. Hover the page to find editable text.';
        ledger.append(empty);
      } else {
        for (const [key, change] of queue) {
          const row = createElement('article', { class: 'change' });
          const copy = createElement('div');
          const file = createElement('div', { class: 'file', title: change.filePath });
          file.textContent = change.filePath;
          const diff = createElement('div', { class: 'diff' });
          const oldText = createElement('span', { class: 'old' });
          const newText = createElement('span', { class: 'new' });
          oldText.textContent = change.oldText;
          newText.textContent = change.newText;
          diff.append(oldText, newText);
          copy.append(file, diff);
          const remove = createElement('button', {
            class: 'remove',
            type: 'button',
            'aria-label': `Undo change in ${change.filePath}`,
          });
          remove.textContent = '×';
          remove.addEventListener('click', () => {
            change.element.textContent = change.oldText;
            queue.delete(key);
            app.toggleNotification({ state: queue.size > 0, level: 'info' });
            renderQueue();
          });
          row.append(copy, remove);
          ledger.append(row);
        }
      }
      commitButton.disabled = queue.size === 0 || saveInFlight;
      commitButton.textContent = saveInFlight
        ? 'Writing source files…'
        : `Commit ${queue.size} change${queue.size === 1 ? '' : 's'}`;
    }

    function onPointerOver(event: PointerEvent): void {
      if (!active || dialog.open) return;
      const candidate = editableTarget(event.target);
      if (candidate === hovered) return;
      restoreHighlight(hovered);
      hovered = candidate;
      if (hovered) highlight(hovered);
    }

    function onClick(event: MouseEvent): void {
      if (!active || dialog.open) return;
      const candidate = editableTarget(event.target);
      if (!candidate) return;
      event.preventDefault();
      event.stopPropagation();
      editing = candidate;
      const key = elementKey(candidate);
      const queued = queue.get(key);
      originalEditingText = queued?.oldText ?? candidate.textContent?.trim() ?? '';
      if (!originalByElement.has(candidate)) originalByElement.set(candidate, originalEditingText);
      textarea.value = candidate.textContent?.trim() ?? '';
      dialogFile.textContent = sourceFileFor(candidate);
      dialog.showModal();
      textarea.focus();
      textarea.select();
    }

    function activate(): void {
      if (active) return;
      active = true;
      panel.dataset.open = 'true';
      document.addEventListener('pointerover', onPointerOver, true);
      document.addEventListener('click', onClick, true);
    }

    function deactivate(): void {
      if (!active) return;
      active = false;
      panel.dataset.open = 'false';
      restoreHighlight(hovered);
      hovered = null;
      document.removeEventListener('pointerover', onPointerOver, true);
      document.removeEventListener('click', onClick, true);
      if (dialog.open) dialog.close();
    }

    queueButton.addEventListener('click', () => {
      if (!editing) return;
      const nextText = textarea.value.trim();
      if (!nextText || nextText === editing.textContent?.trim()) {
        dialog.close();
        return;
      }
      if (nextText.length > config.maxTextLength) {
        showMessage(`Text exceeds the ${config.maxTextLength}-character limit.`, 'error');
        return;
      }
      if (!config.allowUnsafeSourceText && /[<>{}]/u.test(nextText)) {
        showMessage('Markup characters are blocked in visual text mode. Edit the source for structural changes.', 'error');
        return;
      }
      const key = elementKey(editing);
      if (!queue.has(key) && queue.size >= config.maxChanges) {
        showMessage(`The queue limit is ${config.maxChanges} changes.`, 'error');
        return;
      }
      const oldText = originalByElement.get(editing) ?? originalEditingText;
      editing.textContent = nextText;
      queue.set(key, {
        id: crypto.randomUUID(),
        elementKey: key,
        element: editing,
        filePath: sourceFileFor(editing),
        oldText,
        newText: nextText,
        route: window.location.pathname,
        selector: selectorFor(editing),
      });
      dialog.close();
      app.toggleNotification({ state: true, level: 'info' });
      clearMessage();
      renderQueue();
    });

    clearButton.addEventListener('click', () => {
      for (const change of queue.values()) change.element.textContent = change.oldText;
      queue.clear();
      app.toggleNotification({ state: false });
      clearMessage();
      renderQueue();
    });

    commitButton.addEventListener('click', () => {
      if (queue.size === 0 || saveInFlight) return;
      saveInFlight = true;
      clearMessage();
      renderQueue();
      const requestId = crypto.randomUUID();
      const changes = [...queue.values()].map(({ element: _element, elementKey: _key, ...change }) => change);
      server.send(SAVE_EVENT, { requestId, changes });
    });

    server.on(CONFIG_EVENT, (nextConfig: ClientEditorConfig) => {
      config = { ...defaultConfig, ...nextConfig };
      renderQueue();
    });

    server.on(SAVE_RESULT_EVENT, (response: SaveResponse) => {
      saveInFlight = false;
      if (response.success) {
        queue.clear();
        app.toggleNotification({ state: false });
        showMessage(
          `Written ${response.changeCount ?? 0} change${response.changeCount === 1 ? '' : 's'} to source.`,
          'success',
        );
      } else {
        showMessage(response.error ?? 'The source update was rejected.', 'error');
      }
      renderQueue();
    });

    app.onToggled(({ state }) => (state ? activate() : deactivate()));
    server.send(READY_EVENT, { route: window.location.pathname });
    renderQueue();
  },
  beforeTogglingOff() {
    return true;
  },
});
