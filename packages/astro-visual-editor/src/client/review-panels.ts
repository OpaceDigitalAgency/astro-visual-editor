import type { FileDiff, HistoryEntry } from '../shared/types.js';

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

export function renderHistoryPanel(
  container: HTMLElement,
  entries: HistoryEntry[],
  onRestore: (entry: HistoryEntry) => void,
): void {
  container.replaceChildren();
  if (!entries.length) {
    container.textContent = 'No saved changes are available yet.';
    return;
  }
  for (const entry of entries) {
    const row = element('article', { class: 'change' });
    const copy = element('div');
    copy.textContent = `${entry.status === 'reverted' ? 'Restored' : 'Saved'} ${entry.changeCount} change${entry.changeCount === 1 ? '' : 's'} · ${new Date(entry.createdAt).toLocaleString()}`;
    const files = element('div', { class: 'file' });
    files.textContent = entry.files.join(', ');
    copy.append(files);
    row.append(copy);
    if (entry.status === 'committed') {
      const restore = element('button', {
        class: 'secondary history-restore',
        type: 'button',
        'aria-label': `Restore saved changes in ${entry.files.join(', ')}`,
      });
      restore.textContent = 'Restore';
      restore.addEventListener('click', () => onRestore(entry));
      row.append(restore);
    }
    container.append(row);
  }
}

export function renderFileDiffPanel(container: HTMLElement, diffs: FileDiff[]): void {
  container.replaceChildren();
  for (const diff of diffs) {
    const file = element('section', { class: 'file-diff' });
    const heading = element('h3');
    heading.textContent = diff.filePath;
    const code = element('div', { class: 'diff-code', role: 'table' });
    for (const line of diff.lines) {
      const row = element('div', { class: `diff-line ${line.kind}`, role: 'row' });
      const marker = element('span', { class: 'diff-marker', 'aria-hidden': 'true' });
      marker.textContent = line.kind === 'remove' ? '−' : line.kind === 'add' ? '+' : ' ';
      const number = element('span', { class: 'diff-number', 'aria-hidden': 'true' });
      number.textContent = String(line.oldLine ?? line.newLine ?? '');
      const text = element('span', { class: 'diff-text' });
      text.textContent = line.text || ' ';
      const meaning = line.kind === 'remove' ? 'Removed: ' : line.kind === 'add' ? 'Added: ' : '';
      text.setAttribute('aria-label', `${meaning}${line.text}`);
      row.append(marker, number, text);
      code.append(row);
    }
    file.append(heading, code);
    container.append(file);
  }
}
