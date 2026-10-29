# @halakabot/testing

Everything needed to run and test the bot with nothing external: a simulated
Telegram, a fake Groq, the real Convex functions in memory, and a harness that
wires them to the real bot Worker running under `wrangler dev`.

```
                 webhook (secret header, max_connections, retries)
 TelegramSimulator ─────────────────────────────▶ bot Worker (wrangler dev)
   │  ▲  Bot API: /bot<token>/<method>  ◀───────── │  queues: updates, imports
   │  └──────────────────────────────────────────  │
   │     fake Groq: /groq/openai/v1/...  ◀──────── │
   │                                               ▼
 dashboard / control API (/sim/*)          Convex: in-memory emulator
                                           (or a real deployment)
```

| File | What it is |
| --- | --- |
| `src/telegram/simulator.ts` | The simulated Telegram: users, channels with discussion groups, messages, reactions, membership, the Bot API methods the bot calls, webhook delivery. Runtime-neutral (fetch + Web Crypto). |
| `src/telegram/server.ts` | Its HTTP front: Bot API, fake Groq, `/sim/*` control API, dashboard. |
| `src/telegram/dashboard.ts` | The dashboard: act as any user in any chat. |
| `src/telegram/init-data.ts` | Signs Mini App `initData` the way Telegram does. |
| `src/fake-groq.ts` | Deterministic stand-in for the LLM classifier. |
| `src/convex-emulator.ts` | `packages/db/convex` run by `convex-test`, served over Convex's HTTP API. |
| `src/harness.ts` | `startStack()`: starts all of the above plus `wrangler dev`, sets the webhook with the bot's own `configureTelegram()`, runs the cron once. |
| `src/world.ts` | The standard cast: an owner, an admin, three students, a channel and its group. |
| `src/cli.ts` | `bun run sim`. |
| `src/sim-worker.ts` | The simulator as a Worker + Durable Object, for previews. |

## Commands

```bash
bun run test        # scenario + simulator tests (in-memory Convex)
bun run sim         # the stack plus dashboard at http://127.0.0.1:8790
TEST_CONVEX_URL=https://<dev>.convex.cloud bun run test      # against real Convex
TEST_CONVEX_URL=https://<dev>.convex.cloud bun run test:web  # + the web app in a browser
```

Against a real deployment, push this branch's functions there first
(`CONVEX_DEPLOY_KEY=<dev key> bunx convex dev --once` in `packages/db`). Each
run uses fresh user and chat IDs, so leftover data from earlier runs doesn't
interfere. `test:web` uses Playwright's Chromium; set `CHROMIUM_PATH` to use
another browser binary.

## Writing a scenario

```ts
const stack = await startStack();
const { sim, world } = stack;

// Act in Telegram…
const { groupMessage } = sim.postToChannel(world.channelId, "حللتم أهلا …");
const comment = sim.sendUserMessage(world.groupId, world.students[0].id, "انا فاطمة احمد", {
  replyTo: groupMessage.message_id,
});
sim.react(world.groupId, comment.message_id, world.admin.id, ["👌"]);

// …or call the web API as an admin…
await stack.callApi("/api/participant-list", { chatId: world.groupId, postId }, { as: world.admin.id });

// …then assert on Telegram (sim.history, sim.botReactionsOn) or Convex
// (stack.query / stack.mutation), waiting for the bot with stack.waitFor or
// stack.settle.
```

## Fake Groq rules

- **activity:** a word starting تسم/تثم → تسميع, starting تلا/طلا → تلاوة
- **name:** after dropping the activity word, انا/أنا/اسمي and punctuation, 2–4
  Arabic words remain, and the message isn't a question, a blessing or a
  thank-you (contains ؟/? or يا, or starts with هل/فين/جزاك/ربنا/شكرا).

## What the simulator doesn't model

It covers what the bot uses today. Not simulated, so not covered by these tests:

- **Unused Bot API methods** (they fail with "method not found", so a new call
  shows up quickly) and `getUpdates` (long polling).
- **Message edits, media groups, forum topics, anonymous admins** posting as the
  group, and service messages.
- **Rate limits** (429 / `retry_after`) and Telegram's real flood behaviour.
- **File downloads.** Uploaded photos are only measured.
- **Exact error texts** beyond the ones listed in `simulator.ts`.
- **Real LLM classification quality.** The fake rules only check the plumbing.
- **The web app's live data** only works against a real Convex deployment,
  since the in-memory emulator speaks Convex's HTTP API, not its WebSocket sync
  protocol.
