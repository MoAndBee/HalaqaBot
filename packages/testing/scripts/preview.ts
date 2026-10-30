/**
 * A preview of the whole system that needs no Telegram account: the bot, the
 * Telegram simulator it talks to instead of Telegram, the web app and a Convex
 * deployment, all for one name (one per pull request in CI, see
 * .github/workflows/preview.yml).
 *
 *   bun scripts/preview.ts deploy <name>     create or update
 *   bun scripts/preview.ts destroy <name>    remove the Workers and queues
 *   bun scripts/preview.ts local <name>      the same two Workers under
 *                                            `wrangler dev`, against the Convex
 *                                            deployment CONVEX_DEPLOY_KEY names
 *
 * What it deploys, for name "pr-12":
 *   halaqabot-pr-12        the bot Worker, with its own queues, also serving
 *                          the web app (so /api is same-origin)
 *   halaqabot-sim-pr-12    the simulator Worker: the dashboard to drive it all
 *   Convex                 a preview deployment named "pr-12" (with a preview
 *                          deploy key), or a shared dev deployment (dev key)
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   for wrangler
 *   CONVEX_DEPLOY_KEY            a preview deploy key, or a dev deploy key
 *   PREVIEW_CONVEX_AUTH_PRIVATE_KEY   signing key the Convex deployment trusts:
 *                                its public half must be CONVEX_AUTH_JWKS (for
 *                                previews, a default environment variable)
 *   PREVIEW_CONTROL_TOKEN        guards the simulator's controls; the bot token
 *                                and webhook secret are derived from it
 *   PREVIEW_ID_OFFSET            optional: shifts the simulated IDs, so
 *                                previews sharing a dev deployment don't meet
 *   GITHUB_OUTPUT                optional: where to write the URLs for CI
 */
import path from "node:path";
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, rmSync } from "node:fs";
import { Api } from "grammy";
import { ConvexHttpClient } from "@halakabot/db";
import { configureTelegram } from "../../bot/src/setup";
import { BOT_SUBJECT, importSigningKey, jwksForPrivateKey, signToken } from "../../bot/src/convex-auth";

const ROOT = path.resolve(import.meta.dir, "../../..");
const BOT_DIR = path.join(ROOT, "packages/bot");
const SIM_DIR = path.join(ROOT, "packages/testing");
const DB_DIR = path.join(ROOT, "packages/db");
const WEB_DIR = path.join(ROOT, "packages/web");
const OUT_DIR = path.join(SIM_DIR, ".preview");

const REGISTRATION_POST = "حللتم أهلا ونزلتم سهلا 🌸\nسجلي اسمك للحلقة";

const [command, name] = process.argv.slice(2);
if (!["deploy", "destroy", "local"].includes(command ?? "") || !name || !/^[a-z0-9-]{1,30}$/.test(name)) {
  console.error("usage: bun scripts/preview.ts deploy|destroy|local <name: lowercase letters, digits, dashes>");
  process.exit(2);
}

const names = {
  bot: `halaqabot-${name}`,
  sim: `halaqabot-sim-${name}`,
  queues: ["updates", "imports", "dead-letters"].map((q) => `halaqabot-${name}-${q}`),
};

function env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

