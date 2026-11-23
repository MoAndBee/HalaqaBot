import { describe, expect, test } from "bun:test";
import { api, internal } from "../../db/convex/_generated/api";
import { createConvexEmulator } from "../src/convex-emulator";

const PASSCODE = "adminunlock311225";
const REMOVED = "هذه الطالبة محذوفة من قائمة طالبات الدورة، أعيدي إضافتها من صفحة الطالبات أولاً";
const CHANNEL_A = -100501;
const CHAT_A = -100601;
const CHANNEL_B = -100502;
const CHAT_B = -100602;
const ADMIN_A = 501;
const ADMIN_B = 502;
const FATIMA = 511; // Telegram student in course A
const HUDA = 512; // Telegram student in course B
const HUDA_SECOND = 513; // Same name as HUDA, second account
const POST = 9;

async function fixture() {
  const { t } = await createConvexEmulator();
  await t.run(async (ctx) => {
    for (const [channelId, chatId, userId] of [[CHANNEL_A, CHAT_A, ADMIN_A], [CHANNEL_B, CHAT_B, ADMIN_B]]) {
      await ctx.db.insert("channels", {
        channelId: channelId!, chatId: chatId!, isActive: true, createdAt: 1, updatedAt: 1,
      });
      await ctx.db.insert("channelAdmins", {
        channelId: channelId!, userId: userId!, status: "creator", firstName: `Admin ${userId}`, updatedAt: 1,
      });
    }
    await ctx.db.insert("users", { userId: FATIMA, telegramName: "Fatima", realName: "فاطمة علي", updatedAt: 1 });
    await ctx.db.insert("users", { userId: HUDA, telegramName: "Huda", realName: "هدى رمضان", updatedAt: 1 });
    await ctx.db.insert("users", { userId: HUDA_SECOND, telegramName: "هدي رمضان", updatedAt: 1 });
  });
  const bot = t.withIdentity({ subject: "bot" });
  const adminA = t.withIdentity({ subject: String(ADMIN_A) });
  const adminB = t.withIdentity({ subject: String(ADMIN_B) });
  // Each signs up herself through the bot, which is what enrolls Telegram students
  const signUp = (chatId: number, userId: number, postId = POST) =>
    bot.mutation(api.mutations.addUserToList, { chatId, postId, userId, sessionType: "تلاوة" });
  await signUp(CHAT_A, FATIMA);
  await signUp(CHAT_B, HUDA);
  await signUp(CHAT_B, HUDA_SECOND);
  return { t, bot, adminA, adminB, signUp };
}

const rosterIds = async (caller: any, chatId: number) =>
  (await caller.query(api.students.getRoster, { chatId })).map((s: { userId: number }) => s.userId);

describe("course roster", () => {
  test("a student's first turn puts her on that course's roster only", async () => {
    const { adminA, adminB } = await fixture();
    expect(await rosterIds(adminA, CHAT_A)).toEqual([FATIMA]);
    expect(await rosterIds(adminB, CHAT_B)).toEqual(expect.arrayContaining([HUDA, HUDA_SECOND]));
    await expect(adminA.query(api.students.getRoster, { chatId: CHAT_B })).rejects.toThrow("غير مصرح");
  });

  test("is alphabetical and flags same-name accounts as a pair", async () => {
    const { adminB, adminA } = await fixture();
    await adminB.mutation(api.mutations.registerUser, { name: "آمنة خالد", passcode: PASSCODE, chatId: CHAT_B });
    const roster = await adminB.query(api.students.getRoster, { chatId: CHAT_B });
    expect(roster.map((s: { name: string }) => s.name)).toEqual(["آمنة خالد", "هدى رمضان", "هدي رمضان"]);
    const [amna, huda, second] = roster;
    expect(amna.duplicateKey).toBeNull();
    expect(huda.duplicateKey).not.toBeNull();
    expect(huda.duplicateKey).toBe(second.duplicateKey);
    expect((await adminA.query(api.students.getRoster, { chatId: CHAT_A }))[0].duplicateKey).toBeNull();
  });
});

