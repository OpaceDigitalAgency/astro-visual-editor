import type { EditorChange } from '../shared/types.js';

function cloneChanges(changes: EditorChange[]): EditorChange[] {
  return structuredClone(changes);
}

export class ChangeHistory {
  private undoStack: EditorChange[][] = [];
  private redoStack: EditorChange[][] = [];

  constructor(private readonly limit = 50) {}

  record(current: EditorChange[]): void {
    this.undoStack.push(cloneChanges(current));
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(current: EditorChange[]): EditorChange[] | undefined {
    const previous = this.undoStack.pop();
    if (!previous) return undefined;
    this.redoStack.push(cloneChanges(current));
    return cloneChanges(previous);
  }

  redo(current: EditorChange[]): EditorChange[] | undefined {
    const next = this.redoStack.pop();
    if (!next) return undefined;
    this.undoStack.push(cloneChanges(current));
    return cloneChanges(next);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

export function changeKey(change: EditorChange): string {
  if (change.kind === 'text') return `text:${change.filePath}:${change.selector ?? change.sourcePath ?? change.id}`;
  if (change.kind === 'seo') return `seo:${change.filePath}`;
  return `sections:${change.filePath}:${change.regionId}`;
}
