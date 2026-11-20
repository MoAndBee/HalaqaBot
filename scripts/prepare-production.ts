/** Builds production assets and a cron-disabled bootstrap config. Never deploys. */
import { mkdir, chmod, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PRODUCTION, validateProductionConfig } from "./production-config";

const root = fileURLToPath(new URL("../", import.meta.url));
const bot = path.join(root, "packages/bot");
const output = path.join(root, ".production");
const config = Bun.TOML.parse(await readFile(path.join(bot, "wrangler.production.bosla.toml"), "utf8"));
validateProductionConfig(config);
await mkdir(output, { recursive: true, mode: 0o700 });
await chmod(output, 0o700);
await mkdir(path.join(bot, ".production"), { recursive: true, mode: 0o700 });
// Never pass loaded credentials or simulator values to build tools.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(CONVEX_|PRODUCTION_|STAGING_|BOT_TOKEN$|TELEGRAM_|GROQ_|TEST_|SIM_|PREVIEW_|VITE_|CLOUDFLARE_|CF_)/.test(name)));
Object.assign(env, { VITE_CONVEX_URL: PRODUCTION.backend, VITE_BOT_API_URL: "", CLOUDFLARE_ACCOUNT_ID: PRODUCTION.account, WRANGLER_SEND_METRICS: "false" });
async function run(command: string[], cwd: string) {
  const proc = Bun.spawn(command, { cwd, env, stdout: "inherit", stderr: "inherit" });
  if (await proc.exited !== 0) throw new Error(`Production preparation failed: ${command.slice(0, 3).join(" ")}`);
}
await run(["bun", "run", "build:db"], root);
await run(["bun", "run", "build:bot"], root);
await run(["bun", "./node_modules/.bin/vite", "build", "--outDir", "../bot/.production/web", "--emptyOutDir"], path.join(root, "packages/web"));
const bootstrap = { ...config, main: path.join(bot, config.main), assets: { ...config.assets, directory: path.join(bot, config.assets.directory) }, triggers: { crons: [] } };
await writeFile(path.join(output, "wrangler.bootstrap.json"), JSON.stringify(bootstrap, null, 2) + "\n", { mode: 0o600 });
await run(["./node_modules/.bin/wrangler", "deploy", "--config", "wrangler.production.bosla.toml", "--dry-run", "--outdir", path.join(output, "dry-run")], bot);
const commit = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: root }).stdout.toString().trim();
const dirty = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root }).stdout.toString().trim() !== "";
await writeFile(path.join(output, "preparation.json"), JSON.stringify({ sourceCommit: commit, workingTreeDirty: dirty, ...PRODUCTION, deployed: false }, null, 2) + "\n", { mode: 0o600 });
console.log("Production build and Wrangler dry run passed. Bootstrap config has no cron. No deployment, DNS, queues, webhook or backend changes were made.");
