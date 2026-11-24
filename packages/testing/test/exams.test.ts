import { describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { createConvexEmulator } from "../src/convex-emulator";

const CHANNEL = -100302;
const CHAT = -100402;
const OTHER_CHAT = -100403;
const ADMIN = 311;
const OUTSIDER = 312;
const STUDENT = 321;

async function fixture() {
  const { t } = await createConvexEmulator();
  await t.run(async (ctx) => {
    await ctx.db.insert("channels", {
      channelId: CHANNEL, chatId: CHAT, isActive: true, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("users", { userId: STUDENT, telegramName: "S", updatedAt: 1 } as never);
    await ctx.db.insert("channelStudents", {
      chatId: CHAT, userId: STUDENT, source: "activity", addedAt: 1,
    });
    const row = { chatId: CHAT, postId: 1, sessionNumber: 1, createdAt: 1 };
    await ctx.db.insert("participationHistory", {
      ...row, userId: STUDENT, sessionType: "تسميع", completedAt: 1000,
    });
    await ctx.db.insert("participationHistory", {
      ...row, userId: STUDENT + 1, sessionType: "اختبار", completedAt: 2000,
    });
    await ctx.db.insert("participationHistory", {
      ...row, chatId: OTHER_CHAT, userId: STUDENT, sessionType: "اختبار", completedAt: 3000,
    });
  });
  const bot = t.withIdentity({ subject: "bot" });
  await bot.mutation(api.mutations.syncChannelAdmins, {
    channelId: CHANNEL, admins: [{ userId: ADMIN, status: "administrator", firstName: "A" }],
  });
  return {
    t,
    admin: t.withIdentity({ subject: String(ADMIN) }),
    outsider: t.withIdentity({ subject: String(OUTSIDER) }),
  };
}

describe("marked exams", () => {
  test("an admin saves, renames and deletes an exam", async () => {
    const { admin } = await fixture();
    const examId = await admin.mutation(api.exams.saveExam, {
      chatId: CHAT, name: "  اختبار الجزء ٣ ", days: ["2026-11-22", "2026-11-21", "2026-11-21"],
    });
    expect(await admin.query(api.exams.getExams, { chatId: CHAT })).toEqual([
      { examId, name: "اختبار الجزء ٣", days: ["2026-11-21", "2026-11-22"] },
    ]);

    await admin.mutation(api.exams.saveExam, {
      chatId: CHAT, examId, name: "الجزء الثالث", days: ["2026-11-21"],
    });
    expect((await admin.query(api.exams.getExams, { chatId: CHAT }))[0]).toMatchObject({
      name: "الجزء الثالث", days: ["2026-11-21"],
    });

    await admin.mutation(api.exams.deleteExam, { chatId: CHAT, examId });
    expect(await admin.query(api.exams.getExams, { chatId: CHAT })).toEqual([]);
  });

  test("a day belongs to one exam only", async () => {
    const { admin } = await fixture();
    await admin.mutation(api.exams.saveExam, { chatId: CHAT, name: "أ", days: ["2026-11-21"] });
    await expect(admin.mutation(api.exams.saveExam, {
      chatId: CHAT, name: "ب", days: ["2026-11-21", "2026-11-23"],
    })).rejects.toThrow("مضاف بالفعل");
  });

  test("rejects an empty name, no days, or a malformed day", async () => {
    const { admin } = await fixture();
    await expect(admin.mutation(api.exams.saveExam, { chatId: CHAT, name: " ", days: ["2026-11-21"] }))
      .rejects.toThrow("اسم");
    await expect(admin.mutation(api.exams.saveExam, { chatId: CHAT, name: "أ", days: [] }))
      .rejects.toThrow("يوماً");
    await expect(admin.mutation(api.exams.saveExam, { chatId: CHAT, name: "أ", days: ["21/11/2026"] }))
      .rejects.toThrow("تاريخ");
  });

  test("other admins can't read or change them", async () => {
    const { admin, outsider } = await fixture();
    const examId = await admin.mutation(api.exams.saveExam, { chatId: CHAT, name: "أ", days: ["2026-11-21"] });
    await expect(outsider.query(api.exams.getExams, { chatId: CHAT })).rejects.toThrow("غير مصرح");
    await expect(outsider.mutation(api.exams.deleteExam, { chatId: CHAT, examId })).rejects.toThrow("غير مصرح");
    await expect(outsider.query(api.exams.getAbsenceInputs, { chatId: CHAT, userId: STUDENT }))
      .rejects.toThrow("غير مصرح");
  });
});

describe("absence inputs", () => {
  test("course exam times from this chat only, marked exams, and removal", async () => {
    const { t, admin } = await fixture();
    await admin.mutation(api.exams.saveExam, { chatId: CHAT, name: "أ", days: ["2026-11-21"] });
    expect(await admin.query(api.exams.getAbsenceInputs, { chatId: CHAT, userId: STUDENT })).toEqual({
      examTimes: [2000],
      exams: [{ name: "أ", days: ["2026-11-21"] }],
      removedAt: null,
    });

    await t.run(async (ctx) => {
      const row = await ctx.db.query("channelStudents").first();
      await ctx.db.patch(row!._id, { removedAt: 5000 });
    });
    expect((await admin.query(api.exams.getAbsenceInputs, { chatId: CHAT, userId: STUDENT })).removedAt)
      .toBe(5000);
  });
});
