# Security policy

## Supported versions

Security fixes are applied to the latest published version.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Email
`security@opace.co.uk` with a minimal reproduction and impact description.

## Security model

Astro Visual Editor only runs through Astro's development toolbar. File writes
are handled in the development server process and are restricted to configured
source roots and approved file extensions. The integration rejects absolute
paths, traversal attempts, symbolic-link escapes, ambiguous text matches and
stale file hashes. Browser messages are runtime-validated, size-bounded,
addressed to a tab/request pair and idempotent. Astro output is compiler-
validated, structured files use property paths, and network-exposed dev servers
cannot write unless `allowRemoteDev` is explicitly enabled.

Commit receipts and their pre-edit snapshots live in the dev-server process.
They survive page HMR but not a complete server restart. Always retain Git as
the durable recovery boundary and review diffs after using the editor.

The editor is not an authentication system and must never be exposed as a
production editing endpoint.
