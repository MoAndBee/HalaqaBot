/**
 * The simulator's Telegram behavior, which the scenario tests rely on being
 * faithful, plus the fake Groq rules and Mini App signing. Fast: no Worker.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyInitData } from "../../bot/src/telegram-auth";
import { classify } from "../src/fake-groq";
import { signInitData } from "../src/telegram/init-data";
import { TelegramApiError, TelegramSimulator } from "../src/telegram/simulator";

const TOKEN = "123456:TEST";

/** A webhook endpoint that records what it receives. */
function receiver(respond: (update: any, attempt: number) => Response | Promise<Response> = () => new Response("OK")) {
  const received: Array<{ update: any; secret: string | null }> = [];
  const attempts = new Map<number, number>();
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const update = (await request.json()) as any;
      const attempt = (attempts.get(update.update_id) ?? 0) + 1;
      attempts.set(update.update_id, attempt);
      received.push({ update, secret: request.headers.get("X-Telegram-Bot-Api-Secret-Token") });
      return respond(update, attempt);
    },
  });
  servers.push(server);
  return { url: `http://127.0.0.1:${server.port}/telegram`, received };
}
const servers: Array<ReturnType<typeof Bun.serve>> = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

function world() {
  const sim = new TelegramSimulator({ botToken: TOKEN, retryDelayMs: 10 });
  const owner = sim.addUser({ first_name: "Owner" });
  const student = sim.addUser({ first_name: "Student" });
  const { channelId, groupId } = sim.createChannel({ title: "C", ownerId: owner.id });
  return { sim, owner, student, channelId, groupId: groupId! };
}

describe("webhook delivery", () => {
  test("sends the secret token and only the update types the bot asked for", async () => {
    const { sim, owner, channelId, groupId } = world();
    const hook = receiver();
    await sim.callApi("setWebhook", { url: hook.url, secret_token: "s3cret", allowed_updates: ["message"] });

    sim.postToChannel(channelId, "hello"); // channel_post (not allowed) + automatic forward (message)
    sim.setMemberStatus(channelId, owner.id, "administrator"); // chat_member (not allowed)
    await sim.whenDelivered();

    expect(hook.received.map((r) => Object.keys(r.update)[1])).toEqual(["message"]);
    expect(hook.received[0]!.secret).toBe("s3cret");
    expect(hook.received[0]!.update.message.is_automatic_forward).toBe(true);
    expect(hook.received[0]!.update.message.chat.id).toBe(groupId);
  });

  test("withholds chat_member and message_reaction unless asked for, like Telegram", async () => {
    const { sim, owner, student, groupId } = world();
    const hook = receiver();
    await sim.callApi("setWebhook", { url: hook.url });
    const message = sim.sendUserMessage(groupId, student.id, "hi");
    sim.react(groupId, message.message_id, owner.id, ["👌"]);
    sim.setMemberStatus(groupId, student.id, "administrator");
    await sim.whenDelivered();
    expect(hook.received.map((r) => Object.keys(r.update)[1])).toEqual(["message"]);
  });

  test("with max_connections 1, delivers in order and one at a time", async () => {
    const { sim, student, groupId } = world();
    let inFlight = 0;
    let maxInFlight = 0;
    const hook = receiver(async () => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await Bun.sleep(5 + Math.random() * 10);
      inFlight--;
      return new Response("OK");
    });
    await sim.callApi("setWebhook", { url: hook.url, max_connections: 1 });
    for (let i = 0; i < 10; i++) sim.sendUserMessage(groupId, student.id, `m${i}`);
    await sim.whenDelivered();
    expect(maxInFlight).toBe(1);
    expect(hook.received.map((r) => r.update.message.text)).toEqual([...Array(10)].map((_, i) => `m${i}`));
  });

  test("retries an update the webhook rejects, and reports the error", async () => {
    const { sim, student, groupId } = world();
    const hook = receiver((_, attempt) => new Response(null, { status: attempt < 3 ? 500 : 200 }));
    await sim.callApi("setWebhook", { url: hook.url });
    sim.sendUserMessage(groupId, student.id, "hi");
    await sim.whenDelivered();
    expect(hook.received).toHaveLength(3);
    expect(sim.deliveries[0]).toMatchObject({ status: "delivered", attempts: 3 });
    expect(((await sim.callApi("getWebhookInfo", {})) as any).last_error_message).toContain("500");
  });

  test("a bot that isn't an admin sees no channel posts or reactions", async () => {
    const { sim, owner, student, channelId, groupId } = world();
    sim.chat(channelId).members.set(sim.bot.id, "member");
    sim.chat(groupId).members.set(sim.bot.id, "member");
    const hook = receiver();
    await sim.callApi("setWebhook", { url: hook.url, allowed_updates: ["channel_post", "message", "message_reaction"] });
    sim.postToChannel(channelId, "post");
    const message = sim.sendUserMessage(groupId, student.id, "hi");
    sim.react(groupId, message.message_id, owner.id, ["👌"]);
    await sim.whenDelivered();
    expect(hook.received.map((r) => Object.keys(r.update)[1])).toEqual(["message", "message"]);
  });
});

