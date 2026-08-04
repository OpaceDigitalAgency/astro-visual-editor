# Project status

This document is the release source of truth for Astro Visual Editor.

The implementation roadmap and takeover instructions are maintained in
[ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md](./ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md).

## Bounded objective

Extract the website-specific localhost editor into an independent Astro
integration that can be reused across projects, installed with `astro add`, and
discovered by Astro's integrations directory after an approved npm release.

## Acceptance criteria

- The editor is a standalone package with no dependency on the original site.
- It uses Astro's supported Integration and Dev Toolbar APIs.
- It is present only during `astro dev` and adds no production editor endpoint.
- Users can preview, queue, undo, clear and commit simple text changes.
- Server writes fail closed for unsafe, stale, ambiguous or out-of-root edits.
- Package metadata meets Astro integration discovery requirements.
- A real demo, automated tests, clean build, package inspection and browser
  workflow provide release evidence.
- Documentation covers installation, mapping, safety, limitations and release.

## Current status

Version `0.1.0` is locally implemented and validated as a prototype but
unreleased. A subsequent engineering review identified P0 hardening work that
must be completed before a public beta.

| Gate | Status | Evidence |
| --- | --- | --- |
| Standalone workspace | Complete | Package and independent demo workspaces |
| Astro API conformance | Complete | Integration factory, `astro:config:setup`, `astro:server:setup`, Dev Toolbar app |
| Unit and safety tests | Complete | Vitest suite covers configuration, integration hooks and file-write boundaries |
| Type and demo checks | Complete | TypeScript and `astro check` |
| Production isolation | Complete | Demo production build contains no editor or toolbar runtime |
| Desktop browser workflow | Complete | Selection, preview, queue and source commit verified against the demo fixture |
| Narrow-layout check | Complete with boundary | Ledger has no horizontal overflow; touch selection is unsupported under Astro's mobile toolbar overlay |
| Mobile solution proof | Complete | Compact Pick mode allowed a real page tap and opened the editor at 390 × 844 |
| Public-beta hardening | Pending | Transaction protocol, immutable ranges, source adapters, HMR and multi-tab recovery |
| Editability setup/admin UX | **Urgent enhancement pending** | Site owners currently need to change selectors or source annotations in code; the planned owner-controlled setup mode is defined in the engineering handoff |
| npm package inspection | Complete | `npm pack --dry-run` |
| Dependency audit | Complete | `npm audit` reports zero known vulnerabilities |
| GitHub publication | Pending approval | Public repository has not been created |
| npm publication | Pending approval | Package has not been published |
| Astro directory appearance | Pending npm release | Astro refreshes qualifying npm packages automatically |

## Release gates

Do not publish the current commit as a stable `0.1.0`. Complete the P0 work and
definition of beta readiness in the engineering handoff first. The recommended
first public version is `0.1.0-beta.1`.

Publishing the GitHub repository or npm package is a public external action and
requires explicit owner approval. After approval:

1. create `OpaceDigitalAgency/astro-visual-editor` as a public repository;
2. push the verified `main` branch;
3. configure npm trusted publishing or an npm release token;
4. publish `astro-visual-editor@0.1.0` with provenance;
5. verify `npx astro add astro-visual-editor` in a clean fixture;
6. confirm the package appears in Astro's integrations directory after its
   scheduled refresh;
7. optionally request a custom avatar or listing override from Astro.

## Known boundaries

- Simple textual source values only; structural Astro/HTML edits remain code
  changes.
- Editable versus non-editable content is currently determined by developer
  configuration and source annotations. There is no owner-facing setup/admin
  interface yet; this is an urgent enhancement request.
- Explicit source annotations are recommended for components and dynamic routes.
- Duplicate source text is rejected rather than guessed.
- Post-validation filesystem failures use best-effort rollback.
- Desktop browsers are the supported editing surface.
