# Root Cause: Duplicate User Addition from Single Message

## The Bug
When an admin reacts to ONE message with 👌, the user can be added TWICE to the active list.

## How It Happens

### Scenario:
1. Admin adds 👌 reaction to a message → User added (correct ✅)
2. Admin adds a SECOND emoji (like ❤️) while keeping 👌 → User added AGAIN (bug ❌)

### Why This Happens

The reaction handler in `reaction.handler.ts:42-48` only checks if 👌 is in `new_reaction`:

```typescript
// Check if the new reaction contains OK hand emoji
const newReaction = ctx.messageReaction!.new_reaction;
const hasOkHandEmoji = newReaction.some((reaction) => {
  if (reaction.type === "emoji") {
    return reaction.emoji === "👌";
  }
  return false;
});

if (hasOkHandEmoji) {
  // Process and add user
}
```

**The problem:** This code triggers whenever 👌 is present in `new_reaction`, but it doesn't check if 👌 was already there before!

### How Telegram's message_reaction Events Work

When a user modifies reactions on a message, Telegram sends a `message_reaction` event with:
- `old_reaction`: Array of reactions BEFORE the change
- `new_reaction`: Array of reactions AFTER the change

#### Example Timeline:

**Event 1: Admin adds 👌**
```json
{
  "old_reaction": [],
  "new_reaction": [{"type": "emoji", "emoji": "👌"}]
}
```
✅ User is added (correct behavior)

**Event 2: Admin adds ❤️ (while 👌 is still there)**
```json
{
  "old_reaction": [{"type": "emoji", "emoji": "👌"}],
  "new_reaction": [
    {"type": "emoji", "emoji": "👌"},
    {"type": "emoji", "emoji": "❤️"}
  ]
}
```
❌ User is added AGAIN (bug!)

**Event 3: Admin removes ❤️ (while 👌 is still there)**
```json
{
  "old_reaction": [
    {"type": "emoji", "emoji": "👌"},
    {"type": "emoji", "emoji": "❤️"}
  ],
  "new_reaction": [{"type": "emoji", "emoji": "👌"}]
}
```
❌ User is added AGAIN (bug!)

## The Fix

We need to check if 👌 was **NEWLY ADDED**, not just if it's present.

### Solution: Check if 👌 is in new_reaction but NOT in old_reaction

```typescript
// Check if the OK hand emoji was NEWLY ADDED (not already present)
const oldReaction = ctx.messageReaction!.old_reaction;
const newReaction = ctx.messageReaction!.new_reaction;

const hadOkHandEmoji = oldReaction.some((reaction) => {
  if (reaction.type === "emoji") {
    return reaction.emoji === "👌";
  }
  return false;
});

const hasOkHandEmoji = newReaction.some((reaction) => {
  if (reaction.type === "emoji") {
    return reaction.emoji === "👌";
  }
  return false;
});

// Only process if 👌 was NEWLY ADDED (not already there)
if (hasOkHandEmoji && !hadOkHandEmoji) {
  // Process and add user
}
```

## Impact

This bug affects any scenario where:
1. Admin reacts with 👌 to add a user
2. Admin later adds/removes other emojis on the same message
3. Each emoji change re-triggers the handler, adding the user again

Users could be added 3, 4, or more times from a single message if the admin changes reactions multiple times.

## Test Case

To reproduce:
1. Have a user post a message in the discussion group
2. As admin, add 👌 reaction → Check active list (user appears once)
3. As admin, add ❤️ reaction (keep 👌) → Check active list (user appears twice! 🐛)
4. As admin, remove ❤️ reaction (keep 👌) → Check active list (user appears three times! 🐛)

## Recommended Fix

Modify `packages/bot/src/handlers/reaction.handler.ts` line 41-50 to check if 👌 was NEWLY added.
