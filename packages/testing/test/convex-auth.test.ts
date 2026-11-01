/**
 * Convex only answers callers the bot vouches for: the bot itself, and Mini
 * App users whose initData the Worker verified. Users reach only the chats of
 * channels they administer, and never the bot's own functions.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import path from "node:path";
import { readFileSync } from "node:fs";
import { api, ConvexHttpClient } from "@halakabot/db";
import { generateKeyPair, importSigningKey, signToken } from "../../bot/src/convex-auth";
import { startStack, type Stack } from "../src/harness";
import { REGISTRATION_POST, publishHalaqa, turnQueue } from "./helpers";

const NOT_SIGNED_IN = "يجب تسجيل الدخول من خلال تيليجرام";
const DENIED = "غير مصرح";

let stack: Stack;
let postId: number;
/** A channel of its own, run by someone who has nothing to do with the main one. */
let other: { ownerId: number; channelId: number; groupId: number };

beforeAll(async () => {
  stack = await startStack();
  const { sim, world } = stack;
  postId = await publishHalaqa(stack);
  const comment = sim.sendUserMessage(world.groupId, world.students[0]!.id, "انا فاطمة احمد تسميع", { replyTo: postId });
  sim.react(world.groupId, comment.message_id, world.admin.id, ["👌"]);
  await stack.waitFor(async () => (await turnQueue(stack, postId)).activeUsers.length === 1, {
    message: "the student to be added",
  });

  const ownerId = sim.addUser({ first_name: "Other owner" }).id;
  const { channelId, groupId } = sim.createChannel({ title: "حلقة أخرى", ownerId, adminIds: [] });
  other = { ownerId, channelId, groupId: groupId! };
  sim.postToChannel(channelId, REGISTRATION_POST);
  await stack.settle();
  await stack.runCron();
  await stack.settle();
  const theirs = await (await stack.convexAs(ownerId)).query(api.queries.getMyChannels, { userId: ownerId });
  expect(theirs.map((c: { channelId: number }) => c.channelId)).toEqual([channelId]);
}, 120_000);

afterAll(async () => {
  await stack?.stop();
});

/** The error a Convex call fails with, as the web app would show it. */
async function failure(call: Promise<unknown>): Promise<string> {
  try {
    await call;
  } catch (error: any) {
    return typeof error.data === "string" ? error.data : String(error.message);
  }
  return "(succeeded)";
}

describe("without a token", () => {
  test("nothing is readable or writable", async () => {
    const anonymous = await stack.convexAs(null);
    const { world } = stack;
    expect(await failure(anonymous.query(api.queries.getMyChannels, { userId: world.admin.id }))).toBe(NOT_SIGNED_IN);
    expect(await failure(anonymous.query(api.queries.getUserList, { chatId: world.groupId, postId }))).toBe(NOT_SIGNED_IN);
    expect(await failure(anonymous.query(api.queries.getAllUsers, {}))).toBe(NOT_SIGNED_IN);
    expect(
      await failure(anonymous.mutation(api.mutations.syncChannelAdmins, { channelId: world.channelId, admins: [] })),
    ).toBe(NOT_SIGNED_IN);
  });

  test("a token signed with any other key is refused", async () => {
    const forger = await importSigningKey((await generateKeyPair()).privateJwk);
    const client = new ConvexHttpClient(stack.convexUrl, { skipConvexDeploymentUrlCheck: true, logger: false });
    client.setAuth((await signToken(forger, "bot", 600)).token);
    expect(await failure(client.query(api.queries.getAllUsers, {}))).toMatch(/token|InvalidAuthHeader/i);
  });
});

