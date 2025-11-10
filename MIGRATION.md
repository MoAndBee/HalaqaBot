# Migration from Prisma to Supabase

✅ **Migration Status: COMPLETED**

This document outlines the completed migration from Prisma + SQLite to Supabase (PostgreSQL).

## What Changed

### Database
- **Before**: Local SQLite database with Prisma ORM
- **After**: Cloud-hosted PostgreSQL with Supabase

### Dependencies Removed
- `@prisma/client`
- `@prisma/extension-accelerate`
- `prisma`
- `better-sqlite3`
- `@types/better-sqlite3`

### Dependencies Added
- `@supabase/supabase-js`

### Environment Variables
- **Removed**: `DATABASE_URL`
- **Added**: 
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

## Migration Steps

### 1. Set Up Supabase Project

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor
3. Run the schema from `packages/db/supabase/schema.sql`

### 2. Update Environment Variables

Update your `.env` file:
```bash
# Remove
DATABASE_URL="..."

# Add
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies

```bash
cd packages/db
bun install
```

### 4. Migrate Data (Optional)

If you have existing data in SQLite that you want to migrate:

1. Export data from SQLite:
   ```bash
   sqlite3 data/bot.sqlite .dump > data_export.sql
   ```

2. Convert SQLite SQL to PostgreSQL format (manual adjustments needed)
3. Import into Supabase using the SQL Editor

### 5. Clean Up Old Files

The following files/folders have been removed:
- `packages/db/prisma/`
- `packages/db/src/generated/`
- SQLite database files (`.sqlite`)

## Schema Mapping

### Table Name Changes
All table names remain the same but use snake_case for columns:

| Prisma (camelCase) | Supabase (snake_case) |
|-------------------|----------------------|
| `chatId` | `chat_id` |
| `postId` | `post_id` |
| `messageId` | `message_id` |
| `userId` | `user_id` |
| `firstName` | `first_name` |
| `messageText` | `message_text` |
| `containsName` | `contains_name` |
| `detectedNames` | `detected_names` |
| `classifiedAt` | `classified_at` |

### Data Type Changes
- `Int` → `BIGINT` (for Telegram IDs)
- `String` → `TEXT`
- `DateTime` → `TIMESTAMPTZ`
- JSON arrays stored as `JSONB` instead of stringified JSON

## API Changes

The `StorageService` API remains the same - no changes needed in bot or web code. All methods work identically:

```typescript
// Same API, different backend
const storage = new StorageService();
await storage.addUserToList(chatId, postId, user);
```

## Benefits of Supabase

1. **Cloud-hosted**: No local database files to manage
2. **Real-time subscriptions**: Can add real-time features later
3. **Built-in auth**: If needed for web dashboard
4. **Automatic backups**: Data is automatically backed up
5. **Scalability**: PostgreSQL scales better than SQLite
6. **Dashboard**: Visual interface for data management

## Rollback

If you need to rollback to Prisma:

1. Restore `packages/db/package.json` from git history
2. Restore `packages/db/prisma/schema.prisma`
3. Restore `packages/db/src/storage.service.ts` from git history
4. Run `bun install` and `bunx prisma generate`
5. Update `.env` with `DATABASE_URL`
