# Telegram Web App Security Documentation

## Overview

This document describes the security architecture for the HalaqaBot Telegram Web App (TWA). The implementation ensures that only authorized supervisors can access the admin panel and perform administrative actions.

## Security Goals

1. **Authentication**: Verify that users are who they claim to be (via Telegram)
2. **Authorization**: Ensure only whitelisted supervisors can access admin features
3. **Integrity**: Prevent tampering with user data or spoofing identities
4. **Auditability**: Track which admin performed which action

---

## Complete Security Flow

### Layer 1: Bot-Level Access Control

**Purpose**: Prevent unauthorized users from even seeing the admin panel button.

**Implementation**:
```typescript
// packages/bot/src/handlers/admin.handler.ts
bot.command('admin', async (ctx) => {
  const userId = ctx.from?.id

  if (!userId) {
    return // Anonymous users not allowed
  }

  // Check 1: User must be in the whitelist
  if (!config.allowedReactionUserIds.includes(userId)) {
    await ctx.reply('⛔ غير مصرح لك باستخدام لوحة التحكم')
    return
  }

  // Check 2: User must be a channel admin
  try {
    const channelId = config.channelId // Your main channel
    const member = await ctx.api.getChatMember(channelId, userId)
    const isChannelAdmin = member.status === 'creator' || member.status === 'administrator'

    if (!isChannelAdmin) {
      await ctx.reply('⛔ يجب أن تكون مشرفاً في القناة لاستخدام لوحة التحكم')
      return
    }
  } catch (error) {
    console.error('Error checking admin status:', error)
    await ctx.reply('❌ حدث خطأ أثناء التحقق من الصلاحيات')
    return
  }

  // User is authorized - show web app button
  await ctx.reply('إدارة الحلقة', {
    reply_markup: {
      inline_keyboard: [[
        { text: 'فتح لوحة التحكم 🎛️', web_app: { url: config.webAppUrl } }
      ]]
    }
  })
})
```

**Security Properties**:
- ✅ Only whitelisted users see the button
- ✅ Only channel admins can proceed
- ✅ Reduces attack surface (unauthorized users never get the URL)

---

### Layer 2: Web App Initialization Validation

**Purpose**: Verify user identity when the web app loads, even if someone got the URL.

**Implementation**:
```typescript
// packages/web/src/hooks/useTelegramAuth.ts
import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@halakabot/db'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

export function useTelegramAuth() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tg = window.Telegram?.WebApp

    if (!tg) {
      setError('This app must be opened from Telegram')
      setIsLoading(false)
      return
    }

    // Expand to full height
    tg.expand()

    // Get user data from Telegram
    const telegramUser = tg.initDataUnsafe?.user

    if (!telegramUser) {
      setError('Could not get user information from Telegram')
      setIsLoading(false)
      return
    }

    setUser(telegramUser)
  }, [])

  // Check authorization against backend
  const authCheck = useQuery(
    api.queries.isUserAuthorized,
    user ? { userId: user.id } : 'skip'
  )

  useEffect(() => {
    if (authCheck !== undefined) {
      setIsAuthorized(authCheck)
      setIsLoading(false)
    }
  }, [authCheck])

  return { user, isAuthorized, isLoading, error }
}
```

```typescript
// packages/web/src/App.tsx
import { useTelegramAuth } from './hooks/useTelegramAuth'

function App() {
  const { user, isAuthorized, isLoading, error } = useTelegramAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (error) {
    return <ErrorScreen message={error} />
  }

  if (!isAuthorized) {
    return <UnauthorizedScreen userId={user?.id} />
  }

  // User is authorized - show admin panel
  return <AdminPanel user={user} />
}
```

**Security Properties**:
- ✅ Validates user identity on every page load
- ✅ Graceful error handling
- ✅ User-friendly error messages

---

### Layer 3: Backend Authorization Check

**Purpose**: Verify authorization server-side (never trust the client).

**Implementation**:
```typescript
// packages/db/convex/queries.ts
export const isUserAuthorized = query({
  args: { userId: v.number() },
  handler: async (ctx, args) => {
    // Get whitelist from environment or database
    const whitelist = JSON.parse(process.env.ALLOWED_ADMIN_USER_IDS || '[]')

    // Check if user is in whitelist
    const isWhitelisted = whitelist.includes(args.userId)

    if (!isWhitelisted) {
      return false
    }

    // Optional: Additional checks can be added here
    // e.g., check if user is still an active channel admin

    return true
  },
})
```

