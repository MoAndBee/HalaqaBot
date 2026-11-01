/**
 * Previews of a branch: the bot (serving the web app) and the Telegram
 * simulator, built by Cloudflare as Worker Previews for every pull request
 * (see "Previews" in the README and bot/scripts/build-preview.ts).
 *
 *   bun scripts/preview.ts check <bot-url> <simulator-url>
 *       Smoke-tests a running preview the way a reviewer would use it; CI runs
 *       it once Cloudflare has posted the Preview URLs. Needs
 *       PREVIEW_CONTROL_TOKEN (the simulator's SIM_CONTROL_TOKEN).
 *
 *   bun scripts/preview.ts local
 *       Runs the same two Workers, in the same preview mode, under
 *       `wrangler dev`, then checks them. Needs CONVEX_DEPLOY_KEY (a dev key)
 *       and PREVIEW_CONVEX_AUTH_PRIVATE_KEY (set as that deployment's
 *       CONVEX_AUTH_JWKS here). Ctrl+C to stop.
 */
import path from "node:path";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "@halakabot/db";
import { jwksForPrivateKey } from "../../bot/src/convex-auth";
import { deployConvexAndBuildWebApp, previewConfig } from "../../bot/scripts/build-preview";

const ROOT = path.resolve(import.meta.dir, "../../..");
const BOT_DIR = path.join(ROOT, "packages/bot");
const SIM_DIR = path.join(ROOT, "packages/testing");
const DB_DIR = path.join(ROOT, "packages/db");
const OUT_DIR = path.join(SIM_DIR, ".preview");
const WRANGLER = path.join(BOT_DIR, "node_modules/.bin/wrangler");

const REGISTRATION_POST = "حللتم أهلا ونزلتم سهلا 🌸\nسجلي اسمك للحلقة";

function env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

async function waitFor<T>(what: string, check: () => Promise<T | null | undefined | false>, timeoutMs = 60_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await Bun.sleep(1_000);
  }
  throw new Error(`Timed out waiting for ${what}${lastError ? `: ${lastError}` : ""}`);
}

/**
 * Checks a running preview end to end: the bot registered the simulated
 * channel, a sign-up reaches the turn list, the Mini App signs in, and the bot
 * serves the web app. On a fresh world it leaves that example halaqa behind.
 */
