import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

export interface ClassificationResult {
  containsName: boolean;
  detectedNames?: string[];
  activityType?: "تسميع" | "تلاوة" | null;
  rawResponse: string;
}

// Zod schema for single message classification
const singleClassificationSchema = z.object({
  contains_name: z.boolean(),
  names: z.array(z.string()),
  activity_type: z.enum(["تسميع", "تلاوة"]).nullable(),
});

// Zod schema for batch message classification
const batchClassificationSchema = z.object({
  results: z.array(
    z.object({
      message_id: z.number(),
      contains_name: z.boolean(),
      names: z.array(z.string()),
      activity_type: z.enum(["تسميع", "تلاوة"]).nullable(),
    })
  ),
});

// Lightweight schema for activity type detection only (no name detection)
const activityTypeOnlySchema = z.object({
  results: z.array(
    z.object({
      message_id: z.number(),
      activity_type: z.enum(["تسميع", "تلاوة"]).nullable(),
    })
  ),
});

export class ClassificationService {

  constructor() {
  }

  /**
   * Classifies multiple messages in a batch to detect names
   * @param messages Array of messages with their IDs and text
   * @returns Map of message IDs to classification results
   */
  async classifyBatch(messages: Array<{ id: number; text: string }>): Promise<Map<number, ClassificationResult>> {
    if (messages.length === 0) {
      return new Map();
    }

    try {
      // Build batch prompt
      const messagesList = messages
        .map((msg) => `${msg.id}: "${msg.text}"`)
        .join(",");

      const { object } = await generateObject({
        model: groq("openai/gpt-oss-20b"),
        schema: batchClassificationSchema,
        prompt: `You are analyzing Arabic messages to extract student names and activity types.

For each message:
1. Identify if it contains a PERSON'S NAME (Arabic names like "أسماء بكري محمود", "فاطمة أحمد", etc.)
2. Extract ALL parts of the name (first, middle, last) as separate elements in the names array
3. IMPORTANT: Do NOT include these words as names: "تلاوة", "تسميع", "تصحيح", "مراجعة"
4. Detect the activity type:
   - "تسميع" = recitation from memory
   - "تلاوة" = reading from Quran
   - null = not mentioned

Example:
- Input: "أسماء بكري محمود تسميع"
- Output: contains_name=true, names=["أسماء", "بكري", "محمود"], activity_type="تسميع"

Messages to analyze: ${messagesList}

Return the message_id, contains_name (true/false), names array, and activity_type for each message.`
      });

      const results = new Map<number, ClassificationResult>();

      // Map results back to message IDs
      for (const result of object.results) {
        results.set(result.message_id, {
          containsName: result.contains_name,
          detectedNames: result.names || [],
          activityType: result.activity_type,
          rawResponse: JSON.stringify(object),
        });
      }

      // Ensure all messages have a result (fallback to false for missing)
      for (const msg of messages) {
        if (!results.has(msg.id)) {
          results.set(msg.id, {
            containsName: false,
            detectedNames: [],
            activityType: null,
            rawResponse: JSON.stringify(object),
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Batch classification error:", error);
      // Return false for all messages on error
      const results = new Map<number, ClassificationResult>();
      for (const msg of messages) {
        results.set(msg.id, {
          containsName: false,
          detectedNames: [],
          activityType: null,
          rawResponse: `Error: ${error}`,
        });
      }
      return results;
    }
  }

  /**
   * Lightweight classification that ONLY detects activity type (not names)
   * Use this when the user's realName is already known to save on API costs
   * @param messages Array of messages with their IDs and text
   * @returns Map of message IDs to classification results (containsName will always be false)
   */
  async classifyActivityTypeOnly(messages: Array<{ id: number; text: string }>): Promise<Map<number, ClassificationResult>> {
    if (messages.length === 0) {
      return new Map();
    }

    try {
      // Build batch prompt
      const messagesList = messages
        .map((msg) => `${msg.id}: "${msg.text}"`)
        .join(",");

      const { object } = await generateObject({
        model: groq("openai/gpt-oss-20b"),
        schema: activityTypeOnlySchema,
        prompt: `Analyze the following Arabic messages and for each message, determine the activity type:
- "تسميع" (recitation from memory)
- "تلاوة" (reading from Quran)
- null if not mentioned

Return the message_id and activity_type for each message.

Messages: ${messagesList}`
      });

      const results = new Map<number, ClassificationResult>();

      // Map results back to message IDs
      for (const result of object.results) {
        results.set(result.message_id, {
          containsName: false, // Not detecting names in this lightweight version
          detectedNames: [],
          activityType: result.activity_type,
          rawResponse: JSON.stringify(object),
        });
      }

      // Ensure all messages have a result (fallback to null for missing)
      for (const msg of messages) {
        if (!results.has(msg.id)) {
          results.set(msg.id, {
            containsName: false,
            detectedNames: [],
            activityType: null,
            rawResponse: JSON.stringify(object),
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Activity type classification error:", error);
      // Return false for all messages on error
      const results = new Map<number, ClassificationResult>();
      for (const msg of messages) {
        results.set(msg.id, {
          containsName: false,
          detectedNames: [],
          activityType: null,
          rawResponse: `Error: ${error}`,
        });
      }
      return results;
    }
  }
}
