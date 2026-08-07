import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import type { NormalizedOptions } from '../options.js';
import type {
  ApplyBatchResult,
  EditorChange,
  FileDiff,
  HistoryEntry,
  PreviewResponse,
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

interface PersistedReceipt {
  key: string;
  createdAt: number;
  response: SaveResponse;
  before: Array<[string, { displayPath: string; source: string }]>;
  afterHashes: Array<[string, string]>;
  reverted: boolean;
}

interface PersistedHistory {
  version: 1;
  receipts: PersistedReceipt[];
  checksum: string;
}

interface PreparedBatch {
  changesHash: string;
  snapshots: Map<string, SourceSnapshot>;
  outputs: Map<string, string>;
}

function requestKey(clientId: string, requestId: string): string {
  return `${clientId}\0${requestId}`;
}

function operationPriority(change: EditorChange): number {
  // Structural edits must create newly-added template markup before a text
  // change can target content inside it. Text and SEO changes can then use the
  // updated, still-in-memory source while the batch remains atomic.
  if (change.kind === 'sections') return 0;
  if (change.kind === 'text') return 1;
  return 2;
}

function safeTempPath(fullPath: string): string {
  return join(dirname(fullPath), `.astro-visual-editor-${randomUUID()}.tmp`);
}

function checksum(receipts: PersistedReceipt[]): string {
  return createHash('sha256').update(JSON.stringify(receipts)).digest('hex');
}

function hashChanges(changes: EditorChange[]): string {
  return createHash('sha256').update(JSON.stringify(changes)).digest('hex');
}

function exactDiff(snapshot: SourceSnapshot, output: string): FileDiff {
  const before = snapshot.source.split('\n');
  const after = output.split('\n');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const contextStart = Math.max(0, prefix - 3);
  const beforeEnd = before.length - suffix;
  const afterEnd = after.length - suffix;
  const contextEnd = Math.min(before.length, beforeEnd + 3);
  return {
    filePath: snapshot.displayPath,
    beforeHash: snapshot.hash,
    afterHash: hashSource(output),
    lines: [
      ...before.slice(contextStart, prefix).map((text, index) => ({
        kind: 'context' as const,
        text,
        oldLine: contextStart + index + 1,
        newLine: contextStart + index + 1,
      })),
      ...before.slice(prefix, beforeEnd).map((text, index) => ({
        kind: 'remove' as const,
        text,
        oldLine: prefix + index + 1,
      })),
      ...after.slice(prefix, afterEnd).map((text, index) => ({
        kind: 'add' as const,
        text,
        newLine: prefix + index + 1,
      })),
      ...before.slice(beforeEnd, contextEnd).map((text, index) => ({
        kind: 'context' as const,
        text,
        oldLine: beforeEnd + index + 1,
        newLine: afterEnd + index + 1,
      })),
    ],
  };
}

function within(root: string, candidate: string): boolean {
  const normalize = (value: string): string => resolve(value).replace(/^\/private(?=\/)/u, '');
  const path = relative(normalize(root), normalize(candidate));
  return (
    path === '' ||
    (!path.startsWith('..') && !path.includes(`..${process.platform === 'win32' ? '\\' : '/'}`))
  );
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
  private loaded = false;
  private previews = new Map<string, PreparedBatch>();

  constructor(
    private readonly projectRoot: string,
    private readonly sourceRoot: string,
    private readonly options: NormalizedOptions,
  ) {}

  private historyPath(): string {
    return join(this.projectRoot, '.astro-visual-editor', 'receipts.json');
  }

  private prune(): boolean {
    let changed = false;
    const cutoff = Date.now() - this.options.receiptTtlMs;
    for (const [key, receipt] of this.receipts) {
      if (receipt.createdAt < cutoff) {
        this.receipts.delete(key);
        changed = true;
      }
    }
    const orderLength = this.receiptOrder.length;
    this.receiptOrder = this.receiptOrder.filter((key) => this.receipts.has(key));
    changed ||= this.receiptOrder.length !== orderLength;
    while (this.receiptOrder.length > this.options.historyLimit) {
      const key = this.receiptOrder.shift();
      if (key) {
        this.receipts.delete(key);
        changed = true;
      }
    }
    return changed;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    let raw: string;
    try {
      raw = await readFile(this.historyPath(), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    let stored: PersistedHistory;
    try {
      stored = JSON.parse(raw) as PersistedHistory;
    } catch {
      return;
    }
    if (
      stored.version !== 1 ||
      !Array.isArray(stored.receipts) ||
      stored.checksum !== checksum(stored.receipts)
    ) {
      return;
    }
    for (const item of stored.receipts) {
      if (
        typeof item.key !== 'string' ||
        !Number.isFinite(item.createdAt) ||
        !item.response?.success ||
        typeof item.response.receiptId !== 'string' ||
        !Array.isArray(item.before) ||
        !Array.isArray(item.afterHashes)
      )
        continue;
      const before = new Map(
        item.before.filter(
          ([path]) => typeof path === 'string' && within(this.sourceRoot, resolve(path)),
        ),
      );
      const afterHashes = new Map(
        item.afterHashes.filter(
          ([path, hash]) =>
            typeof path === 'string' &&
            typeof hash === 'string' &&
            within(this.sourceRoot, resolve(path)),
        ),
      );
      if (before.size === 0 || afterHashes.size === 0) continue;
      this.receipts.set(item.key, {
        createdAt: item.createdAt,
        response: item.response,
        before,
        afterHashes,
        reverted: item.reverted === true,
      });
      this.receiptOrder.push(item.key);
    }
    if (this.prune()) await this.persist();
  }

  private async persist(): Promise<void> {
    const receipts: PersistedReceipt[] = this.receiptOrder.flatMap((key) => {
      const receipt = this.receipts.get(key);
      return receipt
        ? [
            {
              key,
              createdAt: receipt.createdAt,
              response: receipt.response,
              before: [...receipt.before],
              afterHashes: [...receipt.afterHashes],
              reverted: receipt.reverted,
            },
          ]
        : [];
    });
    const contents = JSON.stringify({
      version: 1,
      receipts,
      checksum: checksum(receipts),
    } satisfies PersistedHistory);
    const file = this.historyPath();
    await mkdir(dirname(file), { recursive: true });
    await atomicWrite(file, contents);
  }

  async getReceipt(clientId: string, requestId: string): Promise<SaveResponse | undefined> {
    await this.load();
    if (this.prune()) await this.persist();
    return this.receipts.get(requestKey(clientId, requestId))?.response;
  }

  async history(): Promise<HistoryEntry[]> {
    await this.load();
    if (this.prune()) await this.persist();
    return [...this.receiptOrder].reverse().flatMap((key) => {
      const receipt = this.receipts.get(key);
      if (!receipt?.response.success || !receipt.response.receiptId) return [];
      return [
        {
          receiptId: receipt.response.receiptId,
          createdAt: receipt.createdAt,
          files: receipt.response.files ?? [],
          changeCount: receipt.response.changeCount ?? 0,
          status: receipt.reverted ? 'reverted' : 'committed',
        },
      ];
    });
  }

  async preview(request: SaveRequest): Promise<PreviewResponse> {
    await this.load();
    try {
      const prepared = await this.prepare(request.changes);
      this.previews.set(requestKey(request.clientId, request.requestId), prepared);
      while (this.previews.size > this.options.historyLimit) {
        const oldest = this.previews.keys().next().value;
        if (typeof oldest === 'string') this.previews.delete(oldest);
      }
      return {
        clientId: request.clientId,
        requestId: request.requestId,
        success: true,
        diffs: [...prepared.snapshots].map(([fullPath, snapshot]) =>
          exactDiff(snapshot, prepared.outputs.get(fullPath)!),
        ),
      };
    } catch (error) {
      return {
        clientId: request.clientId,
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown preview error.',
      };
    }
  }

  async save(request: SaveRequest): Promise<SaveResponse> {
    await this.load();
    const key = requestKey(request.clientId, request.requestId);
    const existing = await this.getReceipt(request.clientId, request.requestId);
    if (existing) return existing;

    let release!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const repeated = await this.getReceipt(request.clientId, request.requestId);
      if (repeated) return repeated;
      try {
        const preview = this.previews.get(key);
        const prepared =
          preview?.changesHash === hashChanges(request.changes)
            ? preview
            : await this.prepare(request.changes);
        this.previews.delete(key);
        const result = await this.apply(prepared, request.changes.length);
        const response: SaveResponse = {
          clientId: request.clientId,
          requestId: request.requestId,
          success: true,
          ...result.result,
        };
        await this.storeReceipt(key, response, result.before, result.afterHashes);
        return response;
      } catch (error) {
        const response: SaveResponse = {
          clientId: request.clientId,
          requestId: request.requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown save error.',
        };
        await this.storeReceipt(key, response, new Map(), new Map());
        return response;
      }
    } finally {
      release();
    }
  }

  private async storeReceipt(
    key: string,
    response: SaveResponse,
    before: Receipt['before'],
    afterHashes: Receipt['afterHashes'],
  ): Promise<void> {
    this.receipts.set(key, {
      createdAt: Date.now(),
      response,
      before,
      afterHashes,
      reverted: false,
    });
    this.receiptOrder.push(key);
    this.prune();
    await this.persist();
  }

  private async prepare(changes: EditorChange[]): Promise<PreparedBatch> {
    if (changes.length === 0) throw new Error('At least one queued change is required.');
    if (changes.length > this.options.maxChanges) {
      throw new Error(`A batch cannot contain more than ${this.options.maxChanges} changes.`);
    }
    for (const change of changes) {
      if (change.kind === 'text') {
        if (!change.oldText || !change.newText)
          throw new Error('Text changes require oldText and newText.');
        if (change.newText.length > this.options.maxTextLength) {
          throw new Error(`Edited text exceeds the ${this.options.maxTextLength}-character limit.`);
        }
        if (change.newText.includes('\0'))
          throw new Error('Edited text cannot contain a null byte.');
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
    return { changesHash: hashChanges(changes), snapshots, outputs };
  }

  private async apply(
    prepared: PreparedBatch,
    changeCount: number,
  ): Promise<{
    result: ApplyBatchResult;
    before: Receipt['before'];
    afterHashes: Receipt['afterHashes'];
  }> {
    const { snapshots, outputs } = prepared;

    for (const snapshot of snapshots.values()) {
      const latest = await readFile(snapshot.fullPath, 'utf8');
      if (hashSource(latest) !== snapshot.hash) {
        throw new Error(
          `Source changed during validation: ${snapshot.displayPath}. Retry the batch.`,
        );
      }
    }

    const written: SourceSnapshot[] = [];
    try {
      for (const snapshot of snapshots.values()) {
        await atomicWrite(snapshot.fullPath, outputs.get(snapshot.fullPath)!);
        written.push(snapshot);
      }
    } catch (error) {
      await Promise.allSettled(
        written.map((snapshot) => atomicWrite(snapshot.fullPath, snapshot.source)),
      );
      throw error;
    }

    const receiptId = randomUUID();
    return {
      result: {
        files: [...snapshots.values()].map((snapshot) => snapshot.displayPath),
        changeCount,
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

  async revert(clientId: string, requestId: string, receiptId: string): Promise<RevertResponse> {
    await this.load();
    const responseBase = { clientId, requestId, receiptId };
    const receipt = [...this.receipts.values()].find(
      (item) => item.response.receiptId === receiptId && item.response.clientId === clientId,
    );
    if (!receipt || !receipt.response.success) {
      return {
        ...responseBase,
        success: false,
        error: 'Commit receipt is unavailable or expired.',
      };
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
          error:
            'A committed file changed after this receipt. Revert was refused to protect newer work.',
        };
      }
    }
    const restored: string[] = [];
    for (const [fullPath, previous] of receipt.before) {
      await atomicWrite(fullPath, previous.source);
      restored.push(previous.displayPath);
    }
    receipt.reverted = true;
    await this.persist();
    return { ...responseBase, success: true, files: restored };
  }
}
