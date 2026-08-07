import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
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
    // A closed (locked) halaqa is final — don't publish its list again. Resolve
    // the target session the same way the bot does when none is given: the most
    // recent one for this post.
    let sessionNumber = args.sessionNumber;
    if (sessionNumber === undefined) {
      const sessions = await ctx.runQuery(api.queries.getAvailableSessions, {
        chatId: args.chatId,
        postId: args.postId,
      });
      sessionNumber = sessions[0]?.sessionNumber;
    }

    if (sessionNumber !== undefined) {
      const sessionInfo = await ctx.runQuery(api.queries.getSessionInfo, {
        chatId: args.chatId,
        postId: args.postId,
        sessionNumber,
      });

      if (sessionInfo?.isLocked) {
        throw new Error("لا يمكن إرسال القائمة: الحلقة مغلقة. الرجاء فتح الحلقة أولاً.");
      }
    }

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
 * Groq's free tier allows 8000 tokens per minute for gpt-oss-120b, counting
 * the prompt plus the reserved completion. Held slightly under the real limit
 * so a token estimate that runs a little low still fits.
 */
const TPM_BUDGET = 7600;

/** Floor for a usable answer, including the hidden reasoning channel. */
const MIN_COMPLETION_TOKENS = 600;

/**
 * Which step of the bulk score matching failed. Sent to the client so the
 * modal can show what actually went wrong instead of one generic message.
 */
type BulkScoreErrorStage =
  | "config"
  | "too_large"
  | "rate_limit"
  | "auth"
  | "upstream"
  | "http"
  | "truncated"
  | "empty"
  | "parse"
  | "shape";

// A type alias, not an interface: ConvexError<T> constrains T to Value, and an
// interface has no implicit index signature to satisfy that constraint.
type BulkScoreErrorData = {
  kind: "bulk_score_failure";
  stage: BulkScoreErrorStage;
  /** Arabic, shown to the admin */
  message: string;
  /** Technical detail, shown in the modal's collapsible section */
  detail: string;
  /** Seconds to wait, when the upstream told us */
  retryAfterSeconds?: number;
};

/**
 * Convex replaces the message of a plain Error with "Server Error" in
 * production — only ConvexError data survives the trip to the browser.
 * Every failure below therefore goes out as ConvexError.
 */
function bulkScoreError(data: Omit<BulkScoreErrorData, "kind">): ConvexError<BulkScoreErrorData> {
  const payload: BulkScoreErrorData = { kind: "bulk_score_failure", ...data };
  return new ConvexError(payload);
}

