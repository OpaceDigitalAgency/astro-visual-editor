# Astro Visual Editor — Strategic Product Review

**Date:** 4 August 2026  
**Scope:** Product strategy, functionality improvements, and third-party integration opportunities

---

## The Real Problem This Needs to Solve

Your research assessment identified four goals. Let's be honest about where things stand:

| Goal | Current State | Gap |
|---|---|---|
| **See all content for a single page in one place** — meta, headings, body, sections, component data | ✅ The rendered page IS the unified view — this is the killer insight | ❌ But the editor can only change plain text in `.astro` files. It can't touch JSON data, frontmatter, SEO meta, or component props. |
| **Quickly read, edit, and approve changes** without opening 3+ files | ✅ The queue/batch workflow is genuinely unique | ❌ But it only works for the developer running `astro dev` locally. The client/content editor — the person who actually NEEDS this — can't access it. |
| **Work across different Astro sites** with different architectures | 🟡 The integration model is portable | ❌ But source attribution is manual (annotations, mappings). Each new site requires developer configuration. |
| **Avoid a third-party hosted CMS** | ✅ Fully self-contained | ✅ This holds. |

**The brutal truth:** Right now this tool helps developers do something they could already do (edit source files). The people it should be helping — content editors, clients, marketing teams — can't use it at all.

---

## What Would Actually Make This Transformative

### 1. 🔥 Client-Accessible Editing via SSR + GitHub API (THE critical feature)

**The problem it solves:** Clients and content editors can click on the live site, make changes, and submit them for review — without touching code, terminals, or Git.

**How it works (proven pattern from Keystatic and Decap CMS):**

1. Deploy with an Astro SSR adapter (Netlify, Vercel, Cloudflare)
2. Add a protected `/admin` or `?edit=true` mode using Astro middleware
3. Authenticate with **Better Auth** (MIT, TypeScript-first, native Astro integration) or GitHub OAuth
4. Replace local `fs.writeFile()` with **Octokit** commits via `octokit-plugin-create-pull-request`
5. Edits go to a `content-edits` branch → auto-PR → developer reviews → merge triggers deploy

**Open-source tools to integrate:**

