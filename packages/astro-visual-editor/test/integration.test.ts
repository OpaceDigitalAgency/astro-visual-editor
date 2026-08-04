import { describe, expect, it, vi } from 'vitest';
import visualEditor from '../src/index.js';

describe('Astro integration', () => {
  it('has the default function export required by astro add', () => {
    expect(typeof visualEditor).toBe('function');
    const integration = visualEditor();
    expect(integration.name).toBe('astro-visual-editor');
    expect(integration.hooks['astro:config:setup']).toBeTypeOf('function');
    expect(integration.hooks['astro:server:setup']).toBeTypeOf('function');
  });

  it('registers a Dev Toolbar app only for development', () => {
    const addDevToolbarApp = vi.fn();
    const hook = visualEditor().hooks['astro:config:setup'];
    hook?.({ addDevToolbarApp, command: 'build' } as never);
    expect(addDevToolbarApp).not.toHaveBeenCalled();
    hook?.({ addDevToolbarApp, command: 'dev' } as never);
    expect(addDevToolbarApp).toHaveBeenCalledOnce();
    expect(addDevToolbarApp.mock.calls[0]?.[0]).toMatchObject({
      id: 'astro-visual-editor',
      name: 'Visual Editor',
    });
  });
});
