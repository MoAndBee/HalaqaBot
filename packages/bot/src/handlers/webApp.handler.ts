import type { Bot, Context } from "grammy";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";
import type { Config } from "../config/environment";

export function registerWebAppHandler(
  bot: Bot,
  convex: ConvexHttpClient,
  config: Config,
) {
  // Handle /admin command
  bot.command("admin", async (ctx: Context) => {
    const userId = ctx.from?.id;

    if (!userId) {
      console.log("⚠️  No user ID in /admin command");
      return;
    }

    console.log(`📱 /admin command from user ${userId}`);

    try {
      // Check if user is a channel administrator
      const isAuthorized = await convex.query(api.queries.isUserAuthorized, {
        userId,
        channelId: config.channelId,
      });

      if (!isAuthorized) {
        console.log(`⛔ User ${userId} is not authorized (not a channel admin)`);
        await ctx.reply(
          "⛔ عذراً، لا يمكنك الوصول إلى لوحة التحكم\n\n" +
          "يجب أن تكون مشرفاً في القناة للوصول إلى لوحة التحكم الإدارية.",
        );
        return;
      }

      // User is authorized - show web app button
      console.log(`✅ User ${userId} is authorized, showing web app button`);

      await ctx.reply("📋 لوحة التحكم الإدارية", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎛️ فتح لوحة التحكم",
                web_app: { url: config.webAppUrl },
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.error(`❌ Error in /admin command:`, error);
      await ctx.reply(
        "❌ حدث خطأ أثناء التحقق من الصلاحيات. يرجى المحاولة مرة أخرى.",
      );
    }
  });

  // Set menu button (persistent button at bottom of chat)
  try {
    console.log("🔧 Setting up menu button...");

    bot.api
      .setChatMenuButton({
        menu_button: {
          type: "web_app",
          text: "لوحة التحكم",
          web_app: { url: config.webAppUrl },
        },
      })
      .then(() => {
        console.log("✅ Menu button set successfully");
      })
      .catch((error) => {
        console.error("❌ Error setting menu button:", error);
      });
  } catch (error) {
    console.error("❌ Error setting up menu button:", error);
  }
}