describe("a channel admin", () => {
  test("sees and edits their own channel's data", async () => {
    const { world } = stack;
    const admin = await stack.convexAs(world.admin.id);
    const channels = await admin.query(api.queries.getMyChannels, { userId: world.admin.id });
    expect(channels.map((c: { chatId: number }) => c.chatId)).toEqual([world.groupId]);

    const list = await admin.query(api.queries.getUserList, { chatId: world.groupId, postId });
    expect(list.activeUsers).toHaveLength(1);
    await admin.mutation(api.mutations.updateTurnQueueNotes, { entryId: list.activeUsers[0]!.entryId, notes: "ممتازة" });
    const updated = await admin.query(api.queries.getUserList, { chatId: world.groupId, postId });
    expect(updated.activeUsers[0]!.notes).toBe("ممتازة");
  });

  test("can't call the bot's own functions", async () => {
    const { world } = stack;
    const admin = await stack.convexAs(world.admin.id);
    // Making yourself an admin of any channel would undo all the rest.
    expect(
      await failure(
        admin.mutation(api.mutations.syncChannelAdmins, {
          channelId: other.channelId,
          admins: [{ userId: world.admin.id, status: "administrator" }],
        }),
      ),
    ).toBe(DENIED);
    expect(
      await failure(
        admin.mutation(api.mutations.upsertChannel, { channelId: world.admin.id, chatId: other.groupId, isActive: true }),
      ),
    ).toBe(DENIED);
    expect(await failure(admin.query(api.queries.getAllUsers, {}))).toBe(DENIED);
    expect(await failure(admin.query(api.queries.getMyChannels, { userId: other.ownerId }))).toBe(DENIED);
  });

  test("can't reach another channel's chat, by chat or by entry", async () => {
    const { world } = stack;
    const outsider = await stack.convexAs(other.ownerId);
    const [entry] = (await turnQueue(stack, postId)).activeUsers;
    expect(await failure(outsider.query(api.queries.getUserList, { chatId: world.groupId, postId }))).toBe(DENIED);
    expect(
      await failure(outsider.query(api.queries.getPaginatedPosts, {
        chatId: world.groupId,
        paginationOpts: { numItems: 10, cursor: null },
      })),
    ).toBe(DENIED);
    expect(await failure(outsider.mutation(api.mutations.removeUserFromList, { entryId: entry!.entryId }))).toBe(DENIED);
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(1);
  });

  test("loses access as soon as Telegram says they're no longer an admin", async () => {
    const { sim, world } = stack;
    const helper = sim.addUser({ first_name: "Helper" });
    sim.setMemberStatus(world.channelId, helper.id, "administrator");
    await stack.settle();
    const client = await stack.convexAs(helper.id);
    await stack.waitFor(async () => (await client.query(api.queries.getUserList, { chatId: world.groupId, postId })).activeUsers);

    sim.setMemberStatus(world.channelId, helper.id, "member");
    await stack.settle();
    expect(await failure(client.query(api.queries.getUserList, { chatId: world.groupId, postId }))).toBe(DENIED);
  });
});

describe("an admin of another channel", () => {
  // Anyone can be one: adding the bot to a channel of your own registers it.
  test("can't read or rename students who never came to their channel", async () => {
    const { world } = stack;
    const fatima = world.students[0]!.id;
    const outsider = await stack.convexAs(other.ownerId);
    for (const chatId of [undefined, other.groupId]) {
      expect(await failure(outsider.query(api.queries.getUser, { userId: fatima, chatId }))).toBe(DENIED);
      expect(await failure(outsider.query(api.queries.getUserParticipations, { userId: fatima, chatId }))).toBe(DENIED);
      expect(
        await failure(outsider.mutation(api.mutations.updateUserRealName, { userId: fatima, realName: "x", chatId })),
      ).toBe(DENIED);
    }
    expect(await failure(outsider.query(api.queries.searchUsers, { query: "فاطمة" }))).toBe(DENIED);
    expect(await outsider.query(api.queries.searchUsers, { query: "فاطمة", chatId: other.groupId })).toEqual([]);

    // Her own channel's admin can.
    const admin = await stack.convexAs(world.admin.id);
    expect(await admin.query(api.queries.getUser, { userId: fatima, chatId: world.groupId })).not.toBeNull();
    expect((await admin.query(api.queries.searchUsers, { query: "فاطمة", chatId: world.groupId })).length).toBe(1);
  });

  test("can't rename another channel's supervisor", async () => {
    const { world } = stack;
    const outsider = await stack.convexAs(other.ownerId);
    expect(
      await failure(
        outsider.mutation(api.mutations.updateAdminPreferredName, {
          channelId: world.channelId,
          userId: world.admin.id,
          preferredName: "x",
          chatId: other.groupId,
          postId: 999_999,
          sessionNumber: 1,
        }),
      ),
    ).toBe(DENIED);
  });

  test("the LLM score matcher needs an admin", async () => {
    const anonymous = await stack.convexAs(null);
    expect(
      await failure(anonymous.action(api.actions.matchBulkScores, { text: "فاطمة ١٠", roster: [], otherStudents: [] })),
    ).toBe(NOT_SIGNED_IN);
  });
});

