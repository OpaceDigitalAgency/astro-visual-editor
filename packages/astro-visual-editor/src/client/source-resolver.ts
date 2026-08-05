import type { ClientEditorConfig, EditabilityPolicy } from '../shared/types.js';

export function routeFallback(pathname: string): string {
  const clean = pathname.replace(/\/$/u, '') || '/';
  return clean === '/' ? 'src/pages/index.astro' : `src/pages${clean}.astro`;
}

export interface SourceResolution {
  filePath: string;
  sourcePath?: string;
  proven: boolean;
  reason: string;
}

export function sourceResolutionFor(
  element: HTMLElement,
  config: ClientEditorConfig,
  policy?: EditabilityPolicy,
): SourceResolution {
  const explicit = element.closest<HTMLElement>('[data-astro-edit-file]')?.dataset.astroEditFile;
  const sourcePath = element.closest<HTMLElement>('[data-astro-edit-path]')?.dataset.astroEditPath;
  if (explicit) {
    return {
      filePath: explicit,
      sourcePath,
      proven: true,
      reason: 'Confirmed by a source annotation.',
    };
  }
  for (const [selector, filePath] of Object.entries(config.selectorMappings)) {
    try {
      if (element.closest(selector)) {
        return {
          filePath,
          sourcePath,
          proven: true,
          reason: `Confirmed by selector mapping “${selector}”.`,
        };
      }
    } catch {
      // Configuration is also server-validated; ignore a selector unsupported by this browser.
    }
  }
  const path = window.location.pathname;
  const mapped = config.fileMappings[path] ?? config.fileMappings[path.replace(/\/$/u, '')];
  if (mapped)
    return {
      filePath: mapped,
      sourcePath,
      proven: true,
      reason: 'Confirmed by the page route mapping.',
    };
  const policyRule = policy?.rules.find((rule) => {
    if (rule.route !== path || rule.effect !== 'allow' || !rule.filePath) return false;
    try {
      return element.matches(rule.selector);
    } catch {
      return false;
    }
  });
  if (policyRule?.filePath) {
    return {
      filePath: policyRule.filePath,
      sourcePath: policyRule.sourcePath ?? sourcePath,
      proven: true,
      reason: 'Confirmed by the saved editability policy.',
    };
  }
  return {
    filePath: routeFallback(path),
    sourcePath,
    proven: false,
    reason: 'Only a route-based source candidate is available.',
  };
}

export function sourceFileFor(
  element: HTMLElement,
  config: ClientEditorConfig,
  policy?: EditabilityPolicy,
): string {
  return sourceResolutionFor(element, config, policy).filePath;
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
