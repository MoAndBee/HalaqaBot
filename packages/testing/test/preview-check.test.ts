import { expect, test } from "bun:test";
import { check } from "../scripts/preview";
import { startStack, type Stack } from "../src/harness";
import { publishHalaqa, turnQueue } from "./helpers";

test("every preview smoke check proves a fresh signup without resetting existing reviewer data", async () => {
  let stack: Stack | undefined;
  // The harness runs the regular Worker with local queues. Supply only the
  // preview-info route and static app entry that the smoke checker consumes;
  // authentication and every Telegram/signup/database operation remain real.
  const front = Bun.serve({
    port: 0,
    async fetch(request) {
      if (!stack) return new Response("Starting", { status: 503 });
      const url = new URL(request.url);
      if (url.pathname === "/preview/info") return Response.json({ convexUrl: stack.convexUrl });
      if (url.pathname === "/") return new Response('<div id="root"></div>');
      const response = await fetch(new Request(new URL(url.pathname + url.search, stack.workerUrl), request));
      const headers = new Headers(response.headers);
      // fetch has already decompressed the upstream body before we relay it.
      headers.delete("content-encoding");
      headers.delete("content-length");
      return new Response(response.body, { status: response.status, headers });
    },
  });
  try {
    stack = await startStack({ webAppUrl: front.url.origin });
    const { world, sim } = stack;
    const originalPost = await publishHalaqa(stack);
    const comment = sim.sendUserMessage(world.groupId, world.students[0]!.id, "انا فاطمة احمد تسميع", {
      replyTo: originalPost,
    });
    sim.react(world.groupId, comment.message_id, world.admin.id, ["👌"]);
    await stack.waitFor(async () => (await turnQueue(stack!, originalPost)).activeUsers.length === 1);

    const originalList = await turnQueue(stack, originalPost);
    const posts = () => sim.history(world.groupId).filter(message => message.is_automatic_forward);
    const initialPostCount = posts().length;
    for (let run = 1; run <= 2; run++) {
      const checks = await check({ bot: front.url.origin, sim: stack.simulatorUrl }, "local-test");
      expect(checks).toContain("registration post → sign-up → 👌 → student on the list");
      expect(posts()).toHaveLength(initialPostCount + run);
      expect(await turnQueue(stack, originalPost)).toEqual(originalList);
    }
  } finally {
    await stack?.stop();
    front.stop(true);
  }
}, 120_000);