/** Runs a command, failing loudly with its output. Secrets never go on the command line. */
async function run(
  cmd: string[],
  options: { cwd: string; env?: Record<string, string>; unset?: string[]; allowFailure?: RegExp },
) {
  const childEnv: Record<string, string | undefined> = { ...process.env, ...options.env };
  for (const key of options.unset ?? []) delete childEnv[key];
  const proc = Bun.spawn(cmd, {
    cwd: options.cwd,
    env: childEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0 && !(options.allowFailure && options.allowFailure.test(out + err))) {
    throw new Error(`${cmd.slice(0, 3).join(" ")} failed (${code}):\n${out}\n${err}`);
  }
  return out;
}
const wrangler = (args: string[], options: Parameters<typeof run>[1]) =>
  run([path.join(BOT_DIR, "node_modules/.bin/wrangler"), ...args], options);

/** Stable per preview, so redeploys keep links and the simulated world working. */
async function derive(label: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("PREVIEW_CONTROL_TOKEN")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${name}:${label}`)));
  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function workersSubdomain(): Promise<string> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/workers/subdomain`,
    { headers: { Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}` } },
  );
  const body = (await response.json()) as { success: boolean; result?: { subdomain: string } };
  if (!body.success || !body.result) throw new Error(`Couldn't read the workers.dev subdomain: ${JSON.stringify(body)}`);
  return body.result.subdomain;
}

/** Pushes the Convex functions and returns the deployment's URL. */
async function deployConvex(): Promise<string> {
  const deployKey = env("CONVEX_DEPLOY_KEY");
  const jwks = jwksForPrivateKey(env("PREVIEW_CONVEX_AUTH_PRIVATE_KEY"));
  const convexEnv = { CONVEX_DEPLOY_KEY: deployKey };

  if (deployKey.startsWith("preview:")) {
    // A deployment of its own, created on first push. It gets CONVEX_AUTH_JWKS
    // from the project's default environment variables for previews (Convex
    // won't push auth.config.ts without it); setting it again keeps it in step
    // with PREVIEW_CONVEX_AUTH_PRIVATE_KEY.
    const urlFile = path.join(OUT_DIR, "convex-url");
    await run(
      ["bunx", "convex", "deploy", "--preview-create", name!, "--typecheck", "disable",
        "--cmd-url-env-var-name", "PREVIEW_CONVEX_URL", "--cmd", `printenv PREVIEW_CONVEX_URL > ${urlFile}`],
      { cwd: DB_DIR, env: convexEnv },
    );
    await run(["bunx", "convex", "env", "set", "--preview-name", name!, "CONVEX_AUTH_JWKS", jwks], { cwd: DB_DIR, env: convexEnv });
    return readFileSync(urlFile, "utf8").trim();
  }

  // A shared dev deployment (Convex's free plan has no previews): the last
  // preview deployed decides which functions run there.
  const deployment = deployKey.match(/^dev:([a-z0-9-]+)\|/)?.[1];
  if (!deployment) throw new Error("CONVEX_DEPLOY_KEY must be a preview or dev deploy key");
  await run(["bunx", "convex", "env", "set", "CONVEX_AUTH_JWKS", jwks], { cwd: DB_DIR, env: convexEnv });
  await run(["bunx", "convex", "dev", "--once", "--typecheck", "disable"], { cwd: DB_DIR, env: convexEnv });
  return `https://${deployment}.convex.cloud`;
}

function botConfig(simUrl: string) {
  const consumer = (queue: string) => ({
    queue,
    max_batch_size: 1,
    max_concurrency: 1,
    max_retries: 2,
    retry_delay: 10,
    dead_letter_queue: names.queues[2],
  });
  return {
    name: names.bot,
    main: path.join(BOT_DIR, "src/worker.ts"),
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
    workers_dev: true,
    queues: {
      producers: [
        { binding: "UPDATES", queue: names.queues[0] },
        { binding: "IMPORTS", queue: names.queues[1] },
      ],
      consumers: [consumer(names.queues[0]!), consumer(names.queues[1]!)],
    },
    triggers: { crons: ["17 * * * *"] },
    rules: [{ type: "Data", globs: ["**/*.jpeg"], fallthrough: true }],
    // The web app, served by the bot itself: same origin as /api, no other host.
    assets: {
      directory: path.join(WEB_DIR, "dist"),
      not_found_handling: "single-page-application",
      run_worker_first: ["/api/*", "/telegram"],
    },
    observability: { enabled: true },
    vars: {
      TELEGRAM_API_ROOT: simUrl,
      GROQ_BASE_URL: `${simUrl}/groq/openai/v1`,
    },
  };
}

function simConfig(botUrl: string) {
  return {
    name: names.sim,
    main: path.join(SIM_DIR, "src/sim-worker.ts"),
    compatibility_date: "2026-09-01",
    compatibility_flags: ["global_fetch_strictly_public"],
    workers_dev: true,
    vars: { SIM_WEB_APP_URL: botUrl, SIM_ID_OFFSET: process.env.PREVIEW_ID_OFFSET ?? "0" },
    durable_objects: { bindings: [{ name: "SIMULATOR", class_name: "Simulator" }] },
    migrations: [{ tag: "v1", new_sqlite_classes: ["Simulator"] }],
  };
}

/** Writes a wrangler config and secrets file, deploys, and cleans the secrets up. */
async function deployWorker(config: { name: string }, secrets: Record<string, string>) {
  const configFile = path.join(OUT_DIR, `${config.name}.json`);
  const secretsFile = path.join(OUT_DIR, `${config.name}.secrets.json`);
  writeFileSync(configFile, JSON.stringify(config, null, 2));
  writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
  try {
    // Wrangler lets the environment override the secrets file; it mustn't.
    await wrangler(["deploy", "--config", configFile, "--secrets-file", secretsFile], {
      cwd: OUT_DIR,
      unset: Object.keys(secrets),
    });
  } finally {
    rmSync(secretsFile, { force: true });
  }
}

async function controlApi(simUrl: string, control: string) {
  return async function sim(route: string, body?: unknown): Promise<any> {
    const response = await fetch(`${simUrl}/sim/${route}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${control}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`/sim/${route}: ${response.status} ${JSON.stringify(data)}`);
    return data;
  };
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
 * Checks the deployed preview end to end, the way a reviewer would use it. On a
 * fresh world it also leaves an example halaqa behind: a registration post and
 * an approved sign-up.
 */
async function smokeTest(urls: { sim: string; bot: string }, control: string, convexUrl: string): Promise<string[]> {
  const sim = await controlApi(urls.sim, control);
  const checks: string[] = [];
  const state = await sim("state");
  const channel = state.chats.find((c: any) => c.type === "channel");
  const groupId = channel.linked_chat_id;
  const admin = state.users.find((u: any) => !u.is_bot && channel.members[u.id] === "administrator");
  const student = state.users.find((u: any) => !u.is_bot && !channel.members[u.id]);

  const convex = new ConvexHttpClient(convexUrl);
  const signing = await importSigningKey(env("PREVIEW_CONVEX_AUTH_PRIVATE_KEY"));
  convex.setAuth((await signToken(signing, BOT_SUBJECT, 600)).token);

  // The bot heard it was added to the channel and registered it with its admins.
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

  // The Mini App's sign-in: simulated Telegram initData → a Convex token.
  const { initData, url } = await sim("mini-app", { userId: admin.id });
  const tokenResponse = await fetch(`${urls.bot}/api/auth/token`, {
    method: "POST",
    headers: { Authorization: `tma ${initData}`, Origin: urls.bot, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!tokenResponse.ok) throw new Error(`/api/auth/token answered ${tokenResponse.status}`);
  checks.push("Mini App sign-in issues a Convex token");

  const page = await fetch(url);
  if (!page.ok || !(await page.text()).includes('id="root"')) throw new Error(`The web app isn't served at ${url}`);
  checks.push("web app served by the bot Worker");
  return checks;
}

/** What both the deployed and the local preview are made of. */
async function prepare(urls: { bot: string; sim: string }) {
  mkdirSync(OUT_DIR, { recursive: true });
  const control = env("PREVIEW_CONTROL_TOKEN");
  const botToken = `${7_000_000_000 + (parseInt((await derive("bot")).slice(0, 6), 16) % 1_000_000)}:${await derive("token")}`;
  const webhookSecret = (await derive("webhook")).slice(0, 48);

  console.log(`Convex…`);
  const convexUrl = await deployConvex();

  console.log(`Web app…`);
  await run(["bunx", "vite", "build"], {
    cwd: WEB_DIR,
    env: { VITE_CONVEX_URL: convexUrl, VITE_BOT_API_URL: urls.bot },
  });

  const sim = { config: simConfig(urls.bot), secrets: { SIM_BOT_TOKEN: botToken, SIM_CONTROL_TOKEN: control } };
  const bot = {
    config: botConfig(urls.sim),
    secrets: {
    BOT_TOKEN: botToken,
    CONVEX_URL: convexUrl,
    CONVEX_AUTH_PRIVATE_KEY: env("PREVIEW_CONVEX_AUTH_PRIVATE_KEY"),
    TELEGRAM_WEBHOOK_SECRET: webhookSecret,
    WEB_APP_URL: urls.bot,
    GROQ_API_KEY: "simulated",
    // The simulated world's channel and scratch group (see src/world.ts).
    CHANNEL_ID: String(-1001000000001 - Number(process.env.PREVIEW_ID_OFFSET ?? 0)),
    FORWARD_CHAT_ID: String(-1001000000003 - Number(process.env.PREVIEW_ID_OFFSET ?? 0)),
    },
  };
  return { control, botToken, webhookSecret, convexUrl, sim, bot };
}

/** Points the simulator's webhook at the bot, then checks the whole thing. */
async function connectAndCheck(
  urls: { bot: string; sim: string },
  { control, botToken, webhookSecret, convexUrl }: Awaited<ReturnType<typeof prepare>>,
): Promise<string[]> {
  console.log(`Connecting the bot to the simulator…`);
  // Fresh workers.dev hostnames can take a moment to resolve.
  await waitFor("the simulator to answer", async () => (await fetch(`${urls.sim}/sim/state`, {
    headers: { Authorization: `Bearer ${control}` },
  })).ok);
  await configureTelegram(new Api(botToken, { apiRoot: urls.sim }), {
    workerUrl: urls.bot,
    secret: webhookSecret,
    webAppUrl: urls.bot,
  });

  console.log(`Smoke test…`);
  const checks = await smokeTest(urls, control, convexUrl);
  for (const check of checks) console.log(`  ✓ ${check}`);
  return checks;
}

async function deploy() {
  const subdomain = process.env.WORKERS_SUBDOMAIN ?? (await workersSubdomain());
  const urls = {
    bot: `https://${names.bot}.${subdomain}.workers.dev`,
    sim: `https://${names.sim}.${subdomain}.workers.dev`,
  };
  const parts = await prepare(urls);

  console.log(`Queues…`);
  for (const queue of names.queues) {
    await wrangler(["queues", "create", queue], { cwd: BOT_DIR, allowFailure: /already (exists|taken)/i });
  }
  console.log(`Simulator Worker…`);
  await deployWorker(parts.sim.config, parts.sim.secrets);
  console.log(`Bot Worker…`);
  await deployWorker(parts.bot.config, parts.bot.secrets);

  const checks = await connectAndCheck(urls, parts);
  const convexUrl = parts.convexUrl;
  console.log(`\nDashboard: ${urls.sim}\nWeb app:   ${urls.bot}\nConvex:    ${convexUrl}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [`dashboard=${urls.sim}`, `web_app=${urls.bot}`, `convex=${convexUrl}`, `checks=${checks.join("; ")}`]
        .map((line) => `${line}\n`)
        .join(""),
    );
  }
}

async function destroy() {
  // The bot first: its queue consumers must go before the queues can.
  for (const worker of [names.bot, names.sim]) {
    await wrangler(["delete", worker, "--force"], { cwd: BOT_DIR, allowFailure: /not found|does not exist|10007/i });
  }
  for (const queue of names.queues) {
    await wrangler(["queues", "delete", queue], { cwd: BOT_DIR, allowFailure: /not found|does not exist|11000/i });
  }
  console.log(`Removed ${names.bot}, ${names.sim} and their queues. Convex previews expire on their own.`);
}

/**
 * The preview's two Workers under `wrangler dev` (local queues, Durable Object
 * and assets), with the same configs and checks as a deploy. Ctrl+C to stop.
 */
async function local() {
  const urls = { bot: "http://127.0.0.1:8802", sim: "http://127.0.0.1:8801" };
  const parts = await prepare(urls);
  const processes: ReturnType<typeof Bun.spawn>[] = [];
  const varsFiles: string[] = [];
  const stopAll = () => {
    processes.forEach((p) => p.kill());
    varsFiles.forEach((file) => rmSync(file, { force: true }));
  };
  process.on("exit", stopAll);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => process.exit(0));

  for (const [part, port] of [[parts.sim, 8801], [parts.bot, 8802]] as const) {
    const configFile = path.join(OUT_DIR, `${part.config.name}.json`);
    const varsFile = path.join(OUT_DIR, `${part.config.name}.dev.vars`);
    writeFileSync(configFile, JSON.stringify(part.config, null, 2));
    // Single-quoted: taken literally, JSON keys and all.
    writeFileSync(varsFile, Object.entries(part.secrets).map(([k, v]) => `${k}='${v}'`).join("\n"), { mode: 0o600 });
    varsFiles.push(varsFile);
    const proc = Bun.spawn(
      [path.join(BOT_DIR, "node_modules/.bin/wrangler"), "dev", "--config", configFile, "--env-file", varsFile,
        "--ip", "127.0.0.1", "--port", String(port), "--inspector-port", String(port + 100),
        "--persist-to", path.join(OUT_DIR, "state"), "--show-interactive-dev-session=false"],
      { cwd: OUT_DIR, stdout: process.env.VERBOSE ? "inherit" : "ignore", stderr: "inherit" },
    );
    processes.push(proc);
  }
  await waitFor("both Workers to start", async () => {
    const answers = await Promise.all([fetch(`${urls.sim}/`), fetch(`${urls.bot}/`)].map((p) => p.then((r) => r.ok).catch(() => false)));
    return answers.every(Boolean);
  }, 90_000);

  await connectAndCheck(urls, parts);
  console.log(`\nDashboard: ${urls.sim}/#token=${parts.control}\nWeb app:   ${urls.bot}\nCtrl+C to stop.`);
  if (process.env.PREVIEW_EXIT_AFTER_CHECK) process.exit(0);
  await new Promise(() => {});
}

await (command === "deploy" ? deploy() : command === "local" ? local() : destroy());
