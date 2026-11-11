# Moving the bot to Cloudflare Workers

Decision record for the migration from the long-running Bun bot (last at
`43ecf7f`) to Cloudflare Workers: what changed, the evidence that it works, and
where the old design was better.

## What the old system was

- One Bun process in Docker, polling Telegram with grammY's `bot.start()`, so
  updates were handled one at a time.
- Work from the web app (sending the list, reactions, imports) went through a
  `botTasks` table in Convex. The bot watched it over a Convex WebSocket
  subscription, because a polling bot has no address anyone can call.
- Channel admins were re-read from Telegram every 5 minutes (`setInterval`).
- Convex was self-hosted alongside it at first, later Convex Cloud.

## What it is now

```
Telegram ──webhook──▶ Worker /telegram ──▶ Queue "updates" (one at a time) ──▶ handlers ──▶ Convex
Mini App ───────────▶ Worker /api/*    ──▶ Telegram + Convex  (long imports → Queue "imports")
Mini App ───────────▶ Convex (data, live queries)
Cron (hourly) ──────▶ admin reconciliation; chat_member updates do it live
```

- **Telegram updates** reach a webhook (`max_connections: 1`) that only enqueues
  them. A queue consumer with concurrency 1 handles them in order, with up to
  15 minutes per update.
- **The web app calls the Worker directly.** Requests are signed with the Mini
  App's `initData`, which the Worker verifies against the bot token, and the
  caller must administer the channel. Convex never calls the bot, and the
  `botTasks` queue is gone.
- **Recoverable failures** are handled in the platform rather than in handler
  code:
  - a reaction that arrives before its message goes back on the queue with a
    delay;
  - Telegram's rate limits and 5xx errors are retried by grammY's auto-retry:
    up to a minute for queue jobs, briefly for web requests. Network
    failures fail fast instead, since the call may already have taken effect
    and retrying would hold up the queue;
  - batches the consumer can't run land in a dead-letter queue.
- **Admin access follows Telegram live**, via `chat_member` updates, with an
  hourly reconciliation.

## Evidence

### Same behaviour where it should be the same

`packages/testing` runs either bot against a simulated Telegram, a fake LLM and
the real Convex functions. The same scenarios were run against the old bot
(Bun, long polling, its own Convex functions; one test-only change pointing
grammY at the simulator) and the new one (Workers runtime, local queues):

| Scenario | Old bot | New bot |
| --- | --- | --- |
| Registration post is registered | ✅ | ✅ |
| 👌 right after a self-introduction adds the student, with name and activity | ✅ | ✅ |
| 👌 from a non-admin is ignored | ✅ | ✅ |
| 👌 on a message without a name is ignored | ✅ | ✅ |
| A second emoji next to 👌 doesn't add twice | ✅ | ✅ |
| Burst: 8 introductions, each 👌'd at once | ✅ 206 ms | ✅ 613 ms |
| 👌 arrives before the message itself | ❌ student lost | ✅ added (≈2 s) |
| `/admin` from a channel admin | ❌ no reply | ✅ panel button |
| Promoted to channel admin → web app access | ⏳ up to 5 min | ✅ ≈0.1 s |

Beyond parity, the new bot has 62 automated tests (`bun run test`). Against
the in-memory Convex, 60 run and pass; the other 2 are browser tests that need
a real deployment. Against a real Convex dev deployment, 60 pass, including
the browser tests that drive the real web app through simulated Telegram; the
2 that need the in-memory Convex's outage switch and call counter are skipped.
They cover:

- the core Telegram flows, and the web API's authentication and every action;
- post imports, including protected channels and imports under rate limits;
- Telegram being rate-limited or unreachable, and a Convex outage;
- the bot being added or removed, and channels discovered from traffic;
- `/auto`, nested replies, and anonymous-admin and channel senders;
- the subrequest budget.

Three bugs were reintroduced on purpose to check the tests catch them, and
each one broke the suite.

### Bugs the old design had, found along the way

All of these were present in the old bot. Each is fixed and covered by a test:

