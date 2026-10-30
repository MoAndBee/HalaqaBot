/**
 * Starts the whole bot stack locally, with nothing external:
 *
 *   Telegram simulator + fake Groq   (in this process)
 *   Convex                           (in-memory emulator, or a real deployment)
 *   the bot Worker                   (`wrangler dev`, real workerd + local queues)
 *
 * then wires them together the way production is wired: the webhook is set
 * with the bot's own configureTelegram(), and the cron runs once, as it would
 * after a deploy. Used by the scenario tests and by `bun run sim`.
 */
import path from "node:path";
import os from "node:os";
import { rmSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { Api } from "grammy";
import { ConvexHttpClient } from "@halakabot/db";
import type { FunctionReference } from "convex/server";
import { configureTelegram } from "../../bot/src/setup";
import { createConvexEmulator, type ConvexEmulator } from "./convex-emulator";
import { TelegramSimulator } from "./telegram/simulator";
import { createWorld, type World } from "./world";
import { createSimulatorHandler } from "./telegram/server";

const BOT_DIR = path.resolve(import.meta.dir, "../../bot");

export type { World };

export interface StackOptions {
  /**
   * Use a real Convex deployment instead of the in-memory emulator. Defaults to
   * TEST_CONVEX_URL, so `TEST_CONVEX_URL=... bun run test` runs every scenario
   * against it (push the functions there first).
   */
  convexUrl?: string;
  /** Origin allowed to call the bot's /api/* (the web app's dev server). */
  webAppUrl?: string;
  /** Fixed ports, for `bun run sim`; tests use free ones. */
  simulatorPort?: number;
  workerPort?: number;
  /** Echo the Worker's log to stdout. */
  verbose?: boolean;
  /** Telegram flood limits for the simulator (see SimulatorOptions.rateLimit). */
  rateLimit?: { sends: number; windowMs: number };
}

export interface Stack {
  sim: TelegramSimulator;
  world: World;
  /** The in-memory emulator; null when running against a real Convex deployment. */
  convex: ConvexEmulator | null;
  convexUrl: string;
  /** Convex functions, called over HTTP in either mode. */
  query<F extends FunctionReference<"query">>(fn: F, args: F["_args"]): Promise<F["_returnType"]>;
  mutation<F extends FunctionReference<"mutation">>(fn: F, args: F["_args"]): Promise<F["_returnType"]>;
  simulatorUrl: string;
  workerUrl: string;
  /** Lines the Worker printed. */
  workerLog: string[];
  /** Calls the bot's web API as a simulated user, like the Mini App does. */
  callApi(path: string, body: unknown, options: { as: number }): Promise<{ status: number; body: any }>;
  /** Runs the Worker's cron handler. */
  runCron(): Promise<void>;
  /** Simulates Telegram being unreachable from the bot until set back to false. */
  setTelegramUnavailable(unavailable: boolean): void;
  /** Waits until updates are delivered and the bot has stopped making calls. */
  settle(options?: { quietMs?: number; timeoutMs?: number }): Promise<void>;
  waitFor<T>(check: () => T | Promise<T>, options?: { timeoutMs?: number; message?: string }): Promise<NonNullable<T>>;
  stop(): Promise<void>;
}

async function freePort(): Promise<number> {
  const server = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = server.port!;
  server.stop(true);
  return port;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startStack(options: StackOptions = {}): Promise<Stack> {
  options = { ...options, convexUrl: options.convexUrl ?? process.env.TEST_CONVEX_URL };
  const botToken = `${7_000_000_000 + Math.floor(Math.random() * 1_000_000)}:SIM-${crypto.randomUUID()}`;
  const webhookSecret = crypto.randomUUID();
  const webAppUrl = options.webAppUrl ?? "http://localhost:3000";

  // A real deployment keeps earlier runs' data; start this run's IDs elsewhere.
  const offset = options.convexUrl ? Math.floor(Math.random() * 1e6) * 1000 : 0;
  const sim = new TelegramSimulator({
    botToken,
    retryDelayMs: 100,
    rateLimit: options.rateLimit,
    firstUserId: 100001 + offset,
    firstChatId: -1001000000001 - offset,
  });
  const world = createWorld(sim);
  const simHandler = createSimulatorHandler(sim, { webAppUrl });
  const simServer = Bun.serve({ port: options.simulatorPort ?? 0, fetch: simHandler.handle, idleTimeout: 0 });
  const simulatorUrl = `http://127.0.0.1:${simServer.port}`;

  let convex: ConvexEmulator | null = null;
  let convexServer: ReturnType<typeof Bun.serve> | null = null;
  let convexUrl = options.convexUrl;
  if (!convexUrl) {
    convex = await createConvexEmulator();
    convexServer = Bun.serve({ port: 0, fetch: convex.handle, idleTimeout: 0 });
    convexUrl = `http://127.0.0.1:${convexServer.port}`;
  }

  const stateDir = await mkdtemp(path.join(os.tmpdir(), "halaqabot-stack-"));
  const envFile = path.join(stateDir, ".dev.vars");
  await writeFile(
    envFile,
    Object.entries({
      BOT_TOKEN: botToken,
      GROQ_API_KEY: "fake",
      FORWARD_CHAT_ID: String(world.scratchChatId),
      CONVEX_URL: convexUrl,
      TELEGRAM_WEBHOOK_SECRET: webhookSecret,
      WEB_APP_URL: webAppUrl,
      CHANNEL_ID: String(world.channelId),
      TELEGRAM_API_ROOT: simulatorUrl,
      GROQ_BASE_URL: `${simulatorUrl}/groq/openai/v1`,
    })
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );

  const workerPort = options.workerPort ?? (await freePort());
  const workerUrl = `http://127.0.0.1:${workerPort}`;
  const workerLog: string[] = [];
  const worker = Bun.spawn(
    [
      path.join(BOT_DIR, "node_modules/.bin/wrangler"), "dev",
      "--ip", "127.0.0.1",
      "--port", String(workerPort),
      "--inspector-port", String(await freePort()),
      "--env-file", envFile,
      "--persist-to", path.join(stateDir, "wrangler"),
      "--test-scheduled",
      "--show-interactive-dev-session=false",
    ],
    { cwd: BOT_DIR, stdout: "pipe", stderr: "pipe", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  // However this process ends, don't leave wrangler (and workerd) running.
  const killOnExit = () => {
    worker.kill();
    rmSync(stateDir, { recursive: true, force: true });
  };
  process.once("exit", killOnExit);
  // Ctrl+C or a kill during a test run: the exit event alone doesn't fire.
  const onSignal = () => {
    killOnExit();
    process.exit(130);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  const ready = Promise.withResolvers<void>();
  for (const stream of [worker.stdout, worker.stderr]) {
    void (async () => {
      const decoder = new TextDecoder();
      for await (const chunk of stream) {
        for (const line of decoder.decode(chunk).split("\n")) {
          if (!line.trim()) continue;
          workerLog.push(line);
          if (options.verbose) console.log(`[worker] ${line}`);
          if (line.includes("Ready on")) ready.resolve();
        }
      }
    })();
  }
  let stopping = false;
  const exited = worker.exited.then((code) => {
    if (!stopping) throw new Error(`wrangler dev exited (${code}):\n${workerLog.slice(-20).join("\n")}`);
  });
  exited.catch(() => {}); // observed by the race below; don't report it twice
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  const startTimeout = new Promise<never>((_, reject) => {
    startTimer = setTimeout(() => reject(new Error("wrangler dev did not start within 90s")), 90_000);
  });
  const stop = async () => {
    stopping = true;
    process.off("exit", killOnExit);
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    worker.kill();
    await worker.exited.catch(() => {});
    simServer.stop(true);
    convexServer?.stop(true);
    await rm(stateDir, { recursive: true, force: true });
  };

  try {
    await Promise.race([ready.promise, exited, startTimeout]);
  } catch (error) {
    await stop();
    throw error;
  } finally {
    clearTimeout(startTimer);
  }

  const convexClient = new ConvexHttpClient(convexUrl, { skipConvexDeploymentUrlCheck: true, logger: false });

  const activity = () => sim.apiCalls.length + sim.deliveries.length + (convex?.calls.length ?? 0) + simHandler.groqCalls.length;
  // The Worker logs "job done: update <id>" (or "job failed: …") for each update
  // it finishes, so settling can wait for exactly the updates Telegram sent.
  const updatesFinished = () => workerLog.filter((line) => /job (done|failed): update /.test(line)).length;
  const updatesDelivered = () => sim.deliveries.filter((d) => d.status === "delivered").length;

  const stack: Stack = {
    sim,
    world,
    convex,
    convexUrl,
    query: (fn, args) => convexClient.query(fn, args),
    mutation: (fn, args) => convexClient.mutation(fn, args),
    simulatorUrl,
    workerUrl,
    workerLog,

    async callApi(apiPath, body, { as }) {
      const initData = await sim.miniAppInitData(as);
      const response = await fetch(`${workerUrl}${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `tma ${initData}`, Origin: webAppUrl },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },

    setTelegramUnavailable: (unavailable) => simHandler.setBotApiUnavailable(unavailable),

    async runCron() {
      const response = await fetch(`${workerUrl}/cdn-cgi/handler/scheduled?cron=17+*+*+*+*`);
      if (!response.ok) throw new Error(`cron failed: ${response.status}`);
    },

    async settle({ quietMs = 300, timeoutMs = 30_000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      let last = -1;
      let quietSince = Date.now();
      while (Date.now() < deadline) {
        await sim.whenDelivered();
        if (updatesFinished() < updatesDelivered()) {
          await sleep(50);
          continue;
        }
        // Then a short quiet spell, for work that isn't an update (/api calls
        // finishing in the background, the cron).
        const now = activity();
        if (now !== last) {
          last = now;
          quietSince = Date.now();
        } else if (Date.now() - quietSince >= quietMs) {
          return;
        }
        await sleep(50);
      }
      throw new Error("bot did not settle");
    },

    async waitFor(check, { timeoutMs = 15_000, message = "condition" } = {}) {
      const deadline = Date.now() + timeoutMs;
      let lastError: unknown;
      while (Date.now() < deadline) {
        try {
          const value = await check();
          if (value) return value as NonNullable<Awaited<typeof value>>;
        } catch (error) {
          lastError = error;
        }
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${message}${lastError ? `: ${lastError}` : ""}`);
    },

    stop,
  };

  try {
    await configureTelegram(new Api(botToken, { apiRoot: simulatorUrl }), {
      workerUrl,
      secret: webhookSecret,
      webAppUrl,
    });
    await stack.runCron();
    await stack.settle();
  } catch (error) {
    await stop();
    throw error;
  }
  return stack;
}
