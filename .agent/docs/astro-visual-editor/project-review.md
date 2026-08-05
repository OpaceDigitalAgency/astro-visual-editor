# Astro Visual Editor — Current Engineering Review

**Reviewed:** 4 August 2026
**Baseline:** current `main` on the reviewed date

This is a current code review, not the earlier prototype snapshot. Release
status and external gates are authoritative in [`PROJECT.md`](../../../PROJECT.md).
The current version sequence and takeover gates are maintained in
[`RELEASE_PLAN.md`](../../../RELEASE_PLAN.md).

> **Release update — 5 August 2026:** Beta 4's bounded Editability Setup and
> page inventory are implemented, fully validated and owner-accepted for
> protected publication; `PROJECT.md` is authoritative.

## Verdict

The repository is a verified standalone public beta for its documented local-
development scope. The unsafe and incomplete legacy write paths are not present
in the new architecture. Text, SEO and declared section operations run through
typed, validated transactions and are covered by unit and real browser tests.

Beta.2 is public on npm, published through trusted GitHub OIDC with provenance,
and proven in a clean registry consumer. It should remain a prerelease until
owner acceptance and the remaining product hardening are complete. Astro's
directory card and avatar are external pending outcomes, not missing package
work. The product is not an authenticated production CMS.

## Implemented architecture

```text
packages/astro-visual-editor/src/
  index.ts                         Astro integration and toolbar server channel
  options.ts                       validated configuration/defaults
  toolbar.ts                       Dev Toolbar application and workflow UI
  client/
    history.ts                     bounded undo/redo
    source-resolver.ts             browser ownership resolution
    styles.ts                      responsive/accessibility presentation
  server/
    transaction-manager.ts         idempotent receipts, commit and revert
    file-updater.ts                snapshot/write transaction orchestration
    source-files.ts                path, size, hash and atomic-file controls
    adapters/
      astro.ts                     literal text, head SEO and section regions
      markdown.ts                  body/frontmatter editing
      structured.ts                JSON/JSONC and YAML paths
      shared.ts                    exact ranges and path utilities
  shared/
    events.ts                      protocol event constants
    protocol.ts                    runtime message validation
    types.ts                       discriminated change/request types
```

The package builds separate server and toolbar bundles with declarations. The
demo is a real Astro workspace rather than a mocked host.

## Completed capability review

| Capability                         | Review result                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| Text preview/queue/commit          | Implemented and browser-tested                                      |
| SEO read/edit/persist              | Implemented for Astro head and Markdown/MDX frontmatter             |
| Section add/delete/reorder         | Implemented for declared Astro regions                              |
| Genuine drag/drop                  | Implemented with button and keyboard equivalents                    |
| Default/custom templates           | Implemented with server-owned markup validation                     |
| Undo/redo/clear/individual removal | Implemented                                                         |
| HMR recovery                       | Implemented with bounded server receipts and session state          |
| Multi-tab isolation                | Implemented with client/request addressing                          |
| Commit revert                      | Implemented and refuses to overwrite newer source                   |
| Structured sources                 | JSON/JSONC and YAML exact paths implemented                         |
| Runtime protocol guards            | Implemented with byte/change/text limits                            |
| Network exposure protection        | Writes fail closed unless explicitly opted in                       |
| Mobile workflow                    | Compact Pick/Review model implemented and touch-tested              |
| Accessibility                      | Keyboard, focus, forced-colour/reduced-motion support plus axe gate |
| Production isolation               | Production demo contains no editor/toolbar runtime                  |

Exact legacy comparison is in [`FEATURE_PARITY.md`](../../../FEATURE_PARITY.md).

## Previously reported defects now resolved

- `allowUnsafeSourceText` is typed, configured and passed to the Astro adapter.
- Option tests match the safe empty selector-mapping default.
- Client and request IDs are generated, sent, returned and filtered.
- Shared runtime protocol parsers validate browser-originated requests.
- Changes use a discriminated union and adapter routing by kind/extension.
- Shared event constants are used by both ends of the toolbar channel.
- File snapshots and hashes participate in commit/revert safety.
- Structured adapters are connected to the write pipeline.
- SEO, sections and mobile workflows are implemented.
- Playwright specifications are committed and run through `test:all`/CI.

