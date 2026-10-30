/**
 * Less common paths: the bot being removed, /auto, nested replies, people
 * posting as a chat, updates arriving out of order, authors the bot can't see,
 * channels discovered from traffic alone.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { startStack, type Stack } from "../src/harness";
import { REGISTRATION_POST, publishHalaqa, turnQueue, workerFailures } from "./helpers";

let stack: Stack;
beforeAll(async () => {
  stack = await startStack();
}, 120_000);
afterAll(async () => {
  await stack?.stop();
});

const activeChannelIds = async () =>
  (await stack.query(api.queries.getActiveChannels, {})).map((c: { channelId: number }) => c.channelId);

describe("the bot's own membership", () => {
  test("removing the bot from a channel takes it out of the web app; the cron copes", async () => {
    const { channelId } = stack.sim.createChannel({ title: "قناة مؤقتة", ownerId: stack.world.owner.id });
    // Add the bot the way Telegram reports it, so the channel gets registered.
    stack.sim.chat(channelId).members.set(stack.sim.bot.id, "left");
    stack.sim.setMemberStatus(channelId, stack.sim.bot.id, "administrator");
    await stack.waitFor(async () => (await activeChannelIds()).includes(channelId), { message: "channel registered" });

    stack.sim.setMemberStatus(channelId, stack.sim.bot.id, "left");
    await stack.waitFor(async () => !(await activeChannelIds()).includes(channelId), { message: "channel deactivated" });

    await stack.runCron();
    await stack.settle();
    expect(await activeChannelIds()).toContain(stack.world.channelId);
  });

  test("a channel is discovered from its first post, without any membership update", async () => {
    // createChannel adds the bot silently: nothing tells the bot about this channel.
    const { channelId } = stack.sim.createChannel({ title: "قناة صامتة", ownerId: stack.world.owner.id });
    expect(await activeChannelIds()).not.toContain(channelId);
    stack.sim.postToChannel(channelId, "أول منشور");
    await stack.waitFor(async () => (await activeChannelIds()).includes(channelId), { message: "channel discovered" });
  });
});

describe("/auto", () => {
  /** Comments the bot stored but never classified (e.g. from before classification existed). */
  async function unclassifiedComments(postId: number, texts: string[]) {
    const ids: Array<{ userId: number; messageId: number }> = [];
    for (const text of texts) {
      const user = stack.sim.addUser({ first_name: "Late" });
      const message = stack.sim.sendUserMessage(stack.world.groupId, user.id, text, { replyTo: postId, deferred: true });
      await stack.mutation(api.mutations.addMessageAuthor, {
        chatId: stack.world.groupId,
        postId,
        messageId: message.message_id,
        user: { id: user.id, first_name: user.first_name },
        messageText: text,
        channelId: stack.world.channelId,
      });
      ids.push({ userId: user.id, messageId: message.message_id });
    }
    return ids;
  }

  test("an admin's /auto classifies the post's comments, reacts to introductions and adds them", async () => {
    const postId = await publishHalaqa(stack);
    const [intro, chat] = await unclassifiedComments(postId, ["انا ريم خالد تسميع", "السلام عليكم"]);

    stack.sim.sendUserMessage(stack.world.groupId, stack.world.admin.id, "/auto", { replyTo: postId });
    const summary = await stack.waitFor(
      () => stack.sim.history(stack.world.groupId).find((m) => m.from?.id === stack.sim.bot.id && m.text?.includes("Batch classification complete")),
      { message: "the /auto summary" },
    );
    expect(summary.text).toContain("Found names in: 1");

    expect(stack.sim.botReactionsOn(stack.world.groupId, intro!.messageId)).toHaveLength(1);
    expect(stack.sim.botReactionsOn(stack.world.groupId, chat!.messageId)).toHaveLength(0);
    const queue = await turnQueue(stack, postId);
    expect(queue.activeUsers.map((u: { id: number }) => u.id)).toEqual([intro!.userId]);
    // The command itself is removed from the chat.
    expect(stack.sim.history(stack.world.groupId).some((m) => m.text === "/auto")).toBe(false);
  });

  test("/auto from someone who isn't a channel admin does nothing", async () => {
    const postId = await publishHalaqa(stack);
    const [intro] = await unclassifiedComments(postId, ["انا سلمى يوسف تلاوة"]);
    const command = stack.sim.sendUserMessage(stack.world.groupId, stack.world.students[0]!.id, "/auto", { replyTo: postId });
    await stack.settle();
    expect(stack.sim.botReactionsOn(stack.world.groupId, intro!.messageId)).toHaveLength(0);
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(0);
    const botRepliesSince = stack.sim
      .history(stack.world.groupId)
      .filter((m) => m.message_id > command.message_id && m.from?.id === stack.sim.bot.id);
    expect(botRepliesSince).toEqual([]);
  });
});

