# Astro Visual Editor — Strategic Product Review

**Reviewed:** 4 August 2026
**Scope:** Current product position, completed functionality, remaining product
gaps and recommended investment order

This review is current against commit `afcaa42`. Engineering release truth
remains in [`PROJECT.md`](../../../PROJECT.md), while exact legacy parity is
recorded in [`FEATURE_PARITY.md`](../../../FEATURE_PARITY.md).

## Executive verdict

Continue the product.

The extracted integration is no longer a text-only prototype. It is a working,
development-only visual source editor with complete user-facing parity against
the original site-specific editor and stronger capabilities than the legacy
implementation. Its clearest differentiator is still valuable: the rendered
page acts as the unified review surface while a typed change ledger collects
edits across source files.

The next product decision is not whether to rebuild the legacy editor—it has
been rebuilt. It is whether to keep this as a high-quality local developer tool
or fund a separate authenticated editorial product for non-technical clients.
The local core is useful on its own and should not be weakened by prematurely
adding production authentication, GitHub tokens or broad Git automation.

## Current product truth

| Area | Current status | Remaining boundary |
| --- | --- | --- |
| Text editing | Complete for literal Astro/Markdown values and explicitly mapped structured fields | Arbitrary expressions are intentionally refused |
| SEO editing | Complete for title, description, keywords, canonical, Open Graph title/description and robots | No bulk cross-page SEO inventory |
| Section editing | Complete for declared contiguous Astro regions | Arbitrary component trees are not rewritten |
| Section drag-and-drop | Genuine pointer drag/drop plus buttons and keyboard alternatives | Regions require stable section IDs |
| Source formats | Astro, Markdown/frontmatter, JSON/JSONC paths and YAML paths | Unstructured MDX expressions are refused |
| Queue/review | Mixed typed ledger, individual removal, undo/redo, clear and idempotent commit | No exact file-level diff view yet |
| Revert | Receipt-backed, hash-protected revert survives HMR | Receipt history does not survive a complete server restart |
| Safety | Runtime guards, limits, hashes, atomic writes, rollback, compiler validation and path/symlink controls | Post-validation multi-file rollback remains best effort |
| Browser resilience | HMR recovery, navigation state and two-tab request isolation | No multi-user collaboration model |
| Mobile/accessibility | Touch Pick/Review flow, keyboard controls, reduced motion, forced colours and axe gate | Broader assistive-technology coverage can grow |
| Production isolation | No production editor runtime or public write route | Therefore no deployed client access |
| Editability administration | Developer selectors, mappings and source annotations | No owner-facing setup/inventory UI |

## What is proven now

- The standalone package has no dependency on the original website.
- It uses Astro's public Integration and Dev Toolbar APIs.
- The original section endpoint's false-success behaviour has been replaced by
  real source persistence.
- The legacy documentation-only drag claim is now a real drag/drop workflow.
- Text, SEO and section edits share one validated transaction pipeline.
- Unsupported, ambiguous, stale, oversized or out-of-root edits fail closed.
- Four committed Chromium workflows cover desktop, mobile, HMR commit/revert,
  two-tab isolation, keyboard controls, drag/drop and axe scanning.
- Nineteen Vitest tests cover configuration, protocol, source adapters,
  transactions, paths and revert.
- A generated npm tarball installs and builds in a clean Astro 7.1.6 consumer.
- The dependency audit reports zero known vulnerabilities.

These are local and repository-level facts. They do not imply npm publication,
Astro directory appearance, deployed-site verification or owner acceptance.

## Product value

### Strongest use case today

The present product is a source-aware workbench for developers and technical
site owners who want to review a rendered Astro page, make several related
content/SEO/section changes, inspect the queue and commit them as one validated
batch without manually visiting every contributing file.

That is narrower than a hosted CMS, but it is not merely a cosmetic alternative
to a code editor. The rendered page supplies context that a file tree does not,
and the ledger makes a multi-file review workflow explicit.

### Commercial expansion opportunity

A separately packaged remote editorial layer could serve clients and marketing
teams through authentication, branch-only Git writes, pull requests and deploy
previews. That would broaden the market materially, but it introduces a
different security and operations product. It should be designed as an
optional provider package rather than switching the local core into production
write mode.

Suggested package boundary:

```text
astro-visual-editor                       local development core
@astro-visual-editor/provider             write-provider contract
@astro-visual-editor/github               branch/commit/pull-request provider
@astro-visual-editor/remote               authenticated deployed editor shell
```

No remote package should expose a production write route without explicit
threat modelling, CSRF protection, rate limits, audit logs, least-privilege
credentials and branch/review enforcement.

## Central product problem: source attribution

The browser can show the fully composed page, but rendered HTML cannot
universally prove which source file, expression or structured field produced a
value. The current implementation handles this honestly through:

1. explicit `data-astro-edit-file` and `data-astro-edit-path` annotations;
2. stable `data-astro-edit-id` selectors;
3. configured selector and route mappings;
4. conservative route-file candidates; and
5. syntax-aware adapters that verify the final target before writing.

The previous recommendation to scan every import, `getCollection()` call and
expression at startup is too broad as a first solution. Static analysis cannot
reliably recover every runtime data flow, component prop transformation,
remote fetch or framework integration. It would create false confidence.