describe("adding students", () => {
  test("search covers every course and says where she stands in this one", async () => {
    const { adminA } = await fixture();
    const results = await adminA.query(api.students.searchAllStudents, { chatId: CHAT_A, query: "هدى" });
    expect(results.map((r: { userId: number }) => r.userId).sort()).toEqual([HUDA, HUDA_SECOND]);
    expect(results.every((r: { status: string }) => r.status === "none")).toBe(true);
    const fatima = await adminA.query(api.students.searchAllStudents, { chatId: CHAT_A, query: "فاطمه" });
    expect(fatima).toMatchObject([{ userId: FATIMA, status: "enrolled" }]);
  });

  test("an existing student from another course can be added, keeping one person", async () => {
    const { t, adminA } = await fixture();
    await expect(adminA.mutation(api.students.addStudentToCourse, {
      chatId: CHAT_A, userId: HUDA, passcode: "wrong",
    })).rejects.toThrow("رمز الحماية غير صحيح");
    await adminA.mutation(api.students.addStudentToCourse, { chatId: CHAT_A, userId: HUDA, passcode: PASSCODE });
    expect(await rosterIds(adminA, CHAT_A)).toEqual([FATIMA, HUDA]);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.filter((u) => u.userId === HUDA)).toHaveLength(1);
    // And she can now be put on one of this course's halaqas
    expect(await adminA.mutation(api.mutations.addUserToList, {
      chatId: CHAT_A, postId: POST, userId: HUDA, sessionType: "تسميع",
    })).toBe(true);
  });

  test("a name only has to be new within the course", async () => {
    const { adminA, adminB } = await fixture();
    // The same name exists in course B: still a new student in course A
    const created = await adminA.mutation(api.mutations.registerUser, {
      name: "هدى رمضان", passcode: PASSCODE, chatId: CHAT_A,
    });
    expect(created.userId).toBeLessThan(0);
    expect(await rosterIds(adminA, CHAT_A)).toContain(created.userId);
    // Twice in course A (spelling variant) is refused
    await expect(adminA.mutation(api.mutations.registerUser, {
      name: "هدي رمضان", passcode: PASSCODE, chatId: CHAT_A,
    })).rejects.toThrow("طالبة بهذا الاسم موجودة بالفعل في هذه الدورة");
    expect(await rosterIds(adminB, CHAT_B)).not.toContain(created.userId);
  });
});

describe("removing a student", () => {
  async function removed() {
    const f = await fixture();
    await f.adminA.mutation(api.students.removeStudentFromCourse, {
      chatId: CHAT_A, userId: FATIMA, passcode: PASSCODE,
    });
    return f;
  }

  test("hides her from the roster and course search, and leaves her halaqa data", async () => {
    const { t, adminA } = await removed();
    expect(await rosterIds(adminA, CHAT_A)).toEqual([]);
    expect(await adminA.query(api.queries.searchUsers, { query: "فاطمة", chatId: CHAT_A })).toEqual([]);
    expect(await adminA.query(api.students.searchAllStudents, { chatId: CHAT_A, query: "فاطمة" }))
      .toMatchObject([{ userId: FATIMA, status: "removed" }]);
    const queued = await t.run((ctx) => ctx.db.query("turnQueue")
      .withIndex("by_user", (q) => q.eq("userId", FATIMA)).collect());
    expect(queued).toHaveLength(1);
    // Her stats are still readable from the course she was in
    expect(await adminA.query(api.queries.getUser, { userId: FATIMA, chatId: CHAT_A })).toMatchObject({ userId: FATIMA });
  });

  test("stops admins adding her to a halaqa by any path", async () => {
    const { adminA } = await removed();
    const entry = { chatId: CHAT_A, postId: POST + 1, userId: FATIMA };
    await expect(adminA.mutation(api.mutations.addUserToList, { ...entry, sessionType: "تلاوة" }))
      .rejects.toThrow(REMOVED);
    await expect(adminA.mutation(api.mutations.addUserAtPosition, { ...entry, turnsToWait: 0 }))
      .rejects.toThrow(REMOVED);
    await expect(adminA.mutation(api.mutations.bulkUpdateParticipationScores, {
      updates: [], additions: {
        chatId: CHAT_A, postId: POST + 1, sessionNumber: 1, completedAt: Date.now(),
        entries: [{ userId: FATIMA, score: 10 }],
      },
    })).rejects.toThrow(REMOVED);
    await expect(adminA.mutation(api.mutations.applyManualList, {
      chatId: CHAT_A, postId: POST + 1, mode: "create", appliedBy: ADMIN_A, rawText: "فاطمة",
      newSession: { teacherName: "T", platform: "zoom" },
      entries: [{ userId: FATIMA, done: false, skipped: false }],
    })).rejects.toThrow(REMOVED);
  });

  test("is undone when she signs up herself through the bot", async () => {
    const { adminA, signUp } = await removed();
    await signUp(CHAT_A, FATIMA, POST + 2);
    expect(await rosterIds(adminA, CHAT_A)).toEqual([FATIMA]);
  });

  test("is undone when an admin adds her back", async () => {
    const { adminA } = await removed();
    await adminA.mutation(api.students.addStudentToCourse, { chatId: CHAT_A, userId: FATIMA, passcode: PASSCODE });
    expect(await rosterIds(adminA, CHAT_A)).toEqual([FATIMA]);
  });
});