describe("Bot API", () => {
  test("a channel the bot was just added to is announced to it, as Telegram does", async () => {
    const { sim, channelId } = world();
    sim.announceBot(channelId);
    const updates = (await sim.callApi("getUpdates", { allowed_updates: ["my_chat_member"] })) as any[];
    expect(updates.map((u) => u.my_chat_member)).toMatchObject([
      {
        chat: { id: channelId, type: "channel" },
        old_chat_member: { status: "left", user: { id: sim.bot.id } },
        new_chat_member: { status: "administrator", user: { id: sim.bot.id } },
      },
    ]);
  });

  test("forwarding reveals the sender, unless they hide forwards or the chat is protected", async () => {
    const { sim, owner, groupId } = world();
    const scratch = sim.createGroup({ title: "scratch", ownerId: owner.id });
    const open = sim.addUser({ first_name: "Open" });
    const hidden = sim.addUser({ first_name: "Hidden", last_name: "User", hideForwards: true });
    const forward = (messageId: number, fromChat = groupId) =>
      sim.callApi("forwardMessage", { chat_id: scratch, from_chat_id: fromChat, message_id: messageId }) as Promise<any>;

    expect((await forward(sim.sendUserMessage(groupId, open.id, "a").message_id)).forward_origin).toMatchObject({
      type: "user",
      sender_user: { id: open.id },
    });
    expect((await forward(sim.sendUserMessage(groupId, hidden.id, "b").message_id)).forward_origin).toMatchObject({
      type: "hidden_user",
      sender_user_name: "Hidden User",
    });

    const protectedChannel = sim.createChannel({ title: "P", ownerId: owner.id, protectedContent: true });
    const { groupMessage } = sim.postToChannel(protectedChannel.channelId, "secret");
    await expect(forward(groupMessage!.message_id, protectedChannel.groupId!)).rejects.toThrow("can't be forwarded");
  });

  test("errors look like Telegram's", async () => {
    const { sim, groupId } = world();
    const error = (await sim.callApi("deleteMessage", { chat_id: groupId, message_id: 999 }).catch((e) => e)) as TelegramApiError;
    expect(error).toBeInstanceOf(TelegramApiError);
    expect(error.description).toBe("Bad Request: message to delete not found");
    await expect(sim.callApi("getChat", { chat_id: -1 })).rejects.toThrow("chat not found");
    await expect(sim.callApi("sendSticker", {})).rejects.toThrow("method not found");
  });

  test("replies embed the message they reply to", async () => {
    const { sim, student, groupId } = world();
    const original = sim.sendUserMessage(groupId, student.id, "original");
    const reply = (await sim.callApi("sendMessage", {
      chat_id: groupId,
      text: "reply",
      reply_parameters: { message_id: original.message_id },
    })) as any;
    expect(reply.reply_to_message.text).toBe("original");
    await expect(
      sim.callApi("sendMessage", { chat_id: groupId, text: "x", reply_to_message_id: 999 }),
    ).rejects.toThrow("message to be replied not found");
  });
});

describe("Mini App initData", () => {
  /** Telegram's algorithm, written independently of both the bot and the simulator. */
  function referenceSign(token: string, fields: Record<string, string>) {
    const dataCheckString = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
    return new URLSearchParams({ ...fields, hash }).toString();
  }

  const user = { id: 42, first_name: "Admin", username: "admin" };

  test("the bot accepts data signed by Telegram's algorithm, for its own token only", async () => {
    const authDate = String(Math.floor(Date.now() / 1000));
    const initData = referenceSign(TOKEN, { auth_date: authDate, query_id: "AA", user: JSON.stringify(user) });
    expect(await verifyInitData(initData, TOKEN)).toMatchObject({ id: 42 });
    expect(await verifyInitData(initData, "999:OTHER")).toBeNull();
  });

  test("the simulator signs exactly as Telegram does", async () => {
    const initData = await signInitData(TOKEN, user, 1_700_000_000);
    const fields = Object.fromEntries(new URLSearchParams(initData));
    const { hash, ...signed } = fields;
    expect(new URLSearchParams(referenceSign(TOKEN, signed)).get("hash")).toBe(hash!);
  });

  test("tampered or stale data is rejected", async () => {
    const initData = await signInitData(TOKEN, user);
    expect(await verifyInitData(initData.replace("%22id%22%3A42", "%22id%22%3A43"), TOKEN)).toBeNull();
    const stale = await signInitData(TOKEN, user, Math.floor(Date.now() / 1000) - 25 * 3600);
    expect(await verifyInitData(stale, TOKEN)).toBeNull();
  });
});

describe("fake Groq rules", () => {
  test.each([
    ["انا فاطمة احمد تسميع", ["فاطمة", "احمد"], "تسميع"],
    ["نورا محمد - تلاوه", ["نورا", "محمد"], "تلاوة"],
    ["اسمي منى سعيد", ["منى", "سعيد"], null],
    ["هل حلقة معلمة سهر خلصت؟", [], null],
    ["جزاك الله خيرا يا أم أحمد", [], null],
    ["تسميع", [], "تسميع"],
  ] as const)("%s", (text, names, activityType) => {
    expect(classify(text)).toEqual({ names: [...names], activityType });
  });
});
