/**
 * Cloudflare Workers entry point.
 *
 *   POST /telegram  Telegram webhook. The update is put on the updates queue and
 *                   acknowledged at once, so slow handlers (LLM calls, retries)
 *                   never make Telegram time out and redeliver.
 *   /api/*          The web app's calls to act in Telegram (see api.ts).
 *   queue           Consumer for the updates and imports queues (see jobs.ts).
 *   scheduled       Cron Trigger: registers the configured channel and
 *                   reconciles channel admins, in case a chat_member update
 *                   was missed.
 *
 * A Worker Preview (PREVIEW_WORKER_NAME set; see preview.ts) has no queue
 * consumer or cron, so it handles each update inside the webhook request. The
 * Telegram simulator delivers one update at a time and waits for the answer,
 * which keeps updates in order.
 */
import type { ExecutionContext, MessageBatch, Queue, ScheduledController } from "@cloudflare/workers-types";
import { BotError, InputFile } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import registrationClosedImage from "../assets/registration-closed.jpeg";
import { loadConfig, type Config } from "./config/environment";
import { API_RETRY, QUEUE_RETRY, createBotApp, syncChannels, type BotApp, type TelegramRetryPolicy } from "./bot";
import { handleApiRequest } from "./api";
import { describeJob, runJob, type BotJob } from "./jobs";
import { timingSafeEqual } from "./telegram-auth";
import { RetryLater } from "./errors";
import { siblingPreviewOrigin } from "./preview";
import { BOT_SUBJECT, importSigningKey, signToken, type SignedToken } from "./convex-auth";

/** Times an update may be put back on the queue (see RetryLater); matches max_retries. */
const RETRY_LATER_ATTEMPTS = 2;

