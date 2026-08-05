import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import type { NormalizedOptions } from '../options.js';
import type {
  EditabilityPolicy,
  EditabilityPolicyChangeRequest,
  EditabilityPolicyResponse,
  FileDiff,
} from '../shared/types.js';

const emptyPolicy: EditabilityPolicy = { version: 1, rules: [] };

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function within(root: string, candidate: string): boolean {
  const path = relative(resolve(root), resolve(candidate));
  return (
    path === '' ||
    (!path.startsWith('..') && !path.includes(`..${process.platform === 'win32' ? '\\' : '/'}`))
  );
}

function policySource(policy: EditabilityPolicy): string {
  return `${JSON.stringify(policy, null, 2)}\n`;
}

function exactDiff(filePath: string, beforeSource: string, afterSource: string): FileDiff {
  const before = beforeSource.split('\n');
  const after = afterSource.split('\n');
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix])
    prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix += 1;
  const beforeEnd = before.length - suffix;
  const afterEnd = after.length - suffix;
  return {
    filePath,
    beforeHash: hash(beforeSource),
    afterHash: hash(afterSource),
    lines: [
      ...before.slice(Math.max(0, prefix - 2), prefix).map((text, index) => ({
        kind: 'context' as const,
        text,
        oldLine: Math.max(0, prefix - 2) + index + 1,
        newLine: Math.max(0, prefix - 2) + index + 1,
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
      ...before.slice(beforeEnd, Math.min(before.length, beforeEnd + 2)).map((text, index) => ({
        kind: 'context' as const,
        text,
        oldLine: beforeEnd + index + 1,
        newLine: afterEnd + index + 1,
      })),
    ],
  };
}

async function atomicWrite(fullPath: string, source: string): Promise<void> {
  const tempPath = resolve(dirname(fullPath), `.astro-visual-editor-policy-${randomUUID()}.tmp`);
  try {
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(tempPath, source, { encoding: 'utf8', flag: 'wx' });
    await rename(tempPath, fullPath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export class EditabilityPolicyManager {
  private readonly policyPath: string;
  private readonly previews = new Map<string, { expectedHash: string; nextHash: string }>();

  constructor(
    private readonly projectRoot: string,
    private readonly options: NormalizedOptions,
  ) {
    this.policyPath = resolve(projectRoot, options.editabilityPolicyFile);
    if (!within(projectRoot, this.policyPath)) {
      throw new Error('Editability policy path escapes the project root.');
    }
  }

  private validate(policy: EditabilityPolicy): EditabilityPolicy {
    if (policy.version !== 1 || !Array.isArray(policy.rules) || policy.rules.length > 500) {
      throw new Error('Editability policy must use version 1 with no more than 500 rules.');
    }
    const ids = new Set<string>();
    const targets = new Map<string, string>();
    for (const rule of policy.rules) {
      if (!/^[a-z0-9][a-z0-9-]{0,199}$/u.test(rule.id) || ids.has(rule.id)) {
        throw new Error(`Editability rule id is invalid or duplicated: ${rule.id}`);
      }
      if (
        !['allow', 'deny'].includes(rule.effect) ||
        !['element', 'selector'].includes(rule.scope)
      ) {
        throw new Error(`Editability rule ${rule.id} has an invalid effect or scope.`);
      }
      if (!rule.route.startsWith('/') || rule.route.length > 4_096) {
        throw new Error(`Editability rule ${rule.id} has an invalid route.`);
      }
      if (
        !rule.selector.trim() ||
        rule.selector.length > 2_000 ||
        /[\0\r\n]/u.test(rule.selector)
      ) {
        throw new Error(`Editability rule ${rule.id} has an invalid selector.`);
      }
      if (rule.filePath) {
        if (
          rule.filePath.startsWith('/') ||
          rule.filePath.split(/[\\/]/u).includes('..') ||
          !this.options.allowedExtensions.includes(extname(rule.filePath) as never)
        ) {
          throw new Error(`Editability rule ${rule.id} has an unsafe source file.`);
        }
      }
      if (rule.sourcePath && /[\0\r\n]/u.test(rule.sourcePath)) {
        throw new Error(`Editability rule ${rule.id} has an invalid structured path.`);
      }
      const target = `${rule.route}\0${rule.selector}`;
      const previous = targets.get(target);
      if (previous) {
        throw new Error(`Editability rules ${previous} and ${rule.id} target the same element.`);
      }
      ids.add(rule.id);
      targets.set(target, rule.id);
    }
    return structuredClone(policy);
  }

  private async assertSafePath(): Promise<void> {
    const projectReal = await realpath(this.projectRoot);
    const parentReal = await realpath(dirname(this.policyPath)).catch(() => projectReal);
    if (!within(projectReal, parentReal))
      throw new Error('Editability policy directory escapes the project root.');
    const stat = await lstat(this.policyPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error('Editability policy cannot be a symbolic link.');
    if (stat && stat.size > this.options.maxRequestBytes) {
      throw new Error(`Editability policy exceeds the ${this.options.maxRequestBytes}-byte limit.`);
    }
  }

  private async readCurrent(): Promise<{
    policy: EditabilityPolicy;
    source: string;
    policyHash: string;
  }> {
    await this.assertSafePath();
    let source = '';
    try {
      source = await readFile(this.policyPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!source) return { policy: structuredClone(emptyPolicy), source, policyHash: hash(source) };
    let parsed: EditabilityPolicy;
    try {
      parsed = JSON.parse(source) as EditabilityPolicy;
    } catch {
      throw new Error(`${this.options.editabilityPolicyFile} is not valid JSON.`);
    }
    return { policy: this.validate(parsed), source, policyHash: hash(source) };
  }

  async load(
    clientId: string,
    requestId: string,
    canManage: boolean,
  ): Promise<EditabilityPolicyResponse> {
    try {
      const current = await this.readCurrent();
      return {
        clientId,
        requestId,
        success: true,
        policy: current.policy,
        policyHash: current.policyHash,
        policyFile: this.options.editabilityPolicyFile,
        canManage,
      };
    } catch (error) {
      return {
        clientId,
        requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unable to load editability policy.',
      };
    }
  }

  async preview(
    request: EditabilityPolicyChangeRequest,
    canManage: boolean,
  ): Promise<EditabilityPolicyResponse> {
    try {
      if (!canManage) throw new Error('Only a local owner can change editability policy.');
      const current = await this.readCurrent();
      if (request.expectedHash !== current.policyHash) {
        throw new Error('Editability policy changed on disk. Reload Setup before saving.');
      }
      const policy = this.validate(request.policy);
      const source = policySource(policy);
      this.previews.set(`${request.clientId}\0${request.requestId}`, {
        expectedHash: request.expectedHash,
        nextHash: hash(source),
      });
      while (this.previews.size > this.options.historyLimit) {
        const oldest = this.previews.keys().next().value;
        if (typeof oldest === 'string') this.previews.delete(oldest);
      }
      return {
        clientId: request.clientId,
        requestId: request.requestId,
        success: true,
        policy,
        policyHash: hash(source),
        policyFile: this.options.editabilityPolicyFile,
        canManage,
        diff: exactDiff(this.options.editabilityPolicyFile, current.source, source),
      };
    } catch (error) {
      return {
        clientId: request.clientId,
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unable to preview editability policy.',
      };
    }
  }

  async save(
    request: EditabilityPolicyChangeRequest,
    canManage: boolean,
  ): Promise<EditabilityPolicyResponse> {
    try {
      if (!canManage) throw new Error('Only a local owner can change editability policy.');
      const current = await this.readCurrent();
      if (request.expectedHash !== current.policyHash) {
        throw new Error('Editability policy changed on disk. Reload Setup before saving.');
      }
      const policy = this.validate(request.policy);
      const source = policySource(policy);
      const previewKey = `${request.clientId}\0${request.requestId}`;
      const preview = this.previews.get(previewKey);
      if (
        !preview ||
        preview.expectedHash !== request.expectedHash ||
        preview.nextHash !== hash(source)
      ) {
        throw new Error('Review the exact editability policy diff before saving.');
      }
      await atomicWrite(this.policyPath, source);
      this.previews.delete(previewKey);
      return {
        clientId: request.clientId,
        requestId: request.requestId,
        success: true,
        policy,
        policyHash: hash(source),
        policyFile: this.options.editabilityPolicyFile,
        canManage,
      };
    } catch (error) {
      return {
        clientId: request.clientId,
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unable to save editability policy.',
      };
    }
  }
}
