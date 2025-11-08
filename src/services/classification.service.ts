import { groq } from "@ai-sdk/groq";
import { generateObject } from "ai";
import { z } from "zod";

export interface ClassificationResult {
  containsName: boolean;
  rawResponse: string;
}

// Zod schema for single message classification
const singleClassificationSchema = z.object({
  contains_name: z.boolean(),
  names: z.array(z.string()),
});

// Zod schema for batch message classification
const batchClassificationSchema = z.object({
  results: z.array(
    z.object({
      message_id: z.number(),
      contains_name: z.boolean(),
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
        prompt: `Analyze the following messages and determine which ones contain a person's name. Messages: ${messagesList}`
      });

      const results = new Map<number, ClassificationResult>();

      // Map results back to message IDs
      for (const result of object.results) {
        results.set(result.message_id, {
          containsName: result.contains_name,
          rawResponse: JSON.stringify(object),
        });
      }

      // Ensure all messages have a result (fallback to false for missing)
      for (const msg of messages) {
        if (!results.has(msg.id)) {
          results.set(msg.id, {
            containsName: false,
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
          rawResponse: `Error: ${error}`,
        });
      }
      return results;
    }
  }
}
