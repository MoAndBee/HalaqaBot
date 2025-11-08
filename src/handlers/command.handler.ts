import type { Bot, Context } from "grammy";
import type { UserListService } from "../services/user-list.service";

export function registerCommandHandler(
  bot: Bot,
  userListService: UserListService,
) {
  bot.command("new", async (ctx: Context) => {
    console.log("NEW");
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;

    if (!chatId || !userId) {
      return;
    }

    // Only allow in group chats
    if (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup") {
      await ctx.reply("هذا الأمر يعمل فقط في المجموعات");
      return;
    }

    try {
      // Check if user is admin
      const member = await ctx.api.getChatMember(chatId, userId);
      const isAdmin =
        member.status === "creator" || member.status === "administrator";

      if (!isAdmin) {
        await ctx.reply("عذراً، هذا الأمر متاح للمشرفين فقط");
        return;
      }

      // Clear the list
      userListService.clearList(chatId);

      console.log(`\n✅ List cleared for chat ${chatId} by user ${userId}`);

      // Send confirmation message
      await ctx.reply("تم مسح القائمة وبدء قائمة جديدة ✅");
    } catch (error) {
      console.error("Error in /new command:", error);
      await ctx.reply("حدث خطأ أثناء مسح القائمة");
    }
  });
}
