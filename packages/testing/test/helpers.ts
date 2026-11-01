import { api } from "@halakabot/db";
import type { Stack } from "../src/harness";

/** Opening line that marks a channel post as a turn-registration post. */
export const REGISTRATION_POST = "حللتم أهلا ونزلتم سهلا 🌸\nسجلي اسمك للحلقة";

/** A t.me link to a message in a private chat, as Telegram builds them. */
export function messageLink(chatId: number, messageId: number): string {
  return `https://t.me/c/${String(chatId).replace(/^-100/, "")}/${messageId}`;
}

/** Whether a post is in the web app's list of halaqas for the chat. */
export async function isListed(stack: Stack, chatId: number, postId: number): Promise<boolean> {
  const { page } = await stack.query(api.queries.getPaginatedPosts, {
    chatId,
    paginationOpts: { numItems: 200, cursor: null },
  });
  return page.some((post: { postId: number }) => post.postId === postId);
}

/** Publishes a registration post and waits until the bot has registered it. */
export async function publishHalaqa(stack: Stack): Promise<number> {
  const { groupMessage } = stack.sim.postToChannel(stack.world.channelId, REGISTRATION_POST);
  const postId = groupMessage!.message_id;
  await stack.waitFor(() => isListed(stack, stack.world.groupId, postId), {
    message: `post ${postId} to be registered`,
  });
  return postId;
}

export async function turnQueue(stack: Stack, postId: number) {
  return stack.query(api.queries.getUserList, { chatId: stack.world.groupId, postId });
}

/**
 * Log lines that mean the bot broke: a job threw, a request hung or crashed,
 * or an /api call failed. Handled errors (e.g. a Telegram call refused and
 * logged) don't count.
 */
export function workerFailures(stack: Stack): string[] {
  return stack.workerLog.filter((line) => /job failed|Uncaught|code had hung|❌ \/api\//.test(line));
}
