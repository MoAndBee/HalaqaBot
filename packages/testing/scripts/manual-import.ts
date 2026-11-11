/** A separate, disposable world for manually investigating the cloud import timeout. */
import path from "node:path";
import { startStack, type Stack } from "../src/harness";
import { REGISTRATION_POST, messageLink } from "../test/helpers";

if (!process.env.TEST_CONVEX_URL || !process.env.TEST_CONVEX_AUTH_PRIVATE_KEY) {
  throw new Error("Load your private dev configuration with --env-file=.env.sim.local");
}

let stack: Stack | undefined;
let vite: ReturnType<typeof Bun.spawn> | undefined;
let diagnostics: ReturnType<typeof setInterval> | undefined;
async function stop() {
  clearInterval(diagnostics);
  vite?.kill();
  await stack?.stop();
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => { await stop(); process.exit(0); });
}

try {
  console.log("Preparing a separate old-post import case; your simulator on 8790 is unchanged.");
  const throttled = process.env.MANUAL_IMPORT_THROTTLED !== "0";
  stack = await startStack({
    simulatorPort: 8791,
    workerPort: 8788,
    webAppUrl: "http://localhost:3001",
    rateLimit: throttled ? { sends: 2, windowMs: 3_000 } : undefined,
  });
  const active = stack;
  vite = Bun.spawn([
    path.resolve(import.meta.dir, "../../web/node_modules/.bin/vite"),
    "dev", "--host", "127.0.0.1", "--port", "3001", "--strictPort",
  ], {
    cwd: path.resolve(import.meta.dir, "../../web"),
    env: { ...process.env, VITE_CONVEX_URL: active.convexUrl, VITE_BOT_API_URL: active.workerUrl },
    stdout: "inherit", stderr: "inherit",
  });
  process.once("exit", () => vite?.kill());
  await active.waitFor(() => fetch("http://localhost:3001/").then((r) => r.ok), {
    message: "the separate Mini App server", timeoutMs: 30_000,
  });

  const { sim, world } = active;
  for (let i = 0; i < 2; i++) sim.sendUserMessage(world.groupId, world.students[0]!.id, `تعليق ${i}`);
  // Silent means Telegram has the old post, but never delivered its update to the bot.
  const { channelMessage } = sim.postToChannel(world.channelId, REGISTRATION_POST, { silent: true });
  for (let i = 0; i < 30; i++) sim.sendUserMessage(world.groupId, world.students[1]!.id, `تعليق آخر ${i}`);
  await active.settle({ timeoutMs: 90_000 });

  console.log(`
READY — manual import case (${throttled ? "2 sends / 3 seconds" : "no rate limit"})
Simulator: ${active.simulatorUrl}
Old post link to paste: ${messageLink(world.channelId, channelMessage.message_id)}

Act as the admin, close the simulator panel, open الحلقات → إضافة حلقة قديمة.
Paste the link into رابط المنشور and click إضافة. Do not use the discovered-post
shortcut: that bypasses the Telegram lookup we are investigating.
Time the result at 30, 60, 90 and 180 seconds. No real Telegram is contacted.
Ctrl+C stops this separate case. Restarting creates a fresh case.
`);

  let previous = "";
  diagnostics = setInterval(() => {
    const forwards = sim.apiCalls.filter((call) => call.method === "forwardMessage");
    const limited = sim.apiCalls.filter((call) => call.description?.startsWith("Too Many Requests"));
    const failed = active.workerLog.filter((line) => /job failed|Uncaught/.test(line));
    const state = `forwards=${forwards.length}, rate-limited calls=${limited.length}, pending Telegram updates=${sim.pendingUpdateCount}, failed jobs=${failed.length}`;
    if (state !== previous) { console.log(new Date().toISOString(), state); previous = state; }
  }, 2_000);
} catch (error) {
  await stop();
  throw error;
}
