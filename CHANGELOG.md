# Changelog

All notable changes to this project will be documented here.

The project follows [Semantic Versioning](https://semver.org/).

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
- Added `RELEASE_GUARDRAILS.md` with the only permitted release path, required
  GitHub protections and Astro-directory follow-up.

### Documentation

- Added an authoritative release and takeover plan beginning from the real
  public beta.2 baseline.
- Reconciled testing, npm trusted-publishing, registry-consumer and Astro
  importer evidence across all current project documents.
- Recorded that Astro's current unmodified importer generates the expected
  integration entry and categories; public catalogue rendering remains an
  external Astro step.

## 0.1.0-beta.2 - 2026-08-04

### Fixed

- Corrected the automatic-install command after a clean registry test proved
  Astro 7.1.6 rejects npm version and dist-tag suffixes in `astro add` package
  names.
- Linked package badges directly to the public npm listing.

### Changed

- Pinned the OIDC release workflow to npm 11.19.0.
- Added the reusable Astro theme product, quality and Developer Portal
  submission plan.
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
