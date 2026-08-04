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
unsafe source characters by default.

The editor is not an authentication system and must never be exposed as a
production editing endpoint.