export interface Env {
  UPDATES: Queue<BotJob>;
  IMPORTS: Queue<BotJob>;
  BOT_TOKEN: string;
  GROQ_API_KEY: string;
  FORWARD_CHAT_ID: string;
  CONVEX_URL: string;
  /** Sent by Telegram on every webhook call; set with scripts/set-webhook.ts. */
  TELEGRAM_WEBHOOK_SECRET: string;
  /** Signs Convex tokens; see scripts/generate-auth-key.ts. */
  CONVEX_AUTH_PRIVATE_KEY: string;
  CHANNEL_ID?: string;
  WEB_APP_URL?: string;
  AUTO_REACTION_EMOJI?: string;
  ALLOWED_REACTION_USER_IDS?: string;
  TELEGRAM_API_ROOT?: string;
  GROQ_BASE_URL?: string;
  /** Set in a Worker Preview: this Worker's name, e.g. "halaqabot". */
  PREVIEW_WORKER_NAME?: string;
  /** The simulator Worker whose Preview of the same branch stands in for Telegram. */
  PREVIEW_SIMULATOR_NAME?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * In a Preview, the simulator and this Worker's own origin (for CORS) come from
 * the request URL, unless set explicitly (as `preview.ts local` does).
 */
function withPreviewSettings(env: Env, requestUrl: string): Env {
  if (!env.PREVIEW_WORKER_NAME) return env;
  const simulator =
    env.TELEGRAM_API_ROOT ??
    siblingPreviewOrigin(requestUrl, env.PREVIEW_WORKER_NAME, env.PREVIEW_SIMULATOR_NAME ?? "halaqabot-sim") ??
    undefined;
  return {
    ...env,
    TELEGRAM_API_ROOT: simulator,
    GROQ_BASE_URL: env.GROQ_BASE_URL ?? (simulator ? `${simulator}/groq/openai/v1` : undefined),
    WEB_APP_URL: env.WEB_APP_URL ?? new URL(requestUrl).origin,
  };
}

// The app is built for each request and queue batch, never shared: objects that
// do I/O must not outlive the request that uses them (Convex's HTTP client, for
// one, queues mutations, and another request's promise would hang this one).
// Only plain data is cached across requests in an isolate.
let botInfo: UserFromGetMe | undefined;
let botToken: SignedToken | undefined;

/** The bot's Convex token, reused until a few minutes before it expires. */
async function convexToken(config: Config): Promise<string> {
  if (!botToken || botToken.expiresAt - Date.now() / 1000 < 5 * 60) {
    botToken = await signToken(await importSigningKey(config.convexAuthKey), BOT_SUBJECT, 60 * 60);
  }
  return botToken.token;
}

async function createApp(env: Env, retry: TelegramRetryPolicy): Promise<BotApp> {
  const config = loadConfig({ ...env });
  return createBotApp(config, {
    convexToken: await convexToken(config),
    botInfo,
    retry,
    registrationClosedPhoto: () =>
      new InputFile(new Uint8Array(registrationClosedImage), "registration-closed.jpeg"),
  });
}

/** grammY needs the bot's own info (getMe) before it can route updates. */
async function initBot(bot: BotApp["bot"]): Promise<void> {
  if (botInfo) return;
  await bot.init();
  botInfo = bot.botInfo;
}

async function handleTelegramUpdate(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!env.TELEGRAM_WEBHOOK_SECRET || !timingSafeEqual(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await request.json()) as Update;
  if (env.PREVIEW_WORKER_NAME) {
    await runNow(env, { type: "update", update });
    return new Response("OK");
  }
  // If this fails Telegram gets an error and redelivers, so nothing is lost.
  await env.UPDATES.send({ type: "update", update });
  return new Response("OK");
}

/**
 * A job run right away rather than from a queue (Previews only), with the
 * queue's behaviour: a RetryLater waits and tries again, a failure is logged.
 */
async function runNow(env: Env, job: BotJob): Promise<void> {
  const app = await createApp(env, QUEUE_RETRY);
  await initBot(app.bot);
  for (let attempt = 1; ; attempt++) {
    try {
      await runJob(app, job);
      console.log(`job done: ${describeJob(job)}`);
      return;
    } catch (error) {
      const cause = error instanceof BotError ? error.error : error;
      if (cause instanceof RetryLater && attempt <= RETRY_LATER_ATTEMPTS) {
        console.log(`job deferred: ${describeJob(job)} (${cause.message})`);
        await sleep(2_000 * attempt);
        continue;
      }
      console.error(`❌ job failed: ${describeJob(job)}`, error);
      return;
    }
  }
}

export default {
  async fetch(request: Request, baseEnv: Env, ctx: ExecutionContext): Promise<Response> {
    const env = withPreviewSettings(baseEnv, request.url);
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/telegram") {
      return handleTelegramUpdate(request, env);
    }
    if (pathname.startsWith("/api/")) {
      return handleApiRequest(request, {
        app: await createApp(env, API_RETRY),
        enqueue: async (job) => {
          // A Preview has no queue consumer: run the job after answering.
          if (env.PREVIEW_WORKER_NAME) ctx.waitUntil(runNow(env, job));
          else await (job.type === "update" ? env.UPDATES : env.IMPORTS).send(job);
        },
        waitUntil: (promise) => ctx.waitUntil(promise),
      });
    }
    // What a Preview's smoke test needs to know (nothing secret).
    if (env.PREVIEW_WORKER_NAME && pathname === "/preview/info") {
      return Response.json({ convexUrl: env.CONVEX_URL, simulator: env.TELEGRAM_API_ROOT ?? null });
    }
    return new Response("Not found", { status: 404 });
  },

  async queue(batch: MessageBatch<BotJob>, env: Env, _ctx: ExecutionContext): Promise<void> {
    const app = await createApp(env, QUEUE_RETRY);
    await initBot(app.bot);

    for (const message of batch.messages) {
      try {
        await runJob(app, message.body);
        console.log(`job done: ${describeJob(message.body)}`);
      } catch (error) {
        const cause = error instanceof BotError ? error.error : error;
        if (cause instanceof RetryLater) {
          if (message.attempts <= RETRY_LATER_ATTEMPTS) {
            console.log(`job deferred: ${describeJob(message.body)} (${cause.message})`);
            message.retry({ delaySeconds: 2 * message.attempts });
            continue;
          }
          console.log(`job done: ${describeJob(message.body)} (gave up: ${cause.message})`);
          message.ack();
          continue;
        }
        // Like long polling: a failed update is logged and skipped rather than
        // retried, since handlers aren't safe to run twice. The queue only
        // redelivers if the consumer itself dies mid-batch.
        console.error(`❌ job failed: ${describeJob(message.body)}`, error);
      }
      message.ack();
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncChannels(await createApp(env, QUEUE_RETRY));
  },
};
