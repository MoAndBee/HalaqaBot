import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

interface UserData {
  userId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  detectedNames: string[];
  sourceMessages: Map<string, string>; // Map of detected name -> source message text
  fullNameFromMessage?: string; // The complete full name extracted from a single message
  fullNameSourceMessage?: string; // The source message for the full name
}

async function populateUsersTable() {
  console.log("📊 Fetching all message authors and classifications...\n");

  // Get all message classifications to extract detected names
  const classifications = await convex.query(api.queries.getAllMessageClassifications, {});

  // Create a map of userId -> { detected names, source messages, full name }
  const userDetectedNames = new Map<number, {
    names: Set<string>,
    sourceMessages: Map<string, string>,
    fullName?: string,
    fullNameSourceMessage?: string
  }>();

  // We need to get user info from messageAuthors for each classification
  console.log("🔍 Processing message classifications to extract user names...\n");

  for (const classification of classifications) {
    if (classification.detectedNames.length > 0 && classification.messageText) {
      // Get the message author info
      const messageAuthor = await convex.query(api.queries.getMessageAuthor, {
        chatId: classification.chatId,
        postId: classification.postId,
        messageId: classification.messageId,
      });

      if (messageAuthor && messageAuthor.id !== 0) {
        if (!userDetectedNames.has(messageAuthor.id)) {
          userDetectedNames.set(messageAuthor.id, {
            names: new Set(),
            sourceMessages: new Map()
          });
        }

        const userData = userDetectedNames.get(messageAuthor.id)!;

        // Join all detected names from this message to form the full name
        // Clean up the names: remove Arabic commas and extra spaces
        const fullNameFromThisMessage = classification.detectedNames
          .join(' ')
          .replace(/،/g, ' ') // Replace Arabic comma with space
          .replace(/,/g, ' ') // Replace English comma with space
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim();

        // If we don't have a full name yet, or this one is longer (more complete), use it
        if (!userData.fullName || fullNameFromThisMessage.length > userData.fullName.length) {
          userData.fullName = fullNameFromThisMessage;
          userData.fullNameSourceMessage = classification.messageText;
        }

        // Add all detected names for this user and track the source message
        classification.detectedNames.forEach(name => {
          userData.names.add(name);
          // Store the source message for this detected name (if not already stored)
          if (!userData.sourceMessages.has(name)) {
            userData.sourceMessages.set(name, classification.messageText!);
          }
        });
      }
    }
  }

  console.log(`Found ${userDetectedNames.size} users with detected names\n`);

  // Get all posts to find all unique users
  const allPosts = await convex.query(api.queries.getAllPosts, {});

  // Collect all unique users from userLists
  const allUsersMap = new Map<number, UserData>();

  console.log("📝 Collecting all users from userLists...\n");

  for (const post of allPosts) {
    const userList = await convex.query(api.queries.getUserList, {
      chatId: post.chatId,
      postId: post.postId,
    });

    const allUsers = [...userList.activeUsers, ...userList.completedUsers];

    for (const user of allUsers) {
      if (!allUsersMap.has(user.id)) {
        allUsersMap.set(user.id, {
          userId: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          username: user.username,
          detectedNames: [],
          sourceMessages: new Map(),
        });
      }

      // Merge detected names and source messages
      const userNameData = userDetectedNames.get(user.id);
      if (userNameData && userNameData.names.size > 0) {
        const existingUser = allUsersMap.get(user.id)!;
        const combinedNames = new Set([...existingUser.detectedNames, ...Array.from(userNameData.names)]);
        existingUser.detectedNames = Array.from(combinedNames);

        // Set the full name from message
        if (userNameData.fullName) {
          existingUser.fullNameFromMessage = userNameData.fullName;
          existingUser.fullNameSourceMessage = userNameData.fullNameSourceMessage;
        }

        // Copy source messages
        userNameData.sourceMessages.forEach((messageText, name) => {
          if (!existingUser.sourceMessages.has(name)) {
            existingUser.sourceMessages.set(name, messageText);
          }
        });
      }

      // Also check displayName
      if (user.displayName && user.displayName.trim()) {
        const existingUser = allUsersMap.get(user.id)!;
        if (!existingUser.detectedNames.includes(user.displayName)) {
          existingUser.detectedNames.push(user.displayName);
        }
      }
    }
  }

  console.log(`\nFound ${allUsersMap.size} total unique users\n`);
  console.log("=" .repeat(60));

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [userId, userData] of allUsersMap.entries()) {
    try {
      // Construct telegramName (firstName + lastName)
      const telegramName = userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : userData.firstName;

      // Use the full name from message if available, otherwise fallback to first detected name
      const realName = userData.fullNameFromMessage ||
                       (userData.detectedNames.length > 0 ? userData.detectedNames[0] : undefined);

      // Get the source message for the realName
      const sourceMessageText = userData.fullNameSourceMessage ||
                                (realName ? userData.sourceMessages.get(realName) : undefined);

      console.log(`\n👤 User ${userId}:`);
      console.log(`   Telegram name: ${telegramName}`);
      console.log(`   Username: ${userData.username || "N/A"}`);
      console.log(`   Real name: ${realName || "N/A"}`);
      if (sourceMessageText) {
        console.log(`   Source message: "${sourceMessageText}"`);
      }
      console.log(`   All detected names: [${userData.detectedNames.join(", ")}]`);

      // Upsert user
      const result = await convex.mutation(api.mutations.upsertUser, {
        userId: userId,
        username: userData.username,
        telegramName: telegramName,
        realName: realName,
        sourceMessageText: sourceMessageText,
      });

      if (result.created) {
        console.log(`   ✅ Created new user`);
        created++;
      } else {
        console.log(`   ✅ Updated existing user`);
        updated++;
      }
    } catch (error) {
      console.error(`   ❌ Error processing user ${userId}:`, error);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Population complete!");
  console.log(`   Total users processed: ${allUsersMap.size}`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Users with detected names: ${Array.from(allUsersMap.values()).filter(u => u.detectedNames.length > 0).length}`);
}

populateUsersTable()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
