# Astro Visual Editor — Current Release Plan

**Status:** authoritative release and takeover plan

**Last verified:** 5 August 2026

**Current public version:** `@opacedev/astro-visual-editor@0.1.0-beta.3`

**Current branch:** `main`

This plan replaces the release sequence proposed in the earlier Codex task
**Find easy app testing**. That task remains useful historical context, but its
npm, CI, test-count and version assumptions predate the public beta.2 release.
Use [`PROJECT.md`](./PROJECT.md) for current evidence, this document for release
sequence, and
[`ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md`](./ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md)
for detailed engineering acceptance criteria.

## Executive status

The current local-development product is published and installable. Everything
that Opace can supply for Astro's automatic integrations-library importer is in
place:

- the package is public on npm;
- `astro-integration` and `withastro` are present in the published npm metadata;
- `name`, `description`, `repository` and `homepage` are complete;
- the homepage is the canonical Opace product page;
- category keywords include Dev Toolbar, Performance + SEO, Utilities and UI;
- npm search returns beta.2 for both qualifying keywords;
- the package is not in Astro's importer blocklist;
- Astro's current unmodified `update-integrations --unsafe` script was run
  locally against the live registry and generated the expected catalogue entry;
- a real Astro 7.1.6 project installed the registry package with `astro add` and
  completed a production build; and
