# @halakabot/db

Shared database layer for HalakaBot using Supabase.

## Setup

1. Create a Supabase project at https://supabase.com
2. Run the schema migration in your Supabase SQL editor:
   - Copy the contents of `supabase/schema.sql`
   - Paste and execute in your Supabase project's SQL editor
3. Get your project credentials from Settings > API
4. Add to your `.env` file:
   ```
   SUPABASE_URL=your_project_url
   SUPABASE_ANON_KEY=your_anon_key
   ```

## Usage

```typescript
import { StorageService } from '@halakabot/db';

const storage = new StorageService();

// Use storage methods
await storage.addUserToList(chatId, postId, user);
```

## Migration from Prisma

The database schema has been migrated from Prisma to Supabase with the following changes:

- SQLite → PostgreSQL
- Prisma Client → Supabase JS Client
- Local database → Cloud-hosted Supabase
- All table structures and relationships preserved
- Column naming convention changed to snake_case (Supabase standard)
