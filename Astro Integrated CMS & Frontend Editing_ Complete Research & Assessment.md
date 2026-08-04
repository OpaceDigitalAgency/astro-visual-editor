# Astro Integrated CMS & Frontend Editing: Complete Research & Assessment

> **Review status — 4 August 2026:** This document contains the original market
> assessment and legacy-editor findings. Product availability, pricing and
> third-party feature claims must be reverified before a purchasing decision.
> The extracted standalone package has a different, safer architecture and does
> not yet include every legacy feature described below. For current engineering
> truth, priorities and takeover instructions, read
> [ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md](./ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md).

## The Goal

To find a plugin, add-on, or integrated tool for Astro that allows you to:

1. **See all content for a single page in one place** — meta tags, URL/slug, headings, body content, section data, component props — regardless of how many source files contribute to that page.
2. **Quickly read, edit, and approve changes** without opening 3+ separate files in a code editor.
3. **Work across different Astro sites** that use different layouts, components, file structures, and data patterns.
4. **Avoid a third-party hosted CMS** — the solution should be self-contained, self-hosted, or integrated directly into the Astro project.

---

## The Problem

A typical Astro service page has its content distributed across multiple files for valid architectural reasons:

| File | Contains | Why It's Separate |
|------|----------|-------------------|
| `page-x.md` (frontmatter) | SEO meta title, description, schema, slug | Standard Astro Content Collection pattern |
| `scraped-pages.json` | Body/paragraph content for the page | Structured data source, possibly shared or imported |
| `why-choose-data.json` | Reasons, timelines, feature lists | Reusable structured data referenced by multiple pages |
| Layout/component files | Visual structure, section ordering | Separation of concerns (design vs content) |

**Why this architecture is valid:**

- **Reuse:** A `why-choose-data.json` entry might be referenced by 5 different service pages. Duplicating it into each page's frontmatter creates a maintenance nightmare.
- **Structured data:** Complex nested objects (timelines, pricing tables, FAQ arrays) are cleaner in JSON than crammed into YAML frontmatter.
- **Separation of concerns:** Keeping layout logic in components and content in data files is good engineering practice.
- **Import/migration:** Content scraped or imported from external sources naturally lands in JSON format.
- **Team workflows:** Different team members may own different data files (SEO team owns meta, content team owns body copy, dev team owns component data).

**The gap in current tooling:** Every CMS tool assumes a **1:1 relationship** between a content entry and a page. None of them natively support a **many-to-one composition model** where a single rendered page is assembled from multiple independent data sources at build time.

---

## Complete Research: Available Tools & How They Handle This

### Category 1: Visual & Inline Editing Solutions

These tools let editors click on elements in a live page preview and edit them directly.

---

#### TinaCMS (Self-Hosted)