export async function check(urls: { bot: string; sim: string }, control: string): Promise<string[]> {
  async function sim(route: string, body?: unknown): Promise<any> {
    const response = await fetch(`${urls.sim}/sim/${route}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${control}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`/sim/${route}: ${response.status} ${JSON.stringify(data)}`);
    return data;
  }
  const checks: string[] = [];

  // The first request connects the simulator to the bot.
  const state = await waitFor("the simulator to answer", () => sim("state"), 120_000);
  if (!state.webhook) throw new Error("The simulator isn't connected to the bot (no webhook)");
  const channel = state.chats.find((c: any) => c.type === "channel");
  const groupId = channel.linked_chat_id;
  const admin = state.users.find((u: any) => !u.is_bot && channel.members[u.id] === "administrator");
  const student = state.users.find((u: any) => !u.is_bot && !channel.members[u.id]);

  // Convex, signed in as the admin through the bot, like the Mini App.
  const { convexUrl } = await (await fetch(`${urls.bot}/preview/info`)).json() as { convexUrl: string };
  const { initData, url: miniAppUrl } = await sim("mini-app", { userId: admin.id });
  const tokenResponse = await fetch(`${urls.bot}/api/auth/token`, {
    method: "POST",
    headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!tokenResponse.ok) throw new Error(`/api/auth/token answered ${tokenResponse.status}`);
  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(((await tokenResponse.json()) as { token: string }).token);

  await waitFor("the bot to register the channel", async () => {
    const channels = await convex.query("queries:getMyChannels" as any, { userId: admin.id });
    return channels.length > 0;
  });
  checks.push("bot registered the simulated channel and its admins");

  if (state.chats.find((c: any) => c.id === groupId).messageCount === 0) {
    const { groupMessage } = await sim("channel-posts", { channelId: channel.id, text: REGISTRATION_POST });
    const postId = groupMessage.message_id;
    const comment = await sim("messages", { chatId: groupId, userId: student.id, text: "انا فاطمة احمد تسميع", replyTo: postId });
    await sim("reactions", { chatId: groupId, messageId: comment.message_id, userId: admin.id, emojis: ["👌"] });
    await waitFor("the student to be added", async () => {
      const list = await convex.query("queries:getUserList" as any, { chatId: groupId, postId });
      return list.activeUsers.length === 1;
    });
    checks.push("registration post → sign-up → 👌 → student on the list");
  }
  checks.push("Mini App sign-in issues a Convex token");

  const page = await fetch(miniAppUrl);
  if (!page.ok || !(await page.text()).includes('id="root"')) throw new Error(`The web app isn't served at ${miniAppUrl}`);
  checks.push("web app served by the bot Worker");
  return checks;
}

async function local() {
  const urls = { bot: "http://127.0.0.1:8802", sim: "http://127.0.0.1:8801" };
  const control = process.env.PREVIEW_CONTROL_TOKEN ?? "local";
  const privateKey = env("PREVIEW_CONVEX_AUTH_PRIVATE_KEY");
  const botToken = `7${Date.now() % 1_000_000_000}:LOCAL-${crypto.randomUUID()}`;
  const webhookSecret = crypto.randomUUID();
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("Convex and the web app…");
  await Bun.spawn(["bunx", "convex", "env", "set", "CONVEX_AUTH_JWKS", jwksForPrivateKey(privateKey)], {
    cwd: DB_DIR,
    stdout: "ignore",
  }).exited;
  const convexUrl = await deployConvexAndBuildWebApp("local", env("CONVEX_DEPLOY_KEY"));

  // `wrangler dev` runs a Worker's top-level settings, so the preview vars go there.
  const bot = previewConfig();
  const botConfig = { ...bot, vars: bot.previews.vars };
  const workers = [
    {
      name: "simulator",
      port: 8801,
      cwd: SIM_DIR,
      config: path.join(SIM_DIR, "wrangler.toml"),
      vars: { SIM_BOT_TOKEN: botToken, SIM_CONTROL_TOKEN: control, SIM_WEBHOOK_SECRET: webhookSecret, SIM_BOT_URL: urls.bot },
    },
    {
      name: "bot",
      port: 8802,
      cwd: OUT_DIR,
      config: path.join(OUT_DIR, "bot.json"),
      vars: {
        BOT_TOKEN: botToken,
        TELEGRAM_WEBHOOK_SECRET: webhookSecret,
        CONVEX_URL: convexUrl,
        CONVEX_AUTH_PRIVATE_KEY: privateKey,
        TELEGRAM_API_ROOT: urls.sim,
      },
    },
  ];
  writeFileSync(path.join(OUT_DIR, "bot.json"), JSON.stringify(botConfig, null, 2));

  const processes: ReturnType<typeof Bun.spawn>[] = [];
  const varsFiles: string[] = [];
  process.on("exit", () => {
    processes.forEach((p) => p.kill());
    varsFiles.forEach((file) => rmSync(file, { force: true }));
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => process.exit(0));
  for (const worker of workers) {
    const varsFile = path.join(OUT_DIR, `${worker.name}.dev.vars`);
    // Single-quoted: taken literally, JSON keys and all.
    writeFileSync(varsFile, Object.entries(worker.vars).map(([k, v]) => `${k}='${v}'`).join("\n"), { mode: 0o600 });
    varsFiles.push(varsFile);
    processes.push(
      Bun.spawn(
        [WRANGLER, "dev", "--config", worker.config, "--env-file", varsFile, "--ip", "127.0.0.1",
          "--port", String(worker.port), "--inspector-port", String(worker.port + 100),
          "--persist-to", path.join(OUT_DIR, "state"), "--show-interactive-dev-session=false"],
        { cwd: worker.cwd, stdout: process.env.VERBOSE ? "inherit" : "ignore", stderr: "inherit" },
      ),
    );
  }
  await waitFor("both Workers to start", async () => {
    const up = await Promise.all([urls.sim, urls.bot].map((u) => fetch(`${u}/`).then((r) => r.ok).catch(() => false)));
    return up.every(Boolean);
  }, 90_000);

  for (const line of await check(urls, control)) console.log(`  ✓ ${line}`);
  console.log(`\nSimulator: ${urls.sim}/#token=${control}\nWeb app:   ${urls.bot}\nCtrl+C to stop.`);
  if (process.env.PREVIEW_EXIT_AFTER_CHECK) process.exit(0);
  await new Promise(() => {});
}

const [command, ...args] = process.argv.slice(2);
if (command === "check" && args.length === 2) {
  const [bot, sim] = args.map((u) => u!.replace(/\/$/, ""));
  const checks = await check({ bot: bot!, sim: sim! }, env("PREVIEW_CONTROL_TOKEN"));
  for (const line of checks) console.log(`✓ ${line}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `checks=${checks.join("; ")}\n`);
} else if (command === "local") {
  await local();
} else {
  console.error("usage: bun scripts/preview.ts check <bot-url> <simulator-url> | local");
  process.exit(2);
}
