# Bosla staging hosting cutover — completed 2026-11-11

Staging is live at **https://halaqabot-staging.bosla.to**. The existing
`@halaqabot_bosla_staging_bot`, channel, discussion and Convex data were reused.
PRs #168 and #169 were merged into #165's migration branch before deployment;
#165 remains open against `main`. Production was not deployed or repointed.

| Resource | Active value |
| --- | --- |
| Cloudflare account | `Bosla`, `fe626a504678476d9e8c2d942794d30f` |
| Zone | `bosla.to`, `29f0ad378223b137bb9d0cd01cc2db99` |
| Workers subdomain | `nasseratic.workers.dev` |
| Mini App/API | `https://halaqabot-staging.bosla.to` |
| Webhook | `https://halaqabot-staging.bosla.to/telegram` |
| Menu URL | `https://halaqabot-staging.bosla.to/` |
| Bot Worker/config | `halaqabot-staging`, `packages/bot/wrangler.staging.bosla.toml` |
| Initial bot version after secret configuration | `0cb32721-ca7b-48e6-95ea-f39af0123605` |
| Classifier Worker/config | `halaqabot-staging-classifier`, `packages/testing/wrangler.staging-classifier.bosla.toml` |
| Classifier version | `b1f49cf3-e853-42b1-8f02-9f63e542fcf9` |
| Classifier URL | `https://halaqabot-staging-classifier.nasseratic.workers.dev/openai/v1` |
| Queues | `halaqabot-staging-updates`, `halaqabot-staging-imports`, `halaqabot-staging-dead-letters` |
| Current bot Worker version | `f31fa01a-cead-4391-a085-7e8ef2d11205` |
| Current deployed source | `3f287da6e465d9db55eb1a1c5f9b401ddba2f6d2` |
| Scheduler | `17 * * * *`, Bosla Worker only |
| Convex | `bosla / halaqabotdb / staging`, `perfect-clam-401`, non-default |
| Active private configuration | Root `.env.staging.bosla.local`, ignored, mode 600 |

## Preparation and switch

Authenticated Bosla access was verified before creating staging-only resources.
Existing Bosla Workers/custom domains were inspected. Direct DNS-record listing
was unavailable to Wrangler's OAuth scope, so the Workers Custom Domain changeset
was checked explicitly: one addition, zero updates/removals/conflicts. The domain
was attached with existing-origin and existing-DNS overwrite flags disabled.
The production hostname `halaqabot.bosla.to` and other existing domains were not
modified.

The candidate was deployed with its scheduler disabled and only nine allowlisted
bot secrets. Its authenticated fake classifier reused the existing staging
bearer credential. No Convex deploy, key rotation or data copy was needed.

During switching, the personal scheduler was disabled and Telegram delivery
paused with `drop_pending_updates=false`. All three old staging queues reported
zero unacknowledged messages before the destination webhook was registered.
The bot menu and webhook were read back before declaring success, then only the
Bosla scheduler was enabled. Menu verification initially read back stale state;
the cutover rolled back automatically, was retried, and the final menu was
verified with its normal `لوحة التحكم` label and new URL.

## Verification performed

- HTTPS `/` and `/halaqas` return 200 on the custom domain.
- Unsigned `/api/auth/token` and `/telegram` requests return 401.
- The served frontend uses `perfect-clam-401`; private staging credentials are
  absent from its JavaScript bundle.
- Live Worker login, existing halaqa/supervisor reads and the deployed Mini App
  passed in desktop Chromium and a Pixel 7 Chromium viewport before and after
  the webhook switch.
- An authorized temporary note update appeared through the live Convex
  subscription and was restored. Unauthenticated/non-admin access and a
  mismatched-channel probe were denied; the unauthorized UI was shown correctly.
- No browser application errors occurred. The final local regression suite
  passed **99 tests, skipped 4 cloud-browser-only checks, failed 0**; the new
  domain's live browser checks were run separately as described above.
- Webhook/menu point to the Bosla domain, pending updates are zero, no webhook
  error is reported, the nine bot secret names are present, all destination
  queues report zero backlog, and only the Bosla cron is enabled.

Mohanad confirmed the final physical Android/Wi-Fi check passed on 2026-11-11:
a fresh `/admin` response opened the existing halaqa on the Bosla staging domain
and list sending worked. This verifies a real user event through the new
Telegram webhook/queue. No fake webhook event or synthetic simulator world was
injected into shared staging. Real Groq and physical iPhone checks remain open.

## Rollback and maintenance

The old personal account (`633bbfa7b98a8f8d38054789a1af0e7a`) retains its staging
Worker, queues, assets and secrets at
`https://halaqabot-staging.mhndahmd031.workers.dev`, with cron disabled.
`packages/bot/wrangler.staging.toml` pins that account and has no schedule.
Do not deploy it or turn on its scheduler during ordinary staging work.

Mohanad's `.env.staging.local` is retained privately for rollback; the active
service uses `.env.staging.bosla.local`. Account/domain changes do not alter the
Convex JWT issuer `https://halaqabot.bot`. Preserve existing signing keys and
the stage-scoped deploy key; do not upload the deploy key to Worker secrets.

An actual rollback must coordinate Telegram delivery, destination queue drain,
menu/webhook restoration and a single active scheduler. Keep current Convex
staging data; do not restore an older database snapshot. See the
[full operating runbook](agent-environment-handoff.md).

Private deployment logs and cutover metadata are in the ignored, restricted
`.staging/cloudflare-bosla-migration/` directory. No credentials or private
diagnostics are included in Git or the portable handoff archive.


## Final candidate after main integration

On 2026-11-11, `main`'s PR #170 manual-list feature was integrated into #165,
with its new endpoints protected by the existing channel-isolation rules.
Source `3f287da6e465d9db55eb1a1c5f9b401ddba2f6d2` was deployed to the same named
staging backend and Bosla staging Worker, version
`f31fa01a-cead-4391-a085-7e8ef2d11205`. Existing keys, bot/menu/webhook, domain,
queues and scheduling were retained. This supersedes the initial Worker version
above; it does not change the recorded human phone test's scope.

The candidate passed 104 local tests (4 cloud-browser skips), 24 parser tests,
4 personal-cloud browser checks and 17 personal-cloud Worker API tests.
Its live shared-staging desktop/mobile-viewport checks, reactive write/restore,
manual-list access guards and denial checks passed. Production is unchanged.
See [integration evidence](pr-165-review.md#main-branch-integration-on-2026-11-11).