describe("a student", () => {
  test("is signed in but sees nothing", async () => {
    const { world } = stack;
    const student = await stack.convexAs(world.students[0]!.id);
    expect(await student.query(api.queries.getMyChannels, { userId: world.students[0]!.id })).toEqual([]);
    expect(await failure(student.query(api.queries.getUserList, { chatId: world.groupId, postId }))).toBe(DENIED);
    expect(await failure(student.query(api.queries.getUser, { userId: world.students[0]!.id }))).toBe(DENIED);
  });
});

describe("the Worker's token endpoint", () => {
  test("signs a Convex token for a verified Mini App user, and only for them", async () => {
    const { sim, world } = stack;
    const issued = await stack.callApi("/api/auth/token", {}, { as: world.admin.id });
    expect(issued.status).toBe(200);
    const client = new ConvexHttpClient(stack.convexUrl, { skipConvexDeploymentUrlCheck: true, logger: false });
    client.setAuth(issued.body.token);
    const channels = await client.query(api.queries.getMyChannels, { userId: world.admin.id });
    expect(channels).toHaveLength(1);

    const post = (headers: Record<string, string>) =>
      fetch(`${stack.workerUrl}/api/auth/token`, { method: "POST", headers, body: "{}" }).then((r) => r.status);
    expect(await post({})).toBe(401);
    // initData for one user, with the user swapped for another.
    const initData = new URLSearchParams(await sim.miniAppInitData(world.students[0]!.id));
    initData.set("user", JSON.stringify({ id: world.admin.id, first_name: "x" }));
    expect(await post({ Authorization: `tma ${initData}` })).toBe(401);
  });
});

test("every public Convex function starts with an access check", async () => {
  const dir = path.resolve(import.meta.dir, "../../db/convex");
  // A check, possibly per item or per branch: `for (...) await requireEntryAccess(...)`.
  const checks = /^((if|for) \(.*?\) )?(await )?require\w*\(|getCaller\(|internal\.auth\.|ctx\.db\.get\(args\.importId\)/;
  const checked = new Set<string>();
  const unchecked: string[] = [];
  for (const file of ["queries.ts", "mutations.ts", "actions.ts"]) {
    // Each definition on its own, so one function's check can't count for another.
    const source = readFileSync(path.join(dir, file), "utf8");
    for (const chunk of source.split(/^(?=export const )/m)) {
      const name = chunk.match(/^export const (\w+) = (?:query|mutation|action)\(\{/)?.[1];
      if (!name) continue;
      const handler = chunk.indexOf("handler:");
      const body = chunk.indexOf("=> {\n", handler);
      const firstLine = chunk.slice(body + "=> {\n".length).split("\n").find((line) => line.trim() !== "" && !line.trim().startsWith("//"));
      const id = `${file.replace(".ts", "")}:${name}`;
      if (handler >= 0 && body >= 0 && checks.test(firstLine?.trim() ?? "")) checked.add(id);
      else unchecked.push(id);
    }
  }
  expect(unchecked).toEqual([]);

  // And the parse saw every function Convex registers as public.
  const registered: string[] = [];
  for (const file of ["queries", "mutations", "actions"]) {
    const module = await import(path.join(dir, `${file}.ts`));
    for (const [name, fn] of Object.entries(module)) {
      if ((fn as { isPublic?: boolean })?.isPublic) registered.push(`${file}:${name}`);
    }
  }
  // The stubs left for stale web clients only throw.
  const stubs = ["actions:sendParticipantList", "actions:reactToMessage", "actions:detectNameFromMessage"];
  expect(registered.filter((id) => !stubs.includes(id)).sort()).toEqual([...checked].sort());
});
