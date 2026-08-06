import type {
  EditabilityEffect,
  EditabilityRuleScope,
  SectionRegionRule,
} from '../shared/types.js';
import type { InventoryItem, InventoryStatus } from './editability.js';

interface EditabilityPanelOptions {
  policyFile: string;
  route: string;
  sectionRegions: SectionRegionRule[];
  canManage: boolean;
  pendingChanges: number;
  filter: InventoryStatus | 'all';
  onReview(): void;
  onFilter(filter: InventoryStatus | 'all'): void;
  onLocate(item: InventoryItem, row: HTMLElement): void;
  onDiscoverSource(item: InventoryItem): void;
  onAddSectionRegion(): void;
  onPickSectionRegion(): void;
  onPickText(): void;
  onRemoveSectionRegion(region: SectionRegionRule): void;
  onSetRule(
    item: InventoryItem,
    effect: EditabilityEffect,
    scope: EditabilityRuleScope,
    filePath?: string,
    sourcePath?: string,
  ): void;
  onRemoveRule(item: InventoryItem): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function statusLabel(status: InventoryStatus): string {
  if (status === 'editable') return 'Editable';
  if (status === 'excluded') return 'Blocked';
  if (status === 'unresolved') return 'Unresolved';
  return 'Unsafe';
}

function renderSourceForm(
  item: InventoryItem,
  index: number,
  onSetRule: EditabilityPanelOptions['onSetRule'],
): HTMLFormElement {
  const form = element('form', { class: 'inventory-source-form' });
  const fileId = `ave-source-file-${index}`;
  const pathId = `ave-source-path-${index}`;
  const fileLabel = element('label', { for: fileId });
  fileLabel.textContent = 'Confirm source file';
  const fileInput = element('input', { id: fileId, name: 'file' });
  fileInput.value = item.sourceFile;
  const pathLabel = element('label', { for: pathId });
  pathLabel.textContent = 'Structured path (optional)';
  const pathInput = element('input', { id: pathId, name: 'path' });
  pathInput.value = item.sourcePath ?? '';
  const confirm = element('button', { class: 'primary', type: 'submit' });
  confirm.textContent = 'Confirm source and allow';
  form.append(fileLabel, fileInput, pathLabel, pathInput, confirm);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    onSetRule(
      item,
      'allow',
      'element',
      String(data.get('file') ?? ''),
      String(data.get('path') ?? ''),
    );
  });
  return form;
}

function renderInventoryRow(
  item: InventoryItem,
  index: number,
  options: EditabilityPanelOptions,
): HTMLElement {
  const row = element('article', {
    class: `inventory-item status-${item.status}`,
    tabindex: '-1',
  });
  const top = element('div', { class: 'inventory-item-top' });
  const badge = element('span', { class: 'inventory-status' });
  badge.textContent = statusLabel(item.status);
  const tag = element('code');
  tag.textContent = `<${item.tagName}>`;
  top.append(badge, tag);
  const copy = element('p', { class: 'inventory-copy' });
  copy.textContent = item.text;
  const reason = element('p', { class: 'inventory-reason' });
  reason.textContent = item.reason;
  const source = element('div', { class: 'inventory-source' });
  source.textContent = `${item.sourceFile}${item.sourcePath ? ` → ${item.sourcePath}` : ''}`;
  source.title = item.sourceReason;
  const technical = element('details', { class: 'technical-details' });
  const technicalSummary = element('summary');
  technicalSummary.textContent = 'Technical details';
  technical.append(technicalSummary, source);
  const controls = element('div', { class: 'inventory-controls' });
  const locate = element('button', { class: 'secondary', type: 'button' });
  locate.textContent = 'Show on page';
  locate.addEventListener('click', () => options.onLocate(item, row));
  controls.append(locate);
  if (options.canManage) {
    if (item.activeRule) {
      const remove = element('button', { class: 'secondary', type: 'button' });
      remove.textContent = `Remove ${item.activeRule.scope} rule`;
      remove.addEventListener('click', () => options.onRemoveRule(item));
      controls.append(remove);
    }
    if (item.status === 'editable') {
      const block = element('button', { class: 'danger', type: 'button' });
      block.textContent = 'Block this item';
      block.addEventListener('click', () => options.onSetRule(item, 'deny', 'element'));
      controls.append(block);
    } else if (item.canAllow) {
      const allow = element('button', { class: 'primary', type: 'button' });
      allow.textContent = 'Allow this item';
      allow.addEventListener('click', () => options.onSetRule(item, 'allow', 'element'));
      controls.append(allow);
    }
    if (item.canAllow && item.tagName !== 'html' && item.tagName !== 'body') {
      const group = element('button', { class: 'secondary', type: 'button' });
      group.textContent = `${item.status === 'editable' ? 'Block' : 'Allow'} all <${item.tagName}>`;
      group.addEventListener('click', () =>
        options.onSetRule(item, item.status === 'editable' ? 'deny' : 'allow', 'selector'),
      );
      controls.append(group);
    }
  }
  row.append(top, copy, reason, technical, controls);
  if (item.status === 'unresolved' && options.canManage) {
    const discover = element('button', { class: 'primary discover-source', type: 'button' });
    discover.textContent = 'Find source and allow editing';
    discover.addEventListener('click', () => options.onDiscoverSource(item));
    row.append(discover);
    const manual = element('details', { class: 'technical-details' });
    const manualSummary = element('summary');
    manualSummary.textContent = 'Enter source manually';
    manual.append(manualSummary, renderSourceForm(item, index, options.onSetRule));
    row.append(manual);
  }
  return row;
}

