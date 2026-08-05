# Project status

This document is the release source of truth for Astro Visual Editor.

The implementation roadmap and takeover instructions are maintained in
[ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md](./ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md).
The authoritative version sequence, easy-test workflow and future release gates
are maintained in [RELEASE_PLAN.md](./RELEASE_PLAN.md).

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

Version `0.1.0-beta.3` of `@opacedev/astro-visual-editor` is owner-approved for
release. It adds durable local recovery, exact pre-write file review and the
compact non-overlapping editor workflow.

| Gate                          | Status                         | Evidence                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone workspace          | Complete                       | Package and independent demo workspaces                                                                                                                                                                                                                  |
| Astro API conformance         | Complete                       | Integration factory, `astro:config:setup`, `astro:server:setup`, Dev Toolbar app                                                                                                                                                                         |
| Unit and safety tests         | Complete locally for beta.3    | 24 Vitest tests include exact no-write previews plus restart, tamper, expiry and newer-file conflict recovery                                                                                                                                            |
| Type and demo checks          | Complete                       | TypeScript and `astro check`                                                                                                                                                                                                                             |
| Production isolation          | Complete                       | Automated post-build scan rejects toolbar protocol/runtime markers in demo output                                                                                                                                                                        |
| Desktop browser workflow      | Complete locally for beta.3    | Playwright covers the compact non-overlapping workbench, auto-hidden Sections mode, contained section controls, dialogs, text, SEO, templates, delete, undo/redo and genuine drag/drop                                                                   |
| Source commit/revert          | Complete locally for beta.3    | Exact pre-write source review, real commit, HMR/restart receipt recovery and conflict-protected restore pass in tests                                                                                                                                    |
| Durable local history         | Complete and owner-accepted    | Checksummed bounded `.astro-visual-editor/` history shows time, files and saved/restored status; no Git files are staged automatically                                                                                                                   |
| Narrow/mobile workflow        | Complete                       | Real touch Pick mode, Review sheet, keyboard section move and zero horizontal overflow at 390 × 844                                                                                                                                                      |
| Accessibility browser gate    | Complete                       | axe reports no critical/serious toolbar violations in the tested mobile state                                                                                                                                                                            |
| Transaction hardening         | Complete for local beta        | Runtime guards, bounded requests/files, hashes, idempotency, atomic writes, rollback and receipts                                                                                                                                                        |
| Syntax-aware source adapters  | Complete for documented scope  | Astro literals/head/regions, Markdown/frontmatter, JSONC paths and YAML paths                                                                                                                                                                            |
| HMR and multi-tab isolation   | Complete                       | Committed Playwright workflows preserve addressed queues/responses across two tabs                                                                                                                                                                       |
| Browser tests in CI           | Complete                       | Four Chromium workflows run after unit/type/build/package checks                                                                                                                                                                                         |
| Editability setup/admin UX    | **Urgent enhancement pending** | Site owners currently need to change selectors or source annotations in code; the planned owner-controlled setup mode is defined in the engineering handoff                                                                                              |
| npm package inspection        | Complete                       | `npm pack --dry-run`                                                                                                                                                                                                                                     |
| Clean packed-package consumer | Complete                       | Installed the generated tarball with Astro 7.1.6 in a fresh external fixture and completed a production build                                                                                                                                            |
| Dependency audit              | Complete                       | `npm audit` reports zero known vulnerabilities                                                                                                                                                                                                           |
| GitHub repository             | Complete                       | Public repository: `OpaceDigitalAgency/astro-visual-editor`                                                                                                                                                                                              |
| GitHub Actions run            | Complete                       | Node 22.12 and 24 passed on the beta.2 release commit `2cf10f1` ([run #30927510113](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/runs/30927510113))                                                                                 |
| Canonical Opace product page  | Complete                       | `/tools/` and `/tools/astro/visual-editor/` are deployed and rendered-verified at desktop, tablet and mobile widths                                                                                                                                      |
| GitHub discovery presentation | Complete                       | Rich landing README, community templates, support route, About copy, canonical website, 18 topics, 1280 × 640 social preview, Opace portfolio listing and profile pin                                                                                    |
| Package identity              | Complete                       | Scoped package metadata uses `@opacedev/astro-visual-editor` with Opace author, homepage, repository and discovery keywords                                                                                                                              |
| Release automation            | Complete                       | npm trusted publisher is bound to `OpaceDigitalAgency/astro-visual-editor` and `release.yml`; beta.2 was published by OIDC with SLSA provenance ([run #30927523309](https://github.com/OpaceDigitalAgency/astro-visual-editor/actions/runs/30927523309)) |
| Future release guardrails     | Complete in repository         | Manual GitHub Action release approval; enforced documentation, baseline, clean-tarball consumer and post-publish registry verification; required GitHub protection settings are recorded in `RELEASE_GUARDRAILS.md`                                      |
| GitHub protection settings    | Complete                       | Configured 5 August 2026: protected `main` requires PRs and both CI matrix checks; `npm-publish` requires owner approval from protected branches; active `v*` rules allow creation only through the dedicated encrypted release deploy key               |
| npm publication               | Complete                       | [`@opacedev/astro-visual-editor@0.1.0-beta.2`](https://www.npmjs.com/package/@opacedev/astro-visual-editor) is public; `latest` and `beta` resolve to beta.2                                                                                             |
| Real registry consumer        | Complete                       | A fresh Astro 7.1.6 project ran `npx astro add @opacedev/astro-visual-editor`, installed beta.2, updated config and completed a production build                                                                                                         |
| Astro importer eligibility    | Complete                       | npm's live search returns beta.2 for both `astro-integration` and `withastro`; the package is absent from Astro's blocklist; Astro's unmodified `update-integrations --unsafe` script generated the expected entry and four category mappings            |
| Astro directory appearance    | Pending external weekly import | Astro refreshes qualifying npm packages automatically; the public listing must still be rendered-verified after the scheduled import                                                                                                                     |
| Directory avatar              | Pending Astro maintainer merge | A 64 × 64 SVG and metadata request were submitted in [withastro/astro.build#2597](https://github.com/withastro/astro.build/issues/2597)                                                                                                                  |

## Public beta record and remaining gates

Do not promote the package to stable `0.1.0` until owner acceptance. The
approved public-beta sequence on 4 August 2026 was:

1. bootstrap `0.1.0-beta.1` through an interactive, 2FA-authenticated publish;
2. bind npm trusted publishing to this repository and `release.yml`;
3. publish the corrective `0.1.0-beta.2` tag from GitHub Actions with OIDC and
   SLSA provenance;
4. point both npm `beta` and `latest` at beta.2 while no stable release exists;
5. install from the anonymous registry in a clean Astro 7.1.6 project and
   complete a production build;
6. verify that npm's actual keyword search—the source used by Astro's
   importer—returns the package under both qualifying keywords;
7. run Astro's current unmodified importer locally against the registry and
   confirm it adds the package with the Opace homepage, GitHub repository and
   Dev Toolbar, Performance + SEO, Utilities and CSS + UI categories; and
8. submit the custom avatar and metadata request to Astro.

Astro 7.1.6 rejects npm version and dist-tag suffixes in `astro add`. The proven
automatic command is `npx astro add @opacedev/astro-visual-editor`. Users who
want to pin the beta tag must use
`npm install --save-dev @opacedev/astro-visual-editor@beta` and configure the
integration manually.

The only release-distribution gates still outside this repository are Astro's
scheduled directory import, Astro maintainer handling of the avatar issue, and
owner acceptance before a stable release. Do not describe any of those as
complete until their public result is visibly verified.

Future npm releases must use the guarded **Publish package** workflow from
`main`; it creates the matching tag after preflight rather than accepting a
manually pushed release tag. See [RELEASE_GUARDRAILS.md](./RELEASE_GUARDRAILS.md)
for the required one-time GitHub settings and the external Astro follow-up.

## Known boundaries

- Text editing is limited to literal Astro/Markdown values or explicitly mapped
  structured fields; arbitrary expressions remain code changes.
- Formatted multiline Astro literal text is matched using rendered whitespace,
  then written through a compiler-validated source range.
- Editable versus non-editable content is currently determined by developer
  configuration and source annotations. There is no owner-facing setup/admin
  interface yet; this is an urgent enhancement request.
- Explicit source annotations are recommended for components and dynamic routes.
- Duplicate source text is rejected rather than guessed.
- Section operations require a declared contiguous Astro region with stable
  section IDs.
- Post-validation multi-file failures use best-effort rollback.
- Checksummed commit receipts survive a complete dev-server restart; Git-backed
  history remains roadmap work.
- The local editor now supports desktop and compact touch workflows.

The next bounded implementation and all later proposed versions are defined in
[RELEASE_PLAN.md](./RELEASE_PLAN.md). Do not reuse version assignments from an
older task or publish another npm version without reconciling that plan first.
