import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Creates a bot task to send the participant list as a message to the post
 */
export const sendParticipantList = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.optional(v.number()),
    flower: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Query the user list first to ensure the cache is warmed up with fresh data
    // This prevents the bot from hitting stale cached data when it processes the task
    await ctx.runQuery(api.queries.getUserList, {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: args.sessionNumber,
    });

    // Create a task for the bot to process
    const result = await ctx.runMutation(api.mutations.createBotTask, {
      type: "send_participant_list",
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: args.sessionNumber,
      flower: args.flower,
    });

    return { success: true, taskId: result.taskId };
  },
});

/**
 * Creates a bot task to react to a specific message with a heart emoji
 */
export const reactToMessage = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(api.mutations.createBotTask, {
      type: "react_to_message",
      chatId: args.chatId,
      postId: args.postId,
      messageId: args.messageId,
    });

    return { success: true, taskId: result.taskId };
  },
});

interface BulkScoreMatch {
  entryId: string | null;
  extractedName: string;
  score: number | null;
  confidence: "high" | "medium" | "low";
}

/**
 * Matches a pasted free-form text of student names and scores against the
 * roster of a single exam day, using an LLM to handle Arabic spelling
 * variants, Arabic-Indic numerals, scores written as words, absence
 * markers, and partial names. Returns proposed matches for the user to
 * review — nothing is saved here.
 */
export const matchBulkScores = action({
  args: {
    text: v.string(),
    roster: v.array(
      v.object({
        entryId: v.string(),
        name: v.string(),
      })
    ),
  },
  handler: async (_ctx, args): Promise<{ matches: BulkScoreMatch[] }> => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const rosterList = args.roster
      .map((s) => `- id: ${s.entryId} | name: ${s.name}`)
      .join("\n");

    const prompt = `You are helping a Quran study group (حلقة) teacher enter exam scores. The teacher pasted a hand-written list of student names with scores. Match each line against the official roster below.

Roster of students who took the exam (id | name):
${rosterList}

Pasted text:
"""
${args.text}
"""

Rules:
1. Extract every (name, score) pair you can find in the pasted text. Names and scores are in Arabic; scores may use Arabic-Indic numerals (٩), ASCII digits (9), decimals (٨٫٥ or 8.5), or words (تسعة).
2. Match each extracted name to a roster id. Arabic names vary in spelling (أ/ا/إ, ة/ه, ى/ي), may be partial (first name only), or use a kunya (أم فلان). Match generously but never guess between two equally plausible roster students — return null id instead.
3. If a student is marked absent (غائبة, لم تحضر, غ) or has no readable score, return score null.
4. confidence: "high" = clear unambiguous match, "medium" = probable match, "low" = uncertain.
5. Each roster id may appear at most once. A pasted name with no roster match gets id null.

Respond with ONLY a JSON object of this exact shape:
{"matches": [{"entryId": "<roster id or null>", "extractedName": "<name as written in the pasted text>", "score": <number or null>, "confidence": "high" | "medium" | "low"}]}`;

    // Deliberately no response_format: Groq's json_object and json_schema
    // modes both fail intermittently with the gpt-oss reasoning models
    // (json_validate_failed with an empty failed_generation), and a retry
    // would double token usage against the free tier's 8000 TPM budget.
    // Plain text with server-side JSON extraction and validation is reliable.
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        // gpt-oss models emit a reasoning channel; without "hidden" the
        // final answer may never land in message.content
        reasoning_format: "hidden",
        // "low" — at medium the model can burn the whole completion budget
        // on reasoning and finish with reason "length" and empty content
        reasoning_effort: "low",
        // Groq counts this reservation toward the free tier's 8000 TPM
        // limit, so keep prompt + completion under that cap
        max_completion_tokens: 4096,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groq API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error(
        `Groq API returned no content (finish_reason: ${choice?.finish_reason}, choice: ${JSON.stringify(choice)?.slice(0, 500)})`
      );
    }

    // The model may wrap the JSON in prose or code fences —
    // extract the outermost object before parsing.
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Groq API returned no JSON object");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error("Groq API returned invalid JSON");
    }

    const rawMatches = (parsed as { matches?: unknown }).matches;
    if (!Array.isArray(rawMatches)) {
      throw new Error("Groq API response is missing the matches array");
    }

    const validEntryIds = new Set(args.roster.map((s) => s.entryId));
    const seenEntryIds = new Set<string>();

    const matches: BulkScoreMatch[] = rawMatches.flatMap((m: any) => {
      if (typeof m !== "object" || m === null) return [];
      if (typeof m.extractedName !== "string" || m.extractedName.trim() === "") return [];

      let entryId: string | null =
        typeof m.entryId === "string" && validEntryIds.has(m.entryId) ? m.entryId : null;
      // Enforce one match per roster entry even if the model repeats an id
      if (entryId !== null) {
        if (seenEntryIds.has(entryId)) {
          entryId = null;
        } else {
          seenEntryIds.add(entryId);
        }
      }

      const score =
        typeof m.score === "number" && Number.isFinite(m.score) ? m.score : null;
      const confidence: BulkScoreMatch["confidence"] =
        m.confidence === "high" || m.confidence === "medium" || m.confidence === "low"
          ? m.confidence
          : "low";

      return [{ entryId, extractedName: m.extractedName.trim(), score, confidence }];
    });

    return { matches };
  },
});

/**
 * Creates a bot task to detect the sender's real name from a message and store
 * it. Used by the web "add turn" (دور+) flow so adding a participant from a
 * message populates their real name the same way an admin 👌 reaction does.
 */
export const detectNameFromMessage = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(api.mutations.createBotTask, {
      type: "detect_name",
      chatId: args.chatId,
      postId: args.postId,
      messageId: args.messageId,
    });

    return { success: true, taskId: result.taskId };
  },
});

/**
 * One-time backfill: populates the posts table from turnQueue and participationHistory.
 * Only creates post records for posts that have actual participants — informational
 * channel posts (with no users) are excluded.
 *
 * Uses _creationTime (Convex's immutable system field) for reliable timestamps.
 */
export const backfillPosts = action({
  args: {},
  handler: async (ctx) => {
    // Collect unique chatId+postId pairs with earliest timestamp
    const postMap = new Map<string, { chatId: number; postId: number; createdAt: number }>();

    // Helper: paginate through a table and accumulate posts
    async function collectPosts(
      queryFn: (args: { cursor: string | null }) => Promise<{
        page: { chatId: number; postId: number; _creationTime: number }[];
        isDone: boolean;
        continueCursor: string;
      }>
    ) {
      let cursor: string | null = null;
      do {
        const page = await queryFn({ cursor });
        for (const entry of page.page) {
          const key = `${entry.chatId}-${entry.postId}`;
          const timestamp = entry._creationTime;
          const existing = postMap.get(key);
          if (!existing || timestamp < existing.createdAt) {
            postMap.set(key, { chatId: entry.chatId, postId: entry.postId, createdAt: timestamp });
          }
        }
        cursor = page.isDone ? null : page.continueCursor;
      } while (cursor !== null);
    }

    // Scan turnQueue (active participants)
    await collectPosts((args) =>
      ctx.runQuery(internal.queries.getTurnQueueBatch, args)
    );

    // Scan participationHistory (completed participants)
    await collectPosts((args) =>
      ctx.runQuery(internal.queries.getParticipationHistoryBatch, args)
    );

    // Upsert only posts that have real participants
    let totalUpserted = 0;
    for (const post of postMap.values()) {
      await ctx.runMutation(internal.mutations.upsertPostRecord, post);
      totalUpserted++;
    }

    return { totalUpserted };
  },
});
