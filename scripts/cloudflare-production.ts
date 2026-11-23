/**
 * Production release, run by Cloudflare Workers Builds as the `halaqabot`
 * Worker's deploy command on the production branch (main):
 *
 *   bun scripts/cloudflare-production.ts
 *
 * 1. Runs the test suite (local simulator and in-memory Convex; no secrets).
 * 2. Builds the DB/bot and the Mini App against production Convex and dry-runs
 *    wrangler.production.bosla.toml (scripts/prepare-production.ts).
 * 3. Deploys production Convex first, then the Worker with the built assets.
 * 4. Checks the live site serves this commit and still rejects unsigned requests.
 *
 * Build variable (Worker → Settings → Build → Variables and secrets):
 *   PRODUCTION_CONVEX_DEPLOY_KEY   prod:incredible-lyrebird-981|... (secret)
 * Workers Builds itself provides the Cloudflare credentials, WORKERS_CI_BRANCH
 * and WORKERS_CI_COMMIT_SHA. The Worker's runtime secrets, queues and webhook
 * are left as they are.
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
const deployKey = env.PRODUCTION_CONVEX_DEPLOY_KEY;
if (!deployKey?.startsWith(`prod:${PRODUCTION.deployment}|`)) {
  throw new Error(`PRODUCTION_CONVEX_DEPLOY_KEY must be the deployment-scoped ${PRODUCTION.deployment} production key`);
}

async function run(command: string[], cwd: string, childEnv: Record<string, string | undefined>) {
  const proc = Bun.spawn(command, { cwd, env: childEnv, stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error(`Production release failed at: ${command.slice(0, 3).join(" ")}`);
}
// Tests and builds never see deploy keys or other credentials.
const clean = Object.fromEntries(Object.entries(env).filter(([name]) => !/^(CONVEX_|PRODUCTION_|CLOUDFLARE_|CF_|TEST_)/.test(name)));

console.log(`Testing ${sha}…`);
await run(["bun", "run", "test"], root, clean);

console.log("Building and dry-running the production release…");
await run(["bun", "scripts/prepare-production.ts"], root, clean);

// Convex first: the new Worker may call functions only the new backend has.
console.log("Deploying production Convex…");
const dir = mkdtempSync(path.join(tmpdir(), "convex-production-"));
const envFile = path.join(dir, "convex.env");
try {
  writeFileSync(envFile, `CONVEX_DEPLOY_KEY=${deployKey}\nCONVEX_DEPLOYMENT=prod:${PRODUCTION.deployment}\n`, { mode: 0o600 });
  await run(["./node_modules/.bin/convex", "deploy", "--env-file", envFile, "--yes", "--typecheck", "disable"],
    path.join(root, "packages/db"), { ...clean, CONVEX_DEPLOY_KEY: "" });
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Existing Worker secrets, queues, webhook and cron are retained.
console.log("Deploying the Worker and Mini App assets…");
await run(["./node_modules/.bin/wrangler", "deploy", "--config", "wrangler.production.bosla.toml", "--tag", sha],
  path.join(root, "packages/bot"),
  { ...env, PRODUCTION_CONVEX_DEPLOY_KEY: "", CLOUDFLARE_ACCOUNT_ID: PRODUCTION.account, WRANGLER_SEND_METRICS: "false" });

// Read-only checks that need no credentials.
console.log("Checking the live site…");
const get = (route: string, init?: RequestInit) => fetch(PRODUCTION.origin + route, { ...init, signal: AbortSignal.timeout(15_000) });
let served = "";
for (let attempt = 0; attempt < 12 && served !== sha; attempt++) {
  if (attempt) await Bun.sleep(5_000);
  served = await get(`/release.json?commit=${sha}`, { headers: { "Cache-Control": "no-cache" } })
    .then((r) => r.ok ? r.json() : {}).then((body: any) => body.commit ?? "").catch(() => "");
}
if (served !== sha) throw new Error(`Live assets are not commit ${sha} (got ${served || "nothing"})`);
for (const route of ["/", "/halaqas"]) {
  const status = (await get(route)).status;
  if (status !== 200) throw new Error(`${route} returned ${status}`);
}
for (const route of ["/api/auth/token", "/telegram"]) {
  const status = (await get(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status;
  if (status !== 401) throw new Error(`Unsigned ${route} returned ${status}, expected 401`);
}
console.log(`Production release ${sha} deployed and serving.`);
