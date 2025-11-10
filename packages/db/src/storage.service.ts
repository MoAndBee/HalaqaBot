import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from "./types";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
}

export class StorageService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl!, supabaseKey!);
  }

  async addMessageAuthor(
    chatId: number,
    postId: number,
    messageId: number,
    user: User,
    messageText?: string
  ): Promise<void> {
    await this.supabase
      .from('message_authors')
      .upsert({
        chat_id: chatId,
        post_id: postId,
        message_id: messageId,
        user_id: user.id,
        first_name: user.first_name,
        username: user.username || null,
        message_text: messageText || null,
      }, {
        onConflict: 'chat_id,post_id,message_id'
      });
  }

  async getMessageAuthor(
    chatId: number,
    postId: number,
    messageId: number
  ): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('message_authors')
      .select('*')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .eq('message_id', messageId)
      .single();

    if (error || !data) return null;

    return {
      id: data.user_id,
      first_name: data.first_name,
      username: data.username || undefined,
    };
  }

  async getPostIdForMessage(
    chatId: number,
    messageId: number
  ): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('message_authors')
      .select('post_id')
      .eq('chat_id', chatId)
      .eq('message_id', messageId)
      .limit(1)
      .single();

    return error || !data ? null : data.post_id;
  }

  async addUserToList(
    chatId: number,
    postId: number,
    user: User
  ): Promise<boolean> {
    const { data: existing } = await this.supabase
      .from('user_lists')
      .select('user_id')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return false;
    }

    const { data: maxPos } = await this.supabase
      .from('user_lists')
      .select('position')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxPos?.position || 0) + 1;

    await this.supabase
      .from('user_lists')
      .insert({
        chat_id: chatId,
        post_id: postId,
        user_id: user.id,
        first_name: user.first_name,
        username: user.username || null,
        position: nextPosition,
      });

    return true;
  }

  async getUserList(chatId: number, postId: number): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('user_lists')
      .select('*')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .order('position', { ascending: true });

    if (error || !data) return [];

    return data.map((user) => ({
      id: user.user_id,
      first_name: user.first_name,
      username: user.username || undefined,
    }));
  }

  async clearUserList(chatId: number, postId: number): Promise<void> {
    await this.supabase
      .from('user_lists')
      .delete()
      .eq('chat_id', chatId)
      .eq('post_id', postId);
  }

  async setLastListMessage(
    chatId: number,
    postId: number,
    messageId: number
  ): Promise<void> {
    await this.supabase
      .from('last_list_messages')
      .upsert({
        chat_id: chatId,
        post_id: postId,
        message_id: messageId,
      }, {
        onConflict: 'chat_id,post_id'
      });
  }

  async getLastListMessage(
    chatId: number,
    postId: number
  ): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('last_list_messages')
      .select('message_id')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .single();

    return error || !data ? null : data.message_id;
  }

  async clearLastListMessage(chatId: number, postId: number): Promise<void> {
    await this.supabase
      .from('last_list_messages')
      .delete()
      .eq('chat_id', chatId)
      .eq('post_id', postId);
  }

  async storeClassification(
    chatId: number,
    postId: number,
    messageId: number,
    containsName: boolean,
    detectedNames: string[]
  ): Promise<void> {
    await this.supabase
      .from('message_classifications')
      .upsert({
        chat_id: chatId,
        post_id: postId,
        message_id: messageId,
        contains_name: containsName,
        detected_names: detectedNames,
      }, {
        onConflict: 'chat_id,post_id,message_id'
      });
  }

  async getClassification(
    chatId: number,
    postId: number,
    messageId: number
  ): Promise<{ containsName: boolean; detectedNames: string[] } | null> {
    const { data, error } = await this.supabase
      .from('message_classifications')
      .select('*')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .eq('message_id', messageId)
      .single();

    if (error || !data) return null;

    return {
      containsName: data.contains_name,
      detectedNames: data.detected_names || [],
    };
  }

  async getUnclassifiedMessages(
    chatId: number,
    postId: number
  ): Promise<
    Array<{
      messageId: number;
      text: string;
      user: User;
    }>
  > {
    const { data: userListIds } = await this.supabase
      .from('user_lists')
      .select('user_id')
      .eq('chat_id', chatId)
      .eq('post_id', postId);

    const { data: classifiedMessageIds } = await this.supabase
      .from('message_classifications')
      .select('message_id')
      .eq('chat_id', chatId)
      .eq('post_id', postId);

    const excludedUserIds = userListIds?.map((u) => u.user_id) || [];
    const excludedMessageIds = classifiedMessageIds?.map((m) => m.message_id) || [];

    let query = this.supabase
      .from('message_authors')
      .select('*')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .order('message_id', { ascending: true });

    if (excludedUserIds.length > 0) {
      query = query.not('user_id', 'in', `(${excludedUserIds.join(',')})`);
    }

    if (excludedMessageIds.length > 0) {
      query = query.not('message_id', 'in', `(${excludedMessageIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    const uniqueMessages = new Map();
    data.forEach((msg) => {
      if (!uniqueMessages.has(msg.message_id)) {
        uniqueMessages.set(msg.message_id, {
          messageId: msg.message_id,
          text: msg.message_text || "",
          user: {
            id: msg.user_id,
            first_name: msg.first_name,
            username: msg.username || undefined,
          },
        });
      }
    });

    return Array.from(uniqueMessages.values());
  }

  async getAllPosts(): Promise<
    Array<{ chatId: number; postId: number; userCount: number }>
  > {
    const { data, error } = await this.supabase
      .from('user_lists')
      .select('chat_id, post_id, user_id')
      .order('chat_id', { ascending: true })
      .order('post_id', { ascending: false });

    if (error || !data) return [];

    const postsMap = new Map<string, { chatId: number; postId: number; userCount: number }>();

    data.forEach((row) => {
      const key = `${row.chat_id}-${row.post_id}`;
      if (!postsMap.has(key)) {
        postsMap.set(key, {
          chatId: row.chat_id,
          postId: row.post_id,
          userCount: 0,
        });
      }
      postsMap.get(key)!.userCount++;
    });

    return Array.from(postsMap.values());
  }

  async updateUserPosition(
    chatId: number,
    postId: number,
    userId: number,
    newPosition: number
  ): Promise<void> {
    const { data: currentUser } = await this.supabase
      .from('user_lists')
      .select('position')
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single();

    if (!currentUser) {
      throw new Error(
        `User ${userId} not found in list for chat ${chatId}, post ${postId}`
      );
    }

    const currentPosition = currentUser.position;

    if (currentPosition === newPosition) {
      return;
    }

    if (newPosition < currentPosition) {
      const { data: usersToShift } = await this.supabase
        .from('user_lists')
        .select('user_id, position')
        .eq('chat_id', chatId)
        .eq('post_id', postId)
        .gte('position', newPosition)
        .lt('position', currentPosition)
        .neq('user_id', userId);

      if (usersToShift) {
        for (const user of usersToShift) {
          await this.supabase
            .from('user_lists')
            .update({ position: user.position + 1 })
            .eq('chat_id', chatId)
            .eq('post_id', postId)
            .eq('user_id', user.user_id);
        }
      }
    } else {
      const { data: usersToShift } = await this.supabase
        .from('user_lists')
        .select('user_id, position')
        .eq('chat_id', chatId)
        .eq('post_id', postId)
        .gt('position', currentPosition)
        .lte('position', newPosition)
        .neq('user_id', userId);

      if (usersToShift) {
        for (const user of usersToShift) {
          await this.supabase
            .from('user_lists')
            .update({ position: user.position - 1 })
            .eq('chat_id', chatId)
            .eq('post_id', postId)
            .eq('user_id', user.user_id);
        }
      }
    }

    await this.supabase
      .from('user_lists')
      .update({ position: newPosition })
      .eq('chat_id', chatId)
      .eq('post_id', postId)
      .eq('user_id', userId);
  }

  async getPostDetails(
    chatId: number,
    postId: number
  ): Promise<{ userCount: number; messageCount: number } | null> {
    const { count: userCount } = await this.supabase
      .from('user_lists')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .eq('post_id', postId);

    if (userCount === 0) {
      return null;
    }

    const { count: messageCount } = await this.supabase
      .from('message_authors')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .eq('post_id', postId);

    return {
      userCount: userCount || 0,
      messageCount: messageCount || 0,
    };
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
  }
}
