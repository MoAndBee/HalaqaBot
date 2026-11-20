/** Local-only guards shared by production preparation and its tests. */
import { importSigningKey, signToken, verifyToken } from "../packages/bot/src/convex-auth";

export const PRODUCTION = {
  account: "fe626a504678476d9e8c2d942794d30f",
  deployment: "incredible-lyrebird-981",
  backend: "https://incredible-lyrebird-981.convex.cloud",
  origin: "https://halaqabot.bosla.to",
  worker: "halaqabot",
} as const;

type Values = Record<string, string | undefined>;
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateProductionConfig(config: any): void {
  check(config.account_id === PRODUCTION.account && config.name === PRODUCTION.worker, "Wrong production Cloudflare account or Worker");
  check(config.workers_dev === false, "Production must use its custom origin");
  check(config.routes?.length === 1 && config.routes[0].pattern === "halaqabot.bosla.to" && config.routes[0].custom_domain === true, "Wrong production custom domain");
  check(config.main === "src/worker.ts" && config.assets?.directory === ".production/web", "Wrong production entry point or asset directory");
  check(config.assets.not_found_handling === "single-page-application" && JSON.stringify(config.assets.run_worker_first) === JSON.stringify(["/api/*", "/telegram"]), "Production API/webhook must reach the Worker before SPA fallback");
  check(JSON.stringify(config.triggers?.crons) === JSON.stringify(["17 * * * *"]), "Unexpected production schedule");
  const producers = config.queues?.producers;
  const consumers = config.queues?.consumers;
  check(producers?.length === 2 && consumers?.length === 2, "Production requires two queue producers and consumers");
  for (const [binding, queue] of [["UPDATES", "halaqabot-updates"], ["IMPORTS", "halaqabot-imports"]]) {
    check(producers.some((p: any) => p.binding === binding && p.queue === queue), "Wrong production queue binding");
    check(consumers.some((c: any) => c.queue === queue && c.dead_letter_queue === "halaqabot-dead-letters" && c.max_batch_size === 1 && c.max_concurrency === 1 && c.max_retries === 2), "Wrong production queue consumer settings");
  }
}

/** Verifies local values and key agreement; makes no network calls or writes. */
export async function productionWorkerSecrets(env: Values): Promise<Record<string, string>> {
  check(env.CLOUDFLARE_ACCOUNT_ID === PRODUCTION.account, "Expected the Bosla Cloudflare account");
  check(env.CONVEX_DEPLOYMENT === `prod:${PRODUCTION.deployment}` && env.CONVEX_DEPLOY_KEY?.startsWith(`prod:${PRODUCTION.deployment}|`), "A deployment-scoped incredible-lyrebird-981 production write key is required");
  check(env.CONVEX_URL === PRODUCTION.backend && env.VITE_CONVEX_URL === PRODUCTION.backend, "Production backend/frontend must target incredible-lyrebird-981");
  check(env.WEB_APP_URL === PRODUCTION.origin && env.WORKER_URL === PRODUCTION.origin && env.VITE_BOT_API_URL === "", "Expected the same-origin production URL and an explicitly empty VITE_BOT_API_URL");
  for (const [name, value] of Object.entries(env)) {
    if (name === "GROQ_BASE_URL" || name === "TELEGRAM_API_ROOT" || /^(PREVIEW_|SIM_|TEST_)/.test(name)) {
      check(!value, `Remove simulator/preview setting ${name} from the production command environment`);
    }
  }
  for (const name of ["BOT_TOKEN", "GROQ_API_KEY", "TELEGRAM_WEBHOOK_SECRET", "CONVEX_AUTH_PRIVATE_KEY", "PRODUCTION_CONVEX_AUTH_JWKS", "PRODUCTION_BOT_USERNAME"]) {
    check(env[name]?.trim() && !/[<>]/.test(env[name]!), `Fill production ${name} privately`);
  }
  check(/^\d+:[A-Za-z0-9_-]+$/.test(env.BOT_TOKEN!), "Invalid production bot token format");
  check(/^[A-Za-z0-9_]+bot$/i.test(env.PRODUCTION_BOT_USERNAME!) && env.PRODUCTION_BOT_USERNAME!.toLowerCase() !== "halaqabot_bosla_staging_bot", "Confirm the existing live bot username, without @");
  check(/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET!), "Use a random webhook secret of 32–256 supported characters");
  for (const name of ["CHANNEL_ID", "FORWARD_CHAT_ID"]) {
    const value = Number(env[name]);
    check(Number.isSafeInteger(value) && value !== 0 && (name !== "CHANNEL_ID" || value < 0) && ![-1004434414328, -1004415858273].includes(value), `Use the actual production ${name}, not the staging chat`);
  }
  try {
    const data = env.PRODUCTION_CONVEX_AUTH_JWKS!;
    check(data.startsWith("data:text/plain;charset=utf-8;base64,"), "Invalid JWKS URI");
    const jwks = JSON.parse(atob(data.slice(data.indexOf(",") + 1)));
    check(Array.isArray(jwks.keys) && jwks.keys.length > 0 && jwks.keys.every((key: any) => !key.d), "JWKS must contain public keys only");
    const signing = await importSigningKey(env.CONVEX_AUTH_PRIVATE_KEY!);
    const publicKey = jwks.keys.find((key: any) => key.kid === signing.kid);
    check(publicKey, "No matching public key");
    const token = await signToken(signing, "bot", 60);
    check(await verifyToken(token.token, JSON.stringify(publicKey)) === "bot", "Mismatched signing pair");
  } catch {
    throw new Error("Production private JWK and public JWKS must be valid and match (key values omitted)");
  }
  const names = ["BOT_TOKEN", "GROQ_API_KEY", "FORWARD_CHAT_ID", "CONVEX_URL", "TELEGRAM_WEBHOOK_SECRET", "CONVEX_AUTH_PRIVATE_KEY", "CHANNEL_ID", "WEB_APP_URL", "AUTO_REACTION_EMOJI", "ALLOWED_REACTION_USER_IDS"];
  return Object.fromEntries(names.filter((name) => env[name]).map((name) => [name, env[name]!]));
}