**Website:** [tina.io](https://tina.io/) | **GitHub:** [tinacms/tinacms](https://github.com/tinacms/tinacms) | **License:** Apache 2.0

TinaCMS is an open-source, Git-backed CMS that has made Astro its default starter framework as of 2026. It offers visual editing where editors can click on page elements and edit them in a sidebar, with changes saved as Git commits to Markdown/MDX/JSON files [1].

**How it works with Astro:** You wrap editable sections in `<TinaIsland>` components. When an editor types, Astro re-renders just the edited section with draft content and TinaCMS swaps it into the preview without reloading the page. The latest version uses React-free visual editing — no React shipped to visitors [2].

**Self-hosting:** Fully self-hostable. You run your own TinaCMS backend with your choice of database (MongoDB, Postgres), authentication (Auth.js), and Git provider. No dependency on TinaCloud required [3].

**Multi-file support:** TinaCMS defines content models in `tina/config.ts`. Each model typically maps to a single collection (folder of files). It does **not** natively aggregate multiple JSON files + frontmatter into one editing view. You would need to restructure content into a single-source-per-page model, OR define separate collections and switch between them in the sidebar.

**Verdict for your problem:** Excellent visual editing, but requires content to live in a predictable single-file-per-page pattern. Does not solve the multi-file composition problem out of the box.

---

#### Netlify Visual Editor

**Website:** [docs.netlify.com/manage/visual-editor](https://docs.netlify.com/manage/visual-editor/) | **Guide:** [Add Visual Editor to Astro](https://developers.netlify.com/guides/add-visual-editor-to-astro-website/)

Netlify Visual Editor (formerly Stackbit) provides inline editing by annotating your HTML elements with `data-sb-object-id` and `data-sb-field-path` attributes. The editor maps on-screen elements to their source content files [4].

**How it works with Astro:** You add data attributes to your Astro components. The editor reads these annotations to understand which content source each element belongs to. It supports Git-based content (Markdown files) and can work with multiple content directories [5].

**Multi-file support:** The annotation system is actually quite flexible — you can scope different parts of the page to different content sources using `data-sb-object-id`. In theory, you could annotate your hero section to point at one JSON file and your body content to point at another. However, the sidebar editing panel still shows fields per-model, not a unified "everything on this page" view.

**Verdict for your problem:** The annotation system is the closest to supporting multi-source pages, but it requires Netlify hosting and significant annotation work per component. Still doesn't give you a single unified editing view.

---

#### CloudCannon (Astro Component Starter)

**Website:** [cloudcannon.com/astro-cms](https://cloudcannon.com/astro-cms/) | **Blog:** [Introducing the Astro Component Starter](https://cloudcannon.com/blog/introducing-the-astro-component-starter/)

CloudCannon provides a visual page builder where editors can add, remove, and reorder entire sections (your Astro components) on a page. Their "Astro Component Starter" ships with 30+ pre-built components and a design token system [6].

**How it works with Astro:** Components are defined with CloudCannon schemas. Editors assemble pages by dragging components into regions. Content lives in your Git repository. The editing experience includes inline text editing, component reordering, and structured field editing in a sidebar [7].

**Multi-file support:** CloudCannon's model is component-based — each page is a composition of blocks. However, it expects content to be defined in a single page file (with blocks/arrays in frontmatter), not scattered across multiple JSON files.

**Verdict for your problem:** Excellent for new projects designed around its component model. Would require restructuring existing sites to fit its single-file-per-page pattern. Commercial SaaS product.

---

### Category 2: Git-Based Admin Panels & Dashboards

These provide a clean admin UI for editing content files without visual on-page editing.

---

#### Keystatic

**Website:** [keystatic.com](https://keystatic.com/) | **Astro Docs:** [Keystatic & Astro](https://docs.astro.build/en/guides/cms/keystatic/) | **License:** MIT

Built by Thinkmill (the team behind KeystoneJS), Keystatic is the most popular developer-focused Git CMS for Astro. It adds a `/keystatic` admin route to your site with a React-based UI that reads and writes directly to your local file system [8].

**How it works with Astro:** You define collections and singletons in `keystatic.config.ts` using a TypeScript schema API. It supports Markdown, MDX, Markdoc, JSON, and YAML files. The admin UI renders appropriate form controls for each field type [9].

**Multi-file support:** Keystatic can define **multiple collections** (e.g., "services", "why-choose-data", "seo-meta") and **singletons** (for shared data files). However, each collection is edited separately — there is no "show me everything that appears on Page X" aggregate view. You would see your services collection, click into a service, edit its fields, then separately navigate to the why-choose collection to edit that data.

**Verdict for your problem:** The best free, open-source admin panel for Astro. Works today with minimal setup. But it shows content per-collection, not per-page. You'd still be jumping between different collection entries to review a single page.

---

#### Sveltia CMS

**Website:** [sveltiacms.app](https://sveltiacms.app/en/docs/intro) | **GitHub:** [sveltia/sveltia-cms](https://github.com/sveltia/sveltia-cms) | **License:** MIT

Sveltia CMS is an open-source, modern rewrite and successor to Netlify CMS (Decap CMS). It's a lightweight SPA (<650KB) that authenticates with GitHub/GitLab and provides a full admin dashboard [10].

**How it works with Astro:** You drop a single HTML file into your `public/admin/` folder with a `config.yml` that defines your collections. It manages Markdown files with frontmatter and can handle multiple content folders.

**Multi-file support:** Like Decap CMS before it, Sveltia organises content by collection. Each collection maps to a folder of files. It cannot aggregate data from multiple JSON files into a single editing view for one page.

**Key strengths:** First-class i18n/multilingual support; maintenance-free (runs entirely in the browser via CDN); easy migration from Decap/Netlify CMS.

**Verdict for your problem:** Excellent lightweight CMS for simple content structures. Does not solve the multi-file aggregation problem.

---

#### GitCMS

**Website:** [gitcms.dev](https://gitcms.dev/) | **Astro Docs:** [GitCMS & Astro](https://docs.astro.build/en/guides/cms/gitcms/)

GitCMS provides a Notion-like block editor that sits on top of your GitHub repository. It's designed for writers who want a polished editing experience without understanding Git [11].

**How it works:** Writers edit in a Notion-like interface with slash commands, drag-and-drop blocks, and inline formatting. Changes are committed to branches, enabling draft/review workflows via PRs [12].

**Multi-file support:** GitCMS operates per-file. It gives you a beautiful editor for individual Markdown files but does not aggregate multiple source files into a page-level view.

**Verdict for your problem:** Great writing experience but doesn't address the multi-file composition issue. Paid product ($49/month per site).

---

#### Pageel CMS

**Website:** [pageel.com](https://www.pageel.com/) | **GitHub:** [pageel/pageel-cms](https://github.com/pageel/pageel-cms) | **License:** MIT

Pageel is a lightweight, self-hosted, Git-based CMS built natively for Astro using Astro 6 SSR. It uses Git as the database and provides a Notion-inspired editing experience with server-side authentication [13].

**How it works:** It runs as an Astro SSR application that reads your GitHub repository. It supports multi-collection architecture (Blog, Docs, Projects as independent collections), WYSIWYG editing via MDXEditor, and server-side auth so Git tokens never reach the browser [14].

**Multi-file support:** Manages multiple collections independently. Does not provide a unified per-page view across collections.

**Verdict for your problem:** Clean, modern, Astro-native. But same limitation — collection-based, not page-composition-based.

---

#### Sitepins

**Website:** [sitepins.com](https://sitepins.com/) | **Blog:** [Visual Editor for Astro Websites](https://sitepins.com/blog/visual-editor-for-astro-websites)

Sitepins is a hosted service that connects to your GitHub repository and provides a form-based editing interface for non-technical editors. It reads your Astro Content Collections and generates editing forms automatically from your frontmatter fields [15].

**How it works:** You connect your repo, point it at your `src/content/` folder, and it auto-detects field types from your existing frontmatter. Editors get labelled form fields (Title, Date, Body, Featured Image) and a rich text toolbar.

**Multi-file support:** Only manages files within the content folders you point it at. Cannot aggregate multiple JSON data files into one view.

**Verdict for your problem:** Simple setup, but limited to Content Collection markdown files only.

---

### Category 3: Database-Backed Astro-Native CMSs

These use a real database (SQLite, LibSQL, D1, PostgreSQL) instead of Git/Markdown.

---

#### StudioCMS

**Website:** [studiocms.dev](https://studiocms.dev/) | **GitHub:** [withstudiocms/studiocms](https://github.com/withstudiocms/studiocms) | **License:** MIT

StudioCMS is a community-built, SSR Headless CMS built specifically for the Astro ecosystem. It uses LibSQL/Turso (or any supported database) and provides a full admin dashboard within your Astro app [16].

**How it works:** Installs as an Astro integration. Content is stored in a database with a custom rendering system. Supports multiple content formats (Markdown, MDX, Markdoc, HTML, WYSIWYG) via plugin packages [17].

**Multi-file support:** Since it uses a database, content is stored per-entry rather than per-file. You could theoretically model a page as a single database entry with all its fields (meta, body, sections). However, this means migrating all your existing file-based content into the database.

**Verdict for your problem:** Could work if you're willing to migrate to a database model. Currently in Beta (0.1.0-beta.x) with potential breaking changes.

---

#### WollyCMS

**Website:** [wollycms.com](https://wollycms.com/) | **GitHub:** [wollycms/wollycms](https://github.com/wollycms/wollycms) | **License:** MIT

WollyCMS is a self-hosted, open-source headless CMS that brings Drupal-like block composition to Astro. It features composable block-based pages with named regions, reusable block instances, and a visual page builder [18].

**How it works:** It runs as a separate Hono API server with a SvelteKit admin UI. Pages are composed of typed blocks arranged in named regions (hero, content, sidebar). The `@wollycms/astro` package provides a `BlockRenderer` component that maps CMS blocks to your Astro components [19].

**Multi-file support:** This is the **closest to solving your problem architecturally**. WollyCMS's model is inherently compositional — a single page is built from multiple reusable blocks, each with their own data. The admin panel shows you the complete page with all its regions and blocks in one view. You can see meta fields, hero content, body blocks, sidebar blocks, and timeline sections all on one screen.

**However:** It requires migrating your content into WollyCMS's database model. It's a separate server you need to run alongside your Astro frontend. And your existing Astro components would need to be re-mapped as WollyCMS block types.

**Verdict for your problem:** The best architectural match for multi-source page composition. But requires a significant migration effort and running additional infrastructure.

---

#### EmDash (by Cloudflare)

**Website:** [github.com/emdash-cms/emdash](https://github.com/emdash-cms/emdash) | **Blog:** [Cloudflare Announcement](https://blog.cloudflare.com/emdash-wordpress/)

EmDash is a full-stack TypeScript CMS built on Astro and Cloudflare Workers. Released in 2026, it positions itself as a modern WordPress replacement with sandboxed plugins, Portable Text content storage, and AI-first design [20].

**How it works:** Installs as an Astro integration. Uses Cloudflare D1 (SQLite) for storage and R2 for media. Content types are defined in the database via an admin UI (not in code). Content is stored as Portable Text (structured JSON) rather than HTML [21].

**Multi-file support:** Since content lives in a database with structured types, each page is a single entry with all its fields visible in one admin panel view. Custom content types can have as many fields as needed (meta, body, sections, etc.).

**Verdict for your problem:** Good architectural fit (database-per-page model shows everything in one place). But heavily tied to Cloudflare infrastructure, currently in Beta, and requires full content migration.

---

### Category 4: IDE-Based & Desktop Editors

---

#### Astro Editor (Desktop App)

**Website:** [astroeditor.danny.is](https://astroeditor.danny.is/) | **License:** Open Source

A native macOS/Windows/Linux desktop app designed specifically for editing Markdown/MDX content in Astro Content Collections. It reads your `content.config.ts` Zod schemas and renders frontmatter as proper form controls [22].

**How it works:** Opens your local Astro project, detects collections, and shows each entry with schema-aware forms for frontmatter plus a distraction-free Markdown editor for the body.

**Multi-file support:** Operates per-file only. Shows one content file at a time.

**Verdict for your problem:** Beautiful for writing, but doesn't aggregate multiple files per page.

---

#### astro-md-editor (CLI/Web)

**Website:** [github.com/bimsina/astro-md-editor](https://github.com/bimsina/astro-md-editor)

A schema-aware web-based editor you run locally via `npx astro-md-editor`. It reads your Astro collection schemas and provides form controls for frontmatter plus a Markdown editor [23].

**How it works:** Run `npx astro-md-editor` in your project root. It starts a local web server with an editing UI that validates against your Zod schemas.

**Multi-file support:** Per-file only.

**Verdict for your problem:** Quick and useful for individual file editing, but same limitation.

---

#### Front Matter CMS (VS Code Extension)

**Website:** [frontmatter.codes](https://frontmatter.codes/) | **License:** MIT

A VS Code extension that brings a full CMS dashboard directly into the code editor. Provides content management, media library, SEO checks, and page previews without leaving VS Code [24].

**How it works:** Installs as a VS Code extension. Provides a dashboard panel showing all your content files, with form-based editing for frontmatter and a media manager.

**Multi-file support:** Shows files individually. You can define multiple content types and folders, but there's no "aggregate view per page."

**Verdict for your problem:** Useful as a daily driver for content editing, but doesn't solve the unified page view problem.

---

### Category 5: Custom-Built Solution — Astro Visual Editor (Our Own Tool)

This is a custom-built, in-browser visual editor overlay for Astro websites that takes a fundamentally different approach from every tool listed above.

#### Astro Visual Editor (Custom / In-House)

**Legacy prototype:** Dev-only browser overlay using client-side JavaScript and
local API routes.

**Extracted package:** MIT-licensed Astro integration using Astro's native Dev
Toolbar and toolbar server channel. It is located in this repository and is the
implementation that future work should extend.

Unlike every other tool researched, this editor works with the **rendered page itself** as the unified view. Instead of trying to understand your file architecture, it lets you click on visible content in the browser — regardless of which source file it originates from — and edit it in place.

**How the legacy prototype worked:**

1. A script (`visual-editor-v2.js`) loads in dev mode only via `import.meta.env.DEV`.
2. It overlays editing controls onto the live Astro page at `localhost:4321`.
3. Three editing modes are provided:
   - **Text editing:** Click any heading, paragraph, link, or button to edit it in a modal.
   - **Section editing:** Sections marked with `data-section` can be moved up/down, added, or deleted.
   - **SEO editing:** A panel displays editable meta title, description, keywords, and canonical URL.
4. All changes are queued (not immediately saved). The queue shows each change with its type, new value, and detected source file.
5. On "Save All," changes are sent to local Astro API routes that perform text find-and-replace in the source files.
6. Astro's dev server hot-reloads the page with the updated content.

**Current extracted-package status:** The safe text preview, queue, undo, clear
and commit workflow has been rebuilt as a standalone integration. Experimental
section manipulation and SEO persistence were deliberately not carried forward
because their regex-based write paths were incomplete. They belong in a later
phase after syntax-aware source adapters exist.

**Why this remains a promising approach for multi-file sites:**

The browser renders the fully composed page — all JSON data, all frontmatter and
all component content assembled together. This makes the page an excellent
unified discovery and review surface. It does **not**, by itself, solve source
attribution: reliable persistence still requires a mapping from each rendered
value to a source file plus a structured path or source range.

**The queue/batch model** is also unique among all tools researched. No other Astro editing tool lets you make multiple changes across a page, review them all together, selectively undo individual edits, and then commit everything in one batch. This maps directly to an editorial approval workflow.

**Current concept and package strengths:**

- Can support varied Astro architectures through explicit mappings and future
  source adapters; the current implementation is not universal
- No migration, no database, no external service
- The rendered page provides a unified discovery and review view
- Batch queue with review/undo before committing
- Development-mode only (safe; never ships to production)
- Git remains the safety net (changes appear as working-tree modifications)

**Current limitations and concerns:**

| Concern | Detail | Severity |
|---------|--------|----------|
| **Source file detection** | Uses heuristics (route mapping, DOM context) to guess which `.astro` file to edit. Will fail for content that actually lives in JSON data files or shared component files. | High |
| **No JSON write support** | The write mechanism does text find-and-replace in `.astro` files. Cannot currently locate and update a value inside a `.json` data file. | High |
| **SEO persistence incomplete** | The SEO panel UI exists but reading/writing meta tags from `.md` frontmatter is not fully wired up. | Medium |
| **Ambiguous text matches** | If the same text appears in multiple places in a file, the find-and-replace may edit the wrong occurrence. | Medium |
| **Section editing experimental** | Visual reordering works in the browser but persistent write-back for section moves is incomplete. | Medium |
| **Nested markup flattening** | Editing text that contains inline formatting (bold, links) may lose that formatting. | Low-Medium |
| **Localhost only** | Only works during `npm run dev`. Clients and non-technical users cannot access it on a deployed site. | **Critical** |

**The critical deployment problem:**

This tool is currently **developer-only**. It runs exclusively on `localhost:4321` during development. A client, content editor, or marketing team member cannot use it because:

1. They would need to clone the repo, install Node.js, and run `npm run dev` locally.
2. It is deliberately excluded from production builds (`import.meta.env.DEV` guard).
3. The write API (which modifies source files) only works against the local filesystem.

This makes it useful for bounded local developer review, but it does not yet
solve every source format or the client handoff problem.

**Recommendations to make it client/user accessible (deployed):**

To transform this from a dev tool into a client-facing editing solution on Netlify or similar, the architecture would need to shift from "edit local files" to "edit via Git API":

| Approach | How It Would Work | Complexity |
|----------|-------------------|------------|
| **A) SSR Admin Route with GitHub API** | Deploy the site in SSR mode (Astro + adapter). Add a protected `/admin/edit` route that loads the visual editor. Instead of writing to local files, the save action commits changes via the GitHub API (like Keystatic, Sveltia, and Decap do). Add authentication (OAuth, password, or magic link) to protect the route. | Medium-High |
| **B) Hybrid: Editor on a staging branch** | Deploy a separate "editing" instance of the site (e.g., `edit.yoursite.com`) that runs in SSR mode with the editor enabled. Saves commit to a `staging` branch via GitHub API. A PR is auto-created for review. Merging to `main` triggers the production build. | Medium |
| **C) Cloudflare Workers / Edge Function proxy** | Keep the site static but add an edge function at `/admin/*` that serves the editor UI and proxies write operations to the GitHub API. The editor script loads only when authenticated at the `/admin` path. | Medium |
| **D) Desktop app / Electron wrapper** | Package the dev server + editor into a desktop app (like Astro Editor does for Markdown). Client installs it, opens their project, edits visually, and the app handles Git commits. | High (but good UX) |

The most practical path is **Approach A or B**: deploy the site with an SSR adapter (Netlify, Vercel, Cloudflare), protect an `/admin` route with simple auth, and replace the local file-write API with GitHub API commits. This is essentially what Keystatic and Decap CMS already do for their write layer — but your visual editor would provide the superior "click on the page" editing experience on top.

**Verdict for your problem:** This is the strongest custom direction found in
the original research because it uses the composed page as the editing surface.
It still needs reliable source adapters, transaction hardening and broader
content coverage before it can claim architecture-independent editing. A
client-facing version would additionally require authentication and a Git-based
write/review layer.

---

### Category 6: Commercial/Hosted Solutions Worth Noting

| Tool | What It Does | Multi-File Support | Cost |
|------|-------------|-------------------|------|
| **Zero CMS** ([zerocms.io](https://www.zerocms.io)) | Claims to auto-read your `.astro` components and schemas to build a matching editing UI | Potentially the closest to your need — reads actual component structure | $79/month per site |
| **Builder.io** ([builder.io](https://www.builder.io/m/astro-cms)) | Visual drag-and-drop CMS with Astro integration | Database-backed; each page is one entry with all content | Free tier available; commercial |
| **WebcoreUI Builder** ([webcoreui.dev/build](https://webcoreui.dev/build)) | Visual component builder for Astro — prototype component combinations visually | Component assembly tool, not a content editor | Free (Beta) |

---

## Assessment: The Gap in the Market

### What Exists vs What You Need

| What You Need | What Currently Exists |
|---------------|----------------------|
| A unified view showing ALL content for a single page (meta + body + sections + component data) regardless of how many source files contribute | Tools that show content **per-file** or **per-collection**, requiring you to jump between entries |
| Support for pages composed from multiple data sources (JSON, YAML, MD frontmatter) assembled at build time | Tools that assume **one content entry = one page** |
| Works across different Astro site architectures without major restructuring | Tools that require a specific content architecture to function |
| Bulk review/editing of multiple pages' meta tags, URLs, and key content | Tools focused on editing one entry at a time |

### Why This Gap Exists

The fundamental assumption baked into every CMS tool (headless or otherwise) is that content has a **1:1 relationship with pages**. This comes from the WordPress/traditional CMS world where one database row = one page.

Astro's flexibility — where a page can pull data from anywhere (local JSON, remote APIs, multiple content collections, shared data files) — is architecturally superior for developers but creates a problem that no CMS has solved: **how do you provide an editing interface for a page whose content is assembled from N sources at build time?**

Your architecture of using separate files for reuse, structured data, and separation of concerns is **completely valid**. The tooling simply hasn't caught up.

### The Closest Solutions (Ranked)

**1. Astro Visual Editor (Custom/In-House)** — Uses the rendered page as a
unified discovery and editing view. It is the strongest candidate for targeted
investment, but multi-file architecture is not irrelevant: structured source
attribution is the central engineering problem still to solve.

**2. WollyCMS** — Its block-composition model (pages built from multiple reusable blocks in named regions) is the closest off-the-shelf architectural match to multi-source page patterns. The admin panel shows the complete composed page. But it requires migrating to its database model.

**3. Netlify Visual Editor** — Its annotation system can technically scope different parts of a page to different content sources. But it requires Netlify hosting and extensive annotation work.

**4. TinaCMS (Self-Hosted)** — If you consolidate content into single files per page, its visual editing is the best in class. The self-hosted option means no vendor dependency.

**5. Keystatic** — The most practical "start today" option for a basic admin panel. Free, drops right into Astro, and can manage multiple collections. You'd still jump between collections, but at least everything is in one admin panel.

### Practical Recommendations

**If you want something that works TODAY for developer review (no restructuring):**

Use the extracted **Astro Visual Editor** locally for annotated, simple-text
workflows during `npm run dev`. The rendered page is the unified review view and
the queue supports batch approval. Do not yet assume that expressions, JSON,
YAML, frontmatter, repeated values or arbitrary component structures can be
edited safely.

**If you want to make it client-accessible (the real goal):**

Invest in upgrading the Astro Visual Editor's write layer:

1. Replace local file system writes with **GitHub API commits** (the same pattern Keystatic, Decap, and Sveltia use).
2. Add **source-file detection for JSON files** — when a user edits text that originates from a `.json` data file, the editor needs to trace it back to the correct key/value pair.
3. Deploy the site in **SSR mode** with a protected `/admin` route that loads the editor for authenticated users only.
4. Add **simple authentication** (OAuth via GitHub/Google, or a password gate) so only authorised editors can access the editing overlay.
5. Wire up the **SEO panel** to read/write frontmatter fields properly.

This would give you a tool that no other product in the Astro ecosystem offers: a visual, click-on-the-page editor that works with any site architecture, shows all content in one unified view (the page itself), and lets non-technical clients edit and approve changes on a deployed site.

**If you want an off-the-shelf fallback while building the above:**

Install **Keystatic** alongside the visual editor. It gives clients a basic admin panel immediately (for simple edits like meta tags and blog posts), while you develop the visual editor into the full client-facing solution.

**If you want the best long-term solution for NEW projects:**

Design content around **WollyCMS** or adopt a single-file-per-page pattern with **TinaCMS**. Both give you the "see everything for this page in one place" experience, but require designing the content architecture around their model from the start.

**Research conclusion:** At the time of the original assessment, no reviewed
off-the-shelf tool provided the complete many-source, page-level view described
in the goal without content restructuring or external infrastructure. The
custom editor is a differentiated route because it starts from the rendered
page, but it requires the engineering programme in the linked handoff before it
can fulfil the complete requirement or support client-facing deployment.

---

## References

[1] [TinaCMS — Visual Editing for Astro Sites](https://tina.io/astro)
[2] [Astro is becoming the default starter for TinaCMS](https://tina.io/blog/astro-is-becoming-the-default-tinacms-starter)
[3] [TinaCMS Self-Hosted Overview](https://tina.io/docs/self-hosted/overview)
[4] [Netlify Visual Editor — Inline Editor Documentation](https://docs.netlify.com/manage/visual-editor/visual-editing/inline-editor/)
[5] [How to use Netlify Visual Editor with Astro](https://developers.netlify.com/guides/add-visual-editor-to-astro-website/)
[6] [Introducing the Astro Component Starter — CloudCannon](https://cloudcannon.com/blog/introducing-the-astro-component-starter/)
[7] [CloudCannon & Astro | Astro Docs](https://docs.astro.build/en/guides/cms/cloudcannon/)
[8] [Keystatic](https://keystatic.com/)
[9] [Keystatic & Astro | Astro Docs](https://docs.astro.build/en/guides/cms/keystatic/)
[10] [What is Sveltia CMS?](https://sveltiacms.app/en/docs/intro)
[11] [GitCMS & Astro | Astro Docs](https://docs.astro.build/en/guides/cms/gitcms/)
[12] [GitCMS vs Keystatic — Comparison](https://gitcms.dev/compare/gitcms-vs-keystatic/)
[13] [Pageel | The Git-based CMS Ecosystem for Astro](https://www.pageel.com/)
[14] [Pageel CMS — GitHub](https://github.com/pageel/pageel-cms)
[15] [Sitepins — Visual Editor for Astro Websites](https://sitepins.com/blog/visual-editor-for-astro-websites)
[16] [StudioCMS — The Astro-native CMS](https://studiocms.dev/)
[17] [StudioCMS — GitHub](https://github.com/withstudiocms/studiocms)
[18] [WollyCMS](https://wollycms.com/)
[19] [WollyCMS — GitHub](https://github.com/wollycms/wollycms)
[20] [EmDash CMS — GitHub](https://github.com/emdash-cms/emdash)
[21] [EmDash: a fresh take on CMS — Maciek Palmowski](https://maciekpalmowski.dev/blog/emdash-a-fresh-take-on-cms/)
[22] [Astro Editor](https://astroeditor.danny.is/)
[23] [astro-md-editor — GitHub](https://github.com/bimsina/astro-md-editor)
[24] [Front Matter CMS](https://frontmatter.codes/)
