/**
 * The bot under adverse conditions: Telegram's flood limits, a Convex outage,
 * and the per-invocation subrequest budget Cloudflare Workers enforce.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { startStack, type Stack } from "../src/harness";
import { REGISTRATION_POST, isListed, messageLink, publishHalaqa, turnQueue, workerFailures } from "./helpers";

/** Far tighter than Telegram's ~20 messages a minute per group, to hit it quickly. */
const RATE_LIMIT = { sends: 2, windowMs: 3_000 };

/** The outage and the call count need the in-memory Convex (not TEST_CONVEX_URL). */
const emulated = !process.env.TEST_CONVEX_URL;

/** Workers Paid allows 1,000 subrequests (fetches to Telegram, Convex, Groq) per invocation. */
const SUBREQUEST_LIMIT = 1_000;

let stack: Stack;
beforeAll(async () => {
  stack = await startStack({ rateLimit: RATE_LIMIT });
}, 120_000);
afterAll(async () => {
  await stack?.stop();
});

describe("Telegram flood limits", () => {
  test("a post import that runs into 429s waits them out and still finds the post", async () => {
    const { sim, world } = stack;
    // Bury an old post among comments so finding it takes many forwards, more
    // than the rate limit allows at once.
    // Off-centre, so the binary search can't land on it first time.
    for (let i = 0; i < 2; i++) sim.sendUserMessage(world.groupId, world.students[0]!.id, `تعليق ${i}`);
    const { channelMessage, groupMessage } = sim.postToChannel(world.channelId, REGISTRATION_POST, { silent: true });
    for (let i = 0; i < 30; i++) sim.sendUserMessage(world.groupId, world.students[1]!.id, `تعليق آخر ${i}`);
    await stack.settle();

    const response = await stack.callApi(
      "/api/import-post",
      { chatId: world.groupId, link: messageLink(world.channelId, channelMessage.message_id) },
      { as: world.admin.id },
    );
    expect(response.status).toBe(200);
    const record = await stack.waitFor(async () => {
      const r = await stack.query(api.queries.getPostImport, { importId: response.body.importId });
      return r && ["completed", "failed"].includes(r.status) ? r : null;
    }, { message: "import to finish", timeoutMs: 90_000 });

    expect(record).toMatchObject({ status: "completed", postId: groupMessage!.message_id });
    // It really was throttled along the way.
    expect(sim.apiCalls.some((call) => call.description?.startsWith("Too Many Requests"))).toBe(true);
  }, 120_000);
});

describe.skipIf(!emulated)("a Convex outage", () => {
  test("updates during the outage fail cleanly and the bot carries on once Convex is back", async () => {
    const { sim, world, convex } = stack;
    convex!.setUnavailable(true);
    const { groupMessage: lost } = sim.postToChannel(world.channelId, REGISTRATION_POST);
    const apiDuringOutage = await stack.callApi(
      "/api/participant-list",
      { chatId: world.groupId, postId: 1, sessionNumber: 1 },
      { as: world.admin.id },
    );
    await stack.settle();
    convex!.setUnavailable(false);

    // Telegram was still answered (no redelivery storm), the web API failed
    // with a plain error, and the post from the outage is simply missing.
    expect(sim.deliveries.every((d) => d.status === "delivered")).toBe(true);
    expect(apiDuringOutage.status).toBe(500);
    expect(await isListed(stack, world.groupId, lost!.message_id)).toBe(false);

    // Back to normal.
    const postId = await publishHalaqa(stack);
    const comment = sim.sendUserMessage(world.groupId, world.students[0]!.id, "انا فاطمة احمد تسميع", { replyTo: postId });
    sim.react(world.groupId, comment.message_id, world.admin.id, ["👌"]);
    await stack.waitFor(async () => (await turnQueue(stack, postId)).activeUsers.length === 1, {
      message: "the bot to work again",
    });
  });
});

describe.skipIf(!emulated)("the subrequest budget", () => {
  test("/auto on a busy post stays well inside a single invocation's limit", async () => {
    const { sim, world, convex } = stack;
    const postId = await publishHalaqa(stack);
    const students = 30;
    for (let i = 0; i < students; i++) {
      const user = sim.addUser({ first_name: `Student ${i}` });
      const text = `انا طالبة رقم${(i + 1).toLocaleString("ar-EG")} محمد تسميع`;
      const message = sim.sendUserMessage(world.groupId, user.id, text, { replyTo: postId, deferred: true });
      await stack.mutation(api.mutations.addMessageAuthor, {
        chatId: world.groupId,
        postId,
        messageId: message.message_id,
        user: { id: user.id, first_name: user.first_name },
        messageText: text,
        channelId: world.channelId,
      });
    }
    await stack.settle();

    const before = { telegram: sim.apiCalls.length, convex: convex!.calls.length };
    sim.sendUserMessage(world.groupId, world.admin.id, "/auto", { replyTo: postId });
    await stack.waitFor(
      () => sim.history(world.groupId).find((m) => m.text?.includes("Batch classification complete")),
      { message: "the /auto summary", timeoutMs: 60_000 },
    );
    await stack.settle();
    const used = {
      telegram: sim.apiCalls.length - before.telegram,
      convex: convex!.calls.length - before.convex,
    };
    const total = used.telegram + used.convex + 1; // + the one LLM call
    const perStudent = total / students;
    console.log(
      `/auto with ${students} introductions: ${used.telegram} Telegram + ${used.convex} Convex + 1 Groq = ${total} ` +
        `subrequests (~${perStudent.toFixed(1)} per student; the limit allows ~${Math.floor(SUBREQUEST_LIMIT / perStudent)})`,
    );
    expect((await turnQueue(stack, postId)).activeUsers).toHaveLength(students);
    expect(total).toBeLessThan(SUBREQUEST_LIMIT / 2);
  }, 120_000);
});

test("the Worker logged no failures beyond the outage", async () => {
  await stack.settle();
  const outage = (line: string) => /Service Unavailable|503/.test(line);
  expect(workerFailures(stack).filter((line) => !outage(line))).toEqual([]);
});
