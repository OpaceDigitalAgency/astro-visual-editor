# Astro Visual Editor

A development-only visual editor for Astro with text editing, SEO fields,
section templates, real drag-and-drop, a reviewable change ledger and validated
source transactions.

It uses Astro's native Dev Toolbar and `astro:server:setup` communication. It
does not ship an editor client or write endpoint in production.

## Install

```bash
npx astro add astro-visual-editor
```

Or:

```bash
npm install --save-dev astro-visual-editor
```

```js
import { defineConfig } from 'astro/config';
import visualEditor from 'astro-visual-editor';

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
tab. Narrow screens use compact touch Pick mode plus a full Review sheet.

## Reliable source mapping

Annotate the owning file and give important elements stable browser IDs:

```astro
<section data-astro-edit-file="src/components/Hero.astro">
  <h1 data-astro-edit-id="hero-title">Edit this heading</h1>
</section>
```

JSON, JSONC and YAML require an exact path:

```astro
<h1
  data-astro-edit-file="src/data/home.json"
  data-astro-edit-path="hero.title"
>
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
<div
  data-astro-edit-region="homepage"
  data-astro-edit-file="src/pages/index.astro"
>
  <section data-section="hero">...</section>
  <section data-section="services">...</section>
  <section data-section="proof">...</section>
</div>
```

Sections must be contiguous direct children with unique stable IDs. This is a
deliberate safety contract: arbitrary component structure is never rewritten.

Custom templates use `{{id}}`:

```js
visualEditor({
  sectionTemplates: [{
    id: 'callout',
    name: 'Callout',
    description: 'A highlighted action block.',
    markup: '<section data-section="{{id}}"><h2>Callout</h2></section>',
  }],
});
```

## SEO owners

```astro
<html data-astro-edit-seo-file="src/pages/index.astro">
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
  allowedExtensions?: Array<
    '.astro' | '.md' | '.mdx' | '.json' | '.jsonc' | '.yaml' | '.yml'
  >;
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
- Receipt reverts survive HMR but not a complete dev-server restart.
- Visual Editability Setup/content inventory and Git-backed history remain
  roadmap work.

Full documentation, feature parity, architecture and release evidence:
[github.com/OpaceDigitalAgency/astro-visual-editor](https://github.com/OpaceDigitalAgency/astro-visual-editor).

MIT © 2026 Opace Digital Agency.
