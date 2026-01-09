# Telegram Web App Implementation Guide

## Overview

This document outlines the phased implementation of the Telegram Web App (TWA) for HalaqaBot, enabling automatic user authentication and admin action tracking.

---

## Implementation Phases

### Phase 1: Minimum Viable TWA ✅ COMPLETED

**Goal**: Convert the web app to a Telegram Web App with admin-only access.

**What Was Implemented**:

#### Backend Changes
- ✅ Added `channelAdmins` table to store channel administrators cache
- ✅ Added `syncChannelAdmins` mutation to sync admins from Telegram API
- ✅ Added `isUserAuthorized` query to check if user is channel admin
- ✅ Added `channelId` and `webAppUrl` to bot configuration

#### Bot Changes
- ✅ Created `AdminSyncService` to fetch and sync channel admins periodically (every 5 minutes)
- ✅ Created `webApp.handler.ts` with `/admin` command and persistent menu button
- ✅ Added authorization checks before showing web app button
- ✅ Integrated admin sync on bot startup and graceful shutdown

#### Frontend Changes
- ✅ Added Telegram Web App SDK to HTML
- ✅ Installed `@twa-dev/types` for TypeScript support
- ✅ Created TypeScript declarations for Telegram Web App API
- ✅ Created `useTelegramAuth` hook to extract user and check authorization
- ✅ Created `TelegramAuthContext` provider for app-wide auth state
- ✅ Created `LoadingScreen`, `ErrorScreen`, and `UnauthorizedScreen` components
- ✅ Updated `App.tsx` to enforce authorization flow

**Features Delivered**:
- ✅ Only channel administrators can access the admin panel
- ✅ Automatic user identification via Telegram (no manual login)
- ✅ Secure backend validation (cannot be bypassed by client)
- ✅ User-friendly Arabic error messages
- ✅ Telegram theme integration
- ✅ Periodic admin list refresh every 5 minutes
- ✅ Persistent menu button for quick access

**Security**:
- ✅ Bot-level authorization check (Layer 1 - UX)
- ✅ Web app client-side validation (Layer 2 - UX)
- ✅ Backend server-side validation (Layer 3 - Security) ← **Critical**

**What's NOT Tracked Yet**:
- ❌ Who added a participant to the queue
- ❌ Who marked a participation as complete
- ❌ Who deleted a participant
- ❌ Audit trail of admin actions

---

### Phase 2: User Action Tracking 🔄 PLANNED

**Goal**: Track which admin performed which action for accountability and audit purposes.

**What Will Be Implemented**:

#### Database Schema Changes
- [ ] Add `addedBy` field to `turnQueue` table (optional, for backwards compatibility)
- [ ] Add `completedBy` field to `participationHistory` table (optional)
- [ ] Add `deletionLog` table to track deletions:
  ```typescript
  deletionLog: {
    chatId: number
    postId: number
    userId: number        // Who was deleted
    deletedBy: number     // Admin who deleted them
    deletedAt: number
    reason?: string
  }
  ```

#### Backend Mutations
- [ ] Update `addUserToList` mutation:
  - Add `addedBy: v.number()` parameter
  - Store `addedBy` in `turnQueue` record

- [ ] Update `completeUserTurn` mutation:
  - Add `completedBy: v.number()` parameter
  - Store `completedBy` in `participationHistory` record

- [ ] Update `removeUserFromList` mutation:
  - Add `deletedBy: v.number()` parameter
  - Create entry in `deletionLog` table

- [ ] Add helper function `requireAuthorization` for mutation validation
- [ ] Update other mutations as needed (skip, reorder, update session type, etc.)

#### Frontend Changes
- [ ] Update all mutation calls in `PostDetail.tsx` to pass `user.id`:
  ```typescript
  const { user } = useTelegramAuthContext()

  await addUserToList({
    chatId,
    postId,
    userId,
    addedBy: user!.id  // Track who added
  })
  ```

#### Bot Changes
- [ ] Update `reaction.handler.ts` to pass admin ID when adding via 👌 reaction:
  ```typescript
  const userId = ctx.messageReaction!.user?.id
  await userListService.updateUserListInChat(
    chatId,
    postId,
    [messageAuthor],
    ctx.api,
    userIdToRealName,
    channelId,
    userIdToActivityType,
    userId  // Pass the admin who reacted
  )
  ```

- [ ] Update `user-list.service.ts` to accept and pass `addedBy` parameter

#### Audit Queries (Optional)
- [ ] Add `getAdminActionHistory` query to view all actions by a specific admin
- [ ] Add `getRecentAdminActivity` query to view recent actions across all admins
- [ ] Add `getDeletionLog` query to view deletion history

