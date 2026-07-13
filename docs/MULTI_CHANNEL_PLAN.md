# Multi-Channel Support — Implementation Plan

Goal: support the bot serving **multiple Telegram channels** with a single bot
token, with data separated per channel, and a web-app first screen that lets an
admin pick which of their channels to manage.

## Background: two IDs

- **`channelId`** — the Telegram *channel* (e.g. `-1002081068866`). Used for
  admin authorization via the `channelAdmins` table.
- **`chatId`** — the linked *discussion group* where posts, turns, messages and
  history actually live. **Almost all data is keyed on `chatId`.**

Both are currently hardcoded to the same constant in three places:

- `packages/bot/src/config/environment.ts` (`channelId`)
- `packages/web/src/contexts/TelegramAuthContext.tsx` (`CHANNEL_ID`)
- `packages/web/src/routes/PostDetail.tsx` (`CHANNEL_ID`, marked `TODO`)

`getAllPosts` (`packages/db/convex/queries.ts`) currently collects **all** rows
globally with no channel filter — this is the core data-separation gap.

## Decisions

- **Channel registration: auto-discover from traffic.** The bot upserts a
  `channels` row when it observes the `channelId`↔`chatId` pairing from a channel
  post / linked-group message. No manual setup UI.
- **First screen: skip picker when the admin has exactly one channel.**
  `getMyChannels` returns the admin's channels; 0 → unauthorized, 1 → auto-enter,
  2+ → show picker. A channel switcher lives in the layout header.

## Phases

### Phase 1 — Channel registry (data model)
- Add `channels` table: `{ channelId, chatId, title, forwardChatId?,
  autoReactionEmoji?, webAppUrl?, isActive, createdAt }` with `by_channel` and
  `by_chat` indexes.
- `upsertChannel` mutation (called from the discovery hook).
- `getMyChannels({ userId })` query: join `channelAdmins` (by user) → `channels`.
- Seed the existing channel.

### Phase 2 — Backend query scoping (highest risk)
- Make `getAllPosts` and student search take a required channel scope and filter
  `turnQueue` / `participationHistory` / `messageAuthors` to it.
- Backfill the optional `channelId` column on existing rows for the seeded
  channel so `by_channel_post` indexes are reliable.

### Phase 3 — Bot process
- Iterate all active channels from the registry for admin sync (re-read
  periodically so newly-discovered channels join the loop).
- Add a discovery hook in the message / channel-post handlers that upserts the
  `channels` row on first sighting.
- Handlers resolve the channel from the incoming update's `chat.id`.

### Phase 4 — Web app UI
- `ChannelPicker` landing screen backed by `getMyChannels`; skip when single.
- Replace the `CHANNEL_ID` constant with a `ChannelContext` holding the selected
  `{ channelId, chatId }`; thread it through `Home`, `Halaqas`, `Students`,
  `PostDetail`.
- Persist selection (sessionStorage) + channel switcher in the layout header.

### Phase 5 — Cleanup
- Remove the three hardcoded constants; flow ids from registry → bot and from
  picker → web context.

## Effort estimate

~4–5 days total. Risk is concentrated in Phase 2 (global `getAllPosts` scoping
and the `channelId` backfill).
