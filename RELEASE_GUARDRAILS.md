# Release Guardrails

This is the only release route for `@opacedev/astro-visual-editor`. It is
written for future maintainers and agents: do not improvise an npm command,
push a release tag, or bypass a failed check.

## What is automatic

After an approved maintainer starts **Publish package** from `main`, GitHub
automatically:

1. checks the version is the correct kind of release (`beta` or stable);
2. runs the full repository test suite on the exact `main` commit;
3. confirms the changelog and release-status documents name that version;
4. packs the real npm tarball and installs it in a fresh Astro 7.1.6 project;
5. creates the matching `v<version>` tag only after those checks pass;
6. publishes through npm's GitHub OIDC trusted publisher with provenance; and
7. reads npm back, checks the intended dist-tag and builds a fresh project from
   the published registry package.

The workflow fails closed: a failed check means no npm publish.

## The one human decision

A release is intentionally not started by a code push. An approved maintainer
must start **Publish package** in GitHub Actions from `main` and choose the
channel:

- `beta` for a version containing a hyphen, such as `0.1.0-beta.3`;
- `latest` for a stable version, such as `0.1.0`.

This is the release approval. No separate local commands or tag push are
needed. The workflow creates the tag itself after its preflight succeeds.

## Required GitHub settings

These settings cannot be stored in Git, so a repository administrator must set
them once and keep them in place. They were not configured when checked on 5
August 2026:

1. Protect `main`: require pull requests and the **CI / validate** check before
   merge; restrict direct pushes.
2. Create a GitHub Actions environment named `npm-publish`, require an
   approver, and allow only the `main` branch.
3. Add a tag ruleset for `v*` that prevents people from creating or changing
   release tags outside GitHub Actions.
4. Keep npm trusted publishing bound only to this repository and
   `.github/workflows/release.yml`; do not add an npm access token.

Without these external GitHub settings, a repository administrator can still
override the process. No repository file can prevent an administrator from
doing that.

## Astro directory follow-up

Astro's integrations directory is not a publishing target controlled by this
repository. Its importer is external and scheduled. After every npm release,
wait for Astro's next import, then verify the public card, links, categories
and avatar. Record the result in `PROJECT.md`. Do not claim a listing until it
is visibly live.

## Before changing a version

Update these together in the release commit:

- `packages/astro-visual-editor/package.json`;
- `CHANGELOG.md` with a `## <version>` heading;
- `PROJECT.md` with `Version \`<version>\``;
- `RELEASE_PLAN.md` with the exact current package version; and
- user-facing README text when the release changes public behaviour.

Then merge through the protected `main` branch. The workflow enforces the first
four items and all automated validation; the release plan remains the source of
truth for scope and owner-acceptance gates.
