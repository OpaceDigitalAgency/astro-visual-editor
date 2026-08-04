# Astro Visual Editor — Full Project Review

**Date:** 4 August 2026  
**Reviewer:** Antigravity (Claude Opus 4.6)  
**Scope:** All documentation (7 docs) and all application code (15 source files, 3 test files, 2 config files, 1 CI workflow)

---

## What It Does

Astro Visual Editor is a **development-only Astro integration** that adds click-to-edit content controls via Astro's Dev Toolbar. It's designed to solve a genuine gap in the Astro ecosystem: no existing tool lets you visually edit content directly on the rendered page while keeping Astro's file-based architecture intact.

### Core Workflow

1. Developer runs `astro dev` and opens the Visual Editor in the Dev Toolbar
2. Clicking any eligible text element (headings, paragraphs, list items, etc.) opens an edit dialog
3. Changes preview instantly in the browser but don't touch source files
4. Edits accumulate in a visible "change ledger" showing old text, new text, and target file
5. Individual changes can be undone; the whole queue can be cleared
6. "Commit" validates the entire batch, then writes all changes to source files atomically
7. Astro's HMR renders the updated files

### Key Differentiator

The rendered page is the editing surface — unlike every other Astro CMS/editor tool (TinaCMS, Keystatic, CloudCannon, etc.), which show content per-collection or per-file. This is the only approach that naturally handles pages assembled from multiple source files. The accompanying [research assessment](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/Astro%20Integrated%20CMS%20%26%20Frontend%20Editing_%20Complete%20Research%20%26%20Assessment.md) thoroughly validates this positioning.

### Architecture

```
packages/astro-visual-editor/
  src/
    index.ts          → Integration factory (hooks into astro:config:setup, astro:config:done, astro:server:setup)
    options.ts         → Configuration normalisation and validation
    toolbar.ts         → Dev Toolbar client (Shadow DOM UI, selection, queue, commit)
    server/
      file-updater.ts  → Batch file write with validation and rollback
      source-files.ts  → Source snapshot reading with hash generation
      adapters/
        shared.ts      → Source range utilities (overlap detection, HTML escaping)
        structured.ts  → JSON/JSONC and YAML structured editing adapters
    shared/
      types.ts         → Shared type definitions (changes, config, protocol messages)
      events.ts        → Event name constants
      protocol.ts      → Runtime message parsing and validation guards
demo/                  → Real Astro project with fixture pages for testing
```

The build uses **esbuild** to produce two bundles (node for server, browser for toolbar) plus TypeScript declarations.

---

## Current Status

**Version 0.1.0 — unreleased prototype.** The docs correctly label this as locally validated but not ready for public beta. The [PROJECT.md](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/PROJECT.md) status table and [engineering handoff](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md) are remarkably thorough.

---

## Limitations

### 1. Fundamental Design Limitations