describe("adding students in less common ways", () => {
  test("👌 on a reply to a comment (a nested reply) adds its author to the post", async () => {
    const postId = await publishHalaqa(stack);
    const [fatima, mona] = stack.world.students;
    const first = stack.sim.sendUserMessage(stack.world.groupId, fatima!.id, "السلام عليكم", { replyTo: postId });
    const nested = stack.sim.sendUserMessage(stack.world.groupId, mona!.id, "انا منى سامي تلاوة", { replyTo: first.message_id });
    stack.sim.react(stack.world.groupId, nested.message_id, stack.world.admin.id, ["👌"]);
    const queue = await stack.waitFor(async () => {
      const q = await turnQueue(stack, postId);
      return q.activeUsers.length ? q : null;
    }, { message: "nested reply author added" });
    expect(queue.activeUsers.map((u: { id: number }) => u.id)).toEqual([mona!.id]);
  });

  test("👌 that arrives before the message itself still adds the student", async () => {
    const postId = await publishHalaqa(stack);
    const student = stack.sim.addUser({ first_name: "Out of order" });
    const comment = stack.sim.sendUserMessage(stack.world.groupId, student.id, "انا نور حسن تسميع", {
      replyTo: postId,
      deferred: true,
    });
    stack.sim.react(stack.world.groupId, comment.message_id, stack.world.admin.id, ["👌"]);
    // The reaction is being handled (and retried) before the message shows up.
    await Bun.sleep(700);
    stack.sim.releaseDeferred(stack.world.groupId, comment.message_id);
    const queue = await stack.waitFor(async () => {
      const q = await turnQueue(stack, postId);
      return q.activeUsers.length ? q : null;
    }, { message: "student added after the late message", timeoutMs: 20_000 });
    expect(queue.activeUsers[0]).toMatchObject({ id: student.id, realName: "نور حسن" });
  });

  test("removing 👌 and adding it again doesn't add the student twice", async () => {
    const postId = await publishHalaqa(stack);
    const student = stack.sim.addUser({ first_name: "Twice" });
    const comment = stack.sim.sendUserMessage(stack.world.groupId, student.id, "انا هالة سمير", { replyTo: postId });
    for (const emojis of [["👌"], [], ["👌"]]) stack.sim.react(stack.world.groupId, comment.message_id, stack.world.admin.id, emojis);
    await stack.settle();
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(1);
  });
});

describe("senders that aren't students", () => {
  test("👌 on an anonymous admin's or a channel's comment adds nobody", async () => {
    const postId = await publishHalaqa(stack);
    const asGroup = stack.sim.sendAsChat(stack.world.groupId, stack.world.groupId, "انا المشرفة سارة احمد", { replyTo: postId });
    const asChannel = stack.sim.sendAsChat(stack.world.groupId, stack.world.channelId, "انا قناة الحلقة", { replyTo: postId });
    for (const message of [asGroup, asChannel]) {
      stack.sim.react(stack.world.groupId, message.message_id, stack.world.admin.id, ["👌"]);
    }
    await stack.settle();
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(0);
  });

  test("detecting a name on a message the bot never saw, from a hidden-forward user, changes nothing", async () => {
    const postId = await publishHalaqa(stack);
    const hidden = stack.world.students[2]!;
    const unseen = stack.sim.sendUserMessage(stack.world.groupId, hidden.id, "انا مخفية الاسم", { replyTo: postId, deferred: true });
    const response = await stack.callApi(
      "/api/detect-name",
      { chatId: stack.world.groupId, postId, messageId: unseen.message_id },
      { as: stack.world.admin.id },
    );
    expect(response.status).toBe(200);
    const user = await stack.query(api.queries.getUser, { userId: hidden.id });
    expect(user?.realName ?? null).toBeNull();
  });
});

test("the Worker logged no failures", async () => {
  await stack.settle();
  expect(workerFailures(stack)).toEqual([]);
});
