/**
 * Cloudflare Workers entry point.
 *
 *   POST /telegram  Telegram webhook. Acknowledged at once; the update is handled
 *                   in waitUntil so slow work (LLM calls, retries) never makes
 *                   Telegram time out and redeliver it.
 *   POST /tasks     Called by Convex when the web app queues a bot task (see
 *                   convex/botTaskQueue.ts). The queue is drained before
 *                   responding: Convex holds the request open, which allows far
 *                   longer than waitUntil would — post imports need it.
 *   scheduled       Cron Trigger: registers the configured channel and syncs
 *                   channel admins.
 */
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { InputFile } from "grammy";
import type { Update } from "grammy/types";
import registrationClosedImage from "../assets/registration-closed.jpeg";
import { loadConfig } from "./config/environment";
import { createBotApp, syncChannels, type BotApp } from "./bot";

export interface Env {
  BOT_TOKEN: string;
  GROQ_API_KEY: string;
  FORWARD_CHAT_ID: string;
  CONVEX_URL: string;
  /** Sent by Telegram on every webhook call; set with scripts/set-webhook.ts. */
  TELEGRAM_WEBHOOK_SECRET: string;
  /** Shared with the Convex deployment, which sends it to /tasks. */
  BOT_TASKS_SECRET: string;
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

/** Compares secrets without leaking how much of the guess matched. */
function secretMatches(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected || received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

async function handleTelegramUpdate(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!secretMatches(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await request.json()) as Update;
  const { bot } = getApp(env);

  ctx.waitUntil(
    (async () => {
      await initBot(bot);
      await bot.handleUpdate(update);
    })().catch((error) => {
      console.error("Bot error:", error);
    }),
  );

  return new Response("OK");
}

async function handleTasks(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  if (!secretMatches(token, env.BOT_TASKS_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const processed = await getApp(env).botTaskService.drain();
    return Response.json({ processed });
  } catch (error) {
    console.error("Error processing bot tasks:", error);
    return new Response("Error processing bot tasks", { status: 500 });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/telegram") {
      return handleTelegramUpdate(request, env, ctx);
    }
    if (request.method === "POST" && pathname === "/tasks") {
      return handleTasks(request, env);
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncChannels(getApp(env));
  },
};
