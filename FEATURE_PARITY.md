# Legacy feature parity

This document answers one narrow question: does the standalone package contain
everything the original site-specific editor exposed to users?

**Answer:** yes for the original local-development feature set. Where the old
implementation was incomplete, the standalone version supplies a real,
validated implementation instead of reproducing the false-success behaviour.

## Evidence boundary

The legacy reference is:

```text
/Users/davidbryan/Dropbox/Opace-Sales-Marketing/Low Cost Websites/Website
```

Its `public/visual-editor-v2.js` provided the interface. Its
`visual-editor-server.js` provided localhost endpoints. The section endpoint
only recorded history and logged an operation; it did not rewrite Astro source.
The legacy README mentioned section drag-and-drop, but the client contained no
drag event implementation and used move-up/down buttons.

## Feature matrix

| Legacy capability                 | Standalone implementation                                   | Validation                          |
| --------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| Toggle editor from development UI | Native Astro Dev Toolbar app                                | Integration unit test and real demo |
| Click visible text                | Text mode with stable selector/source resolution            | Playwright desktop/touch workflows  |
| Modal text editing                | Native labelled modal dialog                                | Playwright focus and queue tests    |
| Browser preview before save       | DOM preview separated from source transaction               | Playwright text workflow            |
| Queue multiple changes            | Typed mixed-change ledger                                   | Unit and browser tests              |
| Remove one queued change          | Per-row undo control                                        | Browser workflow                    |
| Undo last / undo all              | Bounded undo/redo plus Clear                                | Browser workflow                    |
| Keyboard save/undo                | Cmd/Ctrl+S, Z, Shift+Z and Y                                | Client implementation               |
| Save all                          | Runtime-validated idempotent batch transaction              | Unit, adapter and HMR commit tests  |
| Server connectivity status        | Connecting/ready/warning/error states                       | Browser workflow                    |
| Section mode                      | Explicit source-owned editable regions                      | Browser workflow                    |
| Move section up/down              | Accessible buttons and Alt+Arrow shortcuts                  | Desktop/mobile browser tests        |
| Drag section                      | Genuine drag-handle/drop implementation                     | Real pointer-drag Playwright test   |
| Add before/after                  | Both placements supported                                   | Browser add-template workflow       |
| Section templates                 | Default hero/features/text registry plus custom templates   | Adapter and browser tests           |
| Delete section                    | Confirmed preview with undo                                 | Browser delete/restore workflow     |
| Persist section operations        | Astro compiler-positioned block rewrite                     | Adapter unit test                   |
| SEO modal                         | Title, description, keywords, canonical, OG and robots form | Browser workflow                    |
| Persist Astro SEO                 | Head elements updated/inserted and compiled                 | Adapter unit test                   |
| Persist Markdown SEO              | YAML frontmatter adapter                                    | Adapter implementation              |
| Post-save undo                    | Receipt-backed safe revert                                  | Unit and HMR browser tests          |
| 50-step client history            | Bounded `ChangeHistory`                                     | Unit-typed implementation           |

## Improvements beyond parity

- Real drag-and-drop rather than a documentation-only claim.
- Mobile Pick/Review workflow with page touch access.
- Keyboard-equivalent selection and section ordering.
- JSON/JSONC/YAML structured field adapters.
- Markdown and MDX frontmatter support.
- Exact client/request addressing for multiple tabs.
- HMR queue and pending-transaction recovery.
- Retry-safe idempotency receipts.
- Stale hash, path, symlink, extension, source size and request size checks.
- Network-exposed dev-server write refusal.
- Atomic writes, rollback and conflict-protected revert.
- Committed Playwright and axe regression tests in CI.
- Functional compact collapse on desktop, visible section-control tooltips,
  light-dismiss dialogs and semantic structural review summaries.

## Deliberate non-parity

The following legacy internals were not copied because they were unsafe or
unfinished:

- standalone Express/CORS server;
- public localhost API paths;
- global regex/string replacement across arbitrary source;
- inline event-handler HTML;
- hard-coded assumptions about one website's files;
- section endpoints that returned success without persistence;
- whole-page `innerHTML` restoration.

They are replaced by supported Astro APIs, source adapters, typed toolbar
messages and targeted DOM/source state.

## Remaining product roadmap, not legacy omissions

These features were not working capabilities of the original editor and remain
future enhancements:

- visual Editability Setup/content inventory;
- automatic import/data-flow tracing for every Astro architecture;
- persistent on-disk or Git-backed edit history across server restarts;
- authenticated production/client editing;
- branch, pull-request and deploy-preview workflow;
- role permissions, audit logs and multi-user collaboration;
- file-level diff viewer and visual regression gate.