| Limitation | Detail |
|---|---|
| **Text-only editing** | Only plain `textContent` replacements. No structural HTML, component props, expressions, or Astro frontmatter editing. |
| **Naive string replacement** | [file-updater.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/file-updater.ts#L104-L117) applies changes sequentially to an already-modified file buffer, so edit A can create text that edit B accidentally matches. |
| **No syntax awareness** | The `.astro` write path does raw `string.replace()`. An apostrophe can break a JS expression, a quote can break JSON. |
| **Source adapters unused** | [structured.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/adapters/structured.ts) has working JSON/YAML adapters, but [file-updater.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/file-updater.ts) doesn't use them — everything goes through raw string replacement. |
| **No file hashing** | [source-files.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/source-files.ts) implements `hashSource()` and `readSourceSnapshot()`, but they're **not called** by the write path. Stale file detection is only by text match, not content hash. |
| **Desktop-only editing surface** | Astro's Dev Toolbar covers the page on narrow viewports. The compact mobile Pick mode described in the handoff is designed but not implemented. |
| **Dev-only; no client/editor access** | Requires `astro dev` running locally. Non-technical editors can't use it. |

### 2. Code Inconsistencies & Bugs Found

| Issue | Severity | Detail |
|---|---|---|
| **`allowUnsafeSourceText` not in types** | Medium | Used in both [toolbar.ts:26,348](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/toolbar.ts#L26) and [file-updater.ts:40](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/file-updater.ts#L40), but **missing from** `AstroVisualEditorOptions`, `NormalizedOptions`, and `ClientEditorConfig` type definitions. It will always use the fallback `false`. |
| **Options test expects non-existent default** | Medium | [options.test.ts:18](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/test/options.test.ts#L18) asserts `options.selectorMappings.header === 'src/components/Header.astro'`, but [options.ts:111](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/options.ts#L111) sets `selectorMappings: {}` as default. This test would **fail**. (The handoff P0.5 explicitly says to remove these defaults.) |
| **Event constants duplicated** | Low | [events.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/shared/events.ts) defines shared constants, but [index.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/index.ts#L14-L18) and [toolbar.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/toolbar.ts#L8-L12) both define their own copies. |
| **Protocol guards unused** | Medium | [protocol.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/shared/protocol.ts) has `parseSaveRequest()`, `parseReceiptRequest()`, and `parseRevertRequest()` — none are used in [index.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/index.ts#L56). The server handler trusts the incoming payload without validation. |
| **`clientId` not sent** | Medium | [types.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/shared/types.ts#L83) defines `SaveRequest` extending `ClientMessage` (requires `clientId`), but [toolbar.ts:390](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/toolbar.ts#L390) sends `{ requestId, changes }` — no `clientId`. |
| **`SaveResponse` type mismatch** | Low | [index.ts:65](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/index.ts#L65) constructs the response without a `clientId`, but `SaveResponse` extends `ClientMessage` which requires it. |
| **Toolbar default config drift** | Low | [toolbar.ts:19-27](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/toolbar.ts#L19-L27) has its own `defaultConfig` that's a subset of the server defaults. If the server config push fails, the client falls back to a mismatched default set. |
| **`EditorChange` type mismatch** | Medium | [file-updater.ts:3](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/file-updater.ts#L3) imports `EditorChange` but accesses `.oldText` and `.newText` directly — these only exist on `TextEditorChange`, not on `SeoEditorChange` or `SectionsEditorChange`. No runtime kind-check. |
| **`innerHTML` in toolbar** | Low-Med | [toolbar.ts:139-152](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/toolbar.ts#L139-L152) uses `innerHTML` for static markup, which is safe, but the handoff explicitly asks to avoid it. |

### 3. Test Coverage Gaps

- **3 test files, ~145 lines total** — covers the basics but is thin
- No tests for the structured adapters (`applyJsonText`, `applyYamlText`)
- No tests for protocol parsing (`parseSaveRequest`, etc.)
- No tests for source-file snapshot reading
- No tests for `shared.ts` utilities (`applyRanges`, `uniqueRange`, `pathParts`)
- No browser/E2E tests committed (Playwright is in `devDependencies` but no test files exist)
- The `test:e2e` script in root `package.json` points to `playwright test` but no spec files

### 4. Missing Infrastructure

- No linting/formatting (ESLint, Prettier)
- No dependency update automation (Dependabot/Renovate)
- No npm publish workflow (trusted publishing)
- CI only runs `test:all`; no separate browser test job
- No `.editorconfig` or similar consistency enforcement
- `__fixtures__` directory under demo is empty

---

## Prioritised Recommendations

### 🔴 Priority 1 — Fix Bugs Before Any Other Work

These are things that are currently broken or inconsistent in the existing code:

1. **Add `allowUnsafeSourceText` to `AstroVisualEditorOptions` and `NormalizedOptions`** — without it, the option cannot be configured and the toolbar/server checks always use `false`. ~5 min fix.

2. **Fix the options test** — it asserts default `selectorMappings.header` which doesn't exist. Either add the default mappings back (contradicts P0.5) or fix the test assertion. ~5 min fix.

3. **Add `clientId` to toolbar save requests** — generate a stable tab ID (e.g., from `crypto.randomUUID()` stored in `sessionStorage`) and include it. Without it, the type contract is broken. ~15 min fix.

4. **Use protocol parsing guards on the server** — the `parseSaveRequest()` function exists and is well-written but isn't called. Wire it into the `SAVE_EVENT` handler in [index.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/index.ts#L56). ~10 min fix.

5. **Add `kind` discriminator to toolbar changes** — the toolbar sends changes without a `kind` field, but `EditorChange` is a discriminated union. File-updater accesses `.oldText`/`.newText` directly without checking `kind === 'text'`. ~10 min fix.

6. **Use shared event constants** — [events.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/shared/events.ts) exists with all constants. Import from it in `index.ts` and `toolbar.ts` instead of redeclaring. ~5 min fix.

---

### 🟠 Priority 2 — P0 Hardening (Release Blockers)

These align with the handoff's P0 items and must be done before any public beta:

7. **P0.1 — Immutable edit ranges** — Replace the sequential `string.replace()` in [file-updater.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/file-updater.ts#L79-L137) with range-based editing using [shared.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/adapters/shared.ts)'s `applyRanges()`. Resolve all edits against the **original** file snapshot, not the mutated buffer. Use `hashSource()` from [source-files.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/source-files.ts#L14-L16) for stale-file detection.

8. **P0.2 — Wire up source adapters** — The JSON and YAML adapters in [structured.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/server/adapters/structured.ts) are implemented and correct. Route `.json`/`.jsonc`/`.yaml`/`.yml` files through them instead of raw string replacement. Add an `.astro` adapter for literal text nodes using `@astrojs/compiler` (already a dependency).

9. **P0.3 — Multi-tab safety** — The server broadcasts responses to all connected clients. Add `clientId` filtering so Tab A doesn't clear Tab B's queue.

10. **P0.4 — HMR survival** — Persist queue state in `sessionStorage`. On toolbar init, check for pending transactions via the receipt protocol (already defined in types but not implemented).

11. **P0.5 — Remove default selector mappings** — Remove the phantom `header`/`footer` defaults that the test expects. Validate CSS selectors with `document.querySelector()` safety checks.

12. **P0.6 — Network exposure protection** — Check if the dev server is bound to a non-loopback address and refuse writes. The `allowRemoteDev` option exists in the config but isn't enforced.

---

### 🟡 Priority 3 — Test & Quality Infrastructure

13. **Write adapter tests** — `applyJsonText()` and `applyYamlText()` have no tests. Cover: valid edits, missing paths, stale values, encoding preservation, malformed input.

14. **Write protocol guard tests** — `parseSaveRequest()`, `parseReceiptRequest()`, and `parseRevertRequest()` have no tests. Cover: valid payloads, missing fields, oversized payloads, malformed data.

15. **Write range utility tests** — `applyRanges()`, `uniqueRange()`, `pathParts()` have no tests. Cover: non-overlapping ranges, overlapping rejection, empty strings, array index paths.

16. **Add E2E browser tests** — Playwright is installed. Write specs for: selection, queue, undo, clear, commit, error display. These currently exist only as manual evidence.

17. **Add ESLint + Prettier** — No code formatting or linting exists. This matters for contributions and consistency.

18. **Add Dependabot/Renovate** — No dependency update automation.

---

### 🟢 Priority 4 — Product Enhancements (Post-Beta)

19. **Editability Setup mode** (P1.0 in handoff) — The most impactful product enhancement. Site owners need to understand *why* something isn't editable and safely opt elements in/out. Currently requires editing templates.

20. **Page content inventory** (Phase 2 in handoff) — Panel listing all editable values on the current page, grouped by source file.

21. **Client architecture split** (Phase 1 in handoff) — [toolbar.ts](file:///Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor/packages/astro-visual-editor/src/toolbar.ts) is a 421-line monolith handling UI, state, selection, and communication. Split into focused modules per the handoff's architecture diagram.

22. **Mobile compact mode** — The Playwright proof-of-concept validated this works. Implement the Pick → Review state machine for narrow viewports.

23. **Diff view before commit** (Phase 3 in handoff) — Show exact per-file diffs, not just old/new text.

24. **SEO editing** (Phase 4 in handoff) — Types exist (`SeoEditorChange`, `SeoValues`, `SeoField`) but no UI or write path.

25. **Section operations** (Phase 5 in handoff) — Types exist (`SectionsEditorChange`, `SectionTemplate`, `SectionDescriptor`) and templates are defined in options, but no UI or write path.

---

### 🔵 Priority 5 — Release Engineering

26. **Add npm trusted publishing workflow** — OIDC-based GitHub Actions for provenance-signed releases.

27. **Create public GitHub repository** — Currently only exists locally. Requires owner approval.

28. **Publish `0.1.0-beta.1`** — As recommended in the handoff. Not stable `0.1.0`.

29. **Verify `npx astro add astro-visual-editor`** — End-to-end installation test in a clean fixture project.

---

## Assessment Summary

> [!IMPORTANT]
> **The project concept is strong and the documentation is exceptionally thorough** — the research assessment, engineering handoff, and project status documents are among the best I've seen for a prototype-stage project. The market gap analysis is well-evidenced and the phased roadmap is realistic.

> [!WARNING]
> **The code has significant inconsistencies** between what the types/protocols define and what the runtime actually uses. Several well-built components (protocol guards, source adapters, hash-based snapshots, range utilities) exist but aren't wired into the main code path. This suggests the architecture was designed ahead of implementation, and the wiring was never completed.

> [!CAUTION]
> **Do not publish as-is.** The sequential string replacement can corrupt files when multiple edits interact. The server trusts unvalidated browser payloads. The `allowUnsafeSourceText` option silently doesn't work. Fix Priority 1 items and at least P0.1-P0.3 before any public release.

### Effort Estimate

| Priority | Items | Estimated Effort |
|---|---|---|
| 🔴 P1 — Bug fixes | 6 items | 1–2 hours |
| 🟠 P2 — P0 hardening | 6 items | 3–5 days |
| 🟡 P3 — Test infrastructure | 6 items | 2–3 days |
| 🟢 P4 — Product enhancements | 7 items | 2–4 weeks |
| 🔵 P5 — Release engineering | 4 items | 1–2 days |

**Recommended first task:** Fix all 6 Priority 1 bugs (< 1 hour of work), then run `npm run test:all` to verify nothing else breaks. This clears the path for the P0 hardening work.
