/**
 * Message handler for processing and storing incoming messages
 */

import { Context } from 'grammy';
import { messageStore } from '../storage/messageStore';
import type { StoredMessage, MessageType } from '../types';

/**
 * Determine the message type from the context
 */
function getMessageType(ctx: Context): MessageType {
  const msg = ctx.message;
  if (!msg) return 'unknown';

  if (msg.text) return 'text';
  if (msg.photo) return 'photo';
  if (msg.video) return 'video';
  if (msg.audio) return 'audio';
  if (msg.voice) return 'voice';
  if (msg.document) return 'document';
  if (msg.sticker) return 'sticker';
  if (msg.animation) return 'animation';
  if (msg.location) return 'location';
  if (msg.contact) return 'contact';
  if (msg.poll) return 'poll';
  if (msg.dice) return 'dice';
  if (msg.video_note) return 'video_note';
  if (msg.new_chat_members) return 'new_chat_members';
  if (msg.left_chat_member) return 'left_chat_member';
  if (msg.new_chat_title) return 'new_chat_title';
  if (msg.new_chat_photo) return 'new_chat_photo';
  if (msg.delete_chat_photo) return 'delete_chat_photo';
  if (msg.group_chat_created) return 'group_chat_created';
  if (msg.supergroup_chat_created) return 'supergroup_chat_created';
  if (msg.channel_chat_created) return 'channel_chat_created';
  if (msg.pinned_message) return 'pinned_message';

  return 'unknown';
}

/**
 * Get media file ID if the message contains media
 */
function getMediaFileId(ctx: Context, messageType: MessageType): string | undefined {
  const msg = ctx.message;
  if (!msg) return undefined;

  switch (messageType) {
    case 'photo':
      return msg.photo?.[msg.photo.length - 1]?.file_id;
    case 'video':
      return msg.video?.file_id;
    case 'audio':
      return msg.audio?.file_id;
    case 'voice':
      return msg.voice?.file_id;
    case 'document':
      return msg.document?.file_id;
    case 'sticker':
      return msg.sticker?.file_id;
    case 'animation':
      return msg.animation?.file_id;
    case 'video_note':
      return msg.video_note?.file_id;
    default:
      return undefined;
  }
}

/**
 * Main message handler function
 * Processes incoming messages and stores them
 */
export async function handleMessage(ctx: Context): Promise<void> {
  try {
    const msg = ctx.message;
    if (!msg) return;

    const messageType = getMessageType(ctx);
    const mediaFileId = getMediaFileId(ctx, messageType);

    const storedMessage: StoredMessage = {
      messageId: msg.message_id,
      chatId: msg.chat.id,
      chatTitle: msg.chat.type !== 'private' ? msg.chat.title : undefined,
      chatType: msg.chat.type as 'private' | 'group' | 'supergroup' | 'channel',
      userId: msg.from?.id || 0,
      userName: msg.from?.username,
      userFirstName: msg.from?.first_name,
      userLastName: msg.from?.last_name,
      text: msg.text,
      caption: msg.caption,
      messageType,
      date: new Date(msg.date * 1000),
      replyToMessageId: msg.reply_to_message?.message_id,
      forwardFrom: msg.forward_from?.username || msg.forward_from?.first_name,
      mediaFileId,
    };

    // Store the message
    messageStore.addMessage(storedMessage);

    // Log for debugging (optional, can be controlled by config)
    const chatName = storedMessage.chatTitle || `User ${storedMessage.userId}`;
    const userName = storedMessage.userName || storedMessage.userFirstName || 'Unknown';
    console.log(
      `📨 [${chatName}] ${userName}: ${messageType}${storedMessage.text ? ` - "${storedMessage.text.substring(0, 50)}${storedMessage.text.length > 50 ? '...' : ''}"` : ''}`
    );
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

/**
 * Handler for when the bot is added to a new group
 */
export async function handleNewGroup(ctx: Context): Promise<void> {
  try {
    const chat = ctx.chat;
    if (!chat || chat.type === 'private') return;

    console.log(`🎉 Bot added to new ${chat.type}: ${chat.title || chat.id}`);

    // Send welcome message
    await ctx.reply(
      '👋 Hello! I am HalakaBot.\n\n' +
      '📝 I will monitor and collect all messages in this group.\n\n' +
      '⚠️ Important Setup:\n' +
      '1. Make sure I am an admin in this group\n' +
      '2. Ensure my Privacy Mode is OFF (configure via @BotFather)\n\n' +
      '📋 Available commands:\n' +
      '/help - Show all commands\n' +
      '/stats - View message statistics\n' +
      '/count - Show message count for this chat\n\n' +
      'Happy monitoring! 🚀'
    );
  } catch (error) {
    console.error('Error handling new group:', error);
  }
}

/**
 * Handler for when a member leaves the group (including the bot)
 */
export async function handleLeftMember(ctx: Context): Promise<void> {
  try {
    const leftMember = ctx.message?.left_chat_member;
    const botInfo = await ctx.api.getMe();

    if (leftMember?.id === botInfo.id) {
      const chatId = ctx.chat?.id;
      if (chatId) {
        const removedCount = messageStore.clearMessages(chatId);
        console.log(`👋 Bot removed from chat ${chatId}. Cleared ${removedCount} messages.`);
      }
    }
  } catch (error) {
    console.error('Error handling left member:', error);
  }
}
