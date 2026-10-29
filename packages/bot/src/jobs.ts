import type { Update } from "grammy/types";
import type { Id } from "@halakabot/db";
import type { BotApp } from "./bot";

/**
 * Work that runs on the Cloudflare Queue rather than inside an HTTP request.
 * The queue's consumer handles one job at a time (max_concurrency = 1 in
 * wrangler.toml), so Telegram updates are processed in the order they arrive,
 * as they were under long polling, and each job gets up to 15 minutes.
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
