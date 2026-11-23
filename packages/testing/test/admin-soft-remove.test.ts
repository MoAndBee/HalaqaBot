import { describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { createConvexEmulator } from "../src/convex-emulator";

const CHANNEL = -100301;
const CHAT = -100401;
const STAYING = 301;
const LEAVING = 302;
const POST = 7;
const session = { channelId: CHANNEL, chatId: CHAT, postId: POST, sessionNumber: 1 };

const asTelegram = (userId: number, firstName: string) =>
  ({ userId, status: "administrator", firstName });

async function fixture() {
  const { t } = await createConvexEmulator();
  await t.run(async (ctx) => {
    await ctx.db.insert("channels", {
      channelId: CHANNEL, chatId: CHAT, isActive: true, createdAt: 1, updatedAt: 1,
    });
  });
  const bot = t.withIdentity({ subject: "bot" });
  await bot.mutation(api.mutations.syncChannelAdmins, {
    channelId: CHANNEL,
    admins: [asTelegram(STAYING, "Staying"), asTelegram(LEAVING, "Leaving")],
  });
  const staying = t.withIdentity({ subject: String(STAYING) });
  const leaving = t.withIdentity({ subject: String(LEAVING) });
  // The leaving admin supervised a halaqa before she stopped being an admin
  await staying.mutation(api.mutations.startNewSession, {
    chatId: CHAT, postId: POST, teacherName: "T", supervisorUserId: LEAVING,
  });
  // Telegram no longer lists her
  await bot.mutation(api.mutations.syncChannelAdmins, {
    channelId: CHANNEL, admins: [asTelegram(STAYING, "Staying")],
  });
  return { t, bot, staying, leaving };
}

describe("an admin removed in Telegram", () => {
  test("keeps her row, marked removed", async () => {
    const { t } = await fixture();
    const rows = await t.run((ctx) => ctx.db.query("channelAdmins").collect());
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === LEAVING)?.removedAt).toBeNumber();
    expect(rows.find((r) => r.userId === STAYING)?.removedAt).toBeUndefined();
  });

  test("loses access to the channel", async () => {
    const { bot, leaving } = await fixture();
    expect(await leaving.query(api.queries.getMyChannels, { userId: LEAVING })).toEqual([]);
    expect(await bot.query(api.queries.isUserAuthorized, { userId: LEAVING, channelId: CHANNEL }))
      .toBe(false);
    await expect(leaving.query(api.queries.getAddableSupervisors, session)).rejects.toThrow("غير مصرح");
  });

  test("is not offered in the add-supervisor list and can't be added", async () => {
    const { staying } = await fixture();
    await staying.mutation(api.mutations.startNewSession, {
      chatId: CHAT, postId: POST + 1, teacherName: "T", supervisorUserId: STAYING,
    });
    const next = { ...session, postId: POST + 1 };
    expect(await staying.query(api.queries.getAddableSupervisors, next)).toEqual([]);
    await expect(staying.mutation(api.mutations.addSessionSupervisorWithPasscode, {
      ...next, supervisorUserId: LEAVING, passcode: "adminunlock311225",
    })).rejects.toThrow("يمكن إضافة المشرفات من إداريات القناة فقط");
    await expect(staying.mutation(api.mutations.addSessionSupervisor, {
      chatId: CHAT, postId: POST + 1, sessionNumber: 1, supervisorUserId: LEAVING,
    })).rejects.toThrow("يمكن إضافة المشرفات من إداريات القناة فقط");
  });

  test("still shows by name on the halaqa she supervised", async () => {
    const { staying } = await fixture();
    expect(await staying.query(api.queries.getSessionSupervisorName, session)).toBe("Leaving");
  });

  test("regains access when Telegram lists her again", async () => {
    const { bot, leaving } = await fixture();
    await bot.mutation(api.mutations.syncChannelAdmins, {
      channelId: CHANNEL, admins: [asTelegram(STAYING, "Staying"), asTelegram(LEAVING, "Leaving")],
    });
    expect(await bot.query(api.queries.isUserAuthorized, { userId: LEAVING, channelId: CHANNEL }))
      .toBe(true);
    expect((await leaving.query(api.queries.getMyChannels, { userId: LEAVING })).length).toBe(1);
  });
});
