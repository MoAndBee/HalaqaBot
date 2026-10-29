/**
 * Cloudflare Workers entry point.
 *
 *   POST /telegram  Telegram webhook. The update is put on the job queue and
 *                   acknowledged at once, so slow handlers (LLM calls, retries)
 *                   never make Telegram time out and redeliver.
 *   /api/*          The web app's calls to act in Telegram (see api.ts).
 *   queue           Consumer for the job queue (see jobs.ts).
 *   scheduled       Cron Trigger: registers the configured channel and
 *                   reconciles channel admins, in case a chat_member update
 *                   was missed.
 */
import type { ExecutionContext, MessageBatch, Queue, ScheduledController } from "@cloudflare/workers-types";
import { InputFile } from "grammy";
import type { Update } from "grammy/types";
import registrationClosedImage from "../assets/registration-closed.jpeg";
import { loadConfig } from "./config/environment";
import { createBotApp, syncChannels, type BotApp } from "./bot";
import { handleApiRequest } from "./api";
import { runJob, type BotJob } from "./jobs";
import { timingSafeEqual } from "./telegram-auth";

export interface Env {
  JOBS: Queue<BotJob>;
  BOT_TOKEN: string;
  GROQ_API_KEY: string;
  FORWARD_CHAT_ID: string;
  CONVEX_URL: string;
  /** Sent by Telegram on every webhook call; set with scripts/set-webhook.ts. */
  TELEGRAM_WEBHOOK_SECRET: string;
  CHANNEL_ID?: string;
  WEB_APP_URL?: string;
  AUTO_REACTION_EMOJI?: string;
  ALLOWED_REACTION_USER_IDS?: string;
}

// One bot per isolate: handlers and services are wired once, then reused by
// every request the isolate serves.
let app: BotApp | undefined;
let botInit: Promise<void> | undefined;

function getApp(env: Env): BotApp {
  app ??= createBotApp(loadConfig({ ...env }), {
    registrationClosedPhoto: () =>
      new InputFile(new Uint8Array(registrationClosedImage), "registration-closed.jpeg"),
  });
  return app;
}

/** grammY needs the bot's own info (getMe) before it can route updates. */
function initBot(bot: BotApp["bot"]): Promise<void> {
  botInit ??= bot.init().catch((error) => {
    botInit = undefined;
    throw error;
  });
  return botInit;
}

async function handleTelegramUpdate(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!env.TELEGRAM_WEBHOOK_SECRET || !timingSafeEqual(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await request.json()) as Update;
  // If this fails Telegram gets an error and redelivers, so nothing is lost.
  await env.JOBS.send({ type: "update", update });
  return new Response("OK");
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/telegram") {
      return handleTelegramUpdate(request, env);
    }
    if (pathname.startsWith("/api/")) {
      return handleApiRequest(request, {
        app: getApp(env),
        enqueue: async (job) => {
          await env.JOBS.send(job);
        },
      });
    }
    return new Response("Not found", { status: 404 });
  },

  async queue(batch: MessageBatch<BotJob>, env: Env, _ctx: ExecutionContext): Promise<void> {
    const app = getApp(env);
    await initBot(app.bot);

    for (const message of batch.messages) {
      try {
        await runJob(app, message.body);
      } catch (error) {
        // Like long polling: a failed update is logged and skipped rather than
        // retried, since handlers aren't safe to run twice. The queue only
        // redelivers if the consumer itself dies mid-batch.
        console.error(`❌ ${message.body.type} job failed:`, error);
      }
      message.ack();
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncChannels(getApp(env));
  },
};
