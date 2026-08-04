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
5. [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

If a historical claim conflicts with the current code or `PROJECT.md`, inspect
the code and update the project document rather than relying on the historical
claim.

## Executive decision

Continue the standalone Astro integration, but treat the existing `0.1.0` as a
working prototype rather than a stable public release.

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
- Browser preview and queued-change ledger.
- Undo individual changes, clear the queue and commit a batch.
- Project-root, source-root, extension and symlink-escape checks.
- Rejection of stale or ambiguous source strings.
- Unit tests, demo fixtures, CI, packaging metadata and documentation.
- A clean production build with no editor runtime.

### What does not yet exist

- Syntax-aware `.astro`, Markdown, MDX, JSON or YAML editing.
- Reliable editing of component props, expressions or repeated values.
- A complete page-content inventory.
- Persistent SEO editing.
- Persistent section add/delete/reorder operations.
- Queue recovery after HMR or navigation.
- Safe response isolation between multiple open browser tabs.
- Client-facing authentication, Git commits or pull-request workflow.
- Committed browser end-to-end tests in CI.
- A public GitHub repository or npm release.

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

The normal page click then opened the edit dialog with no console errors. The
proof changed only the browser DOM, not repository files.

### Required interaction model

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

## Release blockers

Complete every P0 item before a public beta.

### P0.1 — Replace unsafe string mutation with immutable edit ranges

Current behaviour applies each queued replacement to the already-modified file.
An earlier replacement can create text that a later change accidentally matches.

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

The current `<>{}` filter does not make raw source replacement safe. For
example, an apostrophe can break a JavaScript string and an unescaped quote can
break JSON.

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
current client creates a request ID but does not filter responses by it.

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
- Add committed-batch receipts and an explicit revert operation where safe.
- Show Git working-tree awareness without automatically committing.

### Phase 4 — Restore SEO editing safely

Read rendered metadata for discovery, but persist through the appropriate source
adapter and field path. Support at minimum:

- title;
- meta description;
- canonical URL;
- Open Graph title and description;
- robots directives.

Validate length guidance as non-blocking editorial feedback. Validate URLs and
prevent duplicate/conflicting tags.

### Phase 5 — Restore section operations safely

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

Public GitHub creation, npm publication and directory submission remain owner
approval gates. Do not infer publication authority from implementation work.

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

The beta is ready only when:

1. Every P0 item is implemented with tests.
2. Mobile selection and review work with real touch events.
3. Keyboard editing has an equivalent complete workflow.
4. At least Astro literal text and one structured data adapter are safe.
5. Multi-tab and HMR recovery tests pass.
6. A packed-package consumer build passes.
7. Production isolation is reverified.
8. Documentation matches actual behaviour and limitations.
9. The working tree contains no unexplained files or changes.
10. Owner approval is received for each public action.

## Suggested first takeover task

Implement only the hardened transaction protocol and immutable range engine:

1. Move shared event names and message types into `src/shared/`.
2. Add runtime message guards.
3. Add client and request IDs with response filtering.
4. Resolve edits against immutable file snapshots.
5. Detect overlaps and apply ranges in reverse order.
6. Add file hashes and an in-process transaction mutex.
7. Expand unit tests, run the complete baseline and update `PROJECT.md`.

Do not combine this first task with mobile UI, SEO, section editing, remote Git
providers or publication.

## Copyable prompt for a new Codex project

```text
Continue the Astro Visual Editor project in:
/Users/davidbryan/Dropbox/Opace-Sales-Marketing/astro-visual-editor

Read all applicable AGENTS.md files, then read PROJECT.md,
ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md, README.md and the complete research
assessment before changing anything. Treat PROJECT.md and the handoff as current
engineering truth.

Complete only the "Suggested first takeover task" from the handoff: harden the
transaction protocol and implement immutable, overlap-safe source ranges. Keep
all public GitHub/npm actions gated. Preserve unrelated user files and changes.
Test the component, run the full regression baseline, update project/status
documents and report exact evidence.
```
