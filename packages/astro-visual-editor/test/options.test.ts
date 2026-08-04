import { describe, expect, it } from 'vitest';
import { normalizeOptions, toClientConfig } from '../src/options.js';

describe('normalizeOptions', () => {
  it('provides safe defaults and client configuration', () => {
    const options = normalizeOptions();
    expect(options.enabled).toBe(true);
    expect(options.allowedExtensions).toContain('.astro');
    expect(options.allowUnsafeSourceText).toBe(false);
    expect(toClientConfig(options)).not.toHaveProperty('allowedExtensions');
  });

  it('merges selector mappings without dropping shared defaults', () => {
    const options = normalizeOptions({
      selectorMappings: { nav: 'src/components/Nav.astro' },
      maxChanges: 12,
    });
    expect(options.selectorMappings.header).toBe('src/components/Header.astro');
    expect(options.selectorMappings.nav).toBe('src/components/Nav.astro');
    expect(options.maxChanges).toBe(12);
  });
});

