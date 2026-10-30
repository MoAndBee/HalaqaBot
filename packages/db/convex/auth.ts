/**
 * Who may call what. Every public function starts with one of these checks.
 *
 * Callers authenticate with a JWT the bot's Worker signs (see auth.config.ts):
 *   - the bot itself, as subject "bot";
 *   - a Mini App user, as their Telegram user ID, after the Worker verified
 *     Telegram's signature on their initData.
 *
 * Users are authorized by the channelAdmins table, which the bot keeps in sync
 * with Telegram. The bot may do anything.
 */
import { ConvexError } from "convex/values";
import type { Auth, GenericDatabaseReader } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";

export const BOT_SUBJECT = "bot";

type Ctx = { auth: Auth; db: GenericDatabaseReader<DataModel> };
type AuthCtx = { auth: Auth };

export type Caller = { kind: "bot" } | { kind: "user"; userId: number };

function denied(): never {
  throw new ConvexError("غير مصرح");
}

/** The authenticated caller; throws if the request carries no valid token. */
export async function getCaller(ctx: AuthCtx): Promise<Caller> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("يجب تسجيل الدخول من خلال تيليجرام");
  if (identity.subject === BOT_SUBJECT) return { kind: "bot" };
  const userId = Number(identity.subject);
  if (!Number.isSafeInteger(userId)) denied();
  return { kind: "user", userId };
}

/** Only the bot: functions the web app never calls. */
export async function requireBot(ctx: AuthCtx): Promise<void> {
  if ((await getCaller(ctx)).kind !== "bot") denied();
}

/** Channels a user administers (by channelId). */
async function adminChannelIds(ctx: Ctx, userId: number): Promise<Set<number>> {
  const rows = await ctx.db.query("channelAdmins").collect();
  return new Set(rows.filter((row) => row.userId === userId).map((row) => row.channelId));
}

/**
 * The bot, or an admin of at least one active channel. For data that isn't
 * kept per chat (students' profiles, the LLM score matcher).
 */
export async function requireAnyAdmin(ctx: Ctx): Promise<Caller> {
  const caller = await getCaller(ctx);
  if (caller.kind === "bot") return caller;
  const mine = await adminChannelIds(ctx, caller.userId);
  if (mine.size === 0) denied();
  const active = await ctx.db
    .query("channels")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();
  if (!active.some((c) => mine.has(c.channelId))) denied();
  return caller;
}

/** The bot, or an admin of the active channel whose discussion group (or channel) is chatId. */
export async function requireChatAccess(ctx: Ctx, chatId: number): Promise<Caller> {
  const caller = await getCaller(ctx);
  if (caller.kind === "bot") return caller;
  const mine = await adminChannelIds(ctx, caller.userId);
  const byChat = await ctx.db
    .query("channels")
    .withIndex("by_chat", (q) => q.eq("chatId", chatId))
    .collect();
  const byChannel = await ctx.db
    .query("channels")
    .withIndex("by_channel", (q) => q.eq("channelId", chatId))
    .collect();
  const allowed = [...byChat, ...byChannel].some((c) => c.isActive && mine.has(c.channelId));
  if (!allowed) denied();
  return caller;
}

/** The bot, or an admin of the channel. */
export async function requireChannelAccess(ctx: Ctx, channelId: number): Promise<Caller> {
  const caller = await getCaller(ctx);
  if (caller.kind === "bot") return caller;
  const admin = await ctx.db
    .query("channelAdmins")
    .withIndex("by_channel_user", (q) => q.eq("channelId", channelId).eq("userId", caller.userId))
    .first();
  if (!admin) denied();
  return caller;
}

/** Access to a turn-queue or participation row: through the chat it belongs to. */
export async function requireEntryAccess(
  ctx: Ctx,
  entryId: Id<"turnQueue"> | Id<"participationHistory">,
): Promise<Caller> {
  const entry = await ctx.db.get(entryId);
  if (!entry) {
    await getCaller(ctx); // an unauthenticated caller learns nothing about which IDs exist
    throw new ConvexError("Entry not found");
  }
  return requireChatAccess(ctx, entry.chatId);
}

/**
 * For functions that take the caller's own user ID: a user may only pass
 * their own (the bot may pass anyone's).
 */
export function requireSelf(caller: Caller, userId: number): void {
  if (caller.kind === "user" && caller.userId !== userId) denied();
}

/** requireAnyAdmin for actions, which have no database access of their own. */
export const checkAnyAdmin = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireAnyAdmin(ctx);
  },
});
