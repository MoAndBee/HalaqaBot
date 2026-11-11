# Team staging

For another engineer or agent, use the [complete environment and Bosla-account
handoff](agent-environment-handoff.md). It includes access requirements, exact
chat IDs, personal-dev isolation, secret transfer, custom domain setup, cutover
and rollback. This page describes the currently running environment.
The [remaining pre-merge acceptance checks](staging-acceptance.md) cover list
sending, registration controls, old-post imports, team access and missing platform/provider checks.

This environment runs the PR #165 bot on real Cloudflare Workers/Queues, with
real Telegram and a separate Convex database. No existing production deployment
or `bosla.to` DNS was changed. On 2026-11-08, Convex backend commit
`0e4e8c9909d56bd7007f678d58afa8cd91cd1f6a` from [PR #169](https://github.com/MoAndBee/HalaqaBot/pull/169)
was deployed to shared staging and personal dev to fix cross-channel name
disclosure. The Cloudflare Worker/frontend were not redeployed for this fix.
Include that security commit when deploying from the handoff branch/archive.

| Resource | Staging value |
| --- | --- |
| Telegram bot | `@halaqabot_bosla_staging_bot` |
| Channel | `HalaqaBot Staging — Channel` |
| Discussion | `HalaqaBot Staging — Discussion` |
| Mini App / API | https://halaqabot-staging.mhndahmd031.workers.dev |
| Convex project | `Bosla / halaqabotdb` |
| Named deployment | `staging`, type `prod`, non-default |
| Physical deployment / URL | `perfect-clam-401` / https://perfect-clam-401.convex.cloud |
| Database dashboard | https://dashboard.convex.dev/d/perfect-clam-401 |
| Classifier | `halaqabot-staging-classifier` Worker, simulated rules |

Cloudflare hosting belongs to Mohanad's personal account. Team members can use
the shared Telegram chats and bot without a Cloudflare login. To use the admin
Mini App, a tester must also be an administrator of the **channel**; group admin
alone does not grant access.

Staging is a dedicated named deployment inside the original Convex project.
On 2026-11-08 it was transferred into `halaqabotdb` as `staging`, retaining the
same backend URL, data, IDs and auth configuration. The old `halaqabot-staging`
Convex project was deleted after testing; the Cloudflare Worker and Telegram
names still use `halaqabot-staging` and must stay that way.

The project's default production deployment remains `incredible-lyrebird-981`;
Mohanad's personal dev remains `doting-viper-550`. Use the non-empty staging-scoped
key from the private staging env file for all shared-stage backend operations,
never the project's default production target. See the
[completed migration and live checks](staging-convex-migration.md).

## Important test boundary

There is no Groq key yet. The staging bot's `GROQ_BASE_URL` points at a private,
authenticated fake classifier that uses the same deterministic rules as the
simulator. Telegram, queues, the API, Mini App, and database are real. Natural
language classification quality and bulk-score matching are not validated by
this fake service. No real Groq API is contacted. Use synthetic student names
and test data; real classifier quality is still unverified.

The existing discussion group is temporarily used as the forwarding/probe chat
(`FORWARD_CHAT_ID`). Name lookups/imports may briefly forward messages there
before deleting them. A separate private scratch group can replace it later.

## First test on a laptop

1. Open https://t.me/halaqabot_bosla_staging_bot and press **Start**.
2. Send `/admin` in the private chat with the bot.
3. Press **🎛️ فتح لوحة التحكم**, or the **لوحة التحكم** menu button.
4. The real Mini App should open and show **الحلقات**. Opening the website in a
   regular browser tab does not supply Telegram login data.
5. Post this in `HalaqaBot Staging — Channel`:

   ```text
   حللتم أهلا ونزلتم سهلا 🌸
   سجلي اسمك للحلقة
   ```

6. Open its comments in `HalaqaBot Staging — Discussion`. Reply to the forwarded
   post with `انا فاطمة احمد تسميع`, sending as your **personal account**, not
   as the channel or an anonymous administrator.
7. As a channel admin, add 👌 to that reply. Reopen **الحلقات** in the Mini App,
   open the new halaqa, and verify the turn list contains `فاطمة احمد` once.
8. From that turn's menu, try **حذف**: Cancel should keep it; confirming should
   remove it. Here the dialog is provided by real Telegram, not the simulator.

Do not look for the simulator's blue bubble: this environment uses real Telegram.

## Phone and team checks

Verified manually by Mohanad on desktop Telegram and Android: opening the admin
panel, registering a halaqa, adding one named turn through a personal-account
reply plus admin 👌, cancelling deletion, confirming deletion, restoring the
turn through a fresh approval, and background/resume behavior. The initially
ignored reply/reaction were sent anonymously; turning off **Remain Anonymous**
resolved that setup issue. List replacement, registration closing/reopening,
and a second account's promotion/demotion and reaction permissions were also
reported passed. iOS remains unverified. Name classification still uses the fake
staging service.

After the laptop flow works, repeat opening the panel and viewing the turn list
in Telegram on a phone. Test background/resume, scrolling, menus and deletion
confirmation. iOS/Safari compatibility still needs a physical device.

Invite a second tester to the private channel/group. As a normal member, they
should not receive admin access. After promoting them to **channel admin**, they
should gain access; after demotion they should lose it. They must press Start
in the staging bot's private chat before using it.

## Operations

### Panel stuck loading on one network

On 2026-11-08, desktop Telegram on Mohanad's Wi-Fi could not open the panel,
while Android on mobile data opened it successfully. The Wi-Fi resolver returned
Cloudflare edge addresses whose TCP connections timed out before TLS. Requests
to alternative addresses returned by Google DNS succeeded with HTTPS/HTTP 200;
the deployed Worker and Telegram webhook were still healthy.

The Wi-Fi supplied a mix of `1.1.1.1` and `8.8.4.4`. Both Google resolvers
(`8.8.8.8` and `8.8.4.4`) returned reachable addresses. The laptop's active Wi-Fi
profile was therefore changed to use those Google resolvers exclusively, with
automatic IPv4/IPv6 DNS disabled for that profile. After reapplying the profile
and flushing the system DNS cache, a normal HTTPS request returned HTTP 200.
The router, application and other devices were not changed. Previous profile
settings were saved privately under `~/.local/state/halaqabot-network/`.

For this specific setup, fully quit/reopen Telegram after the DNS change to
clear its own cached address. On another device, diagnose its resolver first;
the laptop change does not fix Android's Wi-Fi DNS. Involve the network owner
for a router-wide change. A hotspot is only a temporary diagnostic workaround.
No local development server restart or Worker redeploy is needed. Edge IPs
change: do not turn `curl --resolve` into a fixed hosts entry or assume every
blank Telegram panel has this cause. If it also fails on mobile data, investigate
the application/API again.

Private settings live in ignored `.env.staging.local` with permissions 600.
Never commit it. Staging uses a distinct signing key and three queues prefixed
`halaqabot-staging-`. Bot deployment config: `packages/bot/wrangler.staging.toml`.

Build the web assets (from `packages/web`):

```bash
bun --env-file=../../.env.staging.local ./node_modules/.bin/vite build --outDir ../bot/.staging/web --emptyOutDir
```

Deploy/log the staging Worker (from `packages/bot`):

```bash
./node_modules/.bin/wrangler deploy --config wrangler.staging.toml
./node_modules/.bin/wrangler tail --config wrangler.staging.toml
```

Re-register staging webhook/menu if their settings change (same directory):

```bash
bun --env-file=../../.env.staging.local scripts/set-webhook.ts
```

The fake classifier is deployed from `packages/testing` with
`wrangler.staging-classifier.toml`. Its bearer token is a generated staging-only
secret, not a real Groq credential. When a team Groq key is available, replace
the Worker's `GROQ_API_KEY` and remove its `GROQ_BASE_URL` override to enable the
real provider. Classifier/UI/backend deployments remain explicit and manual.

The final Mini App domain remains `https://halaqabot.bosla.to`; attaching that
hostname requires access to its DNS zone and is a separate cutover.
