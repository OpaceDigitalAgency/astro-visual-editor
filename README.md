# Astro Visual Editor

Edit an Astro site where you can see it. Review every change before it touches
your source files.

[![CI](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/workflows/ci.yml)
[![MIT licensed](https://img.shields.io/badge/license-MIT-2f3337.svg)](./LICENSE)
[![Astro integration](https://img.shields.io/badge/Astro-integration-ff5d01.svg)](https://docs.astro.build/en/guides/integrations/)

Astro Visual Editor is a development-only integration that adds click-to-edit
content controls to Astro's Dev Toolbar. Changes appear immediately in the
browser, collect in a visible ledger, and are written to source only when you
commit the reviewed batch.

It is not a CMS, database or production admin panel. It is a local source
workbench for developers and content teams who want the speed of visual editing
without surrendering Astro's file-based architecture.

> **Release status:** extracted and locally validated. The package is not yet
> published to npm, so the `astro add` command below becomes available with the
> first approved public release.

## Why it exists

Static sites are pleasant to own but awkward to edit when the person changing
the sentence has to locate it across pages, layouts and components. The original
prototype proved that browser-led editing could bridge that gap, but it was
embedded inside one website and relied on site-specific localhost endpoints.

This repository turns that prototype into a real Astro integration:

- installed through Astro config rather than copied scripts;
- presented through Astro's native Dev Toolbar;
- connected to the server through Astro's toolbar channel;
- restricted to development mode with no production editor endpoint;
- fail-closed when a file mapping or text replacement is ambiguous;
- packaged and described for `astro add` and Astro's integrations directory.

## Core workflow

```text
Open astro dev
      ↓
Enable Visual Editor in the Dev Toolbar
      ↓
Click a visible text element
      ↓
Preview the replacement in the page
      ↓
Review old text, new text and source file in the ledger
      ↓
Undo individual changes or clear the queue
      ↓
Commit the validated batch to source
      ↓
Astro HMR renders the saved files
```

The browser preview and the filesystem write are separate actions. Clicking
"Queue change" does not modify a file.

## Features

- Native Astro Dev Toolbar app.
- Click-to-edit headings, paragraphs, lists, labels, table text and explicitly
  annotated elements.
- Immediate visual previews with a reviewable change ledger.
- Old/new value and expected source file shown for each edit.
- Individual undo and clear-all controls before saving.
- Batch validation before the first file is written.
- Explicit source mappings for components and dynamic routes.
- Sensible route-to-page fallback for conventional `src/pages` projects.
- Protection against absolute paths, traversal, symbolic-link escapes,
  disallowed extensions, stale source text and ambiguous replacements.
- No production client bundle, API route or editing service.
- Keyboard-visible focus states and reduced-motion support.

## Installation

After the first npm release, use Astro's integration installer:

```bash
npx astro add astro-visual-editor
```

Or install and configure it manually:

```bash
npm install --save-dev astro-visual-editor
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import visualEditor from 'astro-visual-editor';

export default defineConfig({
  integrations: [visualEditor()],
});
```

Run your site normally:

```bash
npm run dev
```

Open Astro's Dev Toolbar and select **Visual Editor**.

## Source mapping

Rendered HTML does not always reveal which `.astro` file produced it. The
editor therefore uses deliberate, inspectable mappings in this order.

### 1. Explicit file annotations

This is the most reliable option and is recommended for reusable components,
dynamic routes and repeated content.

```astro
<h1 data-astro-edit-file="src/pages/index.astro">
  A source-aware heading
</h1>
```

Annotate a wrapper when several simple text children come from the same file:

```astro
<section data-astro-edit-file="src/components/Hero.astro">
  <h1>Build content where it renders</h1>
  <p>Queue first. Commit when the whole page reads correctly.</p>
</section>
```

### 2. Selector mappings

Shared chrome can be configured once:

```js
visualEditor({
  selectorMappings: {
    header: 'src/components/Header.astro',
    footer: 'src/components/Footer.astro',
    '[data-product-hero]': 'src/components/ProductHero.astro',
  },
});
```

### 3. Route mappings

Use route mappings for dynamic or non-standard page structures:

```js
visualEditor({
  fileMappings: {
    '/': 'src/pages/index.astro',
    '/about': 'src/pages/company/about.astro',
    '/products/widget': 'src/pages/products/[slug].astro',
  },
});
```

### 4. Conventional fallback

If no explicit mapping exists, `/about` resolves to
`src/pages/about.astro`, while `/` resolves to `src/pages/index.astro`.

The server still verifies that the resolved file exists inside Astro's `src`
directory before accepting a write.

## Marking complex elements

By default, an element with nested markup is not edited because replacing its
`textContent` could destroy links, spans or formatting. Opt in only when the
whole element is intentionally plain text:

```astro
<div
  data-astro-editable
  data-astro-edit-file="src/components/Announcement.astro"
>
  The whole value is safe to replace.
</div>
```

Exclude an otherwise eligible element with:

```astro
<p data-astro-edit-ignore>Managed by an external data source.</p>
```

## Configuration

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

### `enabled`

Temporarily disables the integration without removing it from Astro config.
Default: `true`.

### `editableSelectors`

Controls which simple text elements can be selected. Supplying this option
replaces the default selector list.

### `excludeSelectors`

Elements matching or contained by these selectors are ignored. Supplying this
option replaces the defaults.

### `allowedExtensions`

Restricts which source file types may be written. The default is `.astro`,
`.md`, `.mdx`, `.json`, `.yaml` and `.yml`.

### `maxChanges` and `maxTextLength`

Bound the size of editing requests. Defaults: 100 queued changes and 10,000
characters per replacement.

### `allowUnsafeSourceText`

Allows `<`, `>`, `{` and `}` in replacements. This is disabled by default
because those characters can change Astro syntax. Prefer code editing for
structural changes.

## Planned editability setup — urgent enhancement

At present, developers determine what can be selected through
`editableSelectors`, `excludeSelectors`, source mappings and `data-astro-*`
annotations. The toolbar does not yet provide an owner-facing setup interface
for inspecting or changing those rules.

An urgent planned enhancement will add a local **Editability Setup** mode that
lists visible page content, explains why each value is editable or blocked, and
lets an authorised site owner create reviewable project rules without manually
editing templates. Those rules must remain subject to source-attribution,
source-adapter and transaction safety checks; selecting an element must never
imply that it is safe to write.

This local setup mode is separate from a future authenticated production admin
or client workflow. See
[<removed internal document>](./<removed internal document>)
for its requirements and sequencing.

## Safety model

Astro Visual Editor intentionally fails closed.

Before writing a batch, the server confirms that:

1. every path is project-relative;
2. every real file is inside Astro's configured `src` directory;
3. symbolic links do not escape that directory;
4. every extension is allowed;
5. every replacement has a non-empty old and new value;
6. every original value occurs exactly once in the expected file;
7. every replacement respects configured size and character limits;
8. the complete batch is valid before the first write begins.

If any edit fails validation, no source file is changed. If a filesystem write
fails after validation, files already written by that batch are rolled back on
a best-effort basis.

Always review the resulting Git diff before committing.

## Architecture

```text
Astro integration
  ├── astro:config:setup
  │     └── registers the Dev Toolbar app during `astro dev`
  ├── toolbar client (Shadow DOM)
  │     ├── page selection and visual preview
  │     ├── source mapping
  │     └── queued change ledger
  └── astro:server:setup
        ├── receives namespaced toolbar messages
        ├── validates the complete batch
        └── writes approved source files
```

There is no standalone Express server and no production editing endpoint.

## What it deliberately does not do

- It does not edit arbitrary HTML structures or Astro expressions.
- It does not infer a reliable source location for every component tree.
- It does not replace Git, code review or a content model.
- It does not expose editing in a deployed production site.
- It does not silently choose between duplicate source strings.

For complex content, annotate the owning source file or edit the code directly.

## Compatibility

- Astro 7.1.6 or newer in the current major line.
- Node.js 22.12 or newer, matching Astro 7's runtime requirement.
- Modern browsers with Astro Dev Toolbar support.
- Static and server-rendered Astro projects during local development.

The editing workflow is intended for desktop browsers. The ledger scales to a
narrow viewport without horizontal overflow, but Astro's Dev Toolbar uses a
full-width overlay at phone sizes, so touch selection of the page underneath is
not supported.

The CI matrix runs on supported Node.js 22 and 24 lines. Astro's current
release is used by the demo fixture.

## Development and testing

The repository follows Astro's recommended workspace structure: a publishable
package plus a real demo project with fixture pages.

```bash
git clone https://github.com/OpaceDigitalAgency/astro-visual-editor.git
cd astro-visual-editor
npm install
npm run dev
```

Run the complete validation suite:

```bash
npm run test:all
```

This builds the integration, runs unit and security-boundary tests, type-checks
the package, checks and builds the Astro demo, and inspects the npm tarball.

## Publishing and Astro's integrations directory

The package metadata is designed for Astro's current discovery rules:

- default export is an integration factory function;
- `astro-integration` enables `astro add` handling;
- `withastro`, `devtools`, `dev-overlay` and `dev-toolbar` provide ecosystem and
  category discovery;
- `name`, `description`, `repository` and `homepage` are present for the Astro
  integrations directory;
- the package publishes only its built runtime, types, licence and README.

Once published to npm, Astro's integrations directory automatically imports
matching packages on its weekly refresh. A separate Astro issue is only needed
for a custom avatar or listing override.

## Project status

See [<removed internal document>](./<removed internal document>) for the evidence-backed release checklist and
[<removed internal document>](./<removed internal document>)
for the implementation roadmap and takeover brief. See
[CHANGELOG.md](./CHANGELOG.md) for release history. Version `0.1.0` remains
unreleased while the documented beta-hardening work and public GitHub/npm gates
remain incomplete.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues should follow
[SECURITY.md](./SECURITY.md).

## Licence

[MIT](./LICENSE) © 2026 Opace Digital Agency.
