import type { ClientEditorConfig } from '../shared/types.js';

export function routeFallback(pathname: string): string {
  const clean = pathname.replace(/\/$/u, '') || '/';
  return clean === '/' ? 'src/pages/index.astro' : `src/pages${clean}.astro`;
}

export function sourceFileFor(element: HTMLElement, config: ClientEditorConfig): string {
  const explicit = element.closest<HTMLElement>('[data-astro-edit-file]')?.dataset.astroEditFile;
  if (explicit) return explicit;
  for (const [selector, filePath] of Object.entries(config.selectorMappings)) {
    try {
      if (element.closest(selector)) return filePath;
    } catch {
      // Configuration is also server-validated; ignore a selector unsupported by this browser.
    }
  }
  const path = window.location.pathname;
  return (
    config.fileMappings[path] ??
    config.fileMappings[path.replace(/\/$/u, '')] ??
    routeFallback(path)
  );
}

export function selectorFor(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const editableId = element.dataset.astroEditId;
  if (editableId) return `[data-astro-edit-id="${CSS.escape(editableId)}"]`;
  const sectionId = element.closest<HTMLElement>('[data-section]')?.dataset.section;
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && parts.length < 5 && current !== document.body) {
    let part = current.tagName.toLowerCase();
    if (current.dataset.section) part += `[data-section="${CSS.escape(current.dataset.section)}"]`;
    else if (current.classList.length > 0) part += `.${CSS.escape(current.classList[0] ?? '')}`;
    parts.unshift(part);
    if (current.dataset.section) break;
    current = current.parentElement;
  }
  const selector = parts.join(' > ');
  return sectionId && !selector.includes('data-section')
    ? `[data-section="${CSS.escape(sectionId)}"] ${selector}`
    : selector;
}

export function regionIdFor(region: HTMLElement): string {
  return region.dataset.astroEditRegion?.trim() || 'default';
}
