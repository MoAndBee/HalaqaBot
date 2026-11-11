import { describe, expect, test } from "bun:test";
import { api } from "@halakabot/db";
import { createConvexEmulator } from "../src/convex-emulator";

const CHANNEL_A = -100101;
const CHAT_A = -100201;
const CHANNEL_B = -100102;
const CHAT_B = -100202;
const ADMIN_A = 101;
const ADMIN_B = 102;
const STUDENT = 103;
const POST = 1;

async function fixture() {
  const { t } = await createConvexEmulator();
  await t.run(async (ctx) => {
    for (const [channelId, chatId] of [[CHANNEL_A, CHAT_A], [CHANNEL_B, CHAT_B]]) {
      await ctx.db.insert("channels", {
        channelId: channelId!, chatId: chatId!, isActive: true, createdAt: 1, updatedAt: 1,
      });
    }
    await ctx.db.insert("channelAdmins", {
      channelId: CHANNEL_A, userId: ADMIN_A, status: "creator", firstName: "Local admin", updatedAt: 1,
    });
    await ctx.db.insert("channelAdmins", {
      channelId: CHANNEL_B, userId: ADMIN_B, status: "creator",
      preferredName: "Private supervisor in B", updatedAt: 1,
    });
    await ctx.db.insert("users", {
      userId: STUDENT, telegramName: "Private student", realName: "Private student in B",
      homeChatId: CHAT_B, updatedAt: 1,
    });
  });
  return {
    t,
    admin: t.withIdentity({ subject: String(ADMIN_A) }),
    bot: t.withIdentity({ subject: "bot" }),
  };
}

const sessionArgs = {
  chatId: CHAT_A, channelId: CHANNEL_A, postId: POST, sessionNumber: 1,
};

