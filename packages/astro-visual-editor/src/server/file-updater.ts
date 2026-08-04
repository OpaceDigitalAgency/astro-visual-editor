import type { NormalizedOptions } from '../options.js';
import type { EditorChange } from '../shared/types.js';
import { TransactionManager } from './transaction-manager.js';

/**
 * Compatibility helper used by tests and programmatic consumers. Integrations
 * should keep one TransactionManager instance so receipts and reverts survive HMR.
 */
export async function applyChangeBatch(
  projectRoot: string,
  sourceRoot: string,
  changes: EditorChange[],
  options: NormalizedOptions,
): Promise<{ files: string[]; changeCount: number; receiptId: string }> {
  const manager = new TransactionManager(projectRoot, sourceRoot, options);
  const response = await manager.save({
    clientId: 'compatibility-client',
    requestId: crypto.randomUUID(),
    changes,
  });
  if (!response.success) throw new Error(response.error);
  return {
    files: response.files ?? [],
    changeCount: response.changeCount ?? 0,
    receiptId: response.receiptId!,
  };
}
