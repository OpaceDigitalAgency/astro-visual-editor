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
  SeoCapabilitiesRequest,
  SeoCapabilitiesResponse,
  SessionRestoreResponse,
} from '../shared/types.js';
import { applyChangeWithAdapter, describeSeoCapabilitiesWithAdapter } from './adapters/index.js';
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

interface SessionBaselineFile {
  displayPath: string;
  /** File contents before this session's first successful save touched it. */
  source: string;
  /** Hash of the file after this session's most recent save or revert. */
  lastAfterHash: string;
}

interface SessionBaseline {
  createdAt: number;
  updatedAt: number;
  files: Map<string, SessionBaselineFile>;
}

interface PersistedSession {
  clientId: string;
  createdAt: number;
  updatedAt: number;
  files: Array<[string, SessionBaselineFile]>;
}

interface PersistedHistory {
  version: 1;
  receipts: PersistedReceipt[];
  checksum: string;
  /** Optional so histories written before session restore still load. */
  sessions?: PersistedSession[];
  sessionsChecksum?: string;
}

/** Session baselines outlive individual receipts so "restore session start"
 *  keeps working after the receipt TTL; a day comfortably covers a session. */
const SESSION_BASELINE_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_BASELINE_LIMIT = 20;

interface PreparedBatch {
  changesHash: string;
  snapshots: Map<string, SourceSnapshot>;
  outputs: Map<string, string>;
}

