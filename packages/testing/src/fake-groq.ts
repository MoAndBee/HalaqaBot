/**
 * Stand-in for Groq's chat completions API (OpenAI-compatible), answering the
 * bot's two classification prompts with simple deterministic rules instead of
 * an LLM. Point the bot's GROQ_BASE_URL at `<server>/groq/openai/v1`.
 *
 * The rules are deliberately simple and predictable — tests should state
 * their expectations in terms of them:
 *   - activity: a word starting تسم/تثم → تسميع, starting تلا/طلا → تلاوة
 *   - name: after dropping the activity word, "انا"/"أنا"/"اسمي" and punctuation,
 *     2–4 Arabic words remain, and the message isn't a question, a blessing,
 *     a thank-you or a greeting (contains ؟/?, "يا", or starts with
 *     هل/فين/جزاك/ربنا/شكرا/السلام).
 */

const ACTIVITY_PATTERNS: Array<[RegExp, "تسميع" | "تلاوة"]> = [
  [/^(تسم|تثم)/, "تسميع"],
  [/^(تلا|طلا)/, "تلاوة"],
];
const SELF_INTRO = new Set(["انا", "أنا", "اسمي"]);
const NOT_A_SELF_INTRO = /[؟?]|(^|\s)يا(\s|$)|^(هل|فين|جزاك|ربنا|شكرا|السلام)/;
const ARABIC_WORD = /^[ء-ي٠-٩]+$/;

export interface FakeClassification {
  activityType: "تسميع" | "تلاوة" | null;
  names: string[];
}

export function classify(text: string): FakeClassification {
  const words = text
    .replace(/[-–—،,.:!]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let activityType: FakeClassification["activityType"] = null;
  const rest: string[] = [];
  for (const word of words) {
    const activity = ACTIVITY_PATTERNS.find(([pattern]) => pattern.test(word));
    if (activity) activityType ??= activity[1];
    else if (!SELF_INTRO.has(word)) rest.push(word);
  }

  const isName =
    !NOT_A_SELF_INTRO.test(text.trim()) &&
    rest.length >= 2 &&
    rest.length <= 4 &&
    rest.every((word) => ARABIC_WORD.test(word));
  return { activityType, names: isName ? rest : [] };
}

/** Pulls `<id>: "<text>"` pairs out of the bot's prompt. */
function promptMessages(prompt: string): Array<{ id: number; text: string }> {
  return [...prompt.matchAll(/(\d+): "((?:[^"\\]|\\.)*)"/g)].map((m) => ({ id: Number(m[1]), text: m[2]! }));
}

export interface FakeGroqCall {
  kind: "full" | "activity";
  messages: Array<{ id: number; text: string }>;
}

export function createFakeGroq() {
  const calls: FakeGroqCall[] = [];

  async function handle(request: Request): Promise<Response> {
    if (!new URL(request.url).pathname.endsWith("/chat/completions")) {
      return Response.json({ error: { message: "Not found" } }, { status: 404 });
    }
    const body = (await request.json()) as {
      messages: Array<{ role: string; content: string }>;
      response_format?: { json_schema?: { schema?: unknown } };
    };
    const prompt = body.messages.map((m) => m.content).join("\n");
    // The full prompt's schema asks for names; the activity-only one doesn't.
    const kind = JSON.stringify(body.response_format ?? {}).includes("contains_name") ? "full" : "activity";
    const messages = promptMessages(prompt);
    calls.push({ kind, messages });

    const results = messages.map(({ id, text }) => {
      const { activityType, names } = classify(text);
      return kind === "full"
        ? { message_id: id, contains_name: names.length > 0, names, activity_type: activityType }
        : { message_id: id, activity_type: activityType };
    });

    return Response.json({
      id: `fake-${crypto.randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "fake-groq",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify({ results }) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  }

  return { handle, calls };
}
