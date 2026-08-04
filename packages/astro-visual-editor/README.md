# Astro Visual Editor

A development-only visual editor for Astro: click rendered text, preview a set
of changes, review the source-file ledger, then commit the validated batch.

It uses Astro's native Dev Toolbar and `astro:server:setup` channel. It does not
ship an editor bundle or editing endpoint in production.

## Install

```bash
npx astro add astro-visual-editor
```

Or configure it manually:

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

Run `npm run dev`, open Astro's Dev Toolbar, and select **Visual Editor**.

## Reliable source mapping

Annotate components and dynamic content with the owning project-relative file:

```astro
<section data-astro-edit-file="src/components/Hero.astro">
  <h1>Edit this rendered heading</h1>
  <p>Review it in the ledger before writing the source file.</p>
</section>
```

Shared and route-level mappings can also be configured:

```js
visualEditor({
  selectorMappings: {
    header: 'src/components/Header.astro',
    footer: 'src/components/Footer.astro',
  },
  fileMappings: {
    '/products/widget': 'src/pages/products/[slug].astro',
  },
});
```

Conventional routes fall back to `src/pages/{route}.astro` and `/` maps to
`src/pages/index.astro`.

## Safety

The server rejects absolute paths, traversal, symbolic-link escapes, unsupported
extensions, stale text, duplicate matches and Astro markup characters by
default. It validates the complete batch before writing the first file.

The editor is designed for simple textual source values. It deliberately does
not flatten nested markup or guess between ambiguous source matches.

Use a desktop browser for editing. The panel remains width-safe on narrow
screens, but Astro's mobile Dev Toolbar overlays the page and does not provide a
reliable touch-selection surface beneath it.

## Options

```ts
interface AstroVisualEditorOptions {
  enabled?: boolean;
  editableSelectors?: string[];
  excludeSelectors?: string[];
  fileMappings?: Record<string, string>;
  selectorMappings?: Record<string, string>;
  allowedExtensions?: Array<'.astro' | '.md' | '.mdx' | '.json' | '.yaml' | '.yml'>;
  maxChanges?: number;
  maxTextLength?: number;
  allowUnsafeSourceText?: boolean;
}
```

Full documentation, architecture, security model and contribution instructions:
[github.com/OpaceDigitalAgency/astro-visual-editor](https://github.com/OpaceDigitalAgency/astro-visual-editor).

MIT © 2026 Opace Digital Agency.
