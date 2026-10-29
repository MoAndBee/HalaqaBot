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
 * TELEGRAM_API_ROOT points it at the Telegram simulator instead of Telegram.
 */
import { Api } from "grammy";
import { configureTelegram } from "../src/setup";

const botToken = process.env.BOT_TOKEN;
const workerUrl = process.env.WORKER_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const webAppUrl = process.env.WEB_APP_URL || "https://halakabot.app.thawabcoding.work";
const apiRoot = process.env.TELEGRAM_API_ROOT;

if (!botToken || !workerUrl || !secret) {
  throw new Error("BOT_TOKEN, WORKER_URL and TELEGRAM_WEBHOOK_SECRET must all be set");
}

const api = new Api(botToken, apiRoot ? { apiRoot } : undefined);
const webhookUrl = await configureTelegram(api, { workerUrl, secret, webAppUrl });
console.log(`✅ Webhook set to ${webhookUrl}`);

const info = await api.getWebhookInfo();
console.log("Webhook info:", {
  url: info.url,
  pending_update_count: info.pending_update_count,
  last_error_message: info.last_error_message,
  allowed_updates: info.allowed_updates,
});
