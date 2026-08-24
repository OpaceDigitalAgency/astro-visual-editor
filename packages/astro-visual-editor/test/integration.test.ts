import { createHash } from 'node:crypto';
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
      icon: expect.stringContaining('viewBox="0 0 512 512"'),
    });
    const icon = addDevToolbarApp.mock.calls[0]?.[0]?.icon;
    expect(icon).toContain('<image width="512" height="512"');
    expect(icon).toContain('href="data:image/png;base64,');
    const encodedPng = icon?.match(/href="data:image\/png;base64,([^"]+)"/u)?.[1];
    expect(encodedPng).toBeDefined();
    expect(createHash('sha256').update(Buffer.from(encodedPng!, 'base64')).digest('hex')).toBe(
      'fa43f92dbc3fe9281c301f3bc739c0fba6faf4400ad0ba57fd70c13671d3fb27',
    );
  });
});
