/**
 * The bot's web API (packages/bot/src/api.ts) as the Mini App uses it:
 * authentication, sending the list, registration, reactions, name detection
 * and post imports — end to end through the real Worker and Convex functions.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { startStack, type Stack } from "../src/harness";
import { signInitData } from "../src/telegram/init-data";
import { REGISTRATION_POST, messageLink, publishHalaqa, workerFailures } from "./helpers";

let stack: Stack;
beforeAll(async () => {
  stack = await startStack();
}, 120_000);
afterAll(async () => {
  await stack?.stop();
});

/** A halaqa with two students in its first session, added the way the web app does. */
async function halaqaWithStudents(): Promise<number> {
  const postId = await publishHalaqa(stack);
  const [fatima, mona] = stack.world.students;
  for (const [user, realName] of [[fatima!, "فاطمة احمد"], [mona!, "منى علي"]] as const) {
    await stack.mutation(api.mutations.ensureUser, { userId: user.id, telegramName: user.first_name });
    await stack.mutation(api.mutations.updateUserRealName, { userId: user.id, realName });
    await stack.mutation(api.mutations.addUserToList, {
      chatId: stack.world.groupId,
      postId,
      userId: user.id,
      sessionNumber: 1,
      sessionType: "تسميع",
    });
  }
  return postId;
}

/** The bot's participant list messages under a post that are still in the chat. */
function listMessages(postId: number) {
  return stack.sim
    .history(stack.world.groupId)
    .filter((m) => m.from?.id === stack.sim.bot.id && m.reply_to_message?.message_id === postId && m.text);
}

const asAdmin = () => ({ as: stack.world.admin.id });