/** Groq errors arrive as JSON ({error:{message}}) or bare text; take either. */
function readUpstreamMessage(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  } catch {
    // not JSON — fall through to the raw body
  }
  return body.slice(0, 300);
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
      throw bulkScoreError({
        stage: "config",
        message: "لم يتم إعداد مفتاح الذكاء الاصطناعي على الخادم.",
        detail: "GROQ_API_KEY is not set in the Convex deployment environment.",
      });
    }

    // Size context is attached to every failure: the most common cause is a
    // long pasted list or a large roster pushing the request over the
    // free-tier token budget, and that is invisible without the numbers.
    const sizeContext = `roster=${args.roster.length} students, pasted text=${args.text.length} chars`;

    // The roster goes to the model as small integer indices, never as Convex
    // IDs. A Convex ID is 32 random base32 chars — roughly one token per two
    // chars — so a 133-student roster spent ~4400 tokens on identifiers the
    // model only had to echo back, which alone overran the 8000 TPM limit.
    // Indices cost 1-3 tokens each and are mapped back to entry IDs below.
    const rosterList = args.roster.map((s, i) => `${i} | ${s.name}`).join("\n");

    const prompt = `You are helping a Quran study group (حلقة) teacher enter exam scores. The teacher pasted a hand-written list of student names with scores. Match each line against the official roster below.

Roster of students who took the exam (id | name), where id is the line number:
${rosterList}

Pasted text:
"""
${args.text}
"""

Rules:
1. Extract every (name, score) pair you can find in the pasted text. Names and scores are in Arabic; scores may use Arabic-Indic numerals (٩), ASCII digits (9), decimals (٨٫٥ or 8.5), or words (تسعة).
2. Match each extracted name to a roster id (the integer at the start of the roster line). Arabic names vary in spelling (أ/ا/إ, ة/ه, ى/ي), may be partial (first name only), or use a kunya (أم فلان). Match generously but never guess between two equally plausible roster students — return null id instead.
3. If a student is marked absent (غائبة, لم تحضر, غ) or has no readable score, return score null.
4. confidence: "high" = clear unambiguous match, "medium" = probable match, "low" = uncertain.
5. Each roster id may appear at most once. A pasted name with no roster match gets id null.

Respond with ONLY a JSON object of this exact shape:
{"matches": [{"id": <roster line number or null>, "extractedName": "<name as written in the pasted text>", "score": <number or null>, "confidence": "high" | "medium" | "low"}]}`;

    // Groq charges prompt + max_completion_tokens against the per-minute
    // budget before generating anything, so both sides are sized here.
    // Deliberately conservative (Arabic and random IDs tokenize densely) —
    // this guards the limit, it does not need to be exact.
    const estimatedPromptTokens = Math.ceil(prompt.length / 1.6);
    // The answer scales with the pasted text (one JSON row per pasted line),
    // not with the roster, plus headroom for the hidden reasoning channel.
    const wantedCompletionTokens = Math.min(4096, 512 + args.text.length * 6);
    const maxCompletionTokens = Math.min(
      wantedCompletionTokens,
      TPM_BUDGET - estimatedPromptTokens
    );

    // Below this the model cannot finish even a short answer, so fail with a
    // clear cause instead of letting Groq reject the request.
    if (maxCompletionTokens < MIN_COMPLETION_TOKENS) {
      throw bulkScoreError({
        stage: "too_large",
        message: `قائمة الطالبات كبيرة جداً (${args.roster.length} طالبة) على الحد المجاني للذكاء الاصطناعي. الرجاء إبلاغ المسؤول التقني.`,
        detail: `Prompt alone is ~${estimatedPromptTokens} tokens against a ${TPM_BUDGET}-token budget, leaving ${maxCompletionTokens} for the answer (${sizeContext}).`,
      });
    }

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
        max_completion_tokens: maxCompletionTokens,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const upstream = readUpstreamMessage(body);
      const detail = `Groq HTTP ${response.status}: ${upstream} (${sizeContext})`;

      if (response.status === 429) {
        // Groq reports the wait either in the Retry-After header or inside the
        // message ("Please try again in 5.4s")
        const header = Number(response.headers.get("retry-after"));
        const fromMessage = upstream.match(/try again in ([\d.]+)s/);
        const seconds = Number.isFinite(header) && header > 0
          ? Math.ceil(header)
          : fromMessage
            ? Math.ceil(Number(fromMessage[1]))
            : undefined;

        throw bulkScoreError({
          stage: "rate_limit",
          message: seconds
            ? `تم تجاوز الحد المسموح لاستخدام الذكاء الاصطناعي. حاولي بعد ${seconds} ثانية.`
            : "تم تجاوز الحد المسموح لاستخدام الذكاء الاصطناعي. حاولي بعد قليل.",
          detail,
          ...(seconds !== undefined ? { retryAfterSeconds: seconds } : {}),
        });
      }

      // 413: the request exceeded the per-minute token limit on its own,
      // rather than being throttled against recent usage. Waiting won't help.
      if (response.status === 413) {
        throw bulkScoreError({
          stage: "too_large",
          message: `الطلب أكبر من الحد المسموح للذكاء الاصطناعي (${args.roster.length} طالبة). الرجاء إبلاغ المسؤول التقني.`,
          detail,
        });
      }

      if (response.status === 401 || response.status === 403) {
        throw bulkScoreError({
          stage: "auth",
          message: "مفتاح الذكاء الاصطناعي غير صالح. الرجاء إبلاغ المسؤول التقني.",
          detail,
        });
      }

      if (response.status >= 500) {
        throw bulkScoreError({
          stage: "upstream",
          message: "خدمة الذكاء الاصطناعي غير متاحة حالياً. حاولي بعد قليل.",
          detail,
        });
      }

      throw bulkScoreError({
        stage: "http",
        message: `فشل الاتصال بخدمة الذكاء الاصطناعي (رمز ${response.status}).`,
        detail,
      });
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const usage = data?.usage;
    const usageDetail = usage
      ? `prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} total=${usage.total_tokens} tokens`
      : "usage unavailable";
    const content = choice?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      // finish_reason "length" means reasoning consumed the whole completion
      // budget — a longer roster or pasted list makes this far more likely,
      // so it gets its own actionable message.
      if (choice?.finish_reason === "length") {
        throw bulkScoreError({
          stage: "truncated",
          message:
            "النص أو قائمة الطالبات طويلة جداً على الذكاء الاصطناعي. جربي إدخال الدرجات على دفعات أصغر.",
          detail: `Groq stopped with finish_reason=length before emitting an answer (${usageDetail}, max_completion_tokens=4096, ${sizeContext}).`,
        });
      }

      throw bulkScoreError({
        stage: "empty",
        message: "لم يرجع الذكاء الاصطناعي أي نتيجة. حاولي مرة أخرى.",
        detail: `Groq returned empty content (finish_reason=${choice?.finish_reason}, ${usageDetail}, ${sizeContext}).`,
      });
    }

    // The model may wrap the JSON in prose or code fences —
    // extract the outermost object before parsing.
    const unreadableResponse = (reason: string) =>
      bulkScoreError({
        stage: content.length > 0 && choice?.finish_reason === "length" ? "truncated" : "parse",
        message:
          choice?.finish_reason === "length"
            ? "انقطع رد الذكاء الاصطناعي قبل اكتماله. جربي إدخال الدرجات على دفعات أصغر."
            : "تعذّر فهم رد الذكاء الاصطناعي. حاولي مرة أخرى.",
        detail: `${reason} (finish_reason=${choice?.finish_reason}, ${usageDetail}, ${sizeContext}) — response starts: ${content.slice(0, 200)}`,
      });

    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw unreadableResponse("Groq response contained no JSON object");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content.slice(firstBrace, lastBrace + 1));
    } catch (error) {
      throw unreadableResponse(
        `Groq response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const rawMatches = (parsed as { matches?: unknown }).matches;
    if (!Array.isArray(rawMatches)) {
      throw bulkScoreError({
        stage: "shape",
        message: "جاء رد الذكاء الاصطناعي بصيغة غير متوقعة. حاولي مرة أخرى.",
        detail: `Parsed JSON is missing the "matches" array (got keys: ${Object.keys((parsed as object) ?? {}).join(", ") || "none"}, ${usageDetail}, ${sizeContext}).`,
      });
    }

    const seenEntryIds = new Set<string>();

    const matches: BulkScoreMatch[] = rawMatches.flatMap((m: any) => {
      if (typeof m !== "object" || m === null) return [];
      if (typeof m.extractedName !== "string" || m.extractedName.trim() === "") return [];

      // The model answers with a roster line number; translate it back to the
      // real entry ID. Anything out of range or non-numeric becomes null, so a
      // hallucinated index can never point at the wrong student. Accepts a
      // string index too, since models often quote numbers — but an empty
      // string must not slip through, since Number("") is 0 and would silently
      // match the first student on the roster.
      const rawIndex =
        typeof m.id === "string" ? (m.id.trim() === "" ? null : Number(m.id)) : m.id;
      let entryId: string | null =
        typeof rawIndex === "number" &&
        Number.isInteger(rawIndex) &&
        rawIndex >= 0 &&
        rawIndex < args.roster.length
          ? args.roster[rawIndex].entryId
          : null;
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
