/**
 * HTTP front for the simulator, as a plain fetch handler (Bun.serve locally,
 * a Worker for previews):
 *
 *   /bot<token>/<method>      the Bot API, as the bot calls it
 *   /groq/openai/v1/...       fake Groq (see fake-groq.ts)
 *   /sim/...                  control API: act as users, inspect chats
 *   /                         dashboard (dashboard.ts)
 */
import { createFakeGroq } from "../fake-groq";
import { renderDashboard } from "./dashboard";
import { TelegramApiError, type MemberStatus, type TelegramSimulator } from "./simulator";

export interface SimulatorServerOptions {
  /** If set, /sim/* requires `Authorization: Bearer <token>` (for deployed previews). */
  controlToken?: string;
  /** Mini App URL the dashboard opens, with signed initData in the hash. */
  webAppUrl?: string;
  /**
   * Answer world actions (posting, reacting...) only once the resulting updates
   * reached the bot. Needed in a Durable Object, where work left running after
   * the response may be cut off.
   */
  awaitDelivery?: boolean;
  /** Enables POST /sim/reset: start over with a fresh world. */
  reset?: () => void;
}

/** Compares without leaking how much of the guess matched. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Parameters from the query string and a JSON, form or multipart body. */
async function readParams(request: Request): Promise<Record<string, unknown>> {
  const params: Record<string, unknown> = Object.fromEntries(new URL(request.url).searchParams);
  if (request.method !== "POST") return params;

  const type = request.headers.get("Content-Type") ?? "";
  if (type.includes("application/json")) {
    Object.assign(params, await request.json());
    return params;
  }
  if (!type.includes("multipart/form-data") && !type.includes("application/x-www-form-urlencoded")) {
    return params;
  }

  const form = await request.formData();
  const files = new Map<string, Uint8Array>();
  for (const [key, value] of form) {
    if (typeof value === "string") {
      // Form fields carry numbers and objects as JSON text.
      try {
        params[key] = JSON.parse(value);
      } catch {
        params[key] = value;
      }
    } else {
      files.set(key, new Uint8Array(await (value as Blob).arrayBuffer()));
    }
  }
  // grammY uploads a file as its own part and references it as attach://<part>.
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.startsWith("attach://")) {
      params[key] = files.get(value.slice("attach://".length));
    }
  }
  for (const key of ["text", "caption"]) {
    if (params[key] !== undefined) params[key] = String(params[key]);
  }
  return params;
}

export function createSimulatorHandler(sim: TelegramSimulator, options: SimulatorServerOptions = {}) {
  const groq = createFakeGroq();

  async function botApi(token: string, method: string, request: Request): Promise<Response> {
    if (token !== sim.botToken) {
      return Response.json({ ok: false, error_code: 401, description: "Unauthorized" }, { status: 401 });
    }
    try {
      const result = await sim.callApi(method, await readParams(request));
      return Response.json({ ok: true, result });
    } catch (error) {
      if (error instanceof TelegramApiError) {
        return Response.json(
          {
            ok: false,
            error_code: error.errorCode,
            description: error.description,
            ...(error.parameters ? { parameters: error.parameters } : {}),
          },
          { status: error.errorCode },
        );
      }
      throw error;
    }
  }

  async function control(request: Request, route: string): Promise<Response> {
    if (options.controlToken && !sameText(request.headers.get("Authorization") ?? "", `Bearer ${options.controlToken}`)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body: any = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const chatMatch = route.match(/^chats\/(-?\d+)$/);

    try {
      if (request.method === "GET" && route === "state") {
        return Response.json({
          bot: sim.bot,
          webhook: sim.webhook,
          pendingUpdateCount: sim.pendingUpdateCount,
          menuButton: sim.menuButton,
          users: [...sim.users.values()],
          chats: [...sim.chats.values()].map((c) => ({
            ...c.info,
            members: Object.fromEntries(c.members),
            messageCount: sim.history(c.info.id).length,
          })),
        });
      }
      if (request.method === "GET" && chatMatch) {
        const chatId = Number(chatMatch[1]);
        const chat = sim.chat(chatId);
        return Response.json({
          ...chat.info,
          members: Object.fromEntries(chat.members),
          messages: sim.history(chatId).map((m) => ({
            ...m,
            reactions: Object.fromEntries(chat.reactions.get(m.message_id) ?? []),
            botReaction: chat.botReactions.get(m.message_id),
          })),
        });
      }
      if (request.method === "GET" && route === "deliveries") return Response.json(sim.deliveries);
      if (request.method === "GET" && route === "api-calls") return Response.json(sim.apiCalls);
      if (request.method === "GET" && route === "groq-calls") return Response.json(groq.calls);

      if (request.method === "POST") {
        const response = await worldAction(route, body);
        if (response && options.awaitDelivery) await sim.whenDelivered();
        if (response) return response;
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
  }

  async function worldAction(route: string, body: any): Promise<Response | null> {
    switch (route) {
      case "users":
        return Response.json(sim.addUser(body));
      case "channels":
        return Response.json(sim.createChannel(body));
      case "groups":
        return Response.json({ chatId: sim.createGroup(body) });
      case "channel-posts":
        return Response.json(sim.postToChannel(body.channelId, body.text, { silent: body.silent }));
      case "private-chats":
        return Response.json({ chatId: sim.privateChat(body.userId) });
      case "messages":
        return Response.json(
          sim.sendUserMessage(body.chatId, body.userId, body.text, { replyTo: body.replyTo, deferred: body.deferred }),
        );
      case "chat-messages":
        return Response.json(sim.sendAsChat(body.chatId, body.senderChatId, body.text, { replyTo: body.replyTo }));
      case "release":
        sim.releaseDeferred(body.chatId, body.messageId);
        return Response.json({ ok: true });
      case "reactions":
        sim.react(body.chatId, body.messageId, body.userId, body.emojis ?? []);
        return Response.json({ ok: true });
      case "members":
        sim.setMemberStatus(body.chatId, body.userId, body.status as MemberStatus);
        return Response.json({ ok: true });
      case "mini-app": {
        const initData = await sim.miniAppInitData(body.userId);
        const url = options.webAppUrl
          ? `${options.webAppUrl}#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0&tgWebAppPlatform=web`
          : undefined;
        return Response.json({ initData, url });
      }
      case "wait":
        await sim.whenDelivered();
        return Response.json({ ok: true });
      case "reset":
        if (!options.reset) return null;
        options.reset();
        return Response.json({ ok: true });
    }
    return null;
  }

  async function handle(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    const botMatch = pathname.match(/^\/bot([^/]+)\/([A-Za-z]+)$/);
    if (botMatch) return botApi(botMatch[1]!, botMatch[2]!, request);
    if (pathname.startsWith("/groq/")) return groq.handle(request);
    if (pathname.startsWith("/sim/")) return control(request, pathname.slice("/sim/".length));
    if (pathname === "/" && request.method === "GET") {
      return new Response(renderDashboard({ needsToken: Boolean(options.controlToken) }), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  }

  return { handle, groqCalls: groq.calls };
}