describe("one-time backfill", () => {
  test("enrolls from turns, history and home chat, skips the ended course, and can rerun", async () => {
    const { t } = await createConvexEmulator();
    const ENDED = -1003233862716;
    await t.run(async (ctx) => {
      await ctx.db.insert("turnQueue", { chatId: CHAT_A, postId: 1, sessionNumber: 1, userId: 1, position: 1, createdAt: 50 });
      await ctx.db.insert("participationHistory", {
        chatId: CHAT_A, postId: 1, sessionNumber: 1, userId: 1, sessionType: "تلاوة", createdAt: 20, completedAt: 30,
      });
      await ctx.db.insert("participationHistory", {
        chatId: ENDED, postId: 1, sessionNumber: 1, userId: 2, sessionType: "تلاوة", createdAt: 20, completedAt: 30,
      });
      await ctx.db.insert("users", { userId: -7, telegramName: "مسجل يدوياً", realName: "x", homeChatId: CHAT_B, updatedAt: 1 });
    });
    expect(await t.action(internal.migrations.enrollStudents.run, {}))
      .toEqual({ participationHistory: 1, turnQueue: 0, users: 1 });
    expect(await t.action(internal.migrations.enrollStudents.run, {}))
      .toEqual({ participationHistory: 0, turnQueue: 0, users: 0 });
    const rows = await t.run((ctx) => ctx.db.query("channelStudents").collect());
    expect(rows.map(({ chatId, userId, source, addedAt }) => ({ chatId, userId, source, addedAt }))).toEqual([
      { chatId: CHAT_A, userId: 1, source: "activity", addedAt: 20 },
      { chatId: CHAT_B, userId: -7, source: "manual", addedAt: expect.any(Number) },
    ]);
  });
});

describe("merging a hand-registered student into her Telegram account", () => {
  async function withManual() {
    const { t } = await createConvexEmulator();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { userId: -2, telegramName: "مسجل يدوياً", realName: "نورا فؤاد حسن", updatedAt: 1 });
      await ctx.db.insert("users", { userId: 900, telegramName: "Nora Fouad", username: "Norafouad", updatedAt: 1 });
      await ctx.db.insert("participationHistory", {
        chatId: CHAT_A, postId: 4984, sessionNumber: 6, userId: -2, sessionType: "اختبار", score: 9,
        createdAt: 1, completedAt: 2,
      });
      await ctx.db.insert("channelStudents", { chatId: CHAT_A, userId: -2, source: "manual", addedAt: 1 });
    });
    return t;
  }
  const args = { manualUserId: -2, telegramUserId: 900 };

  test("a dry run changes nothing", async () => {
    const t = await withManual();
    const plan = await t.mutation(internal.migrations.mergeManualStudent.mergeManualStudent, { ...args, dryRun: true });
    expect(plan.participationHistory).toMatchObject([{ postId: 4984, score: 9 }]);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(2);
  });

  test("moves the exam score to her Telegram account and deletes the hand-registered one", async () => {
    const t = await withManual();
    await t.mutation(internal.migrations.mergeManualStudent.mergeManualStudent, { ...args, dryRun: false });
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((u) => u.userId)).toEqual([900]);
    const history = await t.run((ctx) => ctx.db.query("participationHistory").collect());
    expect(history).toMatchObject([{ userId: 900, postId: 4984, score: 9 }]);
    const enrolled = await t.run((ctx) => ctx.db.query("channelStudents").collect());
    expect(enrolled).toMatchObject([{ chatId: CHAT_A, userId: 900 }]);
  });

  test("refuses if her Telegram account already has that turn", async () => {
    const t = await withManual();
    await t.run((ctx) => ctx.db.insert("participationHistory", {
      chatId: CHAT_A, postId: 4984, sessionNumber: 6, userId: 900, sessionType: "اختبار", score: 7,
      createdAt: 1, completedAt: 2,
    }));
    await expect(t.mutation(internal.migrations.mergeManualStudent.mergeManualStudent, { ...args, dryRun: false }))
      .rejects.toThrow("already has these turns");
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(2);
  });
});

