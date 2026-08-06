# Changelog

All notable changes to this project will be documented here.

The project follows [Semantic Versioning](https://semver.org/).

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

### Changed

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
