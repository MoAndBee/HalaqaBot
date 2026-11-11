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

**[P1] Cross-channel name disclosure — fixed in [PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169), merged into #165 on 2026-11-11.**

Backend commit `0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a` is deployed to
`doting-viper-550` and `perfect-clam-401`. The security PR contains 14 direct
regressions and 3 new HTTP/cloud auth regressions. Its complete cloud suite
passed 93 tests, skipped 2 emulator-only cases, and failed 0. It scopes admin
names to the channel, verifies channel/discussion pairs, constrains the student
fallback, and prevents queue/position/bulk-score additions from manufacturing
membership. Existing same-chat access remains covered. The report below records
the original reproduction; the current complete handoff archive includes the merged backend fix.

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

**[P2] Shared dev previews reuse the same Convex IDs — fixed in #168.**

Cloud preview builds now reject dev/production deploy keys before running any
deployment. They require separate Convex preview deployments, whose names include
a stable hash of the original branch so normalized branch names do not collide.
The explicit local preview command may still use the developer's own dedicated
dev deployment; it validates the key before changing backend authentication.
The following paragraph records the original shared-dev fallback finding.
`packages/testing/src/sim-worker.ts`, lines 73–77, defaults `SIM_ID_OFFSET` to
zero. The build does not supply a unique offset. When using the README's
shared-dev-deployment fallback, separate preview worlds reuse user, channel and
message identifiers, interfering with each other's backend records. Separate
Durable Objects isolate simulator storage, but not those Convex rows. Require
separate deployments or assign a unique, persisted namespace per preview/world.

**[P2] Repeat preview smoke checks can skip the signup flow — fixed in #168.**

Every smoke check now creates and verifies a fresh registration/sign-up/approval
scenario. A regression runs the check twice on an already used world and verifies
that both new signups complete and the existing participant list stays intact.
The following paragraph records the original conditional-check finding.
`packages/testing/scripts/preview.ts`, lines 97–107, tests signup only if the
discussion group is empty. Once someone has used the preview, a subsequent
check can pass with broken update handling. This misses the README promise
that the smoke check verifies “a sign-up reaches the list.” Create and verify
a fresh scenario on every run without resetting reviewers' data.

Standards: 1 finding (cross-channel disclosure). Spec: 2 findings (preview
isolation and incomplete repeat checks). The security fix from #169 is included in #165.

## Setup blockers found and fixed locally

- Fresh-checkout CI regression verified on 2026-11-08: moved the complete
  `convex/_generated` directory aside, ran `bun run test`, and verified automatic
  generation before test imports. Result: **82 passed, 4 browser skips, 0 failed**.
  Private environment files were unchanged; original generated bindings were
  restored afterward. Database, bot and web builds all passed. The preview-check
  workflow also uses the package preparation step now. Real GitHub Actions runs
  currently require a repository maintainer to approve workflows from the fork;
  the contributing account has read-only upstream access.

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

- On 2026-11-11, #168 and #169 merged into #165 and shared staging moved to
  `https://halaqabot-staging.bosla.to` in Bosla Cloudflare. The live Mini App,
  Worker auth, reversible reactive write and denial checks passed before and
  after the webhook cutover. Old queues drained, old cron disabled and only
  Bosla cron enabled. See [cutover details](bosla-staging-cutover.md). The user
  explicitly chose not to use CI as a release gate; no green CI claim is made.

- Shared staging consolidation on 2026-11-08: transferred `perfect-clam-401`
  into `Bosla / halaqabotdb` as the non-default `staging` deployment. All 13
  application table exports matched before/after; existing production/personal/
  teammate deployments retained their IDs, references, defaults and last-deploy
  timestamps. Live Worker authentication, existing halaqa reads, desktop/mobile-
  viewport UI, reversible note writes/subscriptions and access denials passed
  before and after deleting the retired staging project. See the
  [completed operation and handoff details](staging-convex-migration.md).
  The backend URL stayed the same, so no Worker/frontend redeploy was required.

- Combined validation on 2026-11-08: PR #168 runtime changes at `4478147`
  plus #169 security commit `0e4e8c9` were combined on local branch
  `codex/pr-165-combined-validation` (head `1bb58c4`). The complete personal-cloud
  suite passed **101 tests, skipped 2 emulator-only cases, failed 0** in 203.41s.
  All four browser checks passed. The combined backend sources are identical to
  the already deployed #169 backend; this run did not redeploy shared staging.
  A subsequent test-proxy typing correction converts its URL to a string and
  does not change runtime behavior; the targeted preview regressions were rerun.
  GitHub Actions remains a separate gate: the latest #168/#169 fork workflows
  require maintainer approval, and this account has read-only upstream access.
- The optional strict testing-project typecheck reports existing backend/test
  typing diagnostics outside the changed preview files. The normal database,
  bot and web package builds pass; no new preview-file diagnostics remain.

- Manual staging follow-up on 2026-11-08: Mohanad reported the complete
  second-account permissions test passed: ordinary-member denial, channel-admin
  promotion granting access, demotion revoking access after reopening the panel,
  and ordinary-member reactions not approving turns while an admin reaction did.
  This does not resolve or retest the separate cross-channel name disclosure.

- Reachability follow-up on 2026-11-08: the desktop Wi-Fi failure occurred before
  TLS while connecting to its resolved Cloudflare addresses. HTTPS requests to
  alternative addresses returned HTTP 200, and the user confirmed the Mini App
  opens on Android mobile data. The webhook had no pending updates or last error.
  This is network-specific evidence; no Worker redeploy or app fix was required.
- The laptop's mixed DNS setup was changed to Google DNS only for its active
  Wi-Fi profile, after preserving previous settings. A normal request on that
  Wi-Fi then returned HTTP 200 without an IP override. No router or other-device
  settings were changed; Telegram may need a full restart to clear its own cache.
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


## Main-branch integration on 2026-11-11

After the Bosla staging phone acceptance passed, `main` advanced to
`b3b68ad2b934140126160116052db5b956f08cab` (PR #170, manual-list halaqas).
Its integration with #165 was first tested separately on Mohanad's personal dev
`doting-viper-550`, then promoted to shared staging as source `3f287da6e465d9db55eb1a1c5f9b401ddba2f6d2`.

The conflict resolution preserves direct Worker API calls and the Convex
lockdown, carries external-session filtering into list sending, and adds admin,
channel/chat, student-membership and applying-user checks to the newly added
manual-list endpoints. Regression tests reject unrelated students before any
queue/history/session writes, reject forged supervisors and mismatched channels,
permit local manual students, keep new Telegram registrations in their Telegram
session, and prevent the Worker from publishing an external session's list.

Validation: database/bot/web builds passed; personal cloud Convex push passed;
local testing package **104 passed, 4 cloud-browser-only skips, 0 failures**;
manual-list parser suite **24 passed, 0 failures** (run with the channel-isolation
tests: 42 passed total); personal cloud browser checks **4 passed, 0 failures**.
The 17 Worker API tests also passed against personal cloud dev, including the
new external manual-session behavior. Shared staging's backend and Worker were
then updated to the same source; Worker version
`f31fa01a-cead-4391-a085-7e8ef2d11205`. Live desktop/mobile-viewport login, existing
halaqas, reactive note write/restore, outsider/cross-channel denial and manual-list
access guards passed, with no browser errors. Empty manual imports and a forged
applying supervisor were rejected without creating records. Public routes return
200 and unsigned API/webhook requests return 401 using Bun fetch.

Physical Android/Wi-Fi acceptance predates this source integration; no additional
phone acceptance is claimed. Real Groq and physical iPhone tests remain unverified.
Production has not been changed.
