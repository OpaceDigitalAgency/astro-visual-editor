import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { normalizeOptions, toClientConfig, type AstroVisualEditorOptions } from './options.js';
import {
  parseEditabilityPolicyChangeRequest,
  parseEditabilityPolicyRequest,
  parseReceiptRequest,
  parseRevertRequest,
  parseSaveRequest,
  parseSourceDiscoveryRequest,
  parseSectionDiscoveryRequest,
  parseSeoCapabilitiesRequest,
} from './shared/protocol.js';
import {
  APP_ID,
  CONFIG_EVENT,
  EDITABILITY_POLICY_EVENT,
  EDITABILITY_POLICY_RESULT_EVENT,
  EDITABILITY_PREVIEW_EVENT,
  EDITABILITY_PREVIEW_RESULT_EVENT,
  EDITABILITY_SAVE_EVENT,
  EDITABILITY_SAVE_RESULT_EVENT,
  HISTORY_EVENT,
  HISTORY_RESULT_EVENT,
  PREVIEW_EVENT,
  PREVIEW_RESULT_EVENT,
  READY_EVENT,
  RECEIPT_EVENT,
  RECEIPT_RESULT_EVENT,
  REVERT_EVENT,
  REVERT_RESULT_EVENT,
  SAVE_EVENT,
  SAVE_RESULT_EVENT,
  SOURCE_DISCOVERY_EVENT,
  SOURCE_DISCOVERY_RESULT_EVENT,
  SECTION_DISCOVERY_EVENT,
  SECTION_DISCOVERY_RESULT_EVENT,
  SEO_CAPABILITIES_EVENT,
  SEO_CAPABILITIES_RESULT_EVENT,
} from './shared/events.js';
import type {
  EditabilityPolicyResponse,
  HistoryResponse,
  PreviewResponse,
  ReceiptResponse,
  RevertResponse,
  SaveResponse,
  SourceDiscoveryResponse,
  SectionDiscoveryResponse,
  SeoCapabilitiesResponse,
} from './shared/types.js';
import { EditabilityPolicyManager } from './server/editability-policy.js';
import { TransactionManager } from './server/transaction-manager.js';
import { discoverSectionRegions, discoverSources } from './server/source-discovery.js';

export type { AstroVisualEditorOptions } from './options.js';
export type { EditorChange, SectionTemplate, SeoValues } from './shared/types.js';

