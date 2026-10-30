/**
 * `bun run sim`: the whole bot running locally against the Telegram simulator,
 * for trying things by hand. Open the dashboard to act as users.
 *
 *   bun run sim                         in-memory Convex (bot only)
 *   TEST_CONVEX_URL=<dev deployment> TEST_CONVEX_AUTH_PRIVATE_KEY=<its key> bun run sim
 *                                       real Convex, so the web app works too:
 *                                       run it with VITE_CONVEX_URL set to the
 *                                       same deployment and VITE_BOT_API_URL to
 *                                       the Worker URL printed below
 */
import { startStack, type Stack } from "./harness";

// Ctrl+C, or a process manager stopping us — even mid-startup, when there's no
// stack yet (exiting then still stops wrangler: the harness kills it on exit).
let stack: Stack | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await stack?.stop();
    process.exit(0);
  });
}

stack = await startStack({
  simulatorPort: Number(process.env.SIM_PORT ?? 8790),
  workerPort: Number(process.env.WORKER_PORT ?? 8787),
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:3000",
  verbose: process.env.VERBOSE === "1",
});

const { world } = stack;
console.log(`
Telegram simulator  ${stack.simulatorUrl}   ← open this
Bot Worker          ${stack.workerUrl}
Convex              ${stack.convex ? "in-memory emulator (web app needs a real deployment: set TEST_CONVEX_URL)" : stack.convexUrl}

Cast: ${world.owner.first_name} (channel owner, ${world.owner.id}), ${world.admin.first_name} ${world.admin.last_name} (admin, ${world.admin.id}),
      students ${world.students.map((s) => `${s.first_name} (${s.id})`).join(", ")}
Channel ${world.channelId} → discussion group ${world.groupId}

Try: publish a registration post in the channel, comment in the group as a
student ("انا فاطمة احمد تسميع"), then react 👌 as an admin.
Set VERBOSE=1 to see the Worker's log. Ctrl+C to stop.
`);

