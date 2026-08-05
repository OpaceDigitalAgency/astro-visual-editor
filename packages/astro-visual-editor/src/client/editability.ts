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
