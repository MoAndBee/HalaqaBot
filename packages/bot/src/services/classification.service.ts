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
        providerOptions: {
          groq: {
            reasoningFormat: 'parsed',
            reasoningEffort: 'high',
          },
        },
        prompt: `You are analyzing Arabic messages in a Quran study group (حلقة) to extract the SENDER'S OWN NAME when they are identifying themselves, and detect activity types.

CRITICAL - User Intent Detection:
You must determine WHY a name appears in the message. Only extract names when the sender is IDENTIFYING THEMSELVES.

DO NOT extract names when:
1. User is ASKING A QUESTION about someone else
   - Example: "هل حلقه معلمه سهر خلصت" (asking if teacher Sahar's halaqa is done) → contains_name=false
   - Example: "فين فاطمة النهارده؟" (where is Fatima today?) → contains_name=false

2. User is MENTIONING or BLESSING someone else
   - Example: "ربنا يبارك فيك يا منى يا حبيبتي" (blessing Mona) → contains_name=false
   - Example: "جزاك الله خيرا يا أم أحمد" (thanking Um Ahmed) → contains_name=false

3. User is LISTING other people's names (not their own)
   - Example: "البنات اللي حضروا: سارة، نور، هدى" → contains_name=false

4. User is referring to a TEACHER or ADMIN by name
   - Example: "الأستاذة مريم قالت..." → contains_name=false

DO extract names when:
1. User is STATING THEIR OWN NAME to identify themselves
   - Example: "أسماء بكري محمود تسميع" → contains_name=true, names=["أسماء", "بكري", "محمود"]
   - Example: "انا فاطمة احمد" → contains_name=true, names=["فاطمة", "احمد"]
   - Example: "نورا محمد - تلاوة" → contains_name=true, names=["نورا", "محمد"]

For each message:
1. Determine USER INTENT - is the sender identifying themselves or referring to others?
2. Only if identifying themselves: Extract ALL parts of their name as separate elements
3. NEVER include these words as names: "تلاوة", "تسميع", "تصحيح", "مراجعة", "معلمة", "أستاذة"
4. Detect the activity type (users may misspell):
   - "تسميع" = recitation from memory (also: تسمبع, تسميييع, تسمع, تثميع)
   - "تلاوة" = reading from Quran (also: تلاوه, تلاااوة, طلاوة)
   - null = not mentioned

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
        providerOptions: {
          groq: {
            reasoningFormat: 'parsed',
            reasoningEffort: 'low',
          },
        },
        prompt: `Analyze the following Arabic messages and detect the activity type. Users may misspell words.

Activity types:
- "تسميع" = recitation from memory (common misspellings: تسمبع, تسميييع, تسمع, تثميع, تسميه)
- "تلاوة" = reading from Quran (common misspellings: تلاوه, تلاااوة, طلاوة, تلاوت)
- null = not mentioned

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
