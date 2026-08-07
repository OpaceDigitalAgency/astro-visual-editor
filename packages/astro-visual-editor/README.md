# Astro Visual Editor: Change Text, SEO & Drag & Drop Sections in the Front-End

![Astro Visual Editor by Opace: a source-aware front-end editor with a reviewable text, section and SEO change ledger](https://raw.githubusercontent.com/OpaceDigitalAgency/astro-visual-editor/main/.github/assets/astro-visual-editor-social-card.svg)

[![CI](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/workflows/ci.yml)
[![Package](https://img.shields.io/badge/package-%40opacedev%2Fastro--visual--editor-cb3837.svg)](https://www.npmjs.com/package/@opacedev/astro-visual-editor)
[![MIT licensed](https://img.shields.io/badge/license-MIT-2f3337.svg)](https://github.com/OpaceDigitalAgency/astro-visual-editor/blob/main/LICENSE)
[![Astro integration](https://img.shields.io/badge/Astro-integration-ff5d01.svg)](https://docs.astro.build/en/guides/integrations/)

A development-only visual editor for Astro with text editing, SEO fields,
section templates, real drag-and-drop, a reviewable change ledger and validated
source transactions.

The current public beta is `0.1.0-beta.4`. It is published through npm trusted
GitHub OIDC with provenance and has passed a clean Astro 7.1.6 registry install
and production build.

The Beta 5 candidate adds syntax-aware source discovery and owner-confirmed,
zero-annotation section mappings. The current public package remains Beta 4
until the candidate passes owner acceptance and the protected release workflow.

It uses Astro's native Dev Toolbar and `astro:server:setup` communication. It
does not ship an editor client or write endpoint in production.

Built by [Opace Astro developers](https://opace.agency/services/web-design/astro-development/).

| Mode     | Included workflow                                                       |
| -------- | ----------------------------------------------------------------------- |
| Text     | Select rendered content, preview the replacement and queue it           |
| Sections | Enable, map and reorder Astro children or JSON/YAML array items safely  |
| SEO      | Edit title, description, keywords, canonical, Open Graph and robots     |
| Changes  | Inspect mixed changes, undo/redo, save once and conflict-check restores |
| Setup    | Inventory visible content and review project-owned allow/deny policy    |

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
- **Changes:** compact mixed-change tray with individual removal, undo/redo,
  discard, idempotent save and conflict-protected restore.

The queue recovers through Astro HMR/navigation and stays isolated per browser
tab. The workbench collapses to compact Pick mode on desktop or mobile. Icon
controls provide visible hover/focus tooltips, and dialogs close with Cancel,
Escape or a backdrop click.

## Automatic and explicit source mapping

For unresolved rendered text, open **Editor Setup** and choose **Find
exact source**. The editor searches supported files with their syntax-aware
parsers and lists every exact candidate with its file, line and structured
path. One confirmed mapping is saved in `astro-visual-editor.policy.json`.
Repeated Astro literals receive separate stale-checked node locators, so the
editor changes the confirmed occurrence rather than guessing from global text.

Explicit annotations remain useful when a project wants to publish its source
ownership directly:

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

Explicit source annotations may also explain their provenance and identify
known shared routes. The editor displays that context before queueing an edit:

```astro
<h1
  data-astro-edit-file="src/data/home.json"
  data-astro-edit-path="hero.title"
  data-astro-edit-origin="a direct JSON import"
  data-astro-edit-shared-routes="/,/pricing"
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

## Editor Setup

The settings control opens local owner-only controls for **Sections** and
**Text**. Both start with the same on-page selection action. Full searchable
text and section inventories remain collapsed behind **Manage all text** and
**Manage sections** until needed. Section mappings can be added and removed for
the current route without adding editor attributes to site components.
Both areas support the same owner workflow: choose a readable item from the
list or use **Select on page** to hover, highlight and click the exact content.
Syntax-aware verification then runs silently. File paths and source locators
stay inside collapsed technical details unless the match is genuinely
ambiguous.
Each item is labelled editable, blocked, unresolved or structurally unsafe and
shows the source reason. Owners can review element or selector-group allow/deny
rules, discover and confirm an unresolved source candidate, inspect the exact
JSON diff and save `astro-visual-editor.policy.json` in the project root. A
manual file/path field remains available as a fallback. Choosing a
permission opens that review immediately. Cancelling clearly marks the choice
as unsaved, while saving returns directly to normal editing. Labelled **Back to
editor** controls remain visible throughout setup.

Saved policy survives reloads and other checkouts because it is a normal
Git-reviewable project file. Allow rules never bypass explicit ignore markers,
unsafe nested markup, source attribution or adapter validation. Set
`editabilityRole: 'editor'` when a local user should apply policy without being
able to change it; network-exposed development servers cannot manage policy.

## Persistent section regions

In Editor Setup, an owner can choose **Select section on page** or **Choose from
list**; the same visual setup is available in Sections mode. Clicking page
content reveals every valid nesting level under that point, from the smallest
reorderable area through its parents to the whole page. Each level can be
enabled independently, and the editor silently uses a unique structural source
match.
The mapping is stored in the project policy; site components do not need editor
attributes. The candidate supports contiguous Astro component/element children
and complete JSON/JSONC or YAML array items. Structured candidates must match
the rendered child values in order. Source blocks and structured items are
hash-checked before every reorder, and ambiguous candidates require owner
selection.

Projects can still declare a region directly:

```astro
<div data-astro-edit-region="homepage" data-astro-edit-file="src/pages/index.astro">
  <section data-section="hero">...</section>
  <section data-section="services">...</section>
  <section data-section="proof">...</section>
</div>
```

Mapped or declared sections must resolve to contiguous direct source children
or a complete structured array with unique item identities. Existing sections
drag only within their region. Add before/after inserts validated templates for
Astro-backed regions; arbitrary page-wide and cross-region drops are not
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
  demoPages?: Array<{ id: string; label: string; path: string; description: string }>;
  maxChanges?: number;
  maxTextLength?: number;
  maxRequestBytes?: number;
  maxSourceFileBytes?: number;
  requestTimeoutMs?: number;
  receiptTtlMs?: number;
  historyLimit?: number;
  allowUnsafeSourceText?: boolean;
  allowRemoteDev?: boolean;
  editabilityRole?: 'owner' | 'editor';
  editabilityPolicyFile?: string;
}
```

`demoPages` is an optional local-demo route switcher. It is intended for test
fixtures and is not application navigation.

`allowUnsafeSourceText` and `allowRemoteDev` are expert escape hatches and are
both disabled by default.

## Current boundaries

- Local `astro dev` only; no authenticated production CMS.
- Exact rendered values can be discovered in Astro, Markdown/frontmatter,
  JSON/JSONC and YAML; ambiguous candidates require owner confirmation.
- Unstructured MDX body expressions are refused.
- Section setup can map contiguous Astro children and complete JSON/JSONC or
  YAML arrays. Markdown body heading reordering and filtered, merged or
  transformed subsets are not inferred automatically.
- No arbitrary page-wide or cross-region section drops.
- Checksummed local receipt history survives a complete dev-server restart and
  refuses unsafe restore when the record or saved file no longer matches.
- If rendered output cannot be reversed to one validated source target, the
  editor refuses the write instead of guessing.

Documentation and support:

- [Product page](https://opace.agency/tools/astro/visual-editor/)
- [GitHub repository](https://github.com/OpaceDigitalAgency/astro-visual-editor)
- [Full configuration and source-mapping guide](https://github.com/OpaceDigitalAgency/astro-visual-editor#configuration)
- [Security model](https://github.com/OpaceDigitalAgency/astro-visual-editor/security/policy)
- [Contributing](https://github.com/OpaceDigitalAgency/astro-visual-editor/blob/main/CONTRIBUTING.md)
- [Security policy](https://github.com/OpaceDigitalAgency/astro-visual-editor/security/policy)

MIT © 2026 [Opace Digital Agency](https://opace.agency/services/web-design/).

Need help implementing Astro? Explore [Astro development](https://opace.agency/services/web-design/astro-development/),
[web design](https://opace.agency/services/web-design/) or [contact Opace](https://opace.agency/get-in-touch/).
