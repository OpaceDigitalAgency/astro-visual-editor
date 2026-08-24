# Changelog

All notable changes to this project will be documented here.

The project follows [Semantic Versioning](https://semver.org/).

## Unreleased

### Changed

- Replaced every product icon consumer with one canonical transparent 512px
  logo, including the Astro Dev Toolbar, demo favicon and GitHub artwork.

## 0.1.0-beta.6 - 2026-08-08

### Added

- Added zero-step editing on unannotated Astro sites: enabling the editor on a
  page with no annotations, no route mappings and no policy automatically
  resolves text (every discovered element is batch-searched in one bounded
  source scan; a text with exactly one literal occurrence becomes editable
  immediately) and automatically infers structure (a unique, structurally
  verified section-discovery match becomes a live reorderable region).
  Ambiguity keeps the confirm dialogs, unmatched content stays honestly
  protected, and save-time validation still re-verifies every write.
- Added double-click in-place text editing with an explicit caret at the
  pointed-at character, Enter to keep, Escape to restore the original — and
  the editor owns Escape end to end, so cancelling an edit no longer closes
  the whole app. Verified on WebKit (Safari's engine) as well as Chromium.
- Added press-and-hold drag anywhere on an unlocked block, alongside the
  existing handle, move buttons and keyboard controls.
- Added plain-language lock explanations: protected content shows "Why can't
  I edit this?" with the real reason on its hover tag and toolbar, and page
  authors can supply custom messages per area via `lockedAreaMessages`.
- Added an editable-only filter toggle that dims everything the current page
  cannot edit.
- Added durable session restore: every file saved in a session can be rewound
  to its pre-session state, across page reloads, closed tabs and restarts.
- Added converging save recovery: when queued changes go stale because files
  changed underneath them, the failing change is flagged in the tray with a
  plain reason, and one click of "Save the rest" writes every valid change
  while setting the stale ones aside for review.
- Added stable change identity: re-editing the same element always updates
  its existing queued change, even after structural edits renumber every
  selector on the page.
- Added a zero-setup demo page ("Plain") to the demo switcher, plus
  @astrojs/sitemap and prefilled SEO values so the demo represents a
  standard, best-practice Astro site.

- Added a progressive-disclosure canvas: at rest the page shows only faint
  source-aware hierarchy boundaries and persistent Locked/Protected corner
  chips; hovering reveals one name tag for the pointed-at level; selecting
  shows a single full toolbar anchored above the element's edge.
- Added a **Page structure** navigator tree to the Builder panel showing every
  group, row, section and block with its lock state. Clicking an item selects
  and scrolls to it on the page, and unlocked items carry move up/down
  controls, so whole pages can be rearranged from the tree alone.
- Added one merged toolbar per pointed-at element: text that forms a
  reorderable block exposes edit, lock, move, drag and delete together, so a
  block never needs a second competing control bar.
- Added a landing-edge drop preview: while dragging, an accent bar on the drop
  target's top or bottom edge shows which side the block will land on.
- Added structured-array blocks to the composed demo: the three evidence cards
  are individually reorderable and commit as a clean JSON array reorder.
- Added reorder-safe mixed batches: reordering a JSON/YAML array and editing
  text inside the same array now saves in one atomic batch — queued edit paths
  are remapped through the reorder's permutation server-side.
- Added inspector navigation: a persistent **Back to page structure** control,
  and clicking empty canvas deselects back to the tree.
- Added full SEO editing on the composed fixture: the demo layout accepts and
  renders keywords, canonical, Open Graph and robots, so every field in the
  Page form resolves to a literal prop and stays editable.
- Added deliberate locked and unlocked text and section examples to both demo
  routes, plus an immutable source-protected example on the simple route.
- Added an explicit source-owned four-section region to the composed fixture so
  complex structure editing is available immediately rather than requiring a
  setup journey.
- Added a three-level canvas grammar: blue groups, green rows, teal sections
  and neutral blocks, with Editable, Locked and Protected states written as
  text so they never rely on an icon or colour alone. Locked and Protected
  chips stay visible at rest; other labels appear on hover and selection.
- Added regression coverage for adding two identical section templates and
  editing each new paragraph independently in the same atomic save.
- Added nested row/block regions to the complex fixture, including a movable
  primary-action button, with a regression that saves two consecutive block
  orders through Astro HMR.
- Added plain-language save recovery that keeps the complete local draft and,
  when one change can be identified safely, offers **Keep editing** or **Save
  the rest** without discarding the failed change.

### Changed

- Replaced the everyday Settings > select > hierarchy modal > review > save
  permission journey with one-click Lock and Unlock controls directly on the
  rendered page and in the selected-item inspector.
- Made canvas selection authoritative: one Builder canvas replaces the global
  Content/Structure mode choice. Clicking text or a named section opens the
  matching contextual inspector automatically; Page remains separate.
- Kept advanced policy, source-discovery and syntax-aware validation machinery
  internally, while removing Editor Setup from the ordinary editing surface.
- Made every source-owned group, row, section and block enumerable at
  activation through the Page structure tree, while the rendered page stays
  visually quiet until hovered — toolbars anchor above an element's edge and
  never cover the content being edited.
- Reduced contextual toolbars to familiar compact icons and moved add-before
  and add-after into the section inspector, preserving those capabilities
  without allowing a toolbar to overlap an adjacent column.
- Replaced the manual Queue change step with debounced local auto-queueing and
  live preview. Source files still change only through the explicit Save and
  apply safety check.
- Replaced locked editable-looking fields with a clear Locked/Protected card
  and removed the mobile behaviour that silently unlocked content on tap.
- Applied structural additions before dependent text edits and scoped Astro
  literal lookup to the owning section, fixing same-batch saves for text edited
  inside a newly added template.
- Reset the structural source baseline after every successful save and safely
  rebase order-only drift, fixing repeated saves that previously reported
  `Section order changed before commit`.
- Persisted the temporarily deferred failed item before **Save the rest**, so a
  fast Astro HMR/navigation on Node 24 cannot lose it before the independent
  save response returns.

### Security

- Direct lock changes remain owner-only and loopback-only. The server validates
  an exact policy diff and expected manifest hash before the one-click action is
  persisted; source exclusions and adapter checks remain authoritative.

## 0.1.0-beta.5 - 2026-08-06

### Added

- Added a composed demo page that renders through a shared layout and reusable
  components while sourcing editable values from direct JSON imports and an
  Astro Content Collection entry.
- Added an optional, local-only demo-page switcher so testers can move between
  the original single-file fixture and the composed-source fixture.
- Added visible structured source paths and a shared-route warning before an
  affected value is queued for editing.
- Added browser coverage that reviews, commits and safely restores a JSON
  property and Markdown frontmatter field in one multi-file batch.
- Added syntax-aware project source discovery for exact Astro,
  Markdown/frontmatter, JSON/JSONC and YAML values, including separate
  stale-checked locators for repeated Astro literals.
- Added owner-confirmed section setup that maps existing rendered containers to
  contiguous Astro children or complete JSON/JSONC and YAML arrays without
  requiring editor annotations in site components.
- Added policy-backed section mappings with exact source-item hashes, reviewed
  policy persistence and safe refresh after source order changes.
- Added browser coverage that enables four mixed component/element blocks on
  the complex fixture, reorders them, commits the exact Astro diff and restores
  the source.
- Added nested region coverage that enables a component's direct text and
  button children independently, reorders them alongside a parent-page move,
  saves both files atomically and restores both sources.
- Added a hierarchical on-page region chooser that exposes the smallest area,
  parent areas and whole page from one click, including rendered cards backed
  by JSON or YAML arrays.

### Changed

- Reworked the rendered-page editor around the interaction model familiar from
  Divi and Elementor: a persistent purple left inspector, icon-led **Content**,
  **Structure** and **Page** tabs, clear mode titles and one prominent **Review
  changes** action.
- Made desktop selection open an object-named settings inspector rather than a
  detached text modal. Heading, paragraph and section settings now retain the
  selected canvas outline and use stable **Content / Design / Advanced** tabs.
- Moved functional text replacement and queueing into the Content inspector,
  exposed exact file/field/selector ownership under Advanced, and displayed
  computed typography and spacing under Design without implying that an
  unresolved CSS source can be written safely.
- Added section settings to the same inspector, with source-safe add before,
  add after and delete actions alongside the contextual canvas toolbar.
- Added persistent page-facing content affordances that identify editable
  headings, paragraphs and other text before selection, while explaining
  locked, unresolved and unsupported content instead of ignoring the click.
- Replaced scattered section actions with contextual blue on-page toolbars for
  add, move, drag and delete. Only the active section toolbar is shown within a
  region, reducing visual collisions on nested layouts.
- Kept the inspector open beside the page during desktop structure editing and
  retained the compact touch picker on narrow screens, so selection no longer
  causes an unexpected desktop mode change.
- Preserved all existing source-aware Setup, change review, undo, redo, history,
  safe retry, save and restore capabilities behind the redesigned interface.
- Simplified the workbench around three editing modes and one compact
  **Changes (N)** tray, keeping review, undo, redo, history, discard and restore
  available without presenting review as a competing editing mode.
- Made owner Settings start with matching on-page selectors for text and
  sections. Full searchable text and section management now stays behind
  explicit progressive-disclosure controls.
- Separated the neutral editor surface and demo-only route switcher from the
  host page, reserved orange for primary save actions and limited page outlines
  to the currently hovered or selected item.
- Renamed ambiguous source-control language to owner-facing save, discard and
  restore actions while preserving exact diffs and collapsed technical detail.
- Made each queued-change receipt lead with the affected page, a concise
  owner-readable description and visible before/after content. Exact source
  paths, selectors, hashes and complete structural order remain under collapsed
  technical details.
- Kept syntax-aware adapters and confirmed project mappings as the final
  authority. Ambiguous, transformed or non-reversible data flow is refused
  rather than guessed or globally replaced.
- Made explicitly mapped structured fields use their file and source path as a
  stable preview target, so repeated component output is edited independently.
- Kept Sections mode open with a clear explanation when the current page has
  no declared source-owned section region.
- Made section-region setup visible in the owner Settings screen alongside
  text permissions, with current-route mappings and reviewed removal controls.
- Preserved draft section mappings when text permission rules are added or
  removed, so independent setup changes cannot discard one another.
- Replaced developer-facing section and text setup with one consistent visual
  picker: readable labels, on-page hover highlighting and click selection.
- Moved syntax paths and file candidates behind collapsed technical details,
  automatically accepting only a uniquely scored structural source match.
- Matched parsed Astro literal nodes before considering quoted-value fallback,
  preventing identical words in annotations from causing false ambiguity.
- Made the section picker describe its direct-child boundary and allow an
  inner component region to be enabled separately, with readable Heading,
  Text, Button, Card and Section control labels.

### Fixed

- Preserved page-authored accessible names and tab states while structure
  controls are active, instead of overwriting or removing them when the editor
  changes mode.
- Made delegated Astro SEO fields update unique literal route props when a
  layout owns the rendered `<head>`, while refusing missing, computed or
  ambiguous prop matches.
- Exposed every SEO field shown by the complex fixture through its layout, so
  keywords, canonical, social metadata and robots changes all have a safe,
  explicit source target at final review.
- Matched structured-array section candidates against the ordered rendered
  values before enabling card reordering, preventing unrelated equal-length
  arrays from being selected.
- Stopped section setup from silently accepting an unrelated source structure
  merely because its container had the same number of children.
- Added composed-page regressions for delete and Undo, guarded section-source
  confirmation, and one atomic JSON, Markdown frontmatter and SEO batch.
- Prevented generated section metadata from becoming persistent CSS selectors
  or biasing nested source discovery toward the parent page file.
- Kept section controls outside the host element so headings, paragraphs and
  buttons remain valid HTML while their source-owned region is being edited.
- Added a bounded source-preview timeout that preserves queued changes and
  offers a safe retry instead of leaving the editor on “Checking source files”.
- Aligned source-discovery and save-time hashes for multiline Astro closing
  tags, preventing a valid nested reorder from being rejected or malformed.

## 0.1.0-beta.4 - 2026-08-05

### Added

- Added a docked, owner-facing Editability Setup that inventories visible page
  content as editable, blocked, unresolved or structurally unsafe.
- Added reviewed per-element and selector-group allow/deny rules, including a
  safe workflow for opting `<strong>` labels into editing.
- Added source-file and structured-path confirmation for unresolved content.
- Added a project-owned `astro-visual-editor.policy.json` manifest with exact
  diff review, conflict protection and restart/reload persistence.

### Changed

- Made Editability Setup a guided choose, review and save flow, automatically
  opening permission review, clearly flagging unsaved choices, and returning
  directly to normal editing after save with labelled Back to editor controls.
- Kept Setup notices, the scrolling inventory and the fixed action bar in
  separate layout rows so saved messages cannot overlap the controls.

### Security

- Editability policy writes are restricted to explicit owner mode on loopback;
  editor mode and network-exposed development servers cannot broaden policy.
- Allow rules remain subordinate to explicit exclusions, structural checks,
  source attribution and syntax-aware adapter validation.

## 0.1.0-beta.3 - 2026-08-05

### Fixed

- Allowed Astro source hot reloads to complete while another tab has queued
  edits; that tab restores its isolated queue from session storage afterwards.

### Added

- Added an exact per-file source review before any queued batch can be written.
- Added checksummed, restart-persistent local save history with visible status,
  files, time and conflict-protected restore controls.

### Changed

- Made the workbench smaller and scrollable, stopped queue controls stretching,
  grouped section controls into two compact rows, and automatically tucked the
  panel away while arranging page sections.
- Replaced tag-triggered publishing with a guarded GitHub Actions release that
  enforces the complete test baseline, release documents, clean tarball
  consumer build and published-registry consumer build before it completes.
- Added protected release validation, clean-consumer checks and post-publish
  verification.

### Documentation

- Improved release validation and package-discovery metadata.

## 0.1.0-beta.2 - 2026-08-04

### Fixed

- Corrected the automatic-install command after a clean registry test proved
  Astro 7.1.6 rejects npm version and dist-tag suffixes in `astro add` package
  names.
- Linked package badges directly to the public npm listing.

### Changed

- Pinned the OIDC release workflow to npm 11.19.0.
- Added a catalogue-ready 64 × 64 product avatar.

## 0.1.0-beta.1 - 2026-08-04

### Added

- Astro integration with automatic Dev Toolbar registration.
- Click-to-edit text mode for development pages.
- Browser-side change queue with review, undo and validated batch save.
- Explicit `data-astro-edit-file` source mapping and safe route fallbacks.
- Fail-closed source-file validation and path traversal protection.
- Workspace demo, fixture pages, unit tests and package validation.
- Full legacy parity: text, SEO and persistent section add/delete/reorder modes.
- Genuine section drag-and-drop with button and keyboard alternatives.
- Default and configurable section template registry.
- Syntax-aware Astro, Markdown/frontmatter, JSONC and YAML source adapters.
- Runtime-validated, bounded, client-addressed and idempotent toolbar protocol.
- Session/HMR recovery, multi-tab isolation and retry-safe receipts.
- Atomic writes, stale hashes, remote-dev protection and safe last-batch revert.
- Compact touch Pick/Review workflow.
- Committed Playwright and axe browser regression suite.
- Automated production-output isolation assertion.
- Reconciled engineering and strategic reviews plus an explicit local demo/test guide.
- Functional desktop collapse/expand, dialog backdrop dismissal and section-control tooltips.
- Semantic structural ledger summaries with labelled before/after order.
- Scoped public package identity: `@opacedev/astro-visual-editor`.
- Canonical product page within Opace's `/tools/` directory; technical docs
  remain versioned in the GitHub repository.
- Trusted-publishing, formatting, linting and dependency-update automation.
- Astro directory metadata, category keywords and product avatar asset.
- Compiler-validated matching for formatted multiline Astro literal text.
- Resilient pending-receipt polling and integration-lifetime transaction state
  across source HMR.
