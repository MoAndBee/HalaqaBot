import type { Api } from "grammy";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";
import type { ClassificationService } from "./classification.service";
import type { MessageAuthor } from "./message.service";

export interface NameDetectionDeps {
  convex: ConvexHttpClient;
  classificationService: ClassificationService;
  forwardChatId: string;
}

export interface NameDetectionResult {
  /** The joined detected name, or null if none was detected. */
  realName: string | null;
  /** Activity type detected on this message, if any. */
  activityType: string | null | undefined;
}

/**
 * Detect the sender's real name from a message using FULL AI classification.
 *
 * This is the shared name-detection routine used by both the admin 👌 reaction
 * handler and the web "add turn" (دور+) bot task. It:
 *   1. fetches the message text (forwarding from Telegram if it isn't stored),
 *   2. runs FULL classification when the stored classification has no names
 *      (the auto-classify pass on message arrival is activity-type-only),
 *   3. persists the refreshed classification, and
 *   4. returns the joined detected name plus the activity type.
 *
 * It does NOT write the user's realName or add them to any list — the caller
 * decides what to do with the result.
 */
export async function detectRealNameFromMessage(
  deps: NameDetectionDeps,
  grammyApi: Api,
  chatId: number,
  postId: number,
  messageId: number,
  messageAuthor: MessageAuthor,
  channelId: number | undefined,
): Promise<NameDetectionResult> {
  const { convex, classificationService, forwardChatId } = deps;

  // Try to get classification for this message
  let classification = await convex.query(api.queries.getClassification, {
    chatId,
    postId,
    messageId,
  });

  // Get the message text (we'll need it for re-classification if needed)
  let messageText = await convex.query(api.queries.getMessageText, {
    chatId,
    postId,
    messageId,
  });

  console.log(`ℹ️  Message text from database: "${messageText}"`);

  // If message text is missing, try to fetch it from Telegram
  if (!messageText || messageText.trim().length === 0) {
    console.log(`⚠️  Message text missing from database, attempting to fetch from Telegram...`);
    try {
      const forwardedMessage = await grammyApi.forwardMessage(
        forwardChatId,
        chatId,
        messageId,
      );

      // Extract text from the forwarded message
      messageText = forwardedMessage.text || forwardedMessage.caption || null;
      console.log(`✅ Fetched message text from Telegram: "${messageText}"`);

      // Update the database with the text
      if (messageText) {
        await convex.mutation(api.mutations.addMessageAuthor, {
          chatId,
          postId,
          messageId,
          user: messageAuthor,
          messageText,
          channelId,
        });
        console.log(`✅ Updated database with message text`);
      }
    } catch (error) {
      console.error(`❌ Error fetching message from Telegram:`, error);
    }
  }

  // If classification exists but has no names detected, re-run FULL classification.
  // This happens when activity-type-only classification was used during auto-classification.
  const needsFullClassification = classification &&
    (!classification.containsName || !classification.detectedNames || classification.detectedNames.length === 0);

  if (needsFullClassification && messageText && messageText.trim().length > 0) {
    console.log(`ℹ️  Existing classification has no names, re-running FULL classification...`);

    const classifications = await classificationService.classifyBatch([
      { id: messageId, text: messageText }
    ]);

    const result = classifications.get(messageId);
    console.log(`🔍 Full classification result:`, {
      containsName: result?.containsName,
      detectedNames: result?.detectedNames,
      activityType: result?.activityType,
      rawResponse: result?.rawResponse,
    });

    if (result) {
      // Update the stored classification with detected names
      await convex.mutation(api.mutations.storeClassification, {
        chatId,
        postId,
        messageId,
        messageText: messageText,
        containsName: result.containsName,
        detectedNames: result.detectedNames || [],
        activityType: result.activityType ?? classification!.activityType ?? undefined,
        channelId,
      });

      // Update our local classification variable
      classification = {
        containsName: result.containsName,
        detectedNames: result.detectedNames || [],
        activityType: result.activityType ?? classification!.activityType,
      };
    }
  }

  // If not classified yet at all, classify it now
  if (!classification && messageText && messageText.trim().length > 0) {
    console.log(`ℹ️  No classification exists, running FULL classification...`);

    const classifications = await classificationService.classifyBatch([
      { id: messageId, text: messageText }
    ]);

    const result = classifications.get(messageId);
    console.log(`🔍 Classification result:`, {
      containsName: result?.containsName,
      detectedNames: result?.detectedNames,
      activityType: result?.activityType,
      rawResponse: result?.rawResponse,
    });

    if (result) {
      // Store the classification
      await convex.mutation(api.mutations.storeClassification, {
        chatId,
        postId,
        messageId,
        messageText: messageText,
        containsName: result.containsName,
        detectedNames: result.detectedNames || [],
        activityType: result.activityType ?? undefined,
        channelId,
      });

      classification = {
        containsName: result.containsName,
        detectedNames: result.detectedNames || [],
        activityType: result.activityType,
      };
    }
  }

  if (!messageText || messageText.trim().length === 0) {
    console.log(`⚠️  Message text is empty or could not be retrieved for message ${messageId}, cannot classify`);
  }

  // Extract real name if available (join all detected names)
  let realName: string | null = null;
  if (classification?.detectedNames && classification.detectedNames.length > 0) {
    realName = classification.detectedNames.join(' ');
  }

  return { realName, activityType: classification?.activityType };
}