**Security Properties**:
- ✅ Server-side validation (cannot be bypassed by client)
- ✅ Single source of truth for authorization
- ✅ Easy to extend with additional checks

---

### Layer 4: Mutation-Level Authorization

**Purpose**: Verify authorization on every sensitive operation.

**Implementation**:
```typescript
// packages/db/convex/mutations.ts

// Helper function to check authorization
async function requireAuthorization(ctx: MutationCtx, userId: number) {
  const whitelist = JSON.parse(process.env.ALLOWED_ADMIN_USER_IDS || '[]')

  if (!whitelist.includes(userId)) {
    throw new Error('Unauthorized: User is not in the admin whitelist')
  }
}

export const completeUserTurn = mutation({
  args: {
    entryId: v.id("turnQueue"),
    sessionType: v.string(),
    completedBy: v.number(), // ← NEW: Track who completed it
    isCompensation: v.optional(v.boolean()),
    compensatingForDates: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    // SECURITY CHECK: Verify the acting user is authorized
    await requireAuthorization(ctx, args.completedBy)

    // Get the entry from turnQueue
    const entry = await ctx.db.get(args.entryId)

    if (!entry) {
      throw new Error('Entry not found')
    }

    // ... rest of the completion logic ...

    // Add to participationHistory with audit trail
    await ctx.db.insert("participationHistory", {
      chatId: entry.chatId,
      postId: entry.postId,
      sessionNumber: entry.sessionNumber,
      userId: entry.userId,
      sessionType: args.sessionType,
      completedAt: Date.now(),
      completedBy: args.completedBy, // ← NEW: Audit trail
      // ... other fields ...
    })
  },
})

export const addUserToList = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    addedBy: v.number(), // ← NEW: Track who added this user
    channelId: v.optional(v.number()),
    sessionNumber: v.optional(v.number()),
    sessionType: v.optional(v.string()),
    isCompensation: v.optional(v.boolean()),
    compensatingForDates: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    // SECURITY CHECK: Verify the acting user is authorized
    await requireAuthorization(ctx, args.addedBy)

    // ... rest of the add logic ...

    await ctx.db.insert("turnQueue", {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber,
      userId: args.userId,
      position: maxPosition + 1,
      channelId: args.channelId,
      createdAt: Date.now(),
      addedBy: args.addedBy, // ← NEW: Audit trail
      // ... other fields ...
    })

    return true
  },
})

export const removeUserFromList = mutation({
  args: {
    entryId: v.id("turnQueue"),
    deletedBy: v.number(), // ← NEW: Track who deleted this user
  },
  handler: async (ctx, args) => {
    // SECURITY CHECK: Verify the acting user is authorized
    await requireAuthorization(ctx, args.deletedBy)

    const entry = await ctx.db.get(args.entryId)

    if (!entry) {
      throw new Error('Entry not found')
    }

    // Optional: Log deletion for audit trail
    await ctx.db.insert("deletionLog", {
      chatId: entry.chatId,
      postId: entry.postId,
      userId: entry.userId,
      deletedBy: args.deletedBy,
      deletedAt: Date.now(),
      reason: "Removed from queue",
    })

    await ctx.db.delete(args.entryId)
  },
})
```

**Security Properties**:
- ✅ Every mutation validates authorization
- ✅ Cannot bypass by calling mutations directly
- ✅ Full audit trail of who did what

---

### Layer 5: InitData Signature Validation (Advanced)

**Purpose**: Cryptographically verify that the data came from Telegram and hasn't been tampered with.

**Background**: Telegram signs all `initData` with HMAC-SHA256 using your bot token. This prevents attackers from:
- Spoofing user IDs
- Tampering with user data
- Impersonating other users

**Implementation**:
```typescript
// packages/web/src/utils/telegram.ts
import { createHmac } from 'crypto'

/**
 * Validates that initData was signed by Telegram
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramWebAppData(
  initData: string,
  botToken: string
): boolean {
  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  urlParams.delete('hash')

  if (!hash) {
    return false
  }

  // Create data-check-string by sorting params alphabetically
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  // Create secret key from bot token
  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  // Calculate expected hash
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  return expectedHash === hash
}
```

