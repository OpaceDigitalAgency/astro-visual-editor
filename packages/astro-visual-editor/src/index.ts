import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { AstroIntegration } from 'astro';
import {
  normalizeOptions,
  toClientConfig,
  type AstroVisualEditorOptions,
} from './options.js';
import { applyChangeBatch } from './server/file-updater.js';
import type { SaveRequest, SaveResponse } from './shared/types.js';

export type { AstroVisualEditorOptions } from './options.js';

const APP_ID = 'astro-visual-editor';
const READY_EVENT = `${APP_ID}:ready`;
const CONFIG_EVENT = `${APP_ID}:config`;
const SAVE_EVENT = `${APP_ID}:save`;
const SAVE_RESULT_EVENT = `${APP_ID}:save-result`;

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
          entrypoint: new URL('./toolbar.js', import.meta.url),
        });
      },
      'astro:config:done': ({ config }) => {
        projectRoot = fileURLToPath(config.root);
        sourceRoot = fileURLToPath(config.srcDir);
      },
      'astro:server:setup': ({ toolbar, logger }) => {
        if (!options.enabled) return;

        const sendConfig = () => toolbar.send(CONFIG_EVENT, toClientConfig(options));
        toolbar.on(READY_EVENT, sendConfig);
        toolbar.onAppInitialized(APP_ID, sendConfig);

        toolbar.on(SAVE_EVENT, async (request: SaveRequest) => {
          let response: SaveResponse;
          try {
            const result = await applyChangeBatch(
              projectRoot,
              sourceRoot,
              request.changes,
              options,
            );
            response = { requestId: request.requestId, success: true, ...result };
            logger.info(
              `Wrote ${result.changeCount} visual edit${result.changeCount === 1 ? '' : 's'} to ` +
                `${result.files.length} source file${result.files.length === 1 ? '' : 's'}.`,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown save error.';
            response = { requestId: request.requestId, success: false, error: message };
            logger.warn(`Visual edit rejected: ${message}`);
          }
          toolbar.send(SAVE_RESULT_EVENT, response);
        });
      },
    },
  };
}
