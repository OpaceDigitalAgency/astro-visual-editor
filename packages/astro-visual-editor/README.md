# Astro Visual Editor: Change Text, SEO & Drag & Drop Sections in the Front-End

![Astro Visual Editor by Opace: a source-aware front-end editor with a reviewable text, section and SEO change ledger](https://raw.githubusercontent.com/OpaceDigitalAgency/astro-visual-editor/main/.github/assets/astro-visual-editor-social-card.svg)

[![CI](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/workflows/ci.yml)
[![Package](https://img.shields.io/badge/package-%40opacedev%2Fastro--visual--editor-cb3837.svg)](https://www.npmjs.com/package/@opacedev/astro-visual-editor)
[![MIT licensed](https://img.shields.io/badge/license-MIT-2f3337.svg)](https://github.com/OpaceDigitalAgency/astro-visual-editor/blob/main/LICENSE)
[![Astro integration](https://img.shields.io/badge/Astro-integration-ff5d01.svg)](https://docs.astro.build/en/guides/integrations/)

A development-only visual editor for Astro with text editing, SEO fields,
section templates, real drag-and-drop, a reviewable change ledger and validated
source transactions.

The current public beta is `0.1.0-beta.2`. It is published through npm trusted
GitHub OIDC with provenance and has passed a clean Astro 7.1.6 registry install
and production build.

It uses Astro's native Dev Toolbar and `astro:server:setup` communication. It
does not ship an editor client or write endpoint in production.

Built by [Opace Astro developers](https://opace.agency/services/web-design/astro-development/).

| Mode     | Included workflow                                                        |
| -------- | ------------------------------------------------------------------------ |
| Text     | Select rendered content, preview the replacement and queue it            |
| Sections | Add templates, delete, move or pointer-drag inside declared regions      |
| SEO      | Edit title, description, keywords, canonical, Open Graph and robots      |
| Review   | Inspect mixed changes, undo/redo, commit once and conflict-check reverts |

## Install

```bash
npx astro add @opacedev/astro-visual-editor
```

Astro 7.1.6's `astro add` command does not accept version or dist-tag suffixes.
To pin the public beta tag explicitly, install it manually and add the
integration to the config shown below:

```bash
npm install --save-dev @opacedev/astro-visual-editor@beta
```

```js
import { defineConfig } from 'astro/config';
import visualEditor from '@opacedev/astro-visual-editor';

export default defineConfig({
  integrations: [visualEditor()],
});
```

Run `astro dev`, open the Dev Toolbar and choose **Visual Editor**.

## Included modes

- **Text:** click or focus (`Alt+Enter`) rendered text, preview and queue it.
- **Sections:** add from templates, delete and reorder with drag, buttons or
  keyboard controls.
- **SEO:** title, description, keywords, canonical, Open Graph and robots.
- **Review:** mixed-change ledger, individual removal, undo/redo, clear,
  idempotent commit and conflict-protected revert.

The queue recovers through Astro HMR/navigation and stays isolated per browser
tab. The workbench collapses to compact Pick mode on desktop or mobile. Icon
controls provide visible hover/focus tooltips, and dialogs close with Cancel,
Escape or a backdrop click.

## Reliable source mapping

Annotate the owning file and give important elements stable browser IDs:

```astro
<section data-astro-edit-file="src/components/Hero.astro">
  <h1 data-astro-edit-id="hero-title">Edit this heading</h1>
</section>
```

JSON, JSONC and YAML require an exact path:

```astro
<h1 data-astro-edit-file="src/data/home.json" data-astro-edit-path="hero.title">
  {home.hero.title}
</h1>
```

Selector and route mappings are also supported:

```js
visualEditor({
  selectorMappings: {
    '[data-site-header]': 'src/components/Header.astro',
  },
  fileMappings: {
    '/products/widget': 'src/pages/products/[slug].astro',
  },
});
```

## Persistent section regions

```astro
<div data-astro-edit-region="homepage" data-astro-edit-file="src/pages/index.astro">
  <section data-section="hero">...</section>
  <section data-section="services">...</section>
  <section data-section="proof">...</section>
</div>
```

Sections must be contiguous direct children with unique stable IDs. This is a
deliberate safety contract: arbitrary component structure is never rewritten.
Existing sections drag only within their declared region. Add before/after
inserts validated templates; arbitrary page-wide and cross-region drops are not
supported.

Custom templates use `{{id}}`:

```js
visualEditor({
  sectionTemplates: [
    {
      id: 'callout',
      name: 'Callout',
      description: 'A highlighted action block.',
      markup: '<section data-section="{{id}}"><h2>Callout</h2></section>',
    },
  ],
});
```

## SEO owners

```astro
<html data-astro-edit-seo-file="src/pages/index.astro"></html>
```

Literal Astro head elements are updated/inserted and compiler-validated.
Markdown/MDX SEO updates use YAML frontmatter.

## Safety

The integration rejects unsafe or unproven writes through:

- runtime message validation and byte/change limits;
- client/request addressing and idempotency receipts;
- project/source-root and symlink checks;
- allowed-extension and source-size limits;
- original source hashes and stale/conflict rejection;
- Astro compiler validation;
- structured JSONC/YAML property paths;
- atomic writes and best-effort batch rollback;
- reverts that refuse to overwrite newer changes;
- default refusal on network-exposed dev servers.

Always inspect the resulting Git diff.

## Options

```ts
interface AstroVisualEditorOptions {
  enabled?: boolean;
  editableSelectors?: string[];
  excludeSelectors?: string[];
  fileMappings?: Record<string, string>;
  selectorMappings?: Record<string, string>;
  allowedExtensions?: Array<'.astro' | '.md' | '.mdx' | '.json' | '.jsonc' | '.yaml' | '.yml'>;
  sectionTemplates?: SectionTemplate[];
  maxChanges?: number;
  maxTextLength?: number;
  maxRequestBytes?: number;
  maxSourceFileBytes?: number;
  requestTimeoutMs?: number;
  receiptTtlMs?: number;
  historyLimit?: number;
  allowUnsafeSourceText?: boolean;
  allowRemoteDev?: boolean;
}
```

`allowUnsafeSourceText` and `allowRemoteDev` are expert escape hatches and are
both disabled by default.

## Current boundaries

- Local `astro dev` only; no authenticated production CMS.
- Complex expressions/shared data need explicit file/path mapping.
- Unstructured MDX body expressions are refused.
- Section operations require declared Astro regions.
- No arbitrary page-wide or cross-region section drops.
- Receipt reverts survive HMR but not a complete dev-server restart.
- Visual Editability Setup/content inventory and Git-backed history remain
  roadmap work.

Full documentation, feature parity, architecture and release evidence:

- [Product page](https://opace.agency/tools/astro/visual-editor/)
- [GitHub repository](https://github.com/OpaceDigitalAgency/astro-visual-editor)
- [Full configuration and source-mapping guide](https://github.com/OpaceDigitalAgency/astro-visual-editor#configuration)
- [Security model](https://github.com/OpaceDigitalAgency/astro-visual-editor/security/policy)
- [Release evidence and current status](https://github.com/OpaceDigitalAgency/astro-visual-editor/blob/main/PROJECT.md)
- [Current release and takeover plan](https://github.com/OpaceDigitalAgency/astro-visual-editor/blob/main/RELEASE_PLAN.md)

MIT © 2026 [Opace Digital Agency](https://opace.agency/services/web-design/).

Need help implementing Astro? Explore [Astro development](https://opace.agency/services/web-design/astro-development/),
[web design](https://opace.agency/services/web-design/) or [contact Opace](https://opace.agency/get-in-touch/).
