import { internalAction, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { GenericMutationCtx, WithoutSystemFields } from "convex/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";

/**
 * Queue of work the web app hands to the Telegram bot.
 *
 * The bot runs on Cloudflare Workers, which can't hold a subscription open, so
 * Convex pushes instead: every enqueue schedules notifyWorker, which calls the
 * Worker's /tasks endpoint. The Worker then drains the queue through
 * claimNextBotTask while that request is held open — a scheduled action may
 * wait up to 10 minutes, long enough for the slowest task (a post import).
 *
 * claimNextBotTask lets only one runner hold the queue at a time, so tasks run
 * one by one in creation order no matter how many notifications arrive at once.
 */

/** How long a claimed task blocks the queue before its runner is presumed dead. */
const LEASE_MS = 3 * 60 * 1000;

/** How long a task may sit pending before the cron re-notifies the Worker. */
const STALL_MS = 60 * 1000;

type NewBotTask = Omit<WithoutSystemFields<Doc<"botTasks">>, "status" | "createdAt">;

/** Inserts a pending task and wakes the bot to process it. */
export async function enqueueBotTask(
  ctx: GenericMutationCtx<DataModel>,
  task: NewBotTask,
): Promise<Id<"botTasks">> {
  const taskId = await ctx.db.insert("botTasks", {
    ...task,
    status: "pending",
    createdAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.botTaskQueue.notifyWorker, {});
  return taskId;
}

/**
 * Hands the oldest pending task to the caller and marks it processing, or
 * returns null when the queue is empty or another runner is mid-task.
 */
export const claimNextBotTask = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const active = await ctx.db
      .query("botTasks")
      .withIndex("by_status_processed", (q) =>
        q.eq("status", "processing").gt("processedAt", now - LEASE_MS)
      )
      .first();
    if (active) return null;

    const task = await ctx.db
      .query("botTasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    if (!task) return null;

    await ctx.db.patch(task._id, { status: "processing", processedAt: now });
    return { ...task, status: "processing", processedAt: now };
  },
});

/** Asks the Worker to drain the queue. A no-op until BOT_WORKER_URL is set. */
export const notifyWorker = internalAction({
  args: {},
  handler: async () => {
    const workerUrl = process.env.BOT_WORKER_URL;
    const secret = process.env.BOT_TASKS_SECRET;
    if (!workerUrl || !secret) return;

    try {
      const response = await fetch(new URL("/tasks", workerUrl), {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!response.ok) {
        console.error(`Bot worker rejected task notification: ${response.status} ${await response.text()}`);
      }
    } catch (error) {
      // The stalled-task cron retries, so a failed notification only delays the task.
      console.error("Could not reach bot worker:", error);
    }
  },
});

/**
 * Backstop for a lost notification (Worker deploying, network error): wakes the
 * Worker again if the oldest pending task has waited too long.
 */
export const notifyIfStalled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oldest = await ctx.db
      .query("botTasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();
    if (oldest && oldest.createdAt < Date.now() - STALL_MS) {
      await ctx.scheduler.runAfter(0, internal.botTaskQueue.notifyWorker, {});
    }
  },
});
