import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { generateKeyPair } from "../../bot/src/convex-auth";
import { productionWorkerSecrets, PRODUCTION, validateProductionConfig } from "../../../scripts/production-config";

const config = Bun.TOML.parse(readFileSync(new URL("../../bot/wrangler.production.bosla.toml", import.meta.url), "utf8"));
async function fixture() {
  const keys = await generateKeyPair();
  return {
    CLOUDFLARE_ACCOUNT_ID: PRODUCTION.account,
    CONVEX_DEPLOYMENT: `prod:${PRODUCTION.deployment}`, CONVEX_DEPLOY_KEY: `prod:${PRODUCTION.deployment}|fixture`,
    CONVEX_URL: PRODUCTION.backend, VITE_CONVEX_URL: PRODUCTION.backend, VITE_BOT_API_URL: "",
    WEB_APP_URL: PRODUCTION.origin, WORKER_URL: PRODUCTION.origin,
    BOT_TOKEN: "123456:fixture", PRODUCTION_BOT_USERNAME: "existing_live_bot", GROQ_API_KEY: "fixture",
    TELEGRAM_WEBHOOK_SECRET: "a".repeat(64), CHANNEL_ID: "-1001234567890", FORWARD_CHAT_ID: "-1001234567891",
    CONVEX_AUTH_PRIVATE_KEY: keys.privateJwk, PRODUCTION_CONVEX_AUTH_JWKS: keys.jwksDataUri,
  };
}

test("production config pins its account, domain, isolated queues and API routing", () => {
  validateProductionConfig(config);
  for (const change of [
    { account_id: "personal-account" }, { routes: [{ pattern: "halaqabot-staging.bosla.to", custom_domain: true }] },
    { assets: { ...config.assets, run_worker_first: [] } },
    { queues: { ...config.queues, consumers: [{ ...config.queues.consumers[0], queue: "halaqabot-staging-updates" }, config.queues.consumers[1]] } },
  ]) expect(() => validateProductionConfig({ ...config, ...change })).toThrow();
});

test("production secrets exclude deploy keys, JWKS and control values", async () => {
  const env = await fixture();
  const result = await productionWorkerSecrets(env);
  expect(Object.keys(result).sort()).toEqual(["BOT_TOKEN", "CHANNEL_ID", "CONVEX_AUTH_PRIVATE_KEY", "CONVEX_URL", "FORWARD_CHAT_ID", "GROQ_API_KEY", "TELEGRAM_WEBHOOK_SECRET", "WEB_APP_URL"].sort());
  expect(result.BOT_TOKEN).toBe(env.BOT_TOKEN);
});

test("staging backends, chat IDs, bot and cross-origin builds cannot become production", async () => {
  const env = await fixture();
  for (const change of [
    { CONVEX_DEPLOY_KEY: "prod:perfect-clam-401|fixture" },
    { CONVEX_URL: "https://perfect-clam-401.convex.cloud" },
    { VITE_CONVEX_URL: "https://doting-viper-550.convex.cloud" },
    { WEB_APP_URL: "https://halaqabot-staging.bosla.to" }, { VITE_BOT_API_URL: "http://localhost:8787" },
    { CHANNEL_ID: "-1004434414328" }, { FORWARD_CHAT_ID: "-1004415858273" },
    { PRODUCTION_BOT_USERNAME: "halaqabot_bosla_staging_bot" }, { CONVEX_DEPLOY_KEY: "" },
  ]) await expect(productionWorkerSecrets({ ...env, ...change })).rejects.toThrow();
});

test("fake provider and simulator command settings are rejected", async () => {
  const env = await fixture();
  for (const name of ["GROQ_BASE_URL", "TELEGRAM_API_ROOT", "PREVIEW_WORKER_NAME", "TEST_CONVEX_URL", "SIM_ID_OFFSET"]) {
    await expect(productionWorkerSecrets({ ...env, [name]: "accidental-staging-value" })).rejects.toThrow();
  }
});

test("mismatched signing pairs and private keys in public JWKS are rejected without logging key values", async () => {
  const env = await fixture();
  const other = await generateKeyPair();
  for (const jwks of [other.jwksDataUri, `data:text/plain;charset=utf-8;base64,${btoa(JSON.stringify({ keys: [JSON.parse(env.CONVEX_AUTH_PRIVATE_KEY)] }))}`, "invalid"]) {
    await expect(productionWorkerSecrets({ ...env, PRODUCTION_CONVEX_AUTH_JWKS: jwks })).rejects.toThrow("key values omitted");
  }
});
