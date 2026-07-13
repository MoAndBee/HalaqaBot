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

### Phase 2 — Backend query scoping
- Scope the list views by the selected channel's `chatId`. `getPaginatedPosts`
  takes a required `chatId` and paginates via a new `posts.by_chat_created`
  index; `searchUsers` takes an optional `chatId` and restricts to users who
  participated in that chat.
- **No backfill needed:** posts / turnQueue / participationHistory are already
  keyed by `chatId`, and the registry maps channel -> chatId, so scoping by
  `chatId` uses columns that are already populated everywhere.
- `getAllPosts` stays global — it is only used by one-off maintenance scripts,
  not the UI.
- `AddUserModal` search stays global by design: it is an explicit admin action
  to add a known person into their own (already channel-scoped) session.

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

## Deploy checklist (before/at merge)

The `channels` registry gates the whole web app (`getMyChannels` returns 0 ->
unauthorized), so it must not be empty for the existing channel after deploy.

1. **Deploy Convex first** (`packages/db`: `bun run deploy`) so the new
   `channels` table, indexes, and queries exist before the new frontend calls
   them. The updated `getPaginatedPosts` now requires `chatId`, so the backend
   and the new web build must go out together — don't leave the old frontend
   pointed at the new backend.
2. **Seed the existing channel** so admins aren't locked out until the next
   channel post triggers auto-discovery:
   `bunx convex run migrations/seedChannels:seedChannels`
   (derives channelId -> chatId pairs from historical `messageAuthors`).
3. **Deploy the web build and the bot.** From then on, new channels register
   themselves from traffic and the admin-sync loop picks them up.

## Effort estimate

~4–5 days total. Risk is concentrated in Phase 2 (global `getAllPosts` scoping
and the `channelId` backfill).