- the custom avatar/metadata request is open as
  [withastro/astro.build#2597](https://github.com/withastro/astro.build/issues/2597).

Astro documents that new qualifying npm packages are imported weekly. Its
current public repository schedules the new/deprecated-package job for Monday
at 12:00 UTC and creates a catalogue update pull request. Astro controls that
job, pull-request merge and deployment. Therefore:

- **Automatic importer eligibility: complete and verified.**
- **Public Astro directory card: externally pending until it renders.**
- **Custom avatar: externally pending until Astro processes issue #2597.**

Do not describe an eligible package as already listed. Conversely, do not ask a
future task to resubmit the npm package manually: Astro's documented mechanism
is the scheduled npm import.

## Current release evidence

| Gate                | Current evidence                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Public npm package  | [`@opacedev/astro-visual-editor@0.1.0-beta.2`](https://www.npmjs.com/package/@opacedev/astro-visual-editor)            |
| npm tags            | Both `latest` and `beta` resolve to beta.2 while no stable release exists                                              |
| Trusted publication | GitHub-hosted `release.yml` workflow, npm OIDC and SLSA provenance verified on beta.2                                  |
| Main CI             | Node 22.12 and 24 matrix green on the beta.2 lineage and the latest documentation commit                               |
| Package validation  | Build, type checks, production-isolation scan, package inspection and dependency audit pass                            |
| Automated behaviour | 20 Vitest tests and four committed Chromium workflows                                                                  |
| Registry consumer   | Clean Astro 7.1.6 install, automatic config update and production build pass                                           |
| Importer inputs     | Package returned by npm searches; correct metadata; not blocklisted; Astro's own importer generated the expected entry |
| Astro listing       | Not yet publicly rendered; wait for and verify the external scheduled import                                           |
| Avatar              | Request open in Astro issue #2597                                                                                      |

## Review of “Find easy app testing”

### Still correct

- The built-in demo is the easiest manual product test.
- Manual testing should begin with queue, Review, undo/redo and Clear before a
  deliberate source commit.
- `npm run test:all` is the complete repository regression command.
- Commit testing must be confined to the demo fixture and followed by review of
  the Git diff and the editor's guarded revert.
- The remaining product sequence is still sound: durable history/diffs,
  Editability Setup, schema-aware source attribution, a controlled block
  palette, then a separately secured remote editorial product.
- Arbitrary page-wide drag-and-drop remains intentionally excluded. New blocks
  should only enter approved, source-compatible regions.

### Out of date or corrected

- The package is no longer local-only or unpublished. Beta.2 is public.
- npm bootstrap, 2FA, trusted publisher configuration, OIDC provenance and
  clean-registry installation are complete.
- The earlier `beta.1` publication plan is complete, and `beta.2` was used for
  release-command/metadata correction. Persistent history must therefore start
  at beta.3, not beta.2.
- The earlier report of 9 tests is obsolete. The current baseline is 20 Vitest
  tests plus four Playwright workflows.
- The earlier dirty-worktree, lockfile, missing Prettier plugin and failed npm
  package checks were transient pre-release blockers and are resolved.
- A GitHub Pages marketing site is not required. The canonical product page is
  inside Opace's existing site at
  [opace.agency/tools/astro/visual-editor/](https://opace.agency/tools/astro/visual-editor/).
- `npx astro add @opacedev/astro-visual-editor@beta` is not a valid Astro 7.1.6
  command because `astro add` rejects a version or dist-tag suffix. Use the
  unversioned automatic command, or install the beta manually.
- Port 4321 is only Astro's usual default. The repeatable repository-demo
  instruction uses explicit loopback port 4322 to avoid collision with another
  local Astro project.
- Adding `data-astro-editable` can opt in a known element today, but it is not a
  substitute for the planned owner-facing Editability Setup workflow.

## Easy manual acceptance test

Start from a clean worktree:

```bash
npm ci
npm run dev --workspace astro-visual-editor-demo -- --host 127.0.0.1 --port 4322
```

Open [http://127.0.0.1:4322/](http://127.0.0.1:4322/), expand Astro's Dev
Toolbar and choose **Astro Visual Editor**.

Test in this order:

1. Collapse and expand the workbench on desktop.
2. Confirm every icon control has an understandable hover/focus tooltip.
3. Open Text and SEO dialogs; close each with Cancel, Escape and a backdrop
   click.
4. Queue a text change and verify Preview, Review, undo, redo and Clear.
5. Reorder the three demo sections using pointer drag, buttons and keyboard;
   confirm Review shows labelled Before/After order.
6. Add and delete a validated template, then undo both changes.
7. Deliberately commit a demo-only change, inspect
   `git diff -- demo/src/pages/index.astro`, then use **Revert last commit**.
8. Repeat the selection/review flow at a narrow viewport and verify the page is
   still tappable in Pick mode.
9. Open `/fixtures/article` and confirm the explicitly excluded paragraph stays
   locked while mapped content opens the correct dialog.

Do not commit source changes during a casual demo. A commit here means the
editor writes the demo fixture on disk; Git remains the durable review boundary.

## Automated release baseline

Run from a clean checkout:

```bash
npm ci
npm run test:all
npm audit --audit-level=low
npm pack --workspace @opacedev/astro-visual-editor --dry-run
```

`npm run test:all` must retain all of these gates:

1. formatting and linting;
2. package build and TypeScript checks;
3. 20 unit/adapter/protocol/transaction tests or the documented higher count;
4. demo `astro check` and production build;
5. proof that production output contains no editor runtime or write route;
6. package-content inspection; and
7. committed Playwright coverage for desktop, mobile, accessibility, HMR,
   commit/revert, templates, drag/drop and two-tab isolation.

For every npm release, additionally install the actual published version in a
new external Astro fixture and build it. Do not count a workspace link or local
tarball as registry proof.

## Supported install commands

Automatic current-beta install and config update:

```bash
npx astro add @opacedev/astro-visual-editor
```

Explicit beta pin followed by manual `astro.config.mjs` setup:

```bash
npm install --save-dev @opacedev/astro-visual-editor@beta
```

Do not publish documentation that appends `@beta` to `astro add` until Astro's
CLI demonstrably supports that syntax.

## Release train from beta.2

Version numbers below are the proposed sequence. Scope and acceptance criteria
are authoritative; a future task may split a release if it remains backwards
compatible and updates this plan first.

### `0.1.0-beta.3` — durable review and recovery

**Release status (5 August 2026):** implemented, automated checks pass and the
owner has accepted the browser workflow for publication.

Deliver the safest next bounded component:

- checksummed, bounded receipt history under an ignored project-local
  `.astro-visual-editor/` directory;
- exact per-file diff generated from the same validated snapshots used for
  commit;
- History panel showing time, files, status and safe revert;
- restart recovery with refusal for tampered, expired or hash-conflicted
  receipts; and
- enough toolbar decomposition to keep history, transaction and UI state out of
  the monolithic entry point.

Exit criteria:

- history survives a full dev-server restart;
- current-output hash mismatch prevents revert;
- the visible diff exactly matches the pending write;
- no unrelated Git files are staged or committed;
- focused restart/tamper/conflict tests and the full baseline pass; and
- package, root README, changelog, project status and handoff are updated.

### `0.1.0-beta.4` — Editability Setup and page inventory

- mark visible content as editable, excluded, unresolved or structurally unsafe;
- explain every decision in plain language;
- allow an authorised local owner to review element and selector-group
  allow/deny rules, including appropriate `<strong>` labels;
- display or confirm the owning source file and structured path;
- persist policy in a project-owned, reviewable manifest or source patch;
- show the policy diff before saving; and
- prevent an allow rule from bypassing attribution or adapter validation.

Exit criteria include keyboard-accessible setup/conflict flows, reload/HMR and
fresh-checkout persistence, safe allow/deny tests, and proof that an ordinary
content editor cannot broaden permissions.

### `0.1.0-beta.5` — bounded attribution and schema-aware fields

- deterministically trace supported direct JSON/YAML imports and Astro Content
  Collection fields;
- label inferred mappings as suggestions until an adapter validates the exact
  source target;
- warn when a value is shared by multiple routes and show affected-route count;
- use project schemas for dates, enums, URLs, required fields and structured
  values; and
- keep explicit annotations/mappings as the authoritative fallback.

Exit criteria require fixtures for every supported provenance pattern and
fail-closed tests for ambiguous or unsupported data flow.

### `0.1.0-beta.6` — compatibility and workflow hardening

- finish splitting the toolbar into store, selection, section, transaction,
  persistence and UI modules;
- add error/conflict and failed-HMR interfaces;
- add Astro view-transition coverage;
- test static and SSR hosts where supported;
- test the lowest supported and current Astro versions;
- expand keyboard, screen-reader, viewport and production-marker evidence; and
- resolve material beta feedback.

### Stable `0.1.0` — supported local-development release

Stable release requires:

- explicit owner acceptance of desktop and mobile workflows;
- no unresolved material beta defects;
- full local and public Node/Astro matrices green on the release commit;
- clean real-registry installation and production build;
- confirmed OIDC publication with provenance;
- public Astro directory card and final link verification; and
- a reviewed release workflow change so stable `0.1.0` publishes on `latest`
  while prereleases continue to use `beta`.

### `0.2.0-beta.1` — controlled block palette

- curated hero, text, feature, testimonial and other approved templates;
- visible compatible drop zones inside explicitly declared regions;
- source/schema compatibility validation before drop;
- cross-region movement only when both regions allow the component; and
- preview and ledger review before persistence.

This is not unrestricted “drop anything anywhere” page-builder behaviour.

### Separate remote editorial product

Remote client editing is not a switch in the local core. Define separate
provider/Git/remote packages with:

- authentication and server-enforced administrator, developer, editor and
  reviewer roles;
- least-privilege, server-only credentials;
- branch-only writes, pull-request review and deploy-preview status;
- CSRF protection, rate limiting, audit history, revocation and conflicts; and
- prevention of direct production commits.

This phase needs a separately approved threat model and product brief.

## Standard procedure for every future beta

1. Confirm the bounded scope and update this plan if version scope changed.
2. Preserve unrelated user changes and start from a reconciled worktree.
3. Implement and test one component at a time.
4. Update package version, package README, root README and changelog together.
5. Run `npm ci`, the focused tests, `npm run test:all`, audit and package
   inspection.
6. Install the packed candidate in a clean external fixture before publication.
7. Push the release commit through protected `main` and require the Node
   22.12/24 CI matrix to pass.
8. Obtain explicit authority for the new public npm version, then start the
   **Publish package** workflow from `main`. It enforces the document checks,
   full baseline, clean packed-consumer build, matching tag and npm registry
   verification before completing publication.
9. Do not push `v<version>` yourself. The workflow creates the exact matching
   tag only after its preflight passes, then publishes through the configured
   npm trusted publisher with provenance.
10. Verify the package still appears in qualifying npm searches, is not
    blocklisted by Astro and is accepted by its current importer script.
11. Update `PROJECT.md` with links to immutable CI/release evidence.

The enforced workflow and one-time GitHub protection requirements are in
[RELEASE_GUARDRAILS.md](./RELEASE_GUARDRAILS.md). Never add a long-lived npm
publish token to GitHub. The configured trusted
publisher is bound to `OpaceDigitalAgency/astro-visual-editor` and
`.github/workflows/release.yml`; workflow filename, repository metadata and
`id-token: write` must remain exact.

## Astro listing follow-up

After Astro's next scheduled import:

1. Search the public integrations directory for the exact package name.
2. Verify title, description and categories.
3. Confirm the card links to
   `https://opace.agency/tools/astro/visual-editor/`.
4. Confirm repository/npm links are correct.
5. Check whether issue #2597's custom avatar and text override are live.
6. Test the install command shown from a fresh project.
7. Record the public listing URL and evidence in `PROJECT.md`.

If the package is not imported after the scheduled catalogue PR has merged,
inspect that workflow/PR first. Only then update or comment on the existing
Astro issue with concrete evidence; do not create duplicate submissions.

## Separate theme project

The reusable theme is not part of this package's beta train. Follow
[`ASTRO_THEME_PRODUCT_PLAN.md`](./ASTRO_THEME_PRODUCT_PLAN.md) in a separate
repository. It may demonstrate the editor as an optional development
dependency, but production output must remain independent and editor-free.

## Immediate next takeover task

After beta.3 publication evidence is recorded, implement only the
`0.1.0-beta.4` Editability Setup and page-inventory scope. Do not add remote
authentication, Git auto-commit or arbitrary block drops.

Before changing code, read all applicable `AGENTS.md` files, then read in order:

1. [`PROJECT.md`](./PROJECT.md)
2. this release plan;
3. [`ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md`](./ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md);
4. [`README.md`](./README.md);
5. [`SECURITY.md`](./SECURITY.md); and
6. the current engineering and strategic reviews under `.agent/docs/`.

The next task is complete only when its focused tests and full baseline pass,
status documents are reconciled, the worktree is clean, and exact push/CI
evidence is reported.

## Official references

- [Astro integrations library requirements](https://docs.astro.build/en/guides/integrations/#integrations-library)
- [Astro catalogue update process](https://github.com/withastro/astro.build#updating-integrations)
- [Astro integration API](https://docs.astro.build/en/reference/integrations-reference/)
- [Astro Dev Toolbar App API](https://docs.astro.build/en/reference/dev-toolbar-app-reference/)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm trust CLI](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
