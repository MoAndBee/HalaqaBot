import { Bot } from "grammy";

// Get bot token from environment variable
const BOT_TOKEN = process.env.BOT_TOKEN;
const FORWARD_CHAT_ID = process.env.FORWARD_CHAT_ID;

if (!BOT_TOKEN) {
  console.error("Error: BOT_TOKEN environment variable is not set");
  console.error(
    "Please create a .env file or set BOT_TOKEN in your environment",
  );
  process.exit(1);
}

if (!FORWARD_CHAT_ID) {
  console.error("Error: FORWARD_CHAT_ID environment variable is not set");
  console.error(
    "Please set FORWARD_CHAT_ID to the chat ID where messages should be forwarded",
  );
  process.exit(1);
}

// Create a new bot instance
const bot = new Bot(BOT_TOKEN);

// Store message authors by message_id to track who wrote which message
const messageAuthors = new Map<
  number,
  { id: number; first_name: string; username?: string }
>();

// Store users whose messages received reactions (in order)
const userList: Array<{ id: number; first_name: string; username?: string }> =
  [];

// Track the last "list updated" message for each chat to delete it later
const lastListMessages = new Map<number, number>();

// Listen to new messages and store the author
bot.on("message", async (ctx) => {
  console.log("New message received:");
  console.log("=>", {
    message_id: ctx.message.message_id,
    chat: {
      id: ctx.chat.id,
      type: ctx.chat.type,
      title: ctx.chat.type !== "private" ? ctx.chat.title : undefined,
    },
    from: {
      id: ctx.from.id,
      first_name: ctx.from.first_name,
      username: ctx.from.username,
    },
    date: new Date(ctx.message.date * 1000).toISOString(),
    text: ctx.message.text,
    caption: ctx.message.caption,
  });

  // Store the message author for later reference
  messageAuthors.set(ctx.message.message_id, {
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    username: ctx.from.username,
  });
});

// Listen to message reactions
bot.on("message_reaction", async (ctx) => {
  console.log("Reaction received:");
  console.log({
    chat: {
      id: ctx.messageReaction.chat.id,
      type: ctx.messageReaction.chat.type,
    },
    user: {
      id: ctx.messageReaction.user.id,
      first_name: ctx.messageReaction.user.first_name,
      username: ctx.messageReaction.user.username,
    },
    message_id: ctx.messageReaction.message_id,
    date: new Date(ctx.messageReaction.date * 1000).toISOString(),
    old_reaction: ctx.messageReaction.old_reaction,
    new_reaction: ctx.messageReaction.new_reaction,
  });

  // Check if the new reaction contains heart or thumbs up emoji
  const newReaction = ctx.messageReaction.new_reaction;
  const hasHeartOrThumbsUp = newReaction.some((reaction) => {
    if (reaction.type === "emoji") {
      return reaction.emoji === "❤" || reaction.emoji === "👍";
    }
    return false;
  });

  if (hasHeartOrThumbsUp) {
    // Get the message author from cache
    let messageAuthor = messageAuthors.get(ctx.messageReaction.message_id);

    // If not in cache, try to forward the message to get the author
    if (!messageAuthor) {
      console.log(
        `Message author not in cache. Attempting to forward message ${ctx.messageReaction.message_id}...`,
      );

      try {
        // Forward the message to the specified chat
        const forwardedMessage = await ctx.api.forwardMessage(
          FORWARD_CHAT_ID,
          ctx.messageReaction.chat.id,
          ctx.messageReaction.message_id,
        );

        console.log("Forwarded message:", forwardedMessage);

        // Extract author from forwarded message
        if (forwardedMessage.forward_origin) {
          const origin = forwardedMessage.forward_origin;

          if (origin.type === "user") {
            messageAuthor = {
              id: origin.sender_user.id,
              first_name: origin.sender_user.first_name,
              username: origin.sender_user.username,
            };
            console.log("Found message author from forward:", messageAuthor);

            // Store it for future use
            messageAuthors.set(ctx.messageReaction.message_id, messageAuthor);
          } else if (origin.type === "hidden_user") {
            console.log(
              "⚠️  Message author has privacy settings enabled (hidden user)",
            );
            messageAuthor = {
              id: 0,
              first_name: origin.sender_user_name,
              username: undefined,
            };
          } else {
            console.log(
              `⚠️  Message is from a ${origin.type}, not a regular user`,
            );
          }
        }

        // // Delete the forwarded message to keep the chat clean
        // await ctx.api.deleteMessage(
        //   ctx.messageReaction.chat.id,
        //   forwardedMessage.message_id,
        // );
      } catch (error) {
        console.error("Error forwarding message:", error);
        console.log(
          "⚠️  Could not retrieve message. It may have been deleted or bot lacks permissions.",
        );
      }
    }

    if (messageAuthor) {
      // Check if user is already in the list
      const existingIndex = userList.findIndex(
        (user) => user.id === messageAuthor.id,
      );

      let listChanged = false;

      if (existingIndex === -1) {
        // Add new user to the list
        userList.push(messageAuthor);
        console.log("\n📝 User added to list!");
        listChanged = true;
      } else {
        console.log("\n📝 User already in list");
      }

      // Print the current list to console
      console.log("\n=== Current List ===");
      userList.forEach((user, index) => {
        const username = user.username ? `@${user.username}` : "";
        console.log(
          `${index + 1}. ${user.first_name} ${username} (ID: ${user.id})`,
        );
      });
      console.log("====================\n");

      // Send updated list to the chat if it changed
      if (listChanged) {
        const chatId = ctx.messageReaction.chat.id;

        // Delete the previous list message if it exists
        const previousMessageId = lastListMessages.get(chatId);
        if (previousMessageId) {
          try {
            await ctx.api.deleteMessage(chatId, previousMessageId);
            console.log("Deleted previous list message");
          } catch (error) {
            console.log("Could not delete previous list message:", error);
          }
        }

        // Send new list message
        const listMessage = userList
          .map((user, index) => {
            const username = user.username ? `@${user.username}` : "";
            return `${index + 1}. ${user.first_name} ${username}`;
          })
          .join("\n");

        const sentMessage = await ctx.api.sendMessage(
          chatId,
          `📋 Updated List:\n\n${listMessage}`,
        );

        // Store the new message ID for future deletion
        lastListMessages.set(chatId, sentMessage.message_id);
      }
    }
  }
});

// Handle errors
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Start the bot
console.log("Starting bot...");
bot.start({
  allowed_updates: ["message", "message_reaction"],
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
    console.log("Listening for reactions...");
  },
});

// Handle graceful shutdown
process.once("SIGINT", () => {
  console.log("\nStopping bot...");
  bot.stop();
});

process.once("SIGTERM", () => {
  console.log("\nStopping bot...");
  bot.stop();
});
