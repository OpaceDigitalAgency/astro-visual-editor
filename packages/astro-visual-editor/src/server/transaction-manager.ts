import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { NormalizedOptions } from '../options.js';
import type {
  ApplyBatchResult,
  EditorChange,
  RevertResponse,
  SaveRequest,
  SaveResponse,
} from '../shared/types.js';
import { applyChangeWithAdapter } from './adapters/index.js';
import { hashSource, readSourceSnapshot, type SourceSnapshot } from './source-files.js';

interface Receipt {
  createdAt: number;
  response: SaveResponse;
  before: Map<string, { displayPath: string; source: string }>;
  afterHashes: Map<string, string>;
  reverted: boolean;
}

function requestKey(clientId: string, requestId: string): string {
  return `${clientId}\0${requestId}`;
}

function operationPriority(change: EditorChange): number {
  if (change.kind === 'text') return 0;
  if (change.kind === 'seo') return 1;
  return 2;
}

function safeTempPath(fullPath: string): string {
  return join(dirname(fullPath), `.astro-visual-editor-${randomUUID()}.tmp`);
}

async function atomicWrite(fullPath: string, source: string): Promise<void> {
  const temp = safeTempPath(fullPath);
  try {
    await writeFile(temp, source, { encoding: 'utf8', flag: 'wx' });
    await rename(temp, fullPath);
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
}

export class TransactionManager {
  private receipts = new Map<string, Receipt>();
  private receiptOrder: string[] = [];
  private lock: Promise<void> = Promise.resolve();

  constructor(
    private readonly projectRoot: string,
    private readonly sourceRoot: string,
    private readonly options: NormalizedOptions,
  ) {}

  private prune(): void {
    const cutoff = Date.now() - this.options.receiptTtlMs;
    for (const [key, receipt] of this.receipts) {
      if (receipt.createdAt < cutoff) this.receipts.delete(key);
    }
    this.receiptOrder = this.receiptOrder.filter((key) => this.receipts.has(key));
    while (this.receiptOrder.length > this.options.historyLimit) {
      const key = this.receiptOrder.shift();
      if (key) this.receipts.delete(key);
    }
  }

  getReceipt(clientId: string, requestId: string): SaveResponse | undefined {
    this.prune();
    return this.receipts.get(requestKey(clientId, requestId))?.response;
  }

  async save(request: SaveRequest): Promise<SaveResponse> {
    const key = requestKey(request.clientId, request.requestId);
    const existing = this.getReceipt(request.clientId, request.requestId);
    if (existing) return existing;

    let release!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const repeated = this.getReceipt(request.clientId, request.requestId);
      if (repeated) return repeated;
      try {
        const result = await this.apply(request.changes);
        const response: SaveResponse = {
          clientId: request.clientId,
          requestId: request.requestId,
          success: true,
          ...result.result,
        };
        this.storeReceipt(key, response, result.before, result.afterHashes);
        return response;
      } catch (error) {
        const response: SaveResponse = {
          clientId: request.clientId,
          requestId: request.requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown save error.',
        };
        this.storeReceipt(key, response, new Map(), new Map());
        return response;
      }
    } finally {
      release();
    }
  }

  private storeReceipt(
    key: string,
    response: SaveResponse,
    before: Receipt['before'],
    afterHashes: Receipt['afterHashes'],
  ): void {
    this.receipts.set(key, { createdAt: Date.now(), response, before, afterHashes, reverted: false });
    this.receiptOrder.push(key);
    this.prune();
  }

  private async apply(changes: EditorChange[]): Promise<{
    result: ApplyBatchResult;
    before: Receipt['before'];
    afterHashes: Receipt['afterHashes'];
  }> {
    if (changes.length === 0) throw new Error('At least one queued change is required.');
    if (changes.length > this.options.maxChanges) {
      throw new Error(`A batch cannot contain more than ${this.options.maxChanges} changes.`);
    }
    for (const change of changes) {
      if (change.kind === 'text') {
        if (!change.oldText || !change.newText) throw new Error('Text changes require oldText and newText.');
        if (change.newText.length > this.options.maxTextLength) {
          throw new Error(`Edited text exceeds the ${this.options.maxTextLength}-character limit.`);
        }
        if (change.newText.includes('\0')) throw new Error('Edited text cannot contain a null byte.');
      }
    }
    const byPath = new Map<string, EditorChange[]>();
    for (const change of changes) {
      const list = byPath.get(change.filePath) ?? [];
      list.push(change);
      byPath.set(change.filePath, list);
    }

    const snapshots = new Map<string, SourceSnapshot>();
    const outputs = new Map<string, string>();
    for (const [filePath, fileChanges] of byPath) {
      const snapshot = await readSourceSnapshot(
        this.projectRoot,
        this.sourceRoot,
        filePath,
        this.options,
      );
      snapshots.set(snapshot.fullPath, snapshot);
      let next = snapshot.source;
      const sorted = [...fileChanges].sort((a, b) => {
        const priority = operationPriority(a) - operationPriority(b);
        if (priority !== 0 || a.kind !== 'text' || b.kind !== 'text') return priority;
        return snapshot.source.indexOf(b.oldText) - snapshot.source.indexOf(a.oldText);
      });
      for (const change of sorted) {
        next = await applyChangeWithAdapter(next, snapshot.extension, change, this.options);
      }
      outputs.set(snapshot.fullPath, next);
    }

    for (const snapshot of snapshots.values()) {
      const latest = await readFile(snapshot.fullPath, 'utf8');
      if (hashSource(latest) !== snapshot.hash) {
        throw new Error(`Source changed during validation: ${snapshot.displayPath}. Retry the batch.`);
      }
    }

    const written: SourceSnapshot[] = [];
    try {
      for (const snapshot of snapshots.values()) {
        await atomicWrite(snapshot.fullPath, outputs.get(snapshot.fullPath)!);
        written.push(snapshot);
      }
    } catch (error) {
      await Promise.allSettled(written.map((snapshot) => atomicWrite(snapshot.fullPath, snapshot.source)));
      throw error;
    }

    const receiptId = randomUUID();
    return {
      result: {
        files: [...snapshots.values()].map((snapshot) => snapshot.displayPath),
        changeCount: changes.length,
        receiptId,
      },
      before: new Map(
        [...snapshots.values()].map((snapshot) => [
          snapshot.fullPath,
          { displayPath: snapshot.displayPath, source: snapshot.source },
        ]),
      ),
      afterHashes: new Map(
        [...outputs].map(([fullPath, source]) => [fullPath, hashSource(source)]),
      ),
    };
  }

  async revert(
    clientId: string,
    requestId: string,
    receiptId: string,
  ): Promise<RevertResponse> {
    const responseBase = { clientId, requestId, receiptId };
    const receipt = [...this.receipts.values()].find(
      (item) => item.response.receiptId === receiptId && item.response.clientId === clientId,
    );
    if (!receipt || !receipt.response.success) {
      return { ...responseBase, success: false, error: 'Commit receipt is unavailable or expired.' };
    }
    if (receipt.reverted) {
      return { ...responseBase, success: false, error: 'This commit has already been reverted.' };
    }
    for (const [fullPath, expectedHash] of receipt.afterHashes) {
      const current = await readFile(fullPath, 'utf8');
      if (hashSource(current) !== expectedHash) {
        return {
          ...responseBase,
          success: false,
          error: 'A committed file changed after this receipt. Revert was refused to protect newer work.',
        };
      }
    }
    const restored: string[] = [];
    for (const [fullPath, previous] of receipt.before) {
      await atomicWrite(fullPath, previous.source);
      restored.push(previous.displayPath);
    }
    receipt.reverted = true;
    return { ...responseBase, success: true, files: restored };
  }
}
