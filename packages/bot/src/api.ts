/**
 * HTTP API the web app (a Telegram Mini App) calls to make the bot act in
 * Telegram. Every request carries the Mini App's signed initData
 * (`Authorization: tma <initData>`), which identifies the admin; they may only
 * act on chats linked to a channel they administer.
 */
import { z } from "zod";
import { api, ConvexError } from "@halakabot/db";
import type { BotApp } from "./bot";
import type { BotJob } from "./jobs";
import { UserFacingError } from "./errors";
import { verifyInitData, type TelegramWebAppUser } from "./telegram-auth";

export interface ApiDeps {
  app: BotApp;
  enqueue: (job: BotJob) => Promise<void>;
  /** Keeps work running if the client disconnects (ExecutionContext.waitUntil). */
  waitUntil: (promise: Promise<unknown>) => void;
}

const chatPost = { chatId: z.number().int(), postId: z.number().int() };

const schemas = {
  "/api/participant-list": z.object({
    ...chatPost,
    sessionNumber: z.number().int().optional(),
    flower: z.string().max(16).optional(),
  }),
  "/api/react": z.object({ ...chatPost, messageId: z.number().int() }),
  "/api/detect-name": z.object({ ...chatPost, messageId: z.number().int() }),
  "/api/registration": z.object({
    ...chatPost,
    sessionNumber: z.number().int(),
    registrationClosed: z.boolean(),
  }),
  "/api/import-post": z.object({
    chatId: z.number().int(),
    channelId: z.number().int().optional(),
    link: z.string().max(512),
  }),
};

type Route = keyof typeof schemas;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function corsHeaders(request: Request, webAppUrl: string): Record<string, string> {
  const allowedOrigin = new URL(webAppUrl).origin;
  if (request.headers.get("Origin") !== allowedOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function authenticate(request: Request, botToken: string): Promise<TelegramWebAppUser> {
  const authorization = request.headers.get("Authorization") ?? "";
  const initData = authorization.startsWith("tma ") ? authorization.slice("tma ".length) : "";
  const user = initData ? await verifyInitData(initData, botToken) : null;
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

/**
 * Admins may act on a discussion group only if they administer its channel.
 * Returns that channel's ID.
 */
async function authorize(app: BotApp, userId: number, chatId: number): Promise<number> {
  const channels = await app.convex.query(api.queries.getMyChannels, { userId });
  const channel = channels.find((c) => c.chatId === chatId);
  if (!channel) throw new HttpError(403, "Forbidden");
  return channel.channelId;
}

async function handle(
  route: Route,
  body: unknown,
  user: TelegramWebAppUser,
  { app, enqueue }: ApiDeps,
): Promise<unknown> {
  const parsed = schemas[route].safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request");
  const args = parsed.data as any;

  const channelId = await authorize(app, user.id, args.chatId);

  switch (route) {
    case "/api/participant-list":
      return app.botActions.sendParticipantList(args);

    case "/api/react":
      await app.botActions.reactToMessage(args.chatId, args.messageId);
      return {};

    case "/api/detect-name":
      await app.botActions.detectName(args.chatId, args.postId, args.messageId);
      return {};

    case "/api/registration": {
      const result = await app.convex.mutation(api.mutations.setSessionRegistrationClosed, {
        ...args,
        viaBot: true,
      });
      if (result.deleteMessageId !== undefined) {
        await app.botActions.deleteMessage(args.chatId, result.deleteMessageId);
      }
      return {};
    }

    case "/api/import-post": {
      // The importer reads whichever channel it's given, so it must be the one
      // the admin was just authorized for, not one named in the request.
      if (args.channelId !== undefined && args.channelId !== channelId) {
        throw new HttpError(403, "Forbidden");
      }
      const result = await app.convex.mutation(api.mutations.requestPostImport, {
        ...args,
        channelId,
        requestedBy: user.id,
        viaBot: true,
      });
      // Finding an old post can take many rate-limited Telegram calls, so it
      // runs on its own queue; the web app follows progress on the import record.
      if (result.importId) {
        try {
          await enqueue({ type: "import_post", importId: result.importId });
        } catch (error) {
          // Otherwise the import would sit "pending" forever.
          await app.convex.mutation(api.mutations.failPostImport, {
            importId: result.importId,
            error: "تعذر بدء الاستيراد. حاولي مرة أخرى.",
          });
          throw error;
        }
      }
      return result;
    }
  }
}

export async function handleApiRequest(request: Request, deps: ApiDeps): Promise<Response> {
  const cors = corsHeaders(request, deps.app.config.webAppUrl);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const { pathname } = new URL(request.url);
  const json = (status: number, body: unknown) => Response.json(body, { status, headers: cors });

  if (request.method !== "POST" || !(pathname in schemas)) {
    return json(404, { error: "Not found" });
  }

  try {
    const user = await authenticate(request, deps.app.config.botToken);
    const body = await request.json().catch(() => null);
    // Closing the Mini App mid-request must not cut an action off halfway
    // (e.g. the old list deleted but the new one not yet sent).
    const work = handle(pathname as Route, body, user, deps);
    deps.waitUntil(work.catch(() => {}));
    return json(200, await work);
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message });
    // Messages written for the admin, from the bot or a Convex mutation.
    if (error instanceof UserFacingError) return json(409, { error: error.message });
    if (error instanceof ConvexError && typeof error.data === "string") {
      return json(409, { error: error.data });
    }
    console.error(`❌ ${pathname} failed:`, error);
    return json(500, { error: "Internal error" });
  }
}
