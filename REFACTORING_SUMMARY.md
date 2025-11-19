# Refactoring Summary: Using `entryId` for Unique List Entries

## Overview
Successfully refactored the codebase to use Convex's `_id` field (exposed as `entryId`) instead of `userId` for uniquely identifying list entries. This enables the same user to appear multiple times in the list (e.g., when they complete their turn and get added again "after 3 turns").

## Changes Made

### 1. **Database Layer** (`packages/db`)

#### Types (`src/types.ts`)
- Added `entryId?: string` field to the `User` interface

#### Queries (`convex/queries.ts`)
- Updated `getUserList` query to include `entryId: entry._id` in both `activeUsers` and `completedUsers` arrays

#### Mutations (`convex/mutations.ts`)
Updated the following mutations to use `entryId` instead of `userId`:

- **`updateUserPosition`**: Now accepts `entryId: v.id("userLists")` instead of `chatId`, `postId`, `userId`, and `sessionNumber`
- **`removeUserFromList`**: Now accepts `entryId: v.id("userLists")` instead of `chatId`, `postId`, `userId`, and `sessionNumber`
- **`completeUserTurn`**: Now accepts `entryId: v.id("userLists")` instead of `chatId`, `postId`, `userId`, and `sessionNumber`
- **`skipUserTurn`**: Now accepts `entryId: v.id("userLists")` instead of `chatId`, `postId`, `userId`, and `sessionNumber`
- **`updateSessionType`**: Now accepts `entryId: v.id("userLists")` instead of `chatId`, `postId`, `userId`, and `sessionNumber`

All mutations are now simpler and more efficient:
- No need to query for the entry - just use `ctx.db.get(args.entryId)`
- No need to pass session information - it's already in the entry
- Guaranteed to operate on the correct entry even with duplicate users

### 2. **Frontend Layer** (`packages/web`)

#### PostDetail Component (`src/routes/PostDetail.tsx`)
Updated all handler functions to use `entryId`:
- `handleReorder(entryId: string, newPosition: number)`
- `handleDelete(entryId: string)`
- `handleComplete(entryId: string, sessionType: SessionType)`
- `handleSkip(entryId: string)`
- `handleUpdateSessionType(entryId: string, sessionType: SessionType)`

#### UserList Component (`src/components/UserList.tsx`)
- Updated prop types to use `entryId: string` for all operations
- Updated drag-and-drop to use `entryId` as the unique key
- Updated `SortableContext` items to use `user.entryId`
- Updated all internal handlers to use `entryId`
- Added null checks for `entryId` before calling handlers

#### DraggableUser Component (`src/components/DraggableUser.tsx`)
- Updated `useSortable` to use `user.entryId || user.id.toString()` as the ID
- Updated `onDelete` prop type to accept `entryId: string`
- Updated delete handler to pass `user.entryId` instead of `user.id`

#### CompletedUsersSection Component (`src/components/CompletedUsersSection.tsx`)
- Added `entryId?: string` to `CompletedUser` interface
- Updated prop types for `onUpdateSessionType` and `onDelete` to use `entryId: string`
- Updated handlers to pass `user.entryId` instead of `user.id`
- Updated map key to use `user.entryId || user.id`

## Benefits

1. **Supports Duplicate Users**: The same user can now appear multiple times in the active list
2. **Simpler Mutations**: No need to pass `chatId`, `postId`, `sessionNumber` - just the `entryId`
3. **More Reliable**: Operations are guaranteed to affect the correct entry, even with duplicates
4. **Better Performance**: Direct lookups by `_id` are faster than filtered queries
5. **Type Safety**: Using Convex's `v.id("userLists")` provides compile-time type checking

## Backward Compatibility

The changes maintain backward compatibility where needed:
- `onUpdateDisplayName` and `onAddTurnAfter3` still use `userId` since they operate on the user entity, not the list entry
- Fallback to `user.id` when `entryId` is not available (for safety during transition)

## Testing Recommendations

1. Test adding the same user multiple times to the list
2. Test "add user after 3 turns" functionality for both active and completed users
3. Test drag-and-drop reordering with duplicate users
4. Test deleting one instance of a duplicate user (should only delete that specific entry)
5. Test completing a turn and then adding the same user again

## Next Steps

The refactoring is complete and ready for testing. The "add user after 3 turns" logic should now work correctly with the fixed calculation and the new `entryId` system.
