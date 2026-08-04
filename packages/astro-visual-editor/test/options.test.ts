import { describe, expect, it } from 'vitest';
import { normalizeOptions, toClientConfig } from '../src/options.js';

describe('normalizeOptions', () => {
  it('provides safe defaults and client configuration', () => {
    const options = normalizeOptions();
    expect(options.enabled).toBe(true);
    expect(options.allowedExtensions).toContain('.astro');
    expect(options.allowUnsafeSourceText).toBe(false);
    expect(options.allowRemoteDev).toBe(false);
    expect(options.sectionTemplates.map((template) => template.id)).toEqual([
      'hero',
      'features',
      'text',
    ]);
    expect(toClientConfig(options)).not.toHaveProperty('allowedExtensions');
  });

  it('preserves user selector mappings without injecting phantom defaults', () => {
    const options = normalizeOptions({
      selectorMappings: { nav: 'src/components/Nav.astro' },
      maxChanges: 12,
    });
    expect(options.selectorMappings.nav).toBe('src/components/Nav.astro');
    expect(options.selectorMappings).not.toHaveProperty('header');
    expect(options.maxChanges).toBe(12);
  });

  it('rejects unsafe mapping and duplicate template configuration', () => {
    expect(() => normalizeOptions({ fileMappings: { '/': '/tmp/page.astro' } })).toThrow(
      'project-relative',
    );
    expect(() =>
      normalizeOptions({
        sectionTemplates: [
          { id: 'hero', name: 'One', description: '', markup: '<section></section>' },
          { id: 'hero', name: 'Two', description: '', markup: '<section></section>' },
        ],
      }),
    ).toThrow('duplicated');
  });
});
