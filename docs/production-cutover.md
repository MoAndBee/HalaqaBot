# Production cutover: PR #165 and halaqabot.bosla.to

Prepared 2026-11-11. **Preparation only; production has not been deployed.**
Give the maintainer's agent [this prompt](production-maintainer-prompt.md).
The maintainer owns the live server, credentials, merge and release window.
Complete preparation first, obtain one confirmation of the concrete production
plan, then execute the switch in a single coordinated maintenance window.

## Fixed targets and accepted source

| Resource | Target |
| --- | --- |
| Repository / release PR | `MoAndBee/HalaqaBot`, [#165](https://github.com/MoAndBee/HalaqaBot/pull/165) |
| Migration branch | `claude/telegram-cloudflare-workers-migration-c09q4a` |
| Previously tested runtime source | `3f287da6e465d9db55eb1a1c5f9b401ddba2f6d2`; later commits may change preparation/docs only; inspect the current diff |
| Cloudflare account | Bosla, `fe626a504678476d9e8c2d942794d30f` |
| DNS zone | `bosla.to`, `29f0ad378223b137bb9d0cd01cc2db99` |
| Production Worker / hostname | `halaqabot`, `https://halaqabot.bosla.to` |
| Convex | `Bosla / halaqabotdb`, existing default production `incredible-lyrebird-981` |
| Convex URL | `https://incredible-lyrebird-981.convex.cloud` |
| Production queues | `halaqabot-updates`, `halaqabot-imports`, `halaqabot-dead-letters` |
| Production bot, channel(s), linked group(s), forwarding group | Discover from the actual live service; preserve them |
| Old Mini App clue | `https://halakabot.app.thawabcoding.work`, last DNS result `213.199.41.153` |

The web host clue does not establish the bot process's location. Confirm the
actual production deployment with the operator. If it differs from the pinned
target, reconcile the config, verifier, template and build before proceeding;
do not force the known target onto a different live service.

Leave shared staging untouched: `halaqabot-staging.bosla.to`,
`@halaqabot_bosla_staging_bot`, channel `-1004434414328`, group `-1004415858273`,
Convex `perfect-clam-401`, and all `halaqabot-staging-*` resources. Leave personal
dev `doting-viper-550` and teammates' dev deployments untouched as well.
PRs #168 and #169 are already merged into #165; do not recreate or cherry-pick them.

## Preparation verification on 2026-11-11

The DB/bot/web builds, final production config dry run and generated no-cron
bootstrap dry run passed locally. Five guard tests passed (23 assertions), and
running the secrets helper with the actual staging env failed before any
production secret file was created. The portable bundle passed secret scanning
and clean-index patch round-trip verification. No production credentials were
used, no production resource was created or changed, and no staging deployment
was changed. Real provider identity/classification and the live cutover remain
for the maintainer's environment.

## 1. Discover and prepare without changing the live service

1. Fetch #165 into a clean release checkout. Read `CLAUDE.md`, this runbook,
   [domain inventory](bosla-domain.md), and [validation evidence](pr-165-review.md).
   Record the candidate SHA. If runtime code differs from the tested source,
   inspect/test that difference before claiming the existing acceptance applies.
2. Find the actual live bot process: hosting dashboard, server/container/systemd
   service, deployed SHA/image, start command, restart policy, replica count,
   polling versus webhook transport, schedulers and task processors. Confirm
   which deployment is serving the existing frontend and which Convex it uses.
   Inspect external Git hooks/build integrations; GitHub has no deployment record
   establishing whether a merge auto-deploys. Do not merge while an unknown
   integration could replace the running service.
3. Inventory the production bot with Telegram `getMe`; record its username/ID.
   Confirm bot permissions in every served channel and linked discussion group,
   and the real forwarding-group ID. Record old webhook URL/allowed updates,
   webhook secret if one exists, default menu and any known per-chat overrides,
   BotFather Main Mini App setting, old web URL and optional reaction settings.
   Store secrets and raw backups privately, not in PR comments or terminal output.
4. Follow `CLAUDE.md` for read credentials and explicit production writes.
   Snapshot production data including file storage, current environment values
   (including whether JWKS was absent), old code/image/config, routes and process
   settings. Use a production read credential for read-only inventory/export.
   `convex export --path ... --include-file-storage --deployment-name incredible-lyrebird-981`
   is available in the installed CLI; pass the read key inline as instructed in
   `CLAUDE.md`. Keep backups under ignored `.production/`, folder mode 700 and
   files 600. Verify the archive is readable and belongs to the right deployment.
   A backup is a recovery asset; do not import it over production on rollback.
5. Prepare an executable rollback release from the **actually deployed** old
   code/image. The old polling bot starts with `drop_pending_updates: true`.
   Patch its rollback build to `false` and inspect any `deleteWebhook` calls for
   the same flag. Preserve pending updates on restart. Verify old schema/code
   can accept fields written by the new release; prepare optional-field schema
   compatibility if necessary. Keep its start/stop commands ready.
6. Put `.env.production.local` at the checkout root using
   [the template](../.env.production.example), mode 600. Use the existing live
   bot token, real Groq key, real chat IDs, a production-scoped deploy key and a
   **separate production** signing pair. Generate the pair with
   `bun packages/bot/scripts/generate-auth-key.ts`, redirecting output into a
   private file; never print it in a shared transcript. If production already
   trusts signing keys, retain those public keys additively through the rollback
   window. Keep issuer `https://halaqabot.bot` unchanged. Set
   `PRODUCTION_CONVEX_AUTH_JWKS` to the matching public data URI.

Run these **local-only** commands from the repository root:

```bash
bun scripts/prepare-production.ts
bun --env-file=.env.production.local scripts/prepare-production-secrets.ts
```

The first builds DB/bot/web, fixes the web build to production Convex and
same-origin API, compiles a Wrangler dry run, and generates
`.production/wrangler.bootstrap.json` with **no cron**. It does not deploy.
The second validates targets/key agreement, rejects known staging settings and
writes only allowlisted Worker secrets, public JWKS and the Groq key into three
private local files. It does not upload them. It does not prove the supplied
credentials belong to the live services; perform the provider checks below.
Do not use root `bun run build`: that command also deploys Convex.

The bootstrap JSON contains absolute paths; regenerate it on the machine doing
the deployment. Inspect `.production/preparation.json` and resolve any unexpected
dirty runtime files. Do not use a build made against staging or personal dev.
If packages are missing, use the pinned lockfile and available local caches.

Before the window, independently verify:

- Telegram `getMe` using the supplied token returns exactly
  `PRODUCTION_BOT_USERNAME`, with working access to the inventoried real chats.
- The real Groq key works with the bot's actual `ClassificationService`, using
  only a synthetic sample such as `انا فاطمة احمد تسميع`. Assert `containsName`,
  detected name and `تسميع`. The service returns `containsName=false` on provider
  failure, so that fallback is **not a pass**. Keep diagnostic output private;
  this test needs no Telegram send or production data write. Staging's fake
  classifier does not establish real provider behavior.
- The Bosla account, queues and custom-domain changeset are correct. New queues
  may be created during the approved release. If any production name already
  exists, inspect ownership, consumers, backlog and configuration; reuse only
  after confirmation. Do not delete or repurpose another service's resource.
  Check custom-domain DNS/origin conflicts before deploying: Wrangler can
  overwrite conflicts automatically. Do not use automatic overwrites to resolve
  an unrelated record. Resolve a legitimate old record only in the approved plan.

## 2. One release confirmation

Show the maintainer: candidate SHA, exact old process and stop/restart commands,
any automatic deployment to pause, confirmed bot/chat IDs, account/domain and
Convex target, backup/rollback location, expected brief interruption, channel URL
overrides (if any), and the acceptance/rollback criteria below. Ask for one
confirmation to merge #165 and perform those production writes as one window.
This is the production confirmation required by `CLAUDE.md`; preparation above
does not require repeated approvals. Treat missing access or mismatched identity
as a real blocker and identify precisely what is missing.

## 3. Execute the approved window

1. Pause the identified automatic deployments/restart controllers. Merge #165
   into `main` once the operator confirms this will not launch an old/new bot
   automatically. Preserve PR history and record the merge SHA. If the resulting
   runtime tree differs from the validated candidate, test it and regenerate the
   production build before proceeding. Restore no legacy deploy hook pointing at
   the new Workers-only source. CI was explicitly excluded as a release gate by
   Mohanad; use the recorded tests and actual deployment checks.
2. Put the old frontend into maintenance if it can still enqueue tasks. For an
   existing webhook, first pause new deliveries using `deleteWebhook` with
   `drop_pending_updates=false`, then let its existing consumers drain while its
   compatible backend is still running. For polling, stop the poller gracefully
   and let in-flight handlers finish; do not call `getUpdates` manually or advance
   its offset. Account for pending/processing legacy `botTasks` and other old
   queued work before stopping **all** old bot replicas, schedulers and task
   processors. Verify they stay stopped. Telegram holds undelivered updates;
   this is not a guarantee about already acknowledged jobs.
3. Create only the missing production queues in the pinned Bosla account, from
   `packages/bot` (inspect existing names before each create):

   ```bash
   ./node_modules/.bin/wrangler queues create halaqabot-updates --config wrangler.production.bosla.toml
   ./node_modules/.bin/wrangler queues create halaqabot-imports --config wrangler.production.bosla.toml
   ./node_modules/.bin/wrangler queues create halaqabot-dead-letters --config wrangler.production.bosla.toml
   ```

4. Re-run the local secrets validator with the private production file. Set the
   public JWKS and real Groq key on **production Convex**, then deploy the new
   authenticated functions. From `packages/db`, the scoped env file selects the
   physical deployment explicitly; it must contain its non-empty production key:

   ```bash
   CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex env set CONVEX_AUTH_JWKS --env-file ../../.env.production.local < ../../.production/convex-auth-jwks.txt
   CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex env set GROQ_API_KEY --env-file ../../.env.production.local < ../../.production/groq-key.txt
   CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex deploy --env-file ../../.env.production.local --yes --typecheck disable
   ```

   Verify the CLI reports `https://incredible-lyrebird-981.convex.cloud`.
   Package builds already typechecked the code. Do not rely on personal-dev
   `.env.local`, an empty/default target, or a generic `--prod` selector.

5. Deploy the generated bootstrap config **with its validated secrets in the same
   deploy**, from `packages/bot`:

   ```bash
   ./node_modules/.bin/wrangler deploy --config ../../.production/wrangler.bootstrap.json --secrets-file ../../.production/worker-secrets.json
   ```

   This attaches the production domain and SPA assets with cron disabled.
   Confirm correct account, URL, consumers and secret **names**. Do not upload
   the whole env file, deploy keys, private backup files or staging fake-provider
   variables. If reusing an existing Worker, inventory stale `GROQ_BASE_URL`,
   `TELEGRAM_API_ROOT` and preview/test overrides: omitted secrets persist across
   deploys, so remove incompatible old overrides explicitly in the approved plan.

6. Before webhook delivery resumes, verify HTTPS `/` and `/halaqas` return 200,
   unsigned `POST /api/auth/token` and `/telegram` return 401, the served web
   build embeds the correct production backend, and a bot-signed read through
   `packages/bot/scripts/convex-client.ts` can read `getActiveChannels` and an
   existing halaqa. Confirm anonymous Convex access is denied. Run one admin sync
   using the existing `syncChannels` implementation and the production config,
   or verify the existing cache against Telegram; do not wait an hour for cron.
   Never send fabricated webhook updates into the production channel.
7. Register the real webhook/menu from the repository root:

   ```bash
   bun --env-file=.env.production.local packages/bot/scripts/set-webhook.ts
   ```

   Independently read back `getWebhookInfo` and `getChatMenuButton`. The setter
   catches menu errors, and Telegram previously returned stale menu reads, so
   exit status alone is insufficient. Expect the exact new webhook
   `https://halaqabot.bosla.to/telegram` and menu URL `https://halaqabot.bosla.to`.
   Do not drop pending updates on retries. Recheck boundedly rather than
   registering repeatedly; allow the menu readback to settle.
8. Complete the acceptance below. When healthy, enable the single production
   scheduler by deploying the committed final config from `packages/bot`:

   ```bash
   ./node_modules/.bin/wrangler deploy --config wrangler.production.bosla.toml --secrets-file ../../.production/worker-secrets.json
   ```

   Verify cron `17 * * * *`, all production consumers and the final Worker
   version. Preserve the old service/backup during the rollback window but keep
   its poller, webhook, schedulers and automatic restarts disabled. Staging keeps
   its own separate scheduler and must remain healthy.
9. Inventory BotFather Main Mini App and known per-chat menu overrides. Update
   any separately configured old URL; if BotFather requires a human, give the
   maintainer the exact bot and `https://halaqabot.bosla.to` URL, and report it as
   outstanding. Existing inline buttons retain their old URL: use fresh `/admin`.
   Preserve the old hostname until the new links work, then arrange the agreed
   redirect with the old web operator. Per-channel `webAppUrl` is optional;
   preserve custom destinations and only change approved old-domain overrides
   with before-values captured for rollback.

## 4. Acceptance and monitoring

Use one agreed production test post/account; do not run the simulator, seed
fixtures, replace attendance lists or edit unrelated real student records.

- On a **real Android phone over Wi-Fi**, send a fresh `/admin` to the existing
  production bot, press **🎛️ فتح لوحة التحكم**, confirm the new domain and an
  existing halaqa. In the agreed test post, send a personal self-introduction,
  apply the normal admin approval, and confirm the turn reaches that halaqa.
  Send its list once and confirm the correct Telegram reply. Remove only the
  agreed test records through normal UI operations. This phone check is required
  for the new production deployment; it does not repeat the completed staging
  acceptance. Check iPhone/Safari if available and state if unavailable.
- Verify admin access and non-admin denial; preserve channel boundaries.
  Check all served channels, not just the configured fallback channel.
- Check webhook pending count trends toward zero with no fresh delivery error,
  production queue backlog drains, no new dead letters, no failed-handler/auth/
  provider errors, and exactly one production scheduler. A zero queue backlog
  alone is insufficient: ordinary handler failures are acknowledged, so inspect
  Worker errors and the actual Telegram/database outcome as well.
- Confirm real Groq, not the fake staging classifier, and leave staging/dev
  healthy. Record final source SHA, Worker version, backend, domain, webhook/menu,
  acceptance results and unresolved items. Report secret names only.

## 5. Rollback

If the new system cannot pass acceptance, use the prepared rollback within the
same window. Before the new webhook is enabled, revert the changed functions and
auth/environment settings to their captured state, restore the old frontend and
start the verified rollback build with pending updates preserved.

After webhook activation: pause deliveries using `deleteWebhook` with
`drop_pending_updates=false`; disable the new cron. Keep the new backend and
consumers up long enough to drain already-acknowledged queued work safely. If
queues cannot drain, pause delivery and preserve them; report their backlog and
coordinate recovery/fix-forward rather than destroying jobs or downgrading the
backend underneath them. Never purge queues or delete a Worker with pending work.

Once drained and consumers/scheduler are stopped, restore compatible old
functions, prior JWKS/Groq environment and frontend/config; restore the old
transport and menu and restart only the rollback bot. For polling, its start
must not drop pending updates. For a webhook, restore its captured secret and
allowed updates. Verify actual event processing. Restore approved URL-record
changes if any. Do not restore a data snapshot over post-cutover writes; plan
specific repairs if required. Keep the production database/deployment, queues,
old release and private backups until the operator ends the rollback window.
