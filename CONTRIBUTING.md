# Contributing

Contributions are welcome. Please keep changes focused and include evidence for
the behaviour being changed.

Before starting, search [existing issues](https://github.com/OpaceDigitalAgency/astro-visual-editor/issues)
and read the capability boundaries in [README.md](./README.md). For a substantial
feature, open the feature-request form first so source ownership, safe failure
and recovery behaviour can be agreed before implementation.

## Development

```bash
npm install
npm run dev
```

The workspace contains the integration in `packages/astro-visual-editor` and a
real Astro site in `demo`. The demo normally opens on Astro's default local
development port; use an explicit loopback port if another project is running:

```bash
npm run dev --workspace astro-visual-editor-demo -- --host 127.0.0.1 --port 4322
```

## Pull requests

- Keep one behavioural change per pull request.
- Add a minimal fixture for a new source-mapping or adapter case.
- Preserve the development-only boundary: production builds must not contain
  editor messages, runtime code or write routes.
- Preserve fail-closed behaviour for ambiguous, stale, out-of-root, oversized
  or structurally invalid edits.
- Include before/after evidence for toolbar, keyboard, touch or responsive UI
  changes.
- Update the package README, root documentation and changelog when a public API
  or user-visible behaviour changes.

Do not include credentials, customer data or proprietary website source in a
fixture, issue or pull request.

## Required checks

```bash
npm run test:all
```

Pull requests should include or update tests, documentation and the changelog
when behaviour changes. Source-writing changes must retain fail-closed path,
hash, ambiguity, adapter, request-boundary and conflict checks. Changes to text,
SEO, sections, recovery, toolbar focus or responsive behaviour require
corresponding Playwright coverage.

## Reporting bugs and security issues

Use the [bug-report form](https://github.com/OpaceDigitalAgency/astro-visual-editor/issues/new/choose)
for reproducible product problems. Suspected vulnerabilities must follow the
private process in [SECURITY.md](./SECURITY.md), not a public issue.
