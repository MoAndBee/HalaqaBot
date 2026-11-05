import type { Api } from "grammy";
import { ConvexClient, ConvexHttpClient, api } from "@halakabot/db";
import type { Doc } from "@halakabot/db";

const VERDICT_HEADLINE: Record<string, string> = {
  server: "🔴 SERVER problem",
  user: "🟡 USER-side problem (their connection)",
  unclear: "⚪ Unclear — needs a look",
};

/**
 * Posts an alert to the configured chat each time the web app reports a stuck
 * or failed participant list send, with the server's verdict on whose fault
 * it was (see reportSendProblem).
 */
export class SendProblemAlertService {
  private unsubscribe: (() => void) | null = null;
  private inFlight = new Set<string>();

  constructor(
    private api: Api,
    private convex: ConvexHttpClient,
    private reactiveClient: ConvexClient,
    private alertChatId: string | undefined,
  ) {}

  start() {
    if (!this.alertChatId) {
      console.log("ℹ️  ALERT_CHAT_ID not set — stuck-send reports are recorded but not posted");
      return;
    }
    this.unsubscribe = this.reactiveClient.onUpdate(
      api.queries.getUnalertedSendProblems,
      {},
      (problems: Doc<"sendProblems">[] | undefined) => {
        if (problems === undefined) return;
        for (const problem of problems) void this.alert(problem);
      },
    );
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private async alert(problem: Doc<"sendProblems">) {
    // The subscription can re-deliver a problem before our "alerted" mark lands
    if (this.inFlight.has(problem._id)) return;
    this.inFlight.add(problem._id);
    try {
      await this.api.sendMessage(this.alertChatId!, formatAlert(problem));
      await this.convex.mutation(api.mutations.markSendProblemAlerted, { problemId: problem._id });
    } catch (error) {
      console.error(`Failed to post send-problem alert ${problem._id}:`, error);
    } finally {
      this.inFlight.delete(problem._id);
    }
  }
}

function yesNo(value: boolean): string {
  return value ? "yes" : "NO";
}

function formatAlert(p: Doc<"sendProblems">): string {
  const who = p.userName ? `${p.userName} (${p.userId ?? "?"})` : String(p.userId ?? "unknown");
  const what = p.kind === "stuck" ? `stuck for ${Math.round(p.waitedMs / 1000)}s` : "failed";
  const lines = [
    VERDICT_HEADLINE[p.verdict] ?? p.verdict,
    `Participant list send ${what}`,
    "",
    p.reason,
    "",
    `Admin: ${who}`,
    `Halaqa: chat ${p.chatId}, post ${p.postId}${p.sessionNumber !== undefined ? `, session ${p.sessionNumber}` : ""}`,
    `Server received request: ${p.taskId ? `yes${p.serverMs !== undefined ? ` (queued in ${p.serverMs}ms)` : ""}` : "NO"}`,
    `Phone live connection up: ${yesNo(p.wsConnected)} (reconnects: ${Math.max(0, p.connectionCount - 1)}, failed attempts: ${p.connectionRetries})`,
    `Phone could reach our server over HTTPS: ${yesNo(p.serverReachable)}`,
    `Phone could reach the internet: ${yesNo(p.internetReachable)}`,
    `App in foreground: ${yesNo(p.pageVisible)}`,
  ];
  if (p.error) lines.push(`Error: ${p.error.slice(0, 300)}`);
  if (p.reportedLate) lines.push("Reported late (phone couldn't report at the time)");
  return lines.join("\n");
}
