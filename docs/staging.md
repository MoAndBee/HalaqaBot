# Team staging

For another engineer or agent, use the [complete environment and Bosla-account
handoff](agent-environment-handoff.md). It includes access requirements, exact
chat IDs, personal-dev isolation, secret transfer, custom domain setup, cutover
and rollback. This page describes the currently running environment.
The [remaining pre-merge acceptance checks](staging-acceptance.md) cover list
sending, registration controls, old-post imports, team access and missing platform/provider checks.

This environment runs the PR #165 bot on real Cloudflare Workers/Queues, with
real Telegram and a separate Convex database. No existing production deployment
or `bosla.to` DNS was changed.

| Resource | Staging value |
| --- | --- |
| Telegram bot | `@halaqabot_bosla_staging_bot` |
| Channel | `HalaqaBot Staging — Channel` |
| Discussion | `HalaqaBot Staging — Discussion` |
| Mini App / API | https://halaqabot-staging.mhndahmd031.workers.dev |
| Convex project | `Bosla / halaqabot-staging` |
| Database dashboard | https://dashboard.convex.dev/d/perfect-clam-401 |
| Classifier | `halaqabot-staging-classifier` Worker, simulated rules |

Cloudflare hosting belongs to Mohanad's personal account. Team members can use
the shared Telegram chats and bot without a Cloudflare login. To use the admin
Mini App, a tester must also be an administrator of the **channel**; group admin
alone does not grant access.

The separate Convex project uses its production slot for stable shared staging.
That is **not** `halaqabotdb`'s production database, and is independent of
Mohanad's personal `doting-viper-550` dev deployment.

## Important test boundary

There is no Groq key yet. The staging bot's `GROQ_BASE_URL` points at a private,
authenticated fake classifier that uses the same deterministic rules as the
simulator. Telegram, queues, the API, Mini App, and database are real. Natural
language classification quality and bulk-score matching are not validated by
this fake service. No real Groq API is contacted. Use synthetic student names
and test data; the cross-channel privacy review finding is still unresolved.

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
resolved that setup issue. iOS and a second tester's access transitions remain
unverified. Name classification still uses the fake staging service.

After the laptop flow works, repeat opening the panel and viewing the turn list
in Telegram on a phone. Test background/resume, scrolling, menus and deletion
confirmation. iOS/Safari compatibility still needs a physical device.

Invite a second tester to the private channel/group. As a normal member, they
should not receive admin access. After promoting them to **channel admin**, they
should gain access; after demotion they should lose it. They must press Start
in the staging bot's private chat before using it.

## Operations

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
