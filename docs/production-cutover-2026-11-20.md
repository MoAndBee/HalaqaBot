# Completed production cutover — 2026-11-20

Production is live at **https://halaqabot.bosla.to/**. Do not repeat the initial
Docker-to-Worker migration. The same production Telegram bot and Convex database
were retained. PR [#165](https://github.com/MoAndBee/HalaqaBot/pull/165) is merged.

## Current service

| Resource | Active target |
| --- | --- |
| Telegram bot | `@thehalakabot` |
| Mini App / API | `https://halaqabot.bosla.to` |
| Webhook | `https://halaqabot.bosla.to/telegram` |
| Cloudflare owner | Bosla, account `fe626a504678476d9e8c2d942794d30f` |
| Worker | `halaqabot` |
| Production Worker version | `30523cfd-692f-4fff-85c4-9795c12a147a` (includes the `/admin` correction below) |
| Released source | main `b8182bfaecb5071c3431fc0ddcf0b353cfbd53b2`; initial migration merge `34487f5`, then hotfix [#177](https://github.com/MoAndBee/HalaqaBot/pull/177) (`9ee6eff`) |
| Convex | Existing `Bosla / halaqabotdb` default production `incredible-lyrebird-981` |
| Convex URL | `https://incredible-lyrebird-981.convex.cloud` |
| Queues | `halaqabot-updates`, `halaqabot-imports`, `halaqabot-dead-letters` |
| Production reconciliation cron | `17 * * * *`, production Worker only |
| Production deployment config | `packages/bot/wrangler.production.bosla.toml` |
| Old Mini App hostname | `halakabot.app.thawabcoding.work`, HTTP 302 redirect to the new origin, preserving the request path |
| Old Coolify bot | Stopped; do not restart/redeploy it alongside the Worker |
| Old Coolify Web app | Running a redirect image; automatic and PR deployments disabled |

Production and staging use different secrets, signing pairs and queues. The
production deploy key was not uploaded to the Worker or frontend. The fake Groq
endpoint and simulator settings are absent from the production Worker.

## Execution and interruption

Mohanad explicitly authorized the cutover after confirming a quiet period.
The last sampled message-related write before stopping was at 03:13 Cairo time;
background reconciliation continued normally. Both Coolify applications had
Auto Deploy and PR preview/public PR deployments disabled, verified on the server.
Only the exact production applications were stopped; older preview containers,
Quranload and the VPS itself were left running.

Downtime began at approximately **05:40 Cairo time**. The new webhook was enabled
by **05:46**, approximately **6.2 minutes** later. No pending updates were
intentionally dropped. A fresh database/file-storage snapshot was verified after
the old applications stopped and before backend deployment. Production data was
not copied, reset or replaced with simulator fixtures.

The release installed production JWT auth/functions, deployed same-origin assets
with the new Worker and a cron-disabled bootstrap, passed HTTPS/auth/data checks,
then switched and independently verified Telegram's webhook/menu. The final
Worker deploy enabled the single production cron. The old web image was retained,
and a separate redirect image now serves its hostname.

Telegram initially returned the stale menu URL despite accepting the setter.
Changing its label temporarily forced a visible URL refresh; the standard label
was then requested again. The verified menu target is the new origin. Do not
retry the webhook with pending-update dropping to address a stale menu label.

## Verification

- The final merged runtime passed its live staging desktop/mobile-viewport,
  existing-data, auth/isolation and write/restore smoke checks before cutover.
- Production bot JWT reads succeeded against existing channels/halaqas; anonymous
  Convex access was denied. Public `/` and `/halaqas` return 200, and unsigned
  API-token/webhook requests return 401. The frontend embeds the production
  Convex URL and not the staging URL.
- Production admin-token login, channel selection and an existing halaqa passed
  automated desktop and Pixel 7 viewport checks. Mutation requests were guarded
  during that test: **0 mutation attempts, 0 browser errors**.
- The real Groq classifier passed a synthetic name/activity test using the real
  production credential. No real student message was submitted for that test.
- Webhook/menu readback targets the new domain, with zero pending updates and no
  delivery error at the final automated check. All three production queues were
  empty, including dead letters. Secret-name inventory excludes deploy keys and
  fake-provider overrides.
- Mohanad sent `/admin` as a non-admin and confirmed the expected denial reply.
  This verifies a real Telegram event through the new delivery/queue/backend/
  reply chain while preserving permissions. Server access did not grant him a
  Telegram role.
- Mohanad used an existing production admin's phone: the persistent blue menu
  opened the Mini App and displayed the expected production halaqas. On a
  non-admin phone, both entry paths correctly denied access.
- That admin's `/admin` command incorrectly denied access; the correction below
  is now deployed. **Still pending:** a fresh `/admin` on the same admin's phone,
  then opening the returned panel button. Physical iPhone/Safari acceptance is
  unverified; the tester did not specify the phone/network for this latest check.

## Post-cutover `/admin` correction

The command still checked only `CHANNEL_ID`, the original fallback channel,
while the Mini App correctly used the person's active registered channels.
PR [#177](https://github.com/MoAndBee/HalaqaBot/pull/177), now merged, makes the
command use that same `getMyChannels` lookup. It changes neither roles nor
channel-scoped backend permissions and requires no Convex deployment or data
change.

Validation: 34 local Telegram-flow/channel-isolation tests and 13 Telegram-flow
tests against the personal cloud backend passed. The new other-channel admin
regression fails against the original handler. Production builds/dry run passed;
a read-only diagnostic with existing production admin records verified the
corrected handler and outsider denial, intercepting every Telegram reply locally
(zero real messages or database writes). Staging deployment and live HTTPS,
admin/outsider auth and webhook checks passed before production deployment.
Only the new `/admin` phone result needs repeating; previously passed checks
remain recorded.

## Known historical state

Four of five registered channels refreshed admins successfully. One historical
channel returned Telegram `chat not found`; its last cached admin update was on
2026-10-28. Its cached records were left unchanged. Keep this separate from new
Worker failures, and let the operator decide whether to deactivate that registry
entry after reviewing its history.

The pre-cutover snapshot had no pending legacy bot tasks. Twenty tasks marked
`processing` were all over 42 days old. They were recorded as existing stale
state, not replayed, deleted, or treated as current in-flight work.

An earlier Coolify PR preview build of `f0db5c9` targeted teammate dev
`wry-crab-519`, reported five added indexes, then failed before function deployment
because JWKS was absent. Production metadata remained legacy at that point.
Do not rerun that Docker preview build or add keys to the teammate deployment.

## Backups and recovery

Private backup/operation artifacts are under ignored `.production/` in Mohanad's
checkout (directory mode 700; secret/backup files mode 600). They include the
verified final data export with file storage, pre-change Convex environment,
application config/runtime environment and container inspection, old source,
provider/health results and the cutover checkpoint. Do not commit or attach these
raw files to issues; they contain credentials and student data.

The VPS retains private recovery files under
`/root/halaqabot-migration-20261120/` and these local Docker images:

- Original bot/web images for source `4619bb1`.
- `halaqabot-rollback:4619bb1-preserve-updates`: a copy of the actual bot image,
  changing only polling startup to preserve pending updates. It passed a compile
  check with networking disabled; it was never started as a second bot.
- `halaqabot-web-redirect:4619bb1`: validated nginx redirect image.

The private `container-control.py` can recreate the old containers with the
captured environment, network and labels. Do not start the rollback bot until
new incoming delivery is paused, new queues are drained or explicitly preserved,
new consumers/cron are stopped, and compatible old functions/auth/environment
have been restored. The original unpatched bot startup drops pending updates.
Do not use Coolify Redeploy as a rollback: its historical Dockerfiles deploy
Convex during the build and main now contains the migration.

Follow [the recovery procedure](production-cutover.md#5-rollback), preserving
queued work. Do not restore the data snapshot over newer writes. Keep the old
images, private backups and access through the agreed rollback window.

## Remaining operator actions

1. On the same production admin's phone, send a fresh `/admin`; expect
   **🎛️ فتح لوحة التحكم**, then open it and an existing halaqa. The persistent
   menu already passed. Non-admin denial already passed through both paths.
2. Verify the separately configured BotFather Main Mini App URL and known per-chat
   menu overrides. The bot reports a Main Mini App exists; its URL cannot be read
   from `getMe`. Update to `https://halaqabot.bosla.to/` if necessary. Old-domain
   links currently remain functional through the redirect.
3. Revoke the temporary migration API token(s) from Coolify once access is no
   longer needed. Never revoke Coolify's own server SSH key.
4. Retain recovery resources until the operator closes the rollback window;
   review the historical missing channel and stale tasks separately.

Shared staging remains `halaqabot-staging.bosla.to` / `perfect-clam-401`. It was
promoted to the merged candidate for final validation and then the same `/admin`
correction; its Worker version is `a56c40ee-82af-45a2-8bf2-2018e1255716`. Its separate bot, data and scheduler were
retained. Personal and teammate deployments were not part of the production
cutover.
