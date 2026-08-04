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

## Prioritised Roadmap (Product-First)

### Phase A — Make it actually useful for the stated goal (~2 weeks)

1. **Wire up the JSON/YAML adapters** that already exist in `structured.ts`
2. **Build basic source tracing** — follow `.astro` file imports to find which JSON/YAML files contribute data
3. **SEO meta panel** — read rendered meta tags, map them to frontmatter sources
4. **Visual diff** before commit using `jsdiff` + `diff2html`

### Phase B — Make it client-accessible (~3-4 weeks)

5. **GitHub provider package** — replace `fs.writeFile()` with Octokit commits → auto-PR
6. **Authentication** with Better Auth — protect the editor behind login
7. **SSR deployment mode** — Astro middleware for authenticated editing on deployed sites
8. **Branch/PR workflow** — edits go to a branch, developer reviews, merge deploys

### Phase C — Make it intelligent (~2-3 weeks)

9. **Content schema awareness** — read Zod schemas, validate edits, show field metadata
10. **Page content inventory** — list all text on the page with source attribution and editability status
11. **Editability setup mode** — let owners configure what's editable through the toolbar, not code
12. **Shared-content warnings** — detect when editing a value that appears on multiple pages

### Phase D — Make it production-grade (~2 weeks)

13. **Audit logging** — who edited what, when, and where
14. **Multi-user safety** — conflict detection when two editors change the same content
15. **Bulk operations** — edit the same field across multiple pages (e.g., update a shared tagline)
16. **Keystatic integration** — share content registry, deep link between visual editor and admin panel

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
| **Build first** | Wire up existing adapters + source tracing + SEO panel + diffs | ~2 weeks |
| **Build next** | GitHub provider + Better Auth + SSR deployment | ~3-4 weeks |
| **Build after** | Schema awareness + content inventory + editability setup | ~2-3 weeks |
| **Don't build yet** | Section manipulation, remote collaboration, desktop app | Later |

The 6 bugs are small code fixes. The real work is Phases A and B — and they're what determine whether this project matters or not.
