# HalakaBot

A Telegram bot for running Quran study circles (halaqas), built with
[grammY](https://grammy.dev/) on [Cloudflare Workers](https://developers.cloudflare.com/workers/),
with a Telegram Mini App admin panel. Data lives in [Convex](https://convex.dev).

## How it fits together

```
Telegram ──webhook──▶ Worker /telegram ──▶ Queue ──▶ bot handlers ──▶ Convex
Mini App (web) ──────▶ Worker /api/*   ──▶ Telegram + Convex
Mini App (web) ──────▶ Convex (data, live queries)
```

- **`packages/bot`** is the Worker (`src/worker.ts`):
  - **`POST /telegram`:** Telegram's webhook. Each update goes on a Cloudflare
    Queue that runs one job at a time, so updates are handled in order and
    can take up to 15 minutes (LLM calls, retries).
  - **`/api/*`:** what the web app calls when the bot must act in Telegram:
    sending the list, reacting, opening/closing registration, importing an old
    post. Requests are signed with the Mini App's `initData`, which the Worker
    verifies with the bot token, and the caller must administer the channel.
    Post imports are long, so they run on a queue of their own.
  - **Cron (hourly):** registers the configured channel and reconciles channel
    admins. Admin changes normally arrive straight away as `chat_member` updates.
- **`packages/db`** holds the Convex schema and functions. Convex never calls
  the bot; the Worker and the web app call Convex.
- **`packages/web`** is the Mini App.

## Development

Prerequisites: [Bun](https://bun.sh/). Run `bun install` first.

### With the Telegram simulator (no Telegram, no accounts)

```bash
bun run sim
```

This starts the bot Worker (real `wrangler dev`, with local queues) against a
simulated Telegram, a fake Groq and an in-memory Convex. Open
http://127.0.0.1:8790 for the simulator's dashboard: act as any user, publish a
registration post, comment, react 👌, message the bot, promote admins. See
`packages/testing/README.md` for how it works and what it doesn't simulate.

To use the web app too, it needs a real Convex dev deployment (its live queries
use Convex's WebSocket protocol, which the in-memory one doesn't speak):

```bash
(cd packages/db && CONVEX_DEPLOY_KEY=<dev key> bunx convex dev --once)
TEST_CONVEX_URL=https://<dev>.convex.cloud bun run sim
VITE_CONVEX_URL=https://<dev>.convex.cloud VITE_BOT_API_URL=http://127.0.0.1:8787 bun run dev:web
```

then use "Open Mini App as this user" in the dashboard.

### With real Telegram

You'll need a Cloudflare account, a Convex project and a separate **test bot**
from [@BotFather](https://t.me/BotFather), so setting its webhook doesn't affect
the production bot.

1. Copy `.env.example` to `.env` (web app) and `packages/bot/.dev.vars.example`
   to `packages/bot/.dev.vars` (Worker), and fill them in.
2. Run the Worker (`bun run dev:bot`, on http://localhost:8787) and the web app
   (`bun run dev:web`).
3. Telegram can't reach localhost. To receive updates, expose the Worker (e.g.
   `cloudflared tunnel --url http://localhost:8787`) and point the test bot at
   it with `bun run webhook:set` from `packages/bot`.

The bot needs reaction updates: either disable privacy mode in @BotFather
(Bot Settings → Group Privacy) or make it an admin.

## Testing

```bash
bun run test
```

Runs, in about 20 seconds and with nothing external:

- **Scenarios** (`packages/testing/test/telegram-flow.test.ts`,
  `web-api.test.ts`, `edge-cases.test.ts`): the real Worker under `wrangler
  dev` (workerd + local queues), the real Convex functions (in memory, via
  `convex-test`), a simulated Telegram and a fake Groq. They cover registration
  posts, adding students with 👌 (also from nested replies, and when the
  reaction arrives before the message), `/admin`, `/auto`, admin changes, the
  bot being added or removed, the web API's authentication, sending the list,
  registration, reactions, name detection and post imports, and that
  anonymous admins and channels are never added as students.
- **Simulator and auth checks** (`simulator.test.ts`): that the simulated
  Telegram behaves like Telegram where the bot depends on it (update filtering,
  ordering, retries, forwarding), plus Mini App signature verification checked
  against an independent implementation.

The same scenarios run against a real Convex dev deployment with
`TEST_CONVEX_URL=https://<dev>.convex.cloud bun run test`, and
`TEST_CONVEX_URL=... bun --filter @halakabot/testing test:web` also drives
the real web app in a browser (Playwright): an admin opens the Mini App through
simulated Telegram and sends the list.

## Deploying

Run from `packages/bot` unless noted.

**Plan and cost.** Use the Workers Paid plan: the free plan's 10 ms CPU limit
per request is likely too tight for LLM response parsing and bot startup. Each
Telegram update costs about three Queues operations (write, read, ack), plus
Workers requests and Convex calls; check Cloudflare's current Queues pricing
against your message volume.

### First deploy (cutover from the Docker bot)

The order matters. The new Worker works with the Convex functions currently
deployed, but the new Convex functions remove what the old web app and the
Docker bot rely on. So the Worker goes first, then Convex and the web app
back-to-back.

1. **Create the queues:**
   ```bash
   bunx wrangler queues create halaqabot-updates
   bunx wrangler queues create halaqabot-imports
   bunx wrangler queues create halaqabot-dead-letters
   ```
   The dead-letter queue keeps batches the consumer itself couldn't run
   (e.g. Telegram's `getMe` failing) instead of dropping them.
2. **Set the Worker secrets.** Generate `TELEGRAM_WEBHOOK_SECRET` with
   `openssl rand -hex 32`.
   ```bash
   bunx wrangler secret put BOT_TOKEN
   bunx wrangler secret put GROQ_API_KEY
   bunx wrangler secret put FORWARD_CHAT_ID
   bunx wrangler secret put CONVEX_URL
   bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```
   `CHANNEL_ID`, `WEB_APP_URL` and `AUTO_REACTION_EMOJI` are optional
   (defaults in `src/config/environment.ts`). `WEB_APP_URL` must be the exact
   origin the web app is served from: it's the only origin allowed to call
   `/api/*`.
3. **Deploy the Worker:** `bun run deploy`. Note the `*.workers.dev` URL.
4. **Stop the Docker bot**, then point Telegram at the Worker:
   ```bash
   BOT_TOKEN=... WORKER_URL=https://halaqabot.<account>.workers.dev \
   TELEGRAM_WEBHOOK_SECRET=... bun run webhook:set
   ```
5. **Deploy Convex** (`bun run deploy:convex` from the repo root), then
   immediately **deploy the web app** built with `VITE_BOT_API_URL` set to the
   Worker URL. Set it wherever your web host supplies `VITE_CONVEX_URL` at
   build time; it's read when Vite builds the app. (The web `Dockerfile`
   declares no build args, so if you build that image, pass both the way you
   pass `VITE_CONVEX_URL` today.) A web app built without it shows an error
   for every action that goes through the bot.

Re-run `bun run webhook:set` whenever `ALLOWED_UPDATES` in `src/bot.ts`
changes; Telegram only sends the update types registered with the webhook.

To roll back:

1. Take the Worker out: `bunx wrangler delete` (removes its routes, queue
   consumers and cron), or at least remove its cron trigger.
2. Redeploy the previous commit's Convex functions and web app.
3. Start the previous Docker bot. It deletes the webhook on start, but with
   `drop_pending_updates`, so updates Telegram was holding are lost.

Logs: `bunx wrangler tail`, or the Workers dashboard (observability is enabled).

### Previews

A preview runs the whole system without touching real Telegram: the Telegram
simulator deployed as a Worker, a preview of the bot pointed at it, a Convex
dev or preview deployment, and the web app built against both.

1. **Simulator** (from `packages/testing`): set its secrets, then deploy.
   `SIM_BOT_TOKEN` is any `<digits>:<text>`; `SIM_CONTROL_TOKEN` protects its
   control API and dashboard.
   ```bash
   bunx wrangler secret put SIM_BOT_TOKEN
   bunx wrangler secret put SIM_CONTROL_TOKEN
   bun run deploy
   ```
2. **Bot preview** (from `packages/bot`): create the preview queues
   (`halaqabot-preview-updates`, `halaqabot-preview-imports`,
   `halaqabot-preview-dead-letters`), then set its secrets with
   `bunx wrangler secret put <NAME> --env preview`:

   | Secret | Value |
   | --- | --- |
   | `BOT_TOKEN` | the simulator's `SIM_BOT_TOKEN` |
   | `TELEGRAM_API_ROOT` | `https://halaqabot-telegram-sim.<account>.workers.dev` |
   | `GROQ_BASE_URL` | the same, plus `/groq/openai/v1` |
   | `GROQ_API_KEY` | anything (the fake Groq ignores it) |
   | `CONVEX_URL` | the dev or preview Convex deployment |
   | `TELEGRAM_WEBHOOK_SECRET` | a random string |
   | `CHANNEL_ID` | `-1001000000001` (the simulated channel) |
   | `FORWARD_CHAT_ID` | `-1001000000003` (the simulated scratch group) |
   | `WEB_APP_URL` | the preview web app's origin |

   Then `bun run deploy:preview` and point the simulator at it:
   ```bash
   BOT_TOKEN=<SIM_BOT_TOKEN> WORKER_URL=https://halaqabot-preview.<account>.workers.dev \
   TELEGRAM_WEBHOOK_SECRET=... WEB_APP_URL=<preview web app> \
   TELEGRAM_API_ROOT=https://halaqabot-telegram-sim.<account>.workers.dev \
   bun run webhook:set
   ```
3. **Web app**: build it with `VITE_CONVEX_URL` (the preview deployment) and
   `VITE_BOT_API_URL` (the bot preview's URL), deploy it wherever previews go,
   and set the simulator's `SIM_WEB_APP_URL` var to it so its dashboard can
   open the Mini App.

The simulator keeps its world in a Durable Object's storage, so it survives
idle periods. `POST /sim/reset` starts a fresh one (and forgets the webhook:
run `webhook:set` again). Use long random values for `SIM_BOT_TOKEN` and
`SIM_CONTROL_TOKEN`: the control token is all that stands between the
internet and driving the preview bot.

### Web app CI/CD (Netlify, Vercel, etc.)

The project uses Convex for the database, which requires deploying functions before building. The build process automatically handles this.

**Required Environment Variables for CI:**
- `CONVEX_DEPLOY_KEY` - Deploy key from your Convex dashboard
- `VITE_CONVEX_URL` - Your Convex deployment URL
- `VITE_BOT_API_URL` - The bot Worker's URL

**Getting your Convex Deploy Key:**
1. Go to your Convex dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to Settings > Deploy Keys
4. Generate a new deploy key
5. Add it to your CI environment variables as `CONVEX_DEPLOY_KEY`

**Build Command:**
```bash
bun run build
```

This will:
1. Deploy Convex functions to the deployment `CONVEX_DEPLOY_KEY` points at
   (and generate their TypeScript types)
2. Typecheck the database package
3. Typecheck the bot package
4. Build the web package

The bot itself is deployed separately (`bun run deploy:bot`); `bun run test`
is the check to run in CI before deploying it.