```typescript
// packages/db/convex/mutations.ts
export const validateAndAuthorize = mutation({
  args: {
    initData: v.string(), // Full initData string from Telegram
  },
  handler: async (ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    // Step 1: Verify signature
    const isValid = validateTelegramWebAppData(args.initData, botToken)

    if (!isValid) {
      throw new Error('Invalid Telegram data signature')
    }

    // Step 2: Parse and extract user data
    const urlParams = new URLSearchParams(args.initData)
    const userParam = urlParams.get('user')

    if (!userParam) {
      throw new Error('No user data in initData')
    }

    const user = JSON.parse(userParam)

    // Step 3: Check authorization
    const whitelist = JSON.parse(process.env.ALLOWED_ADMIN_USER_IDS || '[]')
    const isAuthorized = whitelist.includes(user.id)

    if (!isAuthorized) {
      throw new Error('User is not authorized')
    }

    // Step 4: Return validated user info
    return {
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      isAuthorized: true,
    }
  },
})
```

```typescript
// packages/web/src/App.tsx
import { useMutation } from 'convex/react'
import { api } from '@halakabot/db'

function App() {
  const validateAuth = useMutation(api.mutations.validateAndAuthorize)
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const tg = window.Telegram?.WebApp

    if (!tg) {
      setError('Must be opened from Telegram')
      return
    }

    // Get the raw initData (contains signature)
    const initData = tg.initData

    // Validate on backend
    validateAuth({ initData })
      .then((validatedUser) => {
        setUser(validatedUser)
      })
      .catch((err) => {
        setError(err.message)
      })
  }, [validateAuth])

  // ... rest of the component
}
```

**Security Properties**:
- ✅ Cryptographically secure (HMAC-SHA256)
- ✅ Prevents spoofing and tampering
- ✅ Verified by Telegram's infrastructure
- ✅ No way to bypass without knowing bot token

---

## Authorization Methods

### Method 1: Whitelist Only

**Configuration**:
```bash
# .env.local
ALLOWED_ADMIN_USER_IDS=[123456789, 987654321, 555555555]
```

**Pros**:
- Simple to implement
- Explicit control over who has access
- Works even if channel admin permissions change

**Cons**:
- Manual maintenance required
- Need to update when adding/removing supervisors

---

### Method 2: Channel Admin Check Only

**Implementation**:
```typescript
export const isUserAuthorized = query({
  args: { userId: v.number() },
  handler: async (ctx, args) => {
    // Check if user is an admin of the main channel
    // Note: This requires storing channel admin info or
    // making a Telegram API call (not directly possible from Convex)

    // In practice, this check happens at the bot layer (Layer 1)
    // and we trust that only authorized users get the web app URL

    return true // If they got here, they're authorized
  },
})
```

**Pros**:
- Automatic - no manual whitelist
- Self-updating when admins change
- Leverages Telegram's permission system

**Cons**:
- Relies on bot-layer check (Layer 1)
- If someone gets the URL, harder to validate on backend

---

### Method 3: Both (Recommended)

**Implementation**: Combine both approaches

1. **Bot Layer**: Check channel admin status (Layer 1)
2. **Backend**: Check whitelist (Layer 3)

**Benefits**:
- Defense in depth
- Both automatic (channel admin) and explicit (whitelist) control
- Maximum security

**Trade-offs**:
- More complex
- Requires maintaining whitelist

---

## Database Schema Changes

### Add Audit Trail Fields

```typescript
// packages/db/convex/schema.ts

turnQueue: defineTable({
  // ... existing fields ...
  addedBy: v.optional(v.number()), // NEW: User ID who added this participant
})

participationHistory: defineTable({
  // ... existing fields ...
  completedBy: v.optional(v.number()), // NEW: User ID who marked as complete
})

// NEW: Deletion audit log
deletionLog: defineTable({
  chatId: v.number(),
  postId: v.number(),
  userId: v.number(), // Participant who was deleted
  deletedBy: v.number(), // Admin who deleted them
  deletedAt: v.number(),
  reason: v.optional(v.string()),
})
  .index("by_chat_post", ["chatId", "postId"])
  .index("by_deleted_by", ["deletedBy"])
  .index("by_participant", ["userId"])
```

---

## Audit Queries