describe("channel-scoped admin and supervisor names", () => {
  test("an admin cannot read another channel's preferred name through their own channel", async () => {
    const { admin, bot } = await fixture();
    for (const caller of [admin, bot]) {
      expect(await caller.query(api.queries.getAdminDisplayName, {
        channelId: CHANNEL_A, userId: ADMIN_B,
      })).toBeNull();
    }
    expect(await admin.query(api.queries.getAdminDisplayName, {
      channelId: CHANNEL_A, userId: ADMIN_A,
    })).toBe("Local admin");
    expect(await bot.query(api.queries.getAdminDisplayName, {
      channelId: CHANNEL_B, userId: ADMIN_B,
    })).toBe("Private supervisor in B");
  });

  test("the selected channel's admin name wins over a private name in another channel", async () => {
    const { t, admin } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("channelAdmins", {
        channelId: CHANNEL_A, userId: ADMIN_B, status: "administrator",
        firstName: "Local", lastName: "supervisor", updatedAt: 2,
      });
    });
    expect(await admin.query(api.queries.getAdminDisplayName, {
      channelId: CHANNEL_A, userId: ADMIN_B,
    })).toBe("Local supervisor");
  });

  test("assigning an unrelated supervisor ID does not expose their private admin or student name", async () => {
    const { admin } = await fixture();
    for (const userId of [ADMIN_B, STUDENT]) {
      const args = { ...sessionArgs, postId: userId };
      // Use the same public mutation an admin could use to probe an arbitrary ID.
      await admin.mutation(api.mutations.takeOverSession, {
        chatId: args.chatId, postId: args.postId, sessionNumber: 1, newSupervisorUserId: userId,
      });
      expect(await admin.query(api.queries.getSessionSupervisorName, args)).toBeNull();
      expect(await admin.query(api.queries.getSessionSupervisors, args)).toEqual([
        { userId, name: `#${userId}` },
      ]);
    }
  });

  test("legacy single-supervisor IDs cannot expose another channel's preferred name", async () => {
    const { t, admin } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("sessions", {
        chatId: CHAT_A, postId: POST, sessionNumber: 1, teacherName: "Test teacher",
        supervisorUserId: ADMIN_B, createdAt: 1,
      });
    });
    expect(await admin.query(api.queries.getSessionSupervisorName, sessionArgs)).toBeNull();
    expect(await admin.query(api.queries.getSessionSupervisors, sessionArgs)).toEqual([
      { userId: ADMIN_B, name: `#${ADMIN_B}` },
    ]);
  });

  test("supervisor queries reject a channel that does not own the requested chat", async () => {
    const { admin } = await fixture();
    const args = { ...sessionArgs, channelId: CHANNEL_B };
    await expect(admin.query(api.queries.getSessionSupervisorName, args)).rejects.toThrow("غير مصرح");
    await expect(admin.query(api.queries.getSessionSupervisors, args)).rejects.toThrow("غير مصرح");
  });

  test("having access to both channels does not permit mixing their chat and channel IDs", async () => {
    const { t, admin, bot } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("channelAdmins", {
        channelId: CHANNEL_B, userId: ADMIN_A, status: "administrator", updatedAt: 1,
      });
    });
    for (const caller of [admin, bot]) {
      const args = { ...sessionArgs, channelId: CHANNEL_B };
      await expect(caller.query(api.queries.getSessionSupervisorName, args)).rejects.toThrow("غير مصرح");
      await expect(caller.query(api.queries.getSessionSupervisors, args)).rejects.toThrow("غير مصرح");
    }
  });

  for (const membership of ["home", "queue", "history"] as const) {
    test(`a former supervisor's student name remains available with ${membership} membership in this chat`, async () => {
      const { t, admin } = await fixture();
      await t.run(async (ctx) => {
        if (membership === "home") {
          const student = await ctx.db.query("users").withIndex("by_user_id", q => q.eq("userId", STUDENT)).unique();
          await ctx.db.patch(student!._id, { homeChatId: CHAT_A });
        } else if (membership === "queue") {
          await ctx.db.insert("turnQueue", {
            chatId: CHAT_A, postId: 10, sessionNumber: 1, userId: STUDENT, position: 0, createdAt: 1,
          });
        } else {
          await ctx.db.insert("participationHistory", {
            chatId: CHAT_A, postId: 10, sessionNumber: 1, userId: STUDENT,
            sessionType: "تسميع", createdAt: 1, completedAt: 2,
          });
        }
        await ctx.db.insert("sessions", {
          chatId: CHAT_A, postId: POST, sessionNumber: 1, teacherName: "Test teacher",
          supervisorUserIds: [ADMIN_A, STUDENT], createdAt: 1,
        });
      });
      expect(await admin.query(api.queries.getSessionSupervisorName, sessionArgs))
        .toBe("Local admin، Private student in B");
      expect(await admin.query(api.queries.getSessionSupervisors, sessionArgs)).toEqual([
        { userId: ADMIN_A, name: "Local admin" },
        { userId: STUDENT, name: "Private student in B" },
      ]);
    });
  }

  test("turns in another chat do not authorize the global student-name fallback", async () => {
    const { t, admin } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("turnQueue", {
        chatId: CHAT_B, postId: 10, sessionNumber: 1, userId: STUDENT, position: 0, createdAt: 1,
      });
      await ctx.db.insert("participationHistory", {
        chatId: CHAT_B, postId: 10, sessionNumber: 1, userId: STUDENT,
        sessionType: "تسميع", createdAt: 1, completedAt: 2,
      });
      await ctx.db.insert("sessions", {
        chatId: CHAT_A, postId: POST, sessionNumber: 1, teacherName: "Test teacher",
        supervisorUserIds: [STUDENT], createdAt: 1,
      });
    });
    expect(await admin.query(api.queries.getSessionSupervisorName, sessionArgs)).toBeNull();
    expect(await admin.query(api.queries.getSessionSupervisors, sessionArgs)).toEqual([
      { userId: STUDENT, name: `#${STUDENT}` },
    ]);
  });

  test("an admin cannot manufacture local membership by adding an unrelated user to the queue", async () => {
    const { admin } = await fixture();
    await expect(admin.mutation(api.mutations.addUserToList, {
      chatId: CHAT_A, postId: POST, userId: STUDENT, sessionNumber: 1,
    })).rejects.toThrow("غير مصرح");
    await expect(admin.mutation(api.mutations.addUserAtPosition, {
      chatId: CHAT_A, postId: POST, userId: STUDENT, sessionNumber: 1, turnsToWait: 0,
    })).rejects.toThrow("غير مصرح");
  });

  test("an admin cannot manufacture local membership through bulk score additions", async () => {
    const { admin } = await fixture();
    await expect(admin.mutation(api.mutations.bulkUpdateParticipationScores, {
      updates: [], additions: {
        chatId: CHAT_A, postId: POST, sessionNumber: 1, completedAt: 1,
        entries: [{ userId: STUDENT, score: 10 }],
      },
    })).rejects.toThrow("غير مصرح");
  });

  test("a bot-observed local message author can still be added to their first turn", async () => {
    const { admin, bot } = await fixture();
    await bot.mutation(api.mutations.addMessageAuthor, {
      chatId: CHAT_A, postId: POST, messageId: 10,
      user: { id: STUDENT, first_name: "Local commenter" },
    });
    expect(await admin.mutation(api.mutations.addUserToList, {
      chatId: CHAT_A, postId: POST, userId: STUDENT, sessionNumber: 1,
    })).toBe(true);
    const list = await admin.query(api.queries.getUserList, { chatId: CHAT_A, postId: POST });
    expect(list.activeUsers.map(user => user.id)).toEqual([STUDENT]);
  });

  test("an unauthenticated caller cannot read scoped names", async () => {
    const { t } = await fixture();
    await expect(t.query(api.queries.getAdminDisplayName, {
      channelId: CHANNEL_A, userId: ADMIN_A,
    })).rejects.toThrow("يجب تسجيل الدخول");
    await expect(t.query(api.queries.getSessionSupervisorName, sessionArgs)).rejects.toThrow("يجب تسجيل الدخول");
    await expect(t.query(api.queries.getSessionSupervisors, sessionArgs)).rejects.toThrow("يجب تسجيل الدخول");
  });
});