1. **`/admin` never replied** (since #111). A catch-all message handler was
   registered first and never passed messages on.
2. **A 👌 that arrived before its message was lost.** The reaction handler slept
   and re-checked, but sequential processing meant the message it waited for
   was queued behind it, so the wait couldn't succeed and every later update
   stalled 3.5 s.
3. **A rate-limited post import reported "post not found".** Probes forward
   messages into a scratch group, Telegram allows about 20 a minute there, and
   a 429 looked like a missing message. Short limits are now waited out; a
   longer one is reported as Telegram limiting the bot.
4. **Removing the bot never deactivated the channel.** That path called
   `getChat`, which Telegram refuses once the bot is out.
5. **`/auto` had no permission check.** Any group member could start a paid LLM
   batch and add people to the list.
6. **Anonymous-admin or "as a channel" comments could put GroupAnonymousBot or
   Channel_Bot on the turn list.**
7. **The task subscription was fragile.** A dropped-update bug in it was fixed
   just before the migration (`d5f5fee`), and the mechanism is now gone.
8. **The root build was broken by type errors** in the bot and Convex packages.

### Security

The old web app trusted the Telegram user ID it was handed (`initDataUnsafe`),
and every Convex function answered anyone with the deployment's URL. Now:

- **The Worker's API** verifies Telegram's signature and the caller's admin
  rights before acting, which the old task table never could.
- **Convex** accepts only JWTs the Worker signs (ES256; the public key reaches
  Convex as a `data:` URI, so Convex never calls the Worker). The bot signs one
  for itself. A Mini App user gets one from `/api/auth/token` after their
  `initData` is verified.
- **Every public function checks its caller** (`convex/auth.ts`). Some are
  bot-only, such as registering channels and syncing admins. The others need an
  admin of the channel the chat or row belongs to. A test fails if a public
  function doesn't start with a check.
- **Each admin is confined to their own channel.** This matters because anyone
  can become an admin of *some* channel, just by adding the bot to one of their
  own.
  - A student's profile, history, and the rename action are reachable only
    through a chat the caller administers that the student belongs to.
  - Search is per chat.
  - Only the LLM score matcher just needs "an admin somewhere", and it touches
    no data.
  - Admins of the same channel share everything in it.

## Where the old design was better

- **Simplicity.** One process with `setInterval` and in-memory state. The new one
  has a webhook, two queues, a dead-letter queue, a cron, an HTTP API and
  per-request construction rules: more parts, each simple, but more to learn.
- **Latency.** Each update now takes a queue hop. Locally that's about 50 ms per
  update (the burst above: 206 ms versus 613 ms). On Cloudflare it's
  typically more. A list being sent from the web app doesn't take the hop; a
  👌 does.
- **No platform limits.** Workers cap outbound calls per invocation (1,000 on the
  paid plan). Measured: `/auto` costs about 6 per student, so roughly 160
  students in one run. Queue messages are capped at 128 KB, and the free plan's
  CPU limit is too tight, so the paid plan is needed.
- **Portability.** Queues, cron triggers and Durable Objects (for previews) tie
  the bot to Cloudflare.
- **Ordering is best-effort.** Polling was strictly ordered; Cloudflare Queues
  usually is, and the reaction requeue covers the case that matters.

## Why Workers anyway

- **There's nothing to keep alive:** no server, container, restart policy or
  WebSocket subscription. Deploys and rollbacks are one command.
- **Failure handling moves into the platform:** queue retries with delay, a
  dead-letter queue, and an at-least-once webhook with a fast acknowledgement.
- **There's now an authenticated API between the web app and the bot,** where
  before the web app wrote rows into a public table.
- **The bot is testable end to end without Telegram,** and previews can run
  against the simulator.

Most of the behavioural fixes above would also apply to a server. The
platform-specific gains are operational, so a well-run server would also have
been a reasonable choice at this scale. The deciding factors are that nobody
has to operate anything and that the failure handling comes from the
platform, not hand-written loops.

## Not yet verified

- **A run against real Telegram and a real Cloudflare deployment.** Everything
  above ran locally: the Workers runtime under `wrangler dev`, simulated
  Telegram, and real and in-memory Convex. Telegram behaviours the simulator
  doesn't model are listed in `packages/testing/README.md`.
- **Real queue latency and ordering** under Cloudflare.
