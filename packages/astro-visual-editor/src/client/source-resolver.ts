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
  sharedRouteCount?: number;
}

function sharedRouteCount(element: HTMLElement): number | undefined {
  const routes = element
    .closest<HTMLElement>('[data-astro-edit-shared-routes]')
    ?.dataset.astroEditSharedRoutes?.split(',')
    .map((route) => route.trim())
    .filter(Boolean);
  return routes && routes.length > 1 ? new Set(routes).size : undefined;
}

function annotatedReason(element: HTMLElement): string {
  const origin = element.closest<HTMLElement>('[data-astro-edit-origin]')?.dataset.astroEditOrigin;
  const shared = sharedRouteCount(element);
  const originCopy = origin ? ` Confirmed as ${origin.replaceAll('-', ' ')}.` : '';
  const sharedCopy = shared ? ` This value is shared by ${shared} routes.` : '';
  return `Confirmed by a source annotation.${originCopy}${sharedCopy}`;
}

export function sourceResolutionFor(
  element: HTMLElement,
  config: ClientEditorConfig,
  policy?: EditabilityPolicy,
): SourceResolution {
  const annotatedOwner = element.closest<HTMLElement>('[data-astro-edit-file]');
  const explicit = annotatedOwner?.dataset.astroEditFile;
  const sourcePath = annotatedOwner?.dataset.astroEditPath;
  if (explicit) {
    return {
      filePath: explicit,
      sourcePath,
      proven: true,
      reason: annotatedReason(element),
      sharedRouteCount: sharedRouteCount(element),
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
  const generatedRegion = element.dataset.astroVeGeneratedRegion === 'true';
  const explicitFile = generatedRegion ? undefined : element.dataset.astroEditFile?.trim();
  const explicitPath = generatedRegion ? undefined : element.dataset.astroEditPath?.trim();
  if (explicitFile && explicitPath) {
    return `[data-astro-edit-file="${CSS.escape(explicitFile)}"][data-astro-edit-path="${CSS.escape(explicitPath)}"]`;
  }
  const sectionOwner = element.closest<HTMLElement>('[data-section]');
  const sectionId =
    sectionOwner?.dataset.astroVeGeneratedSection === 'true'
      ? undefined
      : sectionOwner?.dataset.section;
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && parts.length < 5 && current !== document.body) {
    let part = current.tagName.toLowerCase();
    const generatedSection = current.dataset.astroVeGeneratedSection === 'true';
    if (current.dataset.section && !generatedSection)
      part += `[data-section="${CSS.escape(current.dataset.section)}"]`;
    else if (current.classList.length > 0) part += `.${CSS.escape(current.classList[0] ?? '')}`;
    if ((!current.dataset.section || generatedSection) && current.parentElement) {
      let matchingSiblings: Element[] = [];
      try {
        matchingSiblings = [...current.parentElement.children].filter((sibling) =>
          sibling.matches(part),
        );
      } catch {
        matchingSiblings = [];
      }
      if (matchingSiblings.length > 1) {
        const sameTag = [...current.parentElement.children].filter(
          (sibling) => sibling.tagName === current!.tagName,
        );
        part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    if (current.dataset.section && !generatedSection) break;
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
