# Repository instructions

Read `PROJECT.md`, `RELEASE_PLAN.md`, `RELEASE_GUARDRAILS.md` and
`ASTRO_VISUAL_EDITOR_ENGINEERING_HANDOFF.md` before changing or releasing this
project. Preserve unrelated work and never expose credentials.

## Release approval fast path

The release candidate must be committed, pushed and green in pull-request CI
**before** asking the owner to test localhost. Do not begin the release pull
request after approval.

Before opening localhost for owner acceptance:

1. update the package, demo dependency, lockfile, changelog, READMEs and release
   status documents together;
2. deliberately update the canonical demo-fixture hashes only when fixture
   content was intentionally changed;
3. run the focused tests, then the full baseline once;
4. run `npm run release:candidate:check -- <beta|latest>`;
5. push the candidate pull request and wait for every required check to pass;
6. only then start localhost from that exact candidate commit and ask the owner
   to test.

After the owner explicitly approves publication:

1. start the release timer immediately from the approval message;
2. stop the owned localhost server;
3. run `npm run release:finalize -- <beta|latest>` on the already-green
   candidate branch; it backs up and restores demo changes, refuses a running
   server, refuses unrelated changes and confirms local HEAD equals the pushed
   candidate;
4. merge the existing pull request without changing the candidate;
5. wait for the exact `main` CI checks, then start **Publish package** once;
6. stop the release timer only when the workflow has verified npm and the clean
   registry consumer;
7. report npm, tag, main CI and release-run evidence separately from Astro's
   external scheduled directory import.

Do not rerun the full local baseline after owner approval, open a second
evidence-only pull request as part of the timed publication, manually push a
release tag or publish with a local npm command. The workflow summary is the
automatic immutable release record; update source documents later only when a
material status statement is wrong.
