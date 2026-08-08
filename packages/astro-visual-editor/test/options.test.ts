import { describe, expect, it } from 'vitest';
import { normalizeOptions, toClientConfig } from '../src/options.js';

describe('normalizeOptions', () => {
  it('provides safe defaults and client configuration', () => {
    const options = normalizeOptions();
    expect(options.enabled).toBe(true);
    expect(options.allowedExtensions).toContain('.astro');
    expect(options.allowUnsafeSourceText).toBe(false);
    expect(options.allowRemoteDev).toBe(false);
    expect(options.editabilityRole).toBe('owner');
    expect(options.editabilityPolicyFile).toBe('astro-visual-editor.policy.json');
    expect(options.sectionTemplates.map((template) => template.id)).toEqual([
      'hero',
      'features',
      'text',
    ]);
    expect(toClientConfig(options)).not.toHaveProperty('allowedExtensions');
    expect(toClientConfig(options).canManageEditability).toBe(true);
    expect(toClientConfig(options).demoPages).toEqual([]);
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
    expect(() => normalizeOptions({ editabilityPolicyFile: '../outside.json' })).toThrow(
      'project root',
    );
    expect(
      toClientConfig(normalizeOptions({ editabilityRole: 'editor' })).canManageEditability,
    ).toBe(false);
    expect(() =>
      normalizeOptions({
        demoPages: [
          { id: 'simple', label: 'Simple', path: '/', description: 'The simple page.' },
          { id: 'again', label: 'Again', path: '/', description: 'A duplicate route.' },
        ],
      }),
    ).toThrow('duplicated');
  });

  it('passes an explicit local demo switcher to the toolbar', () => {
    const options = normalizeOptions({
      demoPages: [
        {
          id: 'simple',
          label: 'Simple demo',
          path: '/',
          description: 'A direct single-file test page.',
        },
        {
          id: 'complex',
          label: 'Complex sources',
          path: '/fixtures/complex',
          description: 'A composed source test page.',
        },
      ],
    });
    expect(toClientConfig(options).demoPages.map((page) => page.path)).toEqual([
      '/',
      '/fixtures/complex',
    ]);
  });

  it('normalizes and validates locked-area messages', () => {
    const options = normalizeOptions({
      lockedAreaMessages: [
        {
          selector: '.service-body',
          route: '/services*',
          message: 'Service page content is generated from the migration data.',
          action: 'It becomes editable after the content migration.',
        },
      ],
    });
    expect(toClientConfig(options).lockedAreaMessages).toEqual([
      {
        selector: '.service-body',
        route: '/services*',
        message: 'Service page content is generated from the migration data.',
        action: 'It becomes editable after the content migration.',
      },
    ]);
    expect(toClientConfig(normalizeOptions({})).lockedAreaMessages).toEqual([]);
    expect(() =>
      normalizeOptions({ lockedAreaMessages: [{ selector: ' ', message: 'Why.' }] }),
    ).toThrow('invalid CSS selector');
    expect(() =>
      normalizeOptions({ lockedAreaMessages: [{ selector: '.a', message: '  ' }] }),
    ).toThrow('needs a message');
    expect(() =>
      normalizeOptions({
        lockedAreaMessages: [{ selector: '.a', route: 'https://x', message: 'Why.' }],
      }),
    ).toThrow('invalid route');
  });
});
