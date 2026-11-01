/**
 * The bot as people use it from Telegram: channel posts, comments, the admin's
 * 👌 reaction, commands, and membership changes — end to end through the real
 * Worker, queues and Convex functions.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { startStack, type Stack } from "../src/harness";
import { isListed, publishHalaqa, turnQueue, workerFailures } from "./helpers";

let stack: Stack;
beforeAll(async () => {
  stack = await startStack();
}, 120_000);
afterAll(async () => {
  await stack?.stop();
});

describe("registration posts", () => {
  test("a channel post starting with the registration phrase is registered as a halaqa", async () => {
    const postId = await publishHalaqa(stack);
    expect(await isListed(stack, stack.world.groupId, postId)).toBe(true);
  });

  test("other channel posts are not", async () => {
    const { groupMessage } = stack.sim.postToChannel(stack.world.channelId, "تذكير: الحلقة غدا");
    await stack.settle();
    expect(await isListed(stack, stack.world.groupId, groupMessage!.message_id)).toBe(false);
  });
});

describe("adding students with 👌", () => {
  test("an admin's 👌 on a self-introduction adds the student with their name and activity", async () => {
    const postId = await publishHalaqa(stack);
    const [fatima] = stack.world.students;
    const comment = stack.sim.sendUserMessage(stack.world.groupId, fatima!.id, "انا فاطمة احمد تسميع", { replyTo: postId });
    // React straight away, before the comment is processed: updates are handled
    // in order, so the comment is stored first. (The old bot needed retries here.)
    stack.sim.react(stack.world.groupId, comment.message_id, stack.world.owner.id, ["👌"]);

    const queue = await stack.waitFor(async () => {
      const list = await turnQueue(stack, postId);
      return list.activeUsers.length > 0 ? list : null;
    }, { message: "student to be added" });

    expect(queue.activeUsers).toHaveLength(1);
    expect(queue.activeUsers[0]).toMatchObject({ id: fatima!.id, realName: "فاطمة احمد", sessionType: "تسميع" });
  });

  test("👌 from someone who isn't a channel admin does nothing", async () => {
    const postId = await publishHalaqa(stack);
    const [, mona] = stack.world.students;
    const comment = stack.sim.sendUserMessage(stack.world.groupId, mona!.id, "منى علي تلاوة", { replyTo: postId });
    stack.sim.react(stack.world.groupId, comment.message_id, mona!.id, ["👌"]);
    await stack.settle();
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(0);
  });

  test("👌 on a message that doesn't introduce the sender does nothing", async () => {
    const postId = await publishHalaqa(stack);
    const [, mona] = stack.world.students;
    const comment = stack.sim.sendUserMessage(stack.world.groupId, mona!.id, "جزاك الله خيرا يا أم أحمد", { replyTo: postId });
    stack.sim.react(stack.world.groupId, comment.message_id, stack.world.admin.id, ["👌"]);
    await stack.settle();
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(0);
  });

  test("adding a second emoji next to 👌 doesn't add the student twice", async () => {
    const postId = await publishHalaqa(stack);
    const [, mona] = stack.world.students;
    const comment = stack.sim.sendUserMessage(stack.world.groupId, mona!.id, "منى علي حسن", { replyTo: postId });
    stack.sim.react(stack.world.groupId, comment.message_id, stack.world.owner.id, ["👌"]);
    stack.sim.react(stack.world.groupId, comment.message_id, stack.world.owner.id, ["👌", "❤"]);
    await stack.settle();
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(1);
  });
});

describe("/admin", () => {
  test("a channel admin gets the button that opens the admin panel", async () => {
    const chatId = stack.sim.privateChat(stack.world.admin.id);
    stack.sim.sendUserMessage(chatId, stack.world.admin.id, "/admin");
    const reply = await stack.waitFor(
      () => stack.sim.history(chatId).find((m) => m.from?.id === stack.sim.bot.id),
      { message: "the bot's reply" },
    );
    const button = (reply.reply_markup as any)?.inline_keyboard?.[0]?.[0];
    expect(button?.web_app?.url).toBe("http://localhost:3000");
  });

  test("anyone else is told they can't", async () => {
    const [student] = stack.world.students;
    const chatId = stack.sim.privateChat(student!.id);
    stack.sim.sendUserMessage(chatId, student!.id, "/admin");
    const reply = await stack.waitFor(
      () => stack.sim.history(chatId).find((m) => m.from?.id === stack.sim.bot.id),
      { message: "the bot's reply" },
    );
    expect(reply.text).toContain("لا يمكنك الوصول");
    expect(reply.reply_markup).toBeUndefined();
  });
});

describe("channel admins follow Telegram", () => {
  test("promoting someone in the channel grants web app access, demoting revokes it", async () => {
    const student = stack.sim.addUser({ first_name: "Future admin" });
    const myChannels = () => stack.query(api.queries.getMyChannels, { userId: student.id });
    expect(await myChannels()).toHaveLength(0);

    stack.sim.setMemberStatus(stack.world.channelId, student.id, "administrator");
    await stack.waitFor(async () => (await myChannels()).length === 1, { message: "promotion to sync" });

    stack.sim.setMemberStatus(stack.world.channelId, student.id, "member");
    await stack.waitFor(async () => (await myChannels()).length === 0, { message: "demotion to sync" });
  });

  test("adding the bot to a new channel registers it", async () => {
    const { channelId, groupId } = stack.sim.createChannel({ title: "حلقة جديدة", ownerId: stack.world.owner.id });
    // createChannel adds the bot silently; take it out and add it back the way Telegram reports it.
    stack.sim.chat(channelId).members.set(stack.sim.bot.id, "left");
    stack.sim.setMemberStatus(channelId, stack.sim.bot.id, "administrator");

    const channels = await stack.waitFor(async () => {
      const mine = await stack.query(api.queries.getMyChannels, { userId: stack.world.owner.id });
      return mine.find((c) => c.channelId === channelId) ? mine : null;
    }, { message: "new channel to be registered" });
    expect(channels.find((c) => c.channelId === channelId)?.chatId).toBe(groupId!);
  });
});

test("every update was delivered and nothing in the Worker failed", async () => {
  await stack.settle();
  expect(stack.sim.deliveries.filter((d) => d.status !== "delivered")).toEqual([]);
  expect(workerFailures(stack)).toEqual([]);
});
