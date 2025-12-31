# Investigation: Can Admin Reactions Add Users Twice?

## Summary
**YES**, when an admin reacts to the same message multiple times with the 👌 emoji, the user gets added to the active list multiple times.

## Root Cause

### 1. The `addUserToList` mutation allows duplicates
In `packages/db/convex/mutations.ts:169`, there's an explicit comment:
```typescript
// Always insert the user (allow duplicates)
```

This was introduced in commit `647bb4327bca80418f08f248499868bbf66e7290` (Nov 19, 2025), which removed the previous duplicate-checking logic:

**Before (duplicate check existed):**
```typescript
// Check if user already in list
const existing = await ctx.db
  .query("userLists")
  .withIndex("by_chat_post_user", (q) =>
    q.eq("chatId", args.chatId)
      .eq("postId", args.postId)
      .eq("userId", args.userId)
  )
  .first();

if (existing) {
  // User already in list - no need to do anything
  return false;
}
```

**After (always insert):**
```typescript
// Always insert the user (allow duplicates)
const maxPosition = queueUsers.length > 0
  ? Math.max(...queueUsers.map((u) => u.position))
  : 0;

await ctx.db.insert("turnQueue", {
  chatId: args.chatId,
  postId: args.postId,
  sessionNumber,
  userId: args.userId,
  position: maxPosition + 1,
  // ... other fields
});
```

### 2. The reaction handler has no duplicate protection
In `packages/bot/src/handlers/reaction.handler.ts:273-281`, when an admin reacts with 👌:
```typescript
await userListService.updateUserListInChat(
  chatId,
  postId,
  [messageAuthor],
  ctx.api,
  userIdToRealName,
  channelId,
  userIdToActivityType
);
```

This always calls `addUserIfNew` (which is misnamed - it doesn't check if the user is new).

### 3. No tracking of which messages have been reacted to
There's no mechanism to track whether:
- A specific message has already been processed by a reaction
- A specific user has already been added for a specific message
- Multiple reactions to the same message should be ignored

## Scenario

1. User A posts a message in the discussion group
2. Admin reacts with 👌 → User A is added to the active list (position 1)
3. Admin reacts with 👌 again on the same message → User A is added again (position 2)
4. Admin can repeat this indefinitely

## Design Intent vs Bug

The "allow duplicates" behavior was intentional to support users with **different activity types**:
- A user can participate in both "تلاوة" (reading) and "تسميع" (recitation)
- This should create two separate entries in the turnQueue

However, the current implementation doesn't distinguish between:
- **Intended duplicates**: Same user, different activity types
- **Unintended duplicates**: Same user, same activity type, from reacting to the same message multiple times

## Evidence from Commit History

Commit `30b31528c00382b790c9f6482604942244eba21a` (Dec 27, 2025) acknowledged duplicates exist:
> "Previously, users with multiple participation types (e.g., تلاوة and تسميع) were counted multiple times in the attendance count."

The fix was to count **unique users** for attendance purposes, but still allow duplicates in turnQueue.

## Proposed Solutions

### Option 1: Track processed message reactions
Store which messages have been reacted to and prevent duplicate reactions:
```typescript
messageReactions: defineTable({
  chatId: v.number(),
  postId: v.number(),
  messageId: v.number(),
  userId: v.number(), // the admin who reacted
  processedAt: v.number(),
})
```

### Option 2: Check for duplicates with same session type
Before adding to turnQueue, check if user already exists with the same sessionType:
```typescript
const existingEntry = await ctx.db
  .query("turnQueue")
  .withIndex("by_chat_post_session", (q) =>
    q.eq("chatId", args.chatId)
      .eq("postId", args.postId)
      .eq("sessionNumber", sessionNumber)
  )
  .filter((q) =>
    q.and(
      q.eq(q.field("userId"), args.userId),
      q.eq(q.field("sessionType"), args.sessionType)
    )
  )
  .first();

if (existingEntry) {
  return false; // Already in queue with same session type
}
```

### Option 3: Use message ID as deduplication key
Track which message was used to add each user, prevent adding from the same message twice:
```typescript
turnQueue: defineTable({
  // ... existing fields
  sourceMessageId: v.optional(v.number()), // Message that triggered addition
})
```

Then check before adding:
```typescript
const existingFromMessage = await ctx.db
  .query("turnQueue")
  .filter((q) =>
    q.and(
      q.eq(q.field("chatId"), args.chatId),
      q.eq(q.field("postId"), args.postId),
      q.eq(q.field("sessionNumber"), sessionNumber),
      q.eq(q.field("userId"), args.userId),
      q.eq(q.field("sourceMessageId"), args.sourceMessageId)
    )
  )
  .first();

if (existingFromMessage) {
  return false; // Already added from this message
}
```

## Recommendation

**Option 3** (track source message ID) seems most robust because:
1. Allows intended duplicates (different messages/activity types)
2. Prevents unintended duplicates (same message reacted to multiple times)
3. Provides audit trail of how users were added
4. Minimal schema changes

## Testing This Issue

To reproduce:
1. Create a test post with a discussion group
2. Have a user post a message
3. React with 👌 as an admin
4. Check the active user list - user should appear once
5. React with 👌 again on the same message
6. Check the active user list - user will appear twice (BUG)
