export interface Config {
  botToken: string;
  convexUrl: string;
  forwardChatId: string;
  groqApiKey: string;
  autoReactionEmoji: "❤" | "👍" | "👎" | "🔥" | "🥰";
  allowedReactionUserIds: number[];
  webAppUrl: string;
  channelId: number;
  /**
   * Bot API server to talk to. Unset means Telegram's; local runs and previews
   * point it at the Telegram simulator (packages/testing).
   */
  telegramApiRoot?: string;
  /** Groq-compatible API to use for classification; unset means Groq's. */
  groqBaseUrl?: string;
}

/** Raw configuration values: process.env under Bun, the Worker env on Cloudflare. */
export type ConfigSource = Record<string, unknown>;

function read(env: ConfigSource, name: string): string | undefined {
  const value = env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function required(env: ConfigSource, name: string, hint: string): string {
  const value = read(env, name);
  if (!value) {
    throw new Error(`${name} is not set. ${hint}`);
  }
  return value;
}

export function loadConfig(env: ConfigSource): Config {
  const botToken = required(env, "BOT_TOKEN", "Get your token from @BotFather on Telegram.");
  const forwardChatId = required(
    env,
    "FORWARD_CHAT_ID",
    "Set it to the chat ID where messages should be forwarded.",
  );
  const groqApiKey = required(
    env,
    "GROQ_API_KEY",
    "Get your API key from https://console.groq.com/.",
  );
  const convexUrl = required(env, "CONVEX_URL", "Set it to the Convex deployment URL.");
  const autoReactionEmoji = (read(env, "AUTO_REACTION_EMOJI") || "❤") as Config["autoReactionEmoji"];
  const allowedReactionUserIdsValue = read(env, "ALLOWED_REACTION_USER_IDS");
  const allowedReactionUserIds = allowedReactionUserIdsValue
    ? allowedReactionUserIdsValue.split(",").map((id: string) => parseInt(id.trim(), 10))
    : [5627601992, 1093520031];
  const webAppUrl = read(env, "WEB_APP_URL") || "https://halakabot.app.thawabcoding.work";
  const channelIdValue = read(env, "CHANNEL_ID");
  const channelId = channelIdValue ? parseInt(channelIdValue, 10) : -1002081068866;

  return {
    botToken,
    convexUrl,
    forwardChatId,
    groqApiKey,
    autoReactionEmoji,
    allowedReactionUserIds,
    webAppUrl,
    channelId,
    telegramApiRoot: read(env, "TELEGRAM_API_ROOT"),
    groqBaseUrl: read(env, "GROQ_BASE_URL"),
  };
}