describe("authentication", () => {
  const body = () => ({ chatId: stack.world.groupId, postId: 1, messageId: 1 });
  const call = (authorization?: string) =>
    fetch(`${stack.workerUrl}/api/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify(body()),
    }).then((r) => r.status);

  test("requests without valid initData are rejected", async () => {
    const { admin } = stack.world;
    expect(await call()).toBe(401);
    expect(await call("tma not-init-data")).toBe(401);
    // Signed for a different bot.
    expect(await call(`tma ${await signInitData("1:other-bot", admin)}`)).toBe(401);
    // Signed for this bot, but a day old.
    expect(await call(`tma ${await signInitData(stack.sim.botToken, admin, Math.floor(Date.now() / 1000) - 90_000)}`)).toBe(401);
    // Someone else's initData with the user swapped.
    const tampered = (await stack.sim.miniAppInitData(admin.id)).replace(String(admin.id), String(admin.id + 1));
    expect(await call(`tma ${tampered}`)).toBe(401);
  });

  test("only admins of the chat's channel may act on it", async () => {
    const [student] = stack.world.students;
    expect((await stack.callApi("/api/react", body(), { as: student!.id })).status).toBe(403);

    // An admin of a different channel.
    const outsider = stack.sim.addUser({ first_name: "Other", last_name: "Owner" });
    const other = stack.sim.createChannel({ title: "قناة أخرى", ownerId: outsider.id });
    await stack.mutation(api.mutations.upsertChannel, { channelId: other.channelId, chatId: other.groupId! });
    await stack.mutation(api.mutations.syncChannelAdmins, {
      channelId: other.channelId,
      admins: [{ userId: outsider.id, status: "creator" }],
    });
    expect((await stack.callApi("/api/react", body(), { as: outsider.id })).status).toBe(403);
  });

  test("malformed requests are rejected before anything runs", async () => {
    const response = await stack.callApi("/api/participant-list", { chatId: "not a number" }, asAdmin());
    expect(response.status).toBe(400);
  });
});

describe("sending the participant list", () => {
  test("posts the list as a reply to the halaqa post", async () => {
    const postId = await halaqaWithStudents();
    const response = await stack.callApi(
      "/api/participant-list",
      { chatId: stack.world.groupId, postId, sessionNumber: 1, flower: "🌷" },
      asAdmin(),
    );
    expect(response.status).toBe(200);

    const [list] = listMessages(postId);
    expect(list?.message_id).toBe(response.body.messageId);
    expect(list?.text).toContain("ه🌷");
    expect(list?.text).toContain("١. فاطمة احمد (تسميع)");
    expect(list?.text).toContain("٢. منى علي (تسميع)");
  });

  test("sending again replaces the previous list", async () => {
    const postId = await halaqaWithStudents();
    const send = () => stack.callApi("/api/participant-list", { chatId: stack.world.groupId, postId, sessionNumber: 1 }, asAdmin());
    await send();
    const second = await send();
    expect(listMessages(postId).map((m) => m.message_id)).toEqual([second.body.messageId]);
  });

  test("two admins sending at the same moment still leave one list", async () => {
    const postId = await halaqaWithStudents();
    const body = { chatId: stack.world.groupId, postId, sessionNumber: 1 };
    await Promise.all([
      stack.callApi("/api/participant-list", body, { as: stack.world.admin.id }),
      stack.callApi("/api/participant-list", body, { as: stack.world.owner.id }),
    ]);
    expect(listMessages(postId)).toHaveLength(1);
  });

  test("a locked halaqa's list can't be sent", async () => {
    const postId = await halaqaWithStudents();
    await stack.mutation(api.mutations.lockSession, { chatId: stack.world.groupId, postId, sessionNumber: 1 });
    const response = await stack.callApi("/api/participant-list", { chatId: stack.world.groupId, postId, sessionNumber: 1 }, asAdmin());
    expect(response).toEqual({ status: 409, body: { error: "لا يمكن إرسال القائمة: الحلقة مغلقة. الرجاء فتح الحلقة أولاً." } });
    expect(listMessages(postId)).toHaveLength(0);
  });
});

describe("closing and reopening registration", () => {
  test("a closed halaqa's list is followed by the closed-registration image, removed on reopening", async () => {
    const postId = await halaqaWithStudents();
    const toggle = (registrationClosed: boolean) =>
      stack.callApi("/api/registration", { chatId: stack.world.groupId, postId, sessionNumber: 1, registrationClosed }, asAdmin());
    const photos = () => stack.sim.history(stack.world.groupId).filter((m) => m.photo && m.reply_to_message?.message_id === postId);

    expect((await toggle(true)).status).toBe(200);
    await stack.callApi("/api/participant-list", { chatId: stack.world.groupId, postId, sessionNumber: 1 }, asAdmin());
    expect(photos()).toHaveLength(1);
    expect(photos()[0]!.photo![0]!.file_size).toBe(36666); // the bundled image, uploaded intact

    expect((await toggle(false)).status).toBe(200);
    expect(photos()).toHaveLength(0);
  });

  test("a locked halaqa's registration can't be changed, and the admin is told why", async () => {
    const postId = await halaqaWithStudents();
    await stack.mutation(api.mutations.lockSession, { chatId: stack.world.groupId, postId, sessionNumber: 1 });
    const response = await stack.callApi(
      "/api/registration",
      { chatId: stack.world.groupId, postId, sessionNumber: 1, registrationClosed: true },
      asAdmin(),
    );
    // A ConvexError from the mutation reaches the admin as written.
    expect(response).toEqual({ status: 409, body: { error: "لا يمكن تغيير حالة التسجيل: الحلقة مغلقة. الرجاء فتح الحلقة أولاً." } });
  });
});

describe("adding a student from their message", () => {
  test("the bot reacts and detects the student's name", async () => {
    const postId = await publishHalaqa(stack);
    // Someone without a name on record: a manually verified name is never overwritten.
    const huda = stack.sim.addUser({ first_name: "Huda" });
    const message = stack.sim.sendUserMessage(stack.world.groupId, huda.id, "اسمي هدى سعيد تلاوة", { replyTo: postId });
    await stack.settle();

    const body = { chatId: stack.world.groupId, postId, messageId: message.message_id };
    expect((await stack.callApi("/api/react", body, asAdmin())).status).toBe(200);
    expect(stack.sim.botReactionsOn(stack.world.groupId, message.message_id)).toEqual([{ type: "emoji", emoji: "❤" }]);

    expect((await stack.callApi("/api/detect-name", body, asAdmin())).status).toBe(200);
    const user = await stack.query(api.queries.getUser, { userId: huda.id });
    expect(user?.realName).toBe("هدى سعيد");
  });
});

describe("importing an old post", () => {
  /** A registration post published before the bot was an admin, so it never saw it. */
  function oldPost(channelId = stack.world.channelId) {
    return stack.sim.postToChannel(channelId, REGISTRATION_POST, { silent: true });
  }

  async function importAndWait(chatId: number, link: string, channelId?: number) {
    const response = await stack.callApi("/api/import-post", { chatId, link, channelId }, asAdmin());
    expect(response.status).toBe(200);
    return stack.waitFor(async () => {
      const record = await stack.query(api.queries.getPostImport, { importId: response.body.importId });
      return record && ["completed", "failed"].includes(record.status) ? record : null;
    }, { message: "import to finish", timeoutMs: 30_000 });
  }

  test("from a discussion-group link", async () => {
    const { groupMessage } = oldPost();
    const record = await importAndWait(stack.world.groupId, messageLink(stack.world.groupId, groupMessage!.message_id));
    expect(record).toMatchObject({ status: "completed", postId: groupMessage!.message_id });
  });

  test("from a channel link, by searching the discussion group", async () => {
    // Bury the post among comments so the search has something to do.
    for (let i = 0; i < 6; i++) stack.sim.sendUserMessage(stack.world.groupId, stack.world.students[0]!.id, `تعليق ${i}`);
    const { channelMessage, groupMessage } = oldPost();
    for (let i = 0; i < 6; i++) stack.sim.sendUserMessage(stack.world.groupId, stack.world.students[1]!.id, `تعليق آخر ${i}`);
    await stack.settle();

    const record = await importAndWait(stack.world.groupId, messageLink(stack.world.channelId, channelMessage.message_id));
    expect(record).toMatchObject({ status: "completed", postId: groupMessage!.message_id });
  });

  test("from a channel that restricts forwarding, by reading the post through a reply", async () => {
    const { owner, admin } = stack.world;
    const { channelId, groupId } = stack.sim.createChannel({
      title: "قناة محمية",
      ownerId: owner.id,
      adminIds: [admin.id],
      protectedContent: true,
    });
    await stack.mutation(api.mutations.upsertChannel, { channelId, chatId: groupId! });
    await stack.mutation(api.mutations.syncChannelAdmins, {
      channelId,
      admins: [{ userId: admin.id, status: "administrator" }],
    });
    const { groupMessage } = oldPost(channelId);

    const record = await importAndWait(groupId!, messageLink(groupId!, groupMessage!.message_id));
    expect(record).toMatchObject({ status: "completed", postId: groupMessage!.message_id });
    // The reply used to read the post is cleaned up.
    expect(stack.sim.history(groupId!).filter((m) => m.from?.id === stack.sim.bot.id)).toHaveLength(0);
  });

  test("an invalid link is reported to the admin as written", async () => {
    const response = await stack.callApi("/api/import-post", { chatId: stack.world.groupId, link: "hello" }, asAdmin());
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("الرابط غير صالح");
  });

  test("a channel other than the chat's own is refused", async () => {
    const response = await stack.callApi(
      "/api/import-post",
      { chatId: stack.world.groupId, channelId: -1009999999999, link: messageLink(stack.world.groupId, 1) },
      asAdmin(),
    );
    expect(response.status).toBe(403);
  });
});

test("the Worker logged no failures", async () => {
  await stack.settle();
  expect(workerFailures(stack)).toEqual([]);
});
