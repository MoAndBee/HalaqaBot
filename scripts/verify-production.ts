/** Read-only release checks. Never sends Telegram updates or mutates app data. */
import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import { api, ConvexHttpClient } from "../packages/db/src/index";
import { botConvexClient } from "../packages/bot/scripts/convex-client";
import { PRODUCTION, validateProductionConfig } from "./production-config";

const mode = process.argv[2];
assert(mode === "preflight" || mode === "released", "Expected preflight or released");
assert(/^[a-f0-9]{40}$/.test(process.env.RELEASE_SHA ?? ""), "A full RELEASE_SHA is required");
validateProductionConfig(Bun.TOML.parse(await readFile(new URL("../packages/bot/wrangler.production.bosla.toml", import.meta.url), "utf8")));
assert(process.env.CLOUDFLARE_API_TOKEN, "Missing production Cloudflare API token");
if (mode === "preflight") {
  assert(process.env.CONVEX_DEPLOY_KEY?.startsWith(`prod:${PRODUCTION.deployment}|`), "Expected a deployment-scoped incredible-lyrebird-981 production key");
  const artifact = await Bun.file(new URL("../packages/bot/.production/web/release.json", import.meta.url)).json();
  assert.equal(artifact.commit, process.env.RELEASE_SHA, "Prepared assets belong to another commit");
}

async function request(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
}
async function cloudflare(path: string) {
  const response = await request(`https://api.cloudflare.com/client/v4/accounts/${PRODUCTION.account}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
  });
  assert(response.ok, `Cloudflare read failed (${response.status}) for ${path}`);
  const body = await response.json() as any;
  assert(body.success, `Cloudflare read rejected for ${path}`);
  return body.result;
}

const settings = await cloudflare(`workers/scripts/${PRODUCTION.worker}/settings`);
for (const name of ["BOT_TOKEN", "GROQ_API_KEY", "CONVEX_URL", "TELEGRAM_WEBHOOK_SECRET", "CONVEX_AUTH_PRIVATE_KEY", "WEB_APP_URL"]) {
  assert(settings.bindings?.some((binding: any) => binding.name === name), `Missing production Worker binding ${name}`);
}
for (const name of ["GROQ_BASE_URL", "TELEGRAM_API_ROOT", "PREVIEW_MODE", "SIM_CONTROL_TOKEN"]) {
  assert(!settings.bindings?.some((binding: any) => binding.name === name), `Unexpected production override ${name}`);
}

const client = await botConvexClient(PRODUCTION.backend);
const channels = await client.query(api.queries.getActiveChannels, {});
assert(channels.length > 0, "Expected existing active production channels");
const anonymous = new ConvexHttpClient(PRODUCTION.backend, { logger: false });
await assert.rejects(anonymous.query(api.queries.getActiveChannels, {}),
  (error: any) => typeof error.data === "string" && error.data.includes("يجب تسجيل الدخول"));

for (const path of ["/", "/halaqas"]) {
  assert.equal((await request(PRODUCTION.origin + path)).status, 200, `Production ${path} is unavailable`);
}
for (const path of ["/api/auth/token", "/telegram"]) {
  assert.equal((await request(PRODUCTION.origin + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  })).status, 401, `Unsigned ${path} must be denied`);
}

if (mode === "released") {
  let matched = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await request(`${PRODUCTION.origin}/release.json?commit=${process.env.RELEASE_SHA}`, {
      headers: { "Cache-Control": "no-cache" },
    });
    try {
      matched = response.ok && (await response.json() as any).commit === process.env.RELEASE_SHA;
    } catch { /* An older release may still serve the SPA fallback. */ }
    if (matched) break;
    if (attempt < 5) await Bun.sleep(5_000);
  }
  assert(matched, "Production assets do not match the released commit");
  const html = await (await request(PRODUCTION.origin)).text();
  const scriptPath = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).find(path => path?.startsWith("/assets/"));
  assert(scriptPath, "Expected a production app script");
  const script = await (await request(new URL(scriptPath, PRODUCTION.origin).href)).text();
  assert(script.includes(PRODUCTION.backend), "Frontend is not using production Convex");
  assert(!script.includes("perfect-clam-401.convex.cloud"), "Staging backend found in production frontend");
  const deployments = await cloudflare(`workers/scripts/${PRODUCTION.worker}/deployments`);
  const active = deployments.deployments?.[0];
  assert(active?.versions?.length, "No active production Worker deployment");
  const versions = active.versions.map((version: any) => version.version_id).join(", ");
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `Released commit: ${process.env.RELEASE_SHA}\n\nActive Worker versions: ${versions}\n\nHTTPS, production frontend, authenticated reads and unsigned-request denial passed.\n`);
  }
}
console.log(`Production ${mode} checks passed (no app data writes or Telegram messages).`);
