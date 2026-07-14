export interface Config {
  botToken: string;
  forwardChatId: string;
  groqApiKey: string;
  autoReactionEmoji: "❤" | "👍" | "👎" | "🔥" | "🥰";
  allowedReactionUserIds: number[];
  webAppUrl: string;
  channelId: number;
  /**
   * All channels to seed into the registry on startup. Set CHANNEL_IDS to a
   * comma-separated list of channel IDs; falls back to [channelId].
   */
  channelIds: number[];
}

export function loadConfig(): Config {
  const botToken = process.env.BOT_TOKEN;
  const forwardChatId = process.env.FORWARD_CHAT_ID;
  const groqApiKey = process.env.GROQ_API_KEY;
  const autoReactionEmoji = (process.env.AUTO_REACTION_EMOJI || "❤") as "❤" | "👍" | "👎" | "🔥" | "🥰";
  const allowedReactionUserIds = process.env.ALLOWED_REACTION_USER_IDS
    ? process.env.ALLOWED_REACTION_USER_IDS.split(",").map((id: string) => parseInt(id.trim(), 10))
    : [5627601992, 1093520031];
  const webAppUrl = process.env.WEB_APP_URL || "https://halakabot.app.thawabcoding.work";
  const channelId = process.env.CHANNEL_ID ? parseInt(process.env.CHANNEL_ID, 10) : -1002081068866;
  const channelIds = process.env.CHANNEL_IDS
    ? process.env.CHANNEL_IDS.split(",")
        .map((id: string) => parseInt(id.trim(), 10))
        .filter((id: number) => Number.isFinite(id))
    : [channelId];
  if (!channelIds.includes(channelId)) channelIds.push(channelId);

  if (!botToken) {
    console.error("Error: BOT_TOKEN environment variable is not set");
    console.error(
      "Please create a .env file or set BOT_TOKEN in your environment",
    );
    process.exit(1);
  }

  if (!forwardChatId) {
    console.error("Error: FORWARD_CHAT_ID environment variable is not set");
    console.error(
      "Please set FORWARD_CHAT_ID to the chat ID where messages should be forwarded",
    );
    process.exit(1);
  }

  if (!groqApiKey) {
    console.error("Error: GROQ_API_KEY environment variable is not set");
    console.error(
      "Please set GROQ_API_KEY to your Groq API key from https://console.groq.com/",
    );
    process.exit(1);
  }

  return {
    botToken,
    forwardChatId,
    groqApiKey,
    autoReactionEmoji,
    allowedReactionUserIds,
    webAppUrl,
    channelId,
    channelIds,
  };
}