describe("merging an old Telegram account into a student's new one, within a course", () => {
  const OLD = 700;
  const NEW = 701;
  async function withAccounts() {
    const { t } = await createConvexEmulator();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { userId: OLD, telegramName: "Old", realName: "مؤمنة", updatedAt: 1 });
      await ctx.db.insert("users", { userId: NEW, telegramName: "New", realName: "مؤمنة", updatedAt: 1 });
      const turn = (userId: number, chatId: number, postId: number, sessionType: string, score?: number) =>
        ctx.db.insert("participationHistory", {
          chatId, postId, sessionNumber: 1, userId, sessionType, score, createdAt: 1, completedAt: 2,
        });
      await turn(OLD, CHAT_A, 1, "اختبار", 14); // moves
      await turn(OLD, CHAT_A, 2, "اختبار", 18); // clashes with NEW's exam in post 2
      await turn(NEW, CHAT_A, 2, "اختبار", 17);
      await turn(OLD, CHAT_B, 3, "تلاوة"); // another course: stays hers
      await ctx.db.insert("turnQueue", {
        chatId: CHAT_A, postId: 4, sessionNumber: 1, userId: OLD, position: 1, createdAt: 1, sessionType: "تعويض",
      });
      for (const userId of [OLD, NEW]) {
        await ctx.db.insert("channelStudents", { chatId: CHAT_A, userId, source: "activity", addedAt: 1 });
      }
      await ctx.db.insert("channelStudents", { chatId: CHAT_B, userId: OLD, source: "activity", addedAt: 1 });
    });
    return t;
  }
  const args = { chatId: CHAT_A, fromUserId: OLD, toUserId: NEW };
  const merge = internal.migrations.mergeStudentAccounts.mergeStudentAccounts;
  const owners = (t: Awaited<ReturnType<typeof withAccounts>>) => t.run(async (ctx) => [
    ...(await ctx.db.query("participationHistory").collect()),
    ...(await ctx.db.query("turnQueue").collect()),
  ].map((r) => `${r.chatId}/${r.postId}:${r.userId}`).sort());

  test("a dry run lists what moves and the clash, and changes nothing", async () => {
    const t = await withAccounts();
    const before = await owners(t);
    const plan = await t.mutation(merge, { ...args, dryRun: true });
    expect(plan.moving.map((m: { postId: number }) => m.postId).sort()).toEqual([1, 4]);
    expect(plan.clashes).toMatchObject([{ old: { postId: 2, score: 18 }, new: { postId: 2, score: 17 } }]);
    expect(await owners(t)).toEqual(before);
  });

  test("moves this course's turns only, leaves the clash, and swaps the roster", async () => {
    const t = await withAccounts();
    await t.mutation(merge, { ...args, dryRun: false });
    expect(await owners(t)).toEqual([
      `${CHAT_A}/1:${NEW}`, `${CHAT_A}/2:${NEW}`, `${CHAT_A}/2:${OLD}`, `${CHAT_A}/4:${NEW}`, `${CHAT_B}/3:${OLD}`,
    ].sort());
    const roster = await t.run((ctx) => ctx.db.query("channelStudents").collect());
    const state = (chatId: number, userId: number) => {
      const row = roster.find((r) => r.chatId === chatId && r.userId === userId)!;
      return row.removedAt === undefined ? "on" : "removed";
    };
    expect([state(CHAT_A, NEW), state(CHAT_A, OLD), state(CHAT_B, OLD)]).toEqual(["on", "removed", "on"]);
    // Both accounts are still people on record
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(2);
  });

  test("with keepNew, deletes the old account's clashing turn and keeps the new one's score", async () => {
    const t = await withAccounts();
    await t.mutation(merge, { ...args, dryRun: false, onClash: "keepNew" });
    expect(await owners(t)).toEqual([
      `${CHAT_A}/1:${NEW}`, `${CHAT_A}/2:${NEW}`, `${CHAT_A}/4:${NEW}`, `${CHAT_B}/3:${OLD}`,
    ].sort());
    const exams = await t.run((ctx) => ctx.db.query("participationHistory")
      .withIndex("by_user_chat", (q) => q.eq("userId", NEW).eq("chatId", CHAT_A)).collect());
    expect(exams.find((r) => r.postId === 2)?.score).toBe(17);
  });
});

describe("removing a list of students from a course", () => {
  test("hides them from that roster only, reports the rest, and a dry run changes nothing", async () => {
    const { t, adminA, adminB } = await fixture();
    const remove = internal.migrations.removeStudentsFromCourse.removeStudentsFromCourse;
    const dry = await t.mutation(remove, { chatId: CHAT_B, userIds: [HUDA, FATIMA], dryRun: true });
    expect(dry.removing.map((r: { userId: number }) => r.userId)).toEqual([HUDA]);
    expect(dry.skipped).toEqual([{ userId: FATIMA, reason: "not on this course's roster" }]);
    expect(await rosterIds(adminB, CHAT_B)).toContain(HUDA);

    await t.mutation(remove, { chatId: CHAT_B, userIds: [HUDA, FATIMA], dryRun: false });
    expect(await rosterIds(adminB, CHAT_B)).toEqual([HUDA_SECOND]);
    expect(await rosterIds(adminA, CHAT_A)).toEqual([FATIMA]);
    // Her turn in course B is still there
    const turns = await t.run((ctx) => ctx.db.query("turnQueue").withIndex("by_user", (q) => q.eq("userId", HUDA)).collect());
    expect(turns).toHaveLength(1);
    const again = await t.mutation(remove, { chatId: CHAT_B, userIds: [HUDA], dryRun: true });
    expect(again.skipped).toEqual([{ userId: HUDA, reason: "already removed" }]);
  });
});
