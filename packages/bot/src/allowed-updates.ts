/**
 * Update types the bot handles, registered with Telegram by scripts/set-webhook.ts
 * (and by the Telegram simulator's Previews, which connect themselves).
 * Changing this list only takes effect after re-running that script.
 */
export const ALLOWED_UPDATES = [
  "message",
  "message_reaction",
  "channel_post",
  "my_chat_member",
  "chat_member",
] as const;
