import type { ClientEditorConfig, EditabilityPolicy, EditabilityRule } from '../shared/types.js';
import { selectorFor, sourceResolutionFor } from './source-resolver.js';

export type InventoryStatus = 'editable' | 'excluded' | 'unresolved' | 'unsafe';

export interface InventoryItem {
  element: HTMLElement;
  selector: string;
  text: string;
  tagName: string;
  status: InventoryStatus;
  reason: string;
  sourceFile: string;
  sourcePath?: string;
  sourceReason: string;
  activeRule?: EditabilityRule;
  canAllow: boolean;
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

export function matchingPolicyRule(
  element: HTMLElement,
  policy: EditabilityPolicy,
  route = window.location.pathname,
): EditabilityRule | undefined {
  const matching = policy.rules.filter(
    (rule) => rule.route === route && safeMatches(element, rule.selector),
  );
  return (
    matching.find((rule) => rule.effect === 'deny' && rule.scope === 'element') ??
    matching.find((rule) => rule.effect === 'deny') ??
    matching.find((rule) => rule.effect === 'allow' && rule.scope === 'element') ??
    matching.find((rule) => rule.effect === 'allow')
  );
}

function matchesAny(element: HTMLElement, selectors: string[]): boolean {
  return selectors.some((selector) => safeMatches(element, selector));
}

function excludedByConfiguration(
  element: HTMLElement,
  config: ClientEditorConfig,
): string | undefined {
  if (element.closest('[data-astro-edit-ignore]')) return 'Explicitly blocked in the page source.';
  for (const selector of config.excludeSelectors) {
    try {
      if (element.matches(selector) || element.closest(selector)) {
        return `Blocked by the project exclusion rule “${selector}”.`;
      }
    } catch {
      return 'Blocked because an exclusion selector is invalid.';
    }
  }
  return undefined;
}

export function classifyElement(
  element: HTMLElement,
  config: ClientEditorConfig,
  policy: EditabilityPolicy,
): InventoryItem {
  const selector = selectorFor(element);
  const text = element.textContent?.trim().replace(/\s+/gu, ' ') ?? '';
  const tagName = element.tagName.toLowerCase();
  const rule = matchingPolicyRule(element, policy);
  const resolution = sourceResolutionFor(element, config, policy);
  const base = {
    element,
    selector,
    text,
    tagName,
    sourceFile: resolution.filePath,
    sourcePath: resolution.sourcePath,
    sourceReason: resolution.reason,
    activeRule: rule,
  };
  const configuredExclusion = excludedByConfiguration(element, config);
  if (configuredExclusion) {
    return {
      ...base,
      status: 'excluded',
      reason: configuredExclusion,
      canAllow: false,
    };
  }
  if (rule?.effect === 'deny') {
    return {
      ...base,
      status: 'excluded',
      reason: `Blocked by the saved ${rule.scope} rule “${rule.selector}”.`,
      canAllow: true,
    };
  }
  const enabled = rule?.effect === 'allow' || matchesAny(element, config.editableSelectors);
  if (!enabled) {
    return {
      ...base,
      status: 'excluded',
      reason: `The <${tagName}> element is not included by the current editability policy.`,
      canAllow: true,
    };
  }
  if (!element.hasAttribute('data-astro-editable') && element.children.length > 0) {
    return {
      ...base,
      status: 'unsafe',
      reason:
        'This element contains nested structure, so replacing all of its text could damage the page.',
      canAllow: false,
    };
  }
  if (!resolution.proven) {
    return {
      ...base,
      status: 'unresolved',
      reason: 'The page is visible, but its exact source file has not been confirmed.',
      canAllow: true,
    };
  }
  return {
    ...base,
    status: 'editable',
    reason:
      rule?.effect === 'allow'
        ? `Allowed by the saved ${rule.scope} rule “${rule.selector}”.`
        : 'Allowed by the project’s default editable elements.',
    canAllow: true,
  };
}

export interface LockExplanation {
  /** One plain-language sentence saying why this content cannot be edited here. */
  summary: string;
  /** One plain-language sentence saying what would make it editable. */
  action: string;
  /** True when the summary came from the page or project rather than a default. */
  custom: boolean;
}

const defaultExplanations: Record<Exclude<InventoryStatus, 'editable'>, LockExplanation> = {
  unresolved: {
    summary:
      'This text is generated automatically when the site is built, so the editor cannot trace it back to a file it can safely change.',
    action:
      'To make it editable, ask your developer to connect this area to its content file — a one-line label in the template.',
    custom: false,
  },
  unsafe: {
    summary:
      'This text has other content inside it (such as a link or an icon), so editing it as one piece could break the page.',
    action:
      'A developer can change it in the source file, or mark it as safe to edit by splitting it into simpler pieces.',
    custom: false,
  },
  excluded: {
    summary: 'Editing is switched off for this area.',
    action:
      'If it should be editable, it can be allowed from the setup screen or by changing the project configuration.',
    custom: false,
  },
};

function routeMatches(route: string | undefined, pathname: string): boolean {
  if (!route) return true;
  if (route.endsWith('*')) return pathname.startsWith(route.slice(0, -1));
  return route === pathname || `${route}/` === pathname || route === `${pathname}/`;
}

/**
 * Owner-facing explanation for a non-editable element. Priority: an explicit
 * `data-astro-edit-locked-reason` on the element or an ancestor, then the
 * project's `lockedAreaMessages` configuration, then a per-status default.
 */
export function lockExplanation(
  item: Pick<InventoryItem, 'element' | 'status'>,
  config: ClientEditorConfig,
  pathname = window.location.pathname,
): LockExplanation {
  if (item.status === 'editable') {
    return { summary: 'This content is editable.', action: '', custom: false };
  }
  const fallback = defaultExplanations[item.status];
  const annotated = item.element.closest<HTMLElement>('[data-astro-edit-locked-reason]');
  const attributeReason = annotated?.getAttribute('data-astro-edit-locked-reason')?.trim();
  if (attributeReason) {
    return {
      summary: attributeReason,
      action: annotated?.getAttribute('data-astro-edit-locked-action')?.trim() || fallback.action,
      custom: true,
    };
  }
  for (const entry of config.lockedAreaMessages) {
    if (!routeMatches(entry.route, pathname)) continue;
    try {
      if (!item.element.closest(entry.selector)) continue;
    } catch {
      continue;
    }
    return {
      summary: entry.message,
      action: entry.action?.trim() || fallback.action,
      custom: true,
    };
  }
  return fallback;
}

export function policyAllowSelectors(policy: EditabilityPolicy): string[] {
  return policy.rules.filter((rule) => rule.effect === 'allow').map((rule) => rule.selector);
}

export function inventoryPage(
  config: ClientEditorConfig,
  policy: EditabilityPolicy,
): InventoryItem[] {
  const selectors = [
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
    'strong',
    'em',
    'small',
    'span',
    '[data-astro-editable]',
    '[data-astro-edit-ignore]',
    ...config.editableSelectors,
    ...policy.rules.map((rule) => rule.selector),
  ];
  const elements = new Set<HTMLElement>();
  for (const selector of selectors) {
    try {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => elements.add(element));
    } catch {
      continue;
    }
  }
  return [...elements]
    .filter((element) => {
      if (element.closest('astro-dev-toolbar') || element.closest('[data-astro-ve-ui]'))
        return false;
      if (!element.textContent?.trim() || element.getClientRects().length === 0) return false;
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    })
    .map((element) => classifyElement(element, config, policy));
}
