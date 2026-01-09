import type { Api } from "grammy";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";

export interface ChannelAdmin {
  userId: number;
  status: "creator" | "administrator";
  firstName?: string;
  lastName?: string;
  username?: string;
}

export class AdminSyncService {
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(
    private convex: ConvexHttpClient,
    private telegramApi: Api,
  ) {}

  /**
   * Fetch channel administrators from Telegram API
   */
  async fetchChannelAdmins(channelId: number): Promise<ChannelAdmin[]> {
    try {
      console.log(`🔄 Fetching admins for channel ${channelId}...`);

      const chatAdmins = await this.telegramApi.getChatAdministrators(channelId);

      const admins: ChannelAdmin[] = chatAdmins
        .filter(
          (member) =>
            member.status === "creator" || member.status === "administrator"
        )
        .map((member) => ({
          userId: member.user.id,
          status: member.status as "creator" | "administrator",
          firstName: member.user.first_name,
          lastName: member.user.last_name,
          username: member.user.username,
        }));

      console.log(`✅ Fetched ${admins.length} admins for channel ${channelId}`);
      return admins;
    } catch (error) {
      console.error(`❌ Error fetching admins for channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Sync channel administrators to database
   */
  async syncToDatabase(
    channelId: number,
    admins: ChannelAdmin[],
  ): Promise<void> {
    try {
      console.log(`💾 Syncing ${admins.length} admins to database...`);

      await this.convex.mutation(api.mutations.syncChannelAdmins, {
        channelId,
        admins,
      });

      console.log(`✅ Successfully synced admins to database`);
    } catch (error) {
      console.error(`❌ Error syncing admins to database:`, error);
      throw error;
    }
  }

  /**
   * Fetch and sync admins in one operation
   */
  async fetchAndSync(channelId: number): Promise<void> {
    try {
      const admins = await this.fetchChannelAdmins(channelId);
      await this.syncToDatabase(channelId, admins);
    } catch (error) {
      console.error(`❌ Error in fetchAndSync for channel ${channelId}:`, error);
      // Don't throw - we want to continue even if sync fails
      // The next interval will retry
    }
  }

  /**
   * Start periodic sync (every 5 minutes)
   */
  startPeriodicSync(channelId: number): void {
    if (this.syncInterval) {
      console.warn("⚠️  Periodic sync already running, stopping previous interval");
      this.stopPeriodicSync();
    }

    console.log(`⏰ Starting periodic admin sync for channel ${channelId} (every 5 minutes)`);

    // Sync immediately on start
    this.fetchAndSync(channelId);

    // Then sync every 5 minutes
    const FIVE_MINUTES = 5 * 60 * 1000;
    this.syncInterval = setInterval(() => {
      this.fetchAndSync(channelId);
    }, FIVE_MINUTES);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log(`⏹️  Stopped periodic admin sync`);
    }
  }
}
