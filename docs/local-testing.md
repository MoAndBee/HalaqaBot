# First steps and PR #165 testing

## What you are running

The bot receives Telegram events, detects registration posts and student names,
and maintains a turn list. Channel admins use a Telegram Mini App to manage
halaqas, students, attendance and scores.

- `packages/bot`: Telegram handlers and an authenticated HTTP API, running on Workers.
- `packages/db/convex`: the database schema, queries, mutations and access rules.
- `packages/web`: the React admin Mini App, built with Vite.
- `packages/testing`: simulated Telegram, fake name classification and test tools.

PR #165 replaces the previous Docker/long-polling bot. `main` and this PR have
different startup procedures; these instructions apply to the PR.

## Your configured cloud dev environment

Your personal dev deployment is `doting-viper-550` in `Bosla / halaqabotdb`:
[Convex dashboard](https://dashboard.convex.dev/d/doting-viper-550).
Its schema, functions and authentication public key are deployed. Private local
settings are saved in ignored `.env.sim.local` (permissions 600); do not commit
or share that file. `packages/db/.env.local` selects this dev deployment for the
Convex CLI. No production deploy was performed.

From the root, use two terminals:

```bash
# Terminal 1: simulated Telegram and real bot against your cloud dev database
bun run sim:cloud

# Terminal 2: the live Mini App
bun run dev:web:cloud
```

Open **http://127.0.0.1:8790** and refresh if it was already open. The simulator
panel opens beside the Mini App on desktop, or over it on a phone-sized screen.

Try the built-in flow first:

1. Confirm **Acting as** shows `مشرفة سارة · admin`. Click **Chats**.
2. Click **📢 Registration post**. A registration message appears in
   `حلقة القرآن – النقاش` as an automatic forward from the channel.
3. Click **✍️ 3 sign-ups**. Three simulated students reply with their names.
4. Click **👌 Approve all**. Each reply gets an admin's approval reaction.
5. Click **Close** (✕) at the top of the simulator panel to see the Mini App.
   Open **الحلقات**, then the new halaqa. Its turn list should show three
   students: فاطمة احمد, منى علي, and خديجة محمود.
6. Return through the **🤖** bubble. In **Bot activity**, inspect update delivery
   and bot calls. An approval emoji alone is not proof of a database update;
   the Mini App's turn list is the acceptance check.

Then try a manual signup: in **People**, add a new user named `هدى` and act as
her. Return to **Chats**, select `حلقة القرآن – النقاش`, click the forwarded
registration message, choose **↩︎ Reply**, and send `انا هدى سعيد تسميع`.
Switch back to the admin, click that reply, then **👌**.
Verify one additional entry appears. Repeating the same approval should not add
a duplicate. To inspect a separate test, create a fresh registration post.

For access testing, select a student in **People**, close the simulator panel,
and confirm the Mini App shows **غير مصرح**. Select the admin again to continue.

These controls simulate users and Telegram events. They do not contact your real
bot or use real student data. Cloud dev records persist across restarts, while
each restart creates fresh simulated IDs. Browser tests also leave test records
in this dev deployment.

Run the browser acceptance tests with `bun run test:web:cloud`. Keep
`bun run test` for the default in-memory suite. For Convex source changes:

```bash
cd packages/db
CONVEX_DEPLOY_KEY='' bunx convex dev --once
```

The empty deploy-key override uses your existing CLI login and the dev deployment
selected in that directory's `.env.local`, rather than an exported deploy key.
Playwright's matching Chromium headless shell is installed locally. The earlier
`CHROMIUM_PATH` override to an older cached browser has been removed. If testing
another browser binary, set `CHROMIUM_PATH` explicitly for that run.

## Investigating the two cloud test failures manually

Start with your laptop. A phone is not needed to reproduce the import timeout.
Responsive browser mode tests the simulator's narrow layout, but cannot prove
real-phone compatibility.

### Old-post import under rate limits

The separate reproducer leaves the normal simulator on port 8790 unchanged:

```bash
bun --env-file=.env.sim.local packages/testing/scripts/manual-import.ts
```

It starts the separate simulator on port 8791, Worker on 8788 and Mini App on
3001. It creates an old post the bot never received, surrounded by comments,
and prints that run's synthetic `t.me` post link. It reproduces the automated
test's rate limit of two sends per three seconds.

Open http://127.0.0.1:8791, act as the admin, close the simulator panel and use
**الحلقات → إضافة حلقة قديمة**. Paste the printed link into **رابط المنشور**, then
press **إضافة**. Use the link field rather than a discovered-post shortcut,
which bypasses the Telegram search.

Record success, an error, or continued searching at 30, 60, 90 and 180 seconds.
Closing the modal does not cancel the import: also inspect the halaqa list.
Terminal diagnostics count forwarding calls, rate limits and failed jobs.

To compare without throttling, stop only this reproducer and run it again with
`MANUAL_IMPORT_THROTTLED=0` before the command. Use its newly printed link.
Reimporting a successfully imported link does not repeat the failing search.

### Simulator bubble

On port 8790, close the panel and drag the blue bubble across the middle of the
window. It should follow the pointer, then snap to the nearer edge without
opening the panel. Clicking it afterward should open the panel. Repeat both
directions, then repeat in browser responsive mode at 390 × 844, reloading after
changing the viewport. Select a student in **People**, close the panel, and
confirm the Mini App shows **غير مصرح**; switch back to the admin afterward.

The current frontend/API loopback URLs require separate configuration before
a physical phone can connect. Do not open the laptop's `127.0.0.1` URL on a phone.

## 1. Start without accounts

From the repository root:

```bash
bun install --frozen-lockfile
bun run test
bun run sim
```

The test and simulator commands generate missing Convex bindings before importing
the bot. Generation is local; no deploy key, Telegram token or Cloudflare login
is needed. The first install needs packages not already in Bun's local cache.

Open http://127.0.0.1:8790 in your browser. The bot Worker is at
http://127.0.0.1:8787. Its root returns 404: the simulator dashboard is the entry
point. Leave the terminal running; Ctrl+C stops the simulator and Worker.
Restarting this mode creates a fresh in-memory database and Telegram world.

Try this in the simulator dashboard:

1. Select the channel and publish this registration post:
   `حللتم أهلا ونزلتم سهلا 🌸` followed by `سجلي اسمك للحلقة` on a new line.
2. Select its discussion group, act as a student, and reply to the forwarded
   post with `انا فاطمة احمد تسميع`.
3. Switch to an admin and react to that comment with 👌.
4. Inspect the bot activity. The automated tests verify that this produces one
   active turn-list entry with the student's detected name and activity.
5. Try the reaction as a student; it should not grant a place in the list.
6. Send `/admin` to the bot as a channel admin and inspect its panel button.

This mode exercises the real Worker and Convex functions, with simulated external
services. Name detection uses fixed fake rules and makes no paid Groq calls.

## 2. Test the actual Mini App

The in-memory database supports HTTP calls, but the React app also needs Convex's
live WebSocket subscriptions. Therefore the dashboard's Mini App link requires a
real, separate **development** deployment. Creating a local `.env` alone does not
supply this service.

Use a dev deployment with disposable test data. The harness creates records and
does not remove them on exit. Never point `TEST_CONVEX_URL` at production.

Required private local configuration:

- The dev Convex URL and a deploy key scoped to that dev deployment.
- An ES256 signing pair from `packages/bot/scripts/generate-auth-key.ts`.
- The public JWKS configured as `CONVEX_AUTH_JWKS` on that deployment.
- The matching private JWK supplied as `TEST_CONVEX_AUTH_PRIVATE_KEY`.

The key-generation script prints its private key: run it in your own terminal
and save the output privately, never in a commit or PR comment. If setting this
up through the assistant, enter secrets only through its private secret card.

After loading those values privately into your shell, deploy this branch's
functions to **dev** explicitly:

```bash
cd packages/db
CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY_DEV" bunx convex env set CONVEX_AUTH_JWKS "$DEV_CONVEX_AUTH_JWKS"
CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY_DEV" bunx convex dev --once
cd ../..
```

In one terminal, set `TEST_CONVEX_URL` and `TEST_CONVEX_AUTH_PRIVATE_KEY`, then
run `bun run sim`. In another:

```bash
VITE_CONVEX_URL="$TEST_CONVEX_URL" VITE_BOT_API_URL=http://127.0.0.1:8787 bun run dev:web
```

Use “Open Mini App as this user” in the simulator. Opening Vite directly lacks
Telegram-signed login data. Choose an admin to manage halaqas; a student should
have no access to admin data.

With the same test variables available, run browser tests:

```bash
(cd packages/testing && bunx --no-install playwright install chromium)
bun --filter @halakabot/testing test:web
```

Chromium may require a separate download; an existing compatible browser can be
selected with `CHROMIUM_PATH`. These tests do not prove Safari/iOS compatibility.

## 3. Real Telegram staging

After the review findings are resolved, use a separate BotFather test bot, private
test channel plus linked discussion group, scratch forwarding chat, and the dev
database. Set `CHANNEL_ID` and `FORWARD_CHAT_ID` explicitly to those test chats;
the production fallback IDs must not be used for staging.

Copy `packages/bot/.dev.vars.example` to `.dev.vars` in the same directory and
fill in the test values. Run `bun run dev:bot` and `bun run dev:web`. Expose the
Worker and Mini App with HTTPS URLs reachable by Telegram and your phone.
`WEB_APP_URL` must match the Mini App origin; the web build's
`VITE_BOT_API_URL` must point at the exposed Worker. Register the webhook using
the **test** token and explicit URLs (see README). There is no need to move the
production domain to do this.

Phone acceptance checks: open the panel from Telegram's menu and `/admin`, send
the participant list, open/close registration, switch channels, confirm student
access is denied, and check reconnecting after backgrounding the Mini App.

## Build checks

After the test command has generated the local bindings:

```bash
bun run build:db
bun run build:bot
bun run build:web
```

`bun run build` also **deploys Convex**. Use the separate build checks while
reviewing. No production changes are necessary for the local workflow.
