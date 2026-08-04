# Project status

This document is the release source of truth for Astro Visual Editor.

The implementation roadmap and takeover instructions are maintained in
[ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md](./ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md).

## Bounded objective

Extract the website-specific localhost editor into an independent Astro
integration that can be reused across projects, installed with `astro add`, and
discovered by Astro's integrations directory after an approved npm release.

## Acceptance criteria

- The editor is a standalone package with no dependency on the original site.
- It uses Astro's supported Integration and Dev Toolbar APIs.
- It is present only during `astro dev` and adds no production editor endpoint.
- Users can preview, queue, undo/redo, clear and commit text, SEO and declared
  section changes.
- Section add/delete/reorder works through accessible controls and genuine
  drag-and-drop, and persists to validated Astro source.
- The complete user-facing legacy feature set is accounted for in
  [FEATURE_PARITY.md](./FEATURE_PARITY.md).
- Server writes fail closed for unsafe, stale, ambiguous or out-of-root edits.
- Package metadata meets Astro integration discovery requirements.
- A real demo, automated tests, clean build, package inspection and browser
  workflow provide release evidence.
- Documentation covers installation, mapping, safety, limitations and release.

## Current status

Version `0.1.0` is locally implemented and validated as an unreleased beta
candidate. The legacy interface is now feature-complete and its unfinished
write paths have been replaced by source adapters and hardened transactions.

| Gate | Status | Evidence |
| --- | --- | --- |
| Standalone workspace | Complete | Package and independent demo workspaces |
| Astro API conformance | Complete | Integration factory, `astro:config:setup`, `astro:server:setup`, Dev Toolbar app |
| Unit and safety tests | Complete | 19 Vitest tests cover configuration, protocol, adapters, transactions and file boundaries |
| Type and demo checks | Complete | TypeScript and `astro check` |
| Production isolation | Complete | Automated post-build scan rejects toolbar protocol/runtime markers in demo output |
| Desktop browser workflow | Complete | Playwright covers collapse/expand, dialog light-dismiss, tooltips, semantic section review, text, SEO, templates, delete, undo/redo and genuine drag/drop |
| Source commit/revert | Complete | Real commit, HMR receipt recovery and conflict-protected revert pass in the demo |
| Narrow/mobile workflow | Complete | Real touch Pick mode, Review sheet, keyboard section move and zero horizontal overflow at 390 × 844 |
| Accessibility browser gate | Complete | axe reports no critical/serious toolbar violations in the tested mobile state |
| Transaction hardening | Complete for local beta | Runtime guards, bounded requests/files, hashes, idempotency, atomic writes, rollback and receipts |
| Syntax-aware source adapters | Complete for documented scope | Astro literals/head/regions, Markdown/frontmatter, JSONC paths and YAML paths |
| HMR and multi-tab isolation | Complete | Committed Playwright workflows preserve addressed queues/responses across two tabs |
| Browser tests in CI | Complete | Four Chromium workflows run after unit/type/build/package checks |
| Editability setup/admin UX | **Urgent enhancement pending** | Site owners currently need to change selectors or source annotations in code; the planned owner-controlled setup mode is defined in the engineering handoff |
| npm package inspection | Complete | `npm pack --dry-run` |
| Clean packed-package consumer | Complete | Installed the generated tarball with Astro 7.1.6 in a fresh external fixture and completed a production build |
| Dependency audit | Complete | `npm audit` reports zero known vulnerabilities |
| GitHub repository | Complete | Public repository: `OpaceDigitalAgency/astro-visual-editor` |
| GitHub Actions run | Complete | Node 22.12 and 24 passed on `ecdc2e5` ([run #2](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/runs/30910382857)) |
| npm publication | Pending approval | Package has not been published |
| Astro directory appearance | Pending npm release | Astro refreshes qualifying npm packages automatically |

## Release gates

Do not publish the current commit as stable `0.1.0`. The recommended first
public version remains `0.1.0-beta.1`, followed by owner acceptance. The clean
packed-package consumer test is complete; public actions remain gated below.

The public GitHub repository was created after explicit owner instruction on
4 August 2026. npm publication remains a separate public external action and
requires explicit owner approval. Before publication:

1. confirm the GitHub Actions Node 22.12/24 matrix passes on `main`;
2. configure npm trusted publishing or an npm release token;
3. change the package to the approved prerelease version;
4. publish `astro-visual-editor@0.1.0-beta.1` with provenance;
5. verify `npx astro add astro-visual-editor` in a clean fixture;
6. confirm the package appears in Astro's integrations directory after its
   scheduled refresh;
7. optionally request a custom avatar or listing override from Astro.

## Known boundaries

- Text editing is limited to literal Astro/Markdown values or explicitly mapped
  structured fields; arbitrary expressions remain code changes.
- Editable versus non-editable content is currently determined by developer
  configuration and source annotations. There is no owner-facing setup/admin
  interface yet; this is an urgent enhancement request.
- Explicit source annotations are recommended for components and dynamic routes.
- Duplicate source text is rejected rather than guessed.
- Section operations require a declared contiguous Astro region with stable
  section IDs.
- Post-validation multi-file failures use best-effort rollback.
- Commit receipts survive HMR but not a complete dev-server restart; persistent
  Git/disk history remains roadmap work.
- The local editor now supports desktop and compact touch workflows.
