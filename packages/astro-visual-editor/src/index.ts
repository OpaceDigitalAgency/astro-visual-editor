import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  normalizeOptions,
  toClientConfig,
  type AstroVisualEditorOptions,
} from './options.js';
import { parseReceiptRequest, parseRevertRequest, parseSaveRequest } from './shared/protocol.js';
import {
  APP_ID,
  CONFIG_EVENT,
  READY_EVENT,
  RECEIPT_EVENT,
  RECEIPT_RESULT_EVENT,
  REVERT_EVENT,
  REVERT_RESULT_EVENT,
  SAVE_EVENT,
  SAVE_RESULT_EVENT,
} from './shared/events.js';
import type {
  ReceiptResponse,
  RevertResponse,
  SaveResponse,
} from './shared/types.js';
import { TransactionManager } from './server/transaction-manager.js';

export type { AstroVisualEditorOptions } from './options.js';
export type {
  EditorChange,
  SectionTemplate,
  SeoValues,
} from './shared/types.js';

function isRemoteHost(host: string | boolean | undefined): boolean {
  if (host === undefined || host === false) return false;
  if (host === true) return true;
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/gu, '');
  return !['localhost', '127.0.0.1', '::1'].includes(normalized);
}

/**
 * Adds the Astro Visual Editor to Astro's development toolbar.
 * The integration registers no production runtime code or public endpoint.
 */
export default function astroVisualEditor(
  userOptions: AstroVisualEditorOptions = {},
): AstroIntegration {
  const options = normalizeOptions(userOptions);
  let projectRoot = process.cwd();
  let sourceRoot = resolve(process.cwd(), 'src');

  return {
    name: 'astro-visual-editor',
    hooks: {
      'astro:config:setup': ({ addDevToolbarApp, command }) => {
        if (!options.enabled || command !== 'dev') return;
        addDevToolbarApp({
          id: APP_ID,
          name: 'Visual Editor',
          icon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
          entrypoint: fileURLToPath(new URL('./toolbar.js', import.meta.url)),
        });
      },
      'astro:config:done': ({ config }) => {
        projectRoot = fileURLToPath(config.root);
        sourceRoot = fileURLToPath(config.srcDir);
      },
      'astro:server:setup': ({ toolbar, logger, server }) => {
        if (!options.enabled) return;
        const remote = isRemoteHost(server.config.server.host);
        const writeEnabled = !remote || options.allowRemoteDev;
        const remoteWarning = remote
          ? writeEnabled
            ? 'The dev server is network-exposed. Remote writes are explicitly enabled.'
            : 'Source writes are disabled because the dev server is network-exposed.'
          : undefined;
        const manager = new TransactionManager(projectRoot, sourceRoot, options);
        const sendConfig = () =>
          toolbar.send(CONFIG_EVENT, toClientConfig(options, writeEnabled, remoteWarning));

        toolbar.on(READY_EVENT, sendConfig);
        toolbar.onAppInitialized(APP_ID, sendConfig);

        toolbar.on(SAVE_EVENT, async (raw: unknown) => {
          let response: SaveResponse;
          try {
            const request = parseSaveRequest(raw, options.maxChanges, options.maxRequestBytes);
            if (!writeEnabled) {
              response = {
                clientId: request.clientId,
                requestId: request.requestId,
                success: false,
                error: remoteWarning,
              };
            } else {
              response = await manager.save(request);
            }
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown save error.',
            };
          }
          if (response.success) {
            logger.info(
              `Wrote ${response.changeCount} visual edit${response.changeCount === 1 ? '' : 's'} to ` +
                `${response.files?.length ?? 0} source file${response.files?.length === 1 ? '' : 's'}.`,
            );
          } else {
            logger.warn(`Visual edit rejected: ${response.error}`);
          }
          toolbar.send(SAVE_RESULT_EVENT, response);
        });

        toolbar.on(RECEIPT_EVENT, (raw: unknown) => {
          let response: ReceiptResponse;
          try {
            const request = parseReceiptRequest(raw);
            const receipt = manager.getReceipt(request.clientId, request.requestId);
            response = {
              ...request,
              status: receipt ? (receipt.success ? 'success' : 'failed') : 'unknown',
              response: receipt,
            };
          } catch {
            return;
          }
          toolbar.send(RECEIPT_RESULT_EVENT, response);
        });

        toolbar.on(REVERT_EVENT, async (raw: unknown) => {
          let response: RevertResponse;
          try {
            const request = parseRevertRequest(raw);
            if (!writeEnabled) {
              response = { ...request, success: false, error: remoteWarning };
            } else {
              response = await manager.revert(
                request.clientId,
                request.requestId,
                request.receiptId,
              );
            }
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown; receiptId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              receiptId: typeof candidate?.receiptId === 'string' ? candidate.receiptId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown revert error.',
            };
          }
          toolbar.send(REVERT_RESULT_EVENT, response);
        });
      },
    },
  };
}
