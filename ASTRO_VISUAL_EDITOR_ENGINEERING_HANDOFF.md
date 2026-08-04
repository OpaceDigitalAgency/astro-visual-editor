# Astro Visual Editor — Engineering Handoff

**Prepared:** 4 August 2026

**Repository:** `/Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor`

**Current branch:** `main`

**Current package version:** `0.1.0`, unreleased

**Intended package name:** `astro-visual-editor`

## Start here

This is the primary takeover document for the next engineering project. It
converts the market assessment and code review into a bounded implementation
programme.

Read these documents in order:

1. [PROJECT.md](./PROJECT.md) — current release truth and external gates.
2. This handoff — engineering priorities and acceptance criteria.
3. [README.md](./README.md) — present package behaviour and usage.
4. [Astro Integrated CMS & Frontend Editing: Complete Research & Assessment](./Astro%20Integrated%20CMS%20%26%20Frontend%20Editing_%20Complete%20Research%20%26%20Assessment.md) — market and product context.
5. [Strategic product review](./.agent/docs/astro-visual-editor/strategic-product-review.md) — current product recommendations and changes to the original strategy.
6. [Current engineering review](./.agent/docs/astro-visual-editor/project-review.md) — code-quality findings and remaining maintainability work.
7. [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

If a historical claim conflicts with the current code or `PROJECT.md`, inspect
the code and update the project document rather than relying on the historical
claim.

## Executive decision

Continue the standalone Astro integration. The existing `0.1.0` is now an
unreleased, feature-complete local beta candidate rather than the earlier text-
only prototype. It is still not a stable public release.

The product's differentiator is the **rendered page as a unified content review
surface**, combined with a visible change ledger. Its central engineering
problem is reliable, syntax-aware attribution from rendered content back to the
correct source file and field.

Do not solve that problem by expanding raw global string replacement. Build a
typed source-adapter and transaction architecture first.

## Current implementation truth

### What exists

- A standalone npm workspace and Astro integration.
- Native Astro Dev Toolbar registration.
- Development-only client/server communication.
- Click-to-edit simple rendered text.
- Persistent Astro/Markdown SEO editing.
- Persistent add/delete/reorder for declared Astro section regions.
- Genuine section drag-and-drop plus accessible buttons and shortcuts.
- Browser preview and queued-change ledger.
- Bounded undo/redo, individual removal, clear, commit and receipt-backed revert.
- Astro, Markdown/frontmatter, JSONC-path and YAML-path source adapters.
- Runtime-validated addressed protocol, idempotency and request/file limits.
- HMR/session recovery and two-tab response/queue isolation.
- Compact touch Pick mode and full Review sheet.
- Project-root, source-root, extension and symlink-escape checks.
- Rejection of stale or ambiguous source strings.
- Unit tests, committed Playwright/axe workflows, demo fixtures, CI, packaging
  metadata and documentation.
- A clean production build with no editor runtime.

### What does not yet exist

- Automatic source tracing for arbitrary component props, expressions or
  repeated values without explicit annotations.
- A complete page-content inventory.
- Client-facing authentication, Git commits or pull-request workflow.
- Restart-persistent on-disk/Git edit history and file-level diff UI.
- An npm release or Astro integrations-directory listing. The public GitHub
  repository now exists at `OpaceDigitalAgency/astro-visual-editor`.

### Legacy prototype boundary

The original site-specific prototype is in:

```text
/Users/davidbryan/Dropbox/Opace-Sales-Marketing/Low Cost Websites/Website
```

It contains experimental text, section and SEO interfaces. Use it only as a UX
reference. Do not copy its Express server, regex persistence, inline handlers or
site-specific mappings into the standalone package.

## Verified Astro constraints

- Register the app with `addDevToolbarApp()` from `astro:config:setup`.
- Keep the toolbar client as a default `defineToolbarApp()` export.
- Use the provided Shadow DOM canvas and toolbar client/server helpers.
- Use `onToggled()` and `onToolbarPlacementUpdated()` for UI state and position.
- Keep the editor out of production builds and avoid a public write endpoint in
  the core package.
- Retain `astro-integration` package metadata for `astro add` and directory
  discovery.
- Maintain a real demo plus fixture pages and production-output checks.

Primary references:

- [Astro Dev Toolbar App API](https://docs.astro.build/en/reference/dev-toolbar-app-reference/)
- [Astro Integration API](https://docs.astro.build/en/reference/integrations-reference/)
- [Working with Astro integrations](https://docs.astro.build/en/guides/integrations/)
- [Astro integrations directory](https://astro.build/integrations/)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

Do not depend on undocumented Astro internals such as private source-annotation
storage. If Astro later exposes source locations publicly, adopt them behind an
adapter and feature detection.

## Proven mobile solution

The narrow-screen limitation is addressable inside Astro's supported toolbar
model.

A live Playwright proof at `390 × 844` established:

| State | Hit-test result over page text |
| --- | --- |
| Current full workbench | `ASTRO-DEV-TOOLBAR` intercepts the tap |
| Compact selection UI | The underlying `P` receives the tap |

The original proof changed only the browser DOM. The compact solution is now
implemented in repository code and covered by the committed mobile Chromium
workflow with real touch input, keyboard section movement and overflow checks.

### Implemented interaction model

1. Activating the app enters **Pick mode**.
2. On narrow screens, show only a compact chip above Astro's toolbar:
   `Tap content to edit` plus the queued count.
3. Tapping page content opens the edit dialog.
4. Queueing returns to Pick mode.
5. `Review N changes` opens the full ledger as a bottom sheet.
6. Minimise returns to Pick mode without disabling the app.
7. Commit, clear, error and conflict states remain available in Review mode.

Respect toolbar placement, viewport changes, orientation changes and
`env(safe-area-inset-bottom)`. Keep touch targets at least 44 CSS pixels.

The design direction remains a compact, dark source workbench with Astro orange
as the commit signal and the change ledger as its signature differentiator.

## P0 hardening status

The local-beta implementation now completes P0.1–P0.6 for the documented
feature scope. The retained sections below explain the design and acceptance
criteria; they are no longer an unimplemented task list. Evidence includes 19
Vitest tests and four committed Chromium workflows covering HMR commit/revert,
two-tab isolation, touch/keyboard access, drag/drop and axe scanning.

## Release blockers

Every original P0 item is implemented. The complete matrix, package-content
review and clean packed-tarball Astro 7.1.6 consumer build pass locally. Before
a public beta, rerun that release evidence on the intended tag and obtain owner
approval for npm publication.

### P0.1 — Replace unsafe string mutation with immutable edit ranges

The legacy risk was sequential replacement against an already-modified file,
where one replacement could create the accidental target of a later edit. The
standalone transaction/adapters now resolve and validate edits against source
snapshots and fail closed on stale or ambiguous targets.

Required design:

- Resolve every edit against the same original file snapshot.
- Record an exact source range or structured field path.
- Reject missing, overlapping or conflicting ranges.
- Apply text ranges from highest offset to lowest offset.
- Preserve the original encoding and line endings.
- Hash the original file and reject a changed snapshot before commit.

Acceptance criteria:

- A replacement cannot become the target of a later edit in the same batch.
- Overlapping edits are rejected before any write.
- Stale file hashes are rejected with a recoverable conflict message.
- No file changes when any edit in the batch fails validation.

### P0.2 — Introduce syntax-aware source adapters

The legacy `<>{}` filter did not make raw source replacement safe. The current
pipeline routes supported extensions through syntax-aware adapters and keeps
raw Astro markup behind the explicit `allowUnsafeSourceText` option.

Define an adapter contract resembling:

```ts
interface SourceAdapter {
  id: string;
  supports(filePath: string): boolean;
  locate(input: LocateRequest): Promise<LocatedField[]>;
  preview(edit: StructuredEdit): Promise<FileDiff>;
  apply(edit: StructuredEdit, snapshot: SourceSnapshot): Promise<string>;
  validate(output: string): Promise<ValidationResult>;
}
```

Implement in this order:

1. Astro literal text nodes only.
2. JSON/JSONC property paths.
3. Markdown body and frontmatter.
4. YAML property paths.
5. MDX only after its expression boundaries are handled safely.

Until an adapter exists, remove that extension from the default writable set or
return a clear unsupported-source message.

Acceptance criteria:

- Quotes, apostrophes, Unicode, multiline content and escapes remain valid.
- Astro expressions are not treated as literal text.
- JSON/YAML edits target a property path, not a global string.
- Adapter output parses successfully before writing.
- Formatting preservation has fixtures and documented limits.

### P0.3 — Harden the toolbar protocol

Astro's server-to-toolbar messages are broadcast to connected clients. The
standalone client now addresses and filters every transaction by stable client
and request IDs and validates messages at runtime.

Required changes:

- Generate a stable tab/client ID.
- Track the pending request ID.
- Include both IDs in every save and response.
- Ignore responses not addressed to the current client/request.
- Validate all browser-originated payloads at runtime.
- Add request byte, change-count and source-file-size limits.
- Make saves idempotent by request ID.
- Add a bounded timeout and recoverable retry state.

Acceptance criteria:

- Two tabs can save different pages without clearing each other's queues.
- Replayed requests do not apply twice.
- Malformed payloads return an error without throwing outside the handler.
- Oversized payloads are rejected before file reads.

### P0.4 — Survive HMR and navigation

Writing a source file triggers Astro HMR, which can reload the toolbar before a
success response is visible.

Required changes:

- Persist queued and pending transaction metadata in session storage.
- Keep a bounded server-side receipt cache by request ID.
- Reconcile pending status when the app initialises after HMR.
- Restore previews only when the target can be identified safely.
- Warn before navigation or deactivation when state cannot be preserved.

Acceptance criteria:

- A successful save shows a durable success receipt after HMR.
- A failed save restores the queue and actionable error.
- Reloading does not silently lose an in-flight transaction.
- Old receipts expire and cannot grow without bound.

### P0.5 — Remove unsafe assumptions and validate configuration

- Remove default `header → src/components/Header.astro` and
  `footer → src/components/Footer.astro` mappings.
- Validate CSS selectors before enabling selection.
- Normalise and validate configured paths and extensions at startup.
- Make the client wait for confirmed server configuration before editing.
- Treat route fallback as a candidate, not proof of ownership.
- Add directory-index and dynamic-route mapping fixtures.

### P0.6 — Protect network-exposed development servers

Local-only is a security property, not merely a usage description.

- Detect non-loopback dev-server exposure where Astro makes it available.
- Refuse source writes by default when remotely exposed.
- Provide an explicit `allowRemoteDev` opt-in with a prominent warning.
- Never introduce a production write route in the core integration.
- Document the trust model and LAN threat clearly.

## Implementation phases after P0

### Urgent enhancement request — owner-controlled editability setup (P1.0)

Prototype testing showed that code-only `editableSelectors`,
`excludeSelectors` and `data-astro-editable` annotations are not a sufficient
product workflow. For example, semantically valid text inside a `<strong>`
element is not selectable by default, but the toolbar does not explain why or
give an authorised owner a safe way to opt it in.

Add a local **Editability Setup** mode for site owners and implementers. This is
an urgent product enhancement, but it must not bypass the P0 transaction,
source-adapter or source-attribution safeguards. It is distinct from the
authenticated, deployed client admin system described in Phase 6.

Required capabilities:

- Inventory visible textual content on the current page and show whether each
  item is editable, excluded, structurally unsafe or unresolved.
- Explain the exact eligibility and source-resolution reason in plain language.
- Allow an authorised owner to opt individual elements or stable selector
  groups in or out, including elements such as `<strong>`, without requiring
  them to hand-edit Astro templates.
- Configure or confirm the owning source file and structured field/range where
  it cannot be proven automatically.
- Persist the policy as a reviewable, project-owned manifest or generated code
  patch that is visible in Git; do not keep permissions only in browser state.
- Preview the policy diff and validate selectors, paths and conflicts before
  writing it.
- Keep end editors unable to broaden their own edit permissions. A future
  remote version must enforce roles on the server, not only hide UI controls.
- Preserve explicit `data-astro-edit-ignore` and other safety exclusions unless
  an authorised owner deliberately changes the project policy.

Acceptance criteria:

- A site owner can discover why `01 / PREVIEW` is not editable and safely opt
  that individual value or the approved `strong` selector group into editing.
- The resulting policy survives reloads, HMR and another developer checkout.
- Every eligibility decision can be inspected and traced to a default, project
  rule or explicit annotation.
- Enabling a selector never grants a source write unless source attribution and
  the relevant adapter also validate the edit.
- Policy changes have keyboard-accessible controls, a review step and automated
  tests covering allow, deny, conflict and unsafe-structure cases.

Design this alongside the page-content inventory and source-resolution
inspector. Implement it only on top of the hardened P0 foundations.

### Phase 1 — Maintainable client architecture

Split `src/toolbar.ts` into focused modules:

```text
src/client/
  editor-store.ts
  selection-controller.ts
  source-resolver.ts
  transaction-client.ts
  persistence.ts
  ui/
    workbench.ts
    edit-dialog.ts
    mobile-picker.ts
    styles.ts
src/shared/
  events.ts
  protocol.ts
  validation.ts
src/server/
  transaction-manager.ts
  source-snapshot.ts
  adapters/
```

Use an `AbortController` or equivalent disposer for document listeners. Handle
Astro view-transition lifecycle events. Keep DOM creation safe through
`textContent`; do not introduce user-controlled `innerHTML`.

### Phase 2 — Page content inventory

Create a panel that lists every mapped editable value contributing to the
current page, grouped by:

- page and SEO metadata;
- page body;
- component or section;
- shared source;
- source file and structured path.

Show a shared-content warning and affected-route count before changing values
used by multiple pages. Provide a source-resolution inspector explaining why a
field maps to a given source.

### Phase 3 — Diff, conflict and recovery UX

- Show exact per-file diffs before commit.
- Distinguish previewed, queued, validating, conflicted, written and failed
  states.
- Permit selective commit and selective retry.
- Retain the implemented committed-batch receipts and hash-protected revert.
- Show Git working-tree awareness without automatically committing.

### Phase 4 — Restore SEO editing safely — complete for local beta

Read rendered metadata for discovery, but persist through the appropriate source
adapter and field path. Support at minimum:

- title;
- meta description;
- canonical URL;
- Open Graph title and description;
- robots directives.

Validate length guidance as non-blocking editorial feedback. Validate URLs and
prevent duplicate/conflicting tags.

### Phase 5 — Restore section operations safely — complete for declared Astro regions

Do not rewrite arbitrary Astro component structure. Limit the first release to
explicitly declared editable regions backed by structured arrays or block data.

- Stable section IDs.
- Typed component/block registry.
- Add, remove and reorder structured entries.
- Preview before persistence.
- Reject edits where the owning adapter cannot preserve syntax.

### Phase 6 — Optional remote editorial package

Keep remote editing separate from the local core, for example:

```text
astro-visual-editor                 local development core
@astro-visual-editor/git-provider   provider interface
@astro-visual-editor/github         GitHub branch/commit/PR implementation
```

Remote scope requires separate approval and threat modelling:

- authenticated editor route;
- least-privilege Git provider permissions;
- branch-only writes;
- pull request review rather than direct production commits;
- CSRF protection, audit log, rate limits and secret isolation;
- staging preview and explicit owner merge.

Do not allow the local package's existence to enable production editing.

## Accessibility acceptance criteria

- Every workflow is operable by keyboard as well as pointer/touch.
- Selection mode has a keyboard alternative, such as focused-element editing or
  a searchable page-content list.
- Dialogs have explicit accessible names and descriptions.
- Focus is trapped, restored and never lost after queue/remove actions.
- Status announcements are concise and do not reread the entire ledger.
- Error messages identify the failed change and recovery action.
- Colour is not the only state indicator.
- Forced-colours and reduced-motion modes remain usable.
- Touch controls are at least 44 × 44 CSS pixels.
- WCAG 2.2 AA checks run against empty, queued, saving, success, error and
  conflict states.

## Required automated test matrix

### Unit tests

- Option validation and immutable defaults.
- Protocol runtime parsing.
- Source range discovery and overlap rejection.
- Each source adapter and formatting boundary.
- Path traversal, absolute path and symlink escape.
- File-size, request-size and change-count limits.
- File hash conflicts and write rollback.
- Idempotent request receipts.

### Integration tests

- Static and server-rendered Astro fixtures.
- Conventional, directory-index and dynamic routes.
- Components, layouts, Markdown, JSON, YAML and shared values.
- Production output contains no editor runtime or write endpoint.
- Lowest supported Astro version and current Astro version.

### Browser tests

- Desktop selection, queue, undo, clear and commit.
- Mobile Pick/Review state transition and real touch hit testing.
- Keyboard selection and dialog focus lifecycle.
- HMR success and failure recovery.
- Two-tab response isolation.
- View transitions and route changes.
- Narrow, tablet and desktop screenshots with no overflow.
- Console and page error capture.

Commit browser tests to the repository and run them in CI. Temporary manual
scripts are evidence during development, not a lasting regression suite.

## Release engineering

Before the first public beta:

- Add formatting and linting checks.
- Add dependency and GitHub Actions update automation.
- Run CI on Node 22.12 and 24.
- Test the lowest supported Astro version and current Astro version.
- Install the packed tarball into a clean external fixture.
- Run `npm audit` and inspect `npm pack --dry-run`.
- Add a GitHub Actions trusted-publishing workflow with OIDC.
- Publish from a public GitHub-hosted runner so npm provenance is generated.
- Use a prerelease version until the P0 test matrix is stable.

Recommended initial public version: `0.1.0-beta.1`, not stable `0.1.0`.

The public GitHub repository was created after owner instruction. npm
publication and directory follow-up remain separate owner-approval gates. Do
not infer npm publication authority from repository work.

## Working commands

From the repository root:

```bash
npm ci
npm run dev
npm run test:all
npm audit --audit-level=low
npm pack --workspace astro-visual-editor --dry-run
```

The demo normally uses Astro's default port. When testing alongside other local
services, bind an isolated explicit port and do not stop unrelated processes.

## Definition of release-ready beta

Current evidence:

1. Every original P0 item is implemented with tests — complete.
2. Mobile selection/review works with a real touch context — complete.
3. Keyboard selection and structural controls have equivalent workflows — complete.
4. Astro literal plus JSONC/YAML/Markdown adapters are covered — complete.
5. Multi-tab and HMR commit/recovery/revert tests pass — complete.
6. Production isolation is reverified by the demo build — complete.
7. Documentation matches the implemented capability contract — complete.
8. Packed-package consumer build — complete locally with Astro 7.1.6; rerun on the release tag.
9. Clean/reconciled working tree — required at release handoff.
10. Owner approval — required separately for GitHub and npm public actions.

## Suggested next takeover task

Complete restart-persistent local safety and the pre-commit diff UX as one
bounded component:

1. Persist a bounded, checksummed receipt history under an ignored project-local
   `.astro-visual-editor/` directory.
2. Refuse restore when the current file hash differs from the recorded output.
3. Add a History panel listing batch time, files and status.
4. Generate an exact per-file preview diff before commit.
5. Test server restart recovery, tampered history, expired history and revert.
6. Rerun the complete baseline and update `PROJECT.md`.

Keep Git auto-commit, remote providers, authentication and public publication
outside this bounded task.

## Copyable prompt for a new Codex project

```text
Continue the Astro Visual Editor project in:
/Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor

Read all applicable AGENTS.md files, then read PROJECT.md,
ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md, README.md and the complete research
assessment before changing anything. Treat PROJECT.md and the handoff as current
engineering truth.

Complete only the "Suggested next takeover task" from the handoff: persistent
local receipt history and the pre-commit diff UX. Keep Git auto-commit, remote
providers and npm publication gated. Preserve unrelated user files and changes.
Test the component, run the full regression baseline, update
project/status documents and report exact evidence.
```