#### UI for Audit Trail (Future Enhancement)
- [ ] Create admin activity dashboard
- [ ] Show who added/completed each participant
- [ ] Display deletion history
- [ ] Filter actions by date, admin, or action type

**Benefits**:
- Full accountability for all admin actions
- Audit trail for compliance and troubleshooting
- Ability to identify who made mistakes
- Historical record of all administrative changes

---

## Deployment Guide

### Prerequisites

1. **BotFather Registration**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - `/mybots` → Select your bot
   - `Bot Settings` → `Menu Button` → `Configure Menu Button`
   - Send web app URL: `https://halakabot.app.thawabcoding.work`

2. **Environment Variables**:

   **Bot** (`packages/bot/.env.local`):
   ```bash
   BOT_TOKEN=your_bot_token
   CONVEX_URL=your_convex_url
   FORWARD_CHAT_ID=your_forward_chat_id
   GROQ_API_KEY=your_groq_api_key

   # TWA Configuration
   WEB_APP_URL=https://halakabot.app.thawabcoding.work
   CHANNEL_ID=-1002081068866
   ```

   **Database** (`packages/db/.env.local`):
   ```bash
   # No additional variables needed for Phase 1
   # CHANNEL_ID will be used in Phase 2 for validation
   ```

### Deployment Steps

#### 1. Deploy Database (Convex)

```bash
cd packages/db
npx convex deploy --prod
```

This will:
- Create the `channelAdmins` table
- Deploy `syncChannelAdmins` mutation
- Deploy `isUserAuthorized` query

#### 2. Deploy Bot

```bash
cd packages/bot
npm run build
npm start
```

**Expected console output**:
```
Starting bot...
Bot @YourBotName is running!
Listening for reactions and channel posts...
🔄 Starting admin sync for channel -1002081068866...
🔄 Fetching admins for channel -1002081068866...
✅ Fetched 3 admins for channel -1002081068866
💾 Syncing 3 admins to database...
✅ Successfully synced admins to database
```

**Admin sync will run**:
- Immediately on startup
- Every 5 minutes thereafter

#### 3. Deploy Web App

```bash
cd packages/web
npm run build
```

Deploy the `dist` folder to `https://halakabot.app.thawabcoding.work`

#### 4. Test the Integration

**As a Channel Admin**:

1. Open Telegram
2. Find your bot
3. Click the menu button at the bottom (لوحة التحكم)
   - OR send `/admin` command
4. You should see: "📋 لوحة التحكم الإدارية"
5. Click "🎛️ فتح لوحة التحكم" button
6. Web app opens in Telegram
7. See loading screen briefly
8. Admin panel loads successfully ✅

**As a Non-Admin**:

1. Send `/admin` command
2. Should see error: "⛔ عذراً، لا يمكنك الوصول إلى لوحة التحكم"
3. Cannot access the web app ❌

**Direct URL Test**:

1. Open `https://halakabot.app.thawabcoding.work` in a regular browser
2. Should see error: "يجب فتح التطبيق من خلال تيليجرام" ❌
3. App only works when launched from Telegram ✅

---

## Testing Checklist

### Authorization Tests

- [ ] Channel admin can see `/admin` button
- [ ] Non-admin sees error message for `/admin` command
- [ ] Menu button appears at bottom of chat
- [ ] Clicking menu button opens web app for admins
- [ ] Web app shows loading screen during initialization
- [ ] Web app validates user on load
- [ ] Backend rejects unauthorized users (check Convex logs)
- [ ] Direct browser access shows error message

### Admin Sync Tests

- [ ] Bot fetches admins on startup
- [ ] Admins are stored in `channelAdmins` table (check Convex dashboard)
- [ ] Admin list refreshes every 5 minutes
- [ ] Removing an admin from channel removes them from database (after 5 min)
- [ ] Adding a new admin to channel adds them to database (after 5 min)

### UI/UX Tests

- [ ] Loading screen displays correctly
- [ ] Error screen displays with Arabic message
- [ ] Unauthorized screen shows user info
- [ ] Telegram theme colors are applied
- [ ] App expands to full height in Telegram
- [ ] All routes work correctly after authorization
- [ ] App closes when clicking close button

---

## Configuration

### Channel ID

**Current value**: `-1002081068866`

**Where it's configured**:
1. `packages/bot/src/config/environment.ts` (line 20)
2. `packages/web/src/contexts/TelegramAuthContext.tsx` (line 6)

**To change**:
- Update both files with new channel ID
- OR set `CHANNEL_ID` environment variable

### Web App URL

**Current value**: `https://halakabot.app.thawabcoding.work`

**Where it's configured**:
1. `packages/bot/src/config/environment.ts` (line 19)