## Current quality findings

### 1. Toolbar maintainability

`src/toolbar.ts` is more than 1,200 lines and still owns substantial UI construction,
interaction state and lifecycle coordination. Some concerns have already moved
into `client/`, but the entry point should be decomposed before adding
Editability Setup, history or remote-provider UI.

Recommended boundary:

```text
client/
  editor-store.ts
  selection-controller.ts
  section-controller.ts
  transaction-client.ts
  persistence.ts
  ui/workbench.ts
  ui/dialogs.ts
  ui/mobile-picker.ts
```

Preserve the current section-scoped listener disposal when moving controllers.

### 2. Durable recovery

Receipts survive Astro HMR but live in the dev-server process. A full restart
removes the toolbar's safe revert history. Add checksummed, bounded,
project-local receipt persistence with output-hash verification before restore.

Do not automatically stage or commit the whole repository from the core tool;
that risks capturing unrelated working-tree changes.

### 3. Pre-commit inspection

The ledger describes semantic old/new values but does not show the exact file
patch. Generate a per-file diff from validated snapshots before write. The diff
must be derived from the same transaction inputs used for commit.

### 4. Editability onboarding

The Beta 4 candidate adds an owner-facing inventory for
editable/excluded/unresolved/unsafe states and persists reviewed project policy
without bypassing adapter validation. Retain this fail-closed boundary during
owner acceptance and future attribution work.

### 5. Test matrix expansion

The current 20 unit tests and four browser workflows cover the critical beta
path. Further release hardening should add:

- browser conflict/error and failed-HMR recovery states;
- Astro view transitions;
- static and SSR host fixtures;
- lowest/current supported Astro version matrix;
- additional screen-reader/manual keyboard evidence;
- additional production-output markers as the toolbar protocol evolves.

### 6. Repository quality automation

Formatting, linting, Dependabot, the Node 22.12/24 CI matrix and trusted npm
publishing are implemented and verified. Beta.2 was published from
`release.yml` through npm OIDC with SLSA provenance; the anonymous registry
consumer and current main CI also pass. Remaining distribution work is to
observe Astro's scheduled catalogue import, verify its rendered card and avatar,
and retain the same evidence for future releases.

## Security review

The core trust boundary is appropriate for a local developer tool:

- no production write route;
- non-loopback writes disabled by default;
- allowed extensions and source/project roots enforced;
- realpath/symlink escape checked;
- request, text, source-file and change-count limits;
- stale hashes and ambiguous targets rejected;
- compiler/parser validation before write;
- atomic writes and best-effort rollback;
- revert protected by current-output hashes.

`allowRemoteDev` and `allowUnsafeSourceText` are explicit expert options and
should remain prominently documented. A future deployed editor requires a
separate security design and must not reuse local trust assumptions.

## Validation evidence

Current local evidence:

- 6 Vitest files, 20 passing tests;
- 4 passing Chromium end-to-end workflows;
- TypeScript and `astro check` clean;
- demo production build clean;
- npm tarball inspection clean;
- tarball installed and built in a fresh Astro 7.1.6 consumer;
- public beta.2 installed and built from the anonymous npm registry;
- beta.2 published through the configured trusted publisher with SLSA
  provenance;
- dependency audit reports zero known vulnerabilities.

CI is configured for Node 22.12 and 24 with Chromium installation, and both jobs
have passed publicly on the beta.2 release commit and the latest documentation
commit. npm's qualifying searches return the package, and it is absent from
Astro's importer blocklist. The public directory card and issue #2597 avatar
remain controlled by Astro.

## Recommended next task

Complete owner localhost acceptance for the implemented Beta 4 Editability
Setup/content inventory, then use the protected versioning, CI and npm release
path in [`RELEASE_PLAN.md`](../../../RELEASE_PLAN.md).