export function renderEditabilityPanel(
  container: HTMLElement,
  inventory: InventoryItem[],
  options: EditabilityPanelOptions,
): void {
  container.replaceChildren();
  const counts = inventory.reduce<Record<InventoryStatus, number>>(
    (totals, item) => ({ ...totals, [item.status]: totals[item.status] + 1 }),
    { editable: 0, excluded: 0, unresolved: 0, unsafe: 0 },
  );
  const guide = element('ol', {
    class: 'setup-guide',
    'aria-label': 'Editor setup steps',
  });
  for (const [step, title, copy] of [
    ['1', 'Choose', 'Text or section settings'],
    ['2', 'Review', 'Check the project setting'],
    ['3', 'Save', 'Return ready to edit'],
  ] as const) {
    const item = element('li', {
      'data-state':
        options.pendingChanges > 0
          ? step === '1'
            ? 'complete'
            : step === '2'
              ? 'active'
              : 'waiting'
          : step === '1'
            ? 'active'
            : 'waiting',
    });
    const number = element('span', { class: 'setup-guide-number', 'aria-hidden': 'true' });
    number.textContent = step;
    const words = element('span');
    const strong = element('strong');
    strong.textContent = title;
    const small = element('small');
    small.textContent = copy;
    words.append(strong, small);
    item.append(number, words);
    guide.append(item);
  }
  const header = element('div', { class: 'inventory-header' });
  const heading = element('div');
  const title = element('h3');
  title.textContent = 'Editor Setup';
  const policyFile = element('p', { class: 'inventory-policy-file' });
  policyFile.textContent = options.policyFile;
  heading.append(title, policyFile);
  const count = element('span', { class: 'inventory-total' });
  count.textContent = `${inventory.length} visible items`;
  header.append(heading, count);
  const sectionSetup = element('section', {
    class: 'section-setup',
    'aria-labelledby': 'ave-section-setup-title',
  });
  const sectionHeader = element('div', { class: 'section-setup-header' });
  const sectionHeading = element('div');
  const sectionTitle = element('h4', { id: 'ave-section-setup-title' });
  sectionTitle.textContent = 'Section regions';
  const sectionHelp = element('p');
  sectionHelp.textContent =
    'Choose existing page containers that may be reordered. The editor matches each one to a syntax-aware source structure and refuses ambiguous matches.';
  sectionHeading.append(sectionTitle, sectionHelp);
  const sectionCount = element('span', { class: 'inventory-total' });
  sectionCount.textContent = `${options.sectionRegions.length} enabled`;
  sectionHeader.append(sectionHeading, sectionCount);
  sectionSetup.append(sectionHeader);
  if (options.sectionRegions.length) {
    const regionList = element('div', { class: 'section-region-list' });
    for (const region of options.sectionRegions) {
      const row = element('article', { class: 'section-region-item' });
      const copy = element('div');
      const selector = element('strong');
      selector.textContent = region.selector;
      const source = element('code');
      source.textContent = `${region.filePath} → ${region.sourcePath}`;
      copy.append(selector, source);
      const remove = element('button', { class: 'secondary', type: 'button' });
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove section region ${region.selector}`);
      remove.addEventListener('click', () => options.onRemoveSectionRegion(region));
      row.append(copy, remove);
      regionList.append(row);
    }
    sectionSetup.append(regionList);
  } else {
    const empty = element('p', { class: 'section-setup-empty' });
    empty.textContent = `No section region is enabled for ${options.route}.`;
    sectionSetup.append(empty);
  }
  if (options.canManage) {
    const regionActions = element('div', { class: 'setup-picker-actions' });
    const pickRegion = element('button', {
      class: 'primary add-section-region',
      type: 'button',
    });
    pickRegion.textContent = 'Select section on page';
    pickRegion.addEventListener('click', options.onPickSectionRegion);
    const addRegion = element('button', { class: 'secondary', type: 'button' });
    addRegion.textContent = options.sectionRegions.length
      ? 'Choose another from list'
      : 'Choose from list';
    addRegion.addEventListener('click', options.onAddSectionRegion);
    regionActions.append(pickRegion, addRegion);
    sectionSetup.append(regionActions);
  }
  const textHeading = element('div', { class: 'text-settings-heading' });
  const textTitle = element('h4');
  textTitle.textContent = 'Text permissions';
  const textHelp = element('p');
  textHelp.textContent = 'Choose which visible text can be edited and confirm unresolved sources.';
  textHeading.append(textTitle, textHelp);
  if (options.canManage) {
    const pickText = element('button', { class: 'primary pick-text-on-page', type: 'button' });
    pickText.textContent = 'Select text on page';
    pickText.addEventListener('click', options.onPickText);
    textHeading.append(pickText);
  }
  const pending = element('div', {
    class: 'pending-policy',
    role: 'status',
    'aria-live': 'polite',
  });
  if (options.pendingChanges > 0) {
    const pendingCopy = element('div');
    const pendingTitle = element('strong');
    pendingTitle.textContent = 'Not saved yet';
    const pendingText = element('span');
    pendingText.textContent = `${options.pendingChanges} editor setting${options.pendingChanges === 1 ? '' : 's'} will only work after you review and save.`;
    pendingCopy.append(pendingTitle, pendingText);
    const review = element('button', { class: 'primary', type: 'button' });
    review.textContent = 'Review and save now';
    review.addEventListener('click', options.onReview);
    pending.append(pendingCopy, review);
  }
  const filters = element('div', {
    class: 'inventory-filters',
    role: 'group',
    'aria-label': 'Filter page inventory',
  });
  for (const [value, label] of [
    ['all', `All ${inventory.length}`],
    ['editable', `Editable ${counts.editable}`],
    ['excluded', `Blocked ${counts.excluded}`],
    ['unresolved', `Unresolved ${counts.unresolved}`],
    ['unsafe', `Unsafe ${counts.unsafe}`],
  ] as const) {
    const filter = element('button', {
      class: 'inventory-filter',
      type: 'button',
      'aria-pressed': String(options.filter === value),
    });
    filter.textContent = label;
    filter.addEventListener('click', () => options.onFilter(value));
    filters.append(filter);
  }
  const list = element('div', { class: 'inventory-list' });
  const visibleItems = inventory.filter(
    (item) => options.filter === 'all' || item.status === options.filter,
  );
  visibleItems.forEach((item, index) => list.append(renderInventoryRow(item, index, options)));
  if (!visibleItems.length) {
    const empty = element('div', { class: 'empty' });
    empty.textContent = 'No visible content matches this filter.';
    list.append(empty);
  }
  container.append(guide, header, sectionSetup);
  if (options.pendingChanges > 0) container.append(pending);
  container.append(textHeading, filters, list);
}
