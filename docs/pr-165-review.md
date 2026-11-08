# PR #165 review and local verification

Reviewed base `43ecf7f32dd023413c791f78f8604a5c5b25bdac` through head
`5b00b67d2378d8f7f29073ab4fc58d1d833742f8` from
[PR #165](https://github.com/MoAndBee/HalaqaBot/pull/165).
Environment setup fixes and handoff documents are on the stacked branch
`codex/pr-165-staging-handoff`, targeting #165's branch. The original local work
was on `review/pr-165-bosla`.
The separate personal-dev and team-staging deployments described below are live;
the existing application production environment has not been deployed or changed.

## Standards

**[P1] Cross-channel name disclosure remains after the authorization lockdown.**
`packages/db/convex/queries.ts`, `getAdminDisplayName` (line 1422), checks only
the supplied channel. `findAdminRecord` (lines 1365–1375) then searches every
channel for the requested user ID. An administrator of channel A can request a
user who only administers channel B and receive their private preferred name.

Confirmed locally with `convex-test`: seed two admin records in different
channels; authenticate as channel A's admin; call `getAdminDisplayName` with A's
channel ID and B's user ID. It returned B's synthetic private name.

The supervisor queries also accept independently supplied `channelId` and
`chatId`; their resolver can fall back to the global users table. Assigning an
arbitrary supervisor ID in one's own chat can expose an unrelated student's
real name. Restrict resolution to authorized membership, including fallbacks.

This violates the migration record's “Each admin is confined to their own
channel” requirement. The generic test that checks each function begins with
an access check does not establish that all data it reads is authorized.

No additional code-smell findings warranted flagging.

## Spec

**[P2] Shared dev previews reuse the same Convex IDs.**
`packages/testing/src/sim-worker.ts`, lines 73–77, defaults `SIM_ID_OFFSET` to
zero. The build does not supply a unique offset. When using the README's
shared-dev-deployment fallback, separate preview worlds reuse user, channel and
message identifiers, interfering with each other's backend records. Separate
Durable Objects isolate simulator storage, but not those Convex rows. Require
separate deployments or assign a unique, persisted namespace per preview/world.

**[P2] Repeat preview smoke checks can skip the signup flow.**
`packages/testing/scripts/preview.ts`, lines 97–107, tests signup only if the
discussion group is empty. Once someone has used the preview, a subsequent
check can pass with broken update handling. This misses the README promise
that the smoke check verifies “a sign-up reaches the list.” Create and verify
a fresh scenario on every run without resetting reviewers' data.

Standards: 1 finding (cross-channel disclosure). Spec: 2 findings (preview
isolation and incomplete repeat checks). The security finding blocks release.

## Setup blockers found and fixed locally

- Simulator deletion appeared inert because its host ignored the Telegram SDK's
  `web_app_open_popup` event. The Mini App correctly waited for confirmation and
  never called its mutation. Added a simulator dialog that returns `popup_closed`
  to the configured iframe. A real browser/cloud-dev regression verifies Cancel
  preserves the turn and OK deletes it, including its disappearance from the UI.
  No Mini App or Convex deletion logic changed. Targeted regression: 1 passed.
- Clean checkout: the suite failed with missing `convex/_generated/api` before
  reaching its existing generation helper. Added a preparation step before
  test/simulator imports, with a blank deploy key and anonymous local selection
  for code generation only.
- Existing database build: `rootDir: ./src` excluded the included Convex files,
  causing TS6059 and emitted JavaScript beside backend source files. Set
  `rootDir` to the package root so outputs stay under `dist`.
- Removed the untracked compiler artifacts produced while reproducing that
  build problem. No tracked backend source files were removed.

## Verification and limits

- Reachability follow-up on 2026-11-08: the desktop Wi-Fi failure occurred before
  TLS while connecting to its resolved Cloudflare addresses. HTTPS requests to
  alternative addresses returned HTTP 200, and the user confirmed the Mini App
  opens on Android mobile data. The webhook had no pending updates or last error.
  This is network-specific evidence; no Worker redeploy or app fix was required.
- Stacked environment/handoff PR verification on 2026-11-08: account-free suite
  **78 passed, 4 skipped, 0 failed** (82 tests). The four browser checks require
  a real personal-dev deployment and are skipped in this run. All three separate
  package builds passed. Bundle round-trip/secret checks, shell syntax checks
  and local documentation links passed. No live environment was redeployed.
- Latest complete cloud-backed run: **77 passed, 2 skipped, 0 failed** across
  79 tests in 151.56 seconds. The new delete/cancel regression is included.
  The rate-limited import passed in ~16 seconds; the original phone test also
  passed with the matching browser. The two skips require the in-memory
  emulator's outage switch and call counter. This supersedes the earlier
  failing run as current test status, but does not erase the independently
  reproduced cross-channel privacy finding or establish the original timeout's
  cause. No Mini App or bot logic was changed to make these checks pass.
- Investigation update: the phone test passes **unchanged** using Playwright's
  matching Chromium headless shell v1243. The older cached v1234 had failed.
  Downloaded the matching 114.3 MiB browser and removed the private
  `CHROMIUM_PATH` override. All four cloud browser tests now pass, including
  list sending, student denial, delete/cancel, and phone overlay/identity changes.
  Temporary mouse/touch instrumentation was removed; no bubble product code changed.
- The previously failing cloud import passed in isolation (~15.7 seconds for the
  test; ~14 seconds for the backend request), then passed with the other
  robustness checks (~16.5 seconds). That group reports 4 passed, 2 emulator-only
  skips. The original import timeout's cause is not established. Added failure
  diagnostics (call counts, rate limits, pending updates, recent API outcomes,
  failed-job count), preserving its existing deadline and assertions.
- Manual follow-up: the user passed all bubble checks, including the narrow
  layout and switching identities. Physical-phone/Safari testing is still pending.
- The isolated manual cloud import completed successfully. Its persisted
  `postImports` timestamps show **14.25 seconds** from request to resolution;
  simulator diagnostics recorded **four rate-limit responses** and no failed
  jobs. A stopwatch was unnecessary because these timestamps measure the backend
  operation. The earlier automated timeout was not reproduced in this manual
  run; the reason for the discrepancy remains unresolved. Do not classify either
  earlier automated failure as fixed solely from these manual passes.
- Follow-up setup: created Mohanad's personal cloud dev deployment
  `doting-viper-550` in `Bosla / halaqabotdb`, set its authentication public key,
  and deployed this branch's backend. Production was untouched. The simulator
  and Vite frontend now run against that dev deployment using ignored private
  configuration. See `docs/local-testing.md` for the ready-to-use commands.
- Real cloud browser checks: admin list sending and student access denial pass.
  The phone overlay check fails at the bubble-drag assertion (x remains 322
  rather than moving below 30). Waiting for an unobscured bubble and animation
  completion did not fix it; those experimental test changes were removed.
  This run reused cached Chromium 1234 through `CHROMIUM_PATH`, while the pinned
  Playwright expects 1243. Confirm on its matching browser and on a real phone
  before attributing this to the product. Safari/iOS remain untested.
- The wider cloud-backed suite also timed out waiting 90 seconds for a
  rate-limited post import to finish (`robustness.test.ts`, first test). Its
  in-memory counterpart passed earlier. Record this as a cloud acceptance
  failure pending investigation; it does not establish whether the import
  eventually completes after the assertion deadline.
- Complete cloud-backed suite result: **74 passed, 2 skipped, 2 failed** in
  243.56 seconds. The two failures are the import timeout and phone bubble drag
  described above. The skips are emulator-only outage and subrequest counting.
  Cloud authentication and channel-access tests passed, but the independently
  reproduced cross-channel name disclosure is not covered by those assertions.
- Frozen dependency install succeeded on Bun 1.3.14.
- After explicit local code generation, the unmodified test suite passed:
  75 passed, 3 skipped, 0 failed. The skipped tests require real Convex plus a
  browser, including the phone-sized overlay check.
- Moved generated bindings aside and reran through the new preparation step:
  75 passed, 3 skipped, 0 failed, confirming startup from missing bindings works.
- Started `bun run sim`: dashboard returned HTTP 200 at port 8790; an unsigned
  `/api/auth/token` request to the Worker returned HTTP 401.
- Database and bot build checks and the Vite production build passed after
  the database configuration fix. Vite reports a large JavaScript chunk warning.
- Production, real Telegram, real Cloudflare queues/previews and Safari/iOS
  have not been validated in this checkout.
- Queue handlers deliberately acknowledge ordinary handler failures rather
  than replay them. During a Convex outage, those updates can be permanently
  skipped. The dead-letter queue covers consumer failures, not every failed
  handler. This behavior is explicitly tested; decide whether it is acceptable
  before cutover.

Review sources: README, CLAUDE.md, migration decision record and the pinned diff.
`docs/agents/issue-tracker.md` is absent; the PR's own decision record served as
the spec. The code-review skill suggests `/setup-matt-pocock-skills` for adding
that issue-tracker integration if wanted; it was unnecessary for this review.
