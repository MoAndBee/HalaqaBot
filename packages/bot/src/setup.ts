import type { Api } from "grammy";
import { ALLOWED_UPDATES } from "./bot";
import { configureMenuButton } from "./handlers/webApp.handler";

/**
 * Registers the bot's webhook and menu button with Telegram (or the simulator).
 * Shared by scripts/set-webhook.ts and the local test stack, so tests exercise
 * the same settings production uses.
 */
export async function configureTelegram(
  api: Api,
  options: { workerUrl: string; secret: string; webAppUrl: string },
): Promise<string> {
  const webhookUrl = new URL("/telegram", options.workerUrl).toString();

  await api.setWebhook(webhookUrl, {
    secret_token: options.secret,
    allowed_updates: [...ALLOWED_UPDATES],
    // One request at a time, so updates reach the job queue in the order they
    // happened. The webhook only enqueues, so this costs no throughput to speak of.
    max_connections: 1,
  });
  await configureMenuButton(api, options.webAppUrl);
  return webhookUrl;
}