class ChangePreparationError extends Error {
  constructor(
    message: string,
    readonly changeId: string,
  ) {
    super(message);
    this.name = 'ChangePreparationError';
  }
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

/**
 * A structured-array reorder changes the index every sibling text edit was
 * queued against, because the rendered page addresses array entries by
 * position (`evidence.0.value`). The entries themselves move intact, so a
 * batch that reorders and edits the same array is safe as long as each text
 * path is remapped through the reorder's own permutation. Without this, the
 * adapter's stale-value check correctly refuses the batch — safe, but it
 * rejects an entirely reasonable user action.
 */
function remapStructuredTextPaths(changes: EditorChange[]): EditorChange[] {
  const remaps: Array<{ arrayPath: string; map: Map<number, number> }> = [];
  for (const change of changes) {
    if (change.kind !== 'sections') continue;
    const match = change.sourcePath?.match(/^(?:json|yaml):array:(.+)$/u);
    if (!match) continue;
    const map = new Map<number, number>();
    change.before.forEach((item, oldIndex) => {
      if (!item.sourceKey) return;
      const newIndex = change.after.findIndex((entry) => entry.sourceKey === item.sourceKey);
      if (newIndex >= 0) map.set(oldIndex, newIndex);
    });
    remaps.push({ arrayPath: match[1]!, map });
  }
  if (remaps.length === 0) return changes;
  return changes.map((change) => {
    if (change.kind !== 'text' || !change.sourcePath) return change;
    let sourcePath = change.sourcePath;
    for (const { arrayPath, map } of remaps) {
      const prefix = `${arrayPath}.`;
      if (!sourcePath.startsWith(prefix)) continue;
      const [head, ...tail] = sourcePath.slice(prefix.length).split('.');
      const oldIndex = Number(head);
      if (!Number.isInteger(oldIndex)) continue;
      const newIndex = map.get(oldIndex);
      if (newIndex === undefined || newIndex === oldIndex) continue;
      sourcePath = [arrayPath, String(newIndex), ...tail].join('.');
    }
    return sourcePath === change.sourcePath ? change : { ...change, sourcePath };
  });
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
  private sessions = new Map<string, SessionBaseline>();
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
    const sessionCutoff = Date.now() - SESSION_BASELINE_TTL_MS;
    for (const [clientId, session] of this.sessions) {
      if (session.updatedAt < sessionCutoff || session.files.size === 0) {
        this.sessions.delete(clientId);
        changed = true;
      }
    }
    while (this.sessions.size > SESSION_BASELINE_LIMIT) {
      const oldest = [...this.sessions.entries()].sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt,
      )[0];
      if (!oldest) break;
      this.sessions.delete(oldest[0]);
      changed = true;
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
    // Sessions are validated with their own checksum so a history written by
    // an earlier version (no sessions field) still loads its receipts.
    if (
      Array.isArray(stored.sessions) &&
      stored.sessionsChecksum ===
        createHash('sha256').update(JSON.stringify(stored.sessions)).digest('hex')
    ) {
      for (const item of stored.sessions) {
        if (
          typeof item.clientId !== 'string' ||
          !Number.isFinite(item.createdAt) ||
          !Number.isFinite(item.updatedAt) ||
          !Array.isArray(item.files)
        )
          continue;
        const files = new Map(
          item.files.filter(
            ([path, file]) =>
              typeof path === 'string' &&
              within(this.sourceRoot, resolve(path)) &&
              typeof file?.displayPath === 'string' &&
              typeof file?.source === 'string' &&
              typeof file?.lastAfterHash === 'string',
          ),
        );
        if (files.size === 0) continue;
        this.sessions.set(item.clientId, {
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          files,
        });
      }
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
    const sessions: PersistedSession[] = [...this.sessions.entries()].map(
      ([clientId, session]) => ({
        clientId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        files: [...session.files],
      }),
    );
    const contents = JSON.stringify({
      version: 1,
      receipts,
      checksum: checksum(receipts),
      sessions,
      sessionsChecksum: createHash('sha256').update(JSON.stringify(sessions)).digest('hex'),
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

  async seoCapabilities(request: SeoCapabilitiesRequest): Promise<SeoCapabilitiesResponse> {
    const base = { clientId: request.clientId, requestId: request.requestId };
    try {
      const snapshot = await readSourceSnapshot(
        this.projectRoot,
        this.sourceRoot,
        request.filePath,
        this.options,
      );
      return {
        ...base,
        success: true,
        filePath: request.filePath,
        fields: await describeSeoCapabilitiesWithAdapter(
          snapshot.source,
          snapshot.extension,
          snapshot.displayPath,
        ),
      };
    } catch (error) {
      return {
        ...base,
        success: false,
        filePath: request.filePath,
        error: error instanceof Error ? error.message : 'Unknown SEO capabilities error.',
      };
    }
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
        ...(error instanceof ChangePreparationError ? { failedChangeId: error.changeId } : {}),
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
          ...(error instanceof ChangePreparationError ? { failedChangeId: error.changeId } : {}),
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
    if (response.success && before.size > 0) {
      // Capture the session baseline: the first save to touch a file keeps
      // that file's pre-session contents; later saves only advance the hash
      // the restore uses to prove nothing changed outside the editor.
      const clientId = key.split('\0')[0] ?? key;
      const session = this.sessions.get(clientId) ?? {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        files: new Map<string, SessionBaselineFile>(),
      };
      for (const [fullPath, previous] of before) {
        const lastAfterHash = afterHashes.get(fullPath);
        if (!lastAfterHash) continue;
        const entry = session.files.get(fullPath);
        if (entry) entry.lastAfterHash = lastAfterHash;
        else
          session.files.set(fullPath, {
            displayPath: previous.displayPath,
            source: previous.source,
            lastAfterHash,
          });
      }
      session.updatedAt = Date.now();
      this.sessions.set(clientId, session);
    }
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
      const sorted = remapStructuredTextPaths(
        [...fileChanges].sort((a, b) => {
          const priority = operationPriority(a) - operationPriority(b);
          if (priority !== 0 || a.kind !== 'text' || b.kind !== 'text') return priority;
          return snapshot.source.indexOf(b.oldText) - snapshot.source.indexOf(a.oldText);
        }),
      );
      for (const change of sorted) {
        try {
          next = await applyChangeWithAdapter(next, snapshot.extension, change, this.options);
        } catch (error) {
          throw new ChangePreparationError(
            error instanceof Error ? error.message : 'This change could not be prepared safely.',
            change.id,
          );
        }
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
      // Keep the session baseline honest: after a revert the file on disk is
      // the receipt's "before", so that hash is what a later session restore
      // must match.
      const session = this.sessions.get(clientId);
      const entry = session?.files.get(fullPath);
      if (session && entry) {
        entry.lastAfterHash = hashSource(previous.source);
        session.updatedAt = Date.now();
      }
    }
    receipt.reverted = true;
    await this.persist();
    return { ...responseBase, success: true, files: restored };
  }

  /** Whether this session has anything a "restore session start" could rewind. */
  async sessionState(clientId: string): Promise<{ available: boolean; files: string[] }> {
    await this.load();
    const session = this.sessions.get(clientId);
    if (!session || session.files.size === 0) return { available: false, files: [] };
    const files: string[] = [];
    for (const [fullPath, entry] of session.files) {
      const current = await readFile(fullPath, 'utf8').catch(() => undefined);
      if (current !== undefined && hashSource(current) !== hashSource(entry.source)) {
        files.push(entry.displayPath);
      }
    }
    return { available: files.length > 0, files };
  }

  /** Rewind every file this session saved to its state before the first save. */
  async restoreSession(clientId: string, requestId: string): Promise<SessionRestoreResponse> {
    await this.load();
    const responseBase = { clientId, requestId };
    let release!: () => void;
    const previous = this.lock;
    this.lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      const session = this.sessions.get(clientId);
      if (!session || session.files.size === 0) {
        return {
          ...responseBase,
          success: false,
          error: 'Nothing to restore: this session has no saved changes.',
        };
      }
      // Two-phase, like save: prove every file is exactly where the editor
      // left it before writing anything, so outside work is never destroyed.
      const pending: Array<[string, SessionBaselineFile]> = [];
      for (const [fullPath, entry] of session.files) {
        const current = await readFile(fullPath, 'utf8').catch(() => undefined);
        if (current === undefined) {
          return {
            ...responseBase,
            success: false,
            error: `Restore refused: ${entry.displayPath} no longer exists.`,
          };
        }
        const currentHash = hashSource(current);
        if (currentHash === hashSource(entry.source)) continue;
        if (currentHash !== entry.lastAfterHash) {
          return {
            ...responseBase,
            success: false,
            error: `Restore refused: ${entry.displayPath} changed outside the editor after this session's last save. Newer work is protected.`,
          };
        }
        pending.push([fullPath, entry]);
      }
      if (pending.length === 0) {
        this.sessions.delete(clientId);
        await this.persist();
        return {
          ...responseBase,
          success: false,
          error: 'Everything is already back to how this session started.',
        };
      }
      const restored: string[] = [];
      const written: Array<[string, string]> = [];
      try {
        for (const [fullPath, entry] of pending) {
          const current = await readFile(fullPath, 'utf8');
          await atomicWrite(fullPath, entry.source);
          written.push([fullPath, current]);
          restored.push(entry.displayPath);
        }
      } catch (error) {
        await Promise.allSettled(
          written.map(([fullPath, contents]) => atomicWrite(fullPath, contents)),
        );
        throw error;
      }
      // The session is back at its start: drop the baseline and retire this
      // client's receipts so History cannot re-apply intermediate states.
      this.sessions.delete(clientId);
      for (const receipt of this.receipts.values()) {
        if (receipt.response.clientId === clientId) receipt.reverted = true;
      }
      await this.persist();
      return { ...responseBase, success: true, files: restored };
    } catch (error) {
      return {
        ...responseBase,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown session restore error.',
      };
    } finally {
      release();
    }
  }
}
