/**
 * Points Telegram at the deployed Worker and sets the web app menu button.
 * Run after the first deploy, and again whenever the Worker URL or the webhook
 * secret changes.
 *
 *   BOT_TOKEN=... WORKER_URL=https://halaqabot.<account>.workers.dev \
 *   TELEGRAM_WEBHOOK_SECRET=... bun run scripts/set-webhook.ts
 *
 * TELEGRAM_WEBHOOK_SECRET must match the Worker secret of the same name.
 * WEB_APP_URL is optional and defaults to the production web app.
 */
import { Api } from "grammy";
import { ALLOWED_UPDATES } from "../src/bot";
import { configureMenuButton } from "../src/handlers/webApp.handler";

const botToken = process.env.BOT_TOKEN;
const workerUrl = process.env.WORKER_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const webAppUrl = process.env.WEB_APP_URL || "https://halakabot.app.thawabcoding.work";

if (!botToken || !workerUrl || !secret) {
  throw new Error("BOT_TOKEN, WORKER_URL and TELEGRAM_WEBHOOK_SECRET must all be set");
}

const api = new Api(botToken);
const webhookUrl = new URL("/telegram", workerUrl).toString();

await api.setWebhook(webhookUrl, {
  secret_token: secret,
  allowed_updates: [...ALLOWED_UPDATES],
  // One request at a time, so updates reach the job queue in the order they
  // happened. The webhook only enqueues, so this costs no throughput to speak of.
  max_connections: 1,
});
console.log(`✅ Webhook set to ${webhookUrl}`);

await configureMenuButton(api, webAppUrl);

const info = await api.getWebhookInfo();
console.log("Webhook info:", {
  url: info.url,
  pending_update_count: info.pending_update_count,
  last_error_message: info.last_error_message,
  allowed_updates: info.allowed_updates,
});
