import type { Update } from "grammy/types";
import type { Id } from "@halakabot/db";
import type { BotApp } from "./bot";

/**
 * Work that runs on a Cloudflare Queue rather than inside an HTTP request, with
 * up to 15 minutes per job. Each queue's consumer handles one job at a time
 * (max_concurrency = 1 in wrangler.toml):
 *
 *   - updates: Telegram updates, processed in the order they arrive, as they
 *     were under long polling.
 *   - imports: post imports, which can take a while; on their own queue so they
 *     never hold up updates.
 */
export type BotJob =
  | { type: "update"; update: Update }
  | { type: "import_post"; importId: Id<"postImports"> };

export async function runJob(app: BotApp, job: BotJob): Promise<void> {
  switch (job.type) {
    case "update":
      await app.bot.handleUpdate(job.update);
      return;
    case "import_post":
      await app.botActions.importPost(job.importId);
      return;
  }
}

/** One-line label for logs, e.g. "update 42" or "import_post <id>". */
export function describeJob(job: BotJob): string {
  return job.type === "update" ? `update ${job.update.update_id}` : `import_post ${job.importId}`;
}