function isRemoteHost(host: string | boolean | undefined): boolean {
  if (host === undefined || host === false) return false;
  if (host === true) return true;
  const normalized = host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, '');
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
  let transactionManager: TransactionManager | undefined;
  let editabilityPolicyManager: EditabilityPolicyManager | undefined;

  return {
    name: 'astro-visual-editor',
    hooks: {
      'astro:config:setup': ({ addDevToolbarApp, command }) => {
        if (!options.enabled || command !== 'dev') return;
        addDevToolbarApp({
          id: APP_ID,
          name: 'Visual Editor',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
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
        const canManageEditability = !remote && options.editabilityRole === 'owner';
        const remoteWarning = remote
          ? writeEnabled
            ? 'The dev server is network-exposed. Remote writes are explicitly enabled.'
            : 'Source writes are disabled because the dev server is network-exposed.'
          : undefined;
        // Astro can re-run this hook while the dev server remains alive. Keep
        // the manager in the integration closure so idempotency receipts and
        // the safe-revert history survive page-source HMR.
        transactionManager ??= new TransactionManager(projectRoot, sourceRoot, options);
        editabilityPolicyManager ??= new EditabilityPolicyManager(projectRoot, options, sourceRoot);
        const manager = transactionManager;
        const policyManager = editabilityPolicyManager;
        const sendConfig = () =>
          toolbar.send(
            CONFIG_EVENT,
            toClientConfig(options, writeEnabled, remoteWarning, canManageEditability),
          );

        toolbar.on(READY_EVENT, sendConfig);
        toolbar.onAppInitialized(APP_ID, sendConfig);

        toolbar.on(HISTORY_EVENT, async (raw: unknown) => {
          try {
            const request = parseReceiptRequest(raw);
            const response: HistoryResponse = { ...request, entries: await manager.history() };
            toolbar.send(HISTORY_RESULT_EVENT, response);
          } catch {
            return;
          }
        });

        toolbar.on(EDITABILITY_POLICY_EVENT, async (raw: unknown) => {
          try {
            const request = parseEditabilityPolicyRequest(raw);
            toolbar.send(
              EDITABILITY_POLICY_RESULT_EVENT,
              await policyManager.load(request.clientId, request.requestId, canManageEditability),
            );
          } catch {
            return;
          }
        });

        toolbar.on(SOURCE_DISCOVERY_EVENT, async (raw: unknown) => {
          let response: SourceDiscoveryResponse;
          try {
            const request = parseSourceDiscoveryRequest(raw, options.maxRequestBytes);
            response = canManageEditability
              ? await discoverSources(projectRoot, sourceRoot, request, options)
              : {
                  clientId: request.clientId,
                  requestId: request.requestId,
                  success: false,
                  error: 'Only a local owner can search and confirm source mappings.',
                };
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown source discovery error.',
            };
          }
          toolbar.send(SOURCE_DISCOVERY_RESULT_EVENT, response);
        });

        toolbar.on(SECTION_DISCOVERY_EVENT, async (raw: unknown) => {
          let response: SectionDiscoveryResponse;
          try {
            const request = parseSectionDiscoveryRequest(raw, options.maxRequestBytes);
            response = canManageEditability
              ? await discoverSectionRegions(projectRoot, sourceRoot, request, options)
              : {
                  clientId: request.clientId,
                  requestId: request.requestId,
                  success: false,
                  error: 'Only a local owner can search and confirm section mappings.',
                };
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown section discovery error.',
            };
          }
          toolbar.send(SECTION_DISCOVERY_RESULT_EVENT, response);
        });

        toolbar.on(EDITABILITY_PREVIEW_EVENT, async (raw: unknown) => {
          let response: EditabilityPolicyResponse;
          try {
            const request = parseEditabilityPolicyChangeRequest(raw, options.maxRequestBytes);
            response = await policyManager.preview(request, canManageEditability);
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown editability preview error.',
            };
          }
          toolbar.send(EDITABILITY_PREVIEW_RESULT_EVENT, response);
        });

        toolbar.on(EDITABILITY_SAVE_EVENT, async (raw: unknown) => {
          let response: EditabilityPolicyResponse;
          try {
            const request = parseEditabilityPolicyChangeRequest(raw, options.maxRequestBytes);
            response = await policyManager.save(request, canManageEditability);
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown editability save error.',
            };
          }
          if (response.success) logger.info(`Updated ${options.editabilityPolicyFile}.`);
          else logger.warn(`Editability policy rejected: ${response.error}`);
          toolbar.send(EDITABILITY_SAVE_RESULT_EVENT, response);
        });

        toolbar.on(SEO_CAPABILITIES_EVENT, async (raw: unknown) => {
          let response: SeoCapabilitiesResponse;
          try {
            response = await manager.seoCapabilities(parseSeoCapabilitiesRequest(raw));
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown SEO capabilities error.',
            };
          }
          toolbar.send(SEO_CAPABILITIES_RESULT_EVENT, response);
        });

        toolbar.on(PREVIEW_EVENT, async (raw: unknown) => {
          let response: PreviewResponse;
          try {
            const request = parseSaveRequest(raw, options.maxChanges, options.maxRequestBytes);
            response = writeEnabled
              ? await manager.preview(request)
              : {
                  clientId: request.clientId,
                  requestId: request.requestId,
                  success: false,
                  error: remoteWarning,
                };
          } catch (error) {
            const candidate = raw as { clientId?: unknown; requestId?: unknown };
            response = {
              clientId: typeof candidate?.clientId === 'string' ? candidate.clientId : 'invalid',
              requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : 'invalid',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown preview error.',
            };
          }
          toolbar.send(PREVIEW_RESULT_EVENT, response);
        });

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

        toolbar.on(RECEIPT_EVENT, async (raw: unknown) => {
          let response: ReceiptResponse;
          try {
            const request = parseReceiptRequest(raw);
            const receipt = await manager.getReceipt(request.clientId, request.requestId);
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
            const candidate = raw as {
              clientId?: unknown;
              requestId?: unknown;
              receiptId?: unknown;
            };
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
