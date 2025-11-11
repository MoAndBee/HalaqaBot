# Turn-Taking Feature Implementation Plan

## Overview
Implement a turn-taking system for Halaqa posts that allows tracking user turns with completion status (تلاوة or تسميع) and the ability to skip users.

## Requirements

### UI Components

#### 1. Turn Controls (Sticky at Top)
- **Split Button**: إتمام with dropdown
  - Initially shows "إتمام (اختر)" and is disabled
  - Dropdown always enabled with options: تلاوة, تسميع
  - After selection, button shows "إتمام (تلاوة)" or "إتمام (تسميع)" and becomes enabled
  - Clicking main button completes the current user's turn

- **Skip Button**: تخطي
  - Swaps position with next user (position 1 ↔ position 2)
  - Disabled when ≤1 active users remain
  - Delays user's turn by one position

#### 2. Completed Users Section
- Collapsible section with label "الأدوار الفائتة" and rotating chevron
- Initially collapsed
- Only shown when at least one user is completed
- Displays completed users with:
  - Greyed out styling with greenish tint
  - Checkmark/done icon
  - Position number preserved
  - Session type badge (تلاوة or تسميع)
  - Completion timestamp
  - Edit icon to change session type
  - More compact than active user cards
  - NOT draggable back to active list

#### 3. Active Users List
- Shows only users where completed_at IS NULL
- Always ordered by position (lowest position = current turn)
- Maintains drag-and-drop functionality
- Current turn is the first user in the list

### Database Schema Changes

#### userLists Table
Add two new fields:
```typescript
completed_at: v.optional(v.number()), // timestamp
session_type: v.optional(v.string()),  // "تلاوة" or "تسميع"
```

### Database Mutations

#### 1. completeUserTurn(userId, sessionType)
- Set completed_at = Date.now()
- Set session_type = sessionType ("تلاوة" or "تسميع")
- User is hidden from active list

#### 2. skipUserTurn(userId)
- Find current user (position 1)
- Find next user (position 2)
- Swap their positions
- Only works if there are ≥2 active users

#### 3. updateSessionType(userId, newType)
- Update session_type for a completed user
- Called when editing via the edit icon

#### 4. Modified: addUserToList(chatId, postId, userId)
**Auto-copy logic for new posts:**

When adding first user to a new post:
1. Check if current post's userList is empty
2. If empty:
   a. Find previous post: `posts where chat_id = chatId AND id < postId ORDER BY id DESC LIMIT 1`
   b. Get incomplete users: `userLists where post_id = previousPostId AND completed_at IS NULL ORDER BY position ASC`
   c. Copy them to new post with resequenced positions (1, 2, 3...)
3. Add the new user at next available position

**Edge cases:**
- No previous post → Just add new user at position 1
- Previous post all completed → Just add new user at position 1
- Previous post has no users → Just add new user at position 1

### Database Queries

#### Modified: getUserList(chatId, postId)
Return two separate arrays:
- `activeUsers`: where completed_at IS NULL, ordered by position
- `completedUsers`: where completed_at IS NOT NULL, ordered by position

### Logic Flows

#### Complete Turn Flow
1. User selects type from dropdown (تلاوة or تسميع)
2. Split button becomes enabled, shows "إتمام (تلاوة)" or "إتمام (تسميع)"
3. User clicks إتمام button
4. Mutation: completeUserTurn(currentUserId, selectedType)
5. User is moved to completed section
6. Next user (by position) becomes current turn
7. Button resets to "إتمام (اختر)" and disabled

#### Skip Turn Flow
1. User clicks تخطي button
2. Validation: Check if ≥2 active users exist
3. Mutation: skipUserTurn(currentUserId)
4. Positions swap: user 1 → position 2, user 2 → position 1
5. Previously second user is now the current turn

#### Edit Session Type Flow
1. User clicks edit icon on completed user
2. Dropdown appears with current type selected
3. User selects new type
4. Confirmation button appears
5. User clicks confirm
6. Mutation: updateSessionType(userId, newType)
7. Badge updates

#### New Halaqa Flow
1. User creates new post
2. User adds first user via addUserToList
3. Backend automatically:
   - Finds previous post in same chat
   - Copies incomplete users with resequenced positions
   - Then adds the requested new user
4. List shows carried-over users first, then new users

### Key Behaviors

#### Turn Order Logic
- Completed users are ALWAYS at lower positions (1, 2, 3...)
- Incomplete users are ALWAYS at higher positions
- This is enforced by:
  - Only current turn (lowest position incomplete) can be completed
  - Skip only swaps adjacent positions
  - Cannot drag completed users back to active

#### Timestamp Display
- Same day: Show time only (e.g., "3:45 PM") in user's local timezone
- Different day: Show date + time (e.g., "Nov 10, 3:45 PM")

#### RTL Support
- All components use RTL direction
- Arabic text throughout
- Proper alignment for RTL layout

### Validation & Edge Cases

#### Validation
- ✅ Click إتمام without type selected → Show error: "الرجاء اختيار نوع الدور"
- ✅ تخطي button disabled when ≤1 active users
- ✅ Hide turn controls when no users in list
- ✅ Only show completed section when completed users exist

#### Edge Cases
- ✅ Skip with only 1 active user → Button disabled
- ✅ Skip with 2 active users → Swap positions
- ✅ Skip with no other users → Button disabled
- ✅ All users completed → Show only completed section, hide controls
- ✅ No users at all → Show empty state
- ✅ First user added to new post → Auto-copy incomplete from previous

### UI Layout Structure

```
┌─────────────────────────────────┐
│ [STICKY/FIXED AT TOP]           │
│ [إتمام (اختر) ▼]  [تخطي]       │
├─────────────────────────────────┤
│ [SCROLLABLE CONTENT]            │
│                                 │
│ الأدوار الفائتة ⌄ (if exists)   │
│ ┌─ Completed Users (expanded) ─┐│
│ │ ✓ 1. Ahmed - تلاوة [edit]    ││
│ │ ✓ 2. Fatima - تسميع [edit]   ││
│ └──────────────────────────────┘│
│                                 │
│ Active Users:                   │
│ 1. Mohammed (← current turn)    │
│ 2. Omar                         │
│ 3. Sara                         │
│ ...                             │
└─────────────────────────────────┘
```

## Implementation Checklist

- [ ] Add completed_at and session_type fields to userLists schema
- [ ] Create database mutations (completeUserTurn, skipUserTurn, updateSessionType)
- [ ] Modify addUserToList mutation to copy incomplete users from previous post
- [ ] Update getUserList query to separate completed vs active users
- [ ] Create SplitButton component for إتمام with dropdown
- [ ] Create TurnControls component with sticky positioning
- [ ] Create CompletedUsersSection component with collapsible UI
- [ ] Update DraggableUser component for completed users styling and edit functionality
- [ ] Update UserList component to integrate all new features with RTL support
- [ ] Test the complete turn-taking flow end-to-end

## Notes
- All text in Arabic for RTL support
- No limit on number of times a user can be skipped
- One completion per user per post
- Completed users cannot be dragged back to active list
- Manual drag-and-drop still allowed for active users
