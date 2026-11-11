# Agent handoff: personal development and Bosla team staging

Originally prepared 2026-11-06; updated 2026-11-11 after the completed Bosla
cutover for PR [#165](https://github.com/MoAndBee/HalaqaBot/pull/165).
Staging is live in Bosla Cloudflare. This runbook describes the active service
and ongoing personal-dev setup; [cutover evidence](bosla-staging-cutover.md)
records the completed hosting move and human Android/Wi-Fi acceptance.

## Decision: reuse team staging; isolate personal work

Reuse the existing shared staging bot, channel, discussion group and named
Convex `staging` deployment in `halaqabotdb`. Hosting already runs in
**Bosla's Cloudflare account**. Preserve the active webhook and scheduler; do not
recreate resources, copy production data or clear staging rows.

Every developer gets their own checkout, Convex **personal dev deployment**, and
local simulator. Routine development and automated tests must not redeploy the
shared staging backend, reset its data, or repoint its Telegram webhook. An
engineer needing independent real-Telegram testing creates a separate personal
bot/channel/group and resources with their own prefix; they do not borrow the
team bot token for a local webhook or long-polling process.

This avoids duplicating the team's established Telegram setup and keeps personal
schema experiments and test fixtures out of shared staging. The existing
personal Cloudflare hosting stays available during preparation and rollback.

## 1. Inventory: current, verified resources

| Resource | Current value / meaning |
| --- | --- |
| Repository | `https://github.com/MoAndBee/HalaqaBot.git` |
| PR head reviewed | `5b00b67d2378d8f7f29073ab4fc58d1d833742f8` |
| PR base | `43ecf7f32dd023413c791f78f8604a5c5b25bdac` |
| Original local work branch | `review/pr-165-bosla` |
| Stacked environment/handoff branch | `codex/pr-165-staging-handoff`, targeting PR #165's branch |
| Published source fork | `https://github.com/mohanad-80/HalaqaBot.git` (upstream access is read-only for this account) |
| Original checkout | `/mnt/linux_data/code/HalaqaBot` on Mohanad's laptop |
| Shared Telegram bot | `@halaqabot_bosla_staging_bot` |
| Bot link | https://t.me/halaqabot_bosla_staging_bot |
| Private channel | `HalaqaBot Staging — Channel` |
| Channel ID | `-1004434414328` |
| Linked discussion group | `HalaqaBot Staging — Discussion` |
| Discussion ID | `-1004415858273` |
| Current forwarding/probe chat | Discussion group, `-1004415858273` |
| Current Mini App + API | `https://halaqabot-staging.bosla.to` |
| Current webhook | `https://halaqabot-staging.bosla.to/telegram` |
| Current Cloudflare owner | **Bosla** |
| Current Cloudflare account ID | `fe626a504678476d9e8c2d942794d30f` |
| Current Workers subdomain | `nasseratic.workers.dev` |
| Bot Worker | `halaqabot-staging` |
| Fake-classifier Worker | `halaqabot-staging-classifier` |
| Classifier base URL | `https://halaqabot-staging-classifier.nasseratic.workers.dev/openai/v1` |
| Update queue | `halaqabot-staging-updates` |
| Import queue | `halaqabot-staging-imports` |
| Dead-letter queue | `halaqabot-staging-dead-letters` |
| Scheduled admin reconciliation | `17 * * * *`, Bosla Worker only; old scheduler disabled |
| Shared Convex team/project | `bosla / halaqabotdb` |
| Shared Convex named reference | `staging` (`bosla:halaqabotdb:staging`), non-default |
| Shared Convex deployment | `perfect-clam-401` |
| Shared Convex URL | `https://perfect-clam-401.convex.cloud` |
| Shared database dashboard | https://dashboard.convex.dev/d/perfect-clam-401 |
| Mohanad's personal dev | `doting-viper-550`, in `bosla / halaqabotdb` |
| Existing live app's Convex project | Same project, `bosla / halaqabotdb`; leave its default production deployment unchanged |
| Known production deployment in that project | `incredible-lyrebird-981`; confirm inventory before any future production work |
| Teammate dev mentioned in CLAUDE.md | `wry-crab-519`, reference `dev/mohmed-nasser`; do not use or alter it |

Shared staging is now a dedicated, long-lived **named deployment inside the
original project**: `bosla / halaqabotdb / staging`. Its physical deployment is
still `perfect-clam-401`, type `prod`, with `isDefault = false`. The original
project's default production deployment remains `incredible-lyrebird-981` and
Mohanad's dev remains `doting-viper-550`.

On 2026-11-08 the existing staging deployment was transferred into this project,
retaining its URL, data, IDs, environment and signing keys. The former
`halaqabot-staging` Convex project and its empty leftover dev deployment were
deleted after live verification. **Do not recreate that project or transfer the
staging deployment again for the Cloudflare/domain handoff.** See the
[completed migration and tests](staging-convex-migration.md).

The private staging file now contains a **deployment-scoped staging deploy key**.
The `prod:` prefix identifies its deployment type; it does not mean the default
production deployment. A selector alone is insufficient for `convex deploy`:
without a scoped key, that command can target the project's default production.
Run `scripts/verify-staging-target.ts` with the private staging file before a
backend deployment; never use an empty staging deploy key or `--prod`.

### Current URLs and rollback

- Active shared staging hostname: **`https://halaqabot-staging.bosla.to`**.
  Attached and verified on 2026-11-11; the webhook/menu cutover is complete.
  Do not recreate its DNS record or move it to another Worker.
- Personal rollback host: `https://halaqabot-staging.mhndahmd031.workers.dev`,
  account `633bbfa7b98a8f8d38054789a1af0e7a`; its scheduler is disabled.
  See [cutover evidence and rollback](bosla-staging-cutover.md).
- Confirmed intended final production Mini App hostname:
  **`https://halaqabot.bosla.to`**. Do not use it for staging or alter it as part
  of this handoff.
- Serve the staging Mini App and `/api/*` from the same Worker/domain. This is
  already configured in `wrangler.staging.bosla.toml`; no separate frontend host is needed.
- The classifier is `https://halaqabot-staging-classifier.nasseratic.workers.dev/openai/v1`.
  Keep this Bosla URL in `GROQ_BASE_URL` until switching to an authorized real provider.

## 2. Obtain access; identifiers do not grant it

| Access | What the human maintainer must arrange |
| --- | --- |
| Repository | Give the teammate repository read access, plus write access if they will publish reviewed changes. |
| Telegram chats | Invite their personal Telegram account to both private chats. IDs above are not invite links. |
| Mini App administration | Promote them to **channel** admin. Discussion-group admin alone does not grant app access. |
| Telegram bot credential | Share the existing staging token through the team's password manager/private secret input. BotFather ownership is not required merely to deploy it. |
| Bosla Cloudflare | Invite their Cloudflare login to the account containing `bosla.to`, with Worker deployment/secrets, Queues, logs and domain/DNS permissions appropriate to their task. |
| Bosla Convex | Invite their login to the Bosla team/project `halaqabotdb`. Shared staging is its `staging` deployment. Provide the staging-scoped deploy key privately for authorized staging writes; do not share a production key or another developer's key. |
| Old hosting retirement | Mohanad must retain access to the personal Cloudflare account for disabling its cron and rollback/cleanup. Bosla membership does not confer that access. |

The teammate must press **Start** in the staging bot's private chat before using
the panel. For identifiable comments/reactions, open the discussion group's
**Manage Group → Administrators → their account**, disable **Remain Anonymous**,
and send as their personal identity. Anonymous comments appear to the bot as
`GroupAnonymousBot`; anonymous approvals have no user ID and are ignored.

Do not regenerate the shared BotFather token just to give a teammate access:
that would invalidate the currently running service. Use authorized secure
sharing. If an agent needs a secret, use its private secret-input tool; never
ask for tokens in ordinary chat, PR comments, terminal output or source files.

## 3. Obtain the actual source snapshot

PRs #168 and #169 were merged into PR #165's migration branch. Use that branch
as the authoritative source; it includes the setup, security and Bosla configs:

```bash
git fetch origin claude/telegram-cloudflare-workers-migration-c09q4a
git switch -c setup/bosla-staging origin/claude/telegram-cloudflare-workers-migration-c09q4a
bun install --frozen-lockfile
bun run test
```

The portable `docs/handoff/halaqabot-agent-handoff.tar.gz` contains all of these
changes, including the security fix, as a patch against the pinned original
#165 head `5b00b67d2378d8f7f29073ab4fc58d1d833742f8`. Verify its checksum and
extract outside the checkout. Apply only to that base, never over the current
migration branch. See `docs/handoff/README.md` for exact steps. The old
`codex/pr-165-staging-handoff` fork branch is historical and predates the live
Bosla cutover; do not use it to redeploy the current service.

Reuse local dependency caches where possible. No secrets, private env files,
dependencies or generated assets belong in the portable bundle. Avoid root
`bun run build` as a verification command because it includes a backend deploy;
run the three package build commands separately.

## 4. Set up each developer's independent environment

The no-account option is `bun run sim`: real bot Worker, fake Telegram/Groq and
in-memory Convex at `http://127.0.0.1:8790`. Its web panel needs a real dev
deployment because the emulator does not implement Convex's WebSocket protocol.

For a personal cloud dev environment, from `packages/db`:

```bash
CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex login status
CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex dev --configure existing --team bosla --project halaqabotdb --dev-deployment cloud --once
```

Use **their own** logged-in account, not Mohanad's exported credentials. This
creates/selects that person's dev deployment; never select the project's live
production slot. Before running this in an existing checkout, save its ignored
`packages/db/.env.local` privately so another developer's selection is not lost.
On first use, code push can fail until `CONVEX_AUTH_JWKS` is set; provision first,
then set that dev deployment's key and push again.
If login status is not authenticated, run `CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex login`
in that directory and have the human complete their own login before provisioning.

Generate a **personal dev** signing pair with
`packages/bot/scripts/generate-auth-key.ts`. It prints a private JWK: capture it
privately, not into agent-visible logs. Set its public data-URI JWKS as
`CONVEX_AUTH_JWKS` on that **dev** deployment, and supply the matching private
JWK to the simulator. A personal pair must not replace shared staging's JWKS.
The generator also supports additive two-key rotation; see section 6.

Create ignored root `.env.sim.local` with permissions 600:

```dotenv
TEST_CONVEX_URL=https://<their-personal-dev>.convex.cloud
TEST_CONVEX_AUTH_PRIVATE_KEY='<their-private-JWK-JSON>'
DEV_CONVEX_AUTH_JWKS=<their-public-JWKS-data-URI>
VITE_CONVEX_URL=https://<their-personal-dev>.convex.cloud
VITE_BOT_API_URL=http://127.0.0.1:8787
WEB_APP_URL=http://localhost:3000
```

Set the public key and push with the deployment explicitly selected. For example,
use a private selector file containing their `CONVEX_DEPLOYMENT=dev:<name>` plus
`CONVEX_DEPLOY_KEY=` and `--env-file`, or their scoped dev deploy key. Always
set `CONVEX_DEPLOY_KEY` inline on Convex CLI commands; don't inherit an unknown
exported production key. The empty value here intentionally uses their CLI login.

For an agent-safe key-generation alternative that never prints the private JWK,
run this from the root of the **new developer's checkout**, after provisioning
has written their own `packages/db/.env.local`. It refuses an existing simulator
file or a non-dev selection:

```bash
bun --env-file=packages/db/.env.local -e '
import { generateKeyPair } from "./packages/bot/src/convex-auth";
import { existsSync, writeFileSync } from "node:fs";
if (!process.env.CONVEX_DEPLOYMENT?.startsWith("dev:")) throw new Error("Personal dev selection required");
if (existsSync(".env.sim.local")) throw new Error("Existing personal config must not be overwritten");
const pair = await generateKeyPair();
const q = String.fromCharCode(39);
const url = process.env.CONVEX_URL;
if (!url) throw new Error("Dev URL missing");
writeFileSync(".env.sim.local", [
  "TEST_CONVEX_URL=" + url,
  "TEST_CONVEX_AUTH_PRIVATE_KEY=" + q + pair.privateJwk + q,
  "DEV_CONVEX_AUTH_JWKS=" + pair.jwksDataUri,
  "VITE_CONVEX_URL=" + url,
  "VITE_BOT_API_URL=http://127.0.0.1:8787",
  "WEB_APP_URL=http://localhost:3000", ""
].join("\n"), { mode: 0o600 });
console.log("Personal simulator configuration saved privately");
'
```

With the CLI still selected to that person's dev deployment, set only the
public key and push from `packages/db`:

```bash
CONVEX_DEPLOY_KEY='' bun --env-file=../../.env.sim.local -e '
const p = Bun.spawnSync([
  "./node_modules/.bin/convex", "env", "set", "CONVEX_AUTH_JWKS",
  process.env.DEV_CONVEX_AUTH_JWKS
], { env: { ...process.env, CONVEX_DEPLOY_KEY: "" }, stdout: "inherit", stderr: "inherit" });
process.exit(p.exitCode);
'
CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex dev --once
```

Then run in two terminals from the root:

```bash
bun run sim:cloud
bun run dev:web:cloud
```

Open the simulator URL, not Vite directly: the simulator supplies signed Mini
App login data. Tests and simulator runs write synthetic records to the selected
dev backend. Never set `TEST_CONVEX_URL` to shared staging or real production.
Use different ports if another developer/process shares the same machine; see
`SIM_PORT`, `WORKER_PORT`, `WEB_APP_URL` in `packages/testing/src/cli.ts` and set
Vite's port and `VITE_BOT_API_URL` consistently.

For browser tests, install the version matching the pinned Playwright package:

```bash
cd packages/testing
./node_modules/.bin/playwright install chromium --only-shell
cd ../..
bun run test:web:cloud
```

This may download a browser. An older cached Chromium override caused misleading
phone-test failures here; the matching v1243 shell passed. Do not default to an
arbitrary installed browser or claim that desktop emulation proves real iOS.

## 5. Verify the existing Bosla service

The hosting/domain migration completed on 2026-11-11. Do not recreate its
Workers, queues, custom domain or Convex deployment. See the
[completed cutover record](bosla-staging-cutover.md).

From `packages/bot`:

```bash
./node_modules/.bin/wrangler whoami
./node_modules/.bin/wrangler secret list --config wrangler.staging.bosla.toml
```

Verify account **Bosla**, ID `fe626a504678476d9e8c2d942794d30f`, zone
`bosla.to` (`29f0ad378223b137bb9d0cd01cc2db99`) and the active custom domain
`halaqabot-staging.bosla.to`. The active bot/classifier configs pin this account.
`wrangler.staging.toml` pins the personal rollback account and has no cron;
normal staging work must use the `.bosla.toml` configs.

The three existing Bosla queues are `halaqabot-staging-updates`,
`halaqabot-staging-imports`, and `halaqabot-staging-dead-letters`. Preserve
single-message batches, concurrency 1 and retry/dead-letter settings. The bot
owns both consumers/producers. Only its Bosla instance runs `17 * * * *`.
Do not put an interactive Cloudflare Access login in front of `/telegram`.

## 6. Secrets: where they are and how to transfer them

The current authoritative local copy is **ignored**
`/mnt/linux_data/code/HalaqaBot/.env.staging.bosla.local`, mode 600, on Mohanad's laptop.
The older `.env.staging.local` is the personal-host rollback configuration.
It is intentionally excluded from the handoff archive and Git. Securely share
the needed credentials through the team's password manager or the agent's
private secret-input flow. Cloudflare can list secret **names**, but its CLI
cannot recover their values for migration. Do not copy Mohanad's global
Cloudflare/Convex OAuth credential files to a teammate's machine.

Keep an untouched private source copy for rollback. On the destination machine
make a separate ignored root `.env.staging.bosla.local`, mode 600, containing:

```dotenv
BOT_TOKEN=<existing-team-staging-bot-token>
TELEGRAM_WEBHOOK_SECRET=<existing-staging-webhook-secret>
CHANNEL_ID=-1004434414328
FORWARD_CHAT_ID=-1004415858273
# Named reference: bosla:halaqabotdb:staging; physical deployment stays fixed.
CONVEX_DEPLOYMENT=prod:perfect-clam-401
CONVEX_DEPLOY_KEY=<STAGING_DEPLOYMENT_SCOPED_KEY>
CONVEX_URL=https://perfect-clam-401.convex.cloud
VITE_CONVEX_URL=https://perfect-clam-401.convex.cloud
VITE_BOT_API_URL=
CONVEX_AUTH_PRIVATE_KEY='<existing-staging-private-JWK-JSON>'
STAGING_CONVEX_AUTH_JWKS=<matching-public-JWKS-data-URI>
GROQ_API_KEY=<existing-fake-classifier-bearer-token-NOT-a-Groq-key>
GROQ_BASE_URL=https://halaqabot-staging-classifier.nasseratic.workers.dev/openai/v1
WEB_APP_URL=https://halaqabot-staging.bosla.to
WORKER_URL=https://halaqabot-staging.bosla.to
CLOUDFLARE_ACCOUNT_ID=fe626a504678476d9e8c2d942794d30f
```

`GROQ_API_KEY` currently authenticates the **fake** classifier. Upload that
same value to its destination Worker as `STAGING_CLASSIFIER_TOKEN`. A real Groq
key does not exist for this setup yet. Do not ask the user to provision one just
to reproduce staging, and do not route staging data to the real provider by
accident. When the team authorizes a real Groq key, change the bot's secret and
remove `GROQ_BASE_URL`; test classification quality separately. The fake endpoint
does not validate bulk-score matching.

Reusing staging's existing signing pair means no Convex key/config change is
needed for an account/domain migration. `https://halaqabot.bot` is the configured
JWT **issuer identifier**, not the website hostname. Do not change it to the new
staging domain.

If the private signing key is unavailable, coordinate additive rotation: keep
the old public key in Convex's JWKS, add the new public key, validate destination
tokens, then switch the destination's private key. Keep both public keys through
the token lifetime and rollback window. Do not replace shared JWKS with an
unrelated fresh key while the old Worker or clients are still in use. The
generator supports two-key JWKS output, and tokens currently last one hour.

The shared-stage deploy key must be non-empty and scoped exactly to
`perfect-clam-401`. The authoritative local `.env.staging.bosla.local` already contains
it; transfer it privately to the destination file. Do not copy the old empty-key
workaround from earlier staging instructions. Keep personal-dev `.env.local`
files unchanged and use the explicit staging file on every shared-stage command.
Do not upload this deployment key to the bot Worker or frontend.

Before a shared-stage backend deployment, from `packages/db`, run:

```bash
bun --env-file=../../.env.staging.bosla.local ../../scripts/verify-staging-target.ts
```

The verifier refuses an empty/different deploy key, mismatched backend/frontend
URLs, or a production app hostname. Its output contains no secret values. The
currently installed bot-package Convex 1.34 CLI supports named deployments; the
database package's 1.27 CLI works with this scoped key. No dependency upgrade is
needed merely to move Cloudflare hosting. If the named deployment ever genuinely
needs recreating, a project admin can use the 1.34+ `deployment create` command
with the fully qualified `bosla:halaqabotdb:staging` reference and `--type prod`,
without `--default` or `--select`, then privately issue a key for that new
staging deployment and update/verify the inventory. That is not part of this
existing-environment handoff.

## 7. Routine deployments to the existing staging service

A hosting redeploy does not require a Convex redeploy. Reuse the named
`staging` deployment (`perfect-clam-401`), current data and signing keys.

From the repository root, verify the private target first:

```bash
bun --env-file=.env.staging.bosla.local scripts/verify-staging-target.ts
```

Build the Mini App from `packages/web`:

```bash
bun --env-file=../../.env.staging.bosla.local ./node_modules/.bin/vite build --outDir ../bot/.staging/web --emptyOutDir
```

`VITE_BOT_API_URL` stays empty for same-origin `/api`. From `packages/bot`:

```bash
./node_modules/.bin/wrangler deploy --config wrangler.staging.bosla.toml --dry-run
./node_modules/.bin/wrangler deploy --config wrangler.staging.bosla.toml
```

Existing Worker secrets persist across normal deploys. If a credential needs
updating, upload only this allowlist privately: `BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`, `CHANNEL_ID`, `FORWARD_CHAT_ID`, `CONVEX_URL`,
`CONVEX_AUTH_PRIVATE_KEY`, `WEB_APP_URL`, `GROQ_API_KEY`, `GROQ_BASE_URL`.
Never upload the whole env file, the Convex deployment key, OAuth credentials
or `TEST_*` values. Keep the secret classifier token equal to the fake
`GROQ_API_KEY`; the classifier's config is
`packages/testing/wrangler.staging-classifier.bosla.toml`.

After a redeploy, verify `/` and `/halaqas` return 200 over HTTPS; unsigned
`POST /api/auth/token` and `/telegram` return 401; the frontend uses
`perfect-clam-401`; the webhook/menu still use the Bosla hostname; and only the
Bosla scheduler is active. A regular browser has no Telegram login data.

Only if backend changes are explicitly needed, from `packages/db`, first run
the target verifier with the private staging file, then use the scoped key:

```bash
bun --env-file=../../.env.staging.bosla.local ../../scripts/verify-staging-target.ts
CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex deploy --env-file ../../.env.staging.bosla.local --yes
```

Verify the CLI targets `https://perfect-clam-401.convex.cloud`. Never run bare
`convex deploy`, use `--prod`, reset shared staging or import over newer data.

## 8. Completed cutover and future rollback

The active webhook is `https://halaqabot-staging.bosla.to/telegram` and the bot
menu uses `https://halaqabot-staging.bosla.to/` (Telegram may normalize the slash).
The old personal queues were verified drained before switching. Its cron is
disabled; Bosla's `17 * * * *` cron is enabled. The old service and its credentials
are retained for rollback; do not delete them before final phone acceptance.

If a future hostname/webhook-secret change is authorized, the existing setup
script is run from `packages/bot` with the explicit destination file:

```bash
bun --env-file=../../.env.staging.bosla.local scripts/set-webhook.ts
```

Read back both `getWebhookInfo` and `getChatMenuButton`; a successful setter
response alone is insufficient. Menu readback was briefly stale during this
cutover, and the process automatically rolled back until the new URL was
verified. Do not claim a per-chat/BotFather override was changed unless checked.
This bot reports no separately configured Main Mini App.

For a genuine rollback, coordinate a short staging pause, disable Bosla's cron,
pause the webhook with `drop_pending_updates=false`, verify destination queues
are drained, restore the old webhook/menu using `.env.staging.local`, and enable
only the personal scheduler. This needs the personal account operator's access.
Keep the same Convex named staging deployment and current data; never restore
an old snapshot over newer shared work. Verify a fresh real Telegram command
before releasing the testing pause.

## 9. Human acceptance: exact checks

The user already passed registration, deletion cancel/confirm, reapproval,
list replacement, registration close/reopen, background/resume and second-account
promotion/demotion/reaction checks. Do not request these again as unverified work.
Automated desktop/mobile-viewport checks also passed on the new live domain.

**Passed by Mohanad on 2026-11-11: physical Android check, on Wi-Fi.**
The steps below are retained for future hosting changes.

1. Close any old staging panel. Open `@halaqabot_bosla_staging_bot` and send a
   fresh `/admin` privately. Old inline buttons retain their old URL.
2. Press **🎛️ فتح لوحة التحكم**. Expect the existing halaqas at
   **https://halaqabot-staging.bosla.to**.
3. Open an existing test halaqa and use the **top ⋮ beside the الحلقة selector →
   إرسال قائمة الأسماء** once. Confirm the list appears under the correct
   Telegram post. This checks real Telegram delivery through the Bosla queue.

There is no simulator bubble in real Telegram. Physical iPhone and real Groq
classification remain unverified; Chromium phone emulation does not prove iOS.

The existing discussion group is temporarily the scratch forwarding target.
For quieter team testing, optionally create a private group
**`HalaqaBot Staging — Scratch`**, add the bot with permission to send/delete its
own probe messages, discover its actual ID from a fresh authorized update, and
change `FORWARD_CHAT_ID` in staging only. Never invent a chat ID or substitute a
production group. Keep the old value for rollback.

The subsequent final candidate includes `main`'s PR #170 manual-list feature,
with channel-isolation checks on its new endpoints. Source `3f287da` is deployed
to shared staging; Worker version `f31fa01a-cead-4391-a085-7e8ef2d11205`.
Its automated live desktop/mobile-viewport and access checks passed after deploy;
this does not claim another physical-phone pass. See [integration evidence](pr-165-review.md#main-branch-integration-on-2026-11-11).

## 10. Logs, common failures, and rollback

Live destination logs, from `packages/bot`:

```bash
./node_modules/.bin/wrangler tail --config wrangler.staging.bosla.toml
```

Logs and request headers can include student text, user IDs, or webhook secrets.
Store diagnostic files privately (mode 600); report only the necessary sanitized
facts. Do not publish full tail output. Inspect the webhook with `getWebhookInfo`
through private-token tooling; report URL, pending count and last error only.

| Symptom | Check |
| --- | --- |
| Reply/reaction ignored | Logs show `GroupAnonymousBot` or anonymous reaction; disable Remain Anonymous and submit a **new** personal reply/reaction. |
| Panel denies tester | They must be channel admin, have pressed Start, and open inside Telegram. Check admin sync and JWT/JWKS match. |
| Panel actions fail after hostname change | Check runtime `WEB_APP_URL`, Vite build-time URL, exact browser origin, and destination secrets. |
| Panel cannot load on Wi-Fi, but opens on mobile data | Check DNS answers and TCP/TLS reachability before changing application code. On 2026-11-08, Google DNS returned reachable addresses while Cloudflare DNS returned unreachable ones; a per-Wi-Fi-profile Google DNS setting restored normal HTTPS on the laptop. Save previous settings, coordinate changes with the device/network owner, and do not hardcode edge IPs. See staging.md. |
| Webhook 200 but no turn | Check queue consumer executions, handler errors and dead letters; 200 only acknowledges enqueueing. |
| Classifier 401/1042 | Check the identical fake-classifier bearer token, destination URL and both Workers' compatibility flags. |
| Convex auth/config errors | Verify the staging selector, current CLI login/deploy key, and matching signing pair. Never change actual production to work around it. |
| Imports stay processing | Inspect queue/job logs and import row; failed handlers can be acknowledged and skipped. Replaying can duplicate effects. |

**Rollback during the agreed window:** pause the webhook without dropping pending
updates, stop destination cron, let destination queues settle, restore the
source Worker's URL/menu with the untouched source secret file, and reenable
only its cron. Verify a fresh test event. Keep shared data; do not import an old
snapshot over teammates' newer changes. Domain/frontend rollback and webhook
rollback must both be accounted for. If a backend schema change was introduced,
this simple hosting rollback may not be sufficient—review compatibility first.

## 11. Known limits and agent completion report

- Name detection is currently deterministic fake classification; real Groq and
  bulk-score matching remain separate acceptance work.
- The cross-channel name/privacy fix is in [PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169),
  already deployed to personal dev and shared staging. Include its pinned
  security commit before deploying from this handoff, and before releasing #165.
  Its cloud-backed suite passed 93 tests, skipped 2 emulator-only cases, failed 0.
  Use synthetic data in staging.
- The preview fixes are included in this environment branch/archive: cloud
  previews require isolated Convex preview deployments and reject shared dev
  keys before any build/deploy; every smoke check verifies a fresh signup.
  Branch names include a stable hash to avoid normalization collisions. Local
  preview commands may use a developer's own dedicated dev deployment. Do not
  point PR previews at the shared staging database. If isolated deployments
  are unavailable, keep cloud previews disabled and use personal dev/staging.
  Actual Workers Builds/Convex preview hosting remains unverified; local tests
  establish the key guard and repeat-signup behavior.
- The earlier environment snapshot's full cloud suite passed 77 tests, skipped 2 emulator-only
  cases, failed 0; the additional staging-classifier tests passed 3/3. An earlier
  import timeout was not reproduced later; diagnostic output was added, not a
  larger timeout. Matching Playwright Chromium resolved the phone automation failure.
- The combined environment + security branch passed 101 cloud-backed tests,
  skipped 2 emulator-only checks, failed 0 on 2026-11-08. The separate #168 clean-
  checkout run generated missing bindings and passed 82 tests with 4 browser
  skips. GitHub CI still needs maintainer approval for fork workflows.
- #168 and #169 were merged into #165 on 2026-11-11. Bosla staging is live.
  Android/Wi-Fi acceptance passed. Follow [the remaining release checks](staging-acceptance.md)
  before the production domain/bot cutover. #165 remains open against `main`.

When finished, report the exact destination Cloudflare account, hostname, Worker
names, queue names, Convex project/deployment, deployed source SHA plus local diff
status, webhook/menu target, single active cron owner, tests performed, remaining
phone/team checks, secret custodian and rollback owner. Report secret **names**
only. Update `docs/staging.md` and this inventory after a verified cutover.

To regenerate the versioned portable bundle after an environment change, run
`python3 scripts/build-agent-handoff.py`; review the generated archive/manifest
diff. The builder uses an explicit source allowlist and a temporary Git index,
verifies patch application, and excludes environment files and built assets.

## Agent task to copy

> Read this entire handoff and the repository instructions. Set up your personal
> dev environment independently, then prepare the existing HalaqaBot team staging
> already running in Bosla Cloudflare using the existing Telegram bot/chats and
> `bosla/halaqabotdb:staging` (`perfect-clam-401`). Do not recreate the retired
> separate staging project or change the original project's production default.
> Verify the current Bosla account and active staging hostname. Do not rerun the
> completed cutover or recreate its resources. Obtain secrets
> privately. Keep current staging running; coordinate any future hosting
> change and preserve one webhook and one active scheduler. Do not use production resources, rotate
> shared keys unnecessarily, run tests against shared data, or take over the
> staging bot for personal development. Validate and report rollback readiness
> before switching; complete the human checks and update the inventory afterward.

References: [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Telegram Bot API](https://core.telegram.org/bots/api),
[Telegram webhook/long-polling FAQ](https://core.telegram.org/bots/faq).