**To change**:
- Update the file
- OR set `WEB_APP_URL` environment variable
- MUST re-register with BotFather after changing

---

## Troubleshooting

### Problem: User sees "يجب فتح التطبيق من خلال تيليجرام"

**Cause**: User opened the web app URL directly in a browser instead of through Telegram.

**Solution**: User must access the app via:
- Menu button in bot chat
- `/admin` command
- Web app button in Telegram

---

### Problem: Admin sees "غير مصرح"

**Possible causes**:

1. **Admin list not synced yet**:
   - Wait 5 minutes for first sync
   - Check bot logs for sync status
   - Check Convex dashboard for `channelAdmins` records

2. **Wrong channel ID**:
   - Verify `channelId` in configuration matches actual channel
   - Check bot logs for "Starting admin sync for channel X"

3. **User is not actually an admin**:
   - Verify user has admin/creator status in channel
   - Check Telegram channel settings

**Debug steps**:
```bash
# Check bot logs
tail -f bot.log | grep -i admin

# Check Convex dashboard
# → Data → channelAdmins table
# Verify admin's userId is present
```

---

### Problem: Menu button doesn't appear

**Possible causes**:

1. **Bot hasn't set menu button yet**:
   - Restart the bot
   - Check logs for "Setting up menu button"

2. **Telegram client doesn't support menu buttons**:
   - Update Telegram app to latest version
   - Menu buttons require Telegram 6.0+

**Solution**:
- Use `/admin` command instead
- Update Telegram client

---

### Problem: Admin sync fails

**Symptoms**: Bot logs show errors like "Error fetching admins"

**Possible causes**:

1. **Bot is not a member of the channel**:
   - Add bot to channel as admin

2. **Channel ID is wrong**:
   - Verify channel ID (should be negative number)
   - Get correct ID using: `/getid` command in channel

3. **Network issues**:
   - Check internet connection
   - Verify Telegram API is accessible

**Solution**:
- Check bot permissions in channel
- Verify channel ID configuration
- Check bot logs for detailed error messages

---

## Security Considerations

### Why Backend Validation is Critical

**❌ Never rely on client-side validation alone**:
- Users can modify browser JavaScript
- Users can call Convex mutations directly
- Client-side checks are for UX only

**✅ Always validate on backend**:
- `isUserAuthorized` query checks database
- Runs on Convex servers (cannot be bypassed)
- Provides actual security enforcement

### Admin List Caching

**Why we cache admin list**:
- Fast authorization checks (no API calls)
- Works even if Telegram API is slow/down
- Reduces load on Telegram API

**Security trade-off**:
- Up to 5 minute delay when admin status changes
- Acceptable for most use cases
- Can reduce interval if needed (not recommended < 1 minute)

**If you need instant updates**:
- Reduce sync interval to 1 minute (impacts Telegram API rate limits)
- Or implement manual "refresh admins" command

---

## Future Enhancements

### Phase 3: Advanced Features (Beyond User Tracking)

**Potential features**:

1. **Role-Based Access Control (RBAC)**:
   - Different permission levels (super admin, supervisor, viewer)
   - Granular permissions per action
   - Read-only mode for some admins

2. **Session Management**:
   - Session expiry after inactivity
   - Force re-authentication periodically
   - Multi-device session tracking

3. **Rate Limiting**:
   - Prevent abuse by limiting actions per timeframe
   - Alert on suspicious activity (e.g., 100 deletions in 1 minute)

4. **Signature Validation** (Layer 4 Security):
   - Cryptographically verify Telegram's initData
   - Prevents spoofing even if someone bypasses bot check
   - See `docs/telegram-web-app-security.md` for implementation

5. **Admin Activity Dashboard**:
   - View who performed which actions
   - Filter by date, admin, action type
   - Export audit logs

6. **Notifications**:
   - Send Telegram notification when someone accesses admin panel
   - Alert channel owner of suspicious actions
   - Daily/weekly activity summaries

---

## References

- [Telegram Web Apps Documentation](https://core.telegram.org/bots/webapps)
- [HalaqaBot Security Architecture](./telegram-web-app-security.md)
- [Telegram Bot API - getChatAdministrators](https://core.telegram.org/bots/api#getchatadministrators)
- [Convex Documentation](https://docs.convex.dev/)

---

## Change Log

| Date | Phase | Changes |
|------|-------|---------|
| 2026-01-09 | Phase 1 | Initial TWA implementation with admin authorization |
| TBD | Phase 2 | User action tracking implementation |

---

## Support

For issues or questions:
- Check this documentation first
- Review security documentation: `docs/telegram-web-app-security.md`
- Check bot logs for errors
- Inspect Convex dashboard for data issues