Recommended progression:

1. Build an Editability Setup/content inventory that explains current
   eligibility and attribution.
2. Persist reviewed mappings in a project-owned manifest.
3. Add bounded tracing for known patterns such as direct JSON/YAML imports and
   content collection fields.
4. Treat inferred attribution as a suggestion until the adapter validates an
   exact source field.
5. Adopt richer compiler/source-map information later if Astro exposes a
   supported public API.

## Recommended roadmap

### Priority 1 — persistent recovery and exact pre-commit diff

This is the best next bounded engineering component.

- Persist a bounded, checksummed receipt history under an ignored
  `.astro-visual-editor/` project directory.
- Refuse revert when the current file hash differs from the committed output.
- Show exact per-file diffs before commit.
- Add a History panel with batch time, files, status and safe revert.
- Test restart recovery, tampered/expired history and conflict refusal.

This provides durable safety without automatically staging or committing the
user's unrelated working-tree changes.

### Priority 2 — Editability Setup and page-content inventory

This is the highest-impact usability enhancement.

- Overlay editable, excluded, unresolved and structurally unsafe content.
- Explain why each element can or cannot be edited.
- Let an authorised site owner review element/selector allow and deny rules.
- Confirm source file and structured path where attribution is unresolved.
- Persist policy in a reviewable project manifest or generated source patch.
- Never let an allow rule bypass adapter/source validation.
- Provide keyboard-accessible setup, review and conflict workflows.

This removes the current hand-annotation bottleneck while preserving the
fail-closed write model.

### Priority 3 — bounded attribution and schema awareness

- Trace direct data imports and content-collection fields where provenance can
  be established deterministically.
- Warn when a structured value is shared by multiple routes.
- Use project schemas to select controls and validate dates, enums, URLs and
  required values.
- Keep manual mappings available as the authoritative fallback.

### Priority 4 — maintainability and release engineering

- Split the 866-line toolbar entry point into store, selection, transaction,
  persistence and UI modules.
- Add formatting/linting and dependency-update automation.
- Expand browser states to error/conflict, view transitions and additional
  viewport/accessibility combinations.
- Add an npm trusted-publishing workflow only when the repository and npm
  package are ready for public release.
- Release a prerelease before declaring stable `0.1.0`.

### Priority 5 — optional remote editorial product

- Define a provider contract before selecting an authentication library or Git
  implementation.
- Require branch-only writes and pull-request review.
- Surface deploy-preview status and prevent direct production commits.
- Add role permissions, audit records, conflict handling and revocation.
- Keep all credentials server-side and outside the local core package.

### Later or optional

- Bulk multi-page SEO/content operations.
- Companion/deep-link integration with Keystatic or another structured admin.
- Visual screenshot regression for structural template changes.
- Multi-user real-time collaboration.

## Recommendations changed from the earlier review

### Retain

- The rendered-page-as-review-surface positioning.
- Editability Setup and a page-content inventory.
- Persistent history and an exact file diff.
- A separate authenticated Git/PR provider for future client access.
- Schema awareness and shared-content warnings.
- Keystatic as an optional complement for collection/bulk administration.

### Change

- Treat client access as a strategic expansion, not proof that the local tool
  serves the "wrong audience".
- Use deterministic, bounded source tracing rather than promising automatic
  support for every Astro architecture.
- Use project-local durable receipts before Git automation.
- Make remote editing separate packages rather than enabling production writes
  in the core integration.
- Replace fixed week estimates with acceptance criteria; effort depends on the
  target site's architecture, auth/provider choice and release process.

### Remove or defer

- Do not let the core tool run `git add .` or automatically commit a potentially
  dirty repository. That can capture unrelated user work and creates surprising
  repository side effects.
- Do not describe JSON/YAML adapters, SEO, sections, mobile mode, protocol
  guards or browser tests as missing; they are implemented.
- Do not describe a Playwright screenshot comparison as a pre-write guarantee.
  Pixel diffs are useful evidence but are noisy and cannot prove semantic or
  functional correctness.
- Do not hard-code Better Auth, Octokit, `simple-git`, `jsdiff` or `diff2html`
  before provider contracts and bundle/security requirements are agreed.
- Do not claim this is the only Astro tool with a rendered-page editing model
  without a fresh market comparison.

## Release assessment

The repository is a credible local beta candidate for its documented scope.
It is not yet a stable public product because owner acceptance, public release
workflow and ecosystem installation/listing verification remain separate
gates. Remote/client editing is not part of this release.

Before the first npm prerelease:

1. rerun `npm run test:all` on the release commit;
2. run the Node 22.12/24 CI matrix;
3. rebuild/install the packed tarball in a clean consumer;
4. verify production isolation;
5. review repository visibility, security policy and issue templates;
6. configure provenance/trusted publishing; and
7. obtain explicit owner approval for npm publication.

## Final recommendation

Ship and learn from the local beta before building a remote CMS.

The next implementation should combine restart-persistent recovery with an
exact pre-commit diff. Follow that with Editability Setup/content inventory.
Those two investments strengthen trust and onboarding for every future path,
including a later authenticated Git/PR product.
