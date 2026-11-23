/**
 * Production release, run by Cloudflare Workers Builds as the `halaqabot`
 * Worker's deploy command on the production branch (main):
 *
 *   bun scripts/cloudflare-production.ts
 *
 * 1. Builds the DB/bot and the Mini App against production Convex and dry-runs
 *    wrangler.production.bosla.toml (scripts/prepare-production.ts).
 * 2. Stops there unless the build variable PRODUCTION_RELEASE_ENABLED is "true".
 * 3. Deploys production Convex first, then the Worker with the built assets.
 * 4. Runs the read-only post-release checks when PRODUCTION_CONVEX_AUTH_PRIVATE_KEY
 *    is set.
 *
 * Build variables (Worker → Settings → Build → Variables and secrets):
 *   PRODUCTION_RELEASE_ENABLED            "true" to deploy; anything else builds only
 *   PRODUCTION_CONVEX_DEPLOY_KEY          prod:incredible-lyrebird-981|... (secret)
 *   PRODUCTION_CONVEX_AUTH_PRIVATE_KEY    optional, enables post-release checks (secret)
 * Workers Builds itself provides CLOUDFLARE_API_TOKEN, WORKERS_CI_BRANCH and
 * WORKERS_CI_COMMIT_SHA. The Worker's runtime secrets, queues and webhook are
 * left as they are.
 */
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PRODUCTION } from "./production-config";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = process.env;

const branch = env.WORKERS_CI_BRANCH;
if (branch && branch !== "main") throw new Error(`Production releases only from main, not ${branch}`);
const sha = env.WORKERS_CI_COMMIT_SHA || Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root }).stdout.toString().trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("Could not determine the full release commit SHA");

async function run(command: string[], cwd: string, extra: Record<string, string | undefined> = {}) {
  const proc = Bun.spawn(command, { cwd, env: { ...env, ...extra }, stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error(`Production release failed at: ${command.slice(0, 3).join(" ")}`);
}

console.log(`Preparing production release ${sha}…`);
await run(["bun", "scripts/prepare-production.ts"], root);

if (env.PRODUCTION_RELEASE_ENABLED !== "true") {
  console.log("PRODUCTION_RELEASE_ENABLED is not \"true\": built and dry-ran only. Nothing was deployed.");
  process.exit(0);
}

const deployKey = env.PRODUCTION_CONVEX_DEPLOY_KEY;
if (!deployKey?.startsWith(`prod:${PRODUCTION.deployment}|`)) {
  throw new Error(`PRODUCTION_CONVEX_DEPLOY_KEY must be the deployment-scoped ${PRODUCTION.deployment} production key`);
}
const authKey = env.PRODUCTION_CONVEX_AUTH_PRIVATE_KEY;
const checks = { RELEASE_SHA: sha, CONVEX_AUTH_PRIVATE_KEY: authKey };

if (authKey) {
  await run(["bun", "scripts/verify-production.ts", "preflight"], root, { ...checks, CONVEX_DEPLOY_KEY: deployKey });
} else {
  console.log("PRODUCTION_CONVEX_AUTH_PRIVATE_KEY not set: skipping preflight and post-release checks.");
}

// Convex first: the new Worker may call functions only the new backend has.
console.log("Deploying production Convex…");
const dir = mkdtempSync(path.join(tmpdir(), "convex-production-"));
const envFile = path.join(dir, "convex.env");
try {
  writeFileSync(envFile, `CONVEX_DEPLOY_KEY=${deployKey}\nCONVEX_DEPLOYMENT=prod:${PRODUCTION.deployment}\n`, { mode: 0o600 });
  await run(["./node_modules/.bin/convex", "deploy", "--env-file", envFile, "--yes", "--typecheck", "disable"],
    path.join(root, "packages/db"), { CONVEX_DEPLOY_KEY: "" });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Existing Worker secrets, queues, webhook and cron are retained.
console.log("Deploying the Worker and Mini App assets…");
await run(["./node_modules/.bin/wrangler", "deploy", "--config", "wrangler.production.bosla.toml", "--tag", sha],
  path.join(root, "packages/bot"), { CLOUDFLARE_ACCOUNT_ID: PRODUCTION.account, WRANGLER_SEND_METRICS: "false" });

if (authKey) await run(["bun", "scripts/verify-production.ts", "released"], root, checks);
console.log(`Production release ${sha} deployed.`);
