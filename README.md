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
    Queue, which runs one job at a time, so updates are handled in order and
    can take up to 15 minutes (LLM calls, retries).
  - **`/api/*`:** what the web app calls when the bot must act in Telegram:
    sending the list, reacting, opening/closing registration, importing an old
    post. Requests are signed with the Mini App's `initData`, which the Worker
    verifies with the bot token, and the caller must administer the channel.
    Post imports are long, so they run on the queue too.
  - **Cron (hourly):** registers the configured channel and reconciles channel
    admins. Admin changes normally arrive straight away as `chat_member` updates.
- **`packages/db`** holds the Convex schema and functions. Convex never calls
  the bot; the Worker and the web app call Convex.
- **`packages/web`** is the Mini App.

## Development

Prerequisites: [Bun](https://bun.sh/), a Cloudflare account, a Convex project,
and a separate **test bot** from [@BotFather](https://t.me/BotFather), so
setting its webhook doesn't affect the production bot.

1. `bun install`
2. Copy `.env.example` to `.env` (web app) and `packages/bot/.dev.vars.example`
   to `packages/bot/.dev.vars` (Worker), and fill them in.
3. Run the Worker (`bun run dev:bot`, on http://localhost:8787) and the web app
   (`bun run dev:web`).
4. Telegram can't reach localhost. To receive updates, expose the Worker (e.g.
   `cloudflared tunnel --url http://localhost:8787`) and point the test bot at
   it with `bun run webhook:set` from `packages/bot`.

The bot needs reaction updates: either disable privacy mode in @BotFather
(Bot Settings → Group Privacy) or make it an admin.

## Deploying

Run from `packages/bot` unless noted. A paid Workers plan is recommended: the
free plan's 10 ms CPU limit per request is likely too tight for LLM response
parsing and bot startup.

### First deploy (cutover from the Docker bot)

The order matters. The new Worker works with the Convex functions currently
deployed, but the new Convex functions remove what the old web app and the
Docker bot rely on. So the Worker goes first, then Convex and the web app
back-to-back.

1. **Create the queue:** `bunx wrangler queues create halaqabot-jobs`
2. **Set the Worker secrets.** Generate `TELEGRAM_WEBHOOK_SECRET` with
   `openssl rand -hex 32`.
   ```bash
   bunx wrangler secret put BOT_TOKEN
   bunx wrangler secret put GROQ_API_KEY
   bunx wrangler secret put FORWARD_CHAT_ID
   bunx wrangler secret put CONVEX_URL
   bunx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```
   `CHANNEL_ID`, `WEB_APP_URL`, `AUTO_REACTION_EMOJI` and
   `ALLOWED_REACTION_USER_IDS` are optional (defaults in
   `src/config/environment.ts`). `WEB_APP_URL` is also the only origin allowed
   to call `/api/*`.
3. **Deploy the Worker:** `bun run deploy`. Note the `*.workers.dev` URL.
4. **Stop the Docker bot**, then point Telegram at the Worker:
   ```bash
   BOT_TOKEN=... WORKER_URL=https://halaqabot.<account>.workers.dev \
   TELEGRAM_WEBHOOK_SECRET=... bun run webhook:set
   ```
5. **Deploy Convex** (`bun run deploy:convex` from the repo root), then
   immediately **deploy the web app** built with `VITE_BOT_API_URL` set to the
   Worker URL.

Re-run `bun run webhook:set` whenever `ALLOWED_UPDATES` in `src/bot.ts`
changes; Telegram only sends the update types registered with the webhook.

To roll back, redeploy the previous commit's Convex functions and web app, and
start the previous bot.

Logs: `bunx wrangler tail`, or the Workers dashboard (observability is enabled).

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
1. Deploy Convex functions (generates TypeScript types)
2. Build the database package
3. Build the bot package
4. Build the web package
