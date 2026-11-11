# Remaining acceptance checks for PR #165

Use only `@halaqabot_bosla_staging_bot`, `HalaqaBot Staging — Channel`, and
`HalaqaBot Staging — Discussion`. Start on desktop; repeat the phone-specific
checks on Android/iOS. The current staging URL and credentials/access procedure
are in [staging.md](staging.md). Name detection is fake until a team Groq key is
configured; this does not validate real LLM accuracy or bulk-score matching.

The user has already passed registration, personal-account signup + admin 👌,
deletion cancel/confirm, reapproval without duplication, panel opening and
background/resume on desktop and Android. Do not repeat all of that unless the
tested code or deployment changes. List replacement, registration close/reopen,
and the second-account permissions test have also passed. Keep these recorded
results; do not ask the tester to repeat them as unverified work.

## 1. Send and replace the participant list — passed

1. Open the staging bot privately, send `/admin`, open **🎛️ فتح لوحة التحكم**,
   then **الحلقات** and the test halaqa containing `فاطمة احمد`.
2. Use the **top ⋮ menu beside the session selector**, not the student's row
   menu. Choose **إرسال قائمة الأسماء**.
3. Open that post's Telegram comments. Expect one bot reply listing the active
   participant and her activity. Check that it belongs under the correct post.
4. Send the list again from the same menu. Expect one current list: the previous
   copy is replaced rather than leaving duplicate lists.

Report if the panel reports success but no Telegram reply appears, or if the
list is attached to the wrong thread. An agent should inspect the queue/API logs
and stored last-list message before asking the tester to repeat actions.

## 2. Close and reopen registration — passed

1. In the same **top ⋮ menu**, choose **إغلاق تسجيل الأدوار**. Do not choose
   **إنهاء الحلقة**, which locks the session and is a different feature.
2. Expect the registration state to change and a closed-registration image to
   appear with the participant list in Telegram.
3. Choose **فتح تسجيل الأدوار** from the same menu.
4. Expect registration to reopen and the closed-registration image to disappear.

The lifecycle/image/API result is the check here; do not infer other rejection
rules for new signups without checking the implementation/spec.

## 3. Import a genuinely old post (desktop; agent preparation required)

Do not use a post the bot already registered: that takes a shortcut and does not
exercise the Telegram lookup.

Have the agent coordinate a short **staging-only** quiet window. A maintainer
can temporarily remove the staging bot from the test channel/group, publish one
synthetic registration post while it cannot see the chats, restore its existing
admin permissions, and confirm the new post is absent from **الحلقات**. Record
its actual Telegram post link and verify the bot is restored in both chats.
Do not change or drop the webhook to simulate a missed post: Telegram may retain
and deliver the update later, so that is not the same case. If temporary removal
would disrupt another tester, defer this check or use separate personal Telegram
resources; never interrupt actual production.

1. **Start a stopwatch before clicking إضافة.**
2. In the Mini App, open **الحلقات → إضافة حلقة قديمة**.
3. Paste the prepared link into **رابط المنشور**, then click **إضافة** once.
4. Expect **تمت إضافة الحلقة إلى القائمة.** and the correct halaqa in the list.
   Opening it must refer to the correct Telegram thread.
5. Record elapsed time or the exact error. At 60/90/180 seconds, record whether it
   is still searching. Do not submit repeatedly; closing the modal does not
   cancel an in-progress import. The agent should inspect the import row and logs.

Telegram's real limits differ from the simulator's. The earlier simulated
rate-limit import completed manually in 14.25 seconds and in later full tests;
one original timeout was not reproduced and remains documented.

## 4. Team permissions — passed

On 2026-11-08, Mohanad reported all steps below behaved as expected on the
live staging bot: ordinary-member denial, access after channel-admin promotion,
denial after demotion, and approval restricted to an administrator's reaction.
This is a manual tester report, not an automated cross-channel privacy test.

1. Invite a teammate as an ordinary member of both private chats, with no admin
   role. They press Start in the bot's private chat and use **لوحة التحكم**.
   Expect **غير مصرح**; `/admin` must not grant admin access either.
2. Promote that person to **channel admin**. Have them close/reopen the panel.
   Expect access to this channel's halaqas.
