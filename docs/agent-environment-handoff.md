# Agent handoff: personal development and Bosla team staging

Originally prepared 2026-11-06; stacked handoff snapshot updated 2026-11-08 for
PR [#165](https://github.com/MoAndBee/HalaqaBot/pull/165)
in `MoAndBee/HalaqaBot`. This is a setup and migration runbook, not evidence
that a migration to Bosla Cloudflare has already happened.

## Decision: reuse team staging; isolate personal work

Keep one shared staging bot, channel, discussion group and Convex project.
Recreate the hosting resources in **Bosla's Cloudflare account**, validate them
alongside the existing hosting, then move the existing staging bot's webhook.
Use the existing staging database without copying production or clearing rows.

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
| Current Mini App + API | `https://halaqabot-staging.mhndahmd031.workers.dev` |
| Current webhook | `https://halaqabot-staging.mhndahmd031.workers.dev/telegram` |
| Current Cloudflare owner | Mohanad's personal account, **not Bosla** |
| Current Cloudflare account ID | `633bbfa7b98a8f8d38054789a1af0e7a` |
| Current Workers subdomain | `mhndahmd031.workers.dev` |
| Bot Worker | `halaqabot-staging` |
| Fake-classifier Worker | `halaqabot-staging-classifier` |
| Classifier base URL | `https://halaqabot-staging-classifier.mhndahmd031.workers.dev/openai/v1` |
| Update queue | `halaqabot-staging-updates` |
| Import queue | `halaqabot-staging-imports` |
| Dead-letter queue | `halaqabot-staging-dead-letters` |
| Scheduled admin reconciliation | `17 * * * *` |
| Shared Convex team/project | `bosla / halaqabot-staging` |
| Shared Convex deployment | `perfect-clam-401` |
| Shared Convex URL | `https://perfect-clam-401.convex.cloud` |
| Shared database dashboard | https://dashboard.convex.dev/d/perfect-clam-401 |
| Mohanad's personal dev | `doting-viper-550`, in `bosla / halaqabotdb` |
| Existing live app's Convex project | `bosla / halaqabotdb`; do not deploy its production slot |
| Known production deployment in that project | `incredible-lyrebird-981`; confirm inventory before any future production work |
| Other historical deployment in CLAUDE.md | `wry-crab-519`; do not treat that URL as the staging target |

The shared staging project uses Convex's **production slot inside the staging-only
project** so it is stable for the team. It is separate from the application's
actual production project and from each developer's dev deployment. CLI wording
like “production” is insufficient: verify the project and deployment name.

### URLs to use after moving hosting

- Recommended shared staging hostname: **`https://halaqabot-staging.bosla.to`**.
  This is a proposed destination, not an existing verified DNS record. Inspect
  the zone and confirm it is unused before attaching it.
- Confirmed intended final production Mini App hostname:
  **`https://halaqabot.bosla.to`**. Do not use it for staging or alter it as part
  of this handoff.
- Serve the staging Mini App and `/api/*` from the same Worker/domain. This is
  already supported by `wrangler.staging.toml`; no separate frontend host is needed.
- The classifier may stay at the **destination account's** Workers subdomain.
  Replace its current personal-account URL in `GROQ_BASE_URL`.

## 2. Obtain access; identifiers do not grant it

| Access | What the human maintainer must arrange |
| --- | --- |
| Repository | Give the teammate repository read access, plus write access if they will publish reviewed changes. |
| Telegram chats | Invite their personal Telegram account to both private chats. IDs above are not invite links. |
| Mini App administration | Promote them to **channel** admin. Discussion-group admin alone does not grant app access. |
| Telegram bot credential | Share the existing staging token through the team's password manager/private secret input. BotFather ownership is not required merely to deploy it. |
| Bosla Cloudflare | Invite their Cloudflare login to the account containing `bosla.to`, with Worker deployment/secrets, Queues, logs and domain/DNS permissions appropriate to their task. |
| Bosla Convex | Invite their Convex login to the Bosla team with access to `halaqabot-staging`, and to the project where their personal dev deployment will live. |
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

The additions were initially uncommitted on Mohanad's local branch. They are
being published in the stacked branch `codex/pr-165-staging-handoff`, targeting
PR #165's branch. Checking out PR #165 alone does not include them.
The security fix is a separate [PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169), at
`0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a`. It is already deployed to shared staging.
The environment branch/archive excludes those backend changes: include this
commit as shown below before deploying, so the setup does not revert the fix.
If your base already contains this commit, skip cherry-picking it again.

Preferred: in a checkout of the repository, fetch the stacked environment branch
from the contributor fork. It already includes
the setup helpers, staging configs and these instructions. Do not apply the
archive's patch over that branch:

```bash
git fetch https://github.com/mohanad-80/HalaqaBot.git codex/pr-165-staging-handoff
git switch -c setup/bosla-staging FETCH_HEAD
git fetch https://github.com/mohanad-80/HalaqaBot.git codex/fix-cross-channel-names
git cherry-pick 0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a
bun install --frozen-lockfile
bun run test
```

Portable alternative: `docs/handoff/halaqabot-agent-handoff.tar.gz` contains the
documents and `pr-165-environment.patch`, applied against the pinned #165 head.
Download and extract it **outside the checkout** before switching branches, so
switching to the older base does not remove your only copy of the archive.
Verify `docs/handoff/SHA256SUMS` before extracting a downloaded archive.

In a new checkout, after extracting the archive through an approved file channel:

```bash
git clone https://github.com/MoAndBee/HalaqaBot.git
cd HalaqaBot
git fetch origin pull/165/head
git switch -c setup/bosla-staging 5b00b67d2378d8f7f29073ab4fc58d1d833742f8
git apply --check /path/to/handoff/pr-165-environment.patch
git apply --index /path/to/handoff/pr-165-environment.patch
git commit -m "Apply staging environment handoff"
git fetch https://github.com/mohanad-80/HalaqaBot.git codex/fix-cross-channel-names
git cherry-pick 0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a
git status --short
bun install --frozen-lockfile
bun run test
```

Use Bun's existing cache/dependencies when available. This snapshot was tested
with Bun 1.3.14. Do not silently upgrade dependencies. If the PR has advanced,
compare the new head and port the changes deliberately instead of force-applying
the patch. If using Mohanad's existing checkout, inspect its diff and do not
apply the same patch twice or overwrite his work.

Required additions already present on the stacked branch include `packages/bot/wrangler.staging.toml`,
`packages/testing/wrangler.staging-classifier.toml`,
`packages/testing/src/staging-classifier.ts`,
`packages/testing/scripts/prepare-local.ts`, the simulator confirmation fix and
the related tests/docs. Review the complete patch before using the archive. No
credentials, ignored environment files, dependency folders or generated web
assets belong in the archive.

Do **not** use root `bun run build` as a harmless check: it runs a Convex deploy.
After local test/codegen preparation, use `build:db`, `build:bot` and `build:web`
individually. Existing stage/config additions are not a claim that all PR review
findings are fixed; read `docs/pr-165-review.md`.

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

## 5. Prepare migration into Bosla Cloudflare without switching traffic

This phase can happen while everyone keeps using the current team bot.

1. Inspect the current webhook/menu, source revision, Worker versions, queue
   consumers and cron. Record the current source URL above for rollback. Do not
   call `deleteWebhook`, `setWebhook`, `getUpdates`, or start `bot.start()` for
   the shared bot during preparation. Telegram supports one webhook per bot;
   long polling cannot coexist with an active webhook.
2. Authenticate Wrangler as the teammate and run, from `packages/bot`:

   ```bash
   ./node_modules/.bin/wrangler login
   ./node_modules/.bin/wrangler whoami
   ```

   The teammate's email alone is insufficient: verify that the **Bosla account**
   is listed. If localhost OAuth callbacks fail, use Wrangler's supported device
   flow (`login --device`) rather than posting tokens in chat.
3. Discover Bosla's actual Cloudflare account ID and Workers subdomain. They are
   **not** the personal account ID/subdomain listed in section 1. Inspect the
   `bosla.to` zone, existing records, routes and `halaqabot-staging.bosla.to`
   hostname. An existing record/service must be investigated, not overwritten.
4. Keep the bot and classifier config files separate from the personal source
   deployment. For example, copy them to
   `packages/bot/wrangler.staging.bosla.toml` and
   `packages/testing/wrangler.staging-classifier.bosla.toml`. Put the verified
   Bosla `account_id = "..."` at the top of **both**. Keep resource names from
   section 1; they are isolated by account. If names already exist in Bosla,
   inspect ownership/configuration before reusing them.
5. In the **candidate bot config**, set `crons = []` under `[triggers]`. Keep the
   old personal Worker's cron active for now. This prevents two schedulers while
   preparing. Keep queue consumers, asset settings and compatibility flags; do
   not set `PREVIEW_WORKER_NAME`, `TELEGRAM_API_ROOT` or `SIM_*` variables. Those
   are simulator/preview settings and must not be used for real staging.
6. Add this top-level setting to the Bosla bot config, **above TOML sections**,
   after verifying the proposed hostname is available:

   ```toml
   routes = [{ pattern = "halaqabot-staging.bosla.to", custom_domain = true }]
   ```

   This uses a Workers Custom Domain, not a manual CNAME to the personal Worker.
   Cloudflare creates the domain's DNS record and certificate during deployment.
   Both Mini App and API will use this origin. Do not put an interactive Access
   login in front of `/telegram`; Telegram cannot complete a browser login.
7. Check the account's Workers/Queues plan and quotas. Existing creation worked
   in the personal account, but do not assume Bosla has identical limits or
   silently purchase/upgrade a plan. Inspect actual deployment/runtime errors.

From `packages/bot`, using the **destination** config for every command:

```bash
./node_modules/.bin/wrangler queues list --config wrangler.staging.bosla.toml
./node_modules/.bin/wrangler queues create halaqabot-staging-dead-letters --config wrangler.staging.bosla.toml
./node_modules/.bin/wrangler queues create halaqabot-staging-updates --config wrangler.staging.bosla.toml
./node_modules/.bin/wrangler queues create halaqabot-staging-imports --config wrangler.staging.bosla.toml
```

Create only missing queues. Never attach a new consumer to a personal/developer
queue or another existing team's queue. Queue bindings/consumers must resolve to
the destination account. Preserve single-message batches/concurrency from the
checked-in staging config.

## 6. Secrets: where they are and how to transfer them

The current authoritative local copy is **ignored**
`/mnt/linux_data/code/HalaqaBot/.env.staging.local`, mode 600, on Mohanad's laptop.
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
CONVEX_DEPLOYMENT=prod:perfect-clam-401
CONVEX_DEPLOY_KEY=
CONVEX_URL=https://perfect-clam-401.convex.cloud
VITE_CONVEX_URL=https://perfect-clam-401.convex.cloud
VITE_BOT_API_URL=
CONVEX_AUTH_PRIVATE_KEY='<existing-staging-private-JWK-JSON>'
STAGING_CONVEX_AUTH_JWKS=<matching-public-JWKS-data-URI>
GROQ_API_KEY=<existing-fake-classifier-bearer-token-NOT-a-Groq-key>
GROQ_BASE_URL=https://halaqabot-staging-classifier.<BOSLA-WORKERS-SUBDOMAIN>.workers.dev/openai/v1
WEB_APP_URL=https://halaqabot-staging.bosla.to
WORKER_URL=https://halaqabot-staging.bosla.to
CLOUDFLARE_ACCOUNT_ID=<BOSLA-ACCOUNT-ID>
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

The CLI version here requires `CONVEX_DEPLOY_KEY=` in a custom `--env-file` to
initialize logged-in auth correctly. Leaving the key absent caused a misleading
MissingAccessToken error. Running `--deployment-name perfect-clam-401` while the
CLI is selected to `halaqabotdb` also failed because it is a different project.
Use the explicit staging selector file; never “fix” this by rebinding another
developer's normal `.env.local` or deploying a similarly named production target.

## 7. Build and deploy the candidate

Do not redeploy Convex merely because Cloudflare is moving accounts. Reuse
`perfect-clam-401` with compatible code. If schema/functions actually changed,
review and coordinate a shared-stage backend deployment separately; changing
it affects current users even before the webhook cutover. Never reset/import
production data into it.
If an agreed backend change does need deploying, the explicit command from
`packages/db` is `CONVEX_DEPLOY_KEY='' ./node_modules/.bin/convex deploy --env-file ../../.env.staging.bosla.local --yes`.
Verify it targets `https://perfect-clam-401.convex.cloud` before proceeding;
the destination file must contain both the staging selector and empty deploy-key
line as described above.

From `packages/web` build isolated staging assets:

```bash
bun --env-file=../../.env.staging.bosla.local ./node_modules/.bin/vite build --outDir ../bot/.staging/web --emptyOutDir
```

`VITE_BOT_API_URL` is deliberately empty: the frontend uses its own origin for
`/api`. These are build-time variables; changing Cloudflare secrets does not
rewrite an already-built Vite bundle. `WEB_APP_URL` is runtime configuration for
menu links and the API's one allowed browser origin; set it explicitly.

Deploy the fake classifier from `packages/testing`, then upload its secret:

```bash
./node_modules/.bin/wrangler deploy --config wrangler.staging-classifier.bosla.toml
./node_modules/.bin/wrangler secret put STAGING_CLASSIFIER_TOKEN --config wrangler.staging-classifier.bosla.toml
```

Enter the fake-classifier bearer token through the interactive/private input;
do not place it literally in the shell command. Check the returned destination
URL and update `GROQ_BASE_URL` accordingly. Public GET `/` should identify it as
`simulated-classification`; an unsigned POST must be rejected.

From `packages/bot`:

```bash
./node_modules/.bin/wrangler deploy --config wrangler.staging.bosla.toml --dry-run
./node_modules/.bin/wrangler deploy --config wrangler.staging.bosla.toml
```

Upload only this allowlist to the bot Worker: `BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`, `CHANNEL_ID`, `FORWARD_CHAT_ID`, `CONVEX_URL`,
`CONVEX_AUTH_PRIVATE_KEY`, `WEB_APP_URL`, `GROQ_API_KEY`, `GROQ_BASE_URL`.
Use `wrangler secret put <NAME> --config ...` privately for each, or feed an
allowlisted JSON object to `secret bulk` through stdin. Do not upload the full
local environment file, OAuth tokens, `TEST_*` credentials, or deployment keys.

Before switching Telegram, verify on the custom domain:

- Certificate and `/` load; `/halaqas` also returns the SPA rather than 404.
- Unsigned `POST /api/auth/token` and unsigned `POST /telegram` return 401.
- The built frontend uses `perfect-clam-401` and same-origin `/api`.
- All nine bot secret names exist; classifier secret is configured; origin is exact.
- Destination queue consumers/bindings exist; destination cron is still disabled.
- Source webhook/menu still point to the personal source Worker. Do not run a
  fake Telegram world, fake webhook update, or synthetic-user test suite against
  the shared database just to smoke-test the candidate.

A regular browser tab has no Telegram-signed login data; seeing a login error
there is expected. Full user acceptance follows the webhook/menu cutover.

## 8. Short coordinated cutover; personal development continues

Coordinate only a short pause in **shared staging** testing; nobody needs to stop
their independent dev environment. If a tester is actively using staging, finish
candidate preparation first and agree on the small switching window. The bot
has one webhook; concurrent old/new imports or API writes can otherwise interleave.

1. Have Mohanad, or an operator with old-account access, disable the **old staging
   cron**. Keep the old Worker, queues, assets and secrets for rollback.
2. Pause the staging bot's webhook using Telegram `deleteWebhook` with
   **`drop_pending_updates=false`**. Do not delete/reset the bot or chats. This
   pause is now intentional; Telegram temporarily holds new updates.
3. Let old update/import queues finish, verify in-flight imports have settled,
   and inspect dead letters. An empty Telegram pending count does **not** prove
   the Cloudflare queues are drained. Do not delete either set of queues or replay
   dead letters blindly: handlers are not generally idempotent.
4. Register the destination webhook/menu with the existing script, from
   `packages/bot`, using the destination's private file:

   ```bash
   bun --env-file=../../.env.staging.bosla.local scripts/set-webhook.ts
   ```

   It must report `https://halaqabot-staging.bosla.to/telegram` and the five
   intended update types: message, channel_post, my_chat_member, chat_member,
   message_reaction. It sets `max_connections=1`. Do not pass a simulator API root.
5. Restore `crons = ["17 * * * *"]` in the **destination** config and deploy
   it explicitly. Only the destination should now own scheduled reconciliation.
6. Have the maintainer get a fresh `/admin` response and open the panel from the
   new menu/button. Old inline messages still contain old links. Update a
   separately configured BotFather Main Mini App URL/per-chat menu override if
   one exists; this run configured the default bot menu through the script.
7. Follow section 9 while watching the **destination** logs and database. Confirm
   the old queues do not receive new updates. Then release the shared testing pause.
8. Retain old hosting for an agreed rollback period. After acceptance, Mohanad
   can retire only the personal **staging** resources. Do not delete unrelated
   Workers, `halaqabotdb`, personal dev deployments, or actual production resources.

Use Telegram API calls through private-token tooling, not URLs containing tokens
in an ordinary browser. Never run `getUpdates` while the webhook is active or
start a competing polling process. Telegram retains undelivered updates for a
limited time (up to 24 hours); this is not a substitute for verifying queue drain.

## 9. Human acceptance: exact checks

**Desktop, then Android/iPhone:**

1. Open `@halaqabot_bosla_staging_bot`, press Start and send `/admin` privately.
2. Press **🎛️ فتح لوحة التحكم** or the **لوحة التحكم** menu button. Check that
   it opens the chosen staging hostname inside Telegram.
3. In `HalaqaBot Staging — Channel`, post two lines:

   ```text
   حللتم أهلا ونزلتم سهلا 🌸
   سجلي اسمك للحلقة
   ```

4. Open that post's comments, reply **as your personal account** with
   `انا فاطمة احمد تسميع`, then react 👌 as a **channel admin**.
5. In the panel, open **الحلقات**, then that halaqa. Expect one
   `فاطمة احمد` entry tagged **تسميع**.
6. Turn menu **⋮ → حذف → Cancel** must preserve the entry. Confirming deletion
   must remove it. Remove/re-add 👌 on the personal reply to restore it once.
7. Background Telegram and reopen it. Confirm scrolling, menus and data still work.
8. With a second person: ordinary channel/group member → panel says **غير مصرح**;
   promote to channel admin → close/reopen panel → access; demote → close/reopen
   → access denied again. Do not demote the sole owner to simulate another user.

Desktop and Android core checks passed on the personal-account staging. iOS and
the real second-person promotion/demotion test are still pending. There is no
simulator bubble in real Telegram. Re-test after moving domains/accounts.

The existing discussion group is temporarily the scratch forwarding target.
For quieter team testing, optionally create a private group
**`HalaqaBot Staging — Scratch`**, add the bot with permission to send/delete its
own probe messages, discover its actual ID from a fresh authorized update, and
change `FORWARD_CHAT_ID` in staging only. Never invent a chat ID or substitute a
production group. Keep the old value for rollback.

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
- Before merging #165, follow [the integration/domain order and remaining checks](staging-acceptance.md).
  Merge #168 into the migration branch first, update and merge #169 there, then
  validate the combined #165 head. Prepare the Bosla staging hostname before the
  final production domain/bot cutover; do not treat merging a companion PR as
  permission to deploy to production.

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
> in Bosla Cloudflare using the existing Telegram bot/chats and `perfect-clam-401`.
> Verify the destination account and unused staging hostname. Obtain secrets
> privately. Keep current staging running during preparation; coordinate only
> the final webhook/queue/cron cutover. Do not use production resources, rotate
> shared keys unnecessarily, run tests against shared data, or take over the
> staging bot for personal development. Validate and report rollback readiness
> before switching; complete the human checks and update the inventory afterward.

References: [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Telegram Bot API](https://core.telegram.org/bots/api),
[Telegram webhook/long-polling FAQ](https://core.telegram.org/bots/faq).