| Tool | Purpose | Licence |
|---|---|---|
| [Better Auth](https://better-auth.com) | Authentication — native Astro support, zero-config, supports GitHub/Google OAuth | MIT |
| [Octokit](https://github.com/octokit) + `octokit-plugin-create-pull-request` | GitHub API — commit file changes and create PRs in one call | MIT |
| [simple-git](https://github.com/steveukx/git-js) | Server-side Git — branch creation, staging, commits for local-mode fallback | MIT |

**This is what makes the tool commercially valuable.** It's the difference between "a nice dev utility" and "something we can offer clients as part of our Astro site builds."

**Recommended architecture:**

```
astro-visual-editor                        → Core integration (local dev mode)
@astro-visual-editor/github-provider       → GitHub API write layer
@astro-visual-editor/auth                  → Better Auth middleware wrapper
```

> [!IMPORTANT]
> This should be the #1 investment priority after basic P0 hardening. Without client access, the tool serves the wrong audience.

---

### 2. 🔥 Multi-File Source Tracing (Solve the Central Engineering Problem)

**The problem:** A heading on the page might come from `scraped-pages.json`, `why-choose-data.json`, or a component's frontmatter. Right now the editor just guesses it's in an `.astro` file and does a string search.

**What the tool should do:**

- At dev-server startup, scan all Astro pages and trace every `import`, `getCollection()`, `JSON.parse()`, and frontmatter reference to build a **source map** of which files contribute to which pages
- When a user clicks text, resolve it to the actual source file AND the specific property path (e.g., `services[3].description` in `scraped-pages.json`)
- Show the user: "This text comes from `src/data/services.json → services[3].description`"

**Open-source tools that help:**

| Tool | Purpose | Licence |
|---|---|---|
| [@astrojs/compiler](https://github.com/withastro/compiler) | Already a dependency. Parse `.astro` files to extract import statements and expression bindings | MIT |
| [es-module-lexer](https://github.com/nicolo-ribaudo/es-module-lexer) | Fast ESM import/export analysis — trace which data files feed into which pages | MIT |
| [jsonc-parser](https://github.com/microsoft/node-jsonc-parser) | Already a dependency. Navigate JSON by property path | MIT |
| [yaml](https://github.com/eemeli/yaml) | Already a dependency. Navigate YAML by property path | ISC |

**Why this matters:** This is what makes the visual editor genuinely superior to Keystatic or TinaCMS. Those tools require you to restructure content around their model. This tool works with YOUR existing architecture — if it can actually trace content back to its source.

The JSON and YAML adapters are already written in `structured.ts` and work correctly. They just aren't connected to anything.

---

### 3. 🔥 SEO Content Panel That Actually Works

**The problem:** Your research specifically called out "bulk review/editing of multiple pages' meta tags, URLs, and key content." The types for SEO editing (`SeoEditorChange`, `SeoValues`, `SeoField`) are defined but nothing is built.

**What it should do:**

- Read the rendered page's `<title>`, `<meta>`, OG tags, canonical URL, and robots directives
- Show them in an SEO panel alongside the page content
- When the editor changes the title, trace it back to the frontmatter field in the `.md`/`.mdx` file (e.g., `title` in `src/content/services/web-design.md`)
- Validate SEO best practices: title length (50-60 chars), description length (150-160 chars), missing OG tags, duplicate titles

**Open-source tools:**

| Tool | Purpose | Licence |
|---|---|---|
| [gray-matter](https://github.com/jonschlinkert/gray-matter) | Parse and serialise frontmatter in Markdown files — read and write SEO fields | MIT |
| [cheerio](https://github.com/cheeriojs/cheerio) | Parse rendered HTML server-side to extract current meta tags | MIT |

**Why this matters:** SEO meta editing is the #1 thing non-technical clients actually need to change frequently. Making this work properly would provide immediate, tangible value.

---

### 4. Content Schema Awareness from Zod

**The problem:** Your Astro Content Collections define Zod schemas that describe every field's type, validation, and constraints. The editor knows nothing about this.

**What it should do:**

- Read exported Zod schemas from content config to understand field types
- When editing a value, show the field type, description, and validation constraints
- Prevent invalid edits before they reach the source file (e.g., a date field, an enum, a required field)
- Auto-generate appropriate editor controls (text input for strings, datepicker for dates, dropdown for enums)

**How:** Export Zod schemas from a shared location and import them at dev-server startup. Zod's `.safeParse()` gives free validation. No complex introspection needed.

---

### 5. Visual Diff Before Commit

**The problem:** The current ledger shows "old text / new text" but you can't see the actual file-level impact of your changes.

**What it should do:**

- Before committing, show a proper unified diff of every file that will change
- Highlight exactly which lines are affected
- Show context around the changes

**Open-source tool:**

| Tool | Purpose | Licence |
|---|---|---|
| [diff](https://github.com/kpdecker/jsdiff) | Generate unified diffs between file versions — the standard JS diff library | BSD-3 |
| [diff2html](https://github.com/rtfpessoa/diff2html) | Render diffs as beautiful side-by-side or unified HTML | MIT |

This is a small effort for a large UX improvement. The handoff already calls for it in Phase 3.

---

### 6. Page Content Inventory & Audit

**The problem:** The handoff identifies that users can't tell why something is or isn't editable. More broadly, there's no way to see "what content exists on this page and where does it come from?"

**What it should do:**

- List every text node on the current page
- For each: show the source file, property path, and why it is/isn't editable
- Flag SEO issues: missing titles, descriptions, headings, broken heading hierarchy
- Provide "make this editable" actions for authorised owners

This addresses the "Editability Setup" urgent enhancement from the handoff AND provides content audit value.

---

### 7. Keystatic as a Complementary Admin Fallback

**The problem:** The visual editor is excellent for on-page editing but terrible for bulk operations — editing 50 pages' meta titles, managing blog post drafts, or working with structured data tables.

**What to do:** Don't compete with Keystatic — **complement it**. Your research already recommends this:

> "Install Keystatic alongside the visual editor. It gives clients a basic admin panel immediately."

Recommend it in the documentation as the companion tool for structured/bulk editing, while the visual editor handles on-page, in-context editing. Consider a deep integration where Keystatic's collection config and the visual editor's selector mappings can share a common content registry.

---

### 8. 🔥 Editability Controls — Visual Configuration for Admins

**The problem:** Right now the only way to control what's editable is through code — `editableSelectors` in `astro.config.mjs` and `data-astro-*` attributes scattered across templates. A site owner can't look at the live page and say "make this editable" or "lock this down" without editing source code.

**What currently exists:**

| Control | How it works | Who can use it |
|---|---|---|
| `editableSelectors: ['h1', 'p', ...]` | Config array of CSS selectors that defines which HTML tags are clickable | Developer only (code) |
| `excludeSelectors: ['pre', 'code', ...]` | Config array of CSS selectors that are never editable | Developer only (code) |
| `data-astro-editable` | Force any element to be editable regardless of tag | Developer only (template HTML) |
| `data-astro-edit-ignore` | Exclude a specific element from editing | Developer only (template HTML) |
| `data-astro-edit-file="..."` | Tell the editor which source file owns this element | Developer only (template HTML) |
| `data-astro-edit-path="hero.title"` | Map rendered text to a JSON/YAML property path | Developer only (template HTML) |
| Smart leaf-node filtering | Elements with child elements are auto-excluded unless explicitly marked `data-astro-editable` | Automatic |

**What's completely missing:**

1. **No visual editability UI** — an admin should be able to hold Shift (or enter an "admin mode"), click any element, and toggle it editable/ignored. This should write the corresponding `data-astro-editable` or `data-astro-edit-ignore` attribute back to the source template.

2. **No feedback when something isn't editable** — if you click a `<span>` or a `<div>` and nothing happens, there's no indication *why*. The toolbar should show: "This element is not editable because: `<span>` is not in editableSelectors" or "This element has child elements — add `data-astro-editable` to force it".

3. **No role-based permissions** — there's no concept of "editors can change body text but not navigation" or "only admins can edit SEO fields". Every authenticated user gets the same access.

4. **No per-region locking** — you can't say "the hero section is editable but the pricing table isn't" without manually adding `data-astro-edit-ignore` to every element in the excluded area. There's no region-level on/off switch.

5. **No editable content audit** — there's no panel showing "here's everything on this page that IS editable, and here's everything that ISN'T, and here's why". This is critical for site handover to clients.

**What it should do:**

- **Admin mode**: A toolbar toggle that overlays every element with a colour-coded indicator — green for editable, red for excluded, grey for not matched by selectors
- **Click-to-configure**: In admin mode, clicking an element opens a config panel: "Make editable / Exclude / Set source file / Set property path"
- **Changes persist to source**: The admin mode writes `data-astro-*` attributes back to the template file using the same adapter pipeline
- **Role matrix**: A simple permission config — `roles: { editor: ['text'], admin: ['text', 'seo', 'sections'] }` — so different users see different editing capabilities
- **Editability report**: A panel listing all elements on the page, grouped by status (editable / excluded / unmatched), with the reason and source file

> [!IMPORTANT]
> This is the feature that makes the tool usable for site handovers. Without it, every new Astro site requires the developer to manually annotate templates before a client can use the editor. That's the exact bottleneck this tool is supposed to eliminate.

---

### 9. 🔥 Safety Net — Guaranteed Revert After Broken Edits

**The problem you experienced:** An edit looks fine in the preview, you click save, but the actual source file change breaks something — CSS stops applying because an attribute got corrupted, a JS expression breaks because of an apostrophe, a closing tag gets eaten by the string replacement. The page looks destroyed and there's no way to undo it.

**What currently exists for safety:**

| Protection | Status | Limitation |
|---|---|---|
| **Pre-save validation** (`validateAstro`) | ✅ Runs `@astrojs/compiler` transform on the output before writing | Only catches parse errors, not visual breakage |
| **Ambiguity rejection** | ✅ Refuses edits where `oldText` appears more than once | Good, but doesn't prevent wrong-location matches |
| **Unsafe character blocking** | ✅ Blocks `<`, `>`, `{`, `}` in new text unless `allowUnsafeSourceText` is enabled | Prevents some structural damage |
| **Atomic writes** | ✅ Uses temp file + rename so partial writes can't corrupt files | Good |
| **Batch rollback** | ✅ If any file in a multi-file batch fails to write, already-written files are restored | Good |
| **In-memory revert** | ✅ `TransactionManager` stores pre-edit file snapshots and can revert the last commit via receipt ID | Only survives until the dev server restarts |
| **Hash-based stale detection** | ✅ Checks file hash hasn't changed between read and write | Prevents overwriting concurrent edits |

**What's critically missing:**

1. **No persistent undo history** — the in-memory revert is lost when the dev server restarts or HMR cycles. If you save a bad edit, close the browser, and come back — it's gone. The only undo is manually reverting the file with your code editor or Git.

2. **No visual validation** — the compiler check (`validateAstro`) only catches syntax errors. An edit that produces valid Astro but visually destroys the page (e.g., replacing text inside a `class` attribute, or breaking a CSS custom property) passes validation and gets written.

3. **No Git integration** — there's no automatic commit before/after edits. If the tool writes a bad change to disk, the only recovery is hoping you had uncommitted changes you can `git checkout -- .` to restore, or that you committed recently enough to `git diff` your way back.

4. **No deployed site protection** — when the tool moves to client-accessible SSR mode, a bad edit committed via the GitHub API and auto-deployed to Netlify/Vercel will take the live site down. There's no rollback mechanism beyond manually reverting the Git commit.

> [!CAUTION]
> **This is a trust-destroying failure mode.** If a client uses the editor, clicks save, and the site breaks — they will never trust the tool again. This happened in the earliest version and is the reason development was paused. Any production release MUST have a bulletproof revert path.

**What MUST be built:**

**A. Git-backed edit history (non-negotiable for production)**

Every edit batch should create a Git commit — either locally via `simple-git` or remotely via Octokit. This gives you:

- `git log` showing exactly what changed, when, and who did it
- `git revert <commit>` to undo any specific edit batch
- `git diff HEAD~1` to see exactly what the editor changed
- Full history even if the dev server crashes, the browser closes, or the machine restarts

For the GitHub provider (Phase B), this is automatic — every edit is a commit on a branch. For local dev mode, it should be opt-in: `visualEditor({ gitCommit: true })` wraps every save batch in `git add . && git commit -m "visual-editor: edited 3 files"`.

**B. Pre-deploy preview gate (for client-accessible mode)**

When edits go through GitHub:
1. Edit creates a commit on a `content-edits/[timestamp]` branch
2. Auto-PR is created with a diff summary
3. Netlify/Vercel auto-builds a **deploy preview** from that branch
4. Editor sees: "Your changes are ready for review → [Preview link]"
5. Developer (or the editor themselves) can verify the preview looks correct before merging
6. If the preview is broken → close the PR, changes never reach production

This is the exact workflow Keystatic and Decap CMS use. It's proven and it eliminates the "edit → deploy → site breaks" failure mode entirely.

**C. One-click revert in the toolbar (for local dev mode)**

- Persist revert receipts to disk (a `.astro-visual-editor/history/` directory) so they survive server restarts
- Show a history panel: "Last 10 edit batches" with timestamps, file lists, and a "Revert" button
- For Git-backed mode: the revert button runs `git revert --no-edit <commit>` so the undo itself is tracked

**D. Visual regression check (stretch goal)**

- After applying edits but before writing to disk, render the changed file in a headless browser (Playwright) and compare a screenshot against the pre-edit state
- Flag visually significant changes: "The layout of this section changed significantly — review before saving"
- This catches the class of bugs where valid Astro produces broken visual output

**Open-source tools:**

| Tool | Purpose | Licence |
|---|---|---|
| [simple-git](https://github.com/steveukx/git-js) | Local Git commits for every edit batch | MIT |
| [Octokit](https://github.com/octokit) + `octokit-plugin-create-pull-request` | GitHub commits + auto-PR for deployed mode | MIT |
| [Playwright](https://playwright.dev) | Visual regression screenshots (already a devDependency) | Apache-2.0 |
| [pixelmatch](https://github.com/mapbox/pixelmatch) | Pixel-level image comparison for visual regression | ISC |

---

## Prioritised Roadmap (Product-First)

### Phase A — Make it safe and actually useful (~2-3 weeks)

1. **Git-backed edit history** — every save batch creates a local Git commit via `simple-git` with `visualEditor({ gitCommit: true })`. Non-negotiable before any wider use.
2. **Persistent revert history** — write revert receipts to `.astro-visual-editor/history/` so they survive server restarts. Show a history panel in the toolbar.
3. **Wire up the JSON/YAML adapters** that already exist in `structured.ts`
4. **Build basic source tracing** — follow `.astro` file imports to find which JSON/YAML files contribute data
5. **SEO meta panel** — read rendered meta tags, map them to frontmatter sources
6. **Visual diff** before commit using `jsdiff` + `diff2html`

### Phase B — Make it client-accessible with guaranteed safety (~3-4 weeks)

7. **GitHub provider package** — replace `fs.writeFile()` with Octokit commits → auto-PR
8. **Branch/PR workflow with deploy previews** — edits go to a branch, auto-build a preview, developer reviews, merge deploys. Bad edits never reach production.
9. **Authentication** with Better Auth — protect the editor behind login
10. **SSR deployment mode** — Astro middleware for authenticated editing on deployed sites
11. **One-click revert via Git** — revert button in the toolbar runs `git revert` (local) or closes the PR (GitHub mode)

### Phase C — Make it configurable and intelligent (~2-3 weeks)

12. **Editability admin mode** — visual overlay showing what's editable/excluded/unmatched, with click-to-configure
13. **Editability audit panel** — list all elements on the page with their status and reasoning
14. **Role-based permissions** — `roles: { editor: ['text'], admin: ['text', 'seo', 'sections'] }`
15. **Content schema awareness** — read Zod schemas, validate edits, show field metadata
16. **Page content inventory** — list all text on the page with source attribution
17. **Shared-content warnings** — detect when editing a value that appears on multiple pages

### Phase D — Make it production-grade (~2 weeks)

18. **Audit logging** — who edited what, when, and where
19. **Multi-user safety** — conflict detection when two editors change the same content
20. **Visual regression checks** — Playwright screenshot comparison before writing (stretch goal)
21. **Bulk operations** — edit the same field across multiple pages
22. **Keystatic integration** — share content registry, deep link between visual editor and admin panel

---

## The Commercial Angle

This tool has genuine commercial value for an agency like Opace if Phases A and B are completed:

- **Sell it as part of Astro site builds**: "Your site comes with a built-in visual editor. Click on any text, change it, submit for review."
- **Reduce support tickets**: Clients can fix their own typos, update meta descriptions, and change headings without emailing you.
- **Differentiate from competitors**: No other agency offers this. The nearest alternative (CloudCannon, TinaCMS) requires restructuring the site or paying per-seat SaaS fees.
- **Open-source ecosystem play**: If published, it fills a genuine gap in the Astro ecosystem. The research proves no one else has solved this.

> [!CAUTION]
> None of this value materialises if the tool only works for developers on localhost. Phase B (client access) is the make-or-break feature. Without it, this is a nice developer utility that solves a problem developers were already solving.

---

## Summary: What to Build vs What to Fix

| Category | What | Time |
|---|---|---|
| **Fix now** | The 6 red bugs from the code review | < 1 hour |
| **Build first** | Git-backed safety net + persistent reverts + adapters + source tracing + SEO panel + diffs | ~2-3 weeks |
| **Build next** | GitHub provider + branch/PR workflow + deploy previews + authentication | ~3-4 weeks |
| **Build after** | Editability admin mode + role permissions + schema awareness + content inventory | ~2-3 weeks |
| **Don't build yet** | Visual regression, remote collaboration, desktop app | Later |

> [!WARNING]
> **The safety net (Git-backed history + persistent reverts) must come before any other feature work.** The earliest version of this tool destroyed pages, which killed confidence and halted development. If that happens again — especially with client-facing access — the tool is dead. Every edit must be revertable, always, even after server restarts, browser closes, or deployment.

The code bugs are mostly fixed. The real work is Phases A and B — safety + client access — and they're what determine whether this project matters or not.
