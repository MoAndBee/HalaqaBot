export interface Config {
  botToken: string;
  forwardChatId: string;
}

export function loadConfig(): Config {
  const botToken = process.env.BOT_TOKEN;
  const forwardChatId = process.env.FORWARD_CHAT_ID;

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

  return {
    botToken,
    forwardChatId,
  };
}