3. Demote them back to ordinary member. Have them close/reopen the panel.
   Expect access denial. Do not demote the sole owner to simulate another user.
4. As an ordinary member they may post a synthetic self-introduction, but their
   own 👌 should not approve a turn. A channel admin's 👌 should approve it.

A single-owner happy-path test does not cover these permission transitions.
The separate cross-channel finding is fixed and regression-tested in
[PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169); the fix is deployed to shared staging.
The manual permissions checks alone did not establish that fix.

## 5. Remaining provider/platform checks

- With an authorized real Groq key, test intended self-introductions, ordinary
  comments/questions that mention another person's name, activity spelling
  variations, and any bulk-score matching the team uses. Fake-classifier passes
  cannot be recorded as real-provider passes.
- On a real iPhone, open through Telegram, navigate/scroll the halaqa, send a
  list, cancel a deletion dialog, and background/resume. Android success and a
  Chromium iPhone viewport are not evidence of iOS/WebKit compatibility.
- If per-PR previews are part of the release scope, verify real Workers Builds,
  a properly isolated Convex preview, and the repeat smoke-check behavior. Do not
  run preview builders against the shared staging database.

## Integration and domain order

The Convex consolidation is complete: shared staging is the non-default
`staging` deployment inside `Bosla / halaqabotdb`. The prior separate staging
project was deleted after [data and live app verification](staging-convex-migration.md).
The Cloudflare account/domain handoff below reuses this existing deployment.

1. **Completed on 2026-11-11:** #168 and #169 were merged into #165's
   migration branch; #165 remains open against `main`. The user explicitly
   chose not to use CI as a gate. Local/cloud validation remains documented.
2. **Completed:** Bosla hosting and `https://halaqabot-staging.bosla.to` are
   live, with the existing bot/chats and Convex named staging deployment.
   The old scheduler is disabled; only Bosla runs admin reconciliation.
3. **Passed on 2026-11-11 by Mohanad:** the final Android/Wi-Fi check below.
   Retain these steps for future hosting changes; do not repeat them for this cutover.
   Close the staging panel,
   send a fresh `/admin` to `@halaqabot_bosla_staging_bot`, open
   **🎛️ فتح لوحة التحكم**, and confirm the existing halaqa loads. Send its
   participant list once and confirm it appears under the correct Telegram
   post. This verifies a real Telegram update through the destination queue.
   Old inline buttons retain their old URL; use the fresh response or updated
   bot menu. Automated desktop/mobile-viewport checks already passed.
4. Real Groq classification and physical iPhone testing remain unverified;
   classification currently uses the authenticated fake service.
5. `main` then added PR #170 (manual-list halaqas). Its conflicts with #165
   were resolved and tested on personal dev; see [integration evidence](pr-165-review.md#main-branch-integration-on-2026-11-11).
   Shared staging still runs the previously accepted source. Promote and smoke-test
   the final candidate before a production cutover; no broad repeat of human tests
   is required merely for the completed hostname move.
6. Review the resulting #165 release state before the production cutover to
   `https://halaqabot.bosla.to/`. Staging-domain completion is not a production
   deployment. The production Convex deployment and existing dev deployments
   were unchanged.

## Merge decision

Record the tested commit and deployed Worker version with results. Check that
staging is running the code under review before using manual passes as evidence.
The P1 fix from [PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169) is now
merged into #165. Backend commit `0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a` is deployed
to personal dev and shared staging. Its cloud-backed suite passed 93 tests,
skipped 2 emulator-only checks, and failed 0. A read-only staging smoke verified
owner access to an existing halaqa and supervisor details, plus denial of a
mismatched-channel probe. No further manual reproduction of the leak is required.
The preview findings are fixed in #168: cloud previews reject shared dev keys,
and every smoke check exercises a fresh signup. Verify actual hosted previews
if enabling that optional feature; leave it disabled if isolated backends are
unavailable. Assess CI and manual checks together. The original PR #165
test suite did not cover the P1 leak; PR #169 adds that coverage. Missing
iOS/provider tests must be stated explicitly rather than reported as passed.

No production domain change or production bot/database cutover is needed for
these staging checks.