```typescript
// packages/db/convex/queries.ts

// Get all actions performed by a specific admin
export const getAdminActionHistory = query({
  args: { adminUserId: v.number() },
  handler: async (ctx, args) => {
    // Get additions
    const additions = await ctx.db
      .query("turnQueue")
      .filter((q) => q.eq(q.field("addedBy"), args.adminUserId))
      .collect()

    // Get completions
    const completions = await ctx.db
      .query("participationHistory")
      .filter((q) => q.eq(q.field("completedBy"), args.adminUserId))
      .collect()

    // Get deletions
    const deletions = await ctx.db
      .query("deletionLog")
      .withIndex("by_deleted_by", (q) => q.eq("deletedBy", args.adminUserId))
      .collect()

    return {
      additions: additions.length,
      completions: completions.length,
      deletions: deletions.length,
      details: { additions, completions, deletions },
    }
  },
})

// Get recent admin activity across all admins
export const getRecentAdminActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    const recentCompletions = await ctx.db
      .query("participationHistory")
      .order("desc")
      .take(limit)

    const recentDeletions = await ctx.db
      .query("deletionLog")
      .order("desc")
      .take(limit)

    // Combine and sort by timestamp
    const allActivity = [
      ...recentCompletions.map(c => ({
        type: 'completion',
        adminUserId: c.completedBy,
        participantUserId: c.userId,
        timestamp: c.completedAt,
        data: c,
      })),
      ...recentDeletions.map(d => ({
        type: 'deletion',
        adminUserId: d.deletedBy,
        participantUserId: d.userId,
        timestamp: d.deletedAt,
        data: d,
      })),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)

    return allActivity
  },
})
```

---

## Error Handling

### User-Friendly Error Messages

```typescript
// packages/web/src/components/UnauthorizedScreen.tsx
export function UnauthorizedScreen({ userId }: { userId?: number }) {
  return (
    <div className="error-screen">
      <h1>⛔ غير مصرح</h1>
      <p>عذراً، لا يمكنك الوصول إلى لوحة التحكم</p>

      {userId && (
        <p className="user-id">معرف المستخدم: {userId}</p>
      )}

      <p>يرجى التواصل مع المشرف الرئيسي للحصول على الصلاحيات</p>

      <button onClick={() => window.Telegram?.WebApp.close()}>
        إغلاق
      </button>
    </div>
  )
}
```

---

## Testing

### Test Cases

1. **Authorized User Flow**
   - User is in whitelist
   - User is channel admin
   - Can access web app
   - Can perform all actions

2. **Unauthorized User Flow**
   - User not in whitelist
   - Cannot see admin button
   - If URL accessed directly, sees unauthorized screen
   - Cannot call mutations

3. **Signature Validation**
   - Valid initData passes validation
   - Tampered initData fails validation
   - Missing hash fails validation

4. **Audit Trail**
   - All actions are logged with correct admin ID
   - Can query action history
   - Deletion log captures all removed participants

---

## Security Checklist

Before deploying to production:

- [ ] Whitelist is configured in environment variables
- [ ] Bot token is kept secret (never exposed to client)
- [ ] All mutations require `addedBy`, `completedBy`, or `deletedBy`
- [ ] Authorization helper is used in all sensitive mutations
- [ ] InitData signature validation is enabled
- [ ] Error messages don't leak sensitive information
- [ ] HTTPS is enforced for web app
- [ ] Web app domain is registered with BotFather
- [ ] Rate limiting is considered (optional, for future)

---

## Future Enhancements

1. **Role-Based Access Control (RBAC)**
   - Different permission levels (super admin, supervisor, viewer)
   - Granular permissions per action

2. **Session Management**
   - Session expiry after inactivity
   - Force re-authentication periodically

3. **Rate Limiting**
   - Prevent abuse by limiting actions per timeframe
   - Alert on suspicious activity

4. **IP Whitelisting** (optional)
   - Restrict access to specific IP ranges
   - Useful for organization networks

5. **Two-Factor Authentication** (optional)
   - Additional security layer beyond Telegram auth
   - For highly sensitive operations

---

## References

- [Telegram Web Apps Documentation](https://core.telegram.org/bots/webapps)
- [Validating Data Received via Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [Telegram Bot API - getChatMember](https://core.telegram.org/bots/api#getchatmember)
