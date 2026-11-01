/**
 * Builds and uploads the bot's Worker Preview for a branch. Workers Builds runs
 * this as the bot Worker's preview command (see "Previews" in the README):
 *
 *   bun packages/bot/scripts/build-preview.ts
 *
 * 1. Pushes the branch's Convex functions: to a Convex preview deployment named
 *    after the branch with a preview deploy key, or to the dev deployment with
 *    a dev key. The web app is built against it.
 * 2. Uploads the Preview with `wrangler preview`: the bot in preview mode (it
 *    handles updates without a queue and talks to the simulator's Preview of
 *    the same branch; see src/preview.ts), serving the web app too.
 *
 * Build variables: CONVEX_DEPLOY_KEY. Secrets on the bot's Preview base config:
 * BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (the simulator's SIM_BOT_TOKEN and
 * SIM_WEBHOOK_SECRET) and CONVEX_AUTH_PRIVATE_KEY.
 */
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = path.resolve(import.meta.dir, "../../..");
const BOT_DIR = path.join(ROOT, "packages/bot");
const DB_DIR = path.join(ROOT, "packages/db");
const WEB_DIR = path.join(ROOT, "packages/web");
const OUT_DIR = path.join(BOT_DIR, ".preview");

/** The simulated world's channel and scratch group (packages/testing/src/world.ts). */
export const SIMULATED_CHANNEL_ID = -1001000000001;
export const SIMULATED_SCRATCH_CHAT_ID = -1001000000003;

async function run(cmd: string[], cwd: string, env: Record<string, string | undefined> = {}): Promise<string> {
  const proc = Bun.spawn(cmd, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  process.stderr.write(err);
  if (code !== 0) throw new Error(`${cmd.slice(0, 3).join(" ")} failed (${code}):\n${out}`);
  return out;
}

/**
 * Pushes the Convex functions for `previewName` and builds the web app against
 * that deployment, same-origin with the bot. Returns the deployment's URL.
 */
export async function deployConvexAndBuildWebApp(previewName: string, deployKey: string): Promise<string> {
  mkdirSync(OUT_DIR, { recursive: true });
  const urlFile = path.join(OUT_DIR, "convex-url");
  const webBuild = `cd ${WEB_DIR} && bunx vite build && printenv VITE_CONVEX_URL > ${urlFile}`;
  const env = { CONVEX_DEPLOY_KEY: deployKey, VITE_BOT_API_URL: "" };

  if (deployKey.startsWith("preview:")) {
    // Its own deployment, created on first push. CONVEX_AUTH_JWKS comes from
    // the Convex project's default environment variables for previews.
    await run(
      ["bunx", "convex", "deploy", "--preview-create", previewName, "--typecheck", "disable",
        "--cmd-url-env-var-name", "VITE_CONVEX_URL", "--cmd", webBuild],
      DB_DIR,
      env,
    );
    return readFileSync(urlFile, "utf8").trim();
  }
  // A dev key: the shared dev deployment (Convex's free plan has no previews).
  const deployment = deployKey.match(/^dev:([a-z0-9-]+)\|/)?.[1];
  if (!deployment) throw new Error("CONVEX_DEPLOY_KEY must be a preview or dev deploy key");
  const convexUrl = `https://${deployment}.convex.cloud`;
  await run(["bunx", "convex", "dev", "--once", "--typecheck", "disable"], DB_DIR, env);
  await run(["sh", "-c", webBuild], ROOT, { VITE_CONVEX_URL: convexUrl, VITE_BOT_API_URL: "" });
  return convexUrl;
}

/** The bot in preview mode, serving the web app; settings beyond the Worker's own. */
export function previewConfig(vars: Record<string, string> = {}) {
  return {
    name: "halaqabot",
    main: path.join(BOT_DIR, "src/worker.ts"),
    compatibility_date: "2026-09-01",
    compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
    workers_dev: true,
    rules: [{ type: "Data", globs: ["**/*.jpeg"], fallthrough: true }],
    assets: {
      directory: path.join(WEB_DIR, "dist"),
      not_found_handling: "single-page-application",
      run_worker_first: ["/api/*", "/telegram", "/preview/*"],
    },
    observability: { enabled: true },
    previews: {
      vars: {
        PREVIEW_WORKER_NAME: "halaqabot",
        PREVIEW_SIMULATOR_NAME: "halaqabot-sim",
        // The fake Groq ignores it.
        GROQ_API_KEY: "simulated",
        CHANNEL_ID: String(SIMULATED_CHANNEL_ID),
        FORWARD_CHAT_ID: String(SIMULATED_SCRATCH_CHAT_ID),
        ...vars,
      },
    },
  };
}

if (import.meta.main) {
  const branch = process.env.WORKERS_CI_BRANCH;
  const deployKey = process.env.CONVEX_DEPLOY_KEY;
  if (!branch || !deployKey) throw new Error("Needs WORKERS_CI_BRANCH (set by Workers Builds) and CONVEX_DEPLOY_KEY");

  console.log(`Convex and the web app for ${branch}…`);
  const convexUrl = await deployConvexAndBuildWebApp(branch.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase(), deployKey);
  console.log(`Convex: ${convexUrl}`);

  const configFile = path.join(OUT_DIR, "wrangler.json");
  writeFileSync(configFile, JSON.stringify(previewConfig(), null, 2));
  console.log(`Uploading the Preview…`);
  const out = await run(
    ["bunx", "wrangler", "preview", "--config", configFile, "--var", `CONVEX_URL:${convexUrl}`],
    BOT_DIR,
  );
  console.log(out);
}
