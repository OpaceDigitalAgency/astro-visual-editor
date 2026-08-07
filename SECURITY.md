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

Editability policy is stored in a project-root JSON manifest. Direct canvas
Lock/Unlock is available only in local owner mode on a loopback development
server and is still validated against the expected policy hash before writing.
Editor mode and every network-exposed development server can read/apply the
policy but cannot broaden it. Policy allow rules do not override explicit
ignore annotations, unsafe nested structure, unresolved source ownership or
the final syntax-aware adapter checks.

Transient idempotency request receipts live in the dev-server process and do
not survive a complete restart. Checksummed, bounded save-history records and
their pre-edit snapshots are stored under the ignored project-local
`.astro-visual-editor/` directory and do survive restart. Their guarded restore
refuses stale output hashes. Always retain Git as the durable external recovery
boundary and review diffs after using the editor.

The editor is not an authentication system and must never be exposed as a
production editing endpoint.
